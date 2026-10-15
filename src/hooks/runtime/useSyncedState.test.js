// @maintained-by-ai
// Canonical home for the useSyncedState HOOK contract — the preferred read/write
// hook of the server-first architecture (AGENTS.md). Covers the hook's own
// behaviour: defaultValue resolution vs store.has(), the local write path
// (store update + re-render + POST to server), functional updaters against the
// ref, external subscription, identity/re-render guards, unmount cleanup, and
// prop switching. Deterministic: fetch is mocked, no timers, no app coupling.
// Scope split: raw store API (get/setRuntimeValue/seed/clear, campaign-level URL
// routing, valuesEqual store guards) lives in useRuntimeState.core.test.js;
// setRuntimeObject in useRuntimeState.setRuntimeObject.test.js; the useRuntimeValue
// hook in useRuntimeState.useRuntimeValue.test.jsx; guard valuesEqual semantics in
// useSSEEqualityGuard.test.js.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  clearRuntimeState,
  getAllStoreKeys,
  seedTrackedResources,
  getRuntimeValue,
  setRuntimeValue,
  getStore,
  listeners,
} from './useRuntimeState.js';
import { useSyncedState } from './useSyncedState.js';

function clearAll() {
  for (const key of getAllStoreKeys()) {
    clearRuntimeState(key);
  }
  listeners.clear();
}

