import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useSSEEqualityGuard from './useSSEEqualityGuard.js';

describe('useSSEEqualityGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call setter with new value when different from current', () => {
    const setter = vi.fn();
    const { result } = renderHook(() => useSSEEqualityGuard(setter));
    act(() => {
      result.current('new value');
    });
    expect(setter).toHaveBeenCalledWith('new value');
  });

  it('should not call setter when value is the same as current (strict equality)', () => {
    const setter = vi.fn();
    const { result } = renderHook(() => useSSEEqualityGuard(setter));
    act(() => {
      result.current('same value');
    });
    act(() => {
      result.current('same value');
    });
    expect(setter).toHaveBeenCalledTimes(1);
  });

  it('should not call setter when value is same object reference', () => {
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

  it('should not call setter when object has different number of keys', () => {
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

  it('should not call setter when Set has different size', () => {
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

  it('should not call setter when comparing Set to non-Set', () => {
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

















  it('should not call setter for functional update returning prev when prev is null', () => {
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

  it('should call setter for functional update returning different object', () => {
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



  it('should handle nested object equality', () => {
    const setter = vi.fn();
    const { result } = renderHook(() => useSSEEqualityGuard(setter));
    act(() => {
      result.current({ a: { b: { c: 1 } } });
    });
    act(() => {
      result.current({ a: { b: { c: 1 } } });
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

  it('should handle array vs object comparison', () => {
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

  it('should call setter with primitive values', () => {
    const setter = vi.fn();
    const { result } = renderHook(() => useSSEEqualityGuard(setter));
    act(() => {
      result.current(42);
    });
    act(() => {
      result.current('string');
    });
    act(() => {
      result.current(true);
    });
    expect(setter).toHaveBeenCalledTimes(3);
  });

  it('should not call setter for same primitive values', () => {
    const setter = vi.fn();
    const { result } = renderHook(() => useSSEEqualityGuard(setter));
    act(() => {
      result.current(42);
    });
    act(() => {
      result.current(42);
    });
    expect(setter).toHaveBeenCalledTimes(1);
  });

  it('should not call setter for same string values', () => {
    const setter = vi.fn();
    const { result } = renderHook(() => useSSEEqualityGuard(setter));
    act(() => {
      result.current('hello');
    });
    act(() => {
      result.current('hello');
    });
    expect(setter).toHaveBeenCalledTimes(1);
  });

  it('should not call setter for same boolean values', () => {
    const setter = vi.fn();
    const { result } = renderHook(() => useSSEEqualityGuard(setter));
    act(() => {
      result.current(true);
    });
    act(() => {
      result.current(true);
    });
    expect(setter).toHaveBeenCalledTimes(1);
  });

  it('should call setter for different boolean values', () => {
    const setter = vi.fn();
    const { result } = renderHook(() => useSSEEqualityGuard(setter));
    act(() => {
      result.current(true);
    });
    act(() => {
      result.current(false);
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



  it('should handle functional update that returns null when current is null', () => {
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

  it('should update currentValueRef when setter is called', () => {
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


});
