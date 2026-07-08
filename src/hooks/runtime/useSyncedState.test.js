// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { clearRuntimeState, setRuntimeValue, seedTrackedResources, getRuntimeValue } from './useRuntimeState.js';
import { useSyncedState } from './useSyncedState.js';

function clearAll() {
  const keys = ['test-char', 'test-campaign', 'synced-char', 'synced-campaign'];
  for (const key of keys) {
    clearRuntimeState(key);
  }
}

describe('useSyncedState', () => {
  beforeEach(() => {
    clearAll();
    vi.restoreAllMocks();
  });

  it('returns defaultValue when no value exists in store', () => {
    const { result } = renderHook(() => useSyncedState('test-char', 'hp', 20));
    expect(result.current).toEqual([20, expect.any(Function)]);
  });

  it('returns seeded value from store instead of defaultValue', () => {
    seedTrackedResources('test-char', { hp: 15 });
    const { result } = renderHook(() => useSyncedState('test-char', 'hp', 20));
    expect(result.current).toEqual([15, expect.any(Function)]);
  });

  it('returns null from store instead of defaultValue when value is null', () => {
    seedTrackedResources('test-char', { value: null });
    const { result } = renderHook(() => useSyncedState('test-char', 'value', 'default'));
    expect(result.current).toEqual([null, expect.any(Function)]);
  });

  it('returns 0 and falsy values correctly', () => {
    seedTrackedResources('test-char', { hp: 0, spells: [], count: -1 });
    const { result: hpResult } = renderHook(() => useSyncedState('test-char', 'hp', 20));
    const { result: spellsResult } = renderHook(() => useSyncedState('test-char', 'spells', ['fireball']));
    const { result: countResult } = renderHook(() => useSyncedState('test-char', 'count', 0));
    expect(hpResult.current[0]).toBe(0);
    expect(spellsResult.current[0]).toEqual([]);
    expect(countResult.current[0]).toBe(-1);
  });

  it('calls setRuntimeValue when setValue is called', () => {
    seedTrackedResources('test-char', { hp: 15 });
    const { result } = renderHook(() => useSyncedState('test-char', 'hp', 20));
    expect(result.current[0]).toBe(15);

    act(() => {
      result.current[1](25);
    });

    expect(getRuntimeValue('test-char', 'hp')).toBe(25);
  });

  it('updates when setValue is called', async () => {
    seedTrackedResources('test-char', { hp: 15 });
    const { result } = renderHook(() => useSyncedState('test-char', 'hp', 20));
    expect(result.current[0]).toBe(15);

    await act(async () => {
      result.current[1](25);
    });

    expect(result.current[0]).toBe(25);
  });

  it('updates when the value changes via setRuntimeValue from another source', async () => {
    seedTrackedResources('test-char', { hp: 15 });
    const { result } = renderHook(() => useSyncedState('test-char', 'hp', 20));
    expect(result.current[0]).toBe(15);

    await act(async () => {
      setRuntimeValue('test-char', 'hp', 30, 'test-campaign');
    });

    expect(result.current[0]).toBe(30);
  });

  it('does not re-render when setting the same value', async () => {
    let renderCount = 0;
    seedTrackedResources('test-char', { hp: 15 });
    const { result } = renderHook(() => {
      renderCount++;
      return useSyncedState('test-char', 'hp', 20);
    });
    expect(result.current[0]).toBe(15);
    const initialRenders = renderCount;

    await act(async () => {
      result.current[1](15);
    });

    expect(renderCount).toBe(initialRenders);
    expect(result.current[0]).toBe(15);
  });

  it('handles all value types (string, boolean, array, object, null, 0, negative)', () => {
    seedTrackedResources('test-char', {
      name: 'Gandalf',
      active: true,
      spells: ['fireball', 'magic-missile'],
      stats: { str: 18, dex: 14 },
      empty: null,
      zero: 0,
      negative: -5,
    });

    const { result: nameResult } = renderHook(() => useSyncedState('test-char', 'name', 'Unknown'));
    const { result: activeResult } = renderHook(() => useSyncedState('test-char', 'active', false));
    const { result: spellsResult } = renderHook(() => useSyncedState('test-char', 'spells', []));
    const { result: statsResult } = renderHook(() => useSyncedState('test-char', 'stats', {}));
    const { result: emptyResult } = renderHook(() => useSyncedState('test-char', 'empty', 'default'));
    const { result: zeroResult } = renderHook(() => useSyncedState('test-char', 'zero', 10));
    const { result: negativeResult } = renderHook(() => useSyncedState('test-char', 'negative', 0));

    expect(nameResult.current[0]).toBe('Gandalf');
    expect(activeResult.current[0]).toBe(true);
    expect(spellsResult.current[0]).toEqual(['fireball', 'magic-missile']);
    expect(statsResult.current[0]).toEqual({ str: 18, dex: 14 });
    expect(emptyResult.current[0]).toBeNull();
    expect(zeroResult.current[0]).toBe(0);
    expect(negativeResult.current[0]).toBe(-5);
  });

  it('updates through multiple sequential changes', async () => {
    seedTrackedResources('test-char', { hp: 20 });
    const { result } = renderHook(() => useSyncedState('test-char', 'hp', 30));

    expect(result.current[0]).toBe(20);

    await act(async () => {
      result.current[1](15);
    });
    expect(result.current[0]).toBe(15);

    await act(async () => {
      result.current[1](0);
    });
    expect(result.current[0]).toBe(0);
  });

  it('updates when value changes from null to a number and back', async () => {
    seedTrackedResources('test-char', { hp: null });
    const { result } = renderHook(() => useSyncedState('test-char', 'hp', 10));
    expect(result.current[0]).toBeNull();

    await act(async () => {
      result.current[1](15);
    });
    expect(result.current[0]).toBe(15);

    await act(async () => {
      result.current[1](null);
    });
    expect(result.current[0]).toBeNull();
  });

  it('handles rapid sequential updates', async () => {
    seedTrackedResources('test-char', { hp: 10 });
    const { result } = renderHook(() => useSyncedState('test-char', 'hp', 20));

    await act(async () => {
      result.current[1](20);
      result.current[1](30);
      result.current[1](40);
    });

    expect(result.current[0]).toBe(40);
  });

  it('removes listener on unmount', async () => {
    seedTrackedResources('cleanup-char', { hp: 15 });
    const { result, unmount } = renderHook(() => useSyncedState('cleanup-char', 'hp', 20));
    expect(result.current[0]).toBe(15);

    unmount();

    await act(async () => {
      setRuntimeValue('cleanup-char', 'hp', 20, 'test-campaign');
    });
    expect(result.current[0]).toBe(15);
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

    const { result: result2 } = renderHook(() => useSyncedState('new-char', 'hp', 30));
    expect(result2.current[0]).toBe(25);
  });

  it('setValue POSTs to the server API with campaignName', () => {
    seedTrackedResources('test-char', { hp: 15 });
    const { result } = renderHook(() => useSyncedState('test-char', 'hp', 20, 'test-campaign'));
    vi.spyOn(global, 'fetch').mockResolvedValue(undefined);

    act(() => {
      result.current[1](25);
    });

    const callArgs = vi.spyOn(global, 'fetch').mock.calls[0];
    expect(callArgs[0]).toBe('/api/campaigns/test-campaign/test-char');
    const body = JSON.parse(callArgs[1].body);
    expect(body.value).toHaveProperty('hp', 25);
  });
});
