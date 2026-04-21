export interface Job {
  id: string;
  name: string;
  status: 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PARTIALLY_FAILED' | 'CANCELLED';
  createdAt: string;
  completedAt?: string;
  submittedBy?: string;
  taskCount?: number;
  completedTasks?: number;
  tasks?: Task[];
}

export interface Task {
  id: string;
  jobId?: string;
  name?: string;
  type: string;
  status: 'PENDING' | 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'TIMED_OUT' | 'RETRYING' | 'CANCELLED';
  retryCount: number;
  maxRetries: number;
  timeoutSeconds: number;
  createdAt?: string;
  startedAt?: string;
  completedAt?: string;
  workerId?: string;
  errorMessage?: string;
  output?: Record<string, unknown>;
  dependsOn?: string[];
  dependencies?: string[];
}

export interface Worker {
  id: string;
  workerId?: string;
  hostname?: string;
  status: 'HEALTHY' | 'BUSY' | 'STALE' | 'DEAD';
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
