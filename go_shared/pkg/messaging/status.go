package messaging

type TaskStatus string

const (
    TaskStatusPending   TaskStatus = "PENDING"
    TaskStatusQueued    TaskStatus = "QUEUED"
    TaskStatusRunning   TaskStatus = "RUNNING"
    TaskStatusSuccess   TaskStatus = "SUCCESS"
    TaskStatusFailed    TaskStatus = "FAILED"
    TaskStatusRetrying  TaskStatus = "RETRYING"
    TaskStatusTimedOut  TaskStatus = "TIMED_OUT"
    TaskStatusCancelled TaskStatus = "CANCELLED"
)

type JobStatus string

const (
    JobStatusRunning   JobStatus = "RUNNING"
    JobStatusSuccess   JobStatus = "SUCCESS"
    JobStatusFailed    JobStatus = "FAILED"
    JobStatusCancelled JobStatus = "CANCELLED"
)

type WorkerStatus string

const (
    WorkerStatusHealthy WorkerStatus = "HEALTHY"
    WorkerStatusBusy    WorkerStatus = "BUSY"
    WorkerStatusStale   WorkerStatus = "STALE"
    WorkerStatusDead    WorkerStatus = "DEAD"
)
