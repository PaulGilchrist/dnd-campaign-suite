// @maintained-by-ai
// Canonical home for the useRuntimeValue HOOK contract (subscription, equality
// guard, prop switching, lifecycle, falsy guards). Non-hook store API lives in
// useRuntimeState.core.test.js; setRuntimeObject lives in
// useRuntimeState.setRuntimeObject.test.js.
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  clearRuntimeState,
  getRuntimeValue,
  setRuntimeValue,
  seedTrackedResources,
  useRuntimeValue,
} from './useRuntimeState.js';

describe('useRuntimeValue', () => {
  beforeEach(() => {
    clearRuntimeState('test-char');
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
    it('updates via setRuntimeValue and seedTrackedResources, including falsy round-trips and rapid changes', () => {
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

      // Falsy round-trip: 0 and null propagate through the listener guard.
      act(() => {
        setRuntimeValue('test-char', 'hp', 0, 'test-campaign');
      });
      expect(result.current).toBe(0);

      act(() => {
        setRuntimeValue('test-char', 'hp', null, 'test-campaign');
      });
      expect(result.current).toBeNull();

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

    it('is notified by other properties in the same store but does not re-render until its own property changes', () => {
      let renderCount = 0;
      seedTrackedResources('test-char', { hp: 15 });
      const { result } = renderHook(() => {
        renderCount++;
        return useRuntimeValue('test-char', 'hp', 'test-campaign');
      });
      expect(result.current).toBe(15);
      const initialRenders = renderCount;

      // Changing a different property fires the store notify; the hook's
      // valuesEqual guard must suppress the re-render for an unchanged hp.
      act(() => {
        seedTrackedResources('test-char', { sp: 10 });
      });
      expect(renderCount).toBe(initialRenders);
      expect(result.current).toBe(15);

      // Now changing hp should update the hook value.
      act(() => {
        seedTrackedResources('test-char', { hp: 25 });
      });
      expect(renderCount).toBe(initialRenders + 1);
      expect(result.current).toBe(25);
    });
  });

  describe('equality guard (no re-render on equivalent values)', () => {
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

    it('suppresses re-render when a notify delivers a semantically equal value', () => {
      // seedTrackedResources compares by identity, so seeding equal-content
      // values with NEW references DOES notify. The hook's own valuesEqual
      // guard is the only thing preventing a re-render here.
      let renderCount = 0;
      const stats = { str: 18 };
      seedTrackedResources('test-char', { hp: 15, stats });
      const { result } = renderHook(() => {
        renderCount++;
        return useRuntimeValue('test-char', 'stats', 'test-campaign');
      });
      expect(result.current).toBe(stats);
      const initialRenders = renderCount;

      // Deep-equal new object reference: store adopts the new object, but
      // the hook keeps the old one and does not re-render.
      const freshStats = { str: 18 };
      act(() => {
        seedTrackedResources('test-char', { stats: freshStats });
      });
      expect(renderCount).toBe(initialRenders);
      expect(result.current).toBe(stats);
      expect(getRuntimeValue('test-char', 'stats')).toBe(freshStats);

      // Number vs string ('15' vs 15): number-string equality matches,
      // so the displayed value stays the original number.
      const { result: hpResult } = renderHook(() =>
        useRuntimeValue('test-char', 'hp', 'test-campaign')
      );
      expect(hpResult.current).toBe(15);
      act(() => {
        seedTrackedResources('test-char', { hp: '15' });
      });
      expect(hpResult.current).toBe(15);
      expect(getRuntimeValue('test-char', 'hp')).toBe('15');
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
