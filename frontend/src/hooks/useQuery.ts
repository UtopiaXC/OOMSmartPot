import { useCallback, useEffect, useRef, useState } from 'react';
import { createDataSource } from '../data';
import type { DataSource } from '../data';
import type { Query, Series } from '../data/types';
import { config } from '../config/env';

export interface UseQueryResult {
  data: Series | null;
  error: Error | null;
  loading: boolean;
  refresh: () => void;
}

/**
 * Executes a DataSource query and keeps the result fresh.
 *
 * @param q       - The sensor query to run.
 * @param options - Optional: { pollMs, dataSource }
 *   - pollMs (default config.POLL_INTERVAL_MS for 'latest', 0 for others): interval
 *     for auto-refresh. Pass 0 to disable polling.
 *   - dataSource: override the factory-created DataSource (useful for tests).
 */
export function useQuery(
  q: Query,
  options: {
    pollMs?: number;
    dataSource?: DataSource;
  } = {}
): UseQueryResult {
  const isLatest = q.range.kind === 'latest';
  const defaultPoll = isLatest ? config.POLL_INTERVAL_MS : 0;
  const pollMs = options.pollMs !== undefined ? options.pollMs : defaultPoll;

  // Stable DataSource reference — only recreate when the override changes.
  const dsRef = useRef<DataSource>(options.dataSource ?? createDataSource());
  useEffect(() => {
    dsRef.current = options.dataSource ?? createDataSource();
  }, [options.dataSource]);

  const [data, setData] = useState<Series | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

  // Use a ref so the interval closure always calls the latest fetch.
  const fetchRef = useRef<() => void>(() => undefined);

  const fetch = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    dsRef.current
      .query(q)
      .then((series) => {
        if (!cancelled) {
          setData(series);
          setError(null);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, // eslint-disable-next-line react-hooks/exhaustive-deps
  [q.metric, q.range.kind,
    // stringify the range so changes to window/period params trigger re-fetch
    JSON.stringify(q.range), q.aggregation]);

  fetchRef.current = fetch;

  // Initial fetch + re-fetch when query changes
  useEffect(() => {
    const cancel = fetchRef.current();
    return cancel;
  }, [fetch]);

  // Polling (only when pollMs > 0)
  useEffect(() => {
    if (!pollMs) return;
    const id = setInterval(() => {
      fetchRef.current();
    }, pollMs);
    return () => clearInterval(id);
  }, [pollMs]);

  const refresh = useCallback(() => {
    fetchRef.current();
  }, []);

  return { data, error, loading, refresh };
}
