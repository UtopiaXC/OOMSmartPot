import { Card, ErrorState, Spinner } from '../common';
import { useScheduleHistory } from '../../hooks/useScheduleHistory';
import type { HistoryRecord } from '../../ai/types';

function formatTime(iso: string): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function statusClasses(status: string): string {
  switch (status.toUpperCase()) {
    case 'SUCCESS':
      return 'bg-green-100 text-green-700';
    case 'FAILED':
    case 'ERROR':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

function Row({ r }: { r: HistoryRecord }) {
  return (
    <tr className="border-t border-gray-100">
      <td className="py-2 pr-3 text-gray-700 whitespace-nowrap">{formatTime(r.executedAt)}</td>
      <td className="py-2 pr-3 text-gray-500">{r.triggerType}</td>
      <td className="py-2 pr-3 text-gray-500 text-right">{Math.round(r.durationMs / 1000)}s</td>
      <td className="py-2 pr-3 text-gray-500 text-right whitespace-nowrap">
        {r.soilMoistureBefore.toFixed(0)}% → {r.soilMoistureAfter.toFixed(0)}%
      </td>
      <td className="py-2 text-right">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClasses(r.status)}`}>
          {r.status}
        </span>
      </td>
    </tr>
  );
}

/**
 * Watering history table (GET /schedule/history) with limit/offset pagination.
 */
export function WateringHistory() {
  const { history, loading, error, offset, limit, hasMore, nextPage, prevPage, refresh } =
    useScheduleHistory(10);

  const total = history?.totalRecords ?? 0;
  const shownFrom = total === 0 ? 0 : offset + 1;
  const shownTo = Math.min(offset + limit, total);

  return (
    <Card title="Watering History">
      {loading && !history ? (
        <Spinner size="sm" label="Loading history…" />
      ) : error && !history ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : history && history.records.length > 0 ? (
        <div className="flex flex-col gap-3">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
                  <th className="py-1 pr-3 font-medium">When</th>
                  <th className="py-1 pr-3 font-medium">Trigger</th>
                  <th className="py-1 pr-3 font-medium text-right">Duration</th>
                  <th className="py-1 pr-3 font-medium text-right">Soil</th>
                  <th className="py-1 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {history.records.map((r, i) => (
                  <Row key={`${r.executedAt}-${i}`} r={r} />
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>
              {shownFrom}–{shownTo} of {total}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={prevPage}
                disabled={offset === 0 || loading}
                className="rounded-md border border-gray-300 px-2 py-1 disabled:opacity-40 hover:bg-gray-50"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={nextPage}
                disabled={!hasMore || loading}
                className="rounded-md border border-gray-300 px-2 py-1 disabled:opacity-40 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-400">No watering events recorded yet.</p>
      )}
    </Card>
  );
}