describe('useSyncedState', () => {
  beforeEach(() => {
    clearAll();
    vi.restoreAllMocks();
    vi.spyOn(global, 'fetch').mockResolvedValue(undefined);
  });

  describe('initialization', () => {
    it('uses defaultValue only when the store lacks the key; any stored value (incl. null, 0, empty structures) wins', () => {
      seedTrackedResources('test-char', {
        nullVal: null,
        hp: 0,
        count: -1,
        spells: [],
        stats: { str: 18, dex: 14 },
        name: 'Gandalf',
        off: false,
      });

      // Absent key -> defaultValue, and the returned tuple is [value, function].
      const { result: unset } = renderHook(() =>
        useSyncedState('test-char', 'missing', 20),
      );
      expect(unset.current).toEqual([20, expect.any(Function)]);

      // Stored falsy/complex values are NOT replaced by defaultValue.
      const cases = [
        ['nullVal', 'default'],
        ['hp', 20],
        ['count', 0],
        ['spells', ['fireball']],
        ['stats', {}],
        ['name', 'Unknown'],
        ['off', true],
      ];
      for (const [prop, defaultValue] of cases) {
        const { result } = renderHook(() =>
          useSyncedState('test-char', prop, defaultValue),
        );
        expect(result.current[0]).toEqual(
          getRuntimeValue('test-char', prop),
        );
      }
    });

    it('returns a stored undefined as a present value instead of defaultValue', () => {
      getStore('test-char').set('value', undefined);
      const { result } = renderHook(() =>
        useSyncedState('test-char', 'value', 'default'),
      );
      expect(result.current[0]).toBeUndefined();
    });
  });

  describe('setValue write path', () => {
    it('updates the store and hook state through sequential, null, and rapid direct writes', async () => {
      seedTrackedResources('test-char', { hp: 15 });
      const { result } = renderHook(() =>
        useSyncedState('test-char', 'hp', 20, 'test-campaign'),
      );
      expect(result.current[0]).toBe(15);

      const setValue = result.current[1];
      await act(async () => {
        setValue(25);
      });
      expect(result.current[0]).toBe(25);
      expect(getRuntimeValue('test-char', 'hp')).toBe(25);

      // null round-trip: null is a real value, not "absent".
      await act(async () => {
        setValue(null);
      });
      expect(result.current[0]).toBeNull();
      expect(getRuntimeValue('test-char', 'hp')).toBeNull();

      await act(async () => {
        setValue(15);
      });
      expect(result.current[0]).toBe(15);

      // Rapid sequential writes in one act land on the last value.
      await act(async () => {
        setValue(20);
        setValue(30);
        setValue(0);
      });
      expect(result.current[0]).toBe(0);
      expect(getRuntimeValue('test-char', 'hp')).toBe(0);
    });

    it('resolves functional updaters against the current value, tracking it between calls', async () => {
      seedTrackedResources('test-char', { hp: 15 });
      const { result } = renderHook(() =>
        useSyncedState('test-char', 'hp', 20, 'test-campaign'),
      );

      const setValue = result.current[1];
      await act(async () => {
        setValue((prev) => prev + 5);
      });
      expect(result.current[0]).toBe(20);

      await act(async () => {
        setValue((prev) => prev * 2);
      });
      expect(result.current[0]).toBe(40);

      // Two updaters in one act must each see the ref the previous write moved.
      await act(async () => {
        setValue((prev) => prev + 1);
        setValue((prev) => prev + 1);
      });
      expect(result.current[0]).toBe(42);
      expect(getRuntimeValue('test-char', 'hp')).toBe(42);
    });

    it('does not re-render when setValue sets the same value (identity guard)', async () => {
      let renders = 0;
      seedTrackedResources('test-char', { hp: 15 });
      const { result } = renderHook(() => {
        renders++;
        return useSyncedState('test-char', 'hp', 20, 'test-campaign');
      });
      expect(result.current[0]).toBe(15);
      const initialRenders = renders;

      await act(async () => {
        result.current[1](15);
      });

      expect(renders).toBe(initialRenders);
      expect(result.current[0]).toBe(15);
    });
  });

  describe('external updates', () => {
    it('updates when the value changes via setRuntimeValue from another source', async () => {
      seedTrackedResources('test-char', { hp: 15 });
      const { result } = renderHook(() =>
        useSyncedState('test-char', 'hp', 20, 'test-campaign'),
      );
      expect(result.current[0]).toBe(15);

      await act(async () => {
        setRuntimeValue('test-char', 'hp', 30, 'test-campaign');
      });

      expect(result.current[0]).toBe(30);
    });
  });

  describe('lifecycle', () => {
    it('removes its listener on unmount so subsequent external changes are ignored', async () => {
      const captured = { value: null };
      seedTrackedResources('cleanup-char', { hp: 15 });
      const { unmount } = renderHook(() => {
        const [val] = useSyncedState('cleanup-char', 'hp', 20, 'test-campaign');
        captured.value = val;
        return [val];
      });
      expect(captured.value).toBe(15);

      unmount();

      await act(async () => {
        setRuntimeValue('cleanup-char', 'hp', 99, 'test-campaign');
      });
      expect(captured.value).toBe(15);
    });

    it('switches tracked store/property when characterKey or propertyName changes on rerender', () => {
      seedTrackedResources('char-a', { hp: 10, sp: 7 });
      seedTrackedResources('char-b', { hp: 20 });

      const { result, rerender } = renderHook(
        ({ charKey, prop }) => useSyncedState(charKey, prop, 99, 'test-campaign'),
        { initialProps: { charKey: 'char-a', prop: 'hp' } },
      );
      expect(result.current[0]).toBe(10);

      rerender({ charKey: 'char-b', prop: 'hp' });
      expect(result.current[0]).toBe(20);

      rerender({ charKey: 'char-a', prop: 'sp' });
      expect(result.current[0]).toBe(7);

      // Switching to an absent property falls back to defaultValue.
      rerender({ charKey: 'char-b', prop: 'missing' });
      expect(result.current[0]).toBe(99);
    });
  });

  describe('server persistence', () => {
    it('POSTs the store payload to the character endpoint when setValue is called', () => {
      seedTrackedResources('test-char', { hp: 15 });

      const { result } = renderHook(() =>
        useSyncedState('test-char', 'hp', 20, 'test-campaign'),
      );

      act(() => {
        result.current[1](25);
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/campaigns/test-campaign/test-char',
        expect.objectContaining({
          method: 'POST',
          mode: 'cors',
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      const body = JSON.parse(global.fetch.mock.calls.at(-1)[1].body);
      expect(body.value).toHaveProperty('hp', 25);
    });
  });
});
