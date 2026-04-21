import { useState } from 'react';
import { api } from '../api/api';
import type { CreateJobRequest, CreateTaskRequest } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { jobTemplates } from '../lib/jobTemplates';

interface CreateJobFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export default function CreateJobForm({ onSuccess, onCancel }: CreateJobFormProps) {
  const [jobName, setJobName] = useState('');
  const [submittedBy, setSubmittedBy] = useState('');
  const [tasks, setTasks] = useState<CreateTaskRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);

  const [rawPayloads, setRawPayloads] = useState<Record<number, string>>({});

  // Ids must never be reused: a shrinking list would otherwise regenerate an id
  // that another task or a dependency still references.
  const nextTaskId = (existing: CreateTaskRequest[]) =>
    `task-${existing.reduce((max, task) => {
      const suffix = Number.parseInt(task.id.replace(/[^0-9]/g, ''), 10);
      return Number.isFinite(suffix) ? Math.max(max, suffix) : max;
    }, -1) + 1}`;

  const addTask = () => {
    const newIndex = tasks.length;
    const newTask: CreateTaskRequest = {
      id: nextTaskId(tasks),
      name: `Task ${newIndex + 1}`,
      type: 'NO_OP',
      payload: {},
      timeoutSeconds: 60,
      maxRetries: 3,
      dependsOn: [],
    };
    setTasks([...tasks, newTask]);
    setRawPayloads(prev => ({ ...prev, [newIndex]: '{}' }));
  };

  const updateTask = <K extends keyof CreateTaskRequest>(index: number, field: K, value: CreateTaskRequest[K]) => {
    const updatedTasks = [...tasks];
    updatedTasks[index] = { ...updatedTasks[index], [field]: value };
    setTasks(updatedTasks);
  };

  const removeTask = (index: number) => {
    const removedId = tasks[index]?.id;
    const remainingTasks = tasks
      .filter((_, i) => i !== index)
      .map(t => ({
        ...t,
        dependsOn: (t.dependsOn || []).filter(dep => dep !== removedId),
      }));
    setTasks(remainingTasks);
    setRawPayloads(prev => {
      const next: Record<number, string> = {};
      remainingTasks.forEach((_, i) => {
        next[i] = prev[i >= index ? i + 1 : i] || '{}';
      });
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobName.trim()) {
      setError('Job name is required');
      return;
    }
    if (tasks.length === 0) {
      setError('At least one task is required');
      return;
    }

    // Validate JSON payloads
    const parsedTasks = [...tasks];
    for (let i = 0; i < parsedTasks.length; i++) {
      const raw = rawPayloads[i];
      if (raw && raw.trim() !== '') {
        try {
          parsedTasks[i].payload = JSON.parse(raw);
        } catch (err) {
          const reason = err instanceof Error ? err.message : 'invalid JSON';
          setError(`Invalid JSON payload in Task ${i + 1}: ${reason}`);
          return;
        }
      }
    }

    setLoading(true);
    setError(null);

    try {
      const request: CreateJobRequest = {
        name: jobName,
        submittedBy: submittedBy || undefined,
        tasks: parsedTasks,
      };

      await api.jobs.create(request);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create job');
    } finally {
      setLoading(false);
    }
  };

  const loadTemplate = (template: CreateJobRequest) => {
    setJobName(template.name);
    setSubmittedBy(template.submittedBy || '');
    setTasks(template.tasks);
    const payloads: Record<number, string> = {};
    template.tasks.forEach((t, i) => {
      payloads[i] = JSON.stringify(t.payload || {}, null, 2);
    });
    setRawPayloads(payloads);
    setShowTemplates(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card className="border-border bg-card/50">
        <CardHeader>
          <CardTitle className="text-xl">Create New Job</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Job Name *</label>
                <input
                  type="text"
                  value={jobName}
                  onChange={(e) => setJobName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g., Nightly ETL Pipeline"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Submitted By</label>
                <input
                  type="text"
                  value={submittedBy}
                  onChange={(e) => setSubmittedBy(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g., john.doe"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Tasks</h3>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowTemplates(!showTemplates)}
                  >
                    {showTemplates ? 'Hide Templates' : 'Use Template'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addTask}
                  >
                    + Add Task
                  </Button>
                </div>
              </div>

              {showTemplates && (
                <div className="p-4 rounded-lg bg-background/50 border border-border space-y-3">
                  <p className="text-sm text-muted-foreground">Select a template to get started:</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {jobTemplates.map((template, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => loadTemplate(template.template)}
                        className="p-3 rounded-lg bg-card border border-border hover:border-primary/50 hover:bg-primary/5 text-left transition-colors"
                      >
                        <p className="font-medium">{template.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">{template.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {tasks.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed border-border rounded-lg">
                  <p className="text-muted-foreground">No tasks added yet. Click "Add Task" to get started.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {tasks.map((task, index) => (
                    <Card key={task.id} className="border-border bg-background/50">
                      <CardContent className="p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">Task {index + 1}</h4>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeTask(index)}
                            className="text-destructive hover:text-destructive"
                          >
                            Remove
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Task Name *</label>
                            <input
                              type="text"
                              value={task.name}
                              onChange={(e) => updateTask(index, 'name', e.target.value)}
                              className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                              placeholder="e.g., Extract Data"
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-medium">Task Type</label>
                            <select
                              value={task.type}
                              onChange={(e) => updateTask(index, 'type', e.target.value)}
                              className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                            >
                              <option value="NO_OP">No Operation (Test)</option>
                              <option value="HTTP_REQUEST">HTTP Request</option>
                              <option value="SHELL_COMMAND">Shell Command</option>
                            </select>
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-medium">Timeout (seconds)</label>
                            <input
                              type="number"
                              value={task.timeoutSeconds || 60}
                              onChange={(e) => {
                                const parsed = Number.parseInt(e.target.value, 10);
                                updateTask(index, 'timeoutSeconds', Number.isFinite(parsed) ? parsed : 60);
                              }}
                              className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                              min="1"
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-medium">Max Retries</label>
                            <input
                              type="number"
                              value={task.maxRetries || 3}
                              onChange={(e) => {
                                const parsed = Number.parseInt(e.target.value, 10);
                                updateTask(index, 'maxRetries', Number.isFinite(parsed) ? parsed : 3);
                              }}
                              className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                              min="0"
                              max="10"
                            />
                          </div>

                          <div className="space-y-2 md:col-span-2">
                            <label className="text-sm font-medium">Dependencies (comma-separated task IDs)</label>
                            <input
                              type="text"
                              value={task.dependsOn?.join(', ') || ''}
                              onChange={(e) => updateTask(index, 'dependsOn', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                              className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                              placeholder="e.g., task-0, task-1"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium">Payload (JSON)</label>
                          <textarea
                            value={rawPayloads[index] !== undefined ? rawPayloads[index] : JSON.stringify(task.payload || {}, null, 2)}
                            onChange={(e) => {
                              setRawPayloads({ ...rawPayloads, [index]: e.target.value });
                            }}
                            className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm"
                            rows={4}
                            placeholder='{"key": "value"}'
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
              >
                {loading ? 'Creating...' : 'Create Job'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}