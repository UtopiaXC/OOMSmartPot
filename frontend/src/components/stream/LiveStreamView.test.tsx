import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LiveStreamView } from './LiveStreamView';
import type { MjpegStreamOptions } from './mjpegStreamer';

const URL = 'http://cam.test/api/v1/camera/stream';

/**
 * Fake streamer: records each invocation's options (so tests can drive onStatus)
 * and returns a stop spy — no real fetch/canvas, which jsdom can't run.
 */
function makeFakeStreamer() {
  const calls: MjpegStreamOptions[] = [];
  const stops: Array<ReturnType<typeof vi.fn>> = [];
  const streamer = vi.fn((opts: MjpegStreamOptions) => {
    calls.push(opts);
    const stop = vi.fn();
    stops.push(stop);
    return { stop };
  });
  return { streamer, calls, stops };
}

async function renderAndStart() {
  const fake = makeFakeStreamer();
  const user = userEvent.setup();
  render(<LiveStreamView streamUrl={URL} startStream={fake.streamer} />);
  await user.click(screen.getByRole('button', { name: /start stream/i }));
  return { ...fake, user };
}

describe('LiveStreamView (throttled MJPEG canvas)', () => {
  it('starts paused (opt-in): no stream, no canvas', () => {
    const fake = makeFakeStreamer();
    render(<LiveStreamView streamUrl={URL} startStream={fake.streamer} />);

    expect(screen.getByText('Paused')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start stream/i })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /live camera feed/i })).toBeNull();
    expect(fake.streamer).not.toHaveBeenCalled();
  });

  it('starting opens the stream at the configured url and shows the canvas', async () => {
    const { calls } = await renderAndStart();

    expect(screen.getByText('Connecting…')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /live camera feed/i }).tagName).toBe('CANVAS');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(URL);
  });

  it('goes Live when the streamer reports the first painted frame', async () => {
    const { calls } = await renderAndStart();

    act(() => calls[0].onStatus('live'));

    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('shows error + retry when the streamer reports a failure', async () => {
    const { calls } = await renderAndStart();

    act(() => calls[0].onStatus('error'));

    expect(screen.getByText('Stream error')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('pausing stops the stream (releases resources)', async () => {
    const { user, stops } = await renderAndStart();

    await user.click(screen.getByRole('button', { name: /^pause$/i }));

    expect(stops[0]).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Paused')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /live camera feed/i })).toBeNull();
  });

  it('retry restarts the stream', async () => {
    const { user, calls } = await renderAndStart();

    act(() => calls[0].onStatus('error'));
    await user.click(screen.getByRole('button', { name: /try again/i }));

    expect(screen.getByText('Connecting…')).toBeInTheDocument();
    expect(calls.length).toBeGreaterThanOrEqual(2);
  });
});
