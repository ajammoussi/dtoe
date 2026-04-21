import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/api';
import type { Job, Task } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';

interface JobDetail extends Job {
  tasks: Task[];
  submittedBy?: string;
}

export default function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!jobId) return;

    api.jobs.get(jobId)
      .then(data => {
        setJob({
          ...data,
          tasks: data.tasks || [],
        });
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [jobId]);

  const handleCancel = async () => {
    if (!jobId) return;
    if (!window.confirm('Are you sure you want to cancel this job? This will cancel all queued and pending tasks.')) {
      return;
    }
    setCancelling(true);
    try {
      await api.jobs.cancel(jobId);
      if (job) {
        setJob({ ...job, status: 'CANCELLED' });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel job');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate('/jobs')}>
            ← Back to Jobs
          </Button>
          <h2 className="text-2xl font-bold">Job Details</h2>
        </div>
        <div className="h-64 rounded-xl bg-card animate-pulse" />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate('/jobs')}>
            ← Back to Jobs
          </Button>
          <h2 className="text-2xl font-bold">Job Details</h2>
        </div>
        <div className="p-6 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive">
          {error || 'Job not found'}
        </div>
      </div>
    );
  }

  const statusCounts = job.tasks.reduce((acc, task) => {
    acc[task.status] = (acc[task.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const isCancellable = job.status === 'RUNNING';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate('/jobs')}>
            ← Back to Jobs
          </Button>
          <h2 className="text-2xl font-bold">Job Details</h2>
        </div>
        {isCancellable && (
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={cancelling}
            className="text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
          >
            {cancelling ? 'Cancelling...' : 'Cancel Job'}
          </Button>
        )}
      </div>

      <Card className="border-border bg-card/50">
        <CardHeader>
          <CardTitle className="text-xl">{job.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge status={job.status} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Job ID</p>
              <p className="font-mono text-sm">{job.id}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Submitted By</p>
              <p className="text-sm">{job.submittedBy || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Created</p>
              <p className="text-sm">{new Date(job.createdAt).toLocaleString()}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-border">
            <div>
              <p className="text-sm text-muted-foreground">Total Tasks</p>
              <p className="text-2xl font-bold">{job.tasks.length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Completed</p>
              <p className="text-2xl font-bold text-emerald-400">{statusCounts.SUCCESS || 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Failed</p>
              <p className="text-2xl font-bold text-red-400">{statusCounts.FAILED || 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Running</p>
              <p className="text-2xl font-bold text-blue-400">{statusCounts.RUNNING || 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card/50">
        <CardHeader>
          <CardTitle className="text-lg">Task DAG</CardTitle>
        </CardHeader>
        <CardContent>
          <DAGVisualization tasks={job.tasks} />
        </CardContent>
      </Card>

      <Card className="border-border bg-card/50">
        <CardHeader>
          <CardTitle className="text-lg">Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">ID</th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">Type</th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">Status</th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">Retries</th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">Worker</th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">Started</th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">Completed</th>
                </tr>
              </thead>
              <tbody>
                {job.tasks.map(task => (
                  <tr 
                    key={task.id} 
                    className="border-b border-border/50 hover:bg-accent/5 cursor-pointer"
                    onClick={() => navigate(`/tasks/${task.id}`)}
                  >
                    <td className="py-3 px-4 font-mono text-xs hover:text-primary">{task.id.slice(0, 8)}...</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-1 rounded-md bg-violet-500/20 text-violet-400 text-xs font-medium">
                        {task.type}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <Badge status={task.status} />
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {task.retryCount}/{task.maxRetries}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-muted-foreground">
                      {task.workerId || '-'}
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {task.startedAt ? new Date(task.startedAt).toLocaleString() : '-'}
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {task.completedAt ? new Date(task.completedAt).toLocaleString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface DAGVisualizationProps {
  tasks: Task[];
}

function DAGVisualization({ tasks }: DAGVisualizationProps) {
  if (tasks.length === 0) {
    return <p className="text-muted-foreground text-center py-8">No tasks in this job</p>;
  }

  const taskMap = new Map(tasks.map(t => [t.id, t]));

  return (
    <div className="space-y-4">
      {tasks.map(task => (
        <div key={task.id} className="relative">
          <div className="flex items-center gap-4 p-4 rounded-lg bg-background/50 border border-border hover:border-primary/50 transition-colors">
            <div className={`w-3 h-3 rounded-full ${
              task.status === 'SUCCESS' ? 'bg-emerald-500' :
              task.status === 'FAILED' ? 'bg-red-500' :
              task.status === 'RUNNING' ? 'bg-blue-500 animate-pulse' :
              task.status === 'QUEUED' ? 'bg-violet-500' :
              'bg-amber-500'
            }`} />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">{task.id}</span>
                <span className="px-2 py-0.5 rounded-md bg-violet-500/20 text-violet-400 text-xs font-medium">
                  {task.type}
                </span>
                <Badge status={task.status} />
              </div>
              {task.workerId && (
                <p className="text-xs text-muted-foreground mt-1">
                  Worker: {task.workerId.slice(0, 12)}...
                </p>
              )}
            </div>
            <div className="text-right text-sm text-muted-foreground">
              {task.startedAt && (
                <p>Started: {new Date(task.startedAt).toLocaleTimeString()}</p>
              )}
              {task.completedAt && task.startedAt && (
                <p>Duration: {Math.round((new Date(task.completedAt).getTime() - new Date(task.startedAt).getTime()) / 1000)}s</p>
              )}
            </div>
          </div>

          {task.dependsOn && task.dependsOn.length > 0 && (
            <div className="ml-6 mt-2 space-y-2">
              <p className="text-xs text-muted-foreground">Depends on:</p>
              {task.dependsOn.map(depId => {
                const depTask = taskMap.get(depId);
                return (
                  <div key={depId} className="flex items-center gap-2 text-sm">
                    <div className="w-0.5 h-4 bg-border" />
                    <span className="font-mono text-xs">{depId}</span>
                    {depTask && <Badge status={depTask.status} />}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}