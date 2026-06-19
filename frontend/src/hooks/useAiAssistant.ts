import { useCallback, useEffect, useRef, useState } from 'react';
import { createAiClient } from '../ai';
import type { AiClient } from '../ai';
import type { AiSuggestions, UpcomingSchedule, TriggerResult } from '../ai/types';

interface UseAiAssistantResult {
  suggestions: AiSuggestions | null;
  upcoming: UpcomingSchedule | null;
  loading: boolean;
  error: string | null;
  /** True while an on-demand AI run is in flight. */
  triggering: boolean;
  /** Result of the last trigger, if any. */
  lastTrigger: TriggerResult | null;
  /** Re-fetch suggestions + upcoming schedule. */
  refresh: () => void;
  /** Run an AI analysis now, then refresh. */
  trigger: () => void;
}

/**
 * Loads the AI assistant's suggestions + upcoming schedule, and exposes an
 * on-demand `trigger()` that runs the AI routine and refreshes the views.
 */
export function useAiAssistant(client: AiClient = createAiClient()): UseAiAssistantResult {
  const [suggestions, setSuggestions] = useState<AiSuggestions | null>(null);
  const [upcoming, setUpcoming] = useState<UpcomingSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [lastTrigger, setLastTrigger] = useState<TriggerResult | null>(null);

  const clientRef = useRef<AiClient>(client);
  clientRef.current = client;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [s, u] = await Promise.all([
        clientRef.current.getSuggestions(),
        clientRef.current.getUpcoming(),
      ]);
      setSuggestions(s);
      setUpcoming(u);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load AI assistant');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const trigger = useCallback(async () => {
    setTriggering(true);
    setError(null);
    try {
      const result = await clientRef.current.trigger();
      setLastTrigger(result);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to trigger AI analysis');
    } finally {
      setTriggering(false);
    }
  }, [refresh]);

  return {
    suggestions,
    upcoming,
    loading,
    error,
    triggering,
    lastTrigger,
    refresh: () => void refresh(),
    trigger: () => void trigger(),
  };
}
