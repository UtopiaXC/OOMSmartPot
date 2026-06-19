/**
 * Types for the AI-assistant domain.
 *
 * The backend runs an AI routine (on a cron — see system config) that analyses
 * sensor data, produces care suggestions, and plans an upcoming watering
 * schedule. It can also be triggered on demand. The schedule history records
 * every watering that actually executed (manual or AI-driven).
 *
 * Fields are mapped from the snake_case API into camelCase here.
 */

export interface Suggestion {
  id: string;
  category: string;
  title: string;
  description: string;
  /** e.g. "HIGH" | "MEDIUM" | "LOW" (free-form from backend). */
  priority: string;
}

export interface AiSuggestions {
  /** ISO timestamp the suggestions were generated. */
  timestamp: string;
  suggestions: Suggestion[];
}

export interface ScheduleItem {
  id: string;
  /** ISO timestamp of the planned watering. */
  plannedTime: string;
  durationMs: number;
  executed: boolean;
}

export interface UpcomingSchedule {
  /** ISO timestamp the plan was generated. */
  generatedAt: string;
  /** Human-readable summary of the AI's latest decision. */
  aiDecisionSummary: string;
  schedules: ScheduleItem[];
}

export interface HistoryRecord {
  /** ISO timestamp the watering executed. */
  executedAt: string;
  /** e.g. "MANUAL" | "AI" | "SCHEDULED". */
  triggerType: string;
  durationMs: number;
  /** e.g. "SUCCESS" | "FAILED". */
  status: string;
  soilMoistureBefore: number;
  soilMoistureAfter: number;
}

export interface ScheduleHistory {
  totalRecords: number;
  records: HistoryRecord[];
}

export interface TriggerResult {
  triggeredAt: string;
  status: string;
  aiDecisionSummary: string;
  schedulesUpdated: boolean;
}
