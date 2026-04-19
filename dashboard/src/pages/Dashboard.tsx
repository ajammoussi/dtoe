import { useState, useEffect } from 'react';
import { api } from '../api/api';
import type { Job, Worker } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';

export default function Dashboard() {
  const [stats, setStats] = useState({ jobs: 0, tasks: 0, workers: 0, successRate: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.jobs.list(),
      api.workers.list(),
    ])
      .then(([jobs, workers]) => {
        const totalJobs = jobs.length;
        const successJobs = jobs.filter(j => j.status === 'SUCCESS').length;
        setStats({
          jobs: totalJobs,
          tasks: 0,
          workers: workers.length,
          successRate: totalJobs > 0 ? Math.round((successJobs / totalJobs) * 100) : 0,
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Jobs',
      value: stats.jobs,
      icon: '📋',
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/30',
    },
    {
      title: 'Active Workers',
      value: stats.workers,
      icon: '⚡',
      color: 'from-emerald-500 to-emerald-600',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/30',
    },
    {
      title: 'Tasks Executed',
      value: stats.tasks,
      icon: '🎯',
      color: 'from-violet-500 to-violet-600',
      bgColor: 'bg-violet-500/10',
      borderColor: 'border-violet-500/30',
    },
    {
      title: 'Success Rate',
      value: `${stats.successRate}%`,
      icon: '✅',
      color: 'from-cyan-500 to-cyan-600',
      bgColor: 'bg-cyan-500/10',
      borderColor: 'border-cyan-500/30',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Overview</h2>
        <p className="text-sm text-muted-foreground">Real-time system status</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <Card key={index} className={`${stat.bgColor} border ${stat.borderColor} hover:scale-[1.02] transition-transform`}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <span className="text-3xl">{stat.icon}</span>
                <div className={`px-3 py-1 rounded-full bg-gradient-to-r ${stat.color} text-white text-xs font-medium`}>
                  Live
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm text-muted-foreground">{stat.title}</p>
                <p className="text-3xl font-bold mt-1">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border bg-card/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <span className="text-xl">📊</span> Recent Jobs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RecentJobsList />
          </CardContent>
        </Card>

        <Card className="border-border bg-card/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <span className="text-xl">👥</span> Active Workers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ActiveWorkersList />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function RecentJobsList() {
  const [jobs, setJobs] = useState<Job[]>([]);

  useEffect(() => {
    api.jobs.list()
      .then(setJobs)
      .catch(console.error);
  }, []);

  if (jobs.length === 0) {
    return <p className="text-muted-foreground text-center py-4">No jobs yet</p>;
  }

  return (
    <div className="space-y-3">
          {jobs.slice(0, 5).map(job => (
        <div key={job.id} className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border">
          <div>
            <p className="font-medium">{job.name}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(job.createdAt).toLocaleTimeString()}
            </p>
          </div>
              <Badge status={job.status} />
        </div>
      ))}
    </div>
  );
}

function ActiveWorkersList() {
  const [workers, setWorkers] = useState<Worker[]>([]);

  useEffect(() => {
    api.workers.list()
      .then(setWorkers)
      .catch(console.error);
  }, []);

  if (workers.length === 0) {
    return <p className="text-muted-foreground text-center py-4">No workers online</p>;
  }

  return (
    <div className="space-y-3">
          {workers.map(worker => (
        <div key={worker.id} className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${
              worker.status === 'IDLE' ? 'bg-emerald-500' :
              worker.status === 'BUSY' ? 'bg-blue-500' : 'bg-red-500'
            } animate-pulse`} />
            <div>
              <p className="font-medium font-mono text-sm">{worker.id.slice(0, 12)}...</p>
              <p className="text-xs text-muted-foreground">{worker.activeTasks} active tasks</p>
            </div>
          </div>
          <Badge status={worker.status} />
        </div>
      ))}
    </div>
  );
}