// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { clearRuntimeState, setRuntimeValue, seedTrackedResources } from './useRuntimeState.js';
import { useRuntimeValue } from './useRuntimeState.js';

describe('useRuntimeState — useRuntimeValue hook', () => {
  beforeEach(() => {
    clearRuntimeState('test-char');
    vi.restoreAllMocks();
  });

  it('returns null for a property that has never been set', () => {
    const { result } = renderHook(() => useRuntimeValue('test-char', 'hp', 'test-campaign'));
    expect(result.current).toBeNull();
  });

  it('returns the initial value from the store', () => {
    seedTrackedResources('test-char', { hp: 15 });
    const { result } = renderHook(() => useRuntimeValue('test-char', 'hp', 'test-campaign'));
    expect(result.current).toBe(15);
  });

  it('returns 0 as a valid initial value', () => {
    seedTrackedResources('test-char', { hp: 0 });
    const { result } = renderHook(() => useRuntimeValue('test-char', 'hp', 'test-campaign'));
    expect(result.current).toBe(0);
  });

  it('returns false as a valid initial value', () => {
    seedTrackedResources('test-char', { active: false });
    const { result } = renderHook(() => useRuntimeValue('test-char', 'active', 'test-campaign'));
    expect(result.current).toBe(false);
  });

  it('returns an empty string as a valid initial value', () => {
    seedTrackedResources('test-char', { name: '' });
    const { result } = renderHook(() => useRuntimeValue('test-char', 'name', 'test-campaign'));
    expect(result.current).toBe('');
  });

  it('returns an array value from the store', () => {
    seedTrackedResources('test-char', { spells: ['fireball'] });
    const { result } = renderHook(() => useRuntimeValue('test-char', 'spells', 'test-campaign'));
    expect(result.current).toEqual(['fireball']);
  });

  it('returns an object value from the store', () => {
    seedTrackedResources('test-char', { stats: { str: 18 } });
    const { result } = renderHook(() => useRuntimeValue('test-char', 'stats', 'test-campaign'));
    expect(result.current).toEqual({ str: 18 });
  });

  it('updates when the value changes via setRuntimeValue', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(undefined);
    seedTrackedResources('test-char', { hp: 15 });
    const { result } = renderHook(() => useRuntimeValue('test-char', 'hp', 'test-campaign'));
    expect(result.current).toBe(15);

    await act(async () => {
      setRuntimeValue('test-char', 'hp', 20, 'test-campaign');
    });

    expect(result.current).toBe(20);
    fetchSpy.mockRestore();
  });

  it('updates when the value changes via seedTrackedResources', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(undefined);
    seedTrackedResources('test-char', { hp: 15 });
    const { result } = renderHook(() => useRuntimeValue('test-char', 'hp', 'test-campaign'));
    expect(result.current).toBe(15);

    await act(async () => {
      seedTrackedResources('test-char', { hp: 25 });
    });

    expect(result.current).toBe(25);
    fetchSpy.mockRestore();
  });

  it('does not re-render when the value does not change', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(undefined);
    seedTrackedResources('test-char', { hp: 15 });
    const { result } = renderHook(() => useRuntimeValue('test-char', 'hp', 'test-campaign'));
    expect(result.current).toBe(15);

    renderHook(
      () => useRuntimeValue('test-char', 'hp', 'test-campaign')
    );
    expect(result.current).toBe(15);
    fetchSpy.mockRestore();
  });

  it('does not re-render when setting the same value again', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(undefined);
    seedTrackedResources('test-char', { hp: 15 });
    const { result } = renderHook(() =>
      useRuntimeValue('test-char', 'hp', 'test-campaign')
    );
    await act(async () => {
      setRuntimeValue('test-char', 'hp', 15, 'test-campaign');
    });

    expect(result.current).toBe(15);
    fetchSpy.mockRestore();
  });

  it('updates when a different property changes on the same character', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(undefined);
    seedTrackedResources('test-char', { hp: 15, sp: 10 });
    const { result } = renderHook(() => useRuntimeValue('test-char', 'hp', 'test-campaign'));
    expect(result.current).toBe(15);

    await act(async () => {
      setRuntimeValue('test-char', 'sp', 5, 'test-campaign');
    });

    // hp should still be 15, but the hook should have received a notification
    expect(result.current).toBe(15);
    fetchSpy.mockRestore();
  });

  it('does not call setter when new value equals current via valuesEqual (number-string)', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(undefined);
    seedTrackedResources('test-char', { hp: 15 });
    const { result } = renderHook(() => useRuntimeValue('test-char', 'hp', 'test-campaign'));
    expect(result.current).toBe(15);

    await act(async () => {
      setRuntimeValue('test-char', 'hp', '15', 'test-campaign');
    });

    expect(result.current).toBe(15);
    fetchSpy.mockRestore();
  });

  it('handles undefined initial value gracefully', () => {
    seedTrackedResources('test-char', { hp: undefined });
    const { result } = renderHook(() => useRuntimeValue('test-char', 'hp', 'test-campaign'));
    // Object.entries omits undefined values, so getRuntimeValue returns null
    expect(result.current).toBeNull();
  });

  it('handles null value', () => {
    seedTrackedResources('test-char', { hp: null });
    const { result } = renderHook(() => useRuntimeValue('test-char', 'hp', 'test-campaign'));
    expect(result.current).toBeNull();
  });

  it('handles negative values', () => {
    seedTrackedResources('test-char', { hp: -5 });
    const { result } = renderHook(() => useRuntimeValue('test-char', 'hp', 'test-campaign'));
    expect(result.current).toBe(-5);
  });

  it('handles large numeric values', () => {
    seedTrackedResources('test-char', { hp: 999999 });
    const { result } = renderHook(() => useRuntimeValue('test-char', 'hp', 'test-campaign'));
    expect(result.current).toBe(999999);
  });
});

