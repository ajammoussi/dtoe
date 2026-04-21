import { cn, getStatusColor, getWorkerStatusColor } from '../../lib/utils';

interface BadgeProps {
  status: string;
  className?: string;
}

export function Badge({ status, className }: BadgeProps) {
  const isWorker = status === 'HEALTHY' || status === 'STALE' || status === 'BUSY' || status === 'DEAD';
  const colors = isWorker ? getWorkerStatusColor(status) : getStatusColor(status);

  return (
    <span className={cn('px-2.5 py-1 rounded-full text-xs font-medium border', colors, className)}>
      {status}
    </span>
  );
}