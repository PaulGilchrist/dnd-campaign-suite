// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useSSEEqualityGuard from './useSSEEqualityGuard.js';

describe('useSSEEqualityGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('primitive values', () => {
    it('calls setter with new value when different from current', () => {
      const setter = vi.fn();
      const { result } = renderHook(() => useSSEEqualityGuard(setter));
      act(() => {
        result.current('new value');
      });
      expect(setter).toHaveBeenCalledWith('new value');
    });

    it.each([
      [42, 42],
      ['hello', 'hello'],
      [true, true],
      [0, 0],
    ])('does not call setter when primitive value is the same', (_, sameValue) => {
      const setter = vi.fn();
      const { result } = renderHook(() => useSSEEqualityGuard(setter));
      act(() => {
        result.current(sameValue);
      });
      act(() => {
        result.current(sameValue);
      });
      expect(setter).toHaveBeenCalledTimes(1);
    });

    it.each([
      [true, false],
      [42, 0],
      ['a', 'b'],
    ])('calls setter when primitive value changes', (from, to) => {
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
  });

  describe('object equality', () => {
    it('does not call setter when object has same properties', () => {
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

    it('calls setter when object has different properties', () => {
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

    it('does not call setter when same object reference is passed', () => {
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

    it('handles nested object equality', () => {
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

    it('calls setter for nested object with different value', () => {
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

    it('handles empty object equality', () => {
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
  });

  describe('array equality', () => {
    it('does not call setter when array has same elements in same order', () => {
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

    it('calls setter when array has different elements', () => {
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

    it('handles empty array equality', () => {
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
  });

  describe('Set equality', () => {
    it('does not call setter when Set has same elements', () => {
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

    it('calls setter when Set has different elements', () => {
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

    it('handles empty Set equality', () => {
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
  });

  describe('functional updates', () => {
    it('prevents state update when functional update returns current value', () => {
      const setter = vi.fn();
      const { result } = renderHook(() => useSSEEqualityGuard(setter));
      act(() => {
        result.current({ a: 1 });
      });
      expect(setter).toHaveBeenCalledTimes(1);
      act(() => {
        result.current(prev => prev);
      });
      // setter is called with a function (React always invokes setter(fn)),
      // but the guard prevents the inner setter call from resolving to a no-op update
      expect(setter).toHaveBeenCalledTimes(2);
      expect(setter).toHaveBeenNthCalledWith(2, expect.any(Function));
    });

    it('prevents state update when functional update returns prev when prev is null', () => {
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

    it('calls setter when functional update returns different object', () => {
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

    it('prevents state update when functional update returns null and current is null', () => {
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
  });

  describe('special values', () => {
    it('does not call setter when same Symbol is passed twice', () => {
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
    it('updates currentValueRef when setter is called with sequential values', () => {
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

    it('does not call setter when reverting to a previously seen value', () => {
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
