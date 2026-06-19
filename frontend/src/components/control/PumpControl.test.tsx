import type { ComponentProps } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PumpControl } from './PumpControl';
import type { PumpStatus } from '../../control/types';

const idle: PumpStatus = {
  isRunning: false,
  hardwareHealthy: true,
  lastExecutedTime: '2024-06-01T12:00:00.000Z',
  lastDurationMs: 5000,
};
const running: PumpStatus = { ...idle, isRunning: true };
const pending: PumpStatus = { ...running, pending: true };
const unhealthy: PumpStatus = { ...idle, hardwareHealthy: false };

function renderControl(overrides: Partial<ComponentProps<typeof PumpControl>> = {}) {
  const props = {
    status: idle,
    error: null,
    sending: false,
    durationSec: 5,
    onDurationChange: vi.fn(),
    onRun: vi.fn(),
    onStop: vi.fn(),
    onRetry: vi.fn(),
    ...overrides,
  };
  render(<PumpControl {...props} />);
  return props;
}

describe('PumpControl', () => {
  it('shows spinner while status is null', () => {
    renderControl({ status: null });
    expect(screen.getByRole('status', { name: /loading pump status/i })).toBeInTheDocument();
  });

  it('shows ErrorState when no status and error present', () => {
    renderControl({ status: null, error: 'Connection refused' });
    expect(screen.getByText('Connection refused')).toBeInTheDocument();
  });

  it('shows idle status', () => {
    renderControl({ status: idle });
    expect(screen.getAllByText(/idle/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/no water flowing/i)).toBeInTheDocument();
  });

  it('shows running status', () => {
    renderControl({ status: running });
    expect(screen.getByText(/running \(watering\)/i)).toBeInTheDocument();
    expect(screen.getByText(/water is flowing/i)).toBeInTheDocument();
  });

  it('surfaces a hardware fault', () => {
    renderControl({ status: unhealthy });
    expect(screen.getByText(/hardware fault/i)).toBeInTheDocument();
    expect(screen.getByText(/reports a fault/i)).toBeInTheDocument();
  });

  it('Water now is enabled when idle, disabled when running', () => {
    const { rerender } = render(
      <PumpControl
        status={idle}
        error={null}
        sending={false}
        durationSec={5}
        onDurationChange={vi.fn()}
        onRun={vi.fn()}
        onStop={vi.fn()}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /water now/i })).not.toBeDisabled();

    rerender(
      <PumpControl
        status={running}
        error={null}
        sending={false}
        durationSec={5}
        onDurationChange={vi.fn()}
        onRun={vi.fn()}
        onStop={vi.fn()}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /water now/i })).toBeDisabled();
  });

  it('Stop is enabled when running, disabled when idle', () => {
    renderControl({ status: running });
    expect(screen.getByRole('button', { name: /stop pump/i })).not.toBeDisabled();
  });

  it('Stop is disabled when idle', () => {
    renderControl({ status: idle });
    expect(screen.getByRole('button', { name: /stop pump/i })).toBeDisabled();
  });

  it('both action buttons disabled while sending', () => {
    renderControl({ status: idle, sending: true });
    expect(screen.getByRole('button', { name: /water now/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /stop pump/i })).toBeDisabled();
  });

  it('calls onRun when Water now clicked', () => {
    const onRun = vi.fn();
    renderControl({ status: idle, onRun });
    fireEvent.click(screen.getByRole('button', { name: /water now/i }));
    expect(onRun).toHaveBeenCalledOnce();
  });

  it('calls onStop when Stop clicked', () => {
    const onStop = vi.fn();
    renderControl({ status: running, onStop });
    fireEvent.click(screen.getByRole('button', { name: /stop pump/i }));
    expect(onStop).toHaveBeenCalledOnce();
  });

  it('calls onDurationChange when a duration chip is clicked', () => {
    const onDurationChange = vi.fn();
    renderControl({ status: idle, onDurationChange });
    fireEvent.click(screen.getByRole('button', { name: '10s' }));
    expect(onDurationChange).toHaveBeenCalledWith(10);
  });

  it('reflects the selected duration on the Water now button', () => {
    renderControl({ status: idle, durationSec: 30 });
    expect(screen.getByRole('button', { name: /water now/i })).toHaveTextContent('30s');
    expect(screen.getByRole('button', { name: '30s' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows pending indicator when status.pending is true', () => {
    renderControl({ status: pending, sending: true });
    expect(screen.getAllByText(/applying/i).length).toBeGreaterThan(0);
  });

  it('shows inline error with retry when error exists but status is present', () => {
    const onRetry = vi.fn();
    renderControl({ status: idle, error: 'Command failed', onRetry });
    expect(screen.getByText('Command failed')).toBeInTheDocument();
    fireEvent.click(screen.getByText(/try again/i));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
