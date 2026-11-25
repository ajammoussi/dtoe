import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

export const PAGE_SIZES = [10, 20, 50] as const;

export interface ListQuery {
  q: string;
  status?: string;
  page: number;
  size: number;
}

export interface UseListQueryResult {
  searchText: string;
  setSearchText: (value: string) => void;
  query: ListQuery;
  setStatus: (value?: string) => void;
  setPage: (value: number) => void;
  setSize: (value: number) => void;
  clearFilters: () => void;
}

function parsePositiveInt(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export function useListQuery(
  allowedStatuses: readonly string[],
  allowedSizes: readonly number[],
  defaultSize: number
): UseListQueryResult {
  const [params, setParams] = useSearchParams();

  const q = params.get('q') ?? '';
  const rawStatus = params.get('status');
  const status = rawStatus && allowedStatuses.includes(rawStatus) ? rawStatus : undefined;
  const page = parsePositiveInt(params.get('page')) ?? 0;
  const rawSize = parsePositiveInt(params.get('size'));
  const size = rawSize !== undefined && (allowedSizes as readonly number[]).includes(rawSize)
    ? rawSize
    : defaultSize;

  const [searchText, setSearchText] = useState(q);

  useEffect(() => {
    setSearchText(q);
  }, [q]);

  useEffect(() => {
    if (searchText === q) return;
    const timer = setTimeout(() => {
      setParams(prev => {
        const next = new URLSearchParams(prev);
        if (searchText) {
          next.set('q', searchText);
        } else {
          next.delete('q');
        }
        next.delete('page');
        return next;
      }, { replace: true });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText, q, setParams]);

  const setStatus = useCallback((value?: string) => {
    setParams(prev => {
      const next = new URLSearchParams(prev);
      if (value) {
        next.set('status', value);
      } else {
        next.delete('status');
      }
      next.delete('page');
      return next;
    }, { replace: true });
  }, [setParams]);

  const setPage = useCallback((value: number) => {
    setParams(prev => {
      const next = new URLSearchParams(prev);
      if (value > 0) {
        next.set('page', String(value));
      } else {
        next.delete('page');
      }
      return next;
    }, { replace: true });
  }, [setParams]);

  const setSize = useCallback((value: number) => {
    setParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('size', String(value));
      next.delete('page');
      return next;
    }, { replace: true });
  }, [setParams]);

  const clearFilters = useCallback(() => {
    setParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete('q');
      next.delete('status');
      next.delete('page');
      return next;
    }, { replace: true });
  }, [setParams]);

  const query = useMemo<ListQuery>(() => ({ q, status, page, size }), [q, status, page, size]);

  return { searchText, setSearchText, query, setStatus, setPage, setSize, clearFilters };
}
