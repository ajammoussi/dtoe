import { useEffect } from 'react';

export function usePolling(load: () => void, intervalMs = 5000, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    load();
    const interval = setInterval(() => {
      if (!document.hidden) {
        load();
      }
    }, intervalMs);
    return () => clearInterval(interval);
  }, [load, intervalMs, enabled]);
}
