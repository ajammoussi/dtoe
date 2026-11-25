import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, type TaskLogEntry } from '../api/api';
import type { Task } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { TaskGraph } from '../components/graph/TaskGraph';
import { usePolling } from '../lib/usePolling';
import { absolute, formatDuration, formatRelative, shortId } from '../lib/format';

const ACTIVE_STATUSES: readonly Task['status'][] = ['PENDING', 'QUEUED', 'RUNNING', 'RETRYING'];

export default function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<Task | null>(null);
  const [jobTasks, setJobTasks] = useState<Task[]>([]);
  const [logs, setLogs] = useState<TaskLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<number | undefined>(undefined);

  const load = useCallback(() => {
    if (!taskId) return;
    Promise.all([api.tasks.get(taskId), api.tasks.getLogs(taskId)])
      .then(async ([taskData, logsData]) => {
        setTask(taskData);
        setLogs(logsData);
        setError(null);
        if (taskData.jobId) {
          const job = await api.jobs.get(taskData.jobId);
          setJobTasks(job.tasks ?? []);
        }
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load task'))
      .finally(() => setLoading(false));
  }, [taskId]);

  const isActive = !task || ACTIVE_STATUSES.includes(task.status);
  usePolling(load, 5000, isActive);

  useEffect(() => () => window.clearTimeout(copyTimer.current), []);

  const handleCopy = () => {
    if (!task?.output) return;
    navigator.clipboard
      .writeText(JSON.stringify(task.output, null, 2))
      .then(() => {
        setCopied(true);
        copyTimer.current = window.setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => setError('Clipboard unavailable'));
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

  if (error && !task) {
    return (
      <div className="space-y-6">
        <Link to="/jobs" className="text-sm text-muted-foreground hover:text-foreground">← Back to Jobs</Link>
        <div className="p-6 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive">
          {error || 'Task not found'}
        </div>
      </div>
    );
  }

  if (!task) return null;

  const jobLabel = task.jobName || shortId(task.jobId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Link to="/jobs" className="hover:text-foreground">Jobs</Link>
        <span>/</span>
        {task.jobId ? (
          <Link to={`/jobs/${task.jobId}`} className="hover:text-foreground">
            {jobLabel}
          </Link>
        ) : (
          <span>—</span>
        )}
        <span>/</span>
        <span className="font-mono text-foreground">{shortId(task.id)}</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold">{task.name || task.type}</h2>
          <Badge status={task.status} />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load}>
            Refresh
          </Button>
          {task.jobId && (
            <Link to={`/jobs/${task.jobId}`}>
              <Button variant="outline" size="sm">Open job</Button>
            </Link>
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
          <CardTitle className="text-lg">Task</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Type</p>
              <p className="font-medium">{task.type}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Worker</p>
              <p className="font-mono text-sm">{task.workerId || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Retries</p>
              <p className="font-medium">{task.retryCount}/{task.maxRetries}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Timeout</p>
              <p className="font-medium">{task.timeoutSeconds}s</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-border">
            <div>
              <p className="text-sm text-muted-foreground">Created</p>
              <p className="text-sm" title={absolute(task.createdAt)}>{formatRelative(task.createdAt)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Started</p>
              <p className="text-sm" title={absolute(task.startedAt)}>{formatRelative(task.startedAt)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Completed</p>
              <p className="text-sm" title={absolute(task.completedAt)}>{formatRelative(task.completedAt)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Duration</p>
              <p className="text-sm">{formatDuration(task.startedAt, task.completedAt)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {task.payload && Object.keys(task.payload).length > 0 && (
        <Card className="border-border bg-card/50">
          <CardHeader>
            <CardTitle className="text-lg">Input</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {typeof task.payload.command === 'string' && task.payload.command && (
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Command</p>
                <pre className="whitespace-pre-wrap rounded-lg border border-border bg-background/50 p-4 font-mono text-xs">
                  {task.payload.command}
                </pre>
              </div>
            )}
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Payload</p>
              <pre className="whitespace-pre-wrap overflow-x-auto rounded-lg border border-border bg-background/50 p-4 font-mono text-xs">
                {JSON.stringify(task.payload, null, 2)}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}

      {jobTasks.length > 0 && (
        <Card className="border-border bg-card/50">
          <CardHeader>
            <CardTitle className="text-lg">Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <TaskGraph
              tasks={jobTasks}
              currentId={task.id}
              selectedId={task.id}
              onSelect={id => {
                if (id && id !== task.id) {
                  navigate(`/tasks/${id}`);
                }
              }}
              height={340}
              showMinimap={false}
            />
          </CardContent>
        </Card>
      )}

      {task.errorMessage && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-lg text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-sm text-destructive">{task.errorMessage}</pre>
          </CardContent>
        </Card>
      )}

      {task.output && Object.keys(task.output).length > 0 && (
        <Card className="border-border bg-card/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Output</CardTitle>
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-sm bg-background/50 p-4 rounded-lg overflow-x-auto">
              {JSON.stringify(task.output, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      <Card className="border-border bg-card/50">
        <CardHeader>
          <CardTitle className="text-lg">Execution Logs</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No logs available for this task</p>
          ) : (
            <div className="space-y-2">
              {logs.map((log, index) => (
                <div key={index} className="p-3 rounded-lg bg-background/50 border border-border">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      log.level === 'ERROR' ? 'bg-red-500/20 text-red-400' :
                      log.level === 'WARN' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>
                      {log.level}
                    </span>
                    <span className="text-xs text-muted-foreground" title={absolute(log.loggedAt)}>
                      {formatRelative(log.loggedAt)}
                    </span>
                  </div>
                  <p className="text-sm">{log.message}</p>
                  {log.workerId && (
                    <p className="text-xs text-muted-foreground mt-1">Worker: {log.workerId}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
