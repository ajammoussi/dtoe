import { Button } from './button';

interface PaginationProps {
  page: number;
  totalPages: number;
  totalElements: number;
  contentLength: number;
  size: number;
  onPage: (page: number) => void;
  onSize: (size: number) => void;
  sizes: readonly number[];
}

export function Pagination({
  page,
  totalPages,
  totalElements,
  contentLength,
  size,
  onPage,
  onSize,
  sizes,
}: PaginationProps) {
  const from = totalElements === 0 ? 0 : page * size + 1;
  const to = page * size + contentLength;
  const isLastPage = page + 1 >= Math.max(totalPages, 1);

  return (
    <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        Showing {from}–{to} of {totalElements}
      </p>
      <div className="flex items-center gap-2">
        <select
          aria-label="Rows per page"
          value={size}
          onChange={event => onSize(Number(event.target.value))}
          className="rounded-lg border border-border bg-background/50 px-2 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {sizes.map(option => (
            <option key={option} value={option}>
              {option} / page
            </option>
          ))}
        </select>
        <Button
          variant="outline"
          size="sm"
          aria-label="Previous page"
          disabled={page <= 0}
          onClick={() => onPage(page - 1)}
        >
          Previous
        </Button>
        <span className="text-sm text-muted-foreground">
          Page {page + 1} of {Math.max(totalPages, 1)}
        </span>
        <Button
          variant="outline"
          size="sm"
          aria-label="Next page"
          disabled={isLastPage}
          onClick={() => onPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
