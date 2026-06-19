/**
 * Core types for the pump control layer.
 *
 * The OOMSmartPot pump is a *momentary* actuator: you tell it to run for N
 * milliseconds, or stop early. It is NOT a stateful open/close valve — so the
 * model here is run(duration)/stop + a status poll, mirroring the real API
 * (`GET /pump/status`, `POST /pump/action`, `POST /pump/stop`).
 */

export interface PumpStatus {
  /** Whether the pump motor is currently running. */
  isRunning: boolean;
  /** Whether the pump hardware reports itself healthy. */
  hardwareHealthy: boolean;
  /** ISO timestamp of the last run, or null if never run. */
  lastExecutedTime: string | null;
  /** Duration (ms) of the last run, or null if never run. */
  lastDurationMs: number | null;
  /** Set optimistically by the hook while a run/stop command is in flight. */
  pending?: boolean;
  /** Estimated ISO end time of the current run, when a run was just requested. */
  estimatedEndTime?: string | null;
}

/** A command sent to the pump: run for a duration, or stop immediately. */
export type PumpCommand =
  | { action: 'run'; durationMs: number }
  | { action: 'stop' };
