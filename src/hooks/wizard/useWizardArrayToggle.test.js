// @improved-by-ai
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useWizardArrayToggle from './useWizardArrayToggle.js';

describe('useWizardArrayToggle', () => {
  let currentData;
  let setFormData;
  let setErrors;

  beforeEach(() => {
    currentData = {};
    setFormData = vi.fn((fn) => {
      currentData = fn(currentData);
    });
    setErrors = vi.fn();
  });

  function renderToggle(field, preSelectedItems = []) {
    return renderHook(() =>
      useWizardArrayToggle(setFormData, setErrors, field, preSelectedItems)
    );
  }

  describe('return value', () => {
    it('returns toggleItem, setItem, and removeItem functions', () => {
      const { result } = renderToggle('testField');
      expect(typeof result.current.toggleItem).toBe('function');
      expect(typeof result.current.setItem).toBe('function');
      expect(typeof result.current.removeItem).toBe('function');
    });
  });

  describe('toggleItem', () => {
    it('adds item when not in array', () => {
      const { result } = renderToggle('testField');
      act(() => {
        result.current.toggleItem('Item1');
      });
      expect(currentData.testField).toContain('Item1');
    });

    it('removes item when already in array', () => {
      currentData = { testField: ['Item1', 'Item2'] };
      const { result } = renderToggle('testField');
      act(() => {
        result.current.toggleItem('Item1');
      });
      expect(currentData.testField).not.toContain('Item1');
      expect(currentData.testField).toEqual(['Item2']);
    });

    it('toggles item on and off', () => {
      const { result } = renderToggle('testField');
      act(() => {
        result.current.toggleItem('Item1');
      });
      expect(currentData.testField).toContain('Item1');
      act(() => {
        result.current.toggleItem('Item1');
      });
      expect(currentData.testField).not.toContain('Item1');
    });

    it('clears error on toggle', () => {
      const { result } = renderToggle('testField');
      act(() => {
        result.current.toggleItem('Item1');
      });
      expect(setErrors).toHaveBeenCalledWith(expect.any(Function));
    });

    it('does not toggle when opt is true', () => {
      currentData = { testField: ['PreItem'] };
      const { result } = renderToggle('testField', ['PreItem']);
      act(() => {
        result.current.toggleItem('PreItem', true);
      });
      expect(currentData.testField).toContain('PreItem');
    });

    it('does not toggle when opt.isPreSelected is true', () => {
      currentData = { testField: ['PreItem'] };
      const { result } = renderToggle('testField', ['PreItem']);
      act(() => {
        result.current.toggleItem('PreItem', { isPreSelected: true });
      });
      expect(currentData.testField).toContain('PreItem');
    });

    it('does not toggle pre-selected items even when opt is false', () => {
      currentData = { testField: ['PreItem'] };
      const { result } = renderToggle('testField', ['PreItem']);
      act(() => {
        result.current.toggleItem('PreItem', false);
      });
      expect(currentData.testField).toContain('PreItem');
    });

    it('toggles non-pre-selected items even when they are in preSelectedItems array', () => {
      currentData = { testField: ['PreItem', 'OtherItem'] };
      const { result } = renderToggle('testField', ['PreItem']);
      act(() => {
        result.current.toggleItem('OtherItem');
      });
      expect(currentData.testField).not.toContain('OtherItem');
    });
  });

  describe('setItem', () => {
    it('adds item when not present', () => {
      const { result } = renderToggle('testField');
      act(() => {
        result.current.setItem('Item2');
      });
      expect(currentData.testField).toContain('Item2');
    });

    it('does not duplicate item when already present', () => {
      currentData = { testField: ['Item1'] };
      const { result } = renderToggle('testField');
      act(() => {
        result.current.setItem('Item1');
      });
      expect(currentData.testField.filter((i) => i === 'Item1').length).toBe(1);
    });

    it('clears error', () => {
      const { result } = renderToggle('testField');
      act(() => {
        result.current.setItem('Item2');
      });
      expect(setErrors).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('removeItem', () => {
    it('removes item when present', () => {
      currentData = { testField: ['Item1', 'Item2'] };
      const { result } = renderToggle('testField');
      act(() => {
        result.current.removeItem('Item1');
      });
      expect(currentData.testField).not.toContain('Item1');
      expect(currentData.testField).toEqual(['Item2']);
    });

    it('does nothing when item not present', () => {
      currentData = { testField: ['Item1'] };
      const { result } = renderToggle('testField');
      act(() => {
        result.current.removeItem('NonExistent');
      });
      expect(currentData.testField).toEqual(['Item1']);
    });

    it('clears error', () => {
      currentData = { testField: ['Item1'] };
      const { result } = renderToggle('testField');
      act(() => {
        result.current.removeItem('Item1');
      });
      expect(setErrors).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('nested field paths', () => {
    it('handles dot-notation field paths', () => {
      currentData = { nested: { field: ['Item1'] } };
      const { result } = renderToggle('nested.field');
      act(() => {
        result.current.toggleItem('Item2');
      });
      expect(currentData.nested.field).toContain('Item2');
    });

    it('creates nested path when it does not exist', () => {
      currentData = {};
      const { result } = renderToggle('new.nested.field');
      act(() => {
        result.current.setItem('Item1');
      });
      expect(currentData.new.nested.field).toContain('Item1');
    });

    it('handles nested field with setItem', () => {
      currentData = { nested: { field: ['Item1'] } };
      const { result } = renderToggle('nested.field');
      act(() => {
        result.current.setItem('Item2');
      });
      expect(currentData.nested.field).toContain('Item2');
    });

    it('handles nested field with removeItem', () => {
      currentData = { nested: { field: ['Item1', 'Item2'] } };
      const { result } = renderToggle('nested.field');
      act(() => {
        result.current.removeItem('Item1');
      });
      expect(currentData.nested.field).not.toContain('Item1');
    });
  });

  describe('preSelectedItems edge cases', () => {
    it('toggles normally when preSelectedItems is undefined', () => {
      currentData = { testField: ['Item1'] };
      const { result } = renderHook(() =>
        useWizardArrayToggle(setFormData, setErrors, 'testField', undefined)
      );
      act(() => {
        result.current.toggleItem('Item1');
      });
      expect(currentData.testField).not.toContain('Item1');
    });

    it('toggles normally when preSelectedItems is empty array', () => {
      currentData = { testField: ['Item1'] };
      const { result } = renderHook(() =>
        useWizardArrayToggle(setFormData, setErrors, 'testField', [])
      );
      act(() => {
        result.current.toggleItem('Item1');
      });
      expect(currentData.testField).not.toContain('Item1');
    });
  });

  describe('sequential operations', () => {
    it('handles multiple operations in sequence', () => {
      const { result } = renderToggle('testField');
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
  });

  describe('null item handling', () => {
    it('toggles null item on and off', () => {
      currentData = { testField: [null] };
      const { result } = renderToggle('testField');
      act(() => {
        result.current.toggleItem(null);
      });
      expect(currentData.testField).not.toContain(null);
    });

    it('adds null item via setItem', () => {
      currentData = { testField: ['Item1'] };
      const { result } = renderToggle('testField');
      act(() => {
        result.current.setItem(null);
      });
      expect(currentData.testField).toContain(null);
    });

    it('removes null item via removeItem', () => {
      currentData = { testField: ['Item1', null] };
      const { result } = renderToggle('testField');
      act(() => {
        result.current.removeItem(null);
      });
      expect(currentData.testField).not.toContain(null);
    });
  });
});
