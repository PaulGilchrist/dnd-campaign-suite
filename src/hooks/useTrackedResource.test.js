import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../services/storage.js', () => ({
  default: {
    getProperty: vi.fn(),
    setProperty: vi.fn(),
  },
}));

vi.mock('../hooks/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

import { getRuntimeValue, setRuntimeValue } from '../hooks/useRuntimeState.js';

const useTrackedResource = (await import('./useTrackedResource.js')).default;

describe('useTrackedResource', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize from storage when value exists', () => {
    getRuntimeValue.mockReturnValue(5);

    const maxGetter = vi.fn(() => 10);
    const { result } = renderHook(() =>
      useTrackedResource('hp', 'Gandalf', maxGetter, 'dep1')
    );

    expect(result.current.current).toBe(5);
    expect(result.current.max).toBe(10);
    expect(getRuntimeValue).toHaveBeenCalledWith('Gandalf', 'hp');
  });

  it('should fall back to maxGetter when storage returns null', () => {
    getRuntimeValue.mockReturnValue(null);

    const maxGetter = vi.fn(() => 20);
    const { result } = renderHook(() =>
      useTrackedResource('hp', 'Gandalf', maxGetter, 'dep1')
    );

    expect(result.current.current).toBe(20);
    expect(result.current.max).toBe(20);
  });

  it('should fall back to maxGetter when storage returns undefined', () => {
    getRuntimeValue.mockReturnValue(undefined);

    const maxGetter = vi.fn(() => 15);
    const { result } = renderHook(() =>
      useTrackedResource('hp', 'Gandalf', maxGetter, 'dep1')
    );

    expect(result.current.current).toBe(15);
  });

  it('should update current and call storage.setProperty on update', () => {
    getRuntimeValue.mockReturnValue(10);

    const maxGetter = vi.fn(() => 20);
    const { result } = renderHook(() =>
      useTrackedResource('hp', 'Gandalf', maxGetter, 'dep1')
    );

    act(() => {
      result.current.update(7);
    });

    expect(setRuntimeValue).toHaveBeenCalledWith('Gandalf', 'hp', 7, undefined);
    expect(result.current.current).toBe(10);
  });

  it('should pass campaignName to storage methods', () => {
    getRuntimeValue.mockReturnValue(null);

    const maxGetter = vi.fn(() => 30);
    const { result } = renderHook(() =>
      useTrackedResource('hp', 'Gandalf', maxGetter, 'dep1', 'MyCampaign')
    );

    act(() => {
      result.current.update(15);
    });

    expect(setRuntimeValue).toHaveBeenCalledWith('Gandalf', 'hp', 15, 'MyCampaign');
  });

  it('should re-read storage when deps change', () => {
    getRuntimeValue
      .mockReturnValueOnce(10)
      .mockReturnValueOnce(8)
      .mockReturnValueOnce(6);

    const maxGetter = vi.fn(() => 20);
    const { result, rerender } = renderHook(
      ({ deps }) => useTrackedResource('hp', 'Gandalf', maxGetter, deps),
      { initialProps: { deps: 'dep1' } }
    );

    // After mount: useState got 10, then useEffect overwrote with 8
    expect(result.current.current).toBe(8);

    rerender({ deps: 'dep2' });

    // After rerender with new deps: useEffect reads 6
    expect(result.current.current).toBe(6);
  });

  it('should return max from maxGetter on every render', () => {
    getRuntimeValue.mockReturnValue(5);

    let maxVal = 10;
    const maxGetter = vi.fn(() => maxVal);

    const { result, rerender } = renderHook(() =>
      useTrackedResource('hp', 'Gandalf', maxGetter, 'dep1')
    );

    expect(result.current.max).toBe(10);

    maxVal = 25;
    rerender();

    expect(result.current.max).toBe(25);
  });

  it('should handle storage value of 0 correctly', () => {
    getRuntimeValue.mockReturnValue(0);

    const maxGetter = vi.fn(() => 10);
    const { result } = renderHook(() =>
      useTrackedResource('hp', 'Gandalf', maxGetter, 'dep1')
    );

    // 0 is != null, so it is treated as a valid stored value
    expect(result.current.current).toBe(0);
  });
});
