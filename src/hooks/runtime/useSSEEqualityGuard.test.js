// @maintained-by-ai
// Pure contract tests for useSSEEqualityGuard (AGENTS.md gotcha: "SSE re-render loop").
// Deterministic: no timers, no network, no server. Covers ONLY the guard's
// valuesEqual semantics and functional-update handling.
// Cross-reference: store-level POST suppression (skipSync, number-string
// equality, SSE echo re-POST avoidance) lives in useRuntimeState.core.test.js,
// useRuntimeState.setRuntimeObject.test.js, and useSyncedState.test.js —
// different lane, do not duplicate those concerns here.
import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import { renderHook, act } from '@testing-library/react';
import useSSEEqualityGuard from './useSSEEqualityGuard.js';

// Mock-setter lane: asserts on setter call counts (what reached React).
function renderGuarded() {
  const setter = vi.fn();
  const { result } = renderHook(() => useSSEEqualityGuard(setter));
  return { setter, update: result.current };
}

// Real-setter lane: asserts on observable state identity (what React kept).
function renderGuardedState(initial = undefined) {
  const { result } = renderHook(() => {
    const [value, setValue] = useState(initial);
    const update = useSSEEqualityGuard(setValue);
    return { value, update };
  });
  return result;
}

describe('useSSEEqualityGuard', () => {
  describe('primitive values', () => {
    it('calls setter with a new primitive value', () => {
      const { setter, update } = renderGuarded();
      act(() => update('new value'));
      expect(setter).toHaveBeenCalledWith('new value');
    });

    it('prevents duplicate primitive updates', () => {
      const { setter, update } = renderGuarded();
      act(() => update(42));
      act(() => update(42));
      expect(setter).toHaveBeenCalledTimes(1);
    });

    it('allows re-setting a primitive after an intermediate change', () => {
      const { setter, update } = renderGuarded();
      act(() => update(42));
      act(() => update(0));
      act(() => update(42));
      expect(setter).toHaveBeenCalledTimes(3);
    });

    it('allows duplicate NaN updates (NaN !== NaN in JS, no special handling)', () => {
      const { setter, update } = renderGuarded();
      act(() => update(NaN));
      act(() => update(NaN));
      // NaN !== NaN and typeof NaN is 'number', not 'object',
      // so valuesEqual returns false and setter is called twice.
      expect(setter).toHaveBeenCalledTimes(2);
    });
  });

  describe('null and undefined', () => {
    it('suppresses nullish updates in any order (currentValueRef stays undefined)', () => {
      const { setter, update } = renderGuarded();
      // valuesEqual treats undefined/null as equal (a == b nullish check),
      // and suppressed updates never move currentValueRef off undefined.
      act(() => update(null));       // undefined vs null  → suppressed
      act(() => update(undefined));  // undefined vs undefined → suppressed
      act(() => update(null));       // undefined vs null  → suppressed
      act(() => update(undefined));  // undefined vs undefined → suppressed
      expect(setter).toHaveBeenCalledTimes(0);
      // A real value still gets through — guard is not stuck nullish.
      act(() => update('x'));
      expect(setter).toHaveBeenCalledTimes(1);
      expect(setter).toHaveBeenCalledWith('x');
    });
  });

  describe('object equality', () => {
    it('prevents duplicate object updates with same properties', () => {
      const { setter, update } = renderGuarded();
      act(() => update({ a: 1 }));
      act(() => update({ a: 1 }));
      expect(setter).toHaveBeenCalledTimes(1);
    });

    it('allows object updates with different property values', () => {
      const { setter, update } = renderGuarded();
      act(() => update({ a: 1 }));
      act(() => update({ a: 2 }));
      expect(setter).toHaveBeenCalledTimes(2);
    });

    it('allows object updates with a different key count', () => {
      const { setter, update } = renderGuarded();
      act(() => update({ a: 1 }));
      act(() => update({ a: 1, b: 2 }));
      expect(setter).toHaveBeenCalledTimes(2);
    });

    it('prevents duplicate nested object updates', () => {
      const { setter, update } = renderGuarded();
      const deep = { a: { b: { c: 1 } } };
      act(() => update(deep));
      act(() => update({ a: { b: { c: 1 } } }));
      expect(setter).toHaveBeenCalledTimes(1);
    });

    it('allows nested object updates when a leaf value differs', () => {
      const { setter, update } = renderGuarded();
      act(() => update({ a: { b: { c: 1 } } }));
      act(() => update({ a: { b: { c: 2 } } }));
      expect(setter).toHaveBeenCalledTimes(2);
    });

    it('treats arrays and objects as different types', () => {
      const { setter, update } = renderGuarded();
      act(() => update([1, 2]));
      act(() => update({ '0': 1, '1': 2 }));
      expect(setter).toHaveBeenCalledTimes(2);
    });
  });

  describe('array equality', () => {
    it('prevents duplicate array updates with same elements (incl. nested)', () => {
      const { setter, update } = renderGuarded();
      act(() => update([1, 2, 3]));
      act(() => update([1, 2, 3]));
      expect(setter).toHaveBeenCalledTimes(1);
      act(() => update([[1, 2], [3, 4]]));
      act(() => update([[1, 2], [3, 4]]));
      expect(setter).toHaveBeenCalledTimes(2);
    });

    it('allows array updates with different elements', () => {
      const { setter, update } = renderGuarded();
      act(() => update([1, 2, 3]));
      act(() => update([1, 2, 4]));
      expect(setter).toHaveBeenCalledTimes(2);
    });

    it('allows array updates with different order (order-sensitive)', () => {
      const { setter, update } = renderGuarded();
      act(() => update([1, 2, 3]));
      act(() => update([3, 2, 1]));
      expect(setter).toHaveBeenCalledTimes(2);
    });

    it('prevents duplicate empty array updates', () => {
      const { setter, update } = renderGuarded();
      act(() => update([]));
      act(() => update([]));
      expect(setter).toHaveBeenCalledTimes(1);
    });
  });

  describe('Set equality', () => {
    it('prevents duplicate Set updates with same elements', () => {
      const { setter, update } = renderGuarded();
      act(() => update(new Set([1, 2, 3])));
      act(() => update(new Set([1, 2, 3])));
      expect(setter).toHaveBeenCalledTimes(1);
    });

    it('allows Set updates with different elements', () => {
      const { setter, update } = renderGuarded();
      act(() => update(new Set([1, 2, 3])));
      act(() => update(new Set([1, 2, 4])));
      expect(setter).toHaveBeenCalledTimes(2);
    });
  });

  describe('functional updates', () => {
    it('resolves the function and syncs the guard ref so a matching direct value is then suppressed', () => {
      const result = renderGuardedState();
      act(() => result.current.update({ a: 1 }));
      act(() => result.current.update((prev) => ({ ...prev, b: 2 })));
      expect(result.current.value).toEqual({ a: 1, b: 2 });
      // Ref was updated inside the functional updater, so a deep-equal
      // direct value (the SSE echo shape) must not create a new object.
      const before = result.current.value;
      act(() => result.current.update({ a: 1, b: 2 }));
      expect(result.current.value).toBe(before);
    });

    it('returns prev when a functional update resolves to an equal value, keeping state identity', () => {
      const result = renderGuardedState();
      act(() => result.current.update({ a: 1 }));
      const first = result.current.value;
      act(() => result.current.update((prev) => ({ ...prev })));
      expect(result.current.value).toBe(first);
      // A genuinely different result still lands.
      act(() => result.current.update(() => null));
      expect(result.current.value).toBe(null);
    });

    it('suppresses a functional update to null while current is undefined (nullish equality)', () => {
      const result = renderGuardedState();
      act(() => result.current.update(() => null));
      // valuesEqual(undefined, null) === true, so prev (undefined) is returned.
      expect(result.current.value).toBeUndefined();
    });
  });
});
