import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import JobsPage from './pages/JobsPage';
import TasksPage from './pages/TasksPage';
import WorkersPage from './pages/WorkersPage';
import JobDetailPage from './pages/JobDetailPage';
import TaskDetailPage from './pages/TaskDetailPage';
import './index.css';

function Navigation() {
  const [isOnline, setIsOnline] = useState<boolean>(true);

  useEffect(() => {
    const checkHealth = () => {
      fetch('/api/v1/workers')
        .then(res => setIsOnline(res.ok))
        .catch(() => setIsOnline(false));
    };
    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, []);
  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent">
              DTOE Dashboard
            </h1>
            <nav className="flex gap-1">
              {[
                { to: '/', label: 'Overview' },
                { to: '/jobs', label: 'Jobs' },
                { to: '/tasks', label: 'Tasks' },
                { to: '/workers', label: 'Workers' },
              ].map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-primary/20 text-primary border border-primary/30'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/10'
                    }`
                  }
                >
                  {label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
              isOnline 
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                : 'bg-red-500/20 text-red-400 border-red-500/30'
            }`}>
              {isOnline ? 'System Online' : 'System Offline'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

function NotFound() {
  return (
    <div className="text-center py-16 space-y-3">
      <p className="text-4xl font-bold">404</p>
      <p className="text-muted-foreground">Page not found</p>
      <NavLink to="/" className="text-primary underline">
        Back to overview
      </NavLink>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-6 py-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/jobs" element={<JobsPage />} />
            <Route path="/jobs/:jobId" element={<JobDetailPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/tasks/:taskId" element={<TaskDetailPage />} />
            <Route path="/workers" element={<WorkersPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}