import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Spinner, ErrorState } from '../common';
import type { DataSource } from '../../data';
import type { Metric, TimeRange } from '../../data/types';
import { METRICS } from '../../data/types';
import { useQuery } from '../../hooks/useQuery';
import { config } from '../../config/env';

interface MetricChartProps {
  metric: Metric;
  range: TimeRange;
  dataSource?: DataSource;
}

function formatTick(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const age = now - d.getTime();
  // Short labels based on age
  if (age < 2 * 60 * 60_000) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit' });
}

export function MetricChart({ metric, range, dataSource }: MetricChartProps) {
  const meta = METRICS[metric];
  // Poll so the rolling history buffer (RestDataSource) fills the chart live.
  const { data, error, loading, refresh } = useQuery(
    { metric, range, aggregation: 'raw' },
    { dataSource, pollMs: config.POLL_INTERVAL_MS }
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error.message} onRetry={refresh} />;
  }

  if (!data || data.points.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">No data for this range.</p>;
  }

  const [yMin, yMax] = meta.range;
  const chartData = data.points.map((p) => ({ t: p.t, value: p.value }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="t"
          tickFormatter={formatTick}
          tick={{ fontSize: 11, fill: '#6b7280' }}
          minTickGap={40}
        />
        <YAxis
          domain={[yMin, yMax]}
          tick={{ fontSize: 11, fill: '#6b7280' }}
          tickFormatter={(v: number) => `${v}${meta.unit}`}
          width={56}
        />
        <Tooltip
          formatter={(value) => [`${String(value)} ${meta.unit}`, meta.label]}
          labelFormatter={(label) => new Date(String(label)).toLocaleString()}
          contentStyle={{ fontSize: 12 }}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#22c55e"
          strokeWidth={2}
          isAnimationActive={false}
          dot={{ r: 2, fill: '#22c55e' }}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
