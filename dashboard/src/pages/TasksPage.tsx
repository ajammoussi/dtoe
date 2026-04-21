import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/api';
import type { Task } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';

export default function TasksPage() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [totalTasks, setTotalTasks] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.tasks.list({ size: 100 })
      .then(res => {
        setTasks(res.content);
        setTotalTasks(res.totalElements);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Tasks</h2>
        <div className="grid gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 rounded-xl bg-card animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive">
        Error: {error}
      </div>
    );
  }

  const statusCounts = tasks.reduce((acc, task) => {
    acc[task.status] = (acc[task.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const taskTypes = [...new Set(tasks.map(t => t.type))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Tasks</h2>
        <p className="text-sm text-muted-foreground">{totalTasks} task(s) total</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {['PENDING', 'QUEUED', 'RUNNING', 'SUCCESS', 'FAILED', 'TIMED_OUT', 'RETRYING'].map(status => (
          <Card key={status} className="border-border bg-card/50">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground truncate">{status}</p>
              <p className="text-2xl font-bold mt-1">{statusCounts[status] || 0}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {taskTypes.slice(0, 3).map(type => (
          <Card key={type} className="border-border bg-gradient-to-br from-violet-500/10 to-blue-500/10">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Task Type</p>
              <p className="text-lg font-bold mt-1">{type}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border bg-card/50">
        <CardHeader>
          <CardTitle>All Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No tasks found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm text-muted-foreground">ID</th>
                    <th className="text-left py-3 px-4 text-sm text-muted-foreground">Job</th>
                    <th className="text-left py-3 px-4 text-sm text-muted-foreground">Type</th>
                    <th className="text-left py-3 px-4 text-sm text-muted-foreground">Status</th>
                    <th className="text-left py-3 px-4 text-sm text-muted-foreground">Retries</th>
                    <th className="text-left py-3 px-4 text-sm text-muted-foreground">Worker</th>
                  </tr>
                </thead>
                <tbody>
                   {tasks.map(task => (
                     <tr key={task.id} className="border-b border-border/50 hover:bg-accent/5 cursor-pointer" onClick={() => navigate(`/tasks/${task.id}`)}>
                       <td className="py-3 px-4 font-mono text-xs hover:text-primary">{task.id.slice(0, 8)}...</td>
                       <td className="py-3 px-4 font-mono text-xs">{task.jobId ? `${task.jobId.slice(0, 8)}...` : '-'}</td>
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
                     </tr>
                   ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}