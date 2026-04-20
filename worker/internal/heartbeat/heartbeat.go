package heartbeat

import (
	"context"
	"os"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Service struct {
	pool           *pgxpool.Pool
	workerID       string
	hostname       string
	getActiveTasks func() int
	capacity       int
}

func NewService(pool *pgxpool.Pool, workerID string, getActiveTasks func() int, capacity int) *Service {
	hostname, _ := os.Hostname()
	if hostname == "" {
		hostname = "unknown"
	}

	if workerID == "" {
		workerID = "worker-" + uuid.New().String()[:8]
	}

	return &Service{
		pool:           pool,
		workerID:       workerID,
		hostname:       hostname,
		getActiveTasks: getActiveTasks,
		capacity:       capacity,
	}
}

func (s *Service) SendHeartbeat(ctx context.Context) error {
	query := `
        INSERT INTO worker_heartbeats (worker_id, hostname, active_tasks, capacity, last_seen_at, started_at)
        VALUES ($1, $2, $3, $4, NOW(), NOW())
        ON CONFLICT (worker_id) DO UPDATE SET
            hostname = EXCLUDED.hostname,
            active_tasks = EXCLUDED.active_tasks,
            capacity = EXCLUDED.capacity,
            last_seen_at = NOW()
    `

	_, err := s.pool.Exec(ctx, query, s.workerID, s.hostname, s.getActiveTasks(), s.capacity)
	return err
}

func (s *Service) GetWorkerID() string {
	return s.workerID
}
