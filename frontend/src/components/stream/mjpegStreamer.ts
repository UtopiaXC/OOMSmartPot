/**
 * mjpegStreamer — tame a live MJPEG feed for an in-page dashboard.
 *
 * A passive `<img src=mjpeg>` makes the browser decode AND paint *every* frame the
 * server pushes, at full rate and full resolution, for the lifetime of the tab —
 * which starves the main thread (laggy UI) and tends to accumulate memory (the tab
 * gets progressively slower). This streamer fixes both:
 *
 *   - It `fetch`es the `multipart/x-mixed-replace` body and extracts JPEG frames by
 *     scanning for the JPEG start/end markers (FFD8 … FFD9) — no multipart-header
 *     parsing needed, since each MJPEG part is a standalone JPEG.
 *   - It keeps only the MOST RECENT complete frame and discards any backlog, so we
 *     never decode stale frames.
 *   - It decodes/paints at most `fps` times per second (default 8) via a
 *     rAF-gated loop, and `bitmap.close()`s every decoded frame — bounded CPU,
 *     bounded memory.
 *
 * Call `stop()` to abort the fetch and tear down the render loop.
 */

export interface MjpegStreamHandle {
  stop(): void;
}

export interface MjpegStreamOptions {
  url: string;
  canvas: HTMLCanvasElement;
  /** Max frames per second to decode/paint. Lower = lighter. */
  fps?: number;
  /** Called once with 'live' on the first painted frame, or 'error' on failure. */
  onStatus: (status: 'live' | 'error') => void;
}

const SOI = [0xff, 0xd8]; // JPEG start-of-image
const EOI = [0xff, 0xd9]; // JPEG end-of-image

/** Last index of `pattern` in `buf`, or -1. (0xFF bytes inside JPEG scan data are
 *  byte-stuffed as FF 00, so FFD8/FFD9 only appear as real markers.) */
function lastIndexOf(buf: Uint8Array, pattern: number[], end = buf.length): number {
  for (let i = end - pattern.length; i >= 0; i--) {
    let match = true;
    for (let j = 0; j < pattern.length; j++) {
      if (buf[i + j] !== pattern[j]) {
        match = false;
        break;
      }
    }
    if (match) return i;
  }
  return -1;
}

export function startMjpegStream({
  url,
  canvas,
  fps = 8,
  onStatus,
}: MjpegStreamOptions): MjpegStreamHandle {
  const controller = new AbortController();
  const ctx = canvas.getContext('2d');
  const minInterval = 1000 / fps;

  let stopped = false;
  let latest: Uint8Array | null = null; // most recent complete JPEG, awaiting paint
  let decoding = false;
  let liveAnnounced = false;
  let lastPaintAt = 0;
  let rafId = 0;

  // --- render loop: decode at most `fps`/s, always the freshest frame ---
  const renderLoop = (now: number) => {
    if (stopped) return;
    if (ctx && latest && !decoding && now - lastPaintAt >= minInterval) {
      const frame = latest;
      latest = null;
      decoding = true;
      createImageBitmap(new Blob([frame], { type: 'image/jpeg' }))
        .then((bitmap) => {
          if (!stopped) {
            if (canvas.width !== bitmap.width) canvas.width = bitmap.width;
            if (canvas.height !== bitmap.height) canvas.height = bitmap.height;
            ctx.drawImage(bitmap, 0, 0);
            if (!liveAnnounced) {
              liveAnnounced = true;
              onStatus('live');
            }
          }
          bitmap.close(); // critical: release decoded frame memory immediately
        })
        .catch(() => {
          /* a single corrupt frame is non-fatal; keep going */
        })
        .finally(() => {
          decoding = false;
          lastPaintAt = performance.now();
        });
    }
    rafId = requestAnimationFrame(renderLoop);
  };
  rafId = requestAnimationFrame(renderLoop);

  // --- network loop: pull bytes, keep only the newest complete frame ---
  (async () => {
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok || !res.body) throw new Error(`camera responded ${res.status}`);
      const reader = res.body.getReader();
      let buf = new Uint8Array(0);
      const MAX_BUF = 8 * 1024 * 1024; // guard against unbounded growth

      while (!stopped) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value && value.length) {
          const merged = new Uint8Array(buf.length + value.length);
          merged.set(buf, 0);
          merged.set(value, buf.length);
          buf = merged;
        }

        const eoi = lastIndexOf(buf, EOI);
        if (eoi !== -1) {
          const soi = lastIndexOf(buf, SOI, eoi); // start of the frame ending at eoi
          if (soi !== -1) {
            latest = buf.slice(soi, eoi + 2);
            buf = buf.slice(eoi + 2); // keep only the partial tail of the next frame
          }
        }
        if (buf.length > MAX_BUF) buf = buf.slice(buf.length - MAX_BUF);
      }
    } catch {
      if (!stopped) onStatus('error');
    }
  })();

  return {
    stop() {
      stopped = true;
      cancelAnimationFrame(rafId);
      controller.abort();
    },
  };
}
