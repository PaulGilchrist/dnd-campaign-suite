import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  clearRuntimeState,
  setRuntimeValue,
  seedTrackedResources,
  useRuntimeValue,
} from './useRuntimeState.js';

describe('useRuntimeValue', () => {
  beforeEach(() => {
    clearRuntimeState('test-char');
    vi.restoreAllMocks();
  });

  describe('initial value', () => {
    it('returns null for an untracked property, seeded values (truthy, falsy, and complex)', () => {
      const { result: untrackedResult } = renderHook(() =>
        useRuntimeValue('test-char', 'hp', 'test-campaign')
      );
      expect(untrackedResult.current).toBeNull();

      seedTrackedResources('test-char', {
        hp: 0,
        spells: [1, 2, 3],
        stats: { str: 18, dex: 14 },
        empty: [],
      });
      const { result: hpResult } = renderHook(() =>
        useRuntimeValue('test-char', 'hp', 'test-campaign')
      );
      const { result: spellsResult } = renderHook(() =>
        useRuntimeValue('test-char', 'spells', 'test-campaign')
      );
      const { result: statsResult } = renderHook(() =>
        useRuntimeValue('test-char', 'stats', 'test-campaign')
      );
      const { result: emptyResult } = renderHook(() =>
        useRuntimeValue('test-char', 'empty', 'test-campaign')
      );
      expect(hpResult.current).toBe(0);
      expect(spellsResult.current).toEqual([1, 2, 3]);
      expect(statsResult.current).toEqual({ str: 18, dex: 14 });
      expect(emptyResult.current).toEqual([]);
    });
  });

  describe('subscription to changes', () => {
    it('updates via setRuntimeValue and seedTrackedResources, supports sequential and rapid changes', () => {
      seedTrackedResources('test-char', { hp: 15 });
      const { result } = renderHook(() =>
        useRuntimeValue('test-char', 'hp', 'test-campaign')
      );
      expect(result.current).toBe(15);

      act(() => {
        setRuntimeValue('test-char', 'hp', 20, 'test-campaign');
      });
      expect(result.current).toBe(20);

      act(() => {
        setRuntimeValue('test-char', 'hp', 15, 'test-campaign');
      });
      expect(result.current).toBe(15);

      act(() => {
        setRuntimeValue('test-char', 'hp', 0, 'test-campaign');
      });
      expect(result.current).toBe(0);

      act(() => {
        seedTrackedResources('test-char', { hp: 25 });
      });
      expect(result.current).toBe(25);

      // Rapid sequential updates in a single act block
      act(() => {
        setRuntimeValue('test-char', 'hp', 30, 'test-campaign');
        setRuntimeValue('test-char', 'hp', 40, 'test-campaign');
      });
      expect(result.current).toBe(40);
    });

    it('does not re-render when setting the same value (setRuntimeValue)', () => {
      let renderCount = 0;
      seedTrackedResources('test-char', { hp: 15 });
      const { result } = renderHook(() => {
        renderCount++;
        return useRuntimeValue('test-char', 'hp', 'test-campaign');
      });
      expect(result.current).toBe(15);
      const initialRenders = renderCount;

      act(() => {
        setRuntimeValue('test-char', 'hp', 15, 'test-campaign');
      });

      expect(renderCount).toBe(initialRenders);
      expect(result.current).toBe(15);
    });

    it('does not re-render when setting the same value (seedTrackedResources)', () => {
      let renderCount = 0;
      seedTrackedResources('test-char', { hp: 15 });
      const { result } = renderHook(() => {
        renderCount++;
        return useRuntimeValue('test-char', 'hp', 'test-campaign');
      });
      expect(result.current).toBe(15);
      const initialRenders = renderCount;

      act(() => {
        seedTrackedResources('test-char', { hp: 15 });
      });

      expect(renderCount).toBe(initialRenders);
      expect(result.current).toBe(15);
    });

    it('does not re-render when value changes from null to a number and back', () => {
      seedTrackedResources('test-char', { hp: null });
      const { result } = renderHook(() =>
        useRuntimeValue('test-char', 'hp', 'test-campaign')
      );
      expect(result.current).toBeNull();

      act(() => {
        setRuntimeValue('test-char', 'hp', 15, 'test-campaign');
      });
      expect(result.current).toBe(15);

      act(() => {
        setRuntimeValue('test-char', 'hp', null, 'test-campaign');
      });
      expect(result.current).toBeNull();
    });

    it('subscribes to changes from other properties in the same store', () => {
      seedTrackedResources('test-char', { hp: 15 });
      const { result } = renderHook(() =>
        useRuntimeValue('test-char', 'hp', 'test-campaign')
      );
      expect(result.current).toBe(15);

      // Changing a different property triggers the listener; the hook's
      // equality guard prevents a re-render when hp itself did not change.
      act(() => {
        seedTrackedResources('test-char', { sp: 10 });
      });
      expect(result.current).toBe(15);

      // Now changing hp should update the hook value.
      act(() => {
        seedTrackedResources('test-char', { hp: 25 });
      });
      expect(result.current).toBe(25);
    });

    it('prevents update when number-string equality matches', () => {
      let renderCount = 0;
      seedTrackedResources('test-char', { hp: 15 });
      const { result } = renderHook(() => {
        renderCount++;
        return useRuntimeValue('test-char', 'hp', 'test-campaign');
      });
      expect(result.current).toBe(15);
      const initialRenders = renderCount;

      // '15' (string) equals 15 (number) per valuesEqual
      act(() => {
        setRuntimeValue('test-char', 'hp', '15', 'test-campaign');
      });

      expect(renderCount).toBe(initialRenders);
      expect(result.current).toBe(15);
    });
  });

  describe('prop changes', () => {
    it('re-reads when characterKey or propertyName changes', () => {
      seedTrackedResources('char-a', { hp: 10 });
      seedTrackedResources('char-b', { hp: 20 });
      seedTrackedResources('test-char', { hp: 15, sp: 8 });

      const { result, rerender } = renderHook(
        ({ charKey, prop }) => useRuntimeValue(charKey, prop, 'test-campaign'),
        { initialProps: { charKey: 'char-a', prop: 'hp' } }
      );

      expect(result.current).toBe(10);

      rerender({ charKey: 'char-b', prop: 'hp' });
      expect(result.current).toBe(20);

      rerender({ charKey: 'test-char', prop: 'hp' });
      expect(result.current).toBe(15);

      rerender({ charKey: 'test-char', prop: 'sp' });
      expect(result.current).toBe(8);
    });
  });

  describe('lifecycle', () => {
    it('removes listener on unmount so subsequent changes are ignored', () => {
      seedTrackedResources('cleanup-char', { hp: 15 });
      const { result, unmount } = renderHook(() =>
        useRuntimeValue('cleanup-char', 'hp', 'test-campaign')
      );
      expect(result.current).toBe(15);

      unmount();

      act(() => {
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

      const { result: result2 } = renderHook(() =>
        useRuntimeValue('new-char', 'hp', 'test-campaign')
      );
      expect(result2.current).toBe(25);
    });
  });

  describe('falsy characterKey / propertyName guards', () => {
    it('does not subscribe when characterKey or propertyName is an empty string', () => {
      seedTrackedResources('test-char', { hp: 15 });

      const { result: charKeyResult } = renderHook(() =>
        useRuntimeValue('', 'hp', 'test-campaign')
      );
      expect(charKeyResult.current).toBeNull();

      const { result: propResult } = renderHook(() =>
        useRuntimeValue('test-char', '', 'test-campaign')
      );
      expect(propResult.current).toBeNull();

      // Guard prevents subscription: changes to 'hp' are not reflected for '' prop
      act(() => {
        seedTrackedResources('test-char', { hp: 99 });
      });
      expect(propResult.current).toBeNull();
    });
  });
});
