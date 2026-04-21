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
| `page` | int | 0 | Page number (0-indexed) |
| `size` | int | 20 | Page size (max 100) |
| `sort` | string | `createdAt,desc` | Sort field and direction |

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
      "createdAt": "2024-01-15T10:00:00Z",
      "completedAt": "2024-01-15T10:04:32Z"
    }
  ],
  "totalElements": 47,
  "totalPages": 3,
  "page": 0,
  "size": 20
}
```

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
  "tasks": [
    {
      "taskId": "a1b2c3d4-...",
      "name": "Extract from S3",
      "type": "HTTP_REQUEST",
      "status": "SUCCESS",
      "workerId": "worker-abc123",
      "retryCount": 0,
      "startedAt": "2024-01-15T10:00:01Z",
      "completedAt": "2024-01-15T10:00:14Z",
      "dependencies": []
    },
    {
      "taskId": "e5f6a7b8-...",
      "name": "Transform Data",
      "type": "SHELL_COMMAND",
      "status": "RUNNING",
      "workerId": "worker-def456",
      "retryCount": 0,
      "startedAt": "2024-01-15T10:00:15Z",
      "completedAt": null,
      "dependencies": ["a1b2c3d4-..."]
    }
  ]
}
```

---

### Cancel a Job

`DELETE /jobs/{jobId}`

Cancels all PENDING and QUEUED tasks in the job. RUNNING tasks are allowed to finish.

**Response** `200 OK`
```json
{
  "jobId": "3f7e8a10-...",
  "status": "CANCELLED",
  "cancelledTasks": 2,
  "message": "Job cancelled. 1 task(s) still running and will be allowed to complete."
}
```

---

## Tasks

### Get Task Details

`GET /tasks/{taskId}`

**Response** `200 OK`
```json
{
  "taskId": "a1b2c3d4-...",
  "jobId": "3f7e8a10-...",
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
  "completedAt": "2024-01-15T10:01:45Z"
}
```

---

### Get Task Logs

`GET /tasks/{taskId}/logs`

Returns execution logs for a specific task, across all retry attempts.

**Query Parameters**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `level` | string | (all) | Filter: `INFO`, `WARN`, `ERROR` |
| `limit` | int | 100 | Max log lines to return |

**Response** `200 OK`
```json
{
  "taskId": "a1b2c3d4-...",
  "logs": [
    {
      "level": "INFO",
      "message": "Task started on worker worker-abc123",
      "loggedAt": "2024-01-15T10:00:01Z",
      "workerId": "worker-abc123"
    },
    {
      "level": "ERROR",
      "message": "Attempt 1/3 failed: Connection refused",
      "loggedAt": "2024-01-15T10:00:06Z",
      "workerId": "worker-abc123"
    },
    {
      "level": "INFO",
      "message": "Retrying in 2s (attempt 2/3)",
      "loggedAt": "2024-01-15T10:00:08Z",
      "workerId": "worker-abc123"
    }
  ]
}
```

---

## Workers

### List Workers

`GET /workers`

Returns all registered workers and their current health status.

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
  "totalCapacity": 16,
  "totalActiveTasks": 11,
  "clusterUtilizationPct": 68.75
}
```

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
  "lastSeenAt": "2024-01-15T10:05:00Z",
  "startedAt": "2024-01-15T09:00:00Z",
  "currentTasks": [
    {
      "taskId": "a1b2c3d4-...",
      "jobName": "nightly-etl-pipeline",
      "taskName": "Transform Data",
      "startedAt": "2024-01-15T10:00:15Z"
    }
  ]
}
```

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

`GET /actuator/metrics/{metricName}`

Available DTOE-specific metrics:

| Metric | Description |
|---|---|
| `dtoe.tasks.queued` | Current count of tasks in QUEUED state |
| `dtoe.tasks.running` | Current count of running tasks |
| `dtoe.tasks.completed.total` | Total tasks completed (tagged by status) |
| `dtoe.task.duration` | Task execution duration histogram |
| `dtoe.worker.active_tasks` | Active tasks per worker |
| `dtoe.scheduler.cycle.duration` | Time per scheduler cycle |
