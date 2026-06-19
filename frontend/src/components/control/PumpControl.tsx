import { StatusDot, ErrorState, Spinner } from '../common';
import type { PumpStatus } from '../../control/types';

interface PumpControlProps {
  status: PumpStatus | null;
  error: string | null;
  sending: boolean;
  /** Selected run duration in seconds. */
  durationSec: number;
  onDurationChange: (sec: number) => void;
  onRun: () => void;
  onStop: () => void;
  onRetry: () => void;
}

const DURATION_OPTIONS = [2, 5, 10, 30] as const;

function formatTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/**
 * Presentational pump control panel for the momentary run/stop pump.
 * Receives all state from the parent (ControlPanel) via props.
 */
export function PumpControl({
  status,
  error,
  sending,
  durationSec,
  onDurationChange,
  onRun,
  onStop,
  onRetry,
}: PumpControlProps) {
  // Initial loading
  if (!status && !error) {
    return <Spinner size="sm" label="Loading pump status…" />;
  }

  if (error && !status) {
    return <ErrorState message={error} onRetry={onRetry} />;
  }

  const isRunning = status?.isRunning ?? false;
  const isPending = status?.pending ?? false;
  const healthy = status?.hardwareHealthy ?? true;

  const dotStatus = !healthy ? 'error' : isPending ? 'warn' : isRunning ? 'ok' : 'idle';
  const dotLabel = !healthy
    ? 'Hardware fault'
    : isPending
      ? 'Applying…'
      : isRunning
        ? 'Running (watering)'
        : 'Idle';

  return (
    <div className="flex flex-col gap-4">
      {/* Status row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusDot status={dotStatus} label={dotLabel} />
          {isPending && <Spinner size="sm" label="Applying command…" />}
        </div>
        {status?.lastExecutedTime && (
          <span className="text-xs text-gray-400">
            Last run {formatTime(status.lastExecutedTime)}
            {status.lastDurationMs != null && ` · ${Math.round(status.lastDurationMs / 1000)}s`}
          </span>
        )}
      </div>

      {/* Running callout — makes it unmistakable whether water is flowing */}
      <div
        className={`rounded-lg px-4 py-3 text-sm font-medium border ${
          isRunning
            ? 'bg-blue-50 border-blue-200 text-blue-800'
            : 'bg-gray-50 border-gray-200 text-gray-600'
        }`}
        role="status"
        aria-live="polite"
      >
        {isPending
          ? 'Applying command…'
          : isRunning
            ? 'Pump is RUNNING — water is flowing'
            : 'Pump is idle — no water flowing'}
      </div>

      {!healthy && (
        <div className="rounded-lg px-4 py-2 text-xs font-medium border bg-red-50 border-red-200 text-red-700">
          Pump hardware reports a fault — commands may not take effect.
        </div>
      )}

      {/* Duration selector */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-gray-500">Run duration</label>
        <div className="flex gap-2" role="group" aria-label="Run duration">
          {DURATION_OPTIONS.map((sec) => {
            const selected = sec === durationSec;
            return (
              <button
                key={sec}
                type="button"
                onClick={() => onDurationChange(sec)}
                disabled={sending}
                aria-pressed={selected}
                className={`flex-1 rounded-md px-2 py-1.5 text-sm font-medium border transition-colors ${
                  selected
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                } ${sending ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {sec}s
              </button>
            );
          })}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          onClick={onRun}
          disabled={sending || isPending || isRunning}
          aria-label="Water now"
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1
            ${
              sending || isPending || isRunning
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 focus:ring-blue-500'
            }`}
        >
          💧 Water now ({durationSec}s)
        </button>

        <button
          onClick={onStop}
          disabled={sending || isPending || !isRunning}
          aria-label="Stop pump"
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1
            ${
              sending || isPending || !isRunning
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gray-700 text-white hover:bg-gray-800 active:bg-gray-900 focus:ring-gray-500'
            }`}
        >
          Stop
        </button>
      </div>

      {/* Inline error (status already loaded, mid-operation error) */}
      {error && status && <ErrorState message={error} onRetry={onRetry} />}
    </div>
  );
}
