import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RangePicker } from '../RangePicker';
import type { TimeRange } from '../../../data/types';

describe('RangePicker', () => {
  it('renders three buttons', () => {
    const onChange = vi.fn();
    render(
      <RangePicker value={{ kind: 'latest' }} onChange={onChange} />
    );
    expect(screen.getByText('Latest')).toBeInTheDocument();
    expect(screen.getByText('Last 1h')).toBeInTheDocument();
    expect(screen.getByText('Last 24h')).toBeInTheDocument();
  });

  it('active button has aria-pressed=true', () => {
    render(
      <RangePicker value={{ kind: 'latest' }} onChange={vi.fn()} />
    );
    const latestBtn = screen.getByText('Latest').closest('button')!;
    expect(latestBtn).toHaveAttribute('aria-pressed', 'true');
    const last1hBtn = screen.getByText('Last 1h').closest('button')!;
    expect(last1hBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Latest emits { kind: latest }', () => {
    const onChange = vi.fn();
    render(
      <RangePicker value={{ kind: 'window', last: { hours: 1 } }} onChange={onChange} />
    );
    fireEvent.click(screen.getByText('Latest'));
    const emitted = onChange.mock.calls[0][0] as TimeRange;
    expect(emitted.kind).toBe('latest');
  });

  it('clicking Last 1h emits window/1h', () => {
    const onChange = vi.fn();
    render(
      <RangePicker value={{ kind: 'latest' }} onChange={onChange} />
    );
    fireEvent.click(screen.getByText('Last 1h'));
    const emitted = onChange.mock.calls[0][0] as TimeRange;
    expect(emitted.kind).toBe('window');
    if (emitted.kind === 'window') {
      expect(emitted.last).toEqual({ hours: 1 });
    }
  });

  it('clicking Last 24h emits window/24h', () => {
    const onChange = vi.fn();
    render(
      <RangePicker value={{ kind: 'latest' }} onChange={onChange} />
    );
    fireEvent.click(screen.getByText('Last 24h'));
    const emitted = onChange.mock.calls[0][0] as TimeRange;
    expect(emitted.kind).toBe('window');
    if (emitted.kind === 'window') {
      expect(emitted.last).toEqual({ hours: 24 });
    }
  });
});
