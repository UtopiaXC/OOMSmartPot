import type { SystemConfig } from './types';

/**
 * System-config client interface. Components/hooks depend only on this contract.
 */
export interface SystemConfigClient {
  /** Read the current backend configuration. */
  get(): Promise<SystemConfig>;
  /** Persist updated configuration (PUT). Returns the saved config. */
  update(next: SystemConfig): Promise<SystemConfig>;
}
