/**
 * Types for the system-configuration domain (`GET|PUT /system/config`).
 *
 * Controls how the backend behaves:
 *   - sensorReadIntervalSeconds — how often the rig reads its sensors.
 *   - aiEvaluationCron — cron expression for how often the AI routine runs.
 *   - safetyMaxDurationMs — hard cap on any single pump run.
 */
export interface SystemConfig {
  sensorReadIntervalSeconds: number;
  aiEvaluationCron: string;
  safetyMaxDurationMs: number;
}
