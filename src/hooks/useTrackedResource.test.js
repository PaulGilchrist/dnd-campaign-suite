import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

let storage;
vi.mock('../services/storage.js', () => {
  const mod = {
    default: {
      getProperty: vi.fn(),
      setProperty: vi.fn(),
    },
  };
  storage = mod.default;
  return mod;
});

const useTrackedResource = (await import('./useTrackedResource.js')).default;

describe('useTrackedResource', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize from storage when value exists', () => {
    storage.getProperty.mockReturnValue(5);

    const maxGetter = vi.fn(() => 10);
    const { result } = renderHook(() =>
      useTrackedResource('hp', 'Gandalf', maxGetter, 'dep1')
    );

    expect(result.current.current).toBe(5);
    expect(result.current.max).toBe(10);
    expect(storage.getProperty).toHaveBeenCalledWith('Gandalf', 'hp', undefined);
  });

  it('should fall back to maxGetter when storage returns null', () => {
    storage.getProperty.mockReturnValue(null);

    const maxGetter = vi.fn(() => 20);
    const { result } = renderHook(() =>
      useTrackedResource('hp', 'Gandalf', maxGetter, 'dep1')
    );

    expect(result.current.current).toBe(20);
    expect(result.current.max).toBe(20);
  });

  it('should fall back to maxGetter when storage returns undefined', () => {
    storage.getProperty.mockReturnValue(undefined);

    const maxGetter = vi.fn(() => 15);
    const { result } = renderHook(() =>
      useTrackedResource('hp', 'Gandalf', maxGetter, 'dep1')
    );

    expect(result.current.current).toBe(15);
  });

  it('should update current and call storage.setProperty on update', () => {
    storage.getProperty.mockReturnValue(10);

    const maxGetter = vi.fn(() => 20);
    const { result } = renderHook(() =>
      useTrackedResource('hp', 'Gandalf', maxGetter, 'dep1')
    );

    act(() => {
      result.current.update(7);
    });

    expect(storage.setProperty).toHaveBeenCalledWith('Gandalf', 'hp', 7, undefined);
    expect(result.current.current).toBe(7);
  });

  it('should pass campaignName to storage methods', () => {
    storage.getProperty.mockReturnValue(null);

    const maxGetter = vi.fn(() => 30);
    const { result } = renderHook(() =>
      useTrackedResource('hp', 'Gandalf', maxGetter, 'dep1', 'MyCampaign')
    );

    expect(storage.getProperty).toHaveBeenCalledWith('Gandalf', 'hp', 'MyCampaign');

    act(() => {
      result.current.update(15);
    });

    expect(storage.setProperty).toHaveBeenCalledWith('Gandalf', 'hp', 15, 'MyCampaign');
  });

  it('should re-read storage when deps change', () => {
    // useState initializer reads first (10), then useEffect on mount reads second (8),
    // then rerender with new deps triggers useEffect again reading third (6)
    storage.getProperty
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
    storage.getProperty.mockReturnValue(5);

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
    storage.getProperty.mockReturnValue(0);

    const maxGetter = vi.fn(() => 10);
    const { result } = renderHook(() =>
      useTrackedResource('hp', 'Gandalf', maxGetter, 'dep1')
    );

    // 0 is != null, so it is treated as a valid stored value
    expect(result.current.current).toBe(0);
  });
});
