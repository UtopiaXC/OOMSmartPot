import { Card, Spinner, ErrorState } from '../common';
import type { DataSource } from '../../data';
import type { Metric } from '../../data/types';
import { METRICS } from '../../data/types';
import { useQuery } from '../../hooks/useQuery';

interface ValueCardProps {
  metric: Metric;
  dataSource?: DataSource;
  /** Override polling interval. Defaults to config.POLL_INTERVAL_MS. */
  pollMs?: number;
}

export function ValueCard({ metric, dataSource, pollMs }: ValueCardProps) {
  const meta = METRICS[metric];
  const { data, error, loading, refresh } = useQuery(
    { metric, range: { kind: 'latest' } },
    { dataSource, pollMs }
  );

  const latest = data?.points[0];

  return (
    <Card className="flex-1 min-w-[140px]">
      {loading && !data ? (
        <div className="flex items-center justify-center py-4">
          <Spinner size="sm" />
        </div>
      ) : error ? (
        <ErrorState message={error.message} onRetry={refresh} />
      ) : (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-xl" role="img" aria-label={meta.label}>
              {meta.icon}
            </span>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {meta.label}
            </span>
          </div>
          {latest ? (
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-3xl font-bold text-gray-800" data-testid={`value-${metric}`}>
                {latest.value.toFixed(1)}
              </span>
              <span className="text-lg text-gray-500 font-medium">{meta.unit}</span>
            </div>
          ) : (
            <p className="text-sm text-gray-400 mt-1">No data</p>
          )}
        </div>
      )}
    </Card>
  );
}
