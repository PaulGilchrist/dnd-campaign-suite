// @maintained-by-ai
// Contract test for the pure useWizardArrayToggle hook: array add/remove/toggle
// over the (setFormData, setErrors) setState API, nested dot-path support,
// pre-selection locks, and per-field error clearing. Deterministic against
// mocks — no app internals, network, or DOM involved.
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

  // Assert the last setErrors call posted an updater that nulls `field`
  // while leaving other fields' errors untouched.
  function expectErrorCleared(field) {
    expect(setErrors).toHaveBeenCalled();
    const updater = setErrors.mock.calls.at(-1)[0];
    expect(updater({ [field]: 'some error', otherField: 'kept error' })).toEqual({
      [field]: null,
      otherField: 'kept error',
    });
  }

  describe('toggleItem', () => {
    it('adds item when not in array', () => {
      const { result } = renderToggle('testField');
      act(() => {
        result.current.toggleItem('Item1');
      });
      expect(currentData.testField).toEqual(['Item1']);
    });

    it('removes item when already in array', () => {
      currentData = { testField: ['Item1', 'Item2'] };
      const { result } = renderToggle('testField');
      act(() => {
        result.current.toggleItem('Item1');
      });
      expect(currentData.testField).toEqual(['Item2']);
    });

    it('toggles normally when preSelectedItems is undefined', () => {
      currentData = { testField: ['Item1'] };
      const { result } = renderToggle('testField', undefined);
      act(() => {
        result.current.toggleItem('Item1');
      });
      expect(currentData.testField).toEqual([]);
    });

    it('does not remove a pre-selected item', () => {
      currentData = { testField: ['PreItem'] };
      const { result } = renderToggle('testField', ['PreItem']);
      act(() => {
        result.current.toggleItem('PreItem');
      });
      expect(currentData.testField).toEqual(['PreItem']);
      expect(setErrors).not.toHaveBeenCalled();
    });

    it('toggles non-pre-selected items normally when a pre-selection list exists', () => {
      currentData = { testField: ['PreItem', 'OtherItem'] };
      const { result } = renderToggle('testField', ['PreItem']);
      act(() => {
        result.current.toggleItem('OtherItem');
      });
      expect(currentData.testField).toEqual(['PreItem']);
    });

    it('aborts without touching data or errors when opt is true', () => {
      currentData = { testField: ['Item1'] };
      const { result } = renderToggle('testField');
      act(() => {
        result.current.toggleItem('Item1', true);
      });
      expect(currentData.testField).toEqual(['Item1']);
      expect(setErrors).not.toHaveBeenCalled();
    });

    it('aborts without touching data or errors when opt.isPreSelected', () => {
      currentData = { testField: ['Item1'] };
      const { result } = renderToggle('testField');
      act(() => {
        result.current.toggleItem('Item1', { isPreSelected: true });
      });
      expect(currentData.testField).toEqual(['Item1']);
      expect(setErrors).not.toHaveBeenCalled();
    });

    it('toggles normally when opt.isPreSelected is false', () => {
      currentData = { testField: ['Item1'] };
      const { result } = renderToggle('testField');
      act(() => {
        result.current.toggleItem('Item1', { isPreSelected: false });
      });
      expect(currentData.testField).toEqual([]);
    });

    it('clears the field error', () => {
      const { result } = renderToggle('testField');
      act(() => {
        result.current.toggleItem('Item1');
      });
      expectErrorCleared('testField');
    });
  });

  describe('setItem', () => {
    it('adds item when not present', () => {
      const { result } = renderToggle('testField');
      act(() => {
        result.current.setItem('Item2');
      });
      expect(currentData.testField).toEqual(['Item2']);
    });

    it('does not duplicate item when already present', () => {
      currentData = { testField: ['Item1'] };
      const { result } = renderToggle('testField');
      act(() => {
        result.current.setItem('Item1');
      });
      expect(currentData.testField).toEqual(['Item1']);
    });

    it('clears the field error', () => {
      const { result } = renderToggle('testField');
      act(() => {
        result.current.setItem('Item2');
      });
      expectErrorCleared('testField');
    });
  });

  describe('removeItem', () => {
    it('removes item when present', () => {
      currentData = { testField: ['Item1', 'Item2'] };
      const { result } = renderToggle('testField');
      act(() => {
        result.current.removeItem('Item1');
      });
      expect(currentData.testField).toEqual(['Item2']);
    });

    it('leaves the array unchanged when item not present', () => {
      currentData = { testField: ['Item1'] };
      const { result } = renderToggle('testField');
      act(() => {
        result.current.removeItem('NonExistent');
      });
      expect(currentData.testField).toEqual(['Item1']);
    });

    it('clears the field error', () => {
      currentData = { testField: ['Item1'] };
      const { result } = renderToggle('testField');
      act(() => {
        result.current.removeItem('Item1');
      });
      expectErrorCleared('testField');
    });
  });

  describe('nested field paths', () => {
    it('handles dot-notation field paths', () => {
      currentData = { nested: { field: ['Item1'] } };
      const { result } = renderToggle('nested.field');
      act(() => {
        result.current.toggleItem('Item2');
      });
      expect(currentData.nested.field).toEqual(['Item1', 'Item2']);
    });

    it('creates nested path when it does not exist', () => {
      currentData = {};
      const { result } = renderToggle('new.nested.field');
      act(() => {
        result.current.setItem('Item1');
      });
      expect(currentData.new.nested.field).toEqual(['Item1']);
    });

    it('does not mutate the previous state objects on nested writes', () => {
      const original = { nested: { field: ['Item1'] } };
      currentData = original;
      const { result } = renderToggle('nested.field');
      act(() => {
        result.current.toggleItem('Item2');
      });
      expect(original).toEqual({ nested: { field: ['Item1'] } });
      expect(currentData).not.toBe(original);
      expect(currentData.nested).not.toBe(original.nested);
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
});
