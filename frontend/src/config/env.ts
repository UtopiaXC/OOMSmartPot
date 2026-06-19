/**
 * Single source of truth for all network configuration.
 * Read from import.meta.env with sensible defaults.
 * Never hardcode URLs elsewhere in the app — always import from here.
 */

interface AppConfig {
  API_BASE_URL: string;
  SENSORS_BASE_URL: string;
  CAMERA_STREAM_URL: string;
  CAMERA_STREAM_FPS: number;
  USE_MOCKS: boolean;
  POLL_INTERVAL_MS: number;
}

export const config: AppConfig = {
  /**
   * Base URL for the pump REST API (`/pump/status`, `/pump/action`, `/pump/stop`).
   * Defaults to the LIVE OOMSmartPot host so the pump is wired out of the box, same
   * as sensors/camera. Tests override this with '' so MSW intercepts relative paths.
   */
  API_BASE_URL:
    import.meta.env.VITE_API_BASE_URL ?? "http://192.168.11.149:8000/api/v1",

  /**
   * Base URL for the OOMSmartPot sensor API. Points at the live test server by
   * default — sensor reads hit the real network (the browser MSW worker does NOT
   * mock this host), so the dashboard shows live data out of the box.
   */
  SENSORS_BASE_URL:
    import.meta.env.VITE_SENSORS_BASE_URL ?? "http://192.168.11.149:8000/api/v1",

  /**
   * MJPEG camera stream URL (multipart/x-mixed-replace). Pulled via fetch and
   * rendered to a throttled <canvas> (see mjpegStreamer). Defaults to the live
   * OOMSmartPot camera — no local mock needed.
   */
  CAMERA_STREAM_URL:
    import.meta.env.VITE_CAMERA_STREAM_URL ??
    "http://192.168.11.149:8000/api/v1/camera/stream",

  /**
   * Max frames/second the camera canvas decodes & paints. The live feed pushes
   * frames as fast as it can; capping this is the main lever for keeping the UI
   * responsive while streaming. 8 is smooth enough for a plant cam.
   */
  CAMERA_STREAM_FPS: Number(import.meta.env.VITE_CAMERA_STREAM_FPS ?? 8),

  /** When true, MSW mocks are enabled (dev/test). Set VITE_USE_MOCKS=false in .env.production. */
  USE_MOCKS: import.meta.env.VITE_USE_MOCKS !== "false",

  /** Sensor data polling interval in milliseconds. */
  POLL_INTERVAL_MS: Number(import.meta.env.VITE_POLL_INTERVAL_MS ?? 5000),
};
