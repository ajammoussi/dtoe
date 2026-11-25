export const JOB_STATUSES = ['RUNNING', 'SUCCESS', 'FAILED', 'PARTIALLY_FAILED', 'CANCELLED'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const TASK_STATUSES = [
  'PENDING',
  'QUEUED',
  'RUNNING',
  'SUCCESS',
  'FAILED',
  'TIMED_OUT',
  'RETRYING',
  'CANCELLED',
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const WORKER_STATUSES = ['HEALTHY', 'BUSY', 'STALE', 'DEAD'] as const;
export type WorkerStatus = (typeof WORKER_STATUSES)[number];

export interface Job {
  id: string;
  name: string;
  status: JobStatus;
  createdAt: string;
  completedAt?: string;
  submittedBy?: string;
  taskCount?: number;
  completedTasks?: number;
  failedTasks?: number;
  tasks?: Task[];
}

export interface Task {
  id: string;
  jobId?: string;
  jobName?: string;
  name?: string;
  type: string;
  status: TaskStatus;
  retryCount: number;
  maxRetries: number;
  timeoutSeconds: number;
  createdAt?: string;
  startedAt?: string;
  completedAt?: string;
  workerId?: string;
  errorMessage?: string;
  payload?: Record<string, unknown>;
  output?: Record<string, unknown>;
  dependsOn?: string[];
  dependencies?: string[];
}

export interface Worker {
  id: string;
  workerId?: string;
  hostname?: string;
  status: WorkerStatus;
  lastHeartbeat: string;
  lastSeenAt?: string;
  startedAt?: string;
  activeTasks: number;
  capacity?: number;
  utilizationPct?: number;
}

export interface CreateJobRequest {
  name: string;
  submittedBy?: string;
  tasks: CreateTaskRequest[];
}

export interface CreateTaskRequest {
  id: string;
  name: string;
  type: string;
  payload: Record<string, unknown>;
  timeoutSeconds?: number;
  maxRetries?: number;
  dependsOn?: string[];
}
