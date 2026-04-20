package scheduler

import (
	"context"
	"fmt"
	"math"
	"time"

	"github.com/dtoe/go_shared/pkg/messaging"
	"github.com/dtoe/scheduler/internal/config"
	"github.com/dtoe/scheduler/internal/db"
	"github.com/dtoe/scheduler/internal/metrics"
	"github.com/segmentio/kafka-go"
	gozap "go.uber.org/zap"
)

const (
	baseDelaySeconds = 2
	maxDelaySeconds  = 60
	promotionBatch   = 100
	// Workers enforce their own deadline and report TIMED_OUT first, so this
	// grace only recovers tasks whose worker died before publishing a result.
	timeoutGraceSeconds = 30
)

type Scheduler struct {
	repo        *db.Repository
	kafkaWriter *kafka.Writer
	config      *config.SchedulerConfig
	logger      *gozap.SugaredLogger
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
	start := time.Now()
	defer func() { metrics.SchedulerPollDuration.Observe(time.Since(start).Seconds()) }()

	tasks, err := s.repo.ClaimReadyTasks(ctx, promotionBatch)
	if err != nil {
		return err
	}

	if len(tasks) == 0 {
		return nil
	}

	s.logger.Infow("Promoting ready tasks", "count", len(tasks))

	for _, task := range tasks {
		if err := s.publish(ctx, task); err != nil {
			metrics.KafkaProduceErrors.Inc()
			s.logger.Errorw("Failed to publish task, reverting to PENDING", "taskId", task.ID, "error", err)
			if revertErr := s.repo.RevertQueuedToPending(context.WithoutCancel(ctx), task.ID); revertErr != nil {
				s.logger.Errorw("Failed to revert task to PENDING", "taskId", task.ID, "error", revertErr)
			}
			continue
		}
		metrics.SchedulerTasksPromoted.Inc()
		metrics.KafkaMessagesProduced.Inc()
		s.logger.Debugw("Promoted task to QUEUED", "taskId", task.ID)
	}

	return nil
}

func (s *Scheduler) PromoteRetryingTasks(ctx context.Context) error {
	tasks, err := s.repo.ClaimRetryTasks(ctx, promotionBatch)
	if err != nil {
		return err
	}

	if len(tasks) == 0 {
		return nil
	}

	s.logger.Infow("Promoting retrying tasks", "count", len(tasks))

	for _, task := range tasks {
		if err := s.publish(ctx, task); err != nil {
			metrics.KafkaProduceErrors.Inc()
			s.logger.Errorw("Failed to publish retrying task, reverting to RETRYING", "taskId", task.ID, "error", err)
			if revertErr := s.repo.RevertQueuedToRetrying(context.WithoutCancel(ctx), task.ID); revertErr != nil {
				s.logger.Errorw("Failed to revert task to RETRYING", "taskId", task.ID, "error", revertErr)
			}
			continue
		}
		metrics.TaskRetriesTotal.Inc()
		metrics.KafkaMessagesProduced.Inc()
		s.logger.Infow("Promoted retrying task to QUEUED", "taskId", task.ID, "retryCount", task.RetryCount)
	}

	return nil
}

func (s *Scheduler) publish(ctx context.Context, task db.Task) error {
	msg := messaging.TaskMessage{
		TaskID:         task.ID.String(),
		JobID:          task.JobID.String(),
		Type:           task.Type,
		Payload:        task.Payload,
		TimeoutSeconds: task.TimeoutSeconds,
		RetryCount:     task.RetryCount,
		MaxRetries:     task.MaxRetries,
		EnqueuedAt:     messaging.CustomTime{Time: time.Now()},
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
	tasks, err := s.repo.FindTimedOutTasks(ctx, timeoutGraceSeconds)
	if err != nil {
		return err
	}

	if len(tasks) == 0 {
		return nil
	}

	s.logger.Warnw("Found timed out tasks", "count", len(tasks))

	for _, task := range tasks {
		s.logger.Warnw("Task timed out", "taskId", task.ID, "timeoutSeconds", task.TimeoutSeconds)
		metrics.TaskTimeoutsTotal.Inc()

		if err := s.repo.SetTaskTimedOut(ctx, task.ID); err != nil {
			s.logger.Errorw("Failed to set task timed out", "taskId", task.ID, "error", err)
			continue
		}

		if s.repo.CanRetry(task) {
			newRetryCount := task.RetryCount + 1
			backoffDelay := s.calculateBackoff(newRetryCount)
			scheduledFor := time.Now().Add(backoffDelay)

			s.logger.Infow("Scheduling task retry with backoff",
				"taskId", task.ID,
				"retryCount", newRetryCount,
				"maxRetries", task.MaxRetries,
				"backoffDelay", backoffDelay,
				"scheduledFor", scheduledFor,
			)

			if err := s.repo.SetTaskRetryingWithBackoff(ctx, task.ID, scheduledFor); err != nil {
				s.logger.Errorw("Failed to set task retrying", "taskId", task.ID, "error", err)
			}

			logMsg := fmt.Sprintf("Task timed out after %ds, scheduling retry %d/%d",
				task.TimeoutSeconds, newRetryCount, task.MaxRetries)
			if err := s.repo.InsertTaskLog(ctx, task.ID, "", "WARN", logMsg); err != nil {
				s.logger.Debugw("Failed to insert task log", "error", err)
			}
		} else {
			s.logger.Warnw("Max retries exceeded, marking task as FAILED", "taskId", task.ID)
			if err := s.repo.SetTaskFailed(ctx, task.ID); err != nil {
				s.logger.Errorw("Failed to mark task as failed", "taskId", task.ID, "error", err)
			}

			logMsg := fmt.Sprintf("Task failed after max retries (%d)", task.MaxRetries)
			if err := s.repo.InsertTaskLog(ctx, task.ID, "", "ERROR", logMsg); err != nil {
				s.logger.Debugw("Failed to insert task log", "error", err)
			}
		}
	}

	return nil
}

// RequeueStaleQueued returns QUEUED tasks older than olderThan to PENDING so a
// message lost between publish and consume cannot strand a task forever.
func (s *Scheduler) RequeueStaleQueued(ctx context.Context, olderThan time.Duration) (int64, error) {
	return s.repo.RequeueStaleQueued(ctx, time.Now().Add(-olderThan))
}

func (s *Scheduler) calculateBackoff(retryCount int) time.Duration {
	delaySeconds := int64(math.Pow(2, float64(retryCount))) * baseDelaySeconds
	cappedDelay := minInt64(delaySeconds, maxDelaySeconds)
	return time.Duration(cappedDelay) * time.Second
}

func minInt64(a, b int64) int64 {
	if a < b {
		return a
	}
	return b
}
