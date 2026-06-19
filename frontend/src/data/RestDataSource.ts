import { config } from '../config/env';
import type { DataSource } from './DataSource';
import type { Metric, Query, Reading, Series, TimeRange } from './types';
import { METRICS } from './types';

/**
 * Payload of GET /sensors/current on the OOMSmartPot backend.
 *
 * The deployed test server (https://test.utopiaxc.com) returns this subset.
 * The repo mock additionally includes `light_intensity_lux` and
 * `water_tank_level_percent`, which the live server currently omits — add
 * matching Metric entries + METRIC_FIELD mappings if/when they appear.
 */
interface CurrentReading {
  timestamp: string;
  temperature_celsius: number;
  atmosphere_hpa: number;
  soil_moisture_percent: number;
}

/** Maps each UI Metric to its field in the /sensors/current payload. */
const METRIC_FIELD: Record<Metric, keyof Omit<CurrentReading, 'timestamp'>> = {
  'atmosphere.temperature': 'temperature_celsius',
  'atmosphere.pressure': 'atmosphere_hpa',
  'soil.moisture': 'soil_moisture_percent',
};

const BUFFER_CAP = 1000;
/** Collapse the simultaneous fetches from all value cards + the chart into one. */
const DEDUPE_TTL_MS = 2000;

function durationMs(d: { minutes?: number; hours?: number; days?: number }): number {
  return (d.minutes ?? 0) * 60_000 + (d.hours ?? 0) * 3_600_000 + (d.days ?? 0) * 86_400_000;
}

function resolveRange(range: TimeRange): { fromMs: number; toMs: number } {
  const now = Date.now();
  if (range.kind === 'window') return { fromMs: now - durationMs(range.last), toMs: now };
  if (range.kind === 'period') {
    return { fromMs: new Date(range.from).getTime(), toMs: new Date(range.to).getTime() };
  }
  return { fromMs: now, toMs: now };
}

/**
 * RestDataSource — adapter for the real OOMSmartPot REST API.
 *
 * The backend exposes a single combined "current" reading (no per-metric and no
 * historical endpoint), so this adapter:
 *   - GET {SENSORS_BASE_URL}/sensors/current,
 *   - splits the combined payload into per-metric Readings,
 *   - keeps an in-memory rolling buffer per metric (stamped with client receive
 *     time, so window/period filtering is immune to server clock skew). The
 *     history chart fills in live as polling accumulates points,
 *   - de-dupes near-simultaneous fetches via a short TTL cache.
 *
 * When a real historical endpoint appears, swap the buffer read in `query()`
 * for a direct request — components/hooks are unaffected.
 *
 * The buffer is per-instance: StatsView creates ONE DataSource and shares it
 * across every card + the chart, so they all feed/read the same history.
 */
export class RestDataSource implements DataSource {
  private readonly buffers = new Map<Metric, Reading[]>();
  private inFlight: Promise<CurrentReading> | null = null;
  private lastReading: CurrentReading | null = null;
  private lastFetchAt = 0;

  private async fetchCurrent(): Promise<CurrentReading> {
    const now = Date.now();
    if (this.lastReading && now - this.lastFetchAt < DEDUPE_TTL_MS) {
      return this.lastReading;
    }
    if (this.inFlight) return this.inFlight;

    const url = `${config.SENSORS_BASE_URL}/sensors/current`;
    this.inFlight = fetch(url)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Sensor API error: ${res.status} ${res.statusText} (${url})`);
        }
        const json = (await res.json()) as CurrentReading;
        this.lastReading = json;
        this.lastFetchAt = Date.now();
        this.appendToBuffers(json);
        return json;
      })
      .finally(() => {
        this.inFlight = null;
      });
    return this.inFlight;
  }

  private appendToBuffers(reading: CurrentReading): void {
    // Stamp with client receive time so the rolling-window chart always
    // includes freshly received points regardless of server clock.
    const t = new Date().toISOString();
    for (const metric of Object.keys(METRIC_FIELD) as Metric[]) {
      const value = reading[METRIC_FIELD[metric]];
      if (typeof value !== 'number') continue;
      const buf = this.buffers.get(metric) ?? [];
      buf.push({ t, value, unit: METRICS[metric].unit });
      if (buf.length > BUFFER_CAP) buf.shift();
      this.buffers.set(metric, buf);
    }
  }

  async query(q: Query): Promise<Series> {
    await this.fetchCurrent();
    const unit = METRICS[q.metric].unit;
    const buf = this.buffers.get(q.metric) ?? [];

    let points: Reading[];
    if (q.range.kind === 'latest') {
      points = buf.length ? [buf[buf.length - 1]] : [];
    } else {
      const { fromMs, toMs } = resolveRange(q.range);
      points = buf.filter((p) => {
        const ts = new Date(p.t).getTime();
        return ts >= fromMs && ts <= toMs;
      });
    }

    return { metric: q.metric, unit, points };
  }
}
