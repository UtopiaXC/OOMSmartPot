import { config } from '../config/env';
import type { SystemConfigClient } from './SystemConfigClient';
import type { SystemConfig } from './types';

/**
 * REST implementation of SystemConfigClient, wired to the live API.
 *
 *   GET {API_BASE_URL}/system/config
 *       → { sensor_read_interval_seconds, ai_evaluation_cron, safety_max_duration_milliseconds }
 *   PUT {API_BASE_URL}/system/config
 *       Body: SystemConfigPayload (same fields, all optional) → 200 { status, message }
 *
 * The PUT response only carries a status/message, so `update` optimistically
 * returns the config it sent on success. Non-2xx responses throw.
 */
export class RestSystemConfig implements SystemConfigClient {
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = config.API_BASE_URL;
  }

  async get(): Promise<SystemConfig> {
    const res = await fetch(`${this.baseUrl}/system/config`);
    if (!res.ok) throw await toError(res, 'GET /system/config');
    const raw = (await res.json()) as Record<string, unknown>;
    return {
      sensorReadIntervalSeconds: num(raw['sensor_read_interval_seconds']),
      aiEvaluationCron: typeof raw['ai_evaluation_cron'] === 'string' ? raw['ai_evaluation_cron'] : '',
      safetyMaxDurationMs: num(raw['safety_max_duration_milliseconds']),
    };
  }

  async update(next: SystemConfig): Promise<SystemConfig> {
    const res = await fetch(`${this.baseUrl}/system/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sensor_read_interval_seconds: next.sensorReadIntervalSeconds,
        ai_evaluation_cron: next.aiEvaluationCron,
        safety_max_duration_milliseconds: next.safetyMaxDurationMs,
      }),
    });
    if (!res.ok) throw await toError(res, 'PUT /system/config');
    return next;
  }
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
