import type { Job, Task, Worker, CreateJobRequest } from '../types';

const API_BASE = '/api';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json();
}

export const api = {
  jobs: {
    list: () => fetchJson<Job[]>('/jobs'),
    get: (id: string) => fetchJson<Job>(`/jobs/${id}`),
    create: (data: CreateJobRequest) =>
      fetchJson<Job>('/jobs', { method: 'POST', body: JSON.stringify(data) }),
    getTasks: (jobId: string) => fetchJson<Task[]>(`/jobs/${jobId}/tasks`),
  },

  tasks: {
    get: (id: string) => fetchJson<Task>(`/tasks/${id}`),
    getLogs: (taskId: string) =>
      fetchJson<Array<{ timestamp: string; level: string; message: string }>>(`/tasks/${taskId}/logs`),
  },

  workers: {
    list: () => fetchJson<Worker[]>('/workers'),
  },

  metrics: {
    prometheus: () => `${API_BASE}/actuator/prometheus`,
  },
};