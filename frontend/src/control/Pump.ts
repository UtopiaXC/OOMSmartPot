import type { PumpStatus, PumpCommand } from './types';

/**
 * Pump interface. Components/hooks depend only on this contract, never on a
 * concrete implementation (RestPump in prod/dev, MockPump in unit tests).
 */
export interface Pump {
  /** Fetch the current pump status from the backend. */
  getStatus(): Promise<PumpStatus>;
  /** Send a run/stop command; resolves with the resulting status. */
  send(cmd: PumpCommand): Promise<PumpStatus>;
}
