import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, ErrorState, Spinner, StatusDot } from '../common';
import { config } from '../../config/env';
import { startMjpegStream } from './mjpegStreamer';

interface LiveStreamViewProps {
  /** Override the MJPEG stream URL (tests). Defaults to config.CAMERA_STREAM_URL. */
  streamUrl?: string;
  /** Max frames/second to decode & paint. Defaults to config.CAMERA_STREAM_FPS. */
  fps?: number;
  /** Injectable streamer (tests). Defaults to the real fetch+canvas streamer. */
  startStream?: typeof startMjpegStream;
}

type Status = 'connecting' | 'live' | 'error';

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/**
 * LiveStreamView — shows the camera feed.
 *
 * The OOMSmartPot camera endpoint serves an MJPEG stream
 * (multipart/x-mixed-replace). Rather than point a passive <img> at it (which makes
 * the browser decode + paint every frame at full rate and leak memory over time),
 * we pull the stream with `startMjpegStream` and render it to a <canvas> at a capped
 * FPS, dropping stale frames and disposing each decoded bitmap. The stream is
 * additionally OPT-IN (starts paused) so the page is light until the user wants it.
 */
export function LiveStreamView({
  streamUrl = config.CAMERA_STREAM_URL,
  fps = config.CAMERA_STREAM_FPS,
  startStream = startMjpegStream,
}: LiveStreamViewProps) {
  const [status, setStatus] = useState<Status>('connecting');
  const [paused, setPaused] = useState(true);
  // Bumped on (re)start to force the streaming effect to tear down and reconnect.
  const [runKey, setRunKey] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const start = useCallback(() => {
    setStatus('connecting');
    setPaused(false);
    setRunKey((k) => k + 1);
  }, []);

  const togglePause = useCallback(() => {
    if (paused) start();
    else setPaused(true);
  }, [paused, start]);

  // Drive the streamer whenever we're active. Cleanup stops the fetch + render loop,
  // which is also what releases all decode/network resources when paused/unmounted.
  useEffect(() => {
    if (paused) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    setStatus('connecting');
    const handle = startStream({
      url: streamUrl,
      canvas,
      fps,
      onStatus: setStatus,
    });
    return () => handle.stop();
  }, [paused, runKey, streamUrl, fps, startStream]);

  const dotStatus = paused
    ? 'warn'
    : status === 'live'
      ? 'ok'
      : status === 'connecting'
        ? 'warn'
        : 'error';
  const dotLabel = paused
    ? 'Paused'
    : status === 'live'
      ? 'Live'
      : status === 'connecting'
        ? 'Connecting…'
        : 'Stream error';

  return (
    <Card title="Live Stream">
      <div className="flex items-center justify-between mb-3">
        <StatusDot status={dotStatus} label={dotLabel} />
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={togglePause}
            className="text-xs font-medium text-gray-600 hover:text-gray-900 underline-offset-2 hover:underline"
          >
            {paused ? 'Start' : 'Pause'}
          </button>
          <span className="text-xs text-gray-400">
            MJPEG · {fps} fps · {hostOf(streamUrl)}
          </span>
        </div>
      </div>

      {/* `contain: paint` isolates the canvas's repaints from the rest of the page. */}
      <div
        className="relative w-full aspect-video bg-gray-900 rounded-lg overflow-hidden flex items-center justify-center"
        style={{ contain: 'paint' }}
      >
        {paused ? (
          <button
            type="button"
            onClick={start}
            className="px-4 py-2 rounded-md bg-white/10 text-gray-200 text-sm font-medium hover:bg-white/20 transition-colors"
          >
            ▶ Start stream
          </button>
        ) : status === 'error' ? (
          <ErrorState message="Camera stream unavailable." onRetry={start} />
        ) : (
          <>
            {status === 'connecting' && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Spinner size="lg" label="Connecting to camera…" />
              </div>
            )}
            <canvas
              ref={canvasRef}
              role="img"
              aria-label="Live camera feed"
              className={`w-full h-full object-contain ${
                status === 'live' ? 'opacity-100' : 'opacity-0'
              }`}
            />
          </>
        )}
      </div>
    </Card>
  );
}
