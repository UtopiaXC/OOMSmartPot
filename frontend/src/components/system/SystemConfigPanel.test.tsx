import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { server } from '../../mocks/server';
import { http, HttpResponse } from 'msw';
import { SystemConfigPanel } from './SystemConfigPanel';

vi.mock('../../config/env', () => ({
  config: { API_BASE_URL: '', USE_MOCKS: false, POLL_INTERVAL_MS: 0 },
}));

const baseConfig = {
  sensor_read_interval_seconds: 3,
  ai_evaluation_cron: '0 8,18 * * *',
  safety_max_duration_milliseconds: 15000,
};

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('SystemConfigPanel', () => {
  it('loads and displays the current config (GET)', async () => {
    server.use(http.get('/system/config', () => HttpResponse.json(baseConfig)));

    render(<SystemConfigPanel />);

    await waitFor(() =>
      expect(screen.getByDisplayValue('0 8,18 * * *')).toBeInTheDocument(),
    );
    expect(screen.getByDisplayValue('3')).toBeInTheDocument(); // sensor interval
    expect(screen.getByDisplayValue('15')).toBeInTheDocument(); // safety cap in seconds
  });

  it('Save is disabled until a field changes, then PUTs the update', async () => {
    let putBody: Record<string, unknown> | null = null;
    server.use(
      http.get('/system/config', () => HttpResponse.json(baseConfig)),
      http.put('/system/config', async ({ request }) => {
        putBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ status: 'ok', message: 'saved' });
      }),
    );

    render(<SystemConfigPanel />);
    await waitFor(() => expect(screen.getByDisplayValue('0 8,18 * * *')).toBeInTheDocument());

    const saveBtn = screen.getByRole('button', { name: /save changes/i });
    expect(saveBtn).toBeDisabled();

    // Change the sensor interval
    fireEvent.change(screen.getByDisplayValue('3'), { target: { value: '10' } });
    expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument();
    expect(saveBtn).not.toBeDisabled();

    fireEvent.click(saveBtn);

    await waitFor(() => expect(screen.getByText(/^saved$/i)).toBeInTheDocument());
    expect(putBody).toMatchObject({ sensor_read_interval_seconds: 10 });
  });

  it('shows an error when the GET fails', async () => {
    server.use(
      http.get('/system/config', () => HttpResponse.json({ detail: 'boom' }, { status: 500 })),
    );

    render(<SystemConfigPanel />);
    await waitFor(() => expect(screen.getByText(/boom/i)).toBeInTheDocument());
  });
});
