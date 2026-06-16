import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useWizardArrayToggle from './useWizardArrayToggle.js';

describe('useWizardArrayToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return toggleItem, setItem, and removeItem functions', () => {
    const setFormData = vi.fn();
    const setErrors = vi.fn();
    const { result } = renderHook(() =>
      useWizardArrayToggle(setFormData, setErrors, 'testField', [])
    );
    expect(typeof result.current.toggleItem).toBe('function');
    expect(typeof result.current.setItem).toBe('function');
    expect(typeof result.current.removeItem).toBe('function');
  });

  it('toggleItem should add item when not in array', () => {
    let currentData = { testField: [] };
    const setFormData = vi.fn((fn) => {
      currentData = fn(currentData);
    });
    const setErrors = vi.fn();
    const { result } = renderHook(() =>
      useWizardArrayToggle(setFormData, setErrors, 'testField', [])
    );
    act(() => {
      result.current.toggleItem('Item1');
    });
    expect(currentData.testField).toContain('Item1');
  });

  it('toggleItem should remove item when in array', () => {
    let currentData = { testField: ['Item1', 'Item2'] };
    const setFormData = vi.fn((fn) => {
      currentData = fn(currentData);
    });
    const setErrors = vi.fn();
    const { result } = renderHook(() =>
      useWizardArrayToggle(setFormData, setErrors, 'testField', [])
    );
    act(() => {
      result.current.toggleItem('Item1');
    });
    expect(currentData.testField).not.toContain('Item1');
  });

  it('toggleItem should toggle item on and off', () => {
    let currentData = { testField: [] };
    const setFormData = vi.fn((fn) => {
      currentData = fn(currentData);
    });
    const setErrors = vi.fn();
    const { result } = renderHook(() =>
      useWizardArrayToggle(setFormData, setErrors, 'testField', [])
    );
    act(() => {
      result.current.toggleItem('Item1');
    });
    expect(currentData.testField).toContain('Item1');
    act(() => {
      result.current.toggleItem('Item1');
    });
    expect(currentData.testField).not.toContain('Item1');
  });

  it('toggleItem should clear error on toggle', () => {
    let errors = { testField: 'Error exists' };
    let currentData = { testField: [] };
    const setFormData = vi.fn((fn) => {
      currentData = fn(currentData);
    });
    const setErrors = vi.fn();
    const { result } = renderHook(() =>
      useWizardArrayToggle(setFormData, setErrors, 'testField', [])
    );
    act(() => {
      result.current.toggleItem('Item1');
    });
    expect(setFormData).toHaveBeenCalled();
    expect(setErrors).toHaveBeenCalledWith(expect.any(Function));
  });

  it('toggleItem should not toggle pre-selected items when opt is true', () => {
    let currentData = { testField: ['PreItem'] };
    const setFormData = vi.fn((fn) => {
      currentData = fn(currentData);
    });
    const setErrors = vi.fn();
    const { result } = renderHook(() =>
      useWizardArrayToggle(setFormData, setErrors, 'testField', ['PreItem'])
    );
    act(() => {
      result.current.toggleItem('PreItem', true);
    });
    expect(currentData.testField).toContain('PreItem');
  });

  it('toggleItem should not toggle pre-selected items with isPreSelected flag', () => {
    let currentData = { testField: ['PreItem'] };
    const setFormData = vi.fn((fn) => {
      currentData = fn(currentData);
    });
    const setErrors = vi.fn();
    const { result } = renderHook(() =>
      useWizardArrayToggle(setFormData, setErrors, 'testField', ['PreItem'])
    );
    act(() => {
      result.current.toggleItem('PreItem', { isPreSelected: true });
    });
    expect(currentData.testField).toContain('PreItem');
  });

  it('should not toggle pre-selected items when in preSelectedItems (regardless of opt)', () => {
    let currentData = { testField: ['PreItem'] };
    const setFormData = vi.fn((fn) => {
      currentData = fn(currentData);
    });
    const setErrors = vi.fn();
    const { result } = renderHook(() =>
      useWizardArrayToggle(setFormData, setErrors, 'testField', ['PreItem'])
    );
    act(() => {
      result.current.toggleItem('PreItem', false);
    });
    // preSelectedItems check blocks toggling even with opt=false
    expect(currentData.testField).toContain('PreItem');
  });

  it('setItem should add item when not present', () => {
    let currentData = { testField: ['Item1'] };
    const setFormData = vi.fn((fn) => {
      currentData = fn(currentData);
    });
    const setErrors = vi.fn();
    const { result } = renderHook(() =>
      useWizardArrayToggle(setFormData, setErrors, 'testField', [])
    );
    act(() => {
      result.current.setItem('Item2');
    });
    expect(currentData.testField).toContain('Item2');
  });

  it('setItem should not duplicate item when already present', () => {
    let currentData = { testField: ['Item1'] };
    const setFormData = vi.fn((fn) => {
      currentData = fn(currentData);
    });
    const setErrors = vi.fn();
    const { result } = renderHook(() =>
      useWizardArrayToggle(setFormData, setErrors, 'testField', [])
    );
    act(() => {
      result.current.setItem('Item1');
    });
    expect(currentData.testField.filter(i => i === 'Item1').length).toBe(1);
  });

  it('setItem should clear error', () => {
    let currentData = { testField: ['Item1'] };
    const setFormData = vi.fn((fn) => {
      currentData = fn(currentData);
    });
    const setErrors = vi.fn();
    const { result } = renderHook(() =>
      useWizardArrayToggle(setFormData, setErrors, 'testField', [])
    );
    act(() => {
      result.current.setItem('Item2');
    });
    expect(setErrors).toHaveBeenCalledWith(expect.any(Function));
  });

  it('removeItem should remove item when present', () => {
    let currentData = { testField: ['Item1', 'Item2'] };
    const setFormData = vi.fn((fn) => {
      currentData = fn(currentData);
    });
    const setErrors = vi.fn();
    const { result } = renderHook(() =>
      useWizardArrayToggle(setFormData, setErrors, 'testField', [])
    );
    act(() => {
      result.current.removeItem('Item1');
    });
    expect(currentData.testField).not.toContain('Item1');
  });

  it('removeItem should do nothing when item not present', () => {
    let currentData = { testField: ['Item1'] };
    const setFormData = vi.fn((fn) => {
      currentData = fn(currentData);
    });
    const setErrors = vi.fn();
    const { result } = renderHook(() =>
      useWizardArrayToggle(setFormData, setErrors, 'testField', [])
    );
    act(() => {
      result.current.removeItem('NonExistent');
    });
    expect(currentData.testField).toEqual(['Item1']);
  });

  it('removeItem should clear error', () => {
    let currentData = { testField: ['Item1'] };
    const setFormData = vi.fn((fn) => {
      currentData = fn(currentData);
    });
    const setErrors = vi.fn();
    const { result } = renderHook(() =>
      useWizardArrayToggle(setFormData, setErrors, 'testField', [])
    );
    act(() => {
      result.current.removeItem('Item1');
    });
    expect(setErrors).toHaveBeenCalledWith(expect.any(Function));
  });

  it('should handle nested field paths', () => {
    let currentData = { nested: { field: ['Item1'] } };
    const setFormData = vi.fn((fn) => {
      currentData = fn(currentData);
    });
    const setErrors = vi.fn();
    const { result } = renderHook(() =>
      useWizardArrayToggle(setFormData, setErrors, 'nested.field', [])
    );
    act(() => {
      result.current.toggleItem('Item2');
    });
    expect(currentData.nested.field).toContain('Item2');
  });

  it('should handle preSelectedItems as undefined', () => {
    let currentData = { testField: ['Item1'] };
    const setFormData = vi.fn((fn) => {
      currentData = fn(currentData);
    });
    const setErrors = vi.fn();
    const { result } = renderHook(() =>
      useWizardArrayToggle(setFormData, setErrors, 'testField', undefined)
    );
    act(() => {
      result.current.toggleItem('Item1');
    });
    expect(currentData.testField).not.toContain('Item1');
  });

  it('should handle preSelectedItems as empty array', () => {
    let currentData = { testField: ['Item1'] };
    const setFormData = vi.fn((fn) => {
      currentData = fn(currentData);
    });
    const setErrors = vi.fn();
    const { result } = renderHook(() =>
      useWizardArrayToggle(setFormData, setErrors, 'testField', [])
    );
    act(() => {
      result.current.toggleItem('Item1');
    });
    expect(currentData.testField).not.toContain('Item1');
  });

  it('should handle nested field that does not exist yet', () => {
    let currentData = {};
    const setFormData = vi.fn((fn) => {
      currentData = fn(currentData);
    });
    const setErrors = vi.fn();
    const { result } = renderHook(() =>
      useWizardArrayToggle(setFormData, setErrors, 'new.nested.field', [])
    );
    act(() => {
      result.current.setItem('Item1');
    });
    expect(currentData.new.nested.field).toContain('Item1');
  });

  it('should handle multiple toggles in sequence', () => {
    let currentData = { testField: [] };
    const setFormData = vi.fn((fn) => {
      currentData = fn(currentData);
    });
    const setErrors = vi.fn();
    const { result } = renderHook(() =>
      useWizardArrayToggle(setFormData, setErrors, 'testField', [])
    );
    act(() => {
      result.current.toggleItem('A');
    });
    expect(currentData.testField).toEqual(['A']);
    act(() => {
      result.current.setItem('B');
    });
    expect(currentData.testField).toEqual(['A', 'B']);
    act(() => {
      result.current.removeItem('A');
    });
    expect(currentData.testField).toEqual(['B']);
    act(() => {
      result.current.toggleItem('A');
    });
    expect(currentData.testField).toEqual(['B', 'A']);
  });

  it('should handle toggleItem with null item', () => {
    let currentData = { testField: [null] };
    const setFormData = vi.fn((fn) => {
      currentData = fn(currentData);
    });
    const setErrors = vi.fn();
    const { result } = renderHook(() =>
      useWizardArrayToggle(setFormData, setErrors, 'testField', [])
    );
    act(() => {
      result.current.toggleItem(null);
    });
    expect(currentData.testField).not.toContain(null);
  });

  it('should handle setItem with null item', () => {
    let currentData = { testField: ['Item1'] };
    const setFormData = vi.fn((fn) => {
      currentData = fn(currentData);
    });
    const setErrors = vi.fn();
    const { result } = renderHook(() =>
      useWizardArrayToggle(setFormData, setErrors, 'testField', [])
    );
    act(() => {
      result.current.setItem(null);
    });
    expect(currentData.testField).toContain(null);
  });

  it('should handle removeItem with null item', () => {
    let currentData = { testField: ['Item1', null] };
    const setFormData = vi.fn((fn) => {
      currentData = fn(currentData);
    });
    const setErrors = vi.fn();
    const { result } = renderHook(() =>
      useWizardArrayToggle(setFormData, setErrors, 'testField', [])
    );
    act(() => {
      result.current.removeItem(null);
    });
    expect(currentData.testField).not.toContain(null);
  });
});
