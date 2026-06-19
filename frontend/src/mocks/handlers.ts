import { sensorHandlers } from './sensorHandlers';
import { pumpHandlers } from './pumpHandlers';
import { aiHandlers } from './aiHandlers';
import { systemHandlers } from './systemHandlers';

/**
 * Aggregates all MSW handlers from every feature layer.
 * Add new handler arrays here as new feature agents add them.
 */
export const handlers = [...sensorHandlers, ...pumpHandlers, ...aiHandlers, ...systemHandlers];
