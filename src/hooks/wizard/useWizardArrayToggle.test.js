import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useWizardArrayToggle from './useWizardArrayToggle.js';

describe('useWizardArrayToggle', () => {
  let mockSetFormData;
  let mockSetErrors;

  beforeEach(() => {
    mockSetFormData = vi.fn((fn) => {
      // Simulate React's functional update: call fn with a default prev value
      fn({ skills: [], nested: { items: [] } });
    });
    mockSetErrors = vi.fn();
  });

  describe('toggleItem', () => {
    it('adds an item when it is not in the array', () => {
      const { result } = renderHook(() =>
        useWizardArrayToggle(mockSetFormData, mockSetErrors, 'skills', [])
      );

      // We need to capture what setFormData receives and execute it
      let capturedFn;
      mockSetFormData.mockImplementationOnce((fn) => {
        capturedFn = fn;
      });

      act(() => {
        result.current.toggleItem('Athletics');
      });

      expect(mockSetFormData).toHaveBeenCalled();
      // Execute the captured function with a prev state
      const prev = { skills: [] };
      const newState = capturedFn(prev);
      expect(newState.skills).toEqual(['Athletics']);
    });

    it('removes an item when it is already in the array', () => {
      const { result } = renderHook(() =>
        useWizardArrayToggle(mockSetFormData, mockSetErrors, 'skills', [])
      );

      let capturedFn;
      mockSetFormData.mockImplementationOnce((fn) => {
        capturedFn = fn;
      });

      act(() => {
        result.current.toggleItem('Athletics');
      });

      const prev = { skills: ['Athletics'] };
      const newState = capturedFn(prev);
      expect(newState.skills).toEqual([]);
    });

    it('does not toggle when opt is true (boolean)', () => {
      const { result } = renderHook(() =>
        useWizardArrayToggle(mockSetFormData, mockSetErrors, 'skills', [])
      );

      let capturedFn;
      mockSetFormData.mockImplementationOnce((fn) => {
        capturedFn = fn;
      });

      act(() => {
        result.current.toggleItem('Athletics', true);
      });

      const prev = { skills: [] };
      const newState = capturedFn(prev);
      // When opt is true, it returns prev unchanged
      expect(newState).toBe(prev);
    });

    it('does not toggle when opt is an object with isPreSelected', () => {
      const { result } = renderHook(() =>
        useWizardArrayToggle(mockSetFormData, mockSetErrors, 'skills', [])
      );

      let capturedFn;
      mockSetFormData.mockImplementationOnce((fn) => {
        capturedFn = fn;
      });

      act(() => {
        result.current.toggleItem('Athletics', { isPreSelected: true });
      });

      const prev = { skills: [] };
      const newState = capturedFn(prev);
      // When opt is object with isPreSelected, it returns prev unchanged
      expect(newState).toBe(prev);
    });

    it('does not remove a pre-selected item', () => {
      const { result } = renderHook(() =>
        useWizardArrayToggle(mockSetFormData, mockSetErrors, 'skills', ['Athletics'])
      );

      let capturedFn;
      mockSetFormData.mockImplementationOnce((fn) => {
        capturedFn = fn;
      });

      act(() => {
        result.current.toggleItem('Athletics');
      });

      const prev = { skills: ['Athletics'] };
      const newState = capturedFn(prev);
      // Pre-selected items cannot be removed
      expect(newState).toBe(prev);
    });

    it('can add a non-pre-selected item even when preSelectedItems exist', () => {
      const { result } = renderHook(() =>
        useWizardArrayToggle(mockSetFormData, mockSetErrors, 'skills', ['Athletics'])
      );

      let capturedFn;
      mockSetFormData.mockImplementationOnce((fn) => {
        capturedFn = fn;
      });

      act(() => {
        result.current.toggleItem('Stealth');
      });

      const prev = { skills: ['Athletics'] };
      const newState = capturedFn(prev);
      expect(newState.skills).toEqual(['Athletics', 'Stealth']);
    });

    it('works with nested field paths', () => {
      const { result } = renderHook(() =>
        useWizardArrayToggle(mockSetFormData, mockSetErrors, 'nested.items', [])
      );

      let capturedFn;
      mockSetFormData.mockImplementationOnce((fn) => {
        capturedFn = fn;
      });

      act(() => {
        result.current.toggleItem('Sword');
      });

      const prev = { nested: { items: [] } };
      const newState = capturedFn(prev);
      expect(newState.nested.items).toEqual(['Sword']);
    });

    it('handles empty current array (undefined field)', () => {
      const { result } = renderHook(() =>
        useWizardArrayToggle(mockSetFormData, mockSetErrors, 'skills', [])
      );

      let capturedFn;
      mockSetFormData.mockImplementationOnce((fn) => {
        capturedFn = fn;
      });

      act(() => {
        result.current.toggleItem('Athletics');
      });

      const prev = {};
      const newState = capturedFn(prev);
      expect(newState.skills).toEqual(['Athletics']);
    });

    it('clears the error for the field when toggling', () => {
      const { result } = renderHook(() =>
        useWizardArrayToggle(mockSetFormData, mockSetErrors, 'skills', [])
      );

      act(() => {
        result.current.toggleItem('Athletics');
      });

      expect(mockSetErrors).toHaveBeenCalledWith(expect.any(Function));
      // Execute the function passed to setErrors
      const errorFn = mockSetErrors.mock.calls[0][0];
      const prevErrors = { skills: 'Some error', other: 'Keep this' };
      const newErrors = errorFn(prevErrors);
      expect(newErrors.skills).toBeNull();
      expect(newErrors.other).toBe('Keep this');
    });
  });

  describe('setItem', () => {
    it('adds an item if not already present', () => {
      const { result } = renderHook(() =>
        useWizardArrayToggle(mockSetFormData, mockSetErrors, 'skills', [])
      );

      let capturedFn;
      mockSetFormData.mockImplementationOnce((fn) => {
        capturedFn = fn;
      });

      act(() => {
        result.current.setItem('Athletics');
      });

      const prev = { skills: [] };
      const newState = capturedFn(prev);
      expect(newState.skills).toEqual(['Athletics']);
    });

    it('does not duplicate an item if already present', () => {
      const { result } = renderHook(() =>
        useWizardArrayToggle(mockSetFormData, mockSetErrors, 'skills', [])
      );

      let capturedFn;
      mockSetFormData.mockImplementationOnce((fn) => {
        capturedFn = fn;
      });

      act(() => {
        result.current.setItem('Athletics');
      });

      const prev = { skills: ['Athletics'] };
      const newState = capturedFn(prev);
      expect(newState.skills).toEqual(['Athletics']);
    });

    it('works with nested field paths', () => {
      const { result } = renderHook(() =>
        useWizardArrayToggle(mockSetFormData, mockSetErrors, 'nested.items', [])
      );

      let capturedFn;
      mockSetFormData.mockImplementationOnce((fn) => {
        capturedFn = fn;
      });

      act(() => {
        result.current.setItem('Shield');
      });

      const prev = { nested: { items: ['Sword'] } };
      const newState = capturedFn(prev);
      expect(newState.nested.items).toEqual(['Sword', 'Shield']);
    });

    it('clears the error for the field when setting', () => {
      const { result } = renderHook(() =>
        useWizardArrayToggle(mockSetFormData, mockSetErrors, 'skills', [])
      );

      act(() => {
        result.current.setItem('Athletics');
      });

      expect(mockSetErrors).toHaveBeenCalledWith(expect.any(Function));
      const errorFn = mockSetErrors.mock.calls[0][0];
      const prevErrors = { skills: 'Required' };
      const newErrors = errorFn(prevErrors);
      expect(newErrors.skills).toBeNull();
    });
  });

  describe('removeItem', () => {
    it('removes an item from the array', () => {
      const { result } = renderHook(() =>
        useWizardArrayToggle(mockSetFormData, mockSetErrors, 'skills', [])
      );

      let capturedFn;
      mockSetFormData.mockImplementationOnce((fn) => {
        capturedFn = fn;
      });

      act(() => {
        result.current.removeItem('Athletics');
      });

      const prev = { skills: ['Athletics', 'Stealth'] };
      const newState = capturedFn(prev);
      expect(newState.skills).toEqual(['Stealth']);
    });

    it('does nothing when item is not in the array', () => {
      const { result } = renderHook(() =>
        useWizardArrayToggle(mockSetFormData, mockSetErrors, 'skills', [])
      );

      let capturedFn;
      mockSetFormData.mockImplementationOnce((fn) => {
        capturedFn = fn;
      });

      act(() => {
        result.current.removeItem('Athletics');
      });

      const prev = { skills: ['Stealth'] };
      const newState = capturedFn(prev);
      expect(newState.skills).toEqual(['Stealth']);
    });

    it('works with nested field paths', () => {
      const { result } = renderHook(() =>
        useWizardArrayToggle(mockSetFormData, mockSetErrors, 'nested.items', [])
      );

      let capturedFn;
      mockSetFormData.mockImplementationOnce((fn) => {
        capturedFn = fn;
      });

      act(() => {
        result.current.removeItem('Sword');
      });

      const prev = { nested: { items: ['Sword', 'Shield'] } };
      const newState = capturedFn(prev);
      expect(newState.nested.items).toEqual(['Shield']);
    });

    it('handles empty current array (undefined field)', () => {
      const { result } = renderHook(() =>
        useWizardArrayToggle(mockSetFormData, mockSetErrors, 'skills', [])
      );

      let capturedFn;
      mockSetFormData.mockImplementationOnce((fn) => {
        capturedFn = fn;
      });

      act(() => {
        result.current.removeItem('Athletics');
      });

      const prev = {};
      const newState = capturedFn(prev);
      expect(newState.skills).toEqual([]);
    });

    it('clears the error for the field when removing', () => {
      const { result } = renderHook(() =>
        useWizardArrayToggle(mockSetFormData, mockSetErrors, 'skills', [])
      );

      act(() => {
        result.current.removeItem('Athletics');
      });

      expect(mockSetErrors).toHaveBeenCalledWith(expect.any(Function));
      const errorFn = mockSetErrors.mock.calls[0][0];
      const prevErrors = { skills: 'Too many skills' };
      const newErrors = errorFn(prevErrors);
      expect(newErrors.skills).toBeNull();
    });
  });

  describe('return value', () => {
    it('returns all expected functions', () => {
      const { result } = renderHook(() =>
        useWizardArrayToggle(mockSetFormData, mockSetErrors, 'skills', [])
      );

      expect(result.current).toHaveProperty('toggleItem');
      expect(result.current).toHaveProperty('setItem');
      expect(result.current).toHaveProperty('removeItem');
      expect(typeof result.current.toggleItem).toBe('function');
      expect(typeof result.current.setItem).toBe('function');
      expect(typeof result.current.removeItem).toBe('function');
    });
  });

  describe('immutability', () => {
    it('does not mutate the original form data object on toggle', () => {
      const { result } = renderHook(() =>
        useWizardArrayToggle(mockSetFormData, mockSetErrors, 'skills', [])
      );

      let capturedFn;
      mockSetFormData.mockImplementationOnce((fn) => {
        capturedFn = fn;
      });

      act(() => {
        result.current.toggleItem('Athletics');
      });

      const prev = { skills: ['Stealth'] };
      const newState = capturedFn(prev);
      // Original should not be mutated
      expect(prev.skills).toEqual(['Stealth']);
      // New state should be a different object
      expect(newState).not.toBe(prev);
      expect(newState.skills).not.toBe(prev.skills);
    });

    it('does not mutate nested objects on toggle', () => {
      const { result } = renderHook(() =>
        useWizardArrayToggle(mockSetFormData, mockSetErrors, 'nested.items', [])
      );

      let capturedFn;
      mockSetFormData.mockImplementationOnce((fn) => {
        capturedFn = fn;
      });

      act(() => {
        result.current.toggleItem('Sword');
      });

      const prev = { nested: { items: [], other: 'keep' } };
      const newState = capturedFn(prev);
      expect(prev.nested.items).toEqual([]);
      expect(newState.nested).not.toBe(prev.nested);
      expect(newState.nested.other).toBe('keep');
    });
  });
});
