import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useSSEEqualityGuard from './useSSEEqualityGuard.js';

describe('useSSEEqualityGuard', () => {
  function renderGuarded() {
    const setter = vi.fn();
    const { result } = renderHook(() => useSSEEqualityGuard(setter));
    return { setter, update: result.current };
  }

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
  });

  describe('null and undefined', () => {
    it('suppresses the first null update (undefined === null in valuesEqual)', () => {
      const { setter, update } = renderGuarded();
      // currentValueRef.current starts as undefined; valuesEqual(undefined, null)
      // returns true because both pass the nullish check (a == b where undefined == null).
      act(() => update(null));
      expect(setter).toHaveBeenCalledTimes(0);
      // Second null also suppressed for the same reason.
      act(() => update(null));
      expect(setter).toHaveBeenCalledTimes(0);
    });

    it('suppresses the first undefined update (undefined === undefined)', () => {
      const { setter, update } = renderGuarded();
      act(() => update(undefined));
      expect(setter).toHaveBeenCalledTimes(0);
    });

    it('suppresses null after undefined (both nullish, valuesEqual returns true)', () => {
      const { setter, update } = renderGuarded();
      act(() => update(undefined));
      act(() => update(null));
      // currentValueRef.current is still undefined after first call.
      // valuesEqual(undefined, null) = true, so setter is never called.
      expect(setter).toHaveBeenCalledTimes(0);
    });

    it('suppresses undefined after null (both nullish, valuesEqual returns true)', () => {
      const { setter, update } = renderGuarded();
      act(() => update(null));
      act(() => update(undefined));
      // currentValueRef.current is still undefined after first call.
      // valuesEqual(undefined, undefined) = true, so setter is never called.
      expect(setter).toHaveBeenCalledTimes(0);
    });
  });

  describe('object equality', () => {
    it('prevents duplicate object updates with same properties', () => {
      const { setter, update } = renderGuarded();
      act(() => update({ a: 1 }));
      act(() => update({ a: 1 }));
      expect(setter).toHaveBeenCalledTimes(1);
    });

    it('allows object updates with different properties', () => {
      const { setter, update } = renderGuarded();
      act(() => update({ a: 1 }));
      act(() => update({ a: 2 }));
      expect(setter).toHaveBeenCalledTimes(2);
    });

    it('prevents duplicate empty object updates', () => {
      const { setter, update } = renderGuarded();
      act(() => update({}));
      act(() => update({}));
      expect(setter).toHaveBeenCalledTimes(1);
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
    it('prevents duplicate array updates with same elements', () => {
      const { setter, update } = renderGuarded();
      act(() => update([1, 2, 3]));
      act(() => update([1, 2, 3]));
      expect(setter).toHaveBeenCalledTimes(1);
    });

    it('allows array updates with different elements', () => {
      const { setter, update } = renderGuarded();
      act(() => update([1, 2, 3]));
      act(() => update([1, 2, 4]));
      expect(setter).toHaveBeenCalledTimes(2);
    });

    it('allows array updates with different order', () => {
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

    it('prevents duplicate nested array updates', () => {
      const { setter, update } = renderGuarded();
      act(() => update([[1, 2], [3, 4]]));
      act(() => update([[1, 2], [3, 4]]));
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

    it('prevents duplicate empty Set updates', () => {
      const { setter, update } = renderGuarded();
      act(() => update(new Set()));
      act(() => update(new Set()));
      expect(setter).toHaveBeenCalledTimes(1);
    });
  });

  describe('NaN handling', () => {
    it('allows duplicate NaN updates (NaN !== NaN in JS, no special handling)', () => {
      const { setter, update } = renderGuarded();
      act(() => update(NaN));
      act(() => update(NaN));
      // NaN !== NaN and typeof NaN is 'number', not 'object',
      // so valuesEqual returns false and setter is called twice.
      expect(setter).toHaveBeenCalledTimes(2);
    });
  });

  describe('functional updates', () => {
    it('prevents state change when functional update returns the current value', () => {
      const { setter, update } = renderGuarded();
      act(() => update({ a: 1 }));
      act(() => update((prev) => prev));
      // The functional path always calls setter(fn), but the guard prevents
      // the state from actually changing by returning prev inside the function.
      expect(setter).toHaveBeenCalledTimes(2);
      expect(setter).toHaveBeenNthCalledWith(2, expect.any(Function));
    });

    it('allows state change when functional update returns a different value', () => {
      const { setter, update } = renderGuarded();
      act(() => update({ a: 1 }));
      act(() => update((prev) => ({ ...prev, b: 2 })));
      expect(setter).toHaveBeenCalledTimes(2);
    });

    it('allows state change when functional update returns null and current is null', () => {
      const { setter, update } = renderGuarded();
      // First null is suppressed because currentValueRef.current is undefined
      // and valuesEqual(undefined, null) returns true (both nullish).
      act(() => update(null));
      expect(setter).toHaveBeenCalledTimes(0);
      // Functional path always calls setter(fn), so setter is called once.
      act(() => update(() => null));
      expect(setter).toHaveBeenCalledTimes(1);
    });

    it('allows state change when functional update returns null and current is not null', () => {
      const { setter, update } = renderGuarded();
      act(() => update({ a: 1 }));
      act(() => update(() => null));
      expect(setter).toHaveBeenCalledTimes(2);
    });

    it('allows state change when functional update returns same object reference', () => {
      const { setter, update } = renderGuarded();
      const obj = { a: 1 };
      act(() => update(obj));
      // currentValueRef.current is obj, result is obj, valuesEqual(obj, obj) = true,
      // so the inner function returns prev — but setter(fn) was still called.
      act(() => update(() => obj));
      expect(setter).toHaveBeenCalledTimes(2);
    });
  });

  describe('special values', () => {
    it('prevents duplicate Symbol updates for the same symbol', () => {
      const { setter, update } = renderGuarded();
      const sym = Symbol('test');
      act(() => update(sym));
      act(() => update(sym));
      expect(setter).toHaveBeenCalledTimes(1);
    });

    it('allows different Symbol values', () => {
      const { setter, update } = renderGuarded();
      act(() => update(Symbol('a')));
      act(() => update(Symbol('b')));
      expect(setter).toHaveBeenCalledTimes(2);
    });
  });
});
