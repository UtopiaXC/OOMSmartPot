import { describe, it, expect, vi, afterEach } from 'vitest';
import { RestDataSource } from '../RestDataSource';
import type { Query } from '../types';

// Deterministic config: point the sensor base at a fake host.
vi.mock('../../config/env', () => ({
  config: {
    API_BASE_URL: '',
    SENSORS_BASE_URL: 'http://sensors.test/api/v1',
    USE_MOCKS: false,
    POLL_INTERVAL_MS: 5000,
    CAMERA_STREAM_URL: 'http://sensors.test/api/v1/camera/stream',
  },
}));

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

afterEach(() => {
  vi.clearAllMocks();
});

const CURRENT = {
  timestamp: '2026-06-16T06:00:00Z',
  temperature_celsius: 22.2,
  atmosphere_hpa: 1009.7,
  soil_moisture_percent: 52.4,
};

function mockOk(body: unknown) {
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => body });
}

describe('RestDataSource — /sensors/current adapter', () => {
  it('GETs the combined current endpoint', async () => {
    mockOk(CURRENT);
    const ds = new RestDataSource();
    await ds.query({ metric: 'atmosphere.temperature', range: { kind: 'latest' } });

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe('http://sensors.test/api/v1/sensors/current');
  });

  it('maps each metric to its payload field (latest → 1 point)', async () => {
    const ds = new RestDataSource();

    mockOk(CURRENT);
    const temp = await ds.query({ metric: 'atmosphere.temperature', range: { kind: 'latest' } });
    expect(temp.points).toHaveLength(1);
    expect(temp.points[0].value).toBe(22.2);
    expect(temp.unit).toBe('°C');

    // Within the dedupe TTL the same in-memory reading is reused (no 2nd fetch),
    // but every metric is still split out of that one payload.
    const press = await ds.query({ metric: 'atmosphere.pressure', range: { kind: 'latest' } });
    expect(press.points[0].value).toBe(1009.7);
    expect(press.unit).toBe('hPa');

    const soil = await ds.query({ metric: 'soil.moisture', range: { kind: 'latest' } });
    expect(soil.points[0].value).toBe(52.4);
    expect(soil.unit).toBe('%');

    // One network call shared across the three metric reads.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('accumulates a rolling buffer that window queries read from', async () => {
    mockOk(CURRENT);
    const ds = new RestDataSource();
    await ds.query({ metric: 'soil.moisture', range: { kind: 'latest' } });

    const series = await ds.query({
      metric: 'soil.moisture',
      range: { kind: 'window', last: { hours: 1 } },
    });
    expect(series.points.length).toBeGreaterThanOrEqual(1);
    expect(series.points[series.points.length - 1].value).toBe(52.4);
  });

  it('throws a clear error on non-2xx', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503, statusText: 'Service Unavailable' });
    const ds = new RestDataSource();
    const q: Query = { metric: 'atmosphere.temperature', range: { kind: 'latest' } };
    await expect(ds.query(q)).rejects.toThrow('503');
  });
});
