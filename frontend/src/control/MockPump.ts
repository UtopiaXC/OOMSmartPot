import type { Pump } from './Pump';
import type { PumpStatus, PumpCommand } from './types';

/**
 * In-memory pump used in pure unit tests (injected directly, no network).
 *
 * Simulates a momentary pump: `run` marks it running and records the duration;
 * `stop` marks it idle. It does NOT auto-stop on a timer — tests drive
 * transitions explicitly. (Dev/integration behaviour comes from the MSW
 * handlers in pumpHandlers.ts, which own their own state.)
 */
export class MockPump implements Pump {
  private running: boolean;
  private lastExecutedTime: string | null = null;
  private lastDurationMs: number | null = null;
  private readonly latencyMs: number;

  constructor(initialRunning = false, latencyMs = 50) {
    this.running = initialRunning;
    this.latencyMs = latencyMs;
  }

  private delay(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, this.latencyMs));
  }

  async getStatus(): Promise<PumpStatus> {
    await this.delay();
    return this.snapshot();
  }

  async send(cmd: PumpCommand): Promise<PumpStatus> {
    await this.delay();
    if (cmd.action === 'run') {
      this.running = true;
      this.lastExecutedTime = new Date().toISOString();
      this.lastDurationMs = cmd.durationMs;
    } else {
      this.running = false;
    }
    return this.snapshot();
  }

  private snapshot(): PumpStatus {
    return {
      isRunning: this.running,
      hardwareHealthy: true,
      lastExecutedTime: this.lastExecutedTime,
      lastDurationMs: this.lastDurationMs,
    };
  }
}

/** A MockPump that always rejects — used to test error + rollback paths. */
export class FailingPump implements Pump {
  constructor(private readonly message = 'Simulated pump failure') {}

  async getStatus(): Promise<PumpStatus> {
    throw new Error(this.message);
  }

  async send(): Promise<PumpStatus> {
    throw new Error(this.message);
  }
}
