# API Reference

Base URL: `http://localhost:8080/api/v1`

All requests and responses use `Content-Type: application/json`.

---

## Jobs

### Submit a Job

`POST /jobs`

Accepts a DAG definition and schedules it for execution. The server validates the graph (cycle detection, task type resolution) before persisting.

**Request Body**
```json
{
  "name": "nightly-etl-pipeline",
  "submittedBy": "alice",
  "tasks": [
    {
      "id": "extract",
      "name": "Extract from S3",
      "type": "HTTP_REQUEST",
      "payload": {
        "url": "https://internal-service/extract",
        "method": "POST"
      },
      "timeoutSeconds": 60,
      "maxRetries": 3,
      "dependencies": []
    },
    {
      "id": "transform",
      "name": "Transform Data",
      "type": "SHELL_COMMAND",
      "payload": {
        "command": "/scripts/transform.sh"
      },
      "timeoutSeconds": 120,
      "maxRetries": 2,
      "dependencies": ["extract"]
    },
    {
      "id": "load",
      "name": "Load to Warehouse",
      "type": "HTTP_REQUEST",
      "payload": {
        "url": "https://warehouse/load",
        "method": "POST"
      },
      "timeoutSeconds": 90,
      "maxRetries": 3,
      "dependencies": ["transform"]
    }
  ]
}
```

**Response** `201 Created`
```json
{
  "jobId": "3f7e8a10-1c2d-4f5a-9b6e-2a3c4d5e6f7a",
  "name": "nightly-etl-pipeline",
  "status": "RUNNING",
  "taskCount": 3,
  "createdAt": "2024-01-15T10:00:00Z"
}
```

**Error Responses**

| Code | Reason |
|---|---|
| `400` | Invalid JSON, missing required fields |
| `422` | DAG contains a cycle |
| `422` | Unknown task type referenced |

---

### List Jobs

`GET /jobs`

**Query Parameters**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `status` | string | (all) | Filter by job status |
| `q` | string | (all) | Case-insensitive substring match on the job name |
| `page` | int | 0 | Page number (0-indexed) |
| `size` | int | 20 | Page size (max 100) |
| `sort` | string | `createdAt,desc` | Sort field and direction; field must be one of `createdAt`, `updatedAt`, `name`, `status` |

**Response** `200 OK`
```json
{
  "content": [
    {
      "jobId": "3f7e8a10-...",
      "name": "nightly-etl-pipeline",
      "status": "SUCCESS",
      "taskCount": 3,
      "completedTasks": 3,
      "failedTasks": 0,
      "createdAt": "2024-01-15T10:00:00Z",
      "completedAt": "2024-01-15T10:04:32Z"
    }
  ],
  "totalElements": 47,
  "totalPages": 3,
  "number": 0,
  "size": 20
}
```

`completedTasks` counts `SUCCESS`; `failedTasks` counts `FAILED` + `TIMED_OUT`; both are computed per page in one query.

---

### Get Job Details

`GET /jobs/{jobId}`

Returns full job details including all tasks and their current statuses.

**Response** `200 OK`
```json
{
  "jobId": "3f7e8a10-...",
  "name": "nightly-etl-pipeline",
  "status": "RUNNING",
  "submittedBy": "alice",
  "createdAt": "2024-01-15T10:00:00Z",
  "completedAt": null,
  "tasks": [
    {
      "taskId": "a1b2c3d4-...",
      "name": "Extract from S3",
      "type": "HTTP_REQUEST",
      "status": "SUCCESS",
      "workerId": "worker-abc123",
      "retryCount": 0,
      "maxRetries": 3,
      "timeoutSeconds": 60,
      "startedAt": "2024-01-15T10:00:01Z",
      "completedAt": "2024-01-15T10:00:14Z",
      "errorMessage": null,
      "payload": { "url": "https://internal-service/extract", "method": "POST" },
      "dependencies": []
    },
    {
      "taskId": "e5f6a7b8-...",
      "name": "Transform Data",
      "type": "SHELL_COMMAND",
      "status": "RUNNING",
      "workerId": "worker-def456",
      "retryCount": 0,
      "maxRetries": 2,
      "timeoutSeconds": 120,
      "startedAt": "2024-01-15T10:00:15Z",
      "completedAt": null,
      "errorMessage": null,
      "payload": { "command": "/scripts/transform.sh" },
      "dependencies": ["a1b2c3d4-..."]
    }
  ]
}
```

