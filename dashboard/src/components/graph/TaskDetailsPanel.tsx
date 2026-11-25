import { Link } from 'react-router-dom';
import type { Task } from '../../types';
import { Badge } from '../ui/badge';
import { absolute, formatDuration, formatRelative, shortId } from '../../lib/format';

interface TaskDetailsPanelProps {
  task: Task;
  mode?: 'runtime' | 'definition';
  onClose?: () => void;
}

function payloadCommand(payload?: Record<string, unknown>): string | undefined {
  const command = payload?.command;
  return typeof command === 'string' && command ? command : undefined;
}

export function TaskDetailsPanel({ task, mode = 'runtime', onClose }: TaskDetailsPanelProps) {
  const command = payloadCommand(task.payload);
  const payloadEntries = Object.entries(task.payload ?? {});
  const otherPayload = Object.fromEntries(payloadEntries.filter(([key]) => key !== 'command'));
  const isRealTask = /^[0-9a-f-]{36}$/.test(task.id);
  const runtime = mode === 'runtime';

  return (
    <aside className="flex h-full flex-col gap-3 overflow-y-auto rounded-lg border border-border bg-background/40 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{task.name || task.type}</p>
          <p className="truncate font-mono text-[11px] text-muted-foreground">{shortId(task.id)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {runtime && <Badge status={task.status} />}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Clear selection"
              className="rounded px-1.5 text-lg leading-none text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Type</p>
          <p className="font-mono text-xs">{task.type}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Retries</p>
          <p>{task.retryCount}/{task.maxRetries}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Timeout</p>
          <p>{task.timeoutSeconds}s</p>
        </div>
        {runtime ? (
          <div>
            <p className="text-xs text-muted-foreground">Duration</p>
            <p>{formatDuration(task.startedAt, task.completedAt)}</p>
          </div>
        ) : (
          <div>
            <p className="text-xs text-muted-foreground">Depends on</p>
            <p>{(task.dependsOn ?? task.dependencies ?? []).length}</p>
          </div>
        )}
        {runtime && (
          <div className="col-span-2">
            <p className="text-xs text-muted-foreground">Worker</p>
            <p className="font-mono text-xs">{task.workerId || '—'}</p>
          </div>
        )}
        {runtime && (
          <div className="col-span-2">
            <p className="text-xs text-muted-foreground">Started</p>
            <p className="text-xs" title={absolute(task.startedAt)}>{formatRelative(task.startedAt)}</p>
          </div>
        )}
      </div>

      {command && (
        <div>
          <p className="mb-1 text-xs text-muted-foreground">Command</p>
          <pre className="max-h-40 overflow-auto rounded-md border border-border bg-background/70 p-2 font-mono text-[11px] whitespace-pre-wrap">
            {command}
          </pre>
        </div>
      )}

      {!command && payloadEntries.length === 0 && (
        <p className="text-xs text-muted-foreground">No payload for this task.</p>
      )}

      {(command ? Object.keys(otherPayload).length > 0 : payloadEntries.length > 0) && (
        <div>
          <p className="mb-1 text-xs text-muted-foreground">Payload</p>
          <pre className="max-h-48 overflow-auto rounded-md border border-border bg-background/70 p-2 font-mono text-[11px] whitespace-pre-wrap">
            {JSON.stringify(command ? otherPayload : task.payload, null, 2)}
          </pre>
        </div>
      )}

      {task.errorMessage && (
        <div>
          <p className="mb-1 text-xs text-red-400">Error</p>
          <pre className="max-h-48 overflow-auto rounded-md border border-destructive/40 bg-destructive/10 p-2 font-mono text-[11px] whitespace-pre-wrap text-red-300">
            {task.errorMessage}
          </pre>
        </div>
      )}

      {runtime && isRealTask && (
        <div className="mt-auto flex flex-wrap gap-2 pt-2">
          <Link
            to={`/tasks/${task.id}`}
            className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-accent/10"
          >
            Open task →
          </Link>
          {task.jobId && (
            <Link
              to={`/jobs/${task.jobId}`}
              className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-accent/10"
            >
              Open job →
            </Link>
          )}
        </div>
      )}
    </aside>
  );
}
