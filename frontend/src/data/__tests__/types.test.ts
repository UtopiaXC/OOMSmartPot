import { describe, it, expect } from 'vitest';
import { METRICS } from '../types';
import type { Metric } from '../types';

const METRIC_KEYS: Metric[] = [
  'atmosphere.temperature',
  'atmosphere.pressure',
  'soil.moisture',
];

describe('METRICS registry', () => {
  it('contains all metrics', () => {
    for (const k of METRIC_KEYS) {
      expect(METRICS).toHaveProperty(k);
    }
  });

  it('each metric has label, unit, icon, and a valid range', () => {
    for (const k of METRIC_KEYS) {
      const m = METRICS[k];
      expect(typeof m.label).toBe('string');
      expect(m.label.length).toBeGreaterThan(0);
      expect(typeof m.unit).toBe('string');
      expect(m.unit.length).toBeGreaterThan(0);
      expect(typeof m.icon).toBe('string');
      expect(Array.isArray(m.range)).toBe(true);
      expect(m.range).toHaveLength(2);
      expect(m.range[0]).toBeLessThan(m.range[1]);
    }
  });

  it('temperature range is 15–30 °C', () => {
    expect(METRICS['atmosphere.temperature'].range).toEqual([15, 30]);
    expect(METRICS['atmosphere.temperature'].unit).toBe('°C');
  });

  it('pressure range is 990–1030 hPa', () => {
    expect(METRICS['atmosphere.pressure'].range).toEqual([990, 1030]);
    expect(METRICS['atmosphere.pressure'].unit).toBe('hPa');
  });

  it('soil moisture range is 10–60 %', () => {
    expect(METRICS['soil.moisture'].range).toEqual([10, 60]);
    expect(METRICS['soil.moisture'].unit).toBe('%');
  });
});
