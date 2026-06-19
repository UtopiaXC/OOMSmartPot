import type { DataSource } from './DataSource';
import { RestDataSource } from './RestDataSource';

export type { DataSource } from './DataSource';
export type { Metric, Duration, TimeRange, Query, Reading, Series, MetricMeta } from './types';
export { METRICS } from './types';
export { MockDataSource } from './MockDataSource';
export { RestDataSource } from './RestDataSource';

/**
 * Returns a DataSource for sensor data. Always the real REST adapter
 * (RestDataSource) pointed at config.SENSORS_BASE_URL — the live test server by
 * default. In tests, the MSW node server intercepts that URL; in the browser the
 * MSW worker deliberately does NOT mock the sensor host, so data is live.
 * Components should call this factory — never instantiate concrete classes.
 */
export function createDataSource(): DataSource {
  return new RestDataSource();
}
