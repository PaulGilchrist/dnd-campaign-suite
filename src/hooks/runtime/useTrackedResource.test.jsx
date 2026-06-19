// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import React from 'react';
import useTrackedResource from './useTrackedResource.js';

vi.mock('../../services/ui/storage.js', () => ({
  default: {
    getProperty: vi.fn(),
    setProperty: vi.fn(),
  }
}));

vi.mock('./useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
    addStorageChangeListener: vi.fn().mockImplementation(() => () => {}),
}));

import { getRuntimeValue, setRuntimeValue, addStorageChangeListener } from './useRuntimeState.js';

function TestComponent({ storageKey, playerName, maxGetter, deps, campaignName, playerStats, onRender }) {
  const { current, max, update } = useTrackedResource(storageKey, playerName, maxGetter, deps, campaignName, playerStats);
  React.useEffect(() => {
    if (onRender) onRender({ current, max, update });
  });
  return (
    <div>
      <span data-testid="current">{current}</span>
      <span data-testid="max">{max}</span>
      <button data-testid="update" onClick={() => update(10)}>Update</button>
    </div>
  );
}

describe('useTrackedResource', () => {
  const mockMaxGetter = vi.fn(() => 20);

  beforeEach(() => {
    vi.clearAllMocks();
    mockMaxGetter.mockReturnValue(20);
  });

  afterEach(cleanup);

  it('initializes with stored value when getProperty returns a value', () => {
    getRuntimeValue.mockReturnValue(15);
    render(<TestComponent storageKey="hp" playerName="Alice" maxGetter={mockMaxGetter} deps={[]} />);

    expect(screen.getByTestId('current').textContent).toBe('15');
    expect(getRuntimeValue).toHaveBeenCalledWith('Alice', 'hp');
  });

  it('falls back to maxGetter when stored value is null', () => {
    getRuntimeValue.mockReturnValue(null);
    render(<TestComponent storageKey="hp" playerName="Alice" maxGetter={mockMaxGetter} deps={[]} />);

    expect(screen.getByTestId('current').textContent).toBe('20');
    expect(getRuntimeValue).toHaveBeenCalledWith('Alice', 'hp');
  });

  it('falls back to playerStats._trackedResources when storage returns null', () => {
    getRuntimeValue.mockReturnValue(null);
    const playerStats = {
      _trackedResources: { hp: { current: 8 } }
    };
    render(
      <TestComponent storageKey="hp" playerName="Alice" maxGetter={mockMaxGetter} deps={[]} playerStats={playerStats} />
    );

    expect(screen.getByTestId('current').textContent).toBe('8');
  });

  it('uses maxGetter when both storage and playerStats fallback are unavailable', () => {
    getRuntimeValue.mockReturnValue(null);
    const playerStats = {};
    render(
      <TestComponent storageKey="hp" playerName="Alice" maxGetter={mockMaxGetter} deps={[]} playerStats={playerStats} />
    );

    expect(screen.getByTestId('current').textContent).toBe('20');
    expect(mockMaxGetter).toHaveBeenCalled();
  });

  it('update() calls setRuntimeValue with the passed value and updates display', async () => {
    getRuntimeValue.mockReturnValue(15);
    setRuntimeValue.mockResolvedValue(undefined);
    render(<TestComponent storageKey="hp" playerName="Alice" maxGetter={mockMaxGetter} deps={[]} campaignName="test" />);

    await act(async () => {
      screen.getByTestId('update').click();
    });

    expect(setRuntimeValue).toHaveBeenCalledWith('Alice', 'hp', 10, 'test');
    expect(screen.getByTestId('current').textContent).toBe('10');
  });

  it('update() uses undefined campaignName when not provided', async () => {
    getRuntimeValue.mockReturnValue(5);
    setRuntimeValue.mockResolvedValue(undefined);
    render(<TestComponent storageKey="sp" playerName="Bob" maxGetter={mockMaxGetter} deps={[]} />);

    await act(async () => {
      screen.getByTestId('update').click();
    });

    expect(setRuntimeValue).toHaveBeenCalledWith('Bob', 'sp', 10, undefined);
    expect(screen.getByTestId('current').textContent).toBe('10');
  });

  it('when deps change, re-syncs from storage', () => {
    getRuntimeValue.mockReturnValue(10);
    const { rerender } = render(
      <TestComponent storageKey="hp" playerName="Alice" maxGetter={mockMaxGetter} deps={[1]} />
    );

    getRuntimeValue.mockReturnValue(12);
    rerender(<TestComponent storageKey="hp" playerName="Alice" maxGetter={mockMaxGetter} deps={[2]} />);

    expect(screen.getByTestId('current').textContent).toBe('12');
    expect(getRuntimeValue).toHaveBeenNthCalledWith(2, 'Alice', 'hp');
  });

  it('max value is computed from maxGetter and displayed', () => {
    mockMaxGetter.mockReturnValue(30);
    getRuntimeValue.mockReturnValue(null);
    render(<TestComponent storageKey="hp" playerName="Alice" maxGetter={mockMaxGetter} deps={[]} />);

    expect(screen.getByTestId('max').textContent).toBe('30');
    expect(mockMaxGetter).toHaveBeenCalledTimes(3);
  });

  it('handles 0 as a valid stored value', () => {
    getRuntimeValue.mockReturnValue(0);
    render(<TestComponent storageKey="hp" playerName="Alice" maxGetter={mockMaxGetter} deps={[]} />);

    expect(screen.getByTestId('current').textContent).toBe('0');
    expect(getRuntimeValue).toHaveBeenCalledWith('Alice', 'hp');
  });

  it('handles negative stored value', () => {
    getRuntimeValue.mockReturnValue(-5);
    render(<TestComponent storageKey="hp" playerName="Alice" maxGetter={mockMaxGetter} deps={[]} />);

    expect(screen.getByTestId('current').textContent).toBe('-5');
    expect(getRuntimeValue).toHaveBeenCalledWith('Alice', 'hp');
  });

  it('clears storage change listener on unmount', () => {
    const removeListener = vi.fn();
    addStorageChangeListener.mockReturnValue(removeListener);

    render(<TestComponent storageKey="hp" playerName="Alice" maxGetter={mockMaxGetter} deps={[]} />);
    cleanup();

    expect(removeListener).toHaveBeenCalled();
  });
});
