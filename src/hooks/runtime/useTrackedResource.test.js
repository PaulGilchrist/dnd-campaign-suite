import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../../services/ui/storage.js', () => ({
  default: {
    getProperty: vi.fn(),
    setProperty: vi.fn(),
  },
}));

vi.mock('./useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  addStorageChangeListener: vi.fn().mockImplementation(() => () => {}),
}));

import { getRuntimeValue, setRuntimeValue, addStorageChangeListener } from './useRuntimeState.js';
import useTrackedResource from './useTrackedResource.js';

describe('useTrackedResource', () => {
  const mockPlayerName = 'Gandalf';
  const mockStorageKey = 'hp';
  const mockCampaignName = 'MyCampaign';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize from runtime storage when value exists', () => {
      getRuntimeValue.mockReturnValue(5);

      const maxGetter = vi.fn(() => 10);
      const { result } = renderHook(() =>
        useTrackedResource(mockStorageKey, mockPlayerName, maxGetter, 'dep1')
      );

      // useEffect runs after mount and overwrites initial state with the same value
      expect(result.current.current).toBe(5);
      expect(result.current.max).toBe(10);
      expect(getRuntimeValue).toHaveBeenCalledWith(mockPlayerName, mockStorageKey);
    });

    it('should fall through to maxGetter when storage returns null', () => {
      getRuntimeValue.mockReturnValue(null);

      const maxGetter = vi.fn(() => 20);
      const { result } = renderHook(() =>
        useTrackedResource(mockStorageKey, mockPlayerName, maxGetter, 'dep1')
      );

      expect(result.current.current).toBe(20);
      expect(result.current.max).toBe(20);
      expect(maxGetter).toHaveBeenCalled();
    });

    it('should fall through to maxGetter when storage returns undefined', () => {
      getRuntimeValue.mockReturnValue(undefined);

      const maxGetter = vi.fn(() => 15);
      const { result } = renderHook(() =>
        useTrackedResource(mockStorageKey, mockPlayerName, maxGetter, 'dep1')
      );

      expect(result.current.current).toBe(15);
      expect(maxGetter).toHaveBeenCalled();
    });

    it('should treat storage value of 0 as a valid stored value', () => {
      getRuntimeValue.mockReturnValue(0);

      const maxGetter = vi.fn(() => 10);
      const { result } = renderHook(() =>
        useTrackedResource(mockStorageKey, mockPlayerName, maxGetter, 'dep1')
      );

      // maxGetter is called in resolveCurrent (not invoked for 0) and in the return statement
      expect(result.current.current).toBe(0);
      expect(result.current.max).toBe(10);
    });

    it('should fallback to playerStats._trackedResources when storage is null', () => {
      getRuntimeValue.mockReturnValue(null);

      const playerStats = {
        _trackedResources: {
          hp: { current: 12 },
        },
      };
      const maxGetter = vi.fn(() => 20);

      const { result } = renderHook(() =>
        useTrackedResource(mockStorageKey, mockPlayerName, maxGetter, 'dep1', undefined, playerStats)
      );

      // maxGetter is called in the return statement even though resolveCurrent used _trackedResources
      expect(result.current.current).toBe(12);
      expect(result.current.max).toBe(20);
    });

    it('should fall through to maxGetter when playerStats._trackedResources is missing the key', () => {
      getRuntimeValue.mockReturnValue(null);

      const playerStats = {
        _trackedResources: {
          otherKey: { current: 5 },
        },
      };
      const maxGetter = vi.fn(() => 25);

      const { result } = renderHook(() =>
        useTrackedResource(mockStorageKey, mockPlayerName, maxGetter, 'dep1', undefined, playerStats)
      );

      expect(result.current.current).toBe(25);
      expect(result.current.max).toBe(25);
    });

    it('should return max from maxGetter on every render', () => {
      getRuntimeValue.mockReturnValue(5);

      let maxVal = 10;
      const maxGetter = vi.fn(() => maxVal);

      const { result, rerender } = renderHook(() =>
        useTrackedResource(mockStorageKey, mockPlayerName, maxGetter, 'dep1')
      );

      expect(result.current.max).toBe(10);

      maxVal = 25;
      rerender();

      expect(result.current.max).toBe(25);
    });

    it('should handle maxGetter returning 0', () => {
      getRuntimeValue.mockReturnValue(null);

      const maxGetter = vi.fn(() => 0);
      const { result } = renderHook(() =>
        useTrackedResource(mockStorageKey, mockPlayerName, maxGetter, 'dep1')
      );

      expect(result.current.current).toBe(0);
      expect(result.current.max).toBe(0);
    });
  });

  describe('update', () => {
    it('should update current and call setRuntimeValue on update', async () => {
      getRuntimeValue.mockReturnValue(10);
      setRuntimeValue.mockResolvedValue(undefined);

      const maxGetter = vi.fn(() => 20);
      const { result } = renderHook(() =>
        useTrackedResource(mockStorageKey, mockPlayerName, maxGetter, 'dep1')
      );

      expect(result.current.current).toBe(10);

      await act(async () => {
        await result.current.update(7);
      });

      expect(setRuntimeValue).toHaveBeenCalledWith(mockPlayerName, mockStorageKey, 7, undefined);
      expect(result.current.current).toBe(7);
    });

    it('should pass campaignName to setRuntimeValue', async () => {
      getRuntimeValue.mockReturnValue(10);
      setRuntimeValue.mockResolvedValue(undefined);

      const maxGetter = vi.fn(() => 20);
      const { result } = renderHook(() =>
        useTrackedResource(mockStorageKey, mockPlayerName, maxGetter, 'dep1', mockCampaignName)
      );

      await act(async () => {
        await result.current.update(15);
      });

      expect(setRuntimeValue).toHaveBeenCalledWith(mockPlayerName, mockStorageKey, 15, mockCampaignName);
      expect(result.current.current).toBe(15);
    });

    it('should update to 0', async () => {
      getRuntimeValue.mockReturnValue(10);
      setRuntimeValue.mockResolvedValue(undefined);

      const maxGetter = vi.fn(() => 20);
      const { result } = renderHook(() =>
        useTrackedResource(mockStorageKey, mockPlayerName, maxGetter, 'dep1')
      );

      await act(async () => {
        await result.current.update(0);
      });

      expect(result.current.current).toBe(0);
      expect(setRuntimeValue).toHaveBeenCalledWith(mockPlayerName, mockStorageKey, 0, undefined);
    });

    it('should update to negative value', async () => {
      getRuntimeValue.mockReturnValue(10);
      setRuntimeValue.mockResolvedValue(undefined);

      const maxGetter = vi.fn(() => 20);
      const { result } = renderHook(() =>
        useTrackedResource(mockStorageKey, mockPlayerName, maxGetter, 'dep1')
      );

      await act(async () => {
        await result.current.update(-3);
      });

      expect(result.current.current).toBe(-3);
      expect(setRuntimeValue).toHaveBeenCalledWith(mockPlayerName, mockStorageKey, -3, undefined);
    });

    it('should update to value exceeding max', async () => {
      getRuntimeValue.mockReturnValue(10);
      setRuntimeValue.mockResolvedValue(undefined);

      const maxGetter = vi.fn(() => 20);
      const { result } = renderHook(() =>
        useTrackedResource(mockStorageKey, mockPlayerName, maxGetter, 'dep1')
      );

      await act(async () => {
        await result.current.update(25);
      });

      expect(result.current.current).toBe(25);
      expect(result.current.max).toBe(20);
      expect(setRuntimeValue).toHaveBeenCalledWith(mockPlayerName, mockStorageKey, 25, undefined);
    });
  });

  describe('dependency changes', () => {
    it('should re-read storage when deps change', () => {
      getRuntimeValue
        .mockReturnValueOnce(10)
        .mockReturnValueOnce(8)
        .mockReturnValueOnce(6);

      const maxGetter = vi.fn(() => 20);
      const { result, rerender } = renderHook(
        ({ deps }) => useTrackedResource(mockStorageKey, mockPlayerName, maxGetter, deps),
        { initialProps: { deps: 'dep1' } }
      );

      expect(result.current.current).toBe(8);

      rerender({ deps: 'dep2' });

      expect(result.current.current).toBe(6);
    });

    it('should re-read when playerName changes', () => {
      getRuntimeValue
        .mockReturnValueOnce(1)
        .mockReturnValueOnce(2)
        .mockReturnValueOnce(3);

      const maxGetter = vi.fn(() => 20);
      const { result, rerender } = renderHook(
        ({ name }) => useTrackedResource(mockStorageKey, name, maxGetter, 'dep1'),
        { initialProps: { name: 'Gandalf' } }
      );

      // useState initializer reads 1, useEffect overwrites with 2
      expect(result.current.current).toBe(2);

      rerender({ name: 'Frodo' });

      // useEffect triggers with new name, reads 3
      expect(result.current.current).toBe(3);
    });

    it('should re-read when maxGetter function identity changes', () => {
      getRuntimeValue
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(null);

      const maxGetter1 = vi.fn(() => 10);
      const { result, rerender } = renderHook(
        ({ getter }) => useTrackedResource(mockStorageKey, mockPlayerName, getter, 'dep1'),
        { initialProps: { getter: maxGetter1 } }
      );

      // useState initializer: storage null → maxGetter1() → 10
      // useEffect: storage null → maxGetter1() → 10
      // return statement: maxGetter1() → 10
      expect(result.current.current).toBe(10);
      expect(maxGetter1).toHaveBeenCalled();

      const maxGetter2 = vi.fn(() => 30);
      rerender({ getter: maxGetter2 });

      // useEffect triggers with new getter identity: storage null → maxGetter2() → 30
      expect(result.current.current).toBe(30);
      expect(maxGetter2).toHaveBeenCalled();
    });

    it('should re-read when playerStats changes', () => {
      getRuntimeValue.mockReturnValue(null);

      const maxGetter = vi.fn(() => 5);

      const playerStats1 = {
        _trackedResources: { hp: { current: 15 } },
      };
      const playerStats2 = {
        _trackedResources: { hp: { current: 30 } },
      };

      const { result, rerender } = renderHook(
        ({ stats }) => useTrackedResource(mockStorageKey, mockPlayerName, maxGetter, 'dep1', undefined, stats),
        { initialProps: { stats: playerStats1 } }
      );

      // useState initializer: storage null, _trackedResources[hp].current = 15
      // useEffect: storage null, _trackedResources[hp].current = 15
      expect(result.current.current).toBe(15);

      rerender({ stats: playerStats2 });

      // useEffect triggers: storage null, _trackedResources[hp].current = 30
      expect(result.current.current).toBe(30);
    });
  });

  describe('cleanup', () => {
    it('should remove storage change listener on unmount', () => {
      const removeListener = vi.fn();
      addStorageChangeListener.mockReturnValue(removeListener);

      const { unmount } = renderHook(() =>
        useTrackedResource(mockStorageKey, mockPlayerName, () => 10, 'dep1')
      );

      expect(addStorageChangeListener).toHaveBeenCalledWith(mockPlayerName, expect.any(Function));

      unmount();

      expect(removeListener).toHaveBeenCalled();
    });

    it('should remove custom event listeners on unmount', () => {
      const removeListener = vi.fn();
      addStorageChangeListener.mockReturnValue(removeListener);

      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = renderHook(() =>
        useTrackedResource(mockStorageKey, mockPlayerName, () => 10, 'dep1')
      );

      expect(addEventListenerSpy).toHaveBeenCalledWith('focus-points-updated', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('sorcery-points-updated', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('innate-sorcery-updated', expect.any(Function));

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('focus-points-updated', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('sorcery-points-updated', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('innate-sorcery-updated', expect.any(Function));
      expect(removeListener).toHaveBeenCalled();

      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });
  });
});
