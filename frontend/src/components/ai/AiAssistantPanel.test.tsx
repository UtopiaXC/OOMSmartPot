import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { server } from '../../mocks/server';
import { http, HttpResponse } from 'msw';
import { AiAssistantPanel } from './AiAssistantPanel';

vi.mock('../../config/env', () => ({
  config: { API_BASE_URL: '', USE_MOCKS: false, POLL_INTERVAL_MS: 0 },
}));

const suggestions = {
  timestamp: '2026-06-16T08:20:50Z',
  suggestions: [
    {
      suggestion_id: 's1',
      category: 'watering',
      title: 'Increase watering frequency',
      description: 'Soil moisture trending low.',
      priority: 'HIGH',
    },
  ],
};
const upcoming = {
  generated_at: '2026-06-16T08:20:50Z',
  ai_decision_summary: 'Light watering planned this evening.',
  schedules: [
    { schedule_id: 'u1', planned_time: '2026-06-16T18:00:00Z', duration_milliseconds: 4000, executed: false },
  ],
};

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function useGoodHandlers() {
  server.use(
    http.get('/ai/suggestions', () => HttpResponse.json(suggestions)),
    http.get('/schedule/upcoming', () => HttpResponse.json(upcoming)),
  );
}

describe('AiAssistantPanel', () => {
  it('shows suggestions and upcoming schedule (GETs)', async () => {
    useGoodHandlers();
    render(<AiAssistantPanel />);

    await waitFor(() =>
      expect(screen.getByText(/increase watering frequency/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/light watering planned this evening/i)).toBeInTheDocument();
    expect(screen.getByText('HIGH')).toBeInTheDocument();
  });

  it('triggers an AI run and refreshes', async () => {
    let triggered = false;
    server.use(
      http.get('/ai/suggestions', () => HttpResponse.json(suggestions)),
      http.get('/schedule/upcoming', () =>
        HttpResponse.json(
          triggered
            ? { ...upcoming, ai_decision_summary: 'Updated: watering scheduled now.' }
            : upcoming,
        ),
      ),
      http.post('/ai/trigger', () => {
        triggered = true;
        return HttpResponse.json({
          triggered_at: '2026-06-16T09:00:00Z',
          status: 'completed',
          ai_decision_summary: 'done',
          schedules_updated: true,
        });
      }),
    );

    render(<AiAssistantPanel />);
    await waitFor(() => expect(screen.getByText(/light watering/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /run analysis now/i }));

    await waitFor(() =>
      expect(screen.getByText(/updated: watering scheduled now/i)).toBeInTheDocument(),
    );
  });

  it('shows an error when both GETs fail', async () => {
    server.use(
      http.get('/ai/suggestions', () => HttpResponse.json({ detail: 'nope' }, { status: 500 })),
      http.get('/schedule/upcoming', () => HttpResponse.json({ detail: 'nope' }, { status: 500 })),
    );

    render(<AiAssistantPanel />);
    await waitFor(() => expect(screen.getByText(/nope/i)).toBeInTheDocument());
  });
});
