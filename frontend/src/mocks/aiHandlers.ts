import { http, HttpResponse } from 'msw';

/**
 * MSW handlers for the AI-assistant + schedule endpoints (tests-only, node server).
 *
 *   GET  /ai/suggestions     -> { timestamp, suggestions: [...] }
 *   POST /ai/trigger         -> { triggered_at, status, ai_decision_summary, schedules_updated }
 *   GET  /schedule/upcoming  -> { generated_at, ai_decision_summary, schedules: [...] }
 *   GET  /schedule/history?limit&offset -> { total_records, records: [...] }
 */

const HISTORY = Array.from({ length: 24 }, (_, i) => ({
  executed_at: `2026-06-16T08:${String(59 - i).padStart(2, '0')}:00`,
  trigger_type: i % 3 === 0 ? 'AI' : 'MANUAL',
  duration_milliseconds: 2000 + (i % 4) * 1000,
  status: i === 5 ? 'FAILED' : 'SUCCESS',
  soil_moisture_before: 30 + i,
  soil_moisture_after: 45 + i,
}));

export const aiHandlers = [
  http.get('/ai/suggestions', () =>
    HttpResponse.json({
      timestamp: '2026-06-16T08:20:50Z',
      suggestions: [
        {
          suggestion_id: 's1',
          category: 'watering',
          title: 'Increase watering frequency',
          description: 'Soil moisture has been trending low.',
          priority: 'HIGH',
        },
      ],
    }),
  ),

  http.post('/ai/trigger', () =>
    HttpResponse.json({
      triggered_at: '2026-06-16T09:00:00Z',
      status: 'completed',
      ai_decision_summary: 'Analysis complete; one watering scheduled.',
      schedules_updated: true,
    }),
  ),

  http.get('/schedule/upcoming', () =>
    HttpResponse.json({
      generated_at: '2026-06-16T08:20:50Z',
      ai_decision_summary: 'Plant looks healthy; light watering planned for this evening.',
      schedules: [
        {
          schedule_id: 'u1',
          planned_time: '2026-06-16T18:00:00Z',
          duration_milliseconds: 4000,
          executed: false,
        },
      ],
    }),
  ),

  http.get('/schedule/history', ({ request }) => {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit') ?? 10);
    const offset = Number(url.searchParams.get('offset') ?? 0);
    return HttpResponse.json({
      total_records: HISTORY.length,
      records: HISTORY.slice(offset, offset + limit),
    });
  }),
];
