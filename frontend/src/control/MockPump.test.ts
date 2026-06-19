import { describe, it, expect } from 'vitest';
import { MockPump, FailingPump } from './MockPump';
import type { Pump } from './Pump';

describe('MockPump', () => {
  it('starts idle by default', async () => {
    const pump = new MockPump(false, 0);
    const status = await pump.getStatus();
    expect(status.isRunning).toBe(false);
    expect(status.hardwareHealthy).toBe(true);
  });

  it('starts running when specified', async () => {
    const pump = new MockPump(true, 0);
    expect((await pump.getStatus()).isRunning).toBe(true);
  });

  it('runs on send({ action: "run" }) and records duration', async () => {
    const pump = new MockPump(false, 0);
    const status = await pump.send({ action: 'run', durationMs: 3000 });
    expect(status.isRunning).toBe(true);
    expect(status.lastDurationMs).toBe(3000);
    expect(status.lastExecutedTime).toBeTruthy();
  });

  it('stops on send({ action: "stop" })', async () => {
    const pump = new MockPump(true, 0);
    const status = await pump.send({ action: 'stop' });
    expect(status.isRunning).toBe(false);
  });

  it('reflects updated state via getStatus after a run', async () => {
    const pump = new MockPump(false, 0);
    await pump.send({ action: 'run', durationMs: 1000 });
    expect((await pump.getStatus()).isRunning).toBe(true);
  });
});

describe('FailingPump', () => {
  it('rejects getStatus with error message', async () => {
    await expect(new FailingPump('test error').getStatus()).rejects.toThrow('test error');
  });

  it('rejects send with error message', async () => {
    const pump: Pump = new FailingPump('send error');
    await expect(pump.send({ action: 'run', durationMs: 1000 })).rejects.toThrow('send error');
  });
});
