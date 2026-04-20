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
	reader         *kafka.Reader
	resultWriter   *kafka.Writer
	executor       *executor.TaskExecutor
	heartbeat      *heartbeat.Service
	workerSlots    chan struct{}
	dbPool         *pgxpool.Pool
	workerID       string
	activeTasks    int32
	logger         *gozap.SugaredLogger
	taskBaseCtx    context.Context
	taskBaseCancel context.CancelFunc
}

func NewConsumer(cfg *config.Config, logger *gozap.SugaredLogger) (*Consumer, error) {
	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:        cfg.Kafka.Brokers,
		Topic:          cfg.Kafka.TaskQueueTopic,
		GroupID:        cfg.Kafka.ConsumerGroup,
		MinBytes:       1,
		MaxBytes:       10e6,
		MaxWait:        1 * time.Second,
		CommitInterval: 0, // commit explicitly, after the task row is claimed
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

	consumer := &Consumer{
		reader:       reader,
		resultWriter: resultWriter,
		executor:     executor.NewTaskExecutor(),
		workerSlots:  make(chan struct{}, cfg.Worker.ThreadPoolSize),
		dbPool:       pool,
		workerID:     workerID,
		logger:       logger,
	}
	consumer.taskBaseCtx, consumer.taskBaseCancel = context.WithCancel(context.Background())

	hb := heartbeat.NewService(pool, workerID, func() int {
		return int(consumer.GetActiveTasks())
	}, cfg.Worker.ThreadPoolSize)

	consumer.heartbeat = hb

	return consumer, nil
}

func buildConnString(cfg *config.DatabaseConfig) string {
	return fmt.Sprintf("postgres://%s:%s@%s:%d/%s", cfg.User, cfg.Password, cfg.Host, cfg.Port, cfg.Database)
}

func (c *Consumer) Close() error {
	c.taskBaseCancel()
	readErr := c.reader.Close()
	writeErr := c.resultWriter.Close()
	c.dbPool.Close()
	if readErr != nil {
		return readErr
	}
	return writeErr
}

func (c *Consumer) Run(ctx context.Context) error {
	c.logger.Infow("Starting consumer", "topic", c.reader.Config().Topic, "groupID", c.reader.Config().GroupID)
	for {
		select {
		case <-ctx.Done():
			c.logger.Info("Consumer context cancelled")
			return nil
		default:
			c.logger.Debug("Waiting for message...")
			msg, err := c.reader.FetchMessage(ctx)
			if err != nil {
				if ctx.Err() != nil {
					c.logger.Info("Consumer context cancelled while reading from Kafka")
					return nil
				}
				c.logger.Errorw("Failed to fetch message", "error", err)
				metrics.KafkaConsumeErrors.Inc()
				time.Sleep(500 * time.Millisecond)
				continue
			}

			c.logger.Infow("Received message", "partition", msg.Partition, "offset", msg.Offset, "key", string(msg.Key), "size", len(msg.Value))
			metrics.KafkaMessagesProcessed.Inc()

			taskMsg, err := messaging.ParseTaskMessage(msg.Value)
			if err != nil {
				c.logger.Errorw("Failed to parse task message", "error", err, "rawMessage", string(msg.Value))
				metrics.KafkaProcessingErrors.Inc()
				c.commit(ctx, msg)
				continue
			}

			taskUUID, err := uuid.Parse(taskMsg.TaskID)
			if err != nil {
				c.logger.Errorw("Invalid task ID", "taskId", taskMsg.TaskID, "error", err)
				metrics.KafkaProcessingErrors.Inc()
				c.commit(ctx, msg)
				continue
			}

			c.logger.Infow("Parsed task message", "taskId", taskMsg.TaskID, "jobId", taskMsg.JobID, "type", taskMsg.Type)

			claimed, err := c.claimTask(ctx, taskUUID)
			if err != nil {
				// The task row was not claimed, so the message must be redelivered.
				c.logger.Errorw("Failed to claim task", "taskId", taskMsg.TaskID, "error", err)
				metrics.KafkaConsumeErrors.Inc()
				time.Sleep(time.Second)
				continue
			}
			if !claimed {
				c.logger.Debugw("Task is no longer QUEUED, discarding message", "taskId", taskMsg.TaskID)
				c.commit(ctx, msg)
				continue
			}

			// From here the DB row owns the task: on a crash it stays RUNNING and
			// the scheduler's timeout check recovers it.
			c.commit(ctx, msg)

			select {
			case c.workerSlots <- struct{}{}:
			case <-ctx.Done():
				c.logger.Info("Consumer context cancelled before scheduling task")
				return nil
			}

			atomic.AddInt32(&c.activeTasks, 1)
			go c.processTask(c.taskBaseCtx, taskMsg, taskUUID)
		}
	}
}

