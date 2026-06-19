import type { AiClient } from './AiClient';
import { RestAiClient } from './RestAiClient';

export type { AiClient } from './AiClient';
export type {
  Suggestion,
  AiSuggestions,
  ScheduleItem,
  UpcomingSchedule,
  HistoryRecord,
  ScheduleHistory,
  TriggerResult,
} from './types';

/** Factory for the app's AiClient (always the live RestAiClient; MSW mocks it in tests). */
export function createAiClient(): AiClient {
  return new RestAiClient();
}
