package kafka

import (
	"context"
	"fmt"
	"sync/atomic"
	"time"

	"github.com/dtoe/go_shared/pkg/messaging"
	"github.com/dtoe/worker/internal/config"
	"github.com/dtoe/worker/internal/executor"
	"github.com/dtoe/worker/internal/heartbeat"
	"github.com/dtoe/worker/internal/metrics"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/segmentio/kafka-go"
	gozap "go.uber.org/zap"
)

type Consumer struct {
	reader       *kafka.Reader
	resultWriter *kafka.Writer
	executor     *executor.TaskExecutor
	heartbeat    *heartbeat.Service
	dbPool       *pgxpool.Pool
	workerID     string
	activeTasks  int32
	logger       *gozap.SugaredLogger
}

func NewConsumer(cfg *config.Config, logger *gozap.SugaredLogger) (*Consumer, error) {
	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:  cfg.Kafka.Brokers,
		Topic:    cfg.Kafka.TaskQueueTopic,
		GroupID:  cfg.Kafka.ConsumerGroup,
		MinBytes: 1e3,
		MaxBytes: 10e6,
	})

	resultWriter := &kafka.Writer{
		Addr:         kafka.TCP(cfg.Kafka.Brokers...),
		Topic:        cfg.Kafka.TaskResultTopic,
		Balancer:     &kafka.Hash{},
		WriteTimeout: 10 * time.Second,
	}

	workerID := cfg.Worker.ID
	if workerID == "" {
		workerID = "worker-" + uuid.New().String()[:8]
	}

	connString := buildConnString(&cfg.Database)
	pool, err := pgxpool.New(context.Background(), connString)
	if err != nil {
		return nil, err
	}

	hb, err := heartbeat.NewService(connString, workerID, func() int {
		return cfg.Worker.ThreadPoolSize
	}, cfg.Worker.ThreadPoolSize)
	if err != nil {
		return nil, err
	}

	return &Consumer{
		reader:       reader,
		resultWriter: resultWriter,
		executor:     executor.NewTaskExecutor(),
		heartbeat:    hb,
		dbPool:       pool,
		workerID:     workerID,
		logger:       logger,
	}, nil
}

func buildConnString(cfg *config.DatabaseConfig) string {
	return fmt.Sprintf("postgres://%s:%s@%s:%d/%s", cfg.User, cfg.Password, cfg.Host, cfg.Port, cfg.Database)
}

func (c *Consumer) Close() error {
	c.heartbeat.Close()
	c.dbPool.Close()
	if err := c.reader.Close(); err != nil {
		return err
	}
	return c.resultWriter.Close()
}

func (c *Consumer) Run(ctx context.Context) error {
	for {
		select {
		case <-ctx.Done():
			return nil
		default:
			msg, err := c.reader.ReadMessage(ctx)
			if err != nil {
				c.logger.Errorw("Failed to read message", "error", err)
				metrics.KafkaConsumeErrors.Inc()
				continue
			}

			metrics.KafkaMessagesProcessed.Inc()

			taskMsg, err := messaging.ParseTaskMessage(msg.Value)
			if err != nil {
				c.logger.Errorw("Failed to parse task message", "error", err)
				metrics.KafkaProcessingErrors.Inc()
				continue
			}

			atomic.AddInt32(&c.activeTasks, 1)
			go c.processTask(ctx, taskMsg)
		}
	}
}

