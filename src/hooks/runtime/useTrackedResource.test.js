// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { getRuntimeValue, setRuntimeValue, addStorageChangeListener } from './useRuntimeState.js';
import useTrackedResource from './useTrackedResource.js';

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

describe('useTrackedResource', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('returns { current, max, update } with current from runtime storage', () => {
      getRuntimeValue.mockReturnValue(5);

      const maxGetter = vi.fn(() => 10);
      const { result } = renderHook(() =>
        useTrackedResource('hp', 'Gandalf', maxGetter, 'dep1')
      );

      expect(result.current.current).toBe(5);
      expect(result.current.max).toBe(10);
      expect(typeof result.current.update).toBe('function');
      expect(getRuntimeValue).toHaveBeenCalledWith('Gandalf', 'hp');
    });

    it('falls through to maxGetter when storage returns null', () => {
      getRuntimeValue.mockReturnValue(null);

      const maxGetter = vi.fn(() => 20);
      const { result } = renderHook(() =>
        useTrackedResource('hp', 'Gandalf', maxGetter, 'dep1')
      );

      expect(result.current.current).toBe(20);
      expect(result.current.max).toBe(20);
    });

    it('falls through to maxGetter when storage returns undefined', () => {
      getRuntimeValue.mockReturnValue(undefined);

      const maxGetter = vi.fn(() => 15);
      const { result } = renderHook(() =>
        useTrackedResource('hp', 'Gandalf', maxGetter, 'dep1')
      );

      expect(result.current.current).toBe(15);
    });

    it('treats storage value of 0 as a valid stored value', () => {
      getRuntimeValue.mockReturnValue(0);

      const maxGetter = vi.fn(() => 10);
      const { result } = renderHook(() =>
        useTrackedResource('hp', 'Gandalf', maxGetter, 'dep1')
      );

      expect(result.current.current).toBe(0);
      expect(result.current.max).toBe(10);
    });

    it('falls back to playerStats._trackedResources when storage is null', () => {
      getRuntimeValue.mockReturnValue(null);

      const playerStats = {
        _trackedResources: {
          hp: { current: 12 },
        },
      };
      const maxGetter = vi.fn(() => 20);

      const { result } = renderHook(() =>
        useTrackedResource('hp', 'Gandalf', maxGetter, 'dep1', undefined, playerStats)
      );

      expect(result.current.current).toBe(12);
      expect(result.current.max).toBe(20);
    });

    it('falls through to maxGetter when playerStats._trackedResources lacks the key', () => {
      getRuntimeValue.mockReturnValue(null);

      const playerStats = {
        _trackedResources: {
          otherKey: { current: 5 },
        },
      };
      const maxGetter = vi.fn(() => 25);

      const { result } = renderHook(() =>
        useTrackedResource('hp', 'Gandalf', maxGetter, 'dep1', undefined, playerStats)
      );

      expect(result.current.current).toBe(25);
    });

    it('returns max from maxGetter on every render', () => {
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

    it('handles maxGetter returning 0', () => {
      getRuntimeValue.mockReturnValue(null);

      const maxGetter = vi.fn(() => 0);
      const { result } = renderHook(() =>
        useTrackedResource('hp', 'Gandalf', maxGetter, 'dep1')
      );

      expect(result.current.current).toBe(0);
      expect(result.current.max).toBe(0);
    });
  });

  describe('update', () => {
    it('updates current and calls setRuntimeValue', async () => {
      getRuntimeValue.mockReturnValue(10);
      setRuntimeValue.mockResolvedValue(undefined);

      const maxGetter = vi.fn(() => 20);
      const { result } = renderHook(() =>
        useTrackedResource('hp', 'Gandalf', maxGetter, 'dep1')
      );

      expect(result.current.current).toBe(10);

      await act(async () => {
        await result.current.update(7);
      });

      expect(result.current.current).toBe(7);
      expect(setRuntimeValue).toHaveBeenCalledWith('Gandalf', 'hp', 7, undefined);
    });

    it('passes campaignName to setRuntimeValue', async () => {
      getRuntimeValue.mockReturnValue(10);
      setRuntimeValue.mockResolvedValue(undefined);

      const maxGetter = vi.fn(() => 20);
      const { result } = renderHook(() =>
        useTrackedResource('hp', 'Gandalf', maxGetter, 'dep1', 'MyCampaign')
      );

      await act(async () => {
        await result.current.update(15);
      });

      expect(setRuntimeValue).toHaveBeenCalledWith('Gandalf', 'hp', 15, 'MyCampaign');
      expect(result.current.current).toBe(15);
    });

    it('allows updating to 0, negative, and values exceeding max', async () => {
      getRuntimeValue.mockReturnValue(10);
      setRuntimeValue.mockResolvedValue(undefined);

      const maxGetter = vi.fn(() => 20);
      const { result } = renderHook(() =>
        useTrackedResource('hp', 'Gandalf', maxGetter, 'dep1')
      );

      await act(async () => {
        await result.current.update(0);
      });
      expect(result.current.current).toBe(0);

      await act(async () => {
        await result.current.update(-3);
      });
      expect(result.current.current).toBe(-3);

      await act(async () => {
        await result.current.update(25);
      });
      expect(result.current.current).toBe(25);
      expect(result.current.max).toBe(20);
    });

    it('returns a promise from update', async () => {
      getRuntimeValue.mockReturnValue(10);
      setRuntimeValue.mockResolvedValue(undefined);

      const maxGetter = vi.fn(() => 20);
      const { result } = renderHook(() =>
        useTrackedResource('hp', 'Gandalf', maxGetter, 'dep1')
      );

      const updatePromise = result.current.update(5);
      expect(updatePromise).toBeInstanceOf(Promise);

      await act(async () => {
        await updatePromise;
      });
    });

    it('rejects when setRuntimeValue rejects', async () => {
      getRuntimeValue.mockReturnValue(10);
      setRuntimeValue.mockRejectedValue(new Error('network error'));

      const maxGetter = vi.fn(() => 20);
      const { result } = renderHook(() =>
        useTrackedResource('hp', 'Gandalf', maxGetter, 'dep1')
      );

      await act(async () => {
        await expect(result.current.update(5)).rejects.toThrow('network error');
      });
    });
  });

  describe('dependency changes', () => {
    it('re-reads storage when deps change', () => {
      getRuntimeValue
        .mockReturnValueOnce(10)
        .mockReturnValueOnce(8)
        .mockReturnValueOnce(6);

      const maxGetter = vi.fn(() => 20);
      const { result, rerender } = renderHook(
        ({ deps }) => useTrackedResource('hp', 'Gandalf', maxGetter, deps),
        { initialProps: { deps: 'dep1' } }
      );

      expect(result.current.current).toBe(8);

      rerender({ deps: 'dep2' });

      expect(result.current.current).toBe(6);
    });

    it('re-reads when playerName changes', () => {
      getRuntimeValue
        .mockReturnValueOnce(1)
        .mockReturnValueOnce(2)
        .mockReturnValueOnce(3);

      const maxGetter = vi.fn(() => 20);
      const { result, rerender } = renderHook(
        ({ name }) => useTrackedResource('hp', name, maxGetter, 'dep1'),
        { initialProps: { name: 'Gandalf' } }
      );

      expect(result.current.current).toBe(2);

      rerender({ name: 'Frodo' });

      expect(result.current.current).toBe(3);
    });

    it('re-reads when maxGetter function identity changes', () => {
      getRuntimeValue
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(null);

      const maxGetter1 = vi.fn(() => 10);
      const { result, rerender } = renderHook(
        ({ getter }) => useTrackedResource('hp', 'Gandalf', getter, 'dep1'),
        { initialProps: { getter: maxGetter1 } }
      );

      expect(result.current.current).toBe(10);
      expect(maxGetter1).toHaveBeenCalled();

      const maxGetter2 = vi.fn(() => 30);
      rerender({ getter: maxGetter2 });

      expect(result.current.current).toBe(30);
      expect(maxGetter2).toHaveBeenCalled();
    });

    it('re-reads when playerStats changes', () => {
      getRuntimeValue.mockReturnValue(null);

      const maxGetter = vi.fn(() => 5);

      const playerStats1 = {
        _trackedResources: { hp: { current: 15 } },
      };
      const playerStats2 = {
        _trackedResources: { hp: { current: 30 } },
      };

      const { result, rerender } = renderHook(
        ({ stats }) => useTrackedResource('hp', 'Gandalf', maxGetter, 'dep1', undefined, stats),
        { initialProps: { stats: playerStats1 } }
      );

      expect(result.current.current).toBe(15);

      rerender({ stats: playerStats2 });

      expect(result.current.current).toBe(30);
    });
  });

  describe('cleanup', () => {
    it('removes storage change listener on unmount', () => {
      const removeListener = vi.fn();
      addStorageChangeListener.mockReturnValue(removeListener);

      const { unmount } = renderHook(() =>
        useTrackedResource('hp', 'Gandalf', () => 10, 'dep1')
      );

      expect(addStorageChangeListener).toHaveBeenCalledWith('Gandalf', expect.any(Function));

      unmount();

      expect(removeListener).toHaveBeenCalled();
    });

    it('removes custom event listeners on unmount', () => {
      const removeListener = vi.fn();
      addStorageChangeListener.mockReturnValue(removeListener);

      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      renderHook(() =>
        useTrackedResource('hp', 'Gandalf', () => 10, 'dep1')
      );

      expect(addEventListenerSpy).toHaveBeenCalledWith('focus-points-updated', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('sorcery-points-updated', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('innate-sorcery-updated', expect.any(Function));

      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });
  });

  describe('behavioral integration', () => {
    it('re-reads storage when focus-points-updated event fires', async () => {
      getRuntimeValue
        .mockReturnValueOnce(10)
        .mockReturnValueOnce(10)
        .mockReturnValueOnce(15);

      const maxGetter = vi.fn(() => 20);
      const { result } = renderHook(() =>
        useTrackedResource('hp', 'Gandalf', maxGetter, 'dep1')
      );

      expect(result.current.current).toBe(10);

      await act(async () => {
        window.dispatchEvent(new Event('focus-points-updated'));
      });

      expect(result.current.current).toBe(15);
    });

    it('re-reads storage when sorcery-points-updated event fires', async () => {
      getRuntimeValue
        .mockReturnValueOnce(5)
        .mockReturnValueOnce(5)
        .mockReturnValueOnce(8);

      const maxGetter = vi.fn(() => 10);
      const { result } = renderHook(() =>
        useTrackedResource('spell-slots', 'Gandalf', maxGetter, 'dep1')
      );

      expect(result.current.current).toBe(5);

      await act(async () => {
        window.dispatchEvent(new Event('sorcery-points-updated'));
      });

      expect(result.current.current).toBe(8);
    });

    it('re-reads storage when innate-sorcery-updated event fires', async () => {
      getRuntimeValue
        .mockReturnValueOnce(3)
        .mockReturnValueOnce(3)
        .mockReturnValueOnce(6);

      const maxGetter = vi.fn(() => 10);
      const { result } = renderHook(() =>
        useTrackedResource('innate-spells', 'Gandalf', maxGetter, 'dep1')
      );

      expect(result.current.current).toBe(3);

      await act(async () => {
        window.dispatchEvent(new Event('innate-sorcery-updated'));
      });

      expect(result.current.current).toBe(6);
    });

    it('uses fresh playerName, storageKey, and playerStats from the re-read handler', async () => {
      getRuntimeValue
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(null);

      const playerStats1 = {
        _trackedResources: { hp: { current: 50 } },
      };
      const playerStats2 = {
        _trackedResources: { hp: { current: 99 } },
      };

      const maxGetter = vi.fn(() => 10);
      const { result, rerender } = renderHook(
        ({ stats }) => useTrackedResource('hp', 'Gandalf', maxGetter, 'dep1', undefined, stats),
        { initialProps: { stats: playerStats1 } }
      );

      expect(result.current.current).toBe(50);

      rerender({ stats: playerStats2 });

      expect(result.current.current).toBe(99);
    });
  });
});
