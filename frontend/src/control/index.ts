import type { Pump } from './Pump';
import { RestPump } from './RestPump';

export type { Pump } from './Pump';
export type { PumpStatus, PumpCommand } from './types';

/**
 * Factory for the app's Pump implementation.
 *
 * Always returns RestPump — it talks to the real OOMSmartPot pump API at
 * `config.API_BASE_URL`. In Vitest, MSW (pumpHandlers.ts) intercepts those
 * fetches so tests run network-free; MockPump is reserved for pure unit tests
 * that inject it directly. Components/hooks always depend on the Pump interface.
 */
export function createPump(): Pump {
  return new RestPump();
}
