import { useState, useEffect } from 'react';
import { api } from '../api/api';
import type { Worker } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';

export default function WorkersPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshWorkers = () => {
    api.workers.list()
      .then(setWorkers)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refreshWorkers();
    const interval = setInterval(refreshWorkers, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Workers</h2>
        <div className="grid gap-4">
          {[1, 2].map(i => (
            <div key={i} className="h-32 rounded-xl bg-card animate-pulse" />
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

  const statusCounts = workers.reduce((acc, worker) => {
    acc[worker.status] = (acc[worker.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalActive = workers.reduce((sum, w) => sum + (w.activeTasks || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Workers</h2>
        <p className="text-sm text-muted-foreground">
          {workers.length} worker(s) • {totalActive} active task(s)
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { key: 'HEALTHY', label: 'HEALTHY', desc: 'Ready to accept tasks', color: 'bg-emerald-500' },
          { key: 'BUSY', label: 'BUSY', desc: 'Currently executing tasks', color: 'bg-blue-500' },
          { key: 'STALE', label: 'STALE', desc: 'Heartbeat delayed', color: 'bg-amber-500' },
          { key: 'DEAD', label: 'DEAD', desc: 'No recent heartbeat (>60s)', color: 'bg-red-500' },
        ].map(item => (
          <Card key={item.key} className="border-border bg-card/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{item.label}</p>
                <div className={`w-2 h-2 rounded-full ${item.color}`} />
              </div>
              <p className="text-3xl font-bold mt-2">
                {statusCounts[item.key] || 0}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {item.desc}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border bg-card/50">
        <CardHeader>
          <CardTitle className="text-lg">Worker Status Guide</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-3 h-3 rounded-full bg-emerald-500 mt-1" />
            <div>
              <p className="font-medium">HEALTHY</p>
              <p className="text-sm text-muted-foreground">Worker is healthy and ready to process new tasks. Last heartbeat received within the last 60 seconds.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-3 h-3 rounded-full bg-blue-500 mt-1" />
            <div>
              <p className="font-medium">BUSY</p>
              <p className="text-sm text-muted-foreground">Worker is actively executing one or more tasks. It returns to HEALTHY status when tasks complete.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-3 h-3 rounded-full bg-red-500 mt-1" />
            <div>
              <p className="font-medium">DEAD</p>
              <p className="text-sm text-muted-foreground">Worker has not sent a heartbeat in over 60 seconds. It may have crashed or been stopped. Tasks assigned to this worker will be retried by other workers.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card/50">
        <CardHeader>
          <CardTitle className="text-lg">All Workers</CardTitle>
        </CardHeader>
        <CardContent>
          {workers.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No workers registered</p>
          ) : (
            <div className="space-y-3">
              {workers.map(worker => (
                <div key={worker.id} className="p-4 rounded-lg bg-background/50 border border-border hover:border-primary/50 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${
                        worker.status === 'HEALTHY' ? 'bg-emerald-500' :
                        worker.status === 'BUSY' ? 'bg-blue-500' :
                        worker.status === 'STALE' ? 'bg-amber-500' : 'bg-red-500'
                      } ${worker.status === 'BUSY' ? 'animate-pulse' : ''}`} />
                      <div>
                        <p className="font-medium font-mono text-sm">{worker.id}</p>
                        <p className="text-xs text-muted-foreground">
                          Hostname: {worker.hostname || 'N/A'} • Last seen: {worker.lastHeartbeat ? new Date(worker.lastHeartbeat).toLocaleString() : 'Never'}
                        </p>
                      </div>
                    </div>
                    <Badge status={worker.status} />
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Active Tasks</p>
                      <p className="font-medium">{worker.activeTasks || 0}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Capacity</p>
                      <p className="font-medium">{worker.capacity || 'N/A'}</p>
                    </div>
                  </div>

                  {worker.status === 'BUSY' && (
                    <div className="mt-3 p-2 rounded bg-blue-500/10 border border-blue-500/20">
                      <p className="text-xs text-blue-400">
                        This worker is currently processing {worker.activeTasks || 0} task(s). Tasks will be picked up from the Kafka queue and executed based on their dependencies.
                      </p>
                    </div>
                  )}

                  {worker.status === 'DEAD' && (
                    <div className="mt-3 p-2 rounded bg-red-500/10 border border-red-500/20">
                      <p className="text-xs text-red-400">
                        This worker has not sent a heartbeat recently. Any tasks assigned to it will be retried by other available workers.
                      </p>
                    </div>
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