import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePump } from './usePump';
import { MockPump, FailingPump } from '../control/MockPump';
import type { Pump } from '../control/Pump';
import type { PumpStatus } from '../control/types';

// Poll interval is read from config — pin it to 0 so polling is disabled in tests
vi.mock('../config/env', () => ({
  config: {
    API_BASE_URL: '',
    USE_MOCKS: true,
    POLL_INTERVAL_MS: 0,
  },
}));

describe('usePump', () => {
  it('fetches initial status on mount', async () => {
    const { result } = renderHook(() => usePump(new MockPump(false, 0)));

    await waitFor(() => expect(result.current.status).not.toBeNull());

    expect(result.current.status?.isRunning).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.sending).toBe(false);
  });

  it('applies an optimistic running state on run()', async () => {
    const { result } = renderHook(() => usePump(new MockPump(false, 50)));

    await waitFor(() => expect(result.current.status?.isRunning).toBe(false));

    act(() => result.current.run(4000));

    // Immediately after run(): optimistically running + pending
    expect(result.current.status?.isRunning).toBe(true);
    expect(result.current.status?.pending).toBe(true);
    expect(result.current.status?.lastDurationMs).toBe(4000);
    expect(result.current.sending).toBe(true);

    await waitFor(() => expect(result.current.sending).toBe(false));
    expect(result.current.status?.isRunning).toBe(true);
    expect(result.current.status?.pending).toBeFalsy();
  });

  it('stops the pump on stop()', async () => {
    const { result } = renderHook(() => usePump(new MockPump(true, 0)));

    await waitFor(() => expect(result.current.status?.isRunning).toBe(true));
    await act(async () => result.current.stop());
    await waitFor(() => expect(result.current.sending).toBe(false));

    expect(result.current.status?.isRunning).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('rolls back to previous status on send error', async () => {
    const previous: PumpStatus = {
      isRunning: false,
      hardwareHealthy: true,
      lastExecutedTime: null,
      lastDurationMs: null,
    };
    const pump: Pump = {
      getStatus: async () => previous,
      send: async () => {
        throw new Error('Pump jammed');
      },
    };

    const { result } = renderHook(() => usePump(pump));

    await waitFor(() => expect(result.current.status?.isRunning).toBe(false));

    act(() => result.current.run(2000));
    expect(result.current.status?.isRunning).toBe(true); // optimistic

    await waitFor(() => expect(result.current.sending).toBe(false));

    expect(result.current.status?.isRunning).toBe(false); // rolled back
    expect(result.current.error).toBe('Pump jammed');
  });

  it('exposes error when getStatus fails', async () => {
    const { result } = renderHook(() => usePump(new FailingPump('initial fetch error')));

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error).toBe('initial fetch error');
    expect(result.current.status).toBeNull();
  });

  it('does not send concurrent commands', async () => {
    const sendCalls: string[] = [];
    const pump: Pump = {
      getStatus: async () => ({
        isRunning: false,
        hardwareHealthy: true,
        lastExecutedTime: null,
        lastDurationMs: null,
      }),
      send: async (cmd) => {
        sendCalls.push(cmd.action);
        await new Promise((r) => setTimeout(r, 100));
        return {
          isRunning: cmd.action === 'run',
          hardwareHealthy: true,
          lastExecutedTime: null,
          lastDurationMs: null,
        };
      },
    };

    const { result } = renderHook(() => usePump(pump));
    await waitFor(() => expect(result.current.status).not.toBeNull());

    act(() => {
      result.current.run(1000);
      result.current.run(1000); // ignored
      result.current.run(1000); // ignored
    });

    await waitFor(() => expect(result.current.sending).toBe(false));
    expect(sendCalls).toHaveLength(1);
  });

  it('refresh() re-fetches status', async () => {
    const pump = new MockPump(false, 0);
    const { result } = renderHook(() => usePump(pump));

    await waitFor(() => expect(result.current.status?.isRunning).toBe(false));

    await pump.send({ action: 'run', durationMs: 1000 });

    await act(async () => result.current.refresh());
    await waitFor(() => expect(result.current.status?.isRunning).toBe(true));
  });
});
