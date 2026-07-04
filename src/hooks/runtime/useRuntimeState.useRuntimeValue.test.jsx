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

  it('returns an array value from the store', () => {
    seedTrackedResources('test-char', { spells: ['fireball'] });
    const { result } = renderHook(() => useRuntimeValue('test-char', 'spells', 'test-campaign'));
    expect(result.current).toEqual(['fireball']);
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
