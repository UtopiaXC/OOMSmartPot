import { http, HttpResponse } from 'msw';

/**
 * MSW handlers for system configuration (tests-only, node server).
 *
 *   GET /system/config -> { sensor_read_interval_seconds, ai_evaluation_cron,
 *                           safety_max_duration_milliseconds }
 *   PUT /system/config  body (partial) -> 200 { status, message }
 *
 * Holds module-level state so a PUT is reflected by the next GET.
 */

const state = {
  sensor_read_interval_seconds: 3,
  ai_evaluation_cron: '0 8,18 * * *',
  safety_max_duration_milliseconds: 15000,
};

export const systemHandlers = [
  http.get('/system/config', () => HttpResponse.json({ ...state })),

  http.put('/system/config', async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    if (typeof body.sensor_read_interval_seconds === 'number')
      state.sensor_read_interval_seconds = body.sensor_read_interval_seconds;
    if (typeof body.ai_evaluation_cron === 'string')
      state.ai_evaluation_cron = body.ai_evaluation_cron;
    if (typeof body.safety_max_duration_milliseconds === 'number')
      state.safety_max_duration_milliseconds = body.safety_max_duration_milliseconds;
    return HttpResponse.json({ status: 'ok', message: 'Configuration updated' });
  }),
];
