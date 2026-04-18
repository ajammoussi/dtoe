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

func (r *Repository) FindReadyTasks(ctx context.Context) ([]Task, error) {
	query := `
		SELECT t.id, t.job_id, t.name, t.type, t.payload, t.status,
		       t.retry_count, t.max_retries, t.timeout_seconds, t.worker_id,
		       t.created_at, t.updated_at, t.queued_at, t.started_at, t.completed_at, t.error_message, t.scheduled_for
		FROM tasks t
		WHERE t.status = 'PENDING'
		AND NOT EXISTS (
			SELECT 1 FROM task_dependencies td
			JOIN tasks dep ON dep.id = td.dependency_id
			WHERE td.task_id = t.id
			AND dep.status != 'SUCCESS'
		)
		FOR UPDATE SKIP LOCKED
	`

	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (Task, error) {
		var t Task
		err := row.Scan(
			&t.ID, &t.JobID, &t.Name, &t.Type, &t.Payload, &t.Status,
			&t.RetryCount, &t.MaxRetries, &t.TimeoutSeconds, &t.WorkerID,
			&t.CreatedAt, &t.UpdatedAt, &t.QueuedAt, &t.StartedAt, &t.CompletedAt, &t.ErrorMessage, &t.ScheduledFor,
		)
		return t, err
	})
}

func (r *Repository) FindTasksReadyForRetry(ctx context.Context) ([]Task, error) {
	query := `
		SELECT t.id, t.job_id, t.name, t.type, t.payload, t.status,
		       t.retry_count, t.max_retries, t.timeout_seconds, t.worker_id,
		       t.created_at, t.updated_at, t.queued_at, t.started_at, t.completed_at, t.error_message, t.scheduled_for
		FROM tasks t
		WHERE t.status = 'RETRYING'
		AND t.scheduled_for IS NOT NULL
		AND t.scheduled_for <= NOW()
		FOR UPDATE SKIP LOCKED
	`

	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (Task, error) {
		var t Task
		err := row.Scan(
			&t.ID, &t.JobID, &t.Name, &t.Type, &t.Payload, &t.Status,
			&t.RetryCount, &t.MaxRetries, &t.TimeoutSeconds, &t.WorkerID,
			&t.CreatedAt, &t.UpdatedAt, &t.QueuedAt, &t.StartedAt, &t.CompletedAt, &t.ErrorMessage, &t.ScheduledFor,
		)
		return t, err
	})
}

func (r *Repository) FindTimedOutTasks(ctx context.Context) ([]Task, error) {
	query := `
		SELECT id, job_id, name, type, payload, status,
		       retry_count, max_retries, timeout_seconds, worker_id,
		       created_at, updated_at, queued_at, started_at, completed_at, error_message, scheduled_for
		FROM tasks
		WHERE status = 'RUNNING'
		AND started_at < NOW() - (timeout_seconds * INTERVAL '1 second')
		FOR UPDATE SKIP LOCKED
	`

	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (Task, error) {
		var t Task
		err := row.Scan(
			&t.ID, &t.JobID, &t.Name, &t.Type, &t.Payload, &t.Status,
			&t.RetryCount, &t.MaxRetries, &t.TimeoutSeconds, &t.WorkerID,
			&t.CreatedAt, &t.UpdatedAt, &t.QueuedAt, &t.StartedAt, &t.CompletedAt, &t.ErrorMessage, &t.ScheduledFor,
		)
		return t, err
	})
}

func (r *Repository) UpdateTaskStatus(ctx context.Context, taskID uuid.UUID, status messaging.TaskStatus) error {
	_, err := r.pool.Exec(ctx,
		"UPDATE tasks SET status = $1, updated_at = NOW() WHERE id = $2",
		string(status), taskID,
	)
	return err
}

func (r *Repository) SetTaskQueued(ctx context.Context, taskID uuid.UUID) error {
	_, err := r.pool.Exec(ctx,
		"UPDATE tasks SET status = 'QUEUED', queued_at = NOW(), scheduled_for = NULL, updated_at = NOW() WHERE id = $1",
		taskID,
	)
	return err
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
		"UPDATE tasks SET status = 'RETRYING', scheduled_for = $1, completed_at = NULL, updated_at = NOW() WHERE id = $2",
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
