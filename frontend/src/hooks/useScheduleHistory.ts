import { useCallback, useEffect, useRef, useState } from 'react';
import { createAiClient } from '../ai';
import type { AiClient } from '../ai';
import type { ScheduleHistory } from '../ai/types';

interface UseScheduleHistoryResult {
  history: ScheduleHistory | null;
  loading: boolean;
  error: string | null;
  /** Page size + zero-based offset currently shown. */
  limit: number;
  offset: number;
  /** Whether more pages exist beyond the current one. */
  hasMore: boolean;
  nextPage: () => void;
  prevPage: () => void;
  refresh: () => void;
}

/**
 * Loads the watering execution history with simple limit/offset pagination.
 */
export function useScheduleHistory(
  pageSize = 10,
  client: AiClient = createAiClient(),
): UseScheduleHistoryResult {
  const [history, setHistory] = useState<ScheduleHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);

  const clientRef = useRef<AiClient>(client);
  clientRef.current = client;

  const load = useCallback(async (nextOffset: number) => {
    setLoading(true);
    try {
      const data = await clientRef.current.getHistory(pageSize, nextOffset);
      setHistory(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load watering history');
    } finally {
      setLoading(false);
    }
  }, [pageSize]);

  useEffect(() => {
    void load(offset);
  }, [load, offset]);

  const total = history?.totalRecords ?? 0;
  const hasMore = offset + pageSize < total;

  return {
    history,
    loading,
    error,
    limit: pageSize,
    offset,
    hasMore,
    nextPage: () => setOffset((o) => (o + pageSize < total ? o + pageSize : o)),
    prevPage: () => setOffset((o) => Math.max(0, o - pageSize)),
    refresh: () => void load(offset),
  };
}
