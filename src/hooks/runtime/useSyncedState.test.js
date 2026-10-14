import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  clearRuntimeState,
  seedTrackedResources,
  getRuntimeValue,
  setRuntimeValue,
  getStore,
} from './useRuntimeState.js';
import { useSyncedState } from './useSyncedState.js';

function clearAll() {
  const keys = ['test-char', 'cleanup-char', 'synced-char', 'synced-campaign'];
  for (const key of keys) {
    clearRuntimeState(key);
  }
}

describe('useSyncedState', () => {
  beforeEach(() => {
    clearAll();
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('returns defaultValue when no value exists in store', () => {
      const { result } = renderHook(() => useSyncedState('test-char', 'hp', 20));
      expect(result.current).toEqual([20, expect.any(Function)]);
    });

    it('returns seeded value from store instead of defaultValue', () => {
      seedTrackedResources('test-char', { hp: 15 });
      const { result } = renderHook(() => useSyncedState('test-char', 'hp', 20));
      expect(result.current[0]).toBe(15);
    });

    it('returns null from store instead of defaultValue when value is null', () => {
      seedTrackedResources('test-char', { value: null });
      const { result } = renderHook(() =>
        useSyncedState('test-char', 'value', 'default'),
      );
      expect(result.current[0]).toBeNull();
    });

    it('returns 0 instead of defaultValue', () => {
      seedTrackedResources('test-char', { hp: 0 });
      const { result } = renderHook(() => useSyncedState('test-char', 'hp', 20));
      expect(result.current[0]).toBe(0);
    });

    it('returns negative numbers instead of defaultValue', () => {
      seedTrackedResources('test-char', { count: -1 });
      const { result } = renderHook(() => useSyncedState('test-char', 'count', 0));
      expect(result.current[0]).toBe(-1);
    });

    it('returns empty array instead of defaultValue', () => {
      seedTrackedResources('test-char', { spells: [] });
      const { result } = renderHook(() =>
        useSyncedState('test-char', 'spells', ['fireball']),
      );
      expect(result.current[0]).toEqual([]);
    });

    it('returns seeded object instead of defaultValue', () => {
      seedTrackedResources('test-char', { stats: { str: 18, dex: 14 } });
      const { result } = renderHook(() =>
        useSyncedState('test-char', 'stats', {}),
      );
      expect(result.current[0]).toEqual({ str: 18, dex: 14 });
    });

    it('returns seeded string and boolean instead of defaultValue', () => {
      seedTrackedResources('test-char', { name: 'Gandalf', active: true });
      const { result: nameResult } = renderHook(() =>
        useSyncedState('test-char', 'name', 'Unknown'),
      );
      const { result: activeResult } = renderHook(() =>
        useSyncedState('test-char', 'active', false),
      );
      expect(nameResult.current[0]).toBe('Gandalf');
      expect(activeResult.current[0]).toBe(true);
    });

    it('returns undefined as a stored value', () => {
      const store = getStore('test-char');
      store.set('value', undefined);
      const { result } = renderHook(() =>
        useSyncedState('test-char', 'value', 'default'),
      );
      expect(result.current[0]).toBeUndefined();
    });
  });

  describe('setValue behavior', () => {
    it('updates the store when setValue is called', () => {
      seedTrackedResources('test-char', { hp: 15 });
      const { result } = renderHook(() => useSyncedState('test-char', 'hp', 20));
      expect(result.current[0]).toBe(15);

      const setValue = result.current[1];
      act(() => {
        setValue(25);
      });

      expect(getRuntimeValue('test-char', 'hp')).toBe(25);
    });

    it('updates the hook state when setValue is called', async () => {
      seedTrackedResources('test-char', { hp: 15 });
      const { result } = renderHook(() => useSyncedState('test-char', 'hp', 20));
      expect(result.current[0]).toBe(15);

      const setValue = result.current[1];
      await act(async () => {
        setValue(25);
      });

      expect(result.current[0]).toBe(25);
    });

    it('updates through multiple sequential changes', async () => {
      seedTrackedResources('test-char', { hp: 20 });
      const { result } = renderHook(() => useSyncedState('test-char', 'hp', 30));

      expect(result.current[0]).toBe(20);

      const setValue = result.current[1];
      await act(async () => {
        setValue(15);
      });
      expect(result.current[0]).toBe(15);

      await act(async () => {
        setValue(0);
      });
      expect(result.current[0]).toBe(0);
    });

    it('updates when value changes from null to a number and back', async () => {
      seedTrackedResources('test-char', { hp: null });
      const { result } = renderHook(() => useSyncedState('test-char', 'hp', 10));
      expect(result.current[0]).toBeNull();

      const setValue = result.current[1];
      await act(async () => {
        setValue(15);
      });
      expect(result.current[0]).toBe(15);

      await act(async () => {
        setValue(null);
      });
      expect(result.current[0]).toBeNull();
    });

    it('handles rapid sequential updates', async () => {
      seedTrackedResources('test-char', { hp: 10 });
      const { result } = renderHook(() => useSyncedState('test-char', 'hp', 20));

      const setValue = result.current[1];
      await act(async () => {
        setValue(20);
        setValue(30);
        setValue(40);
      });

      expect(result.current[0]).toBe(40);
    });

    it('uses function updater pattern to compute new value', async () => {
      seedTrackedResources('test-char', { hp: 15 });
      const { result } = renderHook(() => useSyncedState('test-char', 'hp', 20));
      expect(result.current[0]).toBe(15);

      const setValue = result.current[1];
      await act(async () => {
        setValue((prev) => prev + 10);
      });

      expect(result.current[0]).toBe(25);
    });

    it('uses function updater with sequential calls reading correct prev value', async () => {
      seedTrackedResources('test-char', { hp: 15 });
      const { result } = renderHook(() => useSyncedState('test-char', 'hp', 20));

      const setValue = result.current[1];
      await act(async () => {
        setValue((prev) => prev + 5);
      });
      expect(result.current[0]).toBe(20);

      await act(async () => {
        setValue((prev) => prev * 2);
      });
      expect(result.current[0]).toBe(40);
    });

    it('does not re-render when setValue sets the same value via identity', async () => {
      const renders = { count: 0 };
      seedTrackedResources('test-char', { hp: 15 });
      const { result } = renderHook(() => {
        renders.count++;
        return useSyncedState('test-char', 'hp', 20);
      });
      expect(result.current[0]).toBe(15);
      const initialRenders = renders.count;

      const setValue = result.current[1];
      await act(async () => {
        setValue(15);
      });

      expect(renders.count).toBe(initialRenders);
    });
  });

  describe('external updates', () => {
    it('updates when the value changes via setRuntimeValue from another source', async () => {
      seedTrackedResources('test-char', { hp: 15 });
      const { result } = renderHook(() => useSyncedState('test-char', 'hp', 20));
      expect(result.current[0]).toBe(15);

      await act(async () => {
        setRuntimeValue('test-char', 'hp', 30, 'test-campaign');
      });

      expect(result.current[0]).toBe(30);
    });

    it('does not update when setRuntimeValue sets the same value (valuesEqual guard)', async () => {
      const renders = { count: 0 };
      seedTrackedResources('test-char', { hp: 15 });
      const { result } = renderHook(() => {
        renders.count++;
        return useSyncedState('test-char', 'hp', 20);
      });
      expect(result.current[0]).toBe(15);
      const initialRenders = renders.count;

      await act(async () => {
        setRuntimeValue('test-char', 'hp', 15, 'test-campaign');
      });

      expect(renders.count).toBe(initialRenders);
    });
  });

  describe('lifecycle', () => {
    it('removes listener on unmount so subsequent external changes are ignored', async () => {
      const captured = { value: null };
      seedTrackedResources('cleanup-char', { hp: 15 });
      const { unmount } = renderHook(() => {
        const [val] = useSyncedState('cleanup-char', 'hp', 20);
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

    it('works after unmount and re-mount with a different character', () => {
      seedTrackedResources('cleanup-char', { hp: 15 });
      const { result, unmount } = renderHook(
        ({ charKey }) => useSyncedState(charKey, 'hp', 20),
        { initialProps: { charKey: 'cleanup-char' } },
      );
      expect(result.current[0]).toBe(15);

      unmount();
      clearRuntimeState('cleanup-char');
      clearRuntimeState('new-char');
      seedTrackedResources('new-char', { hp: 25 });

      const { result: result2 } = renderHook(() =>
        useSyncedState('new-char', 'hp', 30),
      );
      expect(result2.current[0]).toBe(25);
    });
  });

  describe('server persistence', () => {
    it('POSTs to the server API with campaignName when setValue is called', () => {
      seedTrackedResources('test-char', { hp: 15 });
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useSyncedState('test-char', 'hp', 20, 'test-campaign'),
      );

      const setValue = result.current[1];
      act(() => {
        setValue(25);
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/campaigns/test-campaign/test-char',
        expect.objectContaining({
          method: 'POST',
          mode: 'cors',
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.value).toHaveProperty('hp', 25);
    });

    it('POSTs with campaign-level characterKey format', () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useSyncedState('campaign', 'gameMode', 'dm', 'my-campaign'),
      );

      act(() => {
        result.current[1]('player');
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/campaigns/my-campaign/gameMode',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ value: 'player' }),
        }),
      );
    });
  });
});
