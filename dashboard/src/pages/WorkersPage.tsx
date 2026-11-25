import { useCallback, useState } from 'react';
import { api } from '../api/api';
import type { Worker } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { ProgressBar } from '../components/ui/progress-bar';
import { EmptyState } from '../components/ui/empty-state';
import { usePolling } from '../lib/usePolling';
import { absolute, formatDuration, formatRelative } from '../lib/format';

export default function WorkersPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [inactiveCount, setInactiveCount] = useState(0);
  const [totalCapacity, setTotalCapacity] = useState(0);
  const [totalActiveTasks, setTotalActiveTasks] = useState(0);
  const [clusterUtilizationPct, setClusterUtilizationPct] = useState(0);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api.workers.list()
      .then(data => {
        setWorkers(data.workers);
        setActiveCount(data.activeCount);
        setInactiveCount(data.inactiveCount);
        setTotalCapacity(data.totalCapacity);
        setTotalActiveTasks(data.totalActiveTasks);
        setClusterUtilizationPct(data.clusterUtilizationPct);
        setError(null);
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load workers'))
      .finally(() => setLoading(false));
  }, []);

  usePolling(load, 5000);

  if (loading && workers.length === 0) {
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

  const visible = includeInactive
    ? workers
    : workers.filter(worker => worker.status === 'HEALTHY' || worker.status === 'BUSY');

  const busyCount = workers.filter(worker => worker.status === 'BUSY').length;
  const idleCount = workers.filter(worker => worker.status === 'HEALTHY').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold">Workers</h2>
        <p className="text-sm text-muted-foreground">
          {activeCount} active · {totalActiveTasks}/{totalCapacity} slots busy ·{' '}
          {clusterUtilizationPct.toFixed(0)}% utilised
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive">
          Error: {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Active', value: activeCount, color: 'bg-emerald-500' },
          { label: 'Busy', value: busyCount, color: 'bg-blue-500' },
          { label: 'Idle', value: idleCount, color: 'bg-emerald-500' },
        ].map(item => (
          <Card key={item.label} className="border-border bg-card/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{item.label}</p>
                <div className={`w-2 h-2 rounded-full ${item.color}`} />
              </div>
              <p className="text-3xl font-bold mt-2">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          HEALTHY = heartbeat &lt; 15s · BUSY = at capacity · STALE = 15–60s · DEAD = &gt; 60s
        </p>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={event => setIncludeInactive(event.target.checked)}
            className="h-4 w-4 rounded border-border bg-background/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          Show inactive ({inactiveCount})
        </label>
      </div>

      <Card className="border-border bg-card/50">
        <CardHeader>
          <CardTitle className="text-lg">Workers</CardTitle>
        </CardHeader>
        <CardContent>
          {visible.length === 0 ? (
            <EmptyState
              title="No active workers"
              description={`${inactiveCount} inactive worker(s) — enable Show inactive to inspect them.`}
            />
          ) : (
            <div className="space-y-3">
              {visible.map(worker => {
                const inactive = worker.status === 'STALE' || worker.status === 'DEAD';
                return (
                  <div
                    key={worker.id}
                    className={`p-4 rounded-lg bg-background/50 border border-border hover:border-primary/50 transition-colors ${
                      inactive ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-3 h-3 shrink-0 rounded-full ${
                          worker.status === 'HEALTHY' ? 'bg-emerald-500' :
                          worker.status === 'BUSY' ? 'bg-blue-500 animate-pulse' :
                          worker.status === 'STALE' ? 'bg-amber-500' : 'bg-red-500'
                        }`} />
                        <div className="min-w-0">
                          <p className="font-medium font-mono text-sm break-all">{worker.id}</p>
                          <p className="text-xs text-muted-foreground">
                            {worker.hostname || 'unknown host'}
                          </p>
                        </div>
                      </div>
                      <Badge status={worker.status} />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Slots</p>
                        <p className="font-medium">{worker.activeTasks}/{worker.capacity ?? 0}</p>
                        <ProgressBar
                          completed={worker.activeTasks}
                          failed={0}
                          total={worker.capacity ?? 0}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <p className="text-muted-foreground">Last seen</p>
                        <p className="font-medium" title={absolute(worker.lastSeenAt)}>
                          {formatRelative(worker.lastSeenAt)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Uptime</p>
                        <p className="font-medium">{formatDuration(worker.startedAt)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
