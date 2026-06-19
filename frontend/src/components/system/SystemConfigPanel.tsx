import { useEffect, useState } from 'react';
import { Card, ErrorState, Spinner, StatusDot } from '../common';
import { useSystemConfig } from '../../hooks/useSystemConfig';
import type { SystemConfig } from '../../system/types';

/**
 * System configuration panel — shows the backend config (GET) and lets the user
 * edit + save it (PUT): how often sensors are read, the AI routine's cron, and
 * the pump safety cap.
 */
export function SystemConfigPanel() {
  const { config, loading, error, saving, saved, refresh, save } = useSystemConfig();

  // Local form state, seeded from the loaded config.
  const [form, setForm] = useState<SystemConfig | null>(null);
  useEffect(() => {
    if (config) setForm(config);
  }, [config]);

  if (loading && !config) {
    return (
      <Card title="System Configuration">
        <Spinner size="sm" label="Loading configuration…" />
      </Card>
    );
  }

  if (error && !config) {
    return (
      <Card title="System Configuration">
        <ErrorState message={error} onRetry={refresh} />
      </Card>
    );
  }

  const current = form ?? config;
  if (!current) return null;

  const dirty =
    !!config &&
    (current.sensorReadIntervalSeconds !== config.sensorReadIntervalSeconds ||
      current.aiEvaluationCron !== config.aiEvaluationCron ||
      current.safetyMaxDurationMs !== config.safetyMaxDurationMs);

  const set = (patch: Partial<SystemConfig>) => setForm({ ...current, ...patch });

  return (
    <Card title="System Configuration">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save(current);
        }}
      >
        {/* Sensor read interval */}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-500">Sensor read interval (seconds)</span>
          <input
            type="number"
            min={1}
            value={current.sensorReadIntervalSeconds}
            onChange={(e) => set({ sensorReadIntervalSeconds: Number(e.target.value) })}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-xs text-gray-400">How often the rig samples its sensors.</span>
        </label>

        {/* AI evaluation cron */}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-500">AI evaluation schedule (cron)</span>
          <input
            type="text"
            value={current.aiEvaluationCron}
            onChange={(e) => set({ aiEvaluationCron: e.target.value })}
            placeholder="0 8,18 * * *"
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-xs text-gray-400">
            How often the AI routine checks the data, as a cron expression.
          </span>
        </label>

        {/* Safety max duration */}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-500">Pump safety cap (seconds)</span>
          <input
            type="number"
            min={1}
            value={Math.round(current.safetyMaxDurationMs / 1000)}
            onChange={(e) => set({ safetyMaxDurationMs: Number(e.target.value) * 1000 })}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-xs text-gray-400">Hard limit on any single pump run.</span>
        </label>

        <div className="flex items-center justify-between">
          <div>
            {saved && !dirty && <StatusDot status="ok" label="Saved" />}
            {dirty && <StatusDot status="warn" label="Unsaved changes" />}
            {error && config && <span className="text-sm text-red-600">{error}</span>}
          </div>
          <button
            type="submit"
            disabled={saving || !dirty}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              saving || !dirty
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </Card>
  );
}
