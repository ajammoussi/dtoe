import { useState, useEffect } from 'react';
import { api } from '../api/api';
import type { Job } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.jobs.list()
      .then(setJobs)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
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

  if (error) {
    return (
      <div className="p-6 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive">
        Error: {error}
      </div>
    );
  }

  const statusCounts = jobs.reduce((acc, job) => {
    acc[job.status] = (acc[job.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Jobs</h2>
        <Button>Create Job</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {['PENDING', 'RUNNING', 'SUCCESS', 'FAILED'].map(status => (
          <Card key={status} className="border-border bg-card/50">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{status}</p>
              <p className="text-3xl font-bold mt-1">{statusCounts[status] || 0}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border bg-card/50">
        <CardHeader>
          <CardTitle>All Jobs</CardTitle>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No jobs found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm text-muted-foreground">Name</th>
                    <th className="text-left py-3 px-4 text-sm text-muted-foreground">Status</th>
                    <th className="text-left py-3 px-4 text-sm text-muted-foreground">Created</th>
                    <th className="text-left py-3 px-4 text-sm text-muted-foreground">Completed</th>
                    <th className="text-left py-3 px-4 text-sm text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map(job => (
                    <tr key={job.id} className="border-b border-border/50 hover:bg-accent/5">
                      <td className="py-3 px-4">
                        <p className="font-medium">{job.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{job.id.slice(0, 8)}...</p>
                      </td>
                      <td className="py-3 px-4">
                        <Badge status={job.status} />
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {new Date(job.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {job.completedAt ? new Date(job.completedAt).toLocaleString() : '-'}
                      </td>
                      <td className="py-3 px-4">
                        <Button variant="ghost" size="sm">View</Button>
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