describe('useRuntimeState — useRuntimeValue hook — reactivity', () => {
  beforeEach(() => {
    clearRuntimeState('react-char');
    vi.restoreAllMocks();
  });

  it('updates through multiple sequential changes', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(undefined);
    seedTrackedResources('react-char', { hp: 20 });
    const { result } = renderHook(() => useRuntimeValue('react-char', 'hp', 'test-campaign'));
    expect(result.current).toBe(20);

    await act(async () => {
      setRuntimeValue('react-char', 'hp', 15, 'test-campaign');
    });
    expect(result.current).toBe(15);

    await act(async () => {
      setRuntimeValue('react-char', 'hp', 10, 'test-campaign');
    });
    expect(result.current).toBe(10);

    await act(async () => {
      setRuntimeValue('react-char', 'hp', 0, 'test-campaign');
    });
    expect(result.current).toBe(0);

    fetchSpy.mockRestore();
  });

  it('updates when value changes from null to a number', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(undefined);
    seedTrackedResources('react-char', { hp: null });
    const { result } = renderHook(() => useRuntimeValue('react-char', 'hp', 'test-campaign'));
    expect(result.current).toBeNull();

    await act(async () => {
      setRuntimeValue('react-char', 'hp', 15, 'test-campaign');
    });
    expect(result.current).toBe(15);

    fetchSpy.mockRestore();
  });

  it('updates when value changes from a number to null', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(undefined);
    seedTrackedResources('react-char', { hp: 15 });
    const { result } = renderHook(() => useRuntimeValue('react-char', 'hp', 'test-campaign'));
    expect(result.current).toBe(15);

    await act(async () => {
      setRuntimeValue('react-char', 'hp', null, 'test-campaign');
    });
    expect(result.current).toBeNull();

    fetchSpy.mockRestore();
  });

  it('updates when value changes from string to number', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(undefined);
    seedTrackedResources('react-char', { hp: '15' });
    const { result } = renderHook(() => useRuntimeValue('react-char', 'hp', 'test-campaign'));
    expect(result.current).toBe('15');

    await act(async () => {
      setRuntimeValue('react-char', 'hp', 15, 'test-campaign');
    });
    // 15 === "15" via valuesEqual, so no update
    expect(result.current).toBe('15');

    fetchSpy.mockRestore();
  });

  it('updates when value changes via multiple seedTrackedResources calls', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(undefined);
    seedTrackedResources('react-char', { hp: 10 });
    const { result } = renderHook(() => useRuntimeValue('react-char', 'hp', 'test-campaign'));
    expect(result.current).toBe(10);

    await act(async () => {
      seedTrackedResources('react-char', { hp: 20, sp: 5 });
    });
    expect(result.current).toBe(20);

    fetchSpy.mockRestore();
  });

  it('handles rapid sequential updates', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(undefined);
    seedTrackedResources('react-char', { hp: 10 });
    const { result } = renderHook(() => useRuntimeValue('react-char', 'hp', 'test-campaign'));

    await act(async () => {
      setRuntimeValue('react-char', 'hp', 20, 'test-campaign');
      setRuntimeValue('react-char', 'hp', 30, 'test-campaign');
      setRuntimeValue('react-char', 'hp', 40, 'test-campaign');
    });

    expect(result.current).toBe(40);
    fetchSpy.mockRestore();
  });

  it('correctly tracks value via ref for equality check', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(undefined);
    seedTrackedResources('react-char', { hp: 10 });
    const { result } = renderHook(() => useRuntimeValue('react-char', 'hp', 'test-campaign'));
    expect(result.current).toBe(10);

    // Set same value — should not trigger re-render
    await act(async () => {
      setRuntimeValue('react-char', 'hp', 10, 'test-campaign');
    });
    expect(result.current).toBe(10);

    // Set different value — should update
    await act(async () => {
      setRuntimeValue('react-char', 'hp', 25, 'test-campaign');
    });
    expect(result.current).toBe(25);

    fetchSpy.mockRestore();
  });
});

