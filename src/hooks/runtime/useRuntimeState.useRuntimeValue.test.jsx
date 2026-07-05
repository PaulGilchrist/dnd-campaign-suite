// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { clearRuntimeState, setRuntimeValue, seedTrackedResources } from './useRuntimeState.js';
import { useRuntimeValue } from './useRuntimeState.js';

describe('useRuntimeValue', () => {
  beforeEach(() => {
    clearRuntimeState('test-char');
    vi.restoreAllMocks();
  });

  it('returns null for an untracked property', () => {
    const { result } = renderHook(() => useRuntimeValue('test-char', 'hp', 'test-campaign'));
    expect(result.current).toBeNull();
  });

  it('returns seeded values from the store', () => {
    seedTrackedResources('test-char', { hp: 15 });
    const { result } = renderHook(() => useRuntimeValue('test-char', 'hp', 'test-campaign'));
    expect(result.current).toBe(15);
  });

  it('returns 0 and falsy values correctly', () => {
    seedTrackedResources('test-char', { hp: 0, spells: [] });
    const { result: hpResult } = renderHook(() => useRuntimeValue('test-char', 'hp', 'test-campaign'));
    const { result: spellsResult } = renderHook(() => useRuntimeValue('test-char', 'spells', 'test-campaign'));
    expect(hpResult.current).toBe(0);
    expect(spellsResult.current).toEqual([]);
  });

  it('updates when the value changes via setRuntimeValue', async () => {
    seedTrackedResources('test-char', { hp: 15 });
    const { result } = renderHook(() => useRuntimeValue('test-char', 'hp', 'test-campaign'));
    expect(result.current).toBe(15);

    await act(async () => {
      setRuntimeValue('test-char', 'hp', 20, 'test-campaign');
    });

    expect(result.current).toBe(20);
  });

  it('updates when the value changes via seedTrackedResources', async () => {
    seedTrackedResources('test-char', { hp: 15 });
    const { result } = renderHook(() => useRuntimeValue('test-char', 'hp', 'test-campaign'));
    expect(result.current).toBe(15);

    await act(async () => {
      seedTrackedResources('test-char', { hp: 25 });
    });

    expect(result.current).toBe(25);
  });

  it('does not re-render when setting the same value', async () => {
    let renderCount = 0;
    seedTrackedResources('test-char', { hp: 15 });
    const { result } = renderHook(() => {
      renderCount++;
      return useRuntimeValue('test-char', 'hp', 'test-campaign');
    });
    expect(result.current).toBe(15);
    const initialRenders = renderCount;

    await act(async () => {
      setRuntimeValue('test-char', 'hp', 15, 'test-campaign');
    });

    expect(renderCount).toBe(initialRenders);
    expect(result.current).toBe(15);
  });

  it('updates through multiple sequential changes', async () => {
    seedTrackedResources('test-char', { hp: 20 });
    const { result } = renderHook(() => useRuntimeValue('test-char', 'hp', 'test-campaign'));

    expect(result.current).toBe(20);

    await act(async () => {
      setRuntimeValue('test-char', 'hp', 15, 'test-campaign');
    });
    expect(result.current).toBe(15);

    await act(async () => {
      setRuntimeValue('test-char', 'hp', 0, 'test-campaign');
    });
    expect(result.current).toBe(0);
  });

  it('updates when value changes from null to a number and back', async () => {
    seedTrackedResources('test-char', { hp: null });
    const { result } = renderHook(() => useRuntimeValue('test-char', 'hp', 'test-campaign'));
    expect(result.current).toBeNull();

    await act(async () => {
      setRuntimeValue('test-char', 'hp', 15, 'test-campaign');
    });
    expect(result.current).toBe(15);

    await act(async () => {
      setRuntimeValue('test-char', 'hp', null, 'test-campaign');
    });
    expect(result.current).toBeNull();
  });

  it('handles rapid sequential updates', async () => {
    seedTrackedResources('test-char', { hp: 10 });
    const { result } = renderHook(() => useRuntimeValue('test-char', 'hp', 'test-campaign'));

    await act(async () => {
      setRuntimeValue('test-char', 'hp', 20, 'test-campaign');
      setRuntimeValue('test-char', 'hp', 30, 'test-campaign');
      setRuntimeValue('test-char', 'hp', 40, 'test-campaign');
    });

    expect(result.current).toBe(40);
  });

  it('removes listener on unmount', async () => {
    seedTrackedResources('cleanup-char', { hp: 15 });
    const { result, unmount } = renderHook(() => useRuntimeValue('cleanup-char', 'hp', 'test-campaign'));
    expect(result.current).toBe(15);

    unmount();

    await act(async () => {
      setRuntimeValue('cleanup-char', 'hp', 20, 'test-campaign');
    });
    expect(result.current).toBe(15);
  });

  it('works after unmount and re-mount with a different character', () => {
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

    const { result: result2 } = renderHook(() => useRuntimeValue('new-char', 'hp', 'test-campaign'));
    expect(result2.current).toBe(25);
  });
});
