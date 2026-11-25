import { useCallback, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api/api';
import type { Job } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { ProgressBar } from '../components/ui/progress-bar';
import { EmptyState } from '../components/ui/empty-state';
import { TaskGraph } from '../components/graph/TaskGraph';
import { TaskDetailsPanel } from '../components/graph/TaskDetailsPanel';
import { usePolling } from '../lib/usePolling';
import { orderTasks } from '../lib/dag';
import { absolute, formatDuration, formatRelative, shortId } from '../lib/format';

export default function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'table' ? 'table' : 'graph';

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!jobId) return;
    api.jobs.get(jobId)
      .then(data => {
        setJob({ ...data, tasks: data.tasks ?? [] });
        setError(null);
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load job'))
      .finally(() => setLoading(false));
  }, [jobId]);

  usePolling(load, 5000, !job || job.status === 'RUNNING');

  const handleCancel = async () => {
    if (!jobId) return;
    if (!window.confirm('Are you sure you want to cancel this job? This will cancel all queued and pending tasks.')) {
      return;
    }
    setCancelling(true);
    try {
      await api.jobs.cancel(jobId);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel job');
    } finally {
      setCancelling(false);
    }
  };

  const setView = (next: 'graph' | 'table') => {
    setParams(prev => {
      const updated = new URLSearchParams(prev);
      if (next === 'graph') {
        updated.delete('view');
      } else {
        updated.set('view', next);
      }
      return updated;
    }, { replace: true });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link to="/jobs" className="hover:text-foreground">Jobs</Link>
          <span>/</span>
        </div>
        <div className="h-64 rounded-xl bg-card animate-pulse" />
      </div>
    );
  }

  if (error && !job) {
    return (
      <div className="space-y-6">
        <Link to="/jobs" className="text-sm text-muted-foreground hover:text-foreground">← Back to Jobs</Link>
        <div className="p-6 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive">
          {error || 'Job not found'}
        </div>
      </div>
    );
  }

  if (!job) return null;

  const tasks = orderTasks(job.tasks ?? []);
  const taskById = new Map((job.tasks ?? []).map(task => [task.id, task]));
  const selectedTask = selectedTaskId ? taskById.get(selectedTaskId) : undefined;
  const succeeded = tasks.filter(task => task.status === 'SUCCESS').length;
  const failed = tasks.filter(task => task.status === 'FAILED' || task.status === 'TIMED_OUT').length;
  const running = tasks.filter(task => task.status === 'RUNNING').length;
  const skipped = tasks.filter(task => task.status === 'CANCELLED').length;
  const isCancellable = job.status === 'RUNNING';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/jobs" className="hover:text-foreground">Jobs</Link>
        <span>/</span>
        <span className="text-foreground">{job.name}</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold">{job.name}</h2>
          <Badge status={job.status} />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load}>
            Refresh
          </Button>
          {isCancellable && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={cancelling}
              className="text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
            >
              {cancelling ? 'Cancelling...' : 'Cancel Job'}
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive">
          {error}
        </div>
      )}

      <Card className="border-border bg-card/50">
        <CardHeader>
          <CardTitle className="text-lg">Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <ProgressBar completed={succeeded} failed={failed} total={tasks.length} />
            <p className="text-xs text-muted-foreground">
              {succeeded + failed} of {tasks.length} task(s) finished
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Succeeded</p>
              <p className="text-2xl font-bold text-emerald-400">{succeeded}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Failed</p>
              <p className="text-2xl font-bold text-red-400">{failed}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Running</p>
              <p className="text-2xl font-bold text-blue-400">{running}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Skipped</p>
              <p className="text-2xl font-bold text-slate-400">{skipped}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-border">
            <div>
              <p className="text-sm text-muted-foreground">Submitted by</p>
              <p className="text-sm">{job.submittedBy || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Created</p>
              <p className="text-sm" title={absolute(job.createdAt)}>{formatRelative(job.createdAt)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Finished</p>
              <p className="text-sm" title={absolute(job.completedAt)}>
                {job.completedAt ? formatRelative(job.completedAt) : '—'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Duration</p>
              <p className="text-sm">{formatDuration(job.createdAt, job.completedAt)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card/50">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-lg">Pipeline</CardTitle>
            <div className="flex gap-1 rounded-lg border border-border p-0.5" role="tablist" aria-label="Pipeline view">
              {(['graph', 'table'] as const).map(option => (
                <button
                  key={option}
                  type="button"
                  role="tab"
                  aria-selected={view === option}
                  onClick={() => setView(option)}
                  className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors ${
                    view === option
                      ? 'bg-primary/20 text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <EmptyState title="No tasks in this job" />
          ) : view === 'graph' ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <TaskGraph
                tasks={tasks}
                selectedId={selectedTaskId}
                currentId={selectedTaskId ?? undefined}
                onSelect={setSelectedTaskId}
                height={460}
              />
              {selectedTask ? (
                <TaskDetailsPanel
                  task={selectedTask}
                  onClose={() => setSelectedTaskId(null)}
                />
              ) : (
                <aside className="flex h-full min-h-40 items-center justify-center rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                  Select a task in the graph to inspect its command, payload, timings and error.
                </aside>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm text-muted-foreground">#</th>
                    <th className="text-left py-3 px-4 text-sm text-muted-foreground">Task</th>
                    <th className="text-left py-3 px-4 text-sm text-muted-foreground">Type</th>
                    <th className="text-left py-3 px-4 text-sm text-muted-foreground">Status</th>
                    <th className="text-left py-3 px-4 text-sm text-muted-foreground">Depends on</th>
                    <th className="text-left py-3 px-4 text-sm text-muted-foreground">Retries</th>
                    <th className="text-left py-3 px-4 text-sm text-muted-foreground">Worker</th>
                    <th className="text-left py-3 px-4 text-sm text-muted-foreground">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task, index) => {
                    const dependencies = task.dependsOn ?? task.dependencies ?? [];
                    return (
                      <tr key={task.id} className="border-b border-border/50 align-top hover:bg-accent/5">
                        <td className="py-3 px-4 text-sm text-muted-foreground">{index + 1}</td>
                        <td className="py-3 px-4">
                          <Link
                            to={`/tasks/${task.id}`}
                            className="font-medium hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                          >
                            {task.name || task.type}
                          </Link>
                          <p className="text-xs text-muted-foreground font-mono">{shortId(task.id)}</p>
                          {task.errorMessage && (
                            <p className="mt-1 max-w-md text-xs text-red-400 line-clamp-2" title={task.errorMessage}>
                              {task.errorMessage}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-1 rounded-md bg-violet-500/20 text-violet-400 text-xs font-medium">
                            {task.type}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <Badge status={task.status} />
                        </td>
                        <td className="py-3 px-4">
                          {dependencies.length === 0 ? (
                            <span className="text-sm text-muted-foreground">—</span>
                          ) : (
                            <div className="flex flex-col gap-1">
                              {dependencies.map(depId => {
                                const dependency = taskById.get(depId);
                                return (
                                  <Link
                                    key={depId}
                                    to={`/tasks/${depId}`}
                                    className="text-xs text-muted-foreground hover:text-primary font-mono"
                                  >
                                    {dependency?.name || dependency?.type || shortId(depId)}
                                  </Link>
                                );
                              })}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm">{task.retryCount}/{task.maxRetries}</td>
                        <td className="py-3 px-4 font-mono text-xs text-muted-foreground">
                          {shortId(task.workerId)}
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {formatDuration(task.startedAt, task.completedAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
