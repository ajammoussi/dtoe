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
        return int(atomic.LoadInt32(&cfg.Worker.ThreadPoolSize))
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
                continue
            }

            taskMsg, err := messaging.ParseTaskMessage(msg.Value)
            if err != nil {
                c.logger.Errorw("Failed to parse task message", "error", err)
                continue
            }

            atomic.AddInt32(&c.activeTasks, 1)
            go c.processTask(ctx, taskMsg)
        }
    }
}

func (c *Consumer) processTask(ctx context.Context, msg *messaging.TaskMessage) {
    defer atomic.AddInt32(&c.activeTasks, -1)

    taskUUID, err := uuid.Parse(msg.TaskID)
    if err != nil {
        c.logger.Errorw("Invalid task ID", "taskId", msg.TaskID, "error", err)
        return
    }

    acquired, err := c.tryAcquireLock(ctx, taskUUID)
    if err != nil {
        c.logger.Errorw("Failed to acquire lock", "taskId", msg.TaskID, "error", err)
        return
    }
    if !acquired {
        c.logger.Debugw("Task already being processed by another worker", "taskId", msg.TaskID)
        return
    }
    defer c.releaseLock(ctx, taskUUID)

    if err := c.setTaskRunning(ctx, taskUUID); err != nil {
        c.logger.Errorw("Failed to set task running", "taskId", msg.TaskID, "error", err)
        return
    }

    result := c.executor.Execute(ctx, msg)

    resultMsg := messaging.TaskResultMessage{
        TaskID:      msg.TaskID,
        JobID:       msg.JobID,
        WorkerID:    c.workerID,
        Status:      result.Status,
        Output:      result.Output,
        ErrorMessage: result.Error,
        StartedAt:   result.StartedAt,
        CompletedAt: result.CompletedAt,
    }

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

func (c *Consumer) SendHeartbeat(ctx context.Context) error {
    return c.heartbeat.SendHeartbeat(ctx)
}

func (c *Consumer) GetWorkerID() string {
    return c.workerID
}

func (c *Consumer) GetActiveTasks() int32 {
    return atomic.LoadInt32(&c.activeTasks)
}
