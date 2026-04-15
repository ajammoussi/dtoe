package scheduler

import (
    "context"
    "time"

    "github.com/dtoe/go_shared/pkg/messaging"
    "github.com/dtoe/scheduler/internal/config"
    "github.com/dtoe/scheduler/internal/db"
    "github.com/segmentio/kafka-go"
    gozap "go.uber.org/zap"
)

type Scheduler struct {
    repo          *db.Repository
    kafkaWriter   *kafka.Writer
    config        *config.SchedulerConfig
    logger        *gozap.SugaredLogger
}

func NewScheduler(repo *db.Repository, kafkaWriter *kafka.Writer, cfg *config.SchedulerConfig, logger *gozap.SugaredLogger) *Scheduler {
    return &Scheduler{
        repo:        repo,
        kafkaWriter: kafkaWriter,
        config:      cfg,
        logger:      logger,
    }
}

func (s *Scheduler) PromoteReadyTasks(ctx context.Context) error {
    tasks, err := s.repo.FindReadyTasks(ctx)
    if err != nil {
        return err
    }

    if len(tasks) == 0 {
        return nil
    }

    s.logger.Infow("Promoting ready tasks", "count", len(tasks))

    for _, task := range tasks {
        if err := s.enqueueTask(ctx, task); err != nil {
            s.logger.Errorw("Failed to enqueue task", "taskId", task.ID, "error", err)
            continue
        }
        s.logger.Debugw("Promoted task to QUEUED", "taskId", task.ID)
    }

    return nil
}

func (s *Scheduler) enqueueTask(ctx context.Context, task db.Task) error {
    if err := s.repo.SetTaskQueued(ctx, task.ID); err != nil {
        return err
    }

    msg := messaging.TaskMessage{
        TaskID:         task.ID.String(),
        JobID:          task.JobID.String(),
        Type:           task.Type,
        Payload:        task.Payload,
        TimeoutSeconds: task.TimeoutSeconds,
        RetryCount:     task.RetryCount,
        MaxRetries:     task.MaxRetries,
        EnqueuedAt:     time.Now(),
    }

    data, err := msg.ToJSON()
    if err != nil {
        return err
    }

    return s.kafkaWriter.WriteMessages(ctx, kafka.Message{
        Key:   []byte(task.JobID.String()),
        Value: data,
    })
}

func (s *Scheduler) EnforceTimeouts(ctx context.Context) error {
    tasks, err := s.repo.FindTimedOutTasks(ctx)
    if err != nil {
        return err
    }

    if len(tasks) == 0 {
        return nil
    }

    s.logger.Warnw("Found timed out tasks", "count", len(tasks))

    for _, task := range tasks {
        s.logger.Warnw("Task timed out", "taskId", task.ID, "timeoutSeconds", task.TimeoutSeconds)

        if err := s.repo.SetTaskTimedOut(ctx, task.ID); err != nil {
            s.logger.Errorw("Failed to set task timed out", "taskId", task.ID, "error", err)
            continue
        }

        if s.repo.CanRetry(task) {
            s.logger.Infow("Retrying timed out task", "taskId", task.ID, "retryCount", task.RetryCount+1)
            if err := s.repo.IncrementRetryCount(ctx, task.ID); err != nil {
                s.logger.Errorw("Failed to increment retry count", "taskId", task.ID, "error", err)
                continue
            }

            updatedTask := task
            updatedTask.RetryCount++
            updatedTask.Status = messaging.TaskStatusRetrying

            if err := s.enqueueTask(ctx, updatedTask); err != nil {
                s.logger.Errorw("Failed to re-enqueue task", "taskId", task.ID, "error", err)
            }
        } else {
            s.logger.Warnw("Max retries exceeded, marking task as FAILED", "taskId", task.ID)
            if err := s.repo.SetTaskFailed(ctx, task.ID); err != nil {
                s.logger.Errorw("Failed to mark task as failed", "taskId", task.ID, "error", err)
            }
        }
    }

    return nil
}
