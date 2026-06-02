import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import useTrackedResource from './useTrackedResource.js';

vi.mock('../services/storage.js', () => ({
  default: {
    getProperty: vi.fn(),
    setProperty: vi.fn(),
  }
}));

vi.mock('../hooks/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

import { getRuntimeValue, setRuntimeValue } from '../hooks/useRuntimeState.js';

function TestComponent({ storageKey, playerName, maxGetter, deps, onRender }) {
  const { current, max, update } = useTrackedResource(storageKey, playerName, maxGetter, deps);
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

  it('initializes with stored value when getProperty returns a value', () => {
    getRuntimeValue.mockReturnValue(15);
    render(<TestComponent storageKey="hp" playerName="Alice" maxGetter={mockMaxGetter} deps={[]} />);

    expect(screen.getByTestId('current').textContent).toBe('15');
    expect(getRuntimeValue).toHaveBeenCalledWith('Alice', 'hp');
  });

  it('initializes with maxGetter() result when getProperty returns null', () => {
    getRuntimeValue.mockReturnValue(null);
    render(<TestComponent storageKey="hp" playerName="Alice" maxGetter={mockMaxGetter} deps={[]} />);

    expect(screen.getByTestId('current').textContent).toBe('20');
    expect(mockMaxGetter).toHaveBeenCalled();
  });

  it('initializes with maxGetter() result when getProperty returns undefined', () => {
    getRuntimeValue.mockReturnValue(undefined);
    render(<TestComponent storageKey="hp" playerName="Alice" maxGetter={mockMaxGetter} deps={[]} />);

    expect(screen.getByTestId('current').textContent).toBe('20');
    expect(mockMaxGetter).toHaveBeenCalled();
  });

  it('update() calls storage.setProperty and updates current value', () => {
    getRuntimeValue.mockReturnValue(15);
    render(<TestComponent storageKey="hp" playerName="Alice" maxGetter={mockMaxGetter} deps={[]} />);

    act(() => {
      screen.getByTestId('update').click();
    });

    expect(setRuntimeValue).toHaveBeenCalledWith('Alice', 'hp', 10, undefined);
    expect(screen.getByTestId('current').textContent).toBe('15');
  });

  it('when deps change, re-syncs from storage', () => {
    getRuntimeValue.mockReturnValue(10);
    const { rerender } = render(
      <TestComponent storageKey="hp" playerName="Alice" maxGetter={mockMaxGetter} deps={[1]} />
    );

    getRuntimeValue.mockReturnValue(12);
    rerender(<TestComponent storageKey="hp" playerName="Alice" maxGetter={mockMaxGetter} deps={[2]} />);

    expect(screen.getByTestId('current').textContent).toBe('12');
    expect(getRuntimeValue).toHaveBeenCalledWith('Alice', 'hp');
  });

  it('max value is computed correctly from maxGetter', () => {
    mockMaxGetter.mockReturnValue(30);
    getRuntimeValue.mockReturnValue(null);
    render(<TestComponent storageKey="hp" playerName="Alice" maxGetter={mockMaxGetter} deps={[]} />);

    expect(screen.getByTestId('max').textContent).toBe('30');
    expect(mockMaxGetter).toHaveBeenCalled();
  });
});
