import { cn } from '../../lib/utils';

interface ProgressBarProps {
  completed: number;
  total: number;
  failed: number;
  className?: string;
}

export function ProgressBar({ completed, total, failed, className }: ProgressBarProps) {
  const succeeded = Math.max(0, Math.min(completed, total));
  const failures = Math.max(0, Math.min(failed, total - succeeded));
  const pending = Math.max(0, total - succeeded - failures);
  const pct = (value: number) => (total === 0 ? 0 : (value / total) * 100);

  return (
    <div
      className={cn('flex h-1.5 w-full overflow-hidden rounded-full bg-muted', className)}
      title={`${completed} succeeded, ${failed} failed of ${total}`}
      role="img"
      aria-label={`${completed} succeeded, ${failed} failed of ${total}`}
    >
      {succeeded > 0 && <div className="bg-emerald-500" style={{ width: `${pct(succeeded)}%` }} />}
      {failures > 0 && <div className="bg-red-500" style={{ width: `${pct(failures)}%` }} />}
      {pending > 0 && <div className="bg-muted-foreground/30" style={{ width: `${pct(pending)}%` }} />}
    </div>
  );
}