`payload` carries the task definition (the shell command for `SHELL_COMMAND`), and `dependencies` are the **task UUIDs** of upstream tasks — this is what the console's DAG and step inspector render. `errorMessage` is populated for failed, timed-out and skipped (`CANCELLED`) tasks.

---

### Cancel a Job

`DELETE /jobs/{jobId}`

Cancels all `PENDING`, `QUEUED` and `RETRYING` tasks in the job and marks the job `CANCELLED`. Tasks already `RUNNING` are left to finish.

**Response** `200 OK`
```json
{
  "jobId": "3f7e8a10-...",
  "status": "CANCELLED",
  "message": "Job cancelled successfully"
}
```

Already-terminal jobs return `409 Conflict`.

---

## Tasks

### List Tasks

`GET /tasks`

Returns a page of task summaries across all jobs, newest first. The payload and output JSON are **not** included here — fetch `GET /tasks/{taskId}` for those.

**Query Parameters**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `status` | string | (all) | Filter by task status |
| `q` | string | (all) | Case-insensitive substring match on task name, task type or job name |
| `page` | int | 0 | Page number (0-indexed) |
| `size` | int | 50 | Page size (max 100) |

**Response** `200 OK`
```json
{
  "content": [
    {
      "taskId": "a1b2c3d4-...",
      "jobId": "3f7e8a10-...",
      "jobName": "nightly-etl-pipeline",
      "name": "Extract from S3",
      "type": "HTTP_REQUEST",
      "status": "SUCCESS",
      "retryCount": 0,
      "maxRetries": 3,
      "workerId": "worker-abc123",
      "errorMessage": null,
      "createdAt": "2024-01-15T10:00:00Z",
      "startedAt": "2024-01-15T10:00:01Z",
      "completedAt": "2024-01-15T10:00:14Z"
    }
  ],
  "totalElements": 128,
  "totalPages": 3,
  "number": 0,
  "size": 50
}
```

The job is fetched with an entity graph, so a page costs two queries instead of N+1.

---

### Get Task Details

`GET /tasks/{taskId}`

**Response** `200 OK`
```json
{
  "taskId": "a1b2c3d4-...",
  "jobId": "3f7e8a10-...",
  "jobName": "nightly-etl-pipeline",
  "name": "Extract from S3",
  "type": "HTTP_REQUEST",
  "status": "FAILED",
  "retryCount": 3,
  "maxRetries": 3,
  "timeoutSeconds": 60,
  "workerId": "worker-abc123",
  "errorMessage": "Connection refused: https://internal-service/extract",
  "createdAt": "2024-01-15T10:00:00Z",
  "startedAt": "2024-01-15T10:00:01Z",
  "completedAt": "2024-01-15T10:01:45Z",
  "payload": {
    "url": "https://internal-service/extract",
    "method": "POST"
  },
  "output": null
}
```

`payload` is the task definition as submitted (for `SHELL_COMMAND` it contains `command`); `output` is whatever the executor returned.

---

### Get Task Logs

`GET /tasks/{taskId}/logs`

Returns every log line written for the task (all retry attempts), oldest first. There is no server-side filtering or paging yet.

**Response** `200 OK`
```json
{
  "logs": [
    {
      "id": 1,
      "taskId": "a1b2c3d4-...",
      "level": "INFO",
      "message": "Task received by worker worker-abc123",
      "loggedAt": "2024-01-15T10:00:01Z",
      "workerId": "worker-abc123"
    },
    {
      "id": 2,
      "taskId": "a1b2c3d4-...",
      "level": "ERROR",
      "message": "Connection refused",
      "loggedAt": "2024-01-15T10:00:06Z",
      "workerId": "worker-abc123"
    }
  ]
}
```

