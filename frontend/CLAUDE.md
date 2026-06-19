# Plant Monitor UI

A React dashboard to monitor a plant-growing rig (atmosphere + soil sensors, live
camera) and control a water pump. Built **mock-first** behind adapters, so each
concern swaps to a real backend via config with no UI rewrite.

**Backend:** the OOMSmartPot API (https://github.com/UtopiaXC/OOMSmartPot).
**All three concerns are now wired LIVE** against `https://test.utopiaxc.com/api/v1`
— nothing is mocked in the running app (MSW is used only in tests).
- **Sensors** — `/sensors/current`.
- **Camera** — `LiveStreamView` pulls the MJPEG `/camera/stream` feed via `fetch`
  and renders it to a throttled `<canvas>` (no WebSocket). Opt-in (starts paused),
  FPS-capped — see the camera note under "Known issues".
- **Pump** — `RestPump` against `/pump/status`, `/pump/action`, `/pump/stop`
  (run-for-N-ms / stop / status). ⚠️ `POST /pump/action` actuates a REAL pump on a
  shared test device — don't fire it just to test; the UI gates it behind a "Water
  now" button.
- **AI assistant** — `RestAiClient` against `/ai/suggestions`, `/ai/trigger`,
  `/schedule/upcoming`, `/schedule/history`. ⚠️ `POST /ai/trigger` runs the REAL AI
  routine — don't fire it just to test; the UI gates it behind "Run analysis now".
- **System config** — `RestSystemConfig` against `GET|PUT /system/config` (sensor
  read interval, AI cron, pump safety cap). PUT changes the live backend.

**Stack:** React 18 + Vite 5 + TypeScript (strict) · Tailwind v3 · Recharts ·
MSW v2 (REST mocks) · Vitest + React Testing Library. Node 18.

## Run / test

```bash
npm install
npm run dev                              # http://localhost:5173  (everything hits the LIVE API)
npm test                                 # full suite (currently 76/76 green)
npm run build                            # tsc -b && vite build
```

The dev app talks to the **live backend** for everything out of the box (no key
needed; the server sends CORS `*`) — there is no browser-side MSW. Browser
verification uses Playwright
(`npm i -D playwright && npx playwright install chromium`, then drive a headless
script against :5173 — see git history / prior session for the pattern).

## Architecture — three interface-driven abstractions

Components depend ONLY on interfaces + factories, never concrete classes. Each
factory in an `index.ts` picks the adapter from `src/config/env.ts`. All three
concerns are wired live; MSW now mocks them in **tests only** (node server).

| Concern | Interface | Adapter | Status | Panel |
|---|---|---|---|---|
| Sensors | `data/DataSource.ts` `query(Query): Series` | `data/RestDataSource.ts` → live `/sensors/current` | **LIVE** (MSW node server mocks it in tests only) | `components/stats/StatsView.tsx` |
| Pump | `control/Pump.ts` `getStatus()/send(cmd)` | `control/RestPump.ts` → `/pump/status·action·stop` | **LIVE** (run/stop/status; MSW mocks it in tests via `pumpHandlers.ts`) | `components/control/ControlPanel.tsx` |
| Camera | _none — `mjpegStreamer` util_ | `fetch` MJPEG → throttled `<canvas>` | **LIVE** (`/camera/stream`; opt-in, FPS-capped) | `components/stream/LiveStreamView.tsx` |
| AI assistant | `ai/AiClient.ts` | `ai/RestAiClient.ts` → `/ai/*`, `/schedule/*` | **LIVE** (suggestions, upcoming, history, trigger) | `components/ai/AiAssistantPanel.tsx`, `components/ai/WateringHistory.tsx` |
| System config | `system/SystemConfigClient.ts` | `system/RestSystemConfig.ts` → `GET\|PUT /system/config` | **LIVE** (view + edit form) | `components/system/SystemConfigPanel.tsx` |

Camera needs no Mock/Rest adapter pair: `stream/mjpegStreamer.ts#startMjpegStream`
fetches the `multipart/x-mixed-replace` body, extracts JPEG frames (FFD8…FFD9
scan), keeps only the freshest one, and paints to a `<canvas>` at most
`config.CAMERA_STREAM_FPS` times/sec, `close()`-ing each decoded bitmap.
`LiveStreamView` owns connecting/live/error/paused state and injects the streamer
(swappable in tests). The old WebSocket `CameraStream` abstraction (interface +
Mock/WS adapters + `useCameraStream` hook + `ws-camera-server.mjs`) was retired
when the camera went live.

Hooks: `hooks/useQuery.ts` (poll + loading/error), `hooks/usePump.ts`
(optimistic run/stop + rollback + status poll), `hooks/useAiAssistant.ts`
(suggestions+upcoming + trigger), `hooks/useScheduleHistory.ts` (paginated history),
`hooks/useSystemConfig.ts` (load + PUT save). All domain hooks accept an injected
client for tests. Config is centralized in `src/config/env.ts` — never hardcode URLs.

**Mock vs live split (important):** mocks now exist for TESTS ONLY. `mocks/server.ts`
(the MSW **node** server) mocks both sensors + pump via `handlers.ts`; there is no
browser-side MSW (`main.tsx` starts no worker), so the running app is fully live.
`config.SENSORS_BASE_URL` (sensors) and `config.API_BASE_URL` (pump) both default to
the live `…/api/v1` host; tests override them with relative/absolute values so the
node MSW intercepts.

The generic query model is `data/types.ts`: `TimeRange = latest | window | period`.
Since the real API only exposes a combined *current* reading (no history endpoint),
`RestDataSource` keeps an in-memory rolling buffer so window/period chart queries
return real points accumulated since page load.

## Real OOMSmartPot API (`https://test.utopiaxc.com/api/v1`)

Source of truth: `backend/mock/mock.php` in the OOMSmartPot repo. CORS is `*`.

**Sensors (WIRED):** `GET /sensors/current` →
`{ timestamp, temperature_celsius, atmosphere_hpa, soil_moisture_percent }`
(the live server omits `light_intensity_lux` / `water_tank_level_percent` that the
repo mock includes; no humidity sensor). `RestDataSource` maps these fields.

**Pump (WIRED — momentary run/stop model):** `RestPump` maps these endpoints; the
panel exposes a "Water now (Ns)" button (duration chips) + Stop, and polls status.
```
GET  /pump/status  -> { is_running, last_executed_time, last_duration_milliseconds, hardware_healthy }
POST /pump/action  body { action:"run", duration_milliseconds:N } -> 202 { status, message, estimated_end_time }
POST /pump/stop    -> 200 { status:"stopped", message }
```
After a successful action/stop, `RestPump` re-fetches `/pump/status` for the
canonical state. ⚠️ `POST /pump/action` actuates a REAL pump on the shared test
device — never fire it just to probe a response shape.

**Camera (WIRED):** `GET /camera/stream` is **MJPEG over HTTP**
(`multipart/x-mixed-replace; boundary=frame`), NOT a WebSocket, CORS `*`.
`mjpegStreamer` fetches it and paints frames to a `<canvas>` (see the camera row
above and the Known-issues note for why we don't use a passive `<img>`).

**AI assistant + schedule (WIRED):**
```
GET  /ai/suggestions            -> { timestamp, suggestions:[{suggestion_id,category,title,description,priority}] }
POST /ai/trigger                -> { triggered_at, status, ai_decision_summary, schedules_updated }
GET  /schedule/upcoming         -> { generated_at, ai_decision_summary, schedules:[{schedule_id,planned_time,duration_milliseconds,executed}] }
GET  /schedule/history?limit&offset -> { total_records, records:[{executed_at,trigger_type,duration_milliseconds,status,soil_moisture_before,soil_moisture_after}] }
```
`useAiAssistant` loads suggestions+upcoming and exposes `trigger()`;
`useScheduleHistory` paginates history. ⚠️ `POST /ai/trigger` runs the REAL AI.

**System config (WIRED):** `GET|PUT /system/config` →
`{ sensor_read_interval_seconds, ai_evaluation_cron, safety_max_duration_milliseconds }`.
`useSystemConfig` loads + saves (PUT). The cron controls how often the AI routine runs.

## Backend integration — COMPLETE

Every documented endpoint with a UI is wired live (sensors, camera, pump, AI
assistant, schedule, system config). The browser-side MSW mock is removed; MSW
lives only in tests (`mocks/server.ts` node server — handlers in `sensorHandlers`,
`pumpHandlers`, `aiHandlers`, `systemHandlers`). Keep `npm test` green: tests mock
via the node MSW server, independent of the live backend.

**Verifying in-browser against a mock** (when the configured backend is down): the
public OOMSmartPot test server implements all these endpoints with the same shapes,
so start the dev server pointed at it via env overrides — e.g.
`VITE_API_BASE_URL=https://test.utopiaxc.com/api/v1 VITE_SENSORS_BASE_URL=… VITE_CAMERA_STREAM_URL=…/camera/stream npm run dev`.

## Known issues / polish backlog

- Build emits a >500kB chunk warning (Recharts). Consider `manualChunks` / lazy
  charts if bundle size matters.
- **Camera performance:** a passive `<img src=mjpeg>` makes the browser decode +
  paint *every* frame the server pushes (full rate/size) and leaks memory over time —
  the tab gets laggy then progressively unusable. So we DON'T use `<img>`. Instead
  `mjpegStreamer` fetches the stream, drops stale frames, and paints to a `<canvas>`
  at `config.CAMERA_STREAM_FPS` (default 8), `close()`-ing each bitmap (bounded
  CPU + memory). The feed is also opt-in (starts paused). Verified: ~0 long tasks /
  60fps page while streaming. Tuning knobs: lower `VITE_CAMERA_STREAM_FPS`, or
  auto-pause when the tab/panel isn't visible. Do NOT reintroduce `will-change`/
  `translateZ` on the streaming element — it forces per-frame GPU texture re-uploads
  and can hang the tab.

## Conventions

Functional components, hooks, TS strict, small focused files, Tailwind utility
classes. Mocks live at the network boundary so app code is identical in mock and
real modes. When changing an adapter's request/response shape, update its doc-comment
(the `Rest*` files document their contract inline).
