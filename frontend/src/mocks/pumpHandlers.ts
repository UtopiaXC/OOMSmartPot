import { http, HttpResponse } from 'msw';

/**
 * MSW v2 handlers for the OOMSmartPot pump endpoints — used by the Vitest
 * (node) server so the pump tests run network-free. The dev browser has no MSW at
 * all and hits the real pump API directly.
 *
 * Endpoint contract (mirrors RestPump / the real API):
 *   GET  /pump/status → 200 { is_running, last_executed_time,
 *                             last_duration_milliseconds, hardware_healthy }
 *   POST /pump/action  Body { action:"run", duration_milliseconds:N }
 *                     → 202 { status, message, estimated_end_time }
 *                     → 400 { message } if the action/duration is invalid
 *   POST /pump/stop   → 200 { status:"stopped", message }
 *
 * `is_running` is derived from a `runUntil` timestamp so the momentary pump
 * realistically reports itself idle again once the run window elapses.
 */

interface PumpState {
  runUntil: number; // epoch ms; is_running = now < runUntil
  lastExecutedTime: string | null;
  lastDurationMs: number | null;
  hardwareHealthy: boolean;
}

const state: PumpState = {
  runUntil: 0,
  lastExecutedTime: null,
  lastDurationMs: null,
  hardwareHealthy: true,
};

function statusBody() {
  return {
    is_running: Date.now() < state.runUntil,
    last_executed_time: state.lastExecutedTime,
    last_duration_milliseconds: state.lastDurationMs,
    hardware_healthy: state.hardwareHealthy,
  };
}

export const pumpHandlers = [
  http.get('/pump/status', () => HttpResponse.json(statusBody())),

  http.post('/pump/action', async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as {
      action?: unknown;
      duration_milliseconds?: unknown;
    };
    const duration = body?.duration_milliseconds;

    if (body?.action !== 'run' || typeof duration !== 'number' || duration <= 0) {
      return HttpResponse.json(
        { message: 'Invalid action. Expected { action: "run", duration_milliseconds: > 0 }.' },
        { status: 400 },
      );
    }

    const now = Date.now();
    state.runUntil = now + duration;
    state.lastExecutedTime = new Date(now).toISOString();
    state.lastDurationMs = duration;

    return HttpResponse.json(
      {
        status: 'accepted',
        message: `Pump running for ${duration}ms`,
        estimated_end_time: new Date(state.runUntil).toISOString(),
      },
      { status: 202 },
    );
  }),

  http.post('/pump/stop', () => {
    state.runUntil = 0;
    return HttpResponse.json({ status: 'stopped', message: 'Pump stopped' });
  }),
];
