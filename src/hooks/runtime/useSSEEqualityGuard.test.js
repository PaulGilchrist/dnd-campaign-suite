// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useSSEEqualityGuard from './useSSEEqualityGuard.js';

describe('useSSEEqualityGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('primitive values', () => {
    it('should call setter with new primitive value when different from current', () => {
      const setter = vi.fn();
      const { result } = renderHook(() => useSSEEqualityGuard(setter));
      act(() => {
        result.current('new value');
      });
      expect(setter).toHaveBeenCalledWith('new value');
    });

    it.each([
      [42, 42, 1],
      ['hello', 'hello', 1],
      [true, true, 1],
      [false, false, 1],
      [0, 0, 1],
      ['', '', 1],
    ])('should not call setter when primitive value is the same (value: %p)', (_, sameValue, expectedCalls) => {
      const setter = vi.fn();
      const { result } = renderHook(() => useSSEEqualityGuard(setter));
      act(() => {
        result.current(sameValue);
      });
      act(() => {
        result.current(sameValue);
      });
      expect(setter).toHaveBeenCalledTimes(expectedCalls);
    });

    it.each([
      [true, false],
      [42, 0],
      ['a', 'b'],
    ])('should call setter when primitive value changes (%p -> %p)', (from, to) => {
      const setter = vi.fn();
      const { result } = renderHook(() => useSSEEqualityGuard(setter));
      act(() => {
        result.current(from);
      });
      act(() => {
        result.current(to);
      });
      expect(setter).toHaveBeenCalledTimes(2);
      expect(setter).toHaveBeenLastCalledWith(to);
    });

    it('should not call setter when comparing null to undefined (loose equality treats them as equal)', () => {
      const setter = vi.fn();
      const { result } = renderHook(() => useSSEEqualityGuard(setter));
      act(() => {
        result.current(null);
      });
      act(() => {
        result.current(undefined);
      });
      expect(setter).toHaveBeenCalledTimes(0);
    });

    it('should call setter for NaN values', () => {
      const setter = vi.fn();
      const { result } = renderHook(() => useSSEEqualityGuard(setter));
      act(() => {
        result.current(NaN);
      });
      expect(setter).toHaveBeenCalledTimes(1);
    });

    it('should call setter when NaN is passed twice (NaN !== NaN)', () => {
      const setter = vi.fn();
      const { result } = renderHook(() => useSSEEqualityGuard(setter));
      act(() => {
        result.current(NaN);
      });
      act(() => {
        result.current(NaN);
      });
      expect(setter).toHaveBeenCalledTimes(2);
    });
  });

  describe('object equality', () => {
    it('should not call setter when object has same properties', () => {
      const setter = vi.fn();
      const { result } = renderHook(() => useSSEEqualityGuard(setter));
      act(() => {
        result.current({ a: 1 });
      });
      act(() => {
        result.current({ a: 1 });
      });
      expect(setter).toHaveBeenCalledTimes(1);
    });

    it('should call setter when object has different properties', () => {
      const setter = vi.fn();
      const { result } = renderHook(() => useSSEEqualityGuard(setter));
      act(() => {
        result.current({ a: 1 });
      });
      act(() => {
        result.current({ a: 2 });
      });
      expect(setter).toHaveBeenCalledTimes(2);
    });

    it('should call setter when object has different number of keys', () => {
      const setter = vi.fn();
      const { result } = renderHook(() => useSSEEqualityGuard(setter));
      act(() => {
        result.current({ a: 1 });
      });
      act(() => {
        result.current({ a: 1, b: 2 });
      });
      expect(setter).toHaveBeenCalledTimes(2);
    });

    it('should not call setter when same object reference is passed', () => {
      const setter = vi.fn();
      const { result } = renderHook(() => useSSEEqualityGuard(setter));
      const obj = { a: 1 };
      act(() => {
        result.current(obj);
      });
      act(() => {
        result.current(obj);
      });
      expect(setter).toHaveBeenCalledTimes(1);
    });

    it('should handle nested object equality', () => {
      const setter = vi.fn();
      const { result } = renderHook(() => useSSEEqualityGuard(setter));
      const deep = { a: { b: { c: 1 } } };
      act(() => {
        result.current(deep);
      });
      act(() => {
        result.current(deep);
      });
      expect(setter).toHaveBeenCalledTimes(1);
    });

    it('should call setter for nested object with different value', () => {
      const setter = vi.fn();
      const { result } = renderHook(() => useSSEEqualityGuard(setter));
      act(() => {
        result.current({ a: { b: { c: 1 } } });
      });
      act(() => {
        result.current({ a: { b: { c: 2 } } });
      });
      expect(setter).toHaveBeenCalledTimes(2);
    });

    it('should handle empty object equality', () => {
      const setter = vi.fn();
      const { result } = renderHook(() => useSSEEqualityGuard(setter));
      act(() => {
        result.current({});
      });
      act(() => {
        result.current({});
      });
      expect(setter).toHaveBeenCalledTimes(1);
    });

    it('should call setter when comparing object to non-object', () => {
      const setter = vi.fn();
      const { result } = renderHook(() => useSSEEqualityGuard(setter));
      act(() => {
        result.current({ a: 1 });
      });
      act(() => {
        result.current('string');
      });
      expect(setter).toHaveBeenCalledTimes(2);
    });
  });

  describe('array equality', () => {
    it('should not call setter when array has same elements in same order', () => {
      const setter = vi.fn();
      const { result } = renderHook(() => useSSEEqualityGuard(setter));
      act(() => {
        result.current([1, 2, 3]);
      });
      act(() => {
        result.current([1, 2, 3]);
      });
      expect(setter).toHaveBeenCalledTimes(1);
    });

    it('should call setter when array has different elements', () => {
      const setter = vi.fn();
      const { result } = renderHook(() => useSSEEqualityGuard(setter));
      act(() => {
        result.current([1, 2, 3]);
      });
      act(() => {
        result.current([1, 2, 4]);
      });
      expect(setter).toHaveBeenCalledTimes(2);
    });

    it('should handle empty array equality', () => {
      const setter = vi.fn();
      const { result } = renderHook(() => useSSEEqualityGuard(setter));
      act(() => {
        result.current([]);
      });
      act(() => {
        result.current([]);
      });
      expect(setter).toHaveBeenCalledTimes(1);
    });

    it('should call setter when comparing array to object', () => {
      const setter = vi.fn();
      const { result } = renderHook(() => useSSEEqualityGuard(setter));
      act(() => {
        result.current([1, 2]);
      });
      act(() => {
        result.current({ 0: 1, 1: 2 });
      });
      expect(setter).toHaveBeenCalledTimes(2);
    });
  });

  describe('Set equality', () => {
    it('should not call setter when Set has same elements', () => {
      const setter = vi.fn();
      const { result } = renderHook(() => useSSEEqualityGuard(setter));
      act(() => {
        result.current(new Set([1, 2, 3]));
      });
      act(() => {
        result.current(new Set([1, 2, 3]));
      });
      expect(setter).toHaveBeenCalledTimes(1);
    });

    it('should call setter when Set has different elements', () => {
      const setter = vi.fn();
      const { result } = renderHook(() => useSSEEqualityGuard(setter));
      act(() => {
        result.current(new Set([1, 2, 3]));
      });
      act(() => {
        result.current(new Set([1, 2, 4]));
      });
      expect(setter).toHaveBeenCalledTimes(2);
    });

    it('should call setter when Set has different size', () => {
      const setter = vi.fn();
      const { result } = renderHook(() => useSSEEqualityGuard(setter));
      act(() => {
        result.current(new Set([1, 2, 3]));
      });
      act(() => {
        result.current(new Set([1, 2]));
      });
      expect(setter).toHaveBeenCalledTimes(2);
    });

    it('should handle empty Set equality', () => {
      const setter = vi.fn();
      const { result } = renderHook(() => useSSEEqualityGuard(setter));
      act(() => {
        result.current(new Set());
      });
      act(() => {
        result.current(new Set());
      });
      expect(setter).toHaveBeenCalledTimes(1);
    });

    it('should call setter when comparing Set to non-Set', () => {
      const setter = vi.fn();
      const { result } = renderHook(() => useSSEEqualityGuard(setter));
      act(() => {
        result.current(new Set([1, 2, 3]));
      });
      act(() => {
        result.current([1, 2, 3]);
      });
      expect(setter).toHaveBeenCalledTimes(2);
    });
  });

  describe('functional updates', () => {
    it('should prevent state update when functional update returns same value as current', () => {
      const setter = vi.fn();
      const { result } = renderHook(() => useSSEEqualityGuard(setter));
      act(() => {
        result.current({ a: 1 });
      });
      act(() => {
        result.current(prev => prev);
      });
      expect(setter).toHaveBeenCalledTimes(2);
      expect(setter).toHaveBeenNthCalledWith(1, { a: 1 });
      expect(setter).toHaveBeenNthCalledWith(2, expect.any(Function));
    });

    it('should prevent state update when functional update returns prev when prev is null', () => {
      const setter = vi.fn();
      const { result } = renderHook(() => useSSEEqualityGuard(setter));
      act(() => {
        result.current(null);
      });
      act(() => {
        result.current(prev => prev);
      });
      expect(setter).toHaveBeenCalledTimes(1);
    });

    it('should call setter when functional update returns different object', () => {
      const setter = vi.fn();
      const { result } = renderHook(() => useSSEEqualityGuard(setter));
      act(() => {
        result.current({ a: 1 });
      });
      act(() => {
        result.current(prev => ({ ...prev, b: 2 }));
      });
      expect(setter).toHaveBeenCalledTimes(2);
    });

    it('should prevent state update when functional update returns null and current is null', () => {
      const setter = vi.fn();
      const { result } = renderHook(() => useSSEEqualityGuard(setter));
      act(() => {
        result.current(null);
      });
      act(() => {
        result.current(() => null);
      });
      expect(setter).toHaveBeenCalledTimes(1);
    });

    it('should call setter when functional update changes value from undefined', () => {
      const setter = vi.fn();
      const { result } = renderHook(() => useSSEEqualityGuard(setter));
      act(() => {
        result.current(_prev => 'initial');
      });
      expect(setter).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('special values', () => {
    it('should call setter when comparing Map to non-Map', () => {
      const setter = vi.fn();
      const { result } = renderHook(() => useSSEEqualityGuard(setter));
      act(() => {
        result.current(new Map([['a', 1]]));
      });
      act(() => {
        result.current({ a: 1 });
      });
      expect(setter).toHaveBeenCalledTimes(2);
    });

    it('should not call setter when same Symbol is passed twice', () => {
      const setter = vi.fn();
      const sym = Symbol('test');
      const { result } = renderHook(() => useSSEEqualityGuard(setter));
      act(() => {
        result.current(sym);
      });
      act(() => {
        result.current(sym);
      });
      expect(setter).toHaveBeenCalledTimes(1);
    });
  });

  describe('state tracking', () => {
    it('should update currentValueRef when setter is called with sequential values', () => {
      const setter = vi.fn();
      const { result } = renderHook(() => useSSEEqualityGuard(setter));
      act(() => {
        result.current('first');
      });
      act(() => {
        result.current('second');
      });
      expect(setter).toHaveBeenCalledTimes(2);
      expect(setter).toHaveBeenNthCalledWith(1, 'first');
      expect(setter).toHaveBeenNthCalledWith(2, 'second');
    });

    it('should not call setter when reverting to a previously seen value', () => {
      const setter = vi.fn();
      const { result } = renderHook(() => useSSEEqualityGuard(setter));
      act(() => {
        result.current('a');
      });
      act(() => {
        result.current('b');
      });
      act(() => {
        result.current('a');
      });
      expect(setter).toHaveBeenCalledTimes(3);
    });
  });
});
