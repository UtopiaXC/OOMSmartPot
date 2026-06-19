import type { TimeRange } from '../../data/types';

interface RangeOption {
  label: string;
  range: TimeRange;
}

const RANGE_OPTIONS: RangeOption[] = [
  { label: 'Latest', range: { kind: 'latest' } },
  { label: 'Last 1h', range: { kind: 'window', last: { hours: 1 } } },
  { label: 'Last 24h', range: { kind: 'window', last: { hours: 24 } } },
];

interface RangePickerProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
}

function rangeKey(r: TimeRange): string {
  if (r.kind === 'latest') return 'latest';
  if (r.kind === 'window') {
    const { minutes = 0, hours = 0, days = 0 } = r.last;
    return `window:${days}d${hours}h${minutes}m`;
  }
  return `period:${r.from}:${r.to}`;
}

export function RangePicker({ value, onChange }: RangePickerProps) {
  const activeKey = rangeKey(value);

  return (
    <div className="inline-flex gap-1 bg-gray-100 rounded-lg p-1" role="group" aria-label="Time range">
      {RANGE_OPTIONS.map(({ label, range }) => {
        const key = rangeKey(range);
        const active = activeKey === key;
        return (
          <button
            key={key}
            onClick={() => onChange(range)}
            aria-pressed={active}
            className={[
              'px-3 py-1 text-sm font-medium rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500',
              active
                ? 'bg-white text-gray-800 shadow-sm'
                : 'text-gray-500 hover:text-gray-700',
            ].join(' ')}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
