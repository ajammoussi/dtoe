import {
  JOB_STATUSES,
  TASK_STATUSES,
  WORKER_STATUSES,
  type Job,
  type JobStatus,
  type Task,
  type TaskStatus,
  type Worker,
  type WorkerStatus,
  type CreateJobRequest,
} from '../types';

const API_BASE = '/api/v1';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!response.ok) {
    let message = `API error: ${response.status}`;
    try {
      const body: unknown = await response.json();
      const record = asRecord(body);
      const serverMessage = record.error ?? record.message;
      if (typeof serverMessage === 'string' && serverMessage) {
        message = serverMessage;
      }
    } catch {
      // non-JSON error body: keep the status message
    }
    throw new Error(message);
  }
  return response.json();
}

export interface PageResult<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

interface PageQuery {
  page?: number;
  size?: number;
  status?: string;
  q?: string;
}

interface RawPage {
  content?: unknown;
  totalElements?: unknown;
  totalPages?: unknown;
  number?: unknown;
  size?: unknown;
}

export interface WorkerListResult {
  workers: Worker[];
  activeCount: number;
  inactiveCount: number;
  totalCapacity: number;
  totalActiveTasks: number;
  clusterUtilizationPct: number;
}

type RawRecord = Record<string, unknown>;

function asRecord(value: unknown): RawRecord {
  return value !== null && typeof value === 'object' ? (value as RawRecord) : {};
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : undefined;
}

function jobStatus(value: unknown): JobStatus {
  const status = asString(value);
  return JOB_STATUSES.includes(status as JobStatus) ? (status as JobStatus) : 'RUNNING';
}

function taskStatus(value: unknown): TaskStatus {
  const status = asString(value);
  return TASK_STATUSES.includes(status as TaskStatus) ? (status as TaskStatus) : 'PENDING';
}

function workerStatus(value: unknown): WorkerStatus {
  const status = asString(value);
  return WORKER_STATUSES.includes(status as WorkerStatus) ? (status as WorkerStatus) : 'DEAD';
}

function pageParams({ page = 0, size = 20, status, q }: PageQuery): string {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (status) {
    params.set('status', status);
  }
  if (q) {
    params.set('q', q);
  }
  return params.toString();
}

function mapPage<T>(raw: RawPage, mapper: (item: unknown) => T): PageResult<T> {
  const content = Array.isArray(raw.content) ? raw.content : [];
  return {
    content: content.map(mapper),
    totalElements: asNumber(raw.totalElements),
    totalPages: asNumber(raw.totalPages),
    number: asNumber(raw.number),
    size: asNumber(raw.size),
  };
}

export const api = {
  jobs: {
    listPage: async (query: PageQuery = {}) => {
      const res = await fetchJson<RawPage>(`/jobs?${pageParams(query)}`);
      return mapPage(res, mapJob);
    },
    get: async (id: string) => fetchJson<unknown>(`/jobs/${id}`).then(mapJob),
    create: async (data: CreateJobRequest) =>
      fetchJson<unknown>('/jobs', { method: 'POST', body: JSON.stringify(data) }),
    cancel: async (id: string) =>
      fetchJson<unknown>(`/jobs/${id}`, { method: 'DELETE' }),
  },

  tasks: {
    list: async (query: PageQuery = {}) => {
      const res = await fetchJson<RawPage>(`/tasks?${pageParams(query)}`);
      return mapPage(res, mapTask);
    },
    get: async (id: string) => fetchJson<unknown>(`/tasks/${id}`).then(mapTask),
    getLogs: async (id: string): Promise<TaskLogEntry[]> => {
      try {
        const res = await fetchJson<unknown>(`/tasks/${id}/logs`);
        const logs = asRecord(res).logs;
        return Array.isArray(logs) ? logs.map(mapLog) : [];
      } catch {
        return [];
      }
    },
  },

  workers: {
    list: async (): Promise<WorkerListResult> => {
      const res = asRecord(await fetchJson<unknown>('/workers'));
      const workers = res.workers;
      return {
        workers: Array.isArray(workers) ? workers.map(mapWorker) : [],
        activeCount: asNumber(res.activeCount),
        inactiveCount: asNumber(res.inactiveCount),
        totalCapacity: asNumber(res.totalCapacity),
        totalActiveTasks: asNumber(res.totalActiveTasks),
        clusterUtilizationPct: asNumber(res.clusterUtilizationPct),
      };
    },
  },
};

function mapJob(raw: unknown): Job {
  const job = asRecord(raw);
  const tasks = job.tasks;
  return {
    id: asString(job.jobId) || asString(job.id),
    name: asString(job.name),
    status: jobStatus(job.status),
    createdAt: asString(job.createdAt),
    completedAt: optionalString(job.completedAt),
    submittedBy: optionalString(job.submittedBy),
    taskCount: optionalNumber(job.taskCount),
    completedTasks: optionalNumber(job.completedTasks),
    failedTasks: optionalNumber(job.failedTasks),
    tasks: Array.isArray(tasks) ? tasks.map(mapTask) : undefined,
  };
}

function mapTask(raw: unknown): Task {
  const task = asRecord(raw);
  return {
    id: asString(task.taskId) || asString(task.id),
    jobId: optionalString(task.jobId),
    jobName: optionalString(task.jobName),
    name: optionalString(task.name),
    type: asString(task.type),
    status: taskStatus(task.status),
    retryCount: asNumber(task.retryCount),
    maxRetries: asNumber(task.maxRetries),
    timeoutSeconds: asNumber(task.timeoutSeconds),
    createdAt: optionalString(task.createdAt),
    startedAt: optionalString(task.startedAt),
    completedAt: optionalString(task.completedAt),
    workerId: optionalString(task.workerId),
    errorMessage: optionalString(task.errorMessage),
    payload: task.payload !== null && typeof task.payload === 'object'
      ? (task.payload as Record<string, unknown>)
      : undefined,
    output: task.output !== null && typeof task.output === 'object'
      ? (task.output as Record<string, unknown>)
      : undefined,
    dependsOn: asStringArray(task.dependsOn) ?? asStringArray(task.dependencies) ?? [],
    dependencies: asStringArray(task.dependencies),
  };
}

export interface TaskLogEntry {
  level: string;
  message: string;
  loggedAt: string;
  workerId?: string;
}

function mapLog(raw: unknown): TaskLogEntry {
  const log = asRecord(raw);
  return {
    level: asString(log.level),
    message: asString(log.message),
    loggedAt: asString(log.loggedAt),
    workerId: optionalString(log.workerId),
  };
}

function mapWorker(raw: unknown): Worker {
  const worker = asRecord(raw);
  return {
    id: asString(worker.workerId) || asString(worker.id),
    workerId: optionalString(worker.workerId),
    hostname: optionalString(worker.hostname),
    status: workerStatus(worker.status),
    lastHeartbeat: asString(worker.lastSeenAt) || asString(worker.lastHeartbeat),
    lastSeenAt: optionalString(worker.lastSeenAt),
    startedAt: optionalString(worker.startedAt),
    activeTasks: asNumber(worker.activeTasks),
    capacity: optionalNumber(worker.capacity),
    utilizationPct: optionalNumber(worker.utilizationPct),
  };
}
