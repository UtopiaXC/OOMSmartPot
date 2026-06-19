import { useCallback, useEffect, useRef, useState } from 'react';
import type { Pump } from '../control/Pump';
import { createPump } from '../control';
import type { PumpStatus } from '../control/types';
import { config } from '../config/env';

interface UsePumpResult {
  /** Latest known pump status, or null while the first fetch is in flight. */
  status: PumpStatus | null;
  /** Non-null when the last operation failed. Cleared on the next successful op. */
  error: string | null;
  /** True while a run/stop command is in flight. */
  sending: boolean;
  /** Run the pump for `durationMs` (optimistic). */
  run: (durationMs: number) => void;
  /** Stop the pump immediately (optimistic). */
  stop: () => void;
  /** Manually re-fetch status from the pump. */
  refresh: () => void;
}

/**
 * React hook that drives a single Pump with:
 *   - optimistic status updates (immediate UI feedback)
 *   - rollback on network / hardware errors
 *   - concurrent-send guard (ignores clicks while a send is in flight)
 *   - polling via config.POLL_INTERVAL_MS (so a momentary run that finishes
 *     server-side is reflected back to `isRunning: false`)
 *
 * @param pump Injectable Pump instance — defaults to createPump().
 *             Inject a MockPump / FailingPump in tests.
 */
export function usePump(pump: Pump = createPump()): UsePumpResult {
  const [status, setStatus] = useState<PumpStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // Keep a stable ref so callbacks don't close over stale status.
  const statusRef = useRef<PumpStatus | null>(null);
  statusRef.current = status;

  // Ref-based guard — source of truth for whether a send is in-flight.
  const sendingRef = useRef(false);

  // Stable pump ref so the polling effect doesn't re-run on every render.
  const pumpRef = useRef<Pump>(pump);
  pumpRef.current = pump;

  const refresh = useCallback(async () => {
    try {
      const latest = await pumpRef.current.getStatus();
      setStatus(latest);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read pump status');
    }
  }, []);

  // Initial fetch + optional polling.
  useEffect(() => {
    void refresh();

    if (config.POLL_INTERVAL_MS <= 0) return;

    const id = setInterval(() => {
      // Don't clobber an in-flight optimistic command with a poll.
      if (!sendingRef.current) void refresh();
    }, config.POLL_INTERVAL_MS);

    return () => clearInterval(id);
  }, [refresh]);

  const send = useCallback(
    async (cmd: Parameters<Pump['send']>[0], optimistic: PumpStatus) => {
      if (sendingRef.current) return; // guard: no concurrent sends

      sendingRef.current = true;
      const previous = statusRef.current;

      setStatus(optimistic);
      setError(null);
      setSending(true);

      try {
        const confirmed = await pumpRef.current.send(cmd);
        setStatus(confirmed);
      } catch (err) {
        setStatus(previous); // rollback
        setError(err instanceof Error ? err.message : 'Command failed');
      } finally {
        sendingRef.current = false;
        setSending(false);
      }
    },
    [],
  );

  const run = useCallback(
    (durationMs: number) =>
      void send(
        { action: 'run', durationMs },
        {
          isRunning: true,
          hardwareHealthy: statusRef.current?.hardwareHealthy ?? true,
          lastExecutedTime: new Date().toISOString(),
          lastDurationMs: durationMs,
          pending: true,
        },
      ),
    [send],
  );

  const stop = useCallback(
    () =>
      void send(
        { action: 'stop' },
        {
          isRunning: false,
          hardwareHealthy: statusRef.current?.hardwareHealthy ?? true,
          lastExecutedTime: statusRef.current?.lastExecutedTime ?? null,
          lastDurationMs: statusRef.current?.lastDurationMs ?? null,
          pending: true,
        },
      ),
    [send],
  );

  return { status, error, sending, run, stop, refresh };
}