func (c *Consumer) commit(ctx context.Context, msg kafka.Message) {
	if err := c.reader.CommitMessages(ctx, msg); err != nil {
		c.logger.Errorw("Failed to commit offset", "partition", msg.Partition, "offset", msg.Offset, "error", err)
	}
}

func (c *Consumer) processTask(ctx context.Context, msg *messaging.TaskMessage, taskUUID uuid.UUID) {
	defer func() {
		<-c.workerSlots
		atomic.AddInt32(&c.activeTasks, -1)
	}()
	metrics.RecordTaskStart()

	c.logger.Infow("Processing task", "taskId", msg.TaskID, "jobId", msg.JobID, "type", msg.Type)

	c.insertTaskLog(ctx, taskUUID, "INFO", "Task received by worker "+c.workerID)

	c.insertTaskLog(ctx, taskUUID, "INFO", fmt.Sprintf("Task started (type=%s, timeout=%ds, retry=%d/%d)",
		msg.Type, msg.TimeoutSeconds, msg.RetryCount, msg.MaxRetries))

	c.logger.Infow("Executing task", "taskId", msg.TaskID, "type", msg.Type)
	result := c.executor.Execute(ctx, msg)

	c.logger.Infow("Task execution completed", "taskId", msg.TaskID, "status", result.Status, "duration", result.CompletedAt.Sub(result.StartedAt).String())

	resultMsg := messaging.TaskResultMessage{
		TaskID:       msg.TaskID,
		JobID:        msg.JobID,
		WorkerID:     c.workerID,
		Status:       result.Status,
		Output:       result.Output,
		ErrorMessage: result.Error,
		StartedAt:    messaging.CustomTime{Time: result.StartedAt},
		CompletedAt:  messaging.CustomTime{Time: result.CompletedAt},
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

	c.logger.Infow("Sending result message", "taskId", msg.TaskID, "status", result.Status)
	if err := c.resultWriter.WriteMessages(ctx, kafka.Message{
		Key:   []byte(msg.JobID),
		Value: data,
	}); err != nil {
		c.logger.Errorw("Failed to write result message", "error", err)
	}

	c.logger.Infow("Task processing complete", "taskId", msg.TaskID)
}

// claimTask moves the task QUEUED -> RUNNING only if it is still QUEUED.
// Returns false when another worker already claimed it, or when the task was
// cancelled/finished while the message sat in the topic.
func (c *Consumer) claimTask(ctx context.Context, taskID uuid.UUID) (bool, error) {
	tag, err := c.dbPool.Exec(ctx, `
		UPDATE tasks
		   SET status = 'RUNNING', started_at = NOW(), completed_at = NULL,
		       error_message = NULL, worker_id = $1, updated_at = NOW()
		 WHERE id = $2 AND status = 'QUEUED'`, c.workerID, taskID)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() == 1, nil
}

func (c *Consumer) insertTaskLog(ctx context.Context, taskID uuid.UUID, level, message string) {
	_, err := c.dbPool.Exec(ctx,
		"INSERT INTO task_logs (task_id, worker_id, level, message, logged_at) VALUES ($1, $2, $3, $4, NOW())",
		taskID, c.workerID, level, message,
	)
	if err != nil {
		c.logger.Debugw("Failed to insert task log", "taskId", taskID, "error", err)
		return
	}
	metrics.TaskLogEntries.Inc()
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
		select {
		case <-ctx.Done():
			return false
		default:
		}
		if atomic.LoadInt32(&c.activeTasks) == 0 {
			return true
		}
		time.Sleep(100 * time.Millisecond)
	}
	return false
}