describe('useRuntimeState — useRuntimeValue hook — edge cases', () => {
  beforeEach(() => {
    clearRuntimeState('edge-char');
    vi.restoreAllMocks();
  });

  it('does not crash when characterKey is falsy', () => {
    const { result } = renderHook(() => useRuntimeValue(null, 'hp', 'test-campaign'));
    expect(result.current).toBeNull();
  });

  it('does not crash when propertyName is falsy', () => {
    const { result } = renderHook(() => useRuntimeValue('edge-char', null, 'test-campaign'));
    expect(result.current).toBeNull();
  });

  it('works with special characters in characterKey', () => {
    seedTrackedResources('char/with/slashes', { hp: 10 });
    const { result } = renderHook(() => useRuntimeValue('char/with/slashes', 'hp', 'test-campaign'));
    expect(result.current).toBe(10);
  });

  it('works with empty string characterKey', () => {
    seedTrackedResources('', { hp: 10 });
    const { result } = renderHook(() => useRuntimeValue('', 'hp', 'test-campaign'));
    expect(result.current).toBe(10);
  });

  it('works with empty string propertyName', () => {
    seedTrackedResources('edge-char', { '': 'empty-key' });
    const { result } = renderHook(() => useRuntimeValue('edge-char', '', 'test-campaign'));
    expect(result.current).toBe('empty-key');
  });

  it('handles boolean value changes', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(undefined);
    seedTrackedResources('edge-char', { active: true });
    const { result } = renderHook(() => useRuntimeValue('edge-char', 'active', 'test-campaign'));
    expect(result.current).toBe(true);

    await act(async () => {
      setRuntimeValue('edge-char', 'active', false, 'test-campaign');
    });
    expect(result.current).toBe(false);

    fetchSpy.mockRestore();
  });

  it('handles string value changes', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(undefined);
    seedTrackedResources('edge-char', { name: 'Gandalf' });
    const { result } = renderHook(() => useRuntimeValue('edge-char', 'name', 'test-campaign'));
    expect(result.current).toBe('Gandalf');

    await act(async () => {
      setRuntimeValue('edge-char', 'name', 'Radagast', 'test-campaign');
    });
    expect(result.current).toBe('Radagast');

    fetchSpy.mockRestore();
  });

  it('handles array value changes', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(undefined);
    seedTrackedResources('edge-char', { spells: ['fireball'] });
    const { result } = renderHook(() => useRuntimeValue('edge-char', 'spells', 'test-campaign'));
    expect(result.current).toEqual(['fireball']);

    await act(async () => {
      setRuntimeValue('edge-char', 'spells', ['fireball', 'lightning-bolt'], 'test-campaign');
    });
    expect(result.current).toEqual(['fireball', 'lightning-bolt']);

    fetchSpy.mockRestore();
  });

  it('handles object value changes', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(undefined);
    seedTrackedResources('edge-char', { stats: { str: 18 } });
    const { result } = renderHook(() => useRuntimeValue('edge-char', 'stats', 'test-campaign'));
    expect(result.current).toEqual({ str: 18 });

    await act(async () => {
      setRuntimeValue('edge-char', 'stats', { str: 20, dex: 15 }, 'test-campaign');
    });
    expect(result.current).toEqual({ str: 20, dex: 15 });

    fetchSpy.mockRestore();
  });

  it('does not update when object has same keys/values', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(undefined);
    seedTrackedResources('edge-char', { stats: { str: 18 } });
    let renderCount = 0;
    renderHook(() => {
      renderCount++;
      return useRuntimeValue('edge-char', 'stats', 'test-campaign');
    });
    const initialCount = renderCount;

    await act(async () => {
      setRuntimeValue('edge-char', 'stats', { str: 18 }, 'test-campaign');
    });

    // Should not have re-rendered due to valuesEqual
    expect(renderCount).toBe(initialCount);
    fetchSpy.mockRestore();
  });
});

describe('useRuntimeState — useRuntimeValue hook — cleanup', () => {
  beforeEach(() => {
    clearRuntimeState('cleanup-char');
    vi.restoreAllMocks();
  });

  it('removes listener on unmount', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(undefined);
    seedTrackedResources('cleanup-char', { hp: 15 });
    const { result, unmount } = renderHook(() => useRuntimeValue('cleanup-char', 'hp', 'test-campaign'));
    expect(result.current).toBe(15);

    unmount();

    // After unmount, changes should not trigger the hook
    await act(async () => {
      setRuntimeValue('cleanup-char', 'hp', 20, 'test-campaign');
    });
    expect(result.current).toBe(15);

    fetchSpy.mockRestore();
  });

  it('works correctly after unmount and re-mount with different character', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(undefined);
    seedTrackedResources('cleanup-char', { hp: 15 });
    const { result, unmount } = renderHook(
      ({ charKey }) => useRuntimeValue(charKey, 'hp', 'test-campaign'),
      { initialProps: { charKey: 'cleanup-char' } }
    );
    expect(result.current).toBe(15);

    unmount();
    clearRuntimeState('cleanup-char');
    clearRuntimeState('new-char');
    seedTrackedResources('new-char', { hp: 25 });

    const { result: result2 } = renderHook(
      () => useRuntimeValue('new-char', 'hp', 'test-campaign')
    );
    expect(result2.current).toBe(25);

    fetchSpy.mockRestore();
  });
});
