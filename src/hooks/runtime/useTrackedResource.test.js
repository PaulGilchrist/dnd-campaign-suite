// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import {
  getRuntimeValue,
  setRuntimeValue,
  addStorageChangeListener,
  hasRuntimeValue,
} from './useRuntimeState.js';
import useTrackedResource from './useTrackedResource.js';

vi.mock('./useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  addStorageChangeListener: vi.fn().mockImplementation(() => () => {}),
  hasRuntimeValue: vi.fn(),
}));

describe('useTrackedResource', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization: resolving current value', () => {
    it('reads current from runtime storage when the key exists with a truthy value', () => {
      getRuntimeValue.mockReturnValue(5);
      hasRuntimeValue.mockReturnValue(true);

      const maxGetter = vi.fn(() => 10);
      const { result } = renderHook(() =>
        useTrackedResource({ storageKey: 'hp', playerName: 'Gandalf', maxGetter, deps: 'dep1' })
      );

      expect(result.current.current).toBe(5);
      expect(result.current.max).toBe(10);
      expect(getRuntimeValue).toHaveBeenCalledWith('Gandalf', 'hp');
    });

    it('reads current from runtime storage when the key exists with value 0', () => {
      getRuntimeValue.mockReturnValue(0);
      hasRuntimeValue.mockReturnValue(true);

      const maxGetter = vi.fn(() => 10);
      const { result } = renderHook(() =>
        useTrackedResource({ storageKey: 'hp', playerName: 'Gandalf', maxGetter, deps: 'dep1' })
      );

      expect(result.current.current).toBe(0);
      expect(result.current.max).toBe(10);
    });

    it('reads current from runtime storage when the key exists with a negative value', () => {
      getRuntimeValue.mockReturnValue(-3);
      hasRuntimeValue.mockReturnValue(true);

      const maxGetter = vi.fn(() => 20);
      const { result } = renderHook(() =>
        useTrackedResource({ storageKey: 'hp', playerName: 'Gandalf', maxGetter, deps: 'dep1' })
      );

      expect(result.current.current).toBe(-3);
    });

    it('uses the computed max from maxGetter when storage key is explicitly null', () => {
      // Key exists but value was explicitly reset to null
      getRuntimeValue.mockReturnValue(null);
      hasRuntimeValue.mockReturnValue(true);

      const maxGetter = vi.fn(() => 20);
      const { result } = renderHook(() =>
        useTrackedResource({ storageKey: 'hp', playerName: 'Gandalf', maxGetter, deps: 'dep1' })
      );

      expect(result.current.current).toBe(20);
      expect(maxGetter).toHaveBeenCalled();
    });

    it('uses the computed max from maxGetter when storage key does not exist', () => {
      getRuntimeValue.mockReturnValue(null);
      hasRuntimeValue.mockReturnValue(false);

      const maxGetter = vi.fn(() => 25);
      const { result } = renderHook(() =>
        useTrackedResource({ storageKey: 'hp', playerName: 'Gandalf', maxGetter, deps: 'dep1' })
      );

      expect(result.current.current).toBe(25);
      expect(maxGetter).toHaveBeenCalled();
    });

    it('falls back to playerStats._trackedResources when storage has no value', () => {
      getRuntimeValue.mockReturnValue(null);
      hasRuntimeValue.mockReturnValue(false);

      const playerStats = {
        _trackedResources: {
          hp: { current: 12 },
        },
      };
      const maxGetter = vi.fn(() => 20);

      const { result } = renderHook(() =>
        useTrackedResource({ storageKey: 'hp', playerName: 'Gandalf', maxGetter, deps: 'dep1', playerStats })
      );

      expect(result.current.current).toBe(12);
      // maxGetter is called once for the returned max value
      expect(maxGetter).toHaveBeenCalledTimes(1);
    });

    it('falls back to playerStats._trackedResources with current of 0', () => {
      getRuntimeValue.mockReturnValue(null);
      hasRuntimeValue.mockReturnValue(false);

      const playerStats = {
        _trackedResources: {
          hp: { current: 0 },
        },
      };
      const maxGetter = vi.fn(() => 20);

      const { result } = renderHook(() =>
        useTrackedResource({ storageKey: 'hp', playerName: 'Gandalf', maxGetter, deps: 'dep1', playerStats })
      );

      expect(result.current.current).toBe(0);
      expect(maxGetter).toHaveBeenCalledTimes(1);
    });

    it('skips playerStats fallback when the key is missing and uses maxGetter', () => {
      getRuntimeValue.mockReturnValue(null);
      hasRuntimeValue.mockReturnValue(false);

      const playerStats = {
        _trackedResources: {
          otherKey: { current: 5 },
        },
      };
      const maxGetter = vi.fn(() => 25);

      const { result } = renderHook(() =>
        useTrackedResource({ storageKey: 'hp', playerName: 'Gandalf', maxGetter, deps: 'dep1', playerStats })
      );

      expect(result.current.current).toBe(25);
    });

    it('uses defaultValue when storage is empty, playerStats lacks the key, and defaultValue is provided', () => {
      getRuntimeValue.mockReturnValue(null);
      hasRuntimeValue.mockReturnValue(false);

      const playerStats = {
        _trackedResources: {},
      };
      const maxGetter = vi.fn(() => 25);

      const { result } = renderHook(() =>
        useTrackedResource({ storageKey: 'hp', playerName: 'Gandalf', maxGetter, deps: 'dep1', playerStats, defaultValue: 15 })
      );

      expect(result.current.current).toBe(15);
      // maxGetter is called once for the returned max value
      expect(maxGetter).toHaveBeenCalledTimes(1);
    });

    it('uses maxGetter as final fallback when defaultValue is null', () => {
      getRuntimeValue.mockReturnValue(null);
      hasRuntimeValue.mockReturnValue(false);

      const maxGetter = vi.fn(() => 30);
      const { result } = renderHook(() =>
        useTrackedResource({ storageKey: 'hp', playerName: 'Gandalf', maxGetter, deps: 'dep1', playerStats: null, defaultValue: null })
      );

      expect(result.current.current).toBe(30);
    });

    it('prefers storage over playerStats when both have values', () => {
      getRuntimeValue.mockReturnValue(8);
      hasRuntimeValue.mockReturnValue(true);

      const playerStats = {
        _trackedResources: {
          hp: { current: 12 },
        },
      };
      const maxGetter = vi.fn(() => 20);

      const { result } = renderHook(() =>
        useTrackedResource({ storageKey: 'hp', playerName: 'Gandalf', maxGetter, deps: 'dep1', playerStats })
      );

      expect(result.current.current).toBe(8);
      // maxGetter is called once for the returned max value
      expect(maxGetter).toHaveBeenCalledTimes(1);
    });

    it('prefers playerStats over defaultValue when both are available', () => {
      getRuntimeValue.mockReturnValue(null);
      hasRuntimeValue.mockReturnValue(false);

      const playerStats = {
        _trackedResources: {
          hp: { current: 12 },
        },
      };

      const { result } = renderHook(() =>
        useTrackedResource({ storageKey: 'hp', playerName: 'Gandalf', maxGetter: () => 20, deps: 'dep1', playerStats, defaultValue: 5 })
      );

      expect(result.current.current).toBe(12);
    });
  });

  describe('initialization: max value', () => {
    it('returns max from maxGetter on every render', () => {
      getRuntimeValue.mockReturnValue(5);

      let maxVal = 10;
      const maxGetter = vi.fn(() => maxVal);

      const { result, rerender } = renderHook(() =>
        useTrackedResource({ storageKey: 'hp', playerName: 'Gandalf', maxGetter, deps: 'dep1' })
      );

      expect(result.current.max).toBe(10);

      maxVal = 25;
      rerender();

      expect(result.current.max).toBe(25);
    });
  });

  describe('update', () => {
    it('updates current and persists via setRuntimeValue', async () => {
      getRuntimeValue.mockReturnValue(10);
      hasRuntimeValue.mockReturnValue(true);
      setRuntimeValue.mockResolvedValue(undefined);

      const maxGetter = vi.fn(() => 20);
      const { result } = renderHook(() =>
        useTrackedResource({ storageKey: 'hp', playerName: 'Gandalf', maxGetter, deps: 'dep1' })
      );

      expect(result.current.current).toBe(10);

      await act(async () => {
        await result.current.update(7);
      });

      expect(result.current.current).toBe(7);
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Gandalf',
        'hp',
        7,
        undefined
      );
    });

    it('passes campaignName to setRuntimeValue', async () => {
      getRuntimeValue.mockReturnValue(10);
      hasRuntimeValue.mockReturnValue(true);
      setRuntimeValue.mockResolvedValue(undefined);

      const maxGetter = vi.fn(() => 20);
      const { result } = renderHook(() =>
        useTrackedResource({ storageKey: 'hp', playerName: 'Gandalf', maxGetter, deps: 'dep1', campaignName: 'MyCampaign' })
      );

      await act(async () => {
        await result.current.update(15);
      });

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Gandalf',
        'hp',
        15,
        'MyCampaign'
      );
      expect(result.current.current).toBe(15);
    });

    it('allows setting any value including 0, negative, and values exceeding max', async () => {
      getRuntimeValue.mockReturnValue(10);
      hasRuntimeValue.mockReturnValue(true);
      setRuntimeValue.mockResolvedValue(undefined);

      const maxGetter = vi.fn(() => 20);
      const { result } = renderHook(() =>
        useTrackedResource({ storageKey: 'hp', playerName: 'Gandalf', maxGetter, deps: 'dep1' })
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
        await result.current.update(99);
      });
      expect(result.current.current).toBe(99);
    });

    it('propagates setRuntimeValue rejection', async () => {
      getRuntimeValue.mockReturnValue(10);
      hasRuntimeValue.mockReturnValue(true);
      setRuntimeValue.mockRejectedValue(new Error('network error'));

      const maxGetter = vi.fn(() => 20);
      const { result } = renderHook(() =>
        useTrackedResource({ storageKey: 'hp', playerName: 'Gandalf', maxGetter, deps: 'dep1' })
      );

      await act(async () => {
        await expect(result.current.update(5)).rejects.toThrow('network error');
      });
    });

    it('does NOT update local current when setRuntimeValue rejects', async () => {
      getRuntimeValue.mockReturnValue(10);
      hasRuntimeValue.mockReturnValue(true);
      setRuntimeValue.mockRejectedValue(new Error('network error'));

      const maxGetter = vi.fn(() => 20);
      const { result } = renderHook(() =>
        useTrackedResource({ storageKey: 'hp', playerName: 'Gandalf', maxGetter, deps: 'dep1' })
      );

      expect(result.current.current).toBe(10);

      await act(async () => {
        await result.current.update(3).catch(() => {});
      });

      // setCurrent runs after await, so rejection prevents the local update
      expect(result.current.current).toBe(10);
    });
  });

  describe('re-resolution on dependency changes', () => {
    it('re-reads storage when deps change', () => {
      getRuntimeValue
        .mockReturnValueOnce(10)
        .mockReturnValueOnce(8)
        .mockReturnValueOnce(6);
      hasRuntimeValue.mockReturnValue(true);

      const maxGetter = vi.fn(() => 20);
      const { result, rerender } = renderHook(
        ({ deps }) => useTrackedResource({ storageKey: 'hp', playerName: 'Gandalf', maxGetter, deps }),
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
      hasRuntimeValue.mockReturnValue(true);

      const maxGetter = vi.fn(() => 20);
      const { result, rerender } = renderHook(
        ({ name }) => useTrackedResource({ storageKey: 'hp', playerName: name, maxGetter, deps: 'dep1' }),
        { initialProps: { name: 'Gandalf' } }
      );

      expect(result.current.current).toBe(2);

      rerender({ name: 'Frodo' });

      expect(result.current.current).toBe(3);
    });

    it('re-reads when playerStats changes', () => {
      getRuntimeValue.mockReturnValue(null);
      hasRuntimeValue.mockReturnValue(false);

      const maxGetter = vi.fn(() => 5);

      const playerStats1 = {
        _trackedResources: { hp: { current: 15 } },
      };
      const playerStats2 = {
        _trackedResources: { hp: { current: 30 } },
      };

      const { result, rerender } = renderHook(
        ({ stats }) =>
          useTrackedResource({ storageKey: 'hp', playerName: 'Gandalf', maxGetter, deps: 'dep1', playerStats: stats }),
        { initialProps: { stats: playerStats1 } }
      );

      expect(result.current.current).toBe(15);

      rerender({ stats: playerStats2 });

      expect(result.current.current).toBe(30);
    });

    it('re-reads when campaignName changes', () => {
      getRuntimeValue
        .mockReturnValueOnce(10)
        .mockReturnValueOnce(10)
        .mockReturnValueOnce(42);
      hasRuntimeValue.mockReturnValue(true);

      const maxGetter = vi.fn(() => 20);
      const { result, rerender } = renderHook(
        ({ campaign }) =>
          useTrackedResource({ storageKey: 'hp', playerName: 'Gandalf', maxGetter, deps: 'dep1', campaignName: campaign }),
        { initialProps: { campaign: 'CampaignA' } }
      );

      expect(result.current.current).toBe(10);

      rerender({ campaign: 'CampaignB' });

      expect(result.current.current).toBe(42);
    });

    it('re-reads when storageKey changes', () => {
      getRuntimeValue
        .mockReturnValueOnce(10)
        .mockReturnValueOnce(10)
        .mockReturnValueOnce(7)
        .mockReturnValueOnce(7)
        .mockReturnValueOnce(3);
      hasRuntimeValue.mockReturnValue(true);

      const maxGetter = vi.fn(() => 20);
      const { result, rerender } = renderHook(
        ({ key }) => useTrackedResource({ storageKey: key, playerName: 'Gandalf', maxGetter, deps: 'dep1' }),
        { initialProps: { key: 'hp' } }
      );

      expect(result.current.current).toBe(10);

      rerender({ key: 'sp' });

      expect(result.current.current).toBe(7);
    });
  });

  describe('cleanup', () => {
    it('removes storage change listener on unmount', () => {
      const removeListener = vi.fn();
      addStorageChangeListener.mockReturnValue(removeListener);

      const { unmount } = renderHook(() =>
        useTrackedResource({ storageKey: 'hp', playerName: 'Gandalf', maxGetter: () => 10, deps: 'dep1' })
      );

      expect(addStorageChangeListener).toHaveBeenCalledWith(
        'Gandalf',
        expect.any(Function)
      );

      unmount();

      expect(removeListener).toHaveBeenCalled();
    });

    it('removes all three window event listeners on unmount', () => {
      const removeListener = vi.fn();
      addStorageChangeListener.mockReturnValue(removeListener);

      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = renderHook(() =>
        useTrackedResource({ storageKey: 'hp', playerName: 'Gandalf', maxGetter: () => 10, deps: 'dep1' })
      );

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'focus-points-updated',
        expect.any(Function)
      );
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'sorcery-points-updated',
        expect.any(Function)
      );
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'innate-sorcery-updated',
        expect.any(Function)
      );

      removeEventListenerSpy.mockRestore();
    });
  });

  describe('event-driven re-resolution', () => {
    it('re-reads storage when focus-points-updated event fires', async () => {
      getRuntimeValue
        .mockReturnValueOnce(10)
        .mockReturnValueOnce(10)
        .mockReturnValueOnce(15);
      hasRuntimeValue.mockReturnValue(true);

      const maxGetter = vi.fn(() => 20);
      const { result } = renderHook(() =>
        useTrackedResource({ storageKey: 'hp', playerName: 'Gandalf', maxGetter, deps: 'dep1' })
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
      hasRuntimeValue.mockReturnValue(true);

      const maxGetter = vi.fn(() => 10);
      const { result } = renderHook(() =>
        useTrackedResource({ storageKey: 'sp', playerName: 'Gandalf', maxGetter, deps: 'dep1' })
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
      hasRuntimeValue.mockReturnValue(true);

      const maxGetter = vi.fn(() => 10);
      const { result } = renderHook(() =>
        useTrackedResource({ storageKey: 'innateSorcery', playerName: 'Gandalf', maxGetter, deps: 'dep1' })
      );

      expect(result.current.current).toBe(3);

      await act(async () => {
        window.dispatchEvent(new Event('innate-sorcery-updated'));
      });

      expect(result.current.current).toBe(6);
    });

    it('uses fresh playerName, storageKey, and playerStats from the re-read handler', () => {
      getRuntimeValue
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(null);
      hasRuntimeValue.mockReturnValue(false);

      const playerStats1 = {
        _trackedResources: { hp: { current: 50 } },
      };
      const playerStats2 = {
        _trackedResources: { hp: { current: 99 } },
      };

      const maxGetter = vi.fn(() => 10);
      const { result, rerender } = renderHook(
        ({ stats }) =>
          useTrackedResource({ storageKey: 'hp', playerName: 'Gandalf', maxGetter, deps: 'dep1', playerStats: stats }),
        { initialProps: { stats: playerStats1 } }
      );

      expect(result.current.current).toBe(50);

      rerender({ stats: playerStats2 });

      expect(result.current.current).toBe(99);
    });
  });
});
