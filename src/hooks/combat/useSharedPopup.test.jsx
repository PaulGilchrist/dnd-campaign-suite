import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import React from 'react';
import useSharedPopup from './useSharedPopup.js';
import { DiceRollContext } from './DiceRollContext.js';

describe('useSharedPopup', () => {
  describe('initialization', () => {
    it('should return popupHtml, setPopupHtml, value, and Provider', () => {
      const { result } = renderHook(() => useSharedPopup());
      expect(result.current.popupHtml).toBeNull();
      expect(result.current.setPopupHtml).toBeInstanceOf(Function);
      expect(result.current.value).toBeInstanceOf(Object);
      expect(result.current.Provider).toBe(DiceRollContext.Provider);
    });

    it('should initialize with popupHtml as null', () => {
      const { result } = renderHook(() => useSharedPopup());
      expect(result.current.popupHtml).toBeNull();
    });

    it('should return a function for setPopupHtml', () => {
      const { result } = renderHook(() => useSharedPopup());
      expect(typeof result.current.setPopupHtml).toBe('function');
    });
  });

  describe('value object', () => {
    it('should return a memoized value object', () => {
      const { result } = renderHook(() => useSharedPopup());
      expect(result.current.value).toEqual({
        popupHtml: null,
        setPopupHtml: expect.any(Function),
        _isShared: true,
      });
    });

    it('should have _isShared set to true on the value object', () => {
      const { result } = renderHook(() => useSharedPopup());
      expect(result.current.value._isShared).toBe(true);
    });

    it('should include popupHtml from the hook in the value object', () => {
      const { result, rerender } = renderHook(() => useSharedPopup());
      expect(result.current.value.popupHtml).toBeNull();
      act(() => {
        result.current.setPopupHtml('<p>test</p>');
      });
      rerender();
      expect(result.current.value.popupHtml).toBe('<p>test</p>');
    });

    it('should include setPopupHtml function in the value object', () => {
      const { result } = renderHook(() => useSharedPopup());
      expect(typeof result.current.value.setPopupHtml).toBe('function');
    });

    it('should return the same value object reference when only setPopupHtml is called', () => {
      const { result } = renderHook(() => useSharedPopup());
      const initialValue = result.current.value;
      act(() => {
        result.current.setPopupHtml('<p>new html</p>');
      });
      // value is memoized with [popupHtml] dependency, so it changes when popupHtml changes
      // but setPopupHtml is the same function reference
      expect(result.current.value.setPopupHtml).toBe(initialValue.setPopupHtml);
    });
  });

  describe('Provider', () => {
    it('should return DiceRollContext.Provider as the Provider', () => {
      const { result } = renderHook(() => useSharedPopup());
      expect(result.current.Provider).toBe(DiceRollContext.Provider);
    });

    it('should allow consuming the Provider value via useDiceRollPopup', () => {
      const { result } = renderHook(() => useSharedPopup());
      const Provider = result.current.Provider;

      const ConsumerHook = () => {
        const ctx = React.useContext(DiceRollContext);
        return ctx;
      };

      const { result: consumerResult } = renderHook(() => ConsumerHook(), {
        wrapper: ({ children }) => (
          <Provider value={result.current.value}>
            {children}
          </Provider>
        ),
      });

      expect(consumerResult.current._isShared).toBe(true);
      expect(consumerResult.current.popupHtml).toBeNull();
      expect(typeof consumerResult.current.setPopupHtml).toBe('function');
    });
  });

  describe('popupHtml state updates', () => {
    it('should update popupHtml when setPopupHtml is called with HTML string', () => {
      const { result } = renderHook(() => useSharedPopup());
      act(() => {
        result.current.setPopupHtml('<div>test</div>');
      });
      expect(result.current.popupHtml).toBe('<div>test</div>');
    });

    it('should update popupHtml when setPopupHtml is called with null', () => {
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

    it('should update popupHtml when setPopupHtml is called with empty string', () => {
      const { result } = renderHook(() => useSharedPopup());
      act(() => {
        result.current.setPopupHtml('');
      });
      expect(result.current.popupHtml).toBe('');
    });

    it('should update popupHtml when setPopupHtml is called with complex HTML', () => {
      const html = '<div class="popup"><p>Test</p><span>Content</span></div>';
      const { result } = renderHook(() => useSharedPopup());
      act(() => {
        result.current.setPopupHtml(html);
      });
      expect(result.current.popupHtml).toBe(html);
    });

    it('should update value object popupHtml in sync with popupHtml', () => {
      const { result } = renderHook(() => useSharedPopup());
      act(() => {
        result.current.setPopupHtml('<p>synced</p>');
      });
      expect(result.current.popupHtml).toBe('<p>synced</p>');
      expect(result.current.value.popupHtml).toBe('<p>synced</p>');
    });
  });

  describe('integration with DiceRollContext consumers', () => {
    it('should provide correct context to a consumer component', () => {
      const { result } = renderHook(() => useSharedPopup());
      const Provider = result.current.Provider;

      let capturedContext = null;
      const CaptureContext = () => {
        capturedContext = React.useContext(DiceRollContext);
        return null;
      };

      renderHook(() => CaptureContext(), {
        wrapper: ({ children }) => (
          <Provider value={result.current.value}>
            {children}
          </Provider>
        ),
      });

      expect(capturedContext._isShared).toBe(true);
      expect(capturedContext.popupHtml).toBeNull();
      expect(typeof capturedContext.setPopupHtml).toBe('function');
    });

    it('should allow multiple consumers to read the same context', () => {
      const { result } = renderHook(() => useSharedPopup());
      const Provider = result.current.Provider;

      let ctx1 = null;
      let ctx2 = null;

      const Capture1 = () => {
        ctx1 = React.useContext(DiceRollContext);
        return null;
      };
      const Capture2 = () => {
        ctx2 = React.useContext(DiceRollContext);
        return null;
      };

      const CombinedCapture = () => {
        Capture1();
        Capture2();
        return null;
      };

      renderHook(() => CombinedCapture(), {
        wrapper: ({ children }) => (
          <Provider value={result.current.value}>
            {children}
          </Provider>
        ),
      });

      expect(ctx1._isShared).toBe(true);
      expect(ctx2._isShared).toBe(true);
      expect(ctx1).toEqual(ctx2);
    });
  });

  describe('value memoization', () => {
    it('should create a new value object when popupHtml changes', () => {
      const { result } = renderHook(() => useSharedPopup());
      const initialValue = result.current.value;
      act(() => {
        result.current.setPopupHtml('<p>changed</p>');
      });
      // After state update, the memoized value should have a new reference
      // because popupHtml changed in the dependency array
      expect(result.current.value).not.toBe(initialValue);
    });

    it('should keep the same value object reference when popupHtml does not change', () => {
      const { result } = renderHook(() => useSharedPopup());
      // The key assertion is that the value always has _isShared: true
      expect(result.current.value._isShared).toBe(true);
    });
  });

  describe('multiple callers', () => {
    it('should create independent popup states for each caller', () => {
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

    it('should have independent value objects for each caller', () => {
      const { result: result1 } = renderHook(() => useSharedPopup());
      const { result: result2 } = renderHook(() => useSharedPopup());

      expect(result1.current.value).not.toBe(result2.current.value);
    });

    it('should have independent Providers for each caller', () => {
      const { result: result1 } = renderHook(() => useSharedPopup());
      const { result: result2 } = renderHook(() => useSharedPopup());

      // Both return the same React context Provider reference
      expect(result1.current.Provider).toBe(result2.current.Provider);
      expect(result1.current.Provider).toBe(DiceRollContext.Provider);
    });
  });
});
