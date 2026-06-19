import type {
  AiSuggestions,
  UpcomingSchedule,
  ScheduleHistory,
  TriggerResult,
} from './types';

/**
 * AI-assistant client interface. Components/hooks depend only on this contract,
 * never on the concrete RestAiClient (so tests can inject a fake).
 */
export interface AiClient {
  /** Latest AI care suggestions. */
  getSuggestions(): Promise<AiSuggestions>;
  /** The AI's upcoming planned watering schedule + decision summary. */
  getUpcoming(): Promise<UpcomingSchedule>;
  /** Paginated watering execution history. */
  getHistory(limit: number, offset: number): Promise<ScheduleHistory>;
  /** Trigger an AI analysis run on demand. */
  trigger(): Promise<TriggerResult>;
}
