// Metrics exposed by the OOMSmartPot sensor API (GET /sensors/current).
// Note: the backend reports temperature, atmospheric pressure and soil moisture
// only — there is no humidity sensor.
export type Metric =
  | 'atmosphere.temperature'
  | 'atmosphere.pressure'
  | 'soil.moisture';

export type Duration = { minutes?: number; hours?: number; days?: number };

export type TimeRange =
  | { kind: 'latest' }
  | { kind: 'window'; last: Duration }
  | { kind: 'period'; from: string; to: string };

export interface Query {
  metric: Metric;
  range: TimeRange;
  aggregation?: 'raw' | 'avg' | 'min' | 'max';
}

export interface Reading {
  t: string;   // ISO timestamp
  value: number;
  unit: string;
}

export interface Series {
  metric: Metric;
  unit: string;
  points: Reading[];
}

// ---------------------------------------------------------------------------
// METRICS registry — display metadata used by UI + mock generation
// ---------------------------------------------------------------------------

export interface MetricMeta {
  label: string;
  unit: string;
  icon: string;
  /** Sensible value range [min, max] — used for chart axis + mock generation */
  range: [number, number];
}

export const METRICS: Record<Metric, MetricMeta> = {
  'atmosphere.temperature': {
    label: 'Temperature',
    unit: '°C',
    icon: '🌡️',
    range: [15, 30],
  },
  'atmosphere.pressure': {
    label: 'Pressure',
    unit: 'hPa',
    icon: '🔵',
    range: [990, 1030],
  },
  'soil.moisture': {
    label: 'Soil Moisture',
    unit: '%',
    icon: '🌱',
    range: [10, 60],
  },
};
