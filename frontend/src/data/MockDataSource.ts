import type { DataSource } from './DataSource';
import type { Metric, Query, Reading, Series, TimeRange } from './types';
import { METRICS } from './types';

// ---------------------------------------------------------------------------
// Deterministic pseudo-random number generator (mulberry32, seeded)
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let s = seed;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Simple string → numeric seed. */
function strSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (Math.imul(h, 0x01000193) >>> 0);
  }
  return h;
}

// ---------------------------------------------------------------------------
// Duration helpers
// ---------------------------------------------------------------------------

function durationMs(d: { minutes?: number; hours?: number; days?: number }): number {
  return (
    (d.minutes ?? 0) * 60_000 +
    (d.hours ?? 0) * 3_600_000 +
    (d.days ?? 0) * 86_400_000
  );
}

function resolveRange(range: TimeRange): { fromMs: number; toMs: number } {
  const now = Date.now();
  if (range.kind === 'latest') {
    return { fromMs: now, toMs: now };
  }
  if (range.kind === 'window') {
    return { fromMs: now - durationMs(range.last), toMs: now };
  }
  return { fromMs: new Date(range.from).getTime(), toMs: new Date(range.to).getTime() };
}

/** Number of evenly-spaced sample points for the resolved range span. */
function pointCount(spanMs: number): number {
  if (spanMs <= 0) return 1;
  if (spanMs <= 60 * 60_000) return 12;          // ≤1 h  → every 5 min
  if (spanMs <= 24 * 60 * 60_000) return 24;     // ≤1 d  → every hour
  return Math.min(30, Math.ceil(spanMs / (24 * 60 * 60_000))); // multi-day → per day
}

// ---------------------------------------------------------------------------
// Core generator
// ---------------------------------------------------------------------------

function generateSeries(metric: Metric, fromMs: number, toMs: number, seed: number): Reading[] {
  const meta = METRICS[metric];
  const [lo, hi] = meta.range;
  const mid = (lo + hi) / 2;
  const amplitude = (hi - lo) / 4; // sine swing ±amplitude around mid
  const noise = (hi - lo) / 10;    // small random noise

  const spanMs = Math.max(toMs - fromMs, 0);
  const count = fromMs === toMs ? 1 : pointCount(spanMs);
  const rng = mulberry32(seed);

  const readings: Reading[] = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? toMs : fromMs + (spanMs * i) / (count - 1);
    // Slow sine wave: period ~24 h, phase from seed
    const phase = rng() * Math.PI * 2;
    const sine = Math.sin((2 * Math.PI * t) / (24 * 3_600_000) + phase);
    const randNoise = (rng() - 0.5) * 2 * noise;
    const value = Number((mid + amplitude * sine + randNoise).toFixed(2));
    readings.push({ t: new Date(t).toISOString(), value, unit: meta.unit });
  }

  return readings;
}

// ---------------------------------------------------------------------------
// DataSource implementation
// ---------------------------------------------------------------------------

export class MockDataSource implements DataSource {
  async query(q: Query): Promise<Series> {
    const { fromMs, toMs } = resolveRange(q.range);
    const seed = strSeed(`${q.metric}:${fromMs}:${toMs}`);
    const points = generateSeries(q.metric, fromMs, toMs, seed);

    // Handle aggregation over the generated points
    const agg = q.aggregation ?? 'raw';
    let finalPoints = points;
    if (agg !== 'raw' && points.length > 1) {
      const values = points.map((p) => p.value);
      let aValue: number;
      if (agg === 'avg') aValue = values.reduce((a, b) => a + b, 0) / values.length;
      else if (agg === 'min') aValue = Math.min(...values);
      else aValue = Math.max(...values);

      finalPoints = [
        {
          t: new Date(toMs).toISOString(),
          value: Number(aValue.toFixed(2)),
          unit: METRICS[q.metric].unit,
        },
      ];
    }

    return {
      metric: q.metric,
      unit: METRICS[q.metric].unit,
      points: finalPoints,
    };
  }
}
