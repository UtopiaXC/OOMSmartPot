import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { server } from '../../mocks/server';
import { http, HttpResponse } from 'msw';
import { ControlPanel } from './ControlPanel';

// Pin poll interval to 0 (no background polling) and API_BASE_URL to '' so
// RestPump's relative fetches are intercepted by MSW.
vi.mock('../../config/env', () => ({
  config: {
    API_BASE_URL: '',
    USE_MOCKS: false, // use RestPump so fetch hits MSW
    POLL_INTERVAL_MS: 0,
  },
}));

const idleStatus = {
  is_running: false,
  last_executed_time: null,
  last_duration_milliseconds: null,
  hardware_healthy: true,
};

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('ControlPanel (MSW integration)', () => {
  it('renders pump title', () => {
    render(<ControlPanel />);
    expect(screen.getByText(/pump control/i)).toBeInTheDocument();
  });

  it('loads initial idle status', async () => {
    server.use(http.get('/pump/status', () => HttpResponse.json(idleStatus)));

    render(<ControlPanel />);
    await waitFor(() => expect(screen.getByText(/no water flowing/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /water now/i })).not.toBeDisabled();
  });

  it('Water now → optimistic pending → confirmed running', async () => {
    let resolvePost!: (v: unknown) => void;
    const postGate = new Promise((r) => (resolvePost = r));
    let running = false;

    server.use(
      http.get('/pump/status', () =>
        HttpResponse.json({ ...idleStatus, is_running: running }),
      ),
      http.post('/pump/action', async () => {
        await postGate;
        running = true;
        return HttpResponse.json(
          { status: 'accepted', message: 'ok', estimated_end_time: null },
          { status: 202 },
        );
      }),
    );

    render(<ControlPanel />);
    await waitFor(() => expect(screen.getByText(/no water flowing/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /water now/i }));

    // Optimistic: "Applying command…" callout
    await waitFor(() => {
      const callout = screen
        .getAllByRole('status')
        .find((el) => el.tagName === 'DIV' && /applying command/i.test(el.textContent ?? ''));
      expect(callout).toBeTruthy();
    });

    resolvePost(undefined);

    // Confirmed: pump reports running (RestPump re-fetches /pump/status after action)
    await waitFor(() => expect(screen.getByText(/water is flowing/i)).toBeInTheDocument());
  });

  it('shows error and rolls back when the action fails', async () => {
    server.use(
      http.get('/pump/status', () => HttpResponse.json(idleStatus)),
      http.post('/pump/action', () =>
        HttpResponse.json({ message: 'Pump jammed' }, { status: 500 }),
      ),
    );

    render(<ControlPanel />);
    await waitFor(() => expect(screen.getByText(/no water flowing/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /water now/i }));

    await waitFor(() => expect(screen.getByText(/pump jammed/i)).toBeInTheDocument());
    // Rolled back to idle
    expect(screen.getByText(/no water flowing/i)).toBeInTheDocument();
  });

  it('Stop sends a stop command when running', async () => {
    let running = true;
    let stopCalled = false;

    server.use(
      http.get('/pump/status', () =>
        HttpResponse.json({ ...idleStatus, is_running: running }),
      ),
      http.post('/pump/stop', () => {
        stopCalled = true;
        running = false;
        return HttpResponse.json({ status: 'stopped', message: 'ok' });
      }),
    );

    render(<ControlPanel />);
    await waitFor(() => expect(screen.getByText(/water is flowing/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /stop pump/i }));

    await waitFor(() => expect(screen.getByText(/no water flowing/i)).toBeInTheDocument());
    expect(stopCalled).toBe(true);
  });
});