---

## Workers

### List Workers

`GET /workers`

Returns every worker row still retained (24h by default) with its computed health status, sorted `HEALTHY`, `BUSY`, `STALE`, `DEAD`, then most recently seen first.

**Response** `200 OK`
```json
{
  "workers": [
    {
      "workerId": "worker-abc123",
      "hostname": "worker-host-1.internal",
      "status": "HEALTHY",
      "activeTasks": 3,
      "capacity": 8,
      "utilizationPct": 37.5,
      "lastSeenAt": "2024-01-15T10:05:00Z",
      "startedAt": "2024-01-15T09:00:00Z"
    },
    {
      "workerId": "worker-def456",
      "hostname": "worker-host-2.internal",
      "status": "BUSY",
      "activeTasks": 8,
      "capacity": 8,
      "utilizationPct": 100.0,
      "lastSeenAt": "2024-01-15T10:04:58Z",
      "startedAt": "2024-01-15T09:00:15Z"
    }
  ],
  "activeCount": 2,
  "inactiveCount": 0,
  "totalCapacity": 16,
  "totalActiveTasks": 11,
  "clusterUtilizationPct": 68.75
}
```

`activeCount` counts `HEALTHY` + `BUSY`; `inactiveCount` is everything else. Capacity and utilisation are computed over **active** workers only, so a dead worker never inflates the cluster total. The console hides inactive rows by default and lets you reveal them.

---

### Get Worker Details

`GET /workers/{workerId}`

**Response** `200 OK`
```json
{
  "workerId": "worker-abc123",
  "hostname": "worker-host-1.internal",
  "status": "HEALTHY",
  "activeTasks": 3,
  "capacity": 8,
  "utilizationPct": 37.5,
  "lastSeenAt": "2024-01-15T10:05:00Z",
  "startedAt": "2024-01-15T09:00:00Z"
}
```

Unknown worker IDs return `404 Not Found`.

---

## System

### Health Check

`GET /actuator/health`

Standard Spring Boot Actuator health endpoint. Returns status of all components.

**Response** `200 OK`
```json
{
  "status": "UP",
  "components": {
    "db": { "status": "UP" },
    "kafka": { "status": "UP" },
    "diskSpace": { "status": "UP" }
  }
}
```

---

### Metrics

- Master: `GET /actuator/metrics/{metricName}` (Spring Actuator) and `GET /actuator/prometheus`.
- Scheduler: `GET /metrics` on port 8081 (Prometheus text format).
- Worker: `GET /metrics` on port 8082 (Prometheus text format).

| Metric | Service | Description |
|---|---|---|
| `dtoe_scheduler_tasks_promoted_total` | Scheduler | Tasks promoted `PENDING`/`RETRYING` → `QUEUED` |
| `dtoe_task_retries_total` | Scheduler | Retries scheduled after a failure |
| `dtoe_task_timeouts_total` | Scheduler | Tasks marked `TIMED_OUT` |
| `dtoe_scheduler_poll_duration_seconds` | Scheduler | Poll loop duration histogram |
| `dtoe_kafka_messages_produced_total` | Scheduler | Queue messages published |
| `dtoe_kafka_produce_errors_total` | Scheduler | Failed publishes (task reverted) |
| `dtoe_worker_tasks_executed_total` | Worker | Tasks completed, by type and status |
| `dtoe_worker_task_execution_duration_seconds` | Worker | Execution duration histogram |
| `dtoe_worker_tasks_in_flight` | Worker | Tasks currently executing |
| `dtoe_worker_heartbeat_sent_total` | Worker | Heartbeats written |
| `dtoe_worker_heartbeat_errors_total` | Worker | Failed heartbeat writes |
| `dtoe_worker_task_log_entries_total` | Worker | Log lines inserted |
| `dtoe_worker_kafka_messages_processed_total` | Worker | Messages consumed |
| `dtoe_worker_kafka_consume_errors_total` | Worker | Consumer errors |
| `dtoe_worker_kafka_processing_errors_total` | Worker | Message processing errors |
