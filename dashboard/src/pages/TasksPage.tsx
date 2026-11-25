import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/api';
import { TASK_STATUSES, type Task } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { SearchInput } from '../components/ui/search-input';
import { StatusFilter } from '../components/ui/status-filter';
import { Pagination } from '../components/ui/pagination';
import { EmptyState } from '../components/ui/empty-state';
import { PAGE_SIZES, useListQuery } from '../lib/useListQuery';
import { usePolling } from '../lib/usePolling';
import { absolute, formatDuration, formatRelative, shortId } from '../lib/format';

const DEFAULT_SIZE = 20;

export default function TasksPage() {
  const navigate = useNavigate();
  const { searchText, setSearchText, query, setStatus, setPage, setSize, clearFilters } =
    useListQuery(TASK_STATUSES, PAGE_SIZES, DEFAULT_SIZE);
  const { q, status, page, size } = query;

  const [tasks, setTasks] = useState<Task[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api.tasks.list({ page, size, status, q })
      .then(res => {
        setTasks(res.content);
        setTotalElements(res.totalElements);
        setTotalPages(res.totalPages);
        setError(null);
        if (res.content.length === 0 && res.number > 0 && res.totalPages > 0) {
          setPage(res.totalPages - 1);
        }
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load tasks'))
      .finally(() => setLoading(false));
  }, [page, size, status, q, setPage]);

  usePolling(load, 5000);

  if (loading && tasks.length === 0) {
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

  const filtersActive = Boolean(q || status);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Tasks</h2>
          <p className="text-sm text-muted-foreground">{totalElements} task(s)</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={searchText}
          onChange={setSearchText}
          placeholder="Search by task name, type or job…"
        />
        <StatusFilter options={TASK_STATUSES} value={status} onChange={setStatus} />
        {filtersActive && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive">
          Error: {error}
        </div>
      )}

      <Card className="border-border bg-card/50">
        <CardHeader>
          <CardTitle>All Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            filtersActive ? (
              <EmptyState
                title="No tasks match your filters"
                description="Try a different search term or status."
                action={<Button variant="outline" size="sm" onClick={clearFilters}>Clear filters</Button>}
              />
            ) : (
              <EmptyState title="No tasks yet" description="Tasks appear here once a job is submitted." />
            )
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm text-muted-foreground">Task</th>
                    <th className="text-left py-3 px-4 text-sm text-muted-foreground">Job</th>
                    <th className="text-left py-3 px-4 text-sm text-muted-foreground">Type</th>
                    <th className="text-left py-3 px-4 text-sm text-muted-foreground">Status</th>
                    <th className="text-left py-3 px-4 text-sm text-muted-foreground">Retries</th>
                    <th className="text-left py-3 px-4 text-sm text-muted-foreground">Worker</th>
                    <th className="text-left py-3 px-4 text-sm text-muted-foreground">Duration</th>
                    <th className="text-left py-3 px-4 text-sm text-muted-foreground">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map(task => (
                    <tr
                      key={task.id}
                      className="border-b border-border/50 hover:bg-accent/5 cursor-pointer"
                      onClick={() => navigate(`/tasks/${task.id}`)}
                    >
                      <td className="py-3 px-4">
                        <Link
                          to={`/tasks/${task.id}`}
                          onClick={event => event.stopPropagation()}
                          className="font-medium hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                        >
                          {task.name || task.type}
                        </Link>
                        <p className="text-xs text-muted-foreground font-mono">{shortId(task.id)}</p>
                      </td>
                      <td className="py-3 px-4">
                        {task.jobId ? (
                          <Link
                            to={`/jobs/${task.jobId}`}
                            onClick={event => event.stopPropagation()}
                            className="text-sm hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                            title={task.jobId}
                          >
                            {task.jobName || shortId(task.jobId)}
                          </Link>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
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
                      <td className="py-3 px-4 text-sm">{task.retryCount}/{task.maxRetries}</td>
                      <td className="py-3 px-4 font-mono text-xs text-muted-foreground">
                        {shortId(task.workerId)}
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {formatDuration(task.startedAt, task.completedAt)}
                      </td>
                      <td
                        className="py-3 px-4 text-sm text-muted-foreground"
                        title={absolute(task.createdAt)}
                      >
                        {formatRelative(task.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Pagination
            page={page}
            totalPages={totalPages}
            totalElements={totalElements}
            contentLength={tasks.length}
            size={size}
            onPage={setPage}
            onSize={setSize}
            sizes={PAGE_SIZES}
          />
        </CardContent>
      </Card>
    </div>
  );
}
