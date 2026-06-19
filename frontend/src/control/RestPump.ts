import { config } from '../config/env';
import type { Pump } from './Pump';
import type { PumpStatus, PumpCommand } from './types';

/**
 * REST implementation of the Pump interface, wired to the real OOMSmartPot API.
 *
 * Endpoint contract (source of truth: backend/mock/mock.php):
 *
 *   GET  {API_BASE_URL}/pump/status
 *     → 200 { is_running, last_executed_time, last_duration_milliseconds, hardware_healthy }
 *
 *   POST {API_BASE_URL}/pump/action
 *     Body: { action: "run", duration_milliseconds: N }
 *     → 202 { status, message, estimated_end_time }
 *
 *   POST {API_BASE_URL}/pump/stop
 *     → 200 { status: "stopped", message }
 *
 * The action/stop responses don't carry full status, so after a successful
 * command we re-fetch `/pump/status` for the canonical state (and attach the
 * run's `estimated_end_time` when present). Non-2xx responses throw, surfacing
 * the body's `message` if any.
 */
export class RestPump implements Pump {
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = config.API_BASE_URL;
  }

  async getStatus(): Promise<PumpStatus> {
    const res = await fetch(`${this.baseUrl}/pump/status`);
    if (!res.ok) throw await toError(res, 'GET /pump/status');
    const raw = (await res.json()) as Record<string, unknown>;
    return mapStatus(raw);
  }

  async send(cmd: PumpCommand): Promise<PumpStatus> {
    if (cmd.action === 'run') {
      const res = await fetch(`${this.baseUrl}/pump/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run', duration_milliseconds: cmd.durationMs }),
      });
      if (!res.ok) throw await toError(res, 'POST /pump/action');
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      const status = await this.getStatus();
      return {
        ...status,
        estimatedEndTime:
          typeof body['estimated_end_time'] === 'string' ? body['estimated_end_time'] : null,
      };
    }

    const res = await fetch(`${this.baseUrl}/pump/stop`, { method: 'POST' });
    if (!res.ok) throw await toError(res, 'POST /pump/stop');
    return this.getStatus();
  }
}

/** Map the snake_case API payload to our PumpStatus shape. */
function mapStatus(raw: Record<string, unknown>): PumpStatus {
  return {
    isRunning: raw['is_running'] === true,
    hardwareHealthy: raw['hardware_healthy'] === true,
    lastExecutedTime:
      typeof raw['last_executed_time'] === 'string' ? raw['last_executed_time'] : null,
    lastDurationMs:
      typeof raw['last_duration_milliseconds'] === 'number'
        ? raw['last_duration_milliseconds']
        : null,
  };
}

async function toError(res: Response, label: string): Promise<Error> {
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const msg = typeof body['message'] === 'string' ? body['message'] : res.statusText;
  return new Error(`${label} failed (${res.status}): ${msg}`);
}
