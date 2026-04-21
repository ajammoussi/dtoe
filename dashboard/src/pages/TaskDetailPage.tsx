import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/api';
import type { Task } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';

interface TaskDetail extends Task {
  jobName?: string;
  errorMessage?: string;
  output?: Record<string, unknown>;
}

interface TaskLog {
  level: string;
  message: string;
  loggedAt: string;
  workerId?: string;
}

export default function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [logs, setLogs] = useState<TaskLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!taskId) return;

    Promise.all([
      api.tasks.get(taskId),
      api.tasks.getLogs(taskId),
    ])
      .then(([taskData, logsData]) => {
        setTask(taskData);
        setLogs(logsData);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [taskId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate(-1)}>
            ← Back
          </Button>
          <h2 className="text-2xl font-bold">Task Details</h2>
        </div>
        <div className="h-64 rounded-xl bg-card animate-pulse" />
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate(-1)}>
            ← Back
          </Button>
          <h2 className="text-2xl font-bold">Task Details</h2>
        </div>
        <div className="p-6 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive">
          {error || 'Task not found'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => navigate(-1)}>
          ← Back
        </Button>
        <h2 className="text-2xl font-bold">Task Details</h2>
      </div>

      <Card className="border-border bg-card/50">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-3">
            <span className="font-mono text-sm text-muted-foreground">{task.id}</span>
            <Badge status={task.status} />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Type</p>
              <p className="font-medium">{task.type}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Job ID</p>
              <p className="font-mono text-sm">{task.jobId || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Worker</p>
              <p className="font-mono text-sm">{task.workerId || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Retries</p>
              <p className="font-medium">{task.retryCount}/{task.maxRetries}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-border">
            <div>
              <p className="text-sm text-muted-foreground">Created</p>
              <p className="text-sm">{task.createdAt ? new Date(task.createdAt).toLocaleString() : 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Started</p>
              <p className="text-sm">{task.startedAt ? new Date(task.startedAt).toLocaleString() : 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Completed</p>
              <p className="text-sm">{task.completedAt ? new Date(task.completedAt).toLocaleString() : 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Duration</p>
              <p className="text-sm">
                {task.startedAt && task.completedAt
                  ? `${Math.round((new Date(task.completedAt).getTime() - new Date(task.startedAt).getTime()) / 1000)}s`
                  : 'N/A'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
            <div>
              <p className="text-sm text-muted-foreground">Timeout</p>
              <p className="font-medium">{task.timeoutSeconds}s</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Max Retries</p>
              <p className="font-medium">{task.maxRetries}</p>
            </div>
          </div>
        </CardContent>
      </Card>

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
            <CardTitle className="text-lg">Output</CardTitle>
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
                    <span className="text-xs text-muted-foreground">
                      {new Date(log.loggedAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm">{log.message}</p>
                  {log.workerId && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Worker: {log.workerId}
                    </p>
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