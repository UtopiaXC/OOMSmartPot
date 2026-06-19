import type { SystemConfigClient } from './SystemConfigClient';
import { RestSystemConfig } from './RestSystemConfig';

export type { SystemConfigClient } from './SystemConfigClient';
export type { SystemConfig } from './types';

/** Factory for the app's SystemConfigClient (live RestSystemConfig; MSW mocks it in tests). */
export function createSystemConfigClient(): SystemConfigClient {
  return new RestSystemConfig();
}
