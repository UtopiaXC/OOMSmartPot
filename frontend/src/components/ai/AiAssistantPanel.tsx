import { Card, ErrorState, Spinner, StatusDot } from '../common';
import { useAiAssistant } from '../../hooks/useAiAssistant';
import type { Suggestion, ScheduleItem } from '../../ai/types';

function formatTime(iso: string): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function priorityClasses(priority: string): string {
  switch (priority.toUpperCase()) {
    case 'HIGH':
      return 'bg-red-100 text-red-700';
    case 'MEDIUM':
      return 'bg-yellow-100 text-yellow-700';
    case 'LOW':
      return 'bg-green-100 text-green-700';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

function SuggestionCard({ s }: { s: Suggestion }) {
  return (
    <li className="rounded-lg border border-gray-200 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-gray-800">{s.title}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${priorityClasses(s.priority)}`}>
          {s.priority || 'INFO'}
        </span>
      </div>
      {s.category && <div className="mt-0.5 text-xs uppercase tracking-wide text-gray-400">{s.category}</div>}
      <p className="mt-1 text-sm text-gray-600">{s.description}</p>
    </li>
  );
}

function ScheduleRow({ item }: { item: ScheduleItem }) {
  return (
    <li className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 text-sm">
      <span className="text-gray-700">{formatTime(item.plannedTime)}</span>
      <span className="text-gray-500">{Math.round(item.durationMs / 1000)}s</span>
      <StatusDot status={item.executed ? 'ok' : 'idle'} label={item.executed ? 'Done' : 'Planned'} />
    </li>
  );
}

/**
 * AI Assistant panel — surfaces the backend's AI routine: its care suggestions
 * and upcoming watering plan, plus a button to trigger an analysis on demand.
 */
export function AiAssistantPanel() {
  const { suggestions, upcoming, loading, error, triggering, lastTrigger, refresh, trigger } =
    useAiAssistant();

  return (
    <Card title="AI Assistant">
      <div className="flex items-center justify-between mb-3">
        <StatusDot
          status={triggering ? 'warn' : error ? 'error' : 'ok'}
          label={
            triggering
              ? 'Analyzing…'
              : suggestions?.timestamp
                ? `Updated ${formatTime(suggestions.timestamp)}`
                : 'AI routine'
          }
        />
        <button
          type="button"
          onClick={trigger}
          disabled={triggering}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            triggering
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-purple-600 text-white hover:bg-purple-700'
          }`}
        >
          {triggering ? 'Running…' : '✨ Run analysis now'}
        </button>
      </div>

      {loading && !suggestions && !upcoming ? (
        <Spinner size="sm" label="Loading AI assistant…" />
      ) : error && !suggestions && !upcoming ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : (
        <div className="flex flex-col gap-4">
          {/* AI decision summary */}
          {upcoming?.aiDecisionSummary && (
            <div className="rounded-lg bg-purple-50 border border-purple-100 px-3 py-2 text-sm text-purple-800">
              {upcoming.aiDecisionSummary}
            </div>
          )}

          {lastTrigger && (
            <div className="text-xs text-gray-500">
              Last run {formatTime(lastTrigger.triggeredAt)} — {lastTrigger.status}
              {lastTrigger.schedulesUpdated ? ' · schedule updated' : ''}
            </div>
          )}

          {/* Suggestions */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
              Suggestions
            </h3>
            {suggestions && suggestions.suggestions.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {suggestions.suggestions.map((s) => (
                  <SuggestionCard key={s.id} s={s} />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400">No suggestions yet — run an analysis.</p>
            )}
          </div>

          {/* Upcoming schedule */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
              Upcoming watering
            </h3>
            {upcoming && upcoming.schedules.length > 0 ? (
              <ul className="flex flex-col gap-1.5">
                {upcoming.schedules.map((item) => (
                  <ScheduleRow key={item.id} item={item} />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400">No upcoming watering scheduled.</p>
            )}
          </div>

          {/* Inline error when we still have cached data */}
          {error && (suggestions || upcoming) && (
            <p className="text-sm text-red-600">{error}</p>
          )}
        </div>
      )}
    </Card>
  );
}
