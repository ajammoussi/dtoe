export interface Job {
  id: string;
  name: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED';
  createdAt: string;
  completedAt?: string;
}

export interface Task {
  id: string;
  jobId: string;
  type: string;
  status: 'PENDING' | 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'TIMED_OUT' | 'RETRYING';
  retryCount: number;
  maxRetries: number;
  timeoutSeconds: number;
  startedAt?: string;
  completedAt?: string;
  workerId?: string;
}

export interface Worker {
  id: string;
  status: 'IDLE' | 'BUSY' | 'DEAD';
  lastHeartbeat: string;
  activeTasks: number;
}

export interface CreateJobRequest {
  name: string;
  tasks: CreateTaskRequest[];
}

export interface CreateTaskRequest {
  type: string;
  payload: Record<string, unknown>;
  timeoutSeconds?: number;
  maxRetries?: number;
  dependsOn?: string[];
}