import { useState, useEffect } from 'react';
import { api } from '../api/api';
import type { Worker } from '../types';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';

export default function WorkersPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.workers.list()
      .then(setWorkers)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Workers</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-40 rounded-xl bg-card animate-pulse" />
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

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Workers</h2>

      <div className="grid grid-cols-3 gap-4">
        {['IDLE', 'BUSY', 'DEAD'].map(status => (
          <Card key={status} className="border-border bg-card/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${
                  status === 'IDLE' ? 'bg-emerald-500' :
                  status === 'BUSY' ? 'bg-blue-500 animate-pulse' : 'bg-red-500'
                }`} />
                <p className="text-sm text-muted-foreground">{status}</p>
              </div>
              <p className="text-3xl font-bold mt-2">{statusCounts[status] || 0}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {workers.map(worker => (
          <Card key={worker.id} className="border-border bg-gradient-to-br from-card to-card/80 hover:scale-[1.02] transition-all duration-200">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
                    worker.status === 'IDLE' ? 'bg-emerald-500/20' :
                    worker.status === 'BUSY' ? 'bg-blue-500/20' : 'bg-red-500/20'
                  }`}>
                    {worker.status === 'IDLE' ? '💤' : worker.status === 'BUSY' ? '⚡' : '💀'}
                  </div>
                  <div>
                    <p className="font-mono text-sm font-medium">{worker.id.slice(0, 12)}...</p>
                    <Badge status={worker.status} />
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Active Tasks</span>
                  <span className="font-medium">{worker.activeTasks}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Last Heartbeat</span>
                  <span className="font-medium text-xs">
                    {new Date(worker.lastHeartbeat).toLocaleTimeString()}
                  </span>
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        worker.status === 'IDLE' ? 'bg-emerald-500' :
                        worker.status === 'BUSY' ? 'bg-blue-500' : 'bg-red-500'
                      }`}
                      style={{ width: worker.status === 'BUSY' ? '100%' : worker.status === 'IDLE' ? '20%' : '0%' }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {worker.status === 'BUSY' ? 'Busy' : worker.status === 'IDLE' ? 'Available' : 'Offline'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {workers.length === 0 && (
        <div className="text-center py-12">
          <p className="text-4xl mb-4">🔌</p>
          <p className="text-muted-foreground">No workers connected</p>
          <p className="text-sm text-muted-foreground mt-1">Start a worker to see it here</p>
        </div>
      )}
    </div>
  );
}