func (c *Consumer) processTask(ctx context.Context, msg *messaging.TaskMessage) {
	defer atomic.AddInt32(&c.activeTasks, -1)
	metrics.RecordTaskStart()

	taskUUID, err := uuid.Parse(msg.TaskID)
	if err != nil {
		c.logger.Errorw("Invalid task ID", "taskId", msg.TaskID, "error", err)
		metrics.RecordTaskEnd()
		return
	}

	c.insertTaskLog(ctx, taskUUID, "INFO", "Task received by worker "+c.workerID)

	acquired, err := c.tryAcquireLock(ctx, taskUUID)
	if err != nil {
		c.logger.Errorw("Failed to acquire lock", "taskId", msg.TaskID, "error", err)
		c.insertTaskLog(ctx, taskUUID, "ERROR", "Failed to acquire lock: "+err.Error())
		metrics.RecordTaskEnd()
		return
	}
	if !acquired {
		c.logger.Debugw("Task already being processed by another worker", "taskId", msg.TaskID)
		metrics.RecordTaskEnd()
		return
	}
	defer c.releaseLock(ctx, taskUUID)

	if err := c.setTaskRunning(ctx, taskUUID); err != nil {
		c.logger.Errorw("Failed to set task running", "taskId", msg.TaskID, "error", err)
		c.insertTaskLog(ctx, taskUUID, "ERROR", "Failed to set task running: "+err.Error())
		metrics.RecordTaskEnd()
		return
	}

	c.insertTaskLog(ctx, taskUUID, "INFO", fmt.Sprintf("Task started (type=%s, timeout=%ds, retry=%d/%d)",
		msg.Type, msg.TimeoutSeconds, msg.RetryCount, msg.MaxRetries))

	result := c.executor.Execute(ctx, msg)

	resultMsg := messaging.TaskResultMessage{
		TaskID:       msg.TaskID,
		JobID:        msg.JobID,
		WorkerID:     c.workerID,
		Status:       result.Status,
		Output:       result.Output,
		ErrorMessage: result.Error,
		StartedAt:    result.StartedAt,
		CompletedAt:  result.CompletedAt,
	}

	if result.Status == messaging.TaskStatusSuccess {
		c.insertTaskLog(ctx, taskUUID, "INFO", "Task completed successfully")
	} else {
		c.insertTaskLog(ctx, taskUUID, "ERROR", "Task failed: "+result.Error)
	}

	metrics.RecordTaskResult(msg.Type, result.Status, result.CompletedAt.Sub(result.StartedAt))
	metrics.RecordTaskEnd()

	data, err := resultMsg.ToJSON()
	if err != nil {
		c.logger.Errorw("Failed to serialize result message", "error", err)
		return
	}

	if err := c.resultWriter.WriteMessages(ctx, kafka.Message{
		Key:   []byte(msg.JobID),
		Value: data,
	}); err != nil {
		c.logger.Errorw("Failed to write result message", "error", err)
	}
}

func (c *Consumer) tryAcquireLock(ctx context.Context, taskID uuid.UUID) (bool, error) {
	lockKey := int64(taskID.ID())
	if lockKey < 0 {
		lockKey = -lockKey
	}

	var acquired bool
	err := c.dbPool.QueryRow(ctx, "SELECT pg_try_advisory_lock($1)", lockKey).Scan(&acquired)
	return acquired, err
}

func (c *Consumer) releaseLock(ctx context.Context, taskID uuid.UUID) error {
	lockKey := int64(taskID.ID())
	if lockKey < 0 {
		lockKey = -lockKey
	}
	_, err := c.dbPool.Exec(ctx, "SELECT pg_advisory_unlock($1)", lockKey)
	return err
}

func (c *Consumer) setTaskRunning(ctx context.Context, taskID uuid.UUID) error {
	_, err := c.dbPool.Exec(ctx,
		"UPDATE tasks SET status = 'RUNNING', started_at = NOW(), worker_id = $1, updated_at = NOW() WHERE id = $2",
		c.workerID, taskID,
	)
	return err
}

func (c *Consumer) insertTaskLog(ctx context.Context, taskID uuid.UUID, level, message string) {
	_, err := c.dbPool.Exec(ctx,
		"INSERT INTO task_logs (task_id, worker_id, level, message, logged_at) VALUES ($1, $2, $3, $4, NOW())",
		taskID, c.workerID, level, message,
	)
	if err != nil {
		c.logger.Debugw("Failed to insert task log", "taskId", taskID, "error", err)
	}
}

func (c *Consumer) SendHeartbeat(ctx context.Context) error {
	return c.heartbeat.SendHeartbeat(ctx)
}

func (c *Consumer) GetWorkerID() string {
	return c.workerID
}

func (c *Consumer) GetActiveTasks() int32 {
	return atomic.LoadInt32(&c.activeTasks)
}

func (c *Consumer) WaitForCompletion(ctx context.Context, timeout time.Duration) bool {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if atomic.LoadInt32(&c.activeTasks) == 0 {
			return true
		}
		time.Sleep(100 * time.Millisecond)
	}
	return false
}
