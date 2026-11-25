import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/api';
import { JOB_STATUSES, type Job } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { SearchInput } from '../components/ui/search-input';
import { StatusFilter } from '../components/ui/status-filter';
import { Pagination } from '../components/ui/pagination';
import { ProgressBar } from '../components/ui/progress-bar';
import { EmptyState } from '../components/ui/empty-state';
import { PAGE_SIZES, useListQuery } from '../lib/useListQuery';
import { usePolling } from '../lib/usePolling';
import { absolute, formatDuration, formatRelative, shortId } from '../lib/format';
import CreateJobForm from '../components/CreateJobForm';

const DEFAULT_SIZE = 20;

export default function JobsPage() {
  const navigate = useNavigate();
  const { searchText, setSearchText, query, setStatus, setPage, setSize, clearFilters } =
    useListQuery(JOB_STATUSES, PAGE_SIZES, DEFAULT_SIZE);
  const { q, status, page, size } = query;

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const load = useCallback(() => {
    api.jobs.listPage({ page, size, status, q })
      .then(res => {
        setJobs(res.content);
        setTotalPages(res.totalPages);
        setTotalElements(res.totalElements);
        setError(null);
        if (res.content.length === 0 && res.number > 0 && res.totalPages > 0) {
          setPage(res.totalPages - 1);
        }
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load jobs'))
      .finally(() => setLoading(false));
  }, [page, size, status, q, setPage]);

  usePolling(load, 5000);

  if (showCreateForm) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => setShowCreateForm(false)}>
            ← Back to Jobs
          </Button>
          <h2 className="text-2xl font-bold">Create New Job</h2>
        </div>
        <CreateJobForm
          onSuccess={() => {
            setShowCreateForm(false);
            load();
          }}
          onCancel={() => setShowCreateForm(false)}
        />
      </div>
    );
  }

  if (loading && jobs.length === 0) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Jobs</h2>
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
        <h2 className="text-2xl font-bold">Jobs</h2>
        <Button onClick={() => setShowCreateForm(true)}>Create Job</Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={searchText} onChange={setSearchText} placeholder="Search jobs by name…" />
        <StatusFilter options={JOB_STATUSES} value={status} onChange={setStatus} />
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
          <CardTitle>All Jobs</CardTitle>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            filtersActive ? (
              <EmptyState
                title="No jobs match your filters"
                description="Try a different search term or status."
                action={<Button variant="outline" size="sm" onClick={clearFilters}>Clear filters</Button>}
              />
            ) : (
              <EmptyState
                title="No jobs yet"
                description="Submit a job to see it here."
                action={<Button size="sm" onClick={() => setShowCreateForm(true)}>Create Job</Button>}
              />
            )
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm text-muted-foreground">Job</th>
                    <th className="text-left py-3 px-4 text-sm text-muted-foreground">Status</th>
                    <th className="text-left py-3 px-4 text-sm text-muted-foreground">Progress</th>
                    <th className="text-left py-3 px-4 text-sm text-muted-foreground">Submitted by</th>
                    <th className="text-left py-3 px-4 text-sm text-muted-foreground">Created</th>
                    <th className="text-left py-3 px-4 text-sm text-muted-foreground">Duration</th>
                    <th className="text-left py-3 px-4 text-sm text-muted-foreground" />
                  </tr>
                </thead>
                <tbody>
                  {jobs.map(job => {
                    const failed = job.failedTasks ?? 0;
                    return (
                      <tr
                        key={job.id}
                        className="border-b border-border/50 hover:bg-accent/5 cursor-pointer"
                        onClick={() => navigate(`/jobs/${job.id}`)}
                      >
                        <td className="py-3 px-4">
                          <Link
                            to={`/jobs/${job.id}`}
                            onClick={event => event.stopPropagation()}
                            className="font-medium hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                          >
                            {job.name}
                          </Link>
                          <p className="text-xs text-muted-foreground font-mono">{shortId(job.id)}</p>
                        </td>
                        <td className="py-3 px-4">
                          <Badge status={job.status} />
                        </td>
                        <td className="py-3 px-4 min-w-40">
                          <ProgressBar
                            completed={job.completedTasks ?? 0}
                            failed={failed}
                            total={job.taskCount ?? 0}
                          />
                          <p className="mt-1 text-xs text-muted-foreground">
                            {job.completedTasks ?? 0}/{job.taskCount ?? 0}
                            {failed > 0 && <span className="text-red-400"> · {failed} failed</span>}
                          </p>
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">{job.submittedBy || '—'}</td>
                        <td className="py-3 px-4 text-sm text-muted-foreground" title={absolute(job.createdAt)}>
                          {formatRelative(job.createdAt)}
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {formatDuration(job.createdAt, job.completedAt)}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">›</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <Pagination
            page={page}
            totalPages={totalPages}
            totalElements={totalElements}
            contentLength={jobs.length}
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
