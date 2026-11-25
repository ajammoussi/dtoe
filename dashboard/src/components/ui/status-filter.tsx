import { cn } from '../../lib/utils';

interface StatusFilterProps {
  options: readonly string[];
  value?: string;
  onChange: (value?: string) => void;
}

export function StatusFilter({ options, value, onChange }: StatusFilterProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {[undefined, ...options].map(option => {
        const active = option === value;
        return (
          <button
            key={option ?? 'all'}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
              active
                ? 'bg-primary/20 border-primary/30 text-primary'
                : 'border-border text-muted-foreground hover:bg-accent/10 hover:text-foreground'
            )}
          >
            {option ?? 'All'}
          </button>
        );
      })}
    </div>
  );
}
