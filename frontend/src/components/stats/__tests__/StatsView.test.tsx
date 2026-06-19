import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { server } from '../../../mocks/server';
import { StatsView } from '../StatsView';

// Start MSW server for this test suite
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// recharts uses ResizeObserver; polyfill it in jsdom
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('StatsView', () => {
  it('shows loading spinner initially', () => {
    render(<StatsView />);
    expect(screen.getAllByRole('status').length).toBeGreaterThan(0);
  });

  it('renders value cards for all metrics after data loads', async () => {
    render(<StatsView />);

    // Wait for at least one value to appear (spinner disappears)
    await waitFor(
      () => {
        // Each ValueCard renders a data-testid `value-<metric>`
        expect(screen.getByTestId('value-atmosphere.temperature')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    expect(screen.getByTestId('value-atmosphere.pressure')).toBeInTheDocument();
    expect(screen.getByTestId('value-soil.moisture')).toBeInTheDocument();
  });

  it('renders the chart area', async () => {
    render(<StatsView />);

    await waitFor(
      () => expect(screen.getByText('Sensor history')).toBeInTheDocument(),
      { timeout: 3000 }
    );
  });

  it('renders the RangePicker buttons', async () => {
    render(<StatsView />);

    expect(screen.getByText('Latest')).toBeInTheDocument();
    expect(screen.getByText('Last 1h')).toBeInTheDocument();
    expect(screen.getByText('Last 24h')).toBeInTheDocument();
  });
});
