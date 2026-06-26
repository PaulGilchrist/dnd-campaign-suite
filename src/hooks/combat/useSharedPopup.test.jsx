// @improved-by-ai
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import React from 'react';
import useSharedPopup from './useSharedPopup.js';
import { DiceRollContext } from './DiceRollContext.js';

describe('useSharedPopup', () => {
  describe('returns expected shape', () => {
    it('should return popupHtml, setPopupHtml, value, and Provider', () => {
      const { result } = renderHook(() => useSharedPopup());

      expect(result.current).toHaveProperty('popupHtml', null);
      expect(result.current.setPopupHtml).toBeInstanceOf(Function);
      expect(result.current.value).toBeInstanceOf(Object);
      expect(result.current).toHaveProperty('Provider');
    });

    it('should initialize popupHtml as null', () => {
      const { result } = renderHook(() => useSharedPopup());
      expect(result.current.popupHtml).toBeNull();
    });

    it('should return DiceRollContext.Provider as Provider', () => {
      const { result } = renderHook(() => useSharedPopup());
      expect(result.current.Provider).toBe(DiceRollContext.Provider);
    });
  });

  describe('value object', () => {
    it('should contain popupHtml, setPopupHtml, and _isShared flag', () => {
      const { result } = renderHook(() => useSharedPopup());

      expect(result.current.value).toEqual(
        expect.objectContaining({
          popupHtml: null,
          setPopupHtml: expect.any(Function),
          _isShared: true,
        }),
      );
    });

    it('should reflect updated popupHtml in the value object after state change', () => {
      const { result } = renderHook(() => useSharedPopup());
      const html = '<p>test</p>';

      act(() => {
        result.current.setPopupHtml(html);
      });

      expect(result.current.value.popupHtml).toBe(html);
    });

    it('should return a new value object reference when popupHtml changes', () => {
      const { result } = renderHook(() => useSharedPopup());
      const initialValue = result.current.value;

      act(() => {
        result.current.setPopupHtml('<p>changed</p>');
      });

      expect(result.current.value).not.toBe(initialValue);
    });

    it('should keep the same setPopupHtml function reference across updates', () => {
      const { result } = renderHook(() => useSharedPopup());
      const initialFn = result.current.value.setPopupHtml;

      act(() => {
        result.current.setPopupHtml('<p>changed</p>');
      });

      expect(result.current.value.setPopupHtml).toBe(initialFn);
    });
  });

  describe('popupHtml state updates', () => {
    it('should update to any HTML string value', () => {
      const { result } = renderHook(() => useSharedPopup());
      const html = '<div class="popup"><p>Test</p><span>Content</span></div>';

      act(() => {
        result.current.setPopupHtml(html);
      });

      expect(result.current.popupHtml).toBe(html);
    });

    it('should update to null to clear the popup', () => {
      const { result } = renderHook(() => useSharedPopup());

      act(() => {
        result.current.setPopupHtml('<div>test</div>');
      });
      expect(result.current.popupHtml).toBe('<div>test</div>');

      act(() => {
        result.current.setPopupHtml(null);
      });
      expect(result.current.popupHtml).toBeNull();
    });

    it('should update to an empty string', () => {
      const { result } = renderHook(() => useSharedPopup());

      act(() => {
        result.current.setPopupHtml('');
      });

      expect(result.current.popupHtml).toBe('');
    });

    it('should keep popupHtml and value.popupHtml in sync', () => {
      const { result } = renderHook(() => useSharedPopup());
      const html = '<p>synced</p>';

      act(() => {
        result.current.setPopupHtml(html);
      });

      expect(result.current.popupHtml).toBe(result.current.value.popupHtml);
    });
  });

  describe('context provider integration', () => {
    it('should provide correct context to a consumer wrapped in Provider', () => {
      const { result } = renderHook(() => useSharedPopup());
      const Provider = result.current.Provider;

      let capturedContext = null;
      const CaptureContext = () => {
        capturedContext = React.useContext(DiceRollContext);
        return null;
      };

      renderHook(() => CaptureContext(), {
        wrapper: ({ children }) => (
          <Provider value={result.current.value}>{children}</Provider>
        ),
      });

      expect(capturedContext._isShared).toBe(true);
      expect(capturedContext.popupHtml).toBeNull();
      expect(typeof capturedContext.setPopupHtml).toBe('function');
    });

    it('should propagate updated popupHtml to context consumers', () => {
      const { result } = renderHook(() => useSharedPopup());
      const Provider = result.current.Provider;

      let capturedContext = null;
      const CaptureContext = () => {
        capturedContext = React.useContext(DiceRollContext);
        return null;
      };

      const { rerender } = renderHook(() => CaptureContext(), {
        wrapper: ({ children }) => (
          <Provider value={result.current.value}>{children}</Provider>
        ),
      });

      act(() => {
        result.current.setPopupHtml('<p>updated</p>');
      });
      rerender();

      expect(capturedContext.popupHtml).toBe('<p>updated</p>');
    });

    it('should allow multiple consumers to read the same context', () => {
      const { result } = renderHook(() => useSharedPopup());
      const Provider = result.current.Provider;

      let ctx1 = null;
      let ctx2 = null;

      const CaptureMultiple = () => {
        ctx1 = React.useContext(DiceRollContext);
        ctx2 = React.useContext(DiceRollContext);
        return null;
      };

      renderHook(() => CaptureMultiple(), {
        wrapper: ({ children }) => (
          <Provider value={result.current.value}>{children}</Provider>
        ),
      });

      expect(ctx1).toBe(ctx2);
      expect(ctx1._isShared).toBe(true);
    });
  });

  describe('independent instances', () => {
    it('should maintain independent popupHtml states across callers', () => {
      const { result: result1 } = renderHook(() => useSharedPopup());
      const { result: result2 } = renderHook(() => useSharedPopup());

      expect(result1.current.popupHtml).toBeNull();
      expect(result2.current.popupHtml).toBeNull();

      act(() => {
        result1.current.setPopupHtml('<p>first</p>');
      });

      expect(result1.current.popupHtml).toBe('<p>first</p>');
      expect(result2.current.popupHtml).toBeNull();
    });

    it('should return distinct value objects for each caller', () => {
      const { result: result1 } = renderHook(() => useSharedPopup());
      const { result: result2 } = renderHook(() => useSharedPopup());

      expect(result1.current.value).not.toBe(result2.current.value);
    });
  });
});
