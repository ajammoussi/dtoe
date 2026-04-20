package db

import (
	"context"
	"time"

	"github.com/dtoe/go_shared/pkg/messaging"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Task struct {
	ID             uuid.UUID
	JobID          uuid.UUID
	Name           string
	Type           string
	Payload        map[string]interface{}
	Status         messaging.TaskStatus
	RetryCount     int
	MaxRetries     int
	TimeoutSeconds int
	WorkerID       *string
	CreatedAt      time.Time
	UpdatedAt      time.Time
	QueuedAt       *time.Time
	StartedAt      *time.Time
	CompletedAt    *time.Time
	ErrorMessage   *string
	ScheduledFor   *time.Time
}

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(ctx context.Context, connString string) (*Repository, error) {
	pool, err := pgxpool.New(ctx, connString)
	if err != nil {
		return nil, err
	}
	return &Repository{pool: pool}, nil
}

func (r *Repository) Close() {
	r.pool.Close()
}

// claimColumns is the RETURNING list shared by the two claiming statements; it
// must match scanTask's order.
const claimColumns = `id, job_id, name, type, payload, status,
	       retry_count, max_retries, timeout_seconds, worker_id,
	       created_at, updated_at, queued_at, started_at, completed_at, error_message, scheduled_for`

func scanTask(row pgx.CollectableRow) (Task, error) {
	var t Task
	err := row.Scan(
		&t.ID, &t.JobID, &t.Name, &t.Type, &t.Payload, &t.Status,
		&t.RetryCount, &t.MaxRetries, &t.TimeoutSeconds, &t.WorkerID,
		&t.CreatedAt, &t.UpdatedAt, &t.QueuedAt, &t.StartedAt, &t.CompletedAt, &t.ErrorMessage, &t.ScheduledFor,
	)
	return t, err
}

// ClaimReadyTasks transitions up to limit dependency-satisfied PENDING tasks to
// QUEUED and returns the new rows. The transition happens inside the statement,
// so concurrent schedulers cannot claim the same task.
func (r *Repository) ClaimReadyTasks(ctx context.Context, limit int) ([]Task, error) {
	query := `
		WITH ready AS (
			SELECT t.id FROM tasks t
			 WHERE t.status = 'PENDING'
			   AND NOT EXISTS (
					SELECT 1 FROM task_dependencies td
					JOIN tasks dep ON dep.id = td.dependency_id
					WHERE td.task_id = t.id
					AND dep.status != 'SUCCESS'
			   )
			 ORDER BY t.created_at
			 LIMIT $1
			 FOR UPDATE SKIP LOCKED
		)
		UPDATE tasks SET status = 'QUEUED', queued_at = NOW(), updated_at = NOW()
		 WHERE id IN (SELECT id FROM ready)
		RETURNING ` + claimColumns

	rows, err := r.pool.Query(ctx, query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return pgx.CollectRows(rows, scanTask)
}

// ClaimRetryTasks transitions up to limit due RETRYING tasks to QUEUED. It keeps
// scheduled_for so a failed publish can revert exactly this promotion.
func (r *Repository) ClaimRetryTasks(ctx context.Context, limit int) ([]Task, error) {
	query := `
		WITH due AS (
			SELECT id FROM tasks
			 WHERE status = 'RETRYING'
			   AND scheduled_for IS NOT NULL
			   AND scheduled_for <= NOW()
			 ORDER BY scheduled_for
			 LIMIT $1
			 FOR UPDATE SKIP LOCKED
		)
		UPDATE tasks SET status = 'QUEUED', queued_at = NOW(), updated_at = NOW()
		 WHERE id IN (SELECT id FROM due)
		RETURNING ` + claimColumns

	rows, err := r.pool.Query(ctx, query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return pgx.CollectRows(rows, scanTask)
}

// RevertQueuedToPending undoes a promotion whose Kafka publish failed.
func (r *Repository) RevertQueuedToPending(ctx context.Context, taskID uuid.UUID) error {
	_, err := r.pool.Exec(ctx,
		"UPDATE tasks SET status = 'PENDING', queued_at = NULL, updated_at = NOW() WHERE id = $1 AND status = 'QUEUED'",
		taskID,
	)
	return err
}

// RevertQueuedToRetrying undoes a retry promotion whose Kafka publish failed.
// scheduled_for is unchanged, so the next poll retries it again.
func (r *Repository) RevertQueuedToRetrying(ctx context.Context, taskID uuid.UUID) error {
	_, err := r.pool.Exec(ctx,
		"UPDATE tasks SET status = 'RETRYING', queued_at = NULL, updated_at = NOW() WHERE id = $1 AND status = 'QUEUED'",
		taskID,
	)
	return err
}

// RequeueStaleQueued returns QUEUED tasks whose message was never consumed
// (broker loss, crash between publish and consume) to PENDING.
func (r *Repository) RequeueStaleQueued(ctx context.Context, cutoff time.Time) (int64, error) {
	tag, err := r.pool.Exec(ctx,
		"UPDATE tasks SET status = 'PENDING', queued_at = NULL, updated_at = NOW() WHERE status = 'QUEUED' AND queued_at < $1",
		cutoff,
	)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

func (r *Repository) FindTimedOutTasks(ctx context.Context, graceSeconds int) ([]Task, error) {
	query := `
		SELECT id, job_id, name, type, payload, status,
		       retry_count, max_retries, timeout_seconds, worker_id,
		       created_at, updated_at, queued_at, started_at, completed_at, error_message, scheduled_for
		FROM tasks
		WHERE status = 'RUNNING'
		AND started_at < NOW() - ((timeout_seconds + $1) * INTERVAL '1 second')
	`

	rows, err := r.pool.Query(ctx, query, graceSeconds)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return pgx.CollectRows(rows, scanTask)
}

func (r *Repository) SetTaskTimedOut(ctx context.Context, taskID uuid.UUID) error {
	_, err := r.pool.Exec(ctx,
		"UPDATE tasks SET status = 'TIMED_OUT', completed_at = NOW(), updated_at = NOW() WHERE id = $1",
		taskID,
	)
	return err
}

func (r *Repository) SetTaskRetryingWithBackoff(ctx context.Context, taskID uuid.UUID, scheduledFor time.Time) error {
	_, err := r.pool.Exec(ctx,
		"UPDATE tasks SET status = 'RETRYING', retry_count = retry_count + 1, scheduled_for = $1, completed_at = NULL, updated_at = NOW() WHERE id = $2",
		scheduledFor, taskID,
	)
	return err
}

func (r *Repository) SetTaskFailed(ctx context.Context, taskID uuid.UUID) error {
	_, err := r.pool.Exec(ctx,
		"UPDATE tasks SET status = 'FAILED', completed_at = NOW(), updated_at = NOW() WHERE id = $1",
		taskID,
	)
	return err
}

func (r *Repository) CanRetry(task Task) bool {
	return task.RetryCount < task.MaxRetries
}

func (r *Repository) InsertTaskLog(ctx context.Context, taskID uuid.UUID, workerID, level, message string) error {
	_, err := r.pool.Exec(ctx,
		"INSERT INTO task_logs (task_id, worker_id, level, message, logged_at) VALUES ($1, $2, $3, $4, NOW())",
		taskID, workerID, level, message,
	)
	return err
}
