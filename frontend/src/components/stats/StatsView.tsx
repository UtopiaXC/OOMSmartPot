import { useState } from 'react';
import { Card } from '../common';
import { ValueCard } from './ValueCard';
import { MetricChart } from './MetricChart';
import { RangePicker } from './RangePicker';
import { createDataSource, METRICS } from '../../data';
import type { DataSource, Metric, TimeRange } from '../../data';

const ALL_METRICS = Object.keys(METRICS) as Metric[];

// Single DataSource instance shared across the component tree.
const dataSource: DataSource = createDataSource();

export function StatsView() {
  const [selectedMetric, setSelectedMetric] = useState<Metric>('atmosphere.temperature');
  const [range, setRange] = useState<TimeRange>({ kind: 'window', last: { hours: 1 } });

  return (
    <div className="flex flex-col gap-4">
      {/* Row of current value cards */}
      <div className="flex flex-wrap gap-3">
        {ALL_METRICS.map((metric) => (
          <ValueCard key={metric} metric={metric} dataSource={dataSource} />
        ))}
      </div>

      {/* Chart panel */}
      <Card title="Sensor history">
        {/* Metric selector tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div
            className="inline-flex gap-1 bg-gray-100 rounded-lg p-1"
            role="group"
            aria-label="Select metric"
          >
            {ALL_METRICS.map((metric) => (
              <button
                key={metric}
                onClick={() => setSelectedMetric(metric)}
                aria-pressed={selectedMetric === metric}
                className={[
                  'px-3 py-1 text-sm font-medium rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500',
                  selectedMetric === metric
                    ? 'bg-white text-gray-800 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700',
                ].join(' ')}
              >
                <span className="mr-1">{METRICS[metric].icon}</span>
                {METRICS[metric].label}
              </button>
            ))}
          </div>
          <RangePicker value={range} onChange={setRange} />
        </div>

        <MetricChart
          key={`${selectedMetric}-${JSON.stringify(range)}`}
          metric={selectedMetric}
          range={range}
          dataSource={dataSource}
        />
      </Card>
    </div>
  );
}
