# DAG Specification

A **Job** in DTOE is a directed acyclic graph (DAG) of **Tasks**. Each task represents a unit of work. Dependencies between tasks define the execution order. Tasks with no unresolved dependencies are eligible for scheduling.

---

## Job Schema

```json
{
  "name": "string (required)",
  "submittedBy": "string (optional)",
  "tasks": [ TaskDefinition ]
}
```

---

## Task Definition Schema

```json
{
  "id": "string (required, unique within job, used for dependency references)",
  "name": "string (required, human-readable label)",
  "type": "string (required, see Task Types below)",
  "payload": "object (type-specific configuration)",
  "timeoutSeconds": "integer (default: 60, max: 3600)",
  "maxRetries": "integer (default: 3, max: 10)",
  "dependencies": ["task_id", ...]
}
```

### Field Notes

- `id` is a **client-defined logical ID** used only within the job definition for expressing dependencies. The server assigns a separate UUID as the persistent task identifier.
- `dependencies` is an array of `id` values from other tasks in the same job. An empty array means the task is a root node (runs immediately). The alias `dependsOn` is accepted for the same field.
- Duplicate ids and self-dependencies are rejected.
- A job with no root tasks (every task has at least one dependency) is invalid and will be rejected.
- The console renders the graph while you edit the form — the same DAG view used on the job page, with a click-to-inspect panel for payload, timeout and retries.

---

## Task Types

### `HTTP_REQUEST`

Makes an outbound HTTP call. The task succeeds if the response status code is in the `expectedStatusCodes` list.

```json
{
  "type": "HTTP_REQUEST",
  "payload": {
    "url": "https://example.com/api/trigger",
    "method": "POST",
    "headers": {
      "Authorization": "Bearer {{env.API_TOKEN}}"
    },
    "body": {
      "source": "dtoe",
      "runId": "{{jobId}}"
    },
    "expectedStatusCodes": [200, 201, 202],
    "followRedirects": true
  }
}
```

| Field | Required | Default | Description |
|---|---|---|---|
| `url` | ✅ | — | Target URL |
| `method` | ✅ | — | HTTP method: GET, POST, PUT, DELETE, PATCH |
| `headers` | ❌ | {} | Request headers |
| `body` | ❌ | null | JSON request body |
| `expectedStatusCodes` | ❌ | [200] | Status codes considered success |
| `followRedirects` | ❌ | true | Follow HTTP redirects |

---

### `SHELL_COMMAND`

Executes a shell command. The task succeeds if the process exits with code 0.

```json
{
  "type": "SHELL_COMMAND",
  "payload": {
    "command": "/opt/scripts/transform.sh",
    "args": ["--input", "/data/raw", "--output", "/data/processed"],
    "workingDir": "/opt/scripts",
    "env": {
      "DB_URL": "{{env.POSTGRES_URL}}"
    }
  }
}
```

| Field | Required | Default | Description |
|---|---|---|---|
| `command` | ✅ | — | Executable path or command |
| `args` | ❌ | [] | Command-line arguments |
| `workingDir` | ❌ | `/tmp` | Working directory |
| `env` | ❌ | {} | Additional environment variables |

> ⚠️ Shell commands execute inside the worker's environment. Ensure worker nodes have appropriate sandboxing (Docker, chroot, etc.) for untrusted workloads.

---

### `NO_OP`

Does nothing. Succeeds immediately. Useful for DAG structure (fan-in join nodes) and testing.

```json
{
  "type": "NO_OP",
  "payload": {
    "delayMs": 100
  }
}
```

---

## Variable Interpolation

Task payloads support runtime variable substitution using `{{variable}}` syntax.

| Variable | Value |
|---|---|
| `{{jobId}}` | The UUID of the parent job |
| `{{taskId}}` | The UUID of this task |
| `{{retryCount}}` | Current retry attempt number (0-indexed) |
| `{{env.VAR_NAME}}` | Environment variable from the worker's environment |

---

## Examples

### Linear Pipeline (ETL)

Three tasks in sequence: extract → transform → load.

```json
{
  "name": "etl-pipeline",
  "tasks": [
    {
      "id": "extract",
      "name": "Extract",
      "type": "HTTP_REQUEST",
      "payload": { "url": "https://api.source.com/export", "method": "GET" },
      "dependencies": []
    },
    {
      "id": "transform",
      "name": "Transform",
      "type": "SHELL_COMMAND",
      "payload": { "command": "/scripts/transform.sh" },
      "dependencies": ["extract"]
    },
    {
      "id": "load",
      "name": "Load",
      "type": "HTTP_REQUEST",
      "payload": { "url": "https://warehouse.internal/ingest", "method": "POST" },
      "dependencies": ["transform"]
    }
  ]
}
```

### Fan-Out / Fan-In (Parallel + Join)

One task fans out to three parallel tasks, which then join into a final task.

```json
{
  "name": "parallel-processing",
  "tasks": [
    {
      "id": "split",
      "name": "Split Dataset",
      "type": "SHELL_COMMAND",
      "payload": { "command": "/scripts/split.sh" },
      "dependencies": []
    },
    {
      "id": "process-a",
      "name": "Process Shard A",
      "type": "SHELL_COMMAND",
      "payload": { "command": "/scripts/process.sh", "args": ["--shard", "A"] },
      "dependencies": ["split"]
    },
    {
      "id": "process-b",
      "name": "Process Shard B",
      "type": "SHELL_COMMAND",
      "payload": { "command": "/scripts/process.sh", "args": ["--shard", "B"] },
      "dependencies": ["split"]
    },
    {
      "id": "process-c",
      "name": "Process Shard C",
      "type": "SHELL_COMMAND",
      "payload": { "command": "/scripts/process.sh", "args": ["--shard", "C"] },
      "dependencies": ["split"]
    },
    {
      "id": "merge",
      "name": "Merge Results",
      "type": "SHELL_COMMAND",
      "payload": { "command": "/scripts/merge.sh" },
      "dependencies": ["process-a", "process-b", "process-c"]
    }
  ]
}
```

This produces the following execution graph:

```
         split
        /  |  \
       /   |   \
  proc-a proc-b proc-c
       \   |   /
        \  |  /
         merge
```

Tasks `process-a`, `process-b`, and `process-c` run in parallel once `split` succeeds.

### Diamond Dependency

A common pattern where two paths converge.

```json
{
  "name": "diamond-dag",
  "tasks": [
    { "id": "A", "name": "A", "type": "NO_OP", "dependencies": [] },
    { "id": "B", "name": "B", "type": "NO_OP", "dependencies": ["A"] },
    { "id": "C", "name": "C", "type": "NO_OP", "dependencies": ["A"] },
    { "id": "D", "name": "D", "type": "NO_OP", "dependencies": ["B", "C"] }
  ]
}
```

```
A → B → D
  ↘   ↗
    C
```

---

## Validation Rules

A job submission will be rejected with `422 Unprocessable Entity` if any of the following are true:

- The `tasks` array is empty
- Two tasks share the same `id`
- A task depends on itself
- A task references a dependency `id` that doesn't exist in the job
- The dependency graph contains a cycle
- A task `type` is not registered on the server
- All tasks have at least one dependency (no root tasks — nothing can start)
- `timeoutSeconds` exceeds 3600
- `maxRetries` exceeds 10
