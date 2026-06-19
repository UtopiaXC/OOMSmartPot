import { config } from '../config/env';
import type { AiClient } from './AiClient';
import type {
  AiSuggestions,
  UpcomingSchedule,
  ScheduleHistory,
  TriggerResult,
} from './types';

/**
 * REST implementation of AiClient, wired to the live OOMSmartPot API.
 *
 *   GET  {API_BASE_URL}/ai/suggestions
 *        → { timestamp, suggestions: [{ suggestion_id, category, title, description, priority }] }
 *   POST {API_BASE_URL}/ai/trigger
 *        → { triggered_at, status, ai_decision_summary, schedules_updated }
 *   GET  {API_BASE_URL}/schedule/upcoming
 *        → { generated_at, ai_decision_summary, schedules: [{ schedule_id, planned_time, duration_milliseconds, executed }] }
 *   GET  {API_BASE_URL}/schedule/history?limit&offset
 *        → { total_records, records: [{ executed_at, trigger_type, duration_milliseconds, status, soil_moisture_before, soil_moisture_after }] }
 *
 * Non-2xx responses throw, surfacing the body's `message`/`detail` if present.
 */
export class RestAiClient implements AiClient {
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = config.API_BASE_URL;
  }

  async getSuggestions(): Promise<AiSuggestions> {
    const raw = await getJson(`${this.baseUrl}/ai/suggestions`, 'GET /ai/suggestions');
    return {
      timestamp: str(raw['timestamp']),
      suggestions: asArray(raw['suggestions']).map((s) => ({
        id: str(s['suggestion_id']),
        category: str(s['category']),
        title: str(s['title']),
        description: str(s['description']),
        priority: str(s['priority']),
      })),
    };
  }

  async getUpcoming(): Promise<UpcomingSchedule> {
    const raw = await getJson(`${this.baseUrl}/schedule/upcoming`, 'GET /schedule/upcoming');
    return {
      generatedAt: str(raw['generated_at']),
      aiDecisionSummary: str(raw['ai_decision_summary']),
      schedules: asArray(raw['schedules']).map((s) => ({
        id: str(s['schedule_id']),
        plannedTime: str(s['planned_time']),
        durationMs: num(s['duration_milliseconds']),
        executed: s['executed'] === true,
      })),
    };
  }

  async getHistory(limit: number, offset: number): Promise<ScheduleHistory> {
    const url = `${this.baseUrl}/schedule/history?limit=${limit}&offset=${offset}`;
    const raw = await getJson(url, 'GET /schedule/history');
    return {
      totalRecords: num(raw['total_records']),
      records: asArray(raw['records']).map((r) => ({
        executedAt: str(r['executed_at']),
        triggerType: str(r['trigger_type']),
        durationMs: num(r['duration_milliseconds']),
        status: str(r['status']),
        soilMoistureBefore: num(r['soil_moisture_before']),
        soilMoistureAfter: num(r['soil_moisture_after']),
      })),
    };
  }

  async trigger(): Promise<TriggerResult> {
    const res = await fetch(`${this.baseUrl}/ai/trigger`, { method: 'POST' });
    if (!res.ok) throw await toError(res, 'POST /ai/trigger');
    const raw = (await res.json()) as Record<string, unknown>;
    return {
      triggeredAt: str(raw['triggered_at']),
      status: str(raw['status']),
      aiDecisionSummary: str(raw['ai_decision_summary']),
      schedulesUpdated: raw['schedules_updated'] === true,
    };
  }
}

async function getJson(url: string, label: string): Promise<Record<string, unknown>> {
  const res = await fetch(url);
  if (!res.ok) throw await toError(res, label);
  return (await res.json()) as Record<string, unknown>;
}

function asArray(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
}
function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}
function num(v: unknown): number {
  return typeof v === 'number' ? v : 0;
}

async function toError(res: Response, label: string): Promise<Error> {
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const msg =
    typeof body['message'] === 'string'
      ? body['message']
      : typeof body['detail'] === 'string'
        ? body['detail']
        : res.statusText;
  return new Error(`${label} failed (${res.status}): ${msg}`);
}
