// @maintained-by-ai 2026-11-26
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

// This file owns the hook seam: resolution priority chain, write-through
// (setRuntimeValue with campaign scoping), dependency re-resolution, event/
// listener lifecycle. Stored-bucket clamp math is owned by
// useTrackedResource.max-clamp.test.js — no clamp call-count pins here.

describe('useTrackedResource', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization: resolving current value', () => {
    // Priority chain: stored non-null (clamped) → stored null → maxGetter
    // bypass → playerStats._trackedResources → defaultValue → maxGetter.

    it.each([5, 0])('reads stored value %s from runtime storage when the key exists', (stored) => {
      // 0 pins the `!= null` test: a spent-to-zero bucket must not fall
      // through to the derived-max/default branches.
      getRuntimeValue.mockReturnValue(stored);
      hasRuntimeValue.mockReturnValue(true);

      const { result } = renderHook(() =>
        useTrackedResource({ storageKey: 'hp', playerName: 'Gandalf', maxGetter: () => 10, deps: 'dep1' })
      );

      expect(result.current.current).toBe(stored);
      expect(result.current.max).toBe(10);
      expect(getRuntimeValue).toHaveBeenCalledWith('Gandalf', 'hp');
    });

    it('resolves an explicitly-null stored value to the computed max, beating playerStats and defaultValue', () => {
      // Key exists but the bucket was reset to null: line-29 branch bypasses
      // both lower-priority fallbacks.
      getRuntimeValue.mockReturnValue(null);
      hasRuntimeValue.mockReturnValue(true);

      const playerStats = { _trackedResources: { hp: { current: 12 } } };
      const { result } = renderHook(() =>
        useTrackedResource({
          storageKey: 'hp',
          playerName: 'Gandalf',
          maxGetter: () => 20,
          deps: 'dep1',
          playerStats,
          defaultValue: 99,
        })
      );

      expect(result.current.current).toBe(20);
    });

    it('falls back to the computed max when storage misses and playerStats lacks the key', () => {
      getRuntimeValue.mockReturnValue(null);
      hasRuntimeValue.mockReturnValue(false);

      const playerStats = { _trackedResources: { otherKey: { current: 5 } } };
      const { result } = renderHook(() =>
        useTrackedResource({ storageKey: 'hp', playerName: 'Gandalf', maxGetter: () => 25, deps: 'dep1', playerStats })
      );

      expect(result.current.current).toBe(25);
    });

    it.each([12, 0])('falls back to playerStats._trackedResources (current %s) when storage has no value', (current) => {
      // 0 pins that a present pool bucket wins even when its value is 0.
      // defaultValue 99 also pins pool-over-default precedence in the same rig.
      getRuntimeValue.mockReturnValue(null);
      hasRuntimeValue.mockReturnValue(false);

      const playerStats = { _trackedResources: { hp: { current } } };
      const { result } = renderHook(() =>
        useTrackedResource({ storageKey: 'hp', playerName: 'Gandalf', maxGetter: () => 20, deps: 'dep1', playerStats, defaultValue: 99 })
      );

      expect(result.current.current).toBe(current);
    });

    it('uses defaultValue when storage is empty, playerStats lacks the key, and defaultValue is provided', () => {
      getRuntimeValue.mockReturnValue(null);
      hasRuntimeValue.mockReturnValue(false);

      const { result } = renderHook(() =>
        useTrackedResource({
          storageKey: 'hp',
          playerName: 'Gandalf',
          maxGetter: () => 25,
          deps: 'dep1',
          playerStats: { _trackedResources: {} },
          defaultValue: 15,
        })
      );

      expect(result.current.current).toBe(15);
    });

    it('prefers stored runtime value over playerStats when both exist', () => {
      getRuntimeValue.mockReturnValue(8);
      hasRuntimeValue.mockReturnValue(true);

      const playerStats = { _trackedResources: { hp: { current: 12 } } };
      const { result } = renderHook(() =>
        useTrackedResource({ storageKey: 'hp', playerName: 'Gandalf', maxGetter: () => 20, deps: 'dep1', playerStats })
      );

      expect(result.current.current).toBe(8);
    });
  });

  describe('max derivation', () => {
    it('re-evaluates max from maxGetter on every render', () => {
      getRuntimeValue.mockReturnValue(5);
      hasRuntimeValue.mockReturnValue(true);

      let maxVal = 10;
      const { result, rerender } = renderHook(() =>
        useTrackedResource({ storageKey: 'hp', playerName: 'Gandalf', maxGetter: () => maxVal, deps: 'dep1' })
      );

      expect(result.current.max).toBe(10);

      maxVal = 25;
      rerender();

      expect(result.current.max).toBe(25);
    });
  });

  describe('update: write-through to the runtime store', () => {
    it.each([
      ['no campaign', undefined, undefined],
      ['campaign scoping', 'MyCampaign', 'MyCampaign'],
    ])('persists via setRuntimeValue with %s as 4th argument', async (_label, campaignName, expectedCampaign) => {
      getRuntimeValue.mockReturnValue(10);
      hasRuntimeValue.mockReturnValue(true);
      setRuntimeValue.mockResolvedValue(undefined);

      // Stable getter identity: an inline arrow would re-fire the resolve
      // effect on the update's own re-render and mask the write-through.
      const maxGetter = () => 20;
      const { result } = renderHook(() =>
        useTrackedResource({ storageKey: 'hp', playerName: 'Gandalf', maxGetter, deps: 'dep1', campaignName })
      );

      await act(async () => {
        await result.current.update(7);
      });

      expect(setRuntimeValue).toHaveBeenCalledWith('Gandalf', 'hp', 7, expectedCampaign);
      expect(result.current.current).toBe(7);
    });

    it('writes any value unclamped (0, negative, above max) — commit lanes own the arithmetic', async () => {
      getRuntimeValue.mockReturnValue(10);
      hasRuntimeValue.mockReturnValue(true);
      setRuntimeValue.mockResolvedValue(undefined);

      const maxGetter = () => 20;
      const { result } = renderHook(() =>
        useTrackedResource({ storageKey: 'hp', playerName: 'Gandalf', maxGetter, deps: 'dep1' })
      );

      for (const val of [0, -3, 99]) {
        await act(async () => {
          await result.current.update(val);
        });
        expect(result.current.current).toBe(val);
        expect(setRuntimeValue).toHaveBeenLastCalledWith('Gandalf', 'hp', val, undefined);
      }
    });

    it('propagates setRuntimeValue rejection and does NOT update local current', async () => {
      getRuntimeValue.mockReturnValue(10);
      hasRuntimeValue.mockReturnValue(true);
      setRuntimeValue.mockRejectedValue(new Error('network error'));

      const { result } = renderHook(() =>
        useTrackedResource({ storageKey: 'hp', playerName: 'Gandalf', maxGetter: () => 20, deps: 'dep1' })
      );

      await act(async () => {
        await expect(result.current.update(3)).rejects.toThrow('network error');
      });

      // setCurrent runs after await, so rejection prevents the local update
      expect(result.current.current).toBe(10);
    });
  });

  describe('re-resolution on dependency changes', () => {
    // Behavioral rig: update() drifts local state away from the store, then a
    // dependency change must re-adopt the stored value — proving the effect
    // re-ran and re-read with the new identity, with no call-order pinning.
    it.each([
      ['deps', { deps: 'dep2' }, ['Gandalf', 'hp']],
      ['playerName', { playerName: 'Frodo' }, ['Frodo', 'hp']],
      ['campaignName', { campaignName: 'CampaignB' }, ['Gandalf', 'hp']],
      ['storageKey', { storageKey: 'sp' }, ['Gandalf', 'sp']],
    ])('re-adopts the stored value when %s changes', async (_label, changed, lastReadArgs) => {
      getRuntimeValue.mockReturnValue(10);
      hasRuntimeValue.mockReturnValue(true);
      setRuntimeValue.mockResolvedValue(undefined);

      const maxGetter = () => 20;
      const { result, rerender } = renderHook(
        (props) =>
          useTrackedResource({
            storageKey: 'hp',
            playerName: 'Gandalf',
            maxGetter,
            deps: 'dep1',
            ...props,
          }),
        { initialProps: {} }
      );

      await act(async () => {
        await result.current.update(4);
      });
      expect(result.current.current).toBe(4);

      rerender(changed);

      expect(result.current.current).toBe(10);
      expect(getRuntimeValue).toHaveBeenLastCalledWith(...lastReadArgs);
    });

    it('re-reads the playerStats fallback when the playerStats object changes', () => {
      getRuntimeValue.mockReturnValue(null);
      hasRuntimeValue.mockReturnValue(false);

      const { result, rerender } = renderHook(
        ({ stats }) =>
          useTrackedResource({ storageKey: 'hp', playerName: 'Gandalf', maxGetter: () => 5, deps: 'dep1', playerStats: stats }),
        { initialProps: { stats: { _trackedResources: { hp: { current: 15 } } } } }
      );

      expect(result.current.current).toBe(15);

      rerender({ stats: { _trackedResources: { hp: { current: 30 } } } });

      expect(result.current.current).toBe(30);
    });
  });

  describe('listener lifecycle', () => {
    it('registers the storage listener with playerName and stops all re-reads on unmount', () => {
      getRuntimeValue.mockReturnValue(10);
      hasRuntimeValue.mockReturnValue(true);

      const removeListener = vi.fn();
      addStorageChangeListener.mockReturnValue(removeListener);

      const { unmount } = renderHook(() =>
        useTrackedResource({ storageKey: 'hp', playerName: 'Gandalf', maxGetter: () => 10, deps: 'dep1' })
      );

      expect(addStorageChangeListener).toHaveBeenCalledWith('Gandalf', expect.any(Function));

      const readsBeforeUnmount = getRuntimeValue.mock.calls.length;
      unmount();
      expect(removeListener).toHaveBeenCalledTimes(1);

      // Observable cleanup: after unmount none of the three window events may
      // trigger another store read (a leaked listener would re-resolve).
      for (const eventName of ['focus-points-updated', 'sorcery-points-updated', 'innate-sorcery-updated']) {
        window.dispatchEvent(new Event(eventName));
      }
      expect(getRuntimeValue).toHaveBeenCalledTimes(readsBeforeUnmount);
    });
  });

  describe('event-driven re-resolution', () => {
    it.each(['focus-points-updated', 'sorcery-points-updated', 'innate-sorcery-updated'])(
      're-reads the store when %s fires',
      async (eventName) => {
        hasRuntimeValue.mockReturnValue(true);
        let stored = 10;
        getRuntimeValue.mockImplementation(() => stored);

        const { result } = renderHook(() =>
          useTrackedResource({ storageKey: 'hp', playerName: 'Gandalf', maxGetter: () => 20, deps: 'dep1' })
        );

        expect(result.current.current).toBe(10);

        stored = 7;
        await act(async () => {
          window.dispatchEvent(new Event(eventName));
        });

        expect(result.current.current).toBe(7);
      }
    );
  });
});
