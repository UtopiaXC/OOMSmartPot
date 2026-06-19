import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { server } from '../../mocks/server';
import { http, HttpResponse } from 'msw';
import { WateringHistory } from './WateringHistory';

vi.mock('../../config/env', () => ({
  config: { API_BASE_URL: '', USE_MOCKS: false, POLL_INTERVAL_MS: 0 },
}));

const ALL = Array.from({ length: 24 }, (_, i) => ({
  executed_at: `2026-06-16T08:${String(59 - i).padStart(2, '0')}:00`,
  trigger_type: i % 3 === 0 ? 'AI' : 'MANUAL',
  duration_milliseconds: 2000,
  status: 'SUCCESS',
  soil_moisture_before: 30,
  soil_moisture_after: 45,
}));

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function usePagedHistory() {
  server.use(
    http.get('/schedule/history', ({ request }) => {
      const url = new URL(request.url);
      const limit = Number(url.searchParams.get('limit') ?? 10);
      const offset = Number(url.searchParams.get('offset') ?? 0);
      return HttpResponse.json({ total_records: ALL.length, records: ALL.slice(offset, offset + limit) });
    }),
  );
}

describe('WateringHistory', () => {
  it('renders the first page and the total count', async () => {
    usePagedHistory();
    render(<WateringHistory />);

    await waitFor(() => expect(screen.getByText(/1–10 of 24/)).toBeInTheDocument());
    // 10 data rows
    expect(screen.getAllByText(/SUCCESS/).length).toBe(10);
  });

  it('paginates with Next/Prev', async () => {
    usePagedHistory();
    render(<WateringHistory />);
    await waitFor(() => expect(screen.getByText(/1–10 of 24/)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() => expect(screen.getByText(/11–20 of 24/)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /prev/i }));
    await waitFor(() => expect(screen.getByText(/1–10 of 24/)).toBeInTheDocument());
  });

  it('shows empty state when there are no records', async () => {
    server.use(
      http.get('/schedule/history', () => HttpResponse.json({ total_records: 0, records: [] })),
    );
    render(<WateringHistory />);
    await waitFor(() => expect(screen.getByText(/no watering events recorded/i)).toBeInTheDocument());
  });
});
