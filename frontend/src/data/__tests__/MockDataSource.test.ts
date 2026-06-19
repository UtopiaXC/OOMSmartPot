import { describe, it, expect } from 'vitest';
import { MockDataSource } from '../MockDataSource';
import type { Query } from '../types';
import { METRICS } from '../types';

const mock = new MockDataSource();

describe('MockDataSource', () => {
  it('returns a series for latest', async () => {
    const q: Query = { metric: 'atmosphere.temperature', range: { kind: 'latest' } };
    const s = await mock.query(q);
    expect(s.metric).toBe('atmosphere.temperature');
    expect(s.unit).toBe(METRICS['atmosphere.temperature'].unit);
    expect(s.points).toHaveLength(1);
    expect(typeof s.points[0].value).toBe('number');
    expect(typeof s.points[0].t).toBe('string');
    expect(new Date(s.points[0].t).getTime()).not.toBeNaN();
  });

  it('latest value is within the expected range', async () => {
    for (const metric of Object.keys(METRICS) as (keyof typeof METRICS)[]) {
      const s = await mock.query({ metric, range: { kind: 'latest' } });
      const [lo, hi] = METRICS[metric].range;
      // Allow slight overshoot due to noise (±20%)
      const tolerance = (hi - lo) * 0.2;
      expect(s.points[0].value).toBeGreaterThanOrEqual(lo - tolerance);
      expect(s.points[0].value).toBeLessThanOrEqual(hi + tolerance);
    }
  });

  it('window range returns multiple points', async () => {
    const q: Query = {
      metric: 'soil.moisture',
      range: { kind: 'window', last: { hours: 1 } },
    };
    const s = await mock.query(q);
    expect(s.points.length).toBeGreaterThan(1);
    // Points should be ordered (ascending time)
    for (let i = 1; i < s.points.length; i++) {
      expect(new Date(s.points[i].t).getTime()).toBeGreaterThanOrEqual(
        new Date(s.points[i - 1].t).getTime()
      );
    }
  });

  it('24h window returns ≥ 12 points', async () => {
    const q: Query = {
      metric: 'atmosphere.pressure',
      range: { kind: 'window', last: { hours: 24 } },
    };
    const s = await mock.query(q);
    expect(s.points.length).toBeGreaterThanOrEqual(12);
  });

  it('period range returns points spanning from→to', async () => {
    const from = new Date(Date.now() - 2 * 3_600_000).toISOString();
    const to = new Date().toISOString();
    const q: Query = {
      metric: 'soil.moisture',
      range: { kind: 'period', from, to },
    };
    const s = await mock.query(q);
    expect(s.points.length).toBeGreaterThan(0);
    const first = new Date(s.points[0].t).getTime();
    const last = new Date(s.points[s.points.length - 1].t).getTime();
    expect(first).toBeGreaterThanOrEqual(new Date(from).getTime() - 1);
    expect(last).toBeLessThanOrEqual(new Date(to).getTime() + 1);
  });

  it('is deterministic with the same query', async () => {
    // Two calls with slightly different "now" will not be identical (seed includes timestamps),
    // but for a fixed period they should be.
    const from = '2024-01-01T00:00:00.000Z';
    const to = '2024-01-01T02:00:00.000Z';
    const qFixed: Query = { metric: 'atmosphere.temperature', range: { kind: 'period', from, to } };
    const s1 = await mock.query(qFixed);
    const s2 = await mock.query(qFixed);
    expect(s1.points).toEqual(s2.points);
  });

  it('aggregation avg returns a single point', async () => {
    const s = await mock.query({
      metric: 'atmosphere.pressure',
      range: { kind: 'window', last: { hours: 1 } },
      aggregation: 'avg',
    });
    expect(s.points).toHaveLength(1);
  });

  it('all metrics work', async () => {
    for (const metric of Object.keys(METRICS) as (keyof typeof METRICS)[]) {
      const s = await mock.query({ metric, range: { kind: 'latest' } });
      expect(s.metric).toBe(metric);
      expect(s.unit).toBe(METRICS[metric].unit);
    }
  });
});
