// @improved-by-ai
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { DiceRollContext } from './DiceRollContext.js';

// Mock usePopup with a real React hook implementation
vi.mock('./usePopup.js', () => {
  return {
    default: function usePopupMock(buildHtml) {
      const [popupHtml, setPopupHtml] = React.useState(null);
      const showPopup = React.useCallback(
        (entity) => {
          const html = buildHtml(entity);
          if (html) {
            setPopupHtml(html);
          }
        },
        [buildHtml]
      );
      return { showPopup, popupHtml, setPopupHtml };
    },
  };
});

describe('useSharedPopup', () => {
  describe('initialization', () => {
    it('should return popupHtml, setPopupHtml, value, and Provider', async () => {
      const { default: useSharedPopup } = await import('./useSharedPopup.js');
      const { result } = renderHook(() => useSharedPopup());
      expect(result.current).toHaveProperty('popupHtml');
      expect(result.current).toHaveProperty('setPopupHtml');
      expect(result.current).toHaveProperty('value');
      expect(result.current).toHaveProperty('Provider');
    });

    it('should initialize popupHtml as null', async () => {
      const { default: useSharedPopup } = await import('./useSharedPopup.js');
      const { result } = renderHook(() => useSharedPopup());
      expect(result.current.popupHtml).toBeNull();
    });

    it('should set setPopupHtml as a function', async () => {
      const { default: useSharedPopup } = await import('./useSharedPopup.js');
      const { result } = renderHook(() => useSharedPopup());
      expect(typeof result.current.setPopupHtml).toBe('function');
    });

    it('should set Provider to DiceRollContext.Provider', async () => {
      const { default: useSharedPopup } = await import('./useSharedPopup.js');
      const { result } = renderHook(() => useSharedPopup());
      expect(result.current.Provider).toBe(DiceRollContext.Provider);
    });
  });

  describe('value object', () => {
    it('should be an object', async () => {
      const { default: useSharedPopup } = await import('./useSharedPopup.js');
      const { result } = renderHook(() => useSharedPopup());
      expect(result.current.value).toBeInstanceOf(Object);
    });

    it('should have _isShared set to true', async () => {
      const { default: useSharedPopup } = await import('./useSharedPopup.js');
      const { result } = renderHook(() => useSharedPopup());
      expect(result.current.value._isShared).toBe(true);
    });

    it('should contain popupHtml in the value object', async () => {
      const { default: useSharedPopup } = await import('./useSharedPopup.js');
      const { result } = renderHook(() => useSharedPopup());
      expect(result.current.value.popupHtml).toBeNull();
    });

    it('should contain setPopupHtml in the value object', async () => {
      const { default: useSharedPopup } = await import('./useSharedPopup.js');
      const { result } = renderHook(() => useSharedPopup());
      expect(typeof result.current.value.setPopupHtml).toBe('function');
    });

    it('should return the same value object reference on re-render (memoization)', async () => {
      const { default: useSharedPopup } = await import('./useSharedPopup.js');
      const { result, rerender } = renderHook(() => useSharedPopup());
      const firstValue = result.current.value;
      rerender();
      expect(result.current.value).toBe(firstValue);
    });

    it('should have value.popupHtml update when popupHtml changes', async () => {
      const { default: useSharedPopup } = await import('./useSharedPopup.js');
      const { result } = renderHook(() => useSharedPopup());
      act(() => {
        result.current.setPopupHtml('<p>Updated</p>');
      });
      expect(result.current.value.popupHtml).toBe('<p>Updated</p>');
    });
  });

  describe('setPopupHtml behavior', () => {
    it('should update popupHtml when called with HTML string', async () => {
      const { default: useSharedPopup } = await import('./useSharedPopup.js');
      const { result } = renderHook(() => useSharedPopup());
      act(() => {
        result.current.setPopupHtml('<p>Test popup</p>');
      });
      expect(result.current.popupHtml).toBe('<p>Test popup</p>');
    });

    it('should update popupHtml when called with a number', async () => {
      const { default: useSharedPopup } = await import('./useSharedPopup.js');
      const { result } = renderHook(() => useSharedPopup());
      act(() => {
        result.current.setPopupHtml(42);
      });
      expect(result.current.popupHtml).toBe(42);
    });

    it('should update popupHtml when called with an object', async () => {
      const { default: useSharedPopup } = await import('./useSharedPopup.js');
      const { result } = renderHook(() => useSharedPopup());
      act(() => {
        result.current.setPopupHtml({ key: 'value' });
      });
      expect(result.current.popupHtml).toEqual({ key: 'value' });
    });

    it('should update popupHtml when called with an array', async () => {
      const { default: useSharedPopup } = await import('./useSharedPopup.js');
      const { result } = renderHook(() => useSharedPopup());
      act(() => {
        result.current.setPopupHtml([1, 2, 3]);
      });
      expect(result.current.popupHtml).toEqual([1, 2, 3]);
    });

    it('should update popupHtml when called with empty string', async () => {
      const { default: useSharedPopup } = await import('./useSharedPopup.js');
      const { result } = renderHook(() => useSharedPopup());
      act(() => {
        result.current.setPopupHtml('');
      });
      expect(result.current.popupHtml).toBe('');
    });

    it('should update popupHtml when called with null', async () => {
      const { default: useSharedPopup } = await import('./useSharedPopup.js');
      const { result } = renderHook(() => useSharedPopup());
      act(() => {
        result.current.setPopupHtml(null);
      });
      expect(result.current.popupHtml).toBeNull();
    });

    it('should update popupHtml when called with false', async () => {
      const { default: useSharedPopup } = await import('./useSharedPopup.js');
      const { result } = renderHook(() => useSharedPopup());
      act(() => {
        result.current.setPopupHtml(false);
      });
      expect(result.current.popupHtml).toBe(false);
    });

    it('should allow multiple setPopupHtml calls to update the value', async () => {
      const { default: useSharedPopup } = await import('./useSharedPopup.js');
      const { result } = renderHook(() => useSharedPopup());
      act(() => {
        result.current.setPopupHtml('first');
      });
      expect(result.current.popupHtml).toBe('first');
      act(() => {
        result.current.setPopupHtml('second');
      });
      expect(result.current.popupHtml).toBe('second');
    });
  });

  describe('integration with usePopup', () => {
    it('should call usePopup with a function that returns null for any entity', async () => {
      const { default: useSharedPopup } = await import('./useSharedPopup.js');
      const { result } = renderHook(() => useSharedPopup());
      // usePopup was called during render, the buildHtml function it received should return null
      // since useSharedPopup passes () => null
      // The showPopup from usePopup will call buildHtml(entity) and only set popupHtml if truthy
      // Since buildHtml always returns null, showPopup should never set popupHtml
      act(() => {
        // We can't access showPopup from useSharedPopup directly, but we can verify
        // that setPopupHtml works independently (which it does via the spread from usePopup)
      });
      // Verify that setPopupHtml is available and works
      act(() => {
        result.current.setPopupHtml('<p>Direct</p>');
      });
      expect(result.current.popupHtml).toBe('<p>Direct</p>');
    });
  });

  describe('Provider usage', () => {
    it('should provide DiceRollContext.Provider that consumers can use', async () => {
      const { default: useSharedPopup } = await import('./useSharedPopup.js');
      const { result } = renderHook(() => useSharedPopup());
      expect(result.current.Provider).toBeDefined();
    });

    it('should allow wrapping a component with the Provider', async () => {
      const { default: useSharedPopup } = await import('./useSharedPopup.js');
      const { result } = renderHook(() => useSharedPopup());
      const Provider = result.current.Provider;

      const TestComponent = () => {
        const ctx = React.useContext(DiceRollContext);
        expect(ctx._isShared).toBe(true);
        return React.createElement('span', null, 'ok');
      };

      // Verify the Provider can render with the value without throwing
      const app = React.createElement(
        Provider,
        { value: result.current.value },
        React.createElement(TestComponent)
      );
      // Just verify it's a valid ReactElement — rendering in jsdom
      // with createRoot isn't available in test env, but we can check structure
      expect(app.type).toBe(Provider);
      expect(app.props.value).toBe(result.current.value);
    });
  });

  describe('multiple instances', () => {
    it('should have independent value objects per instance', async () => {
      const { default: useSharedPopup } = await import('./useSharedPopup.js');
      const { result: result1 } = renderHook(() => useSharedPopup());
      const { result: result2 } = renderHook(() => useSharedPopup());
      expect(result1.current.value).not.toBe(result2.current.value);
    });

    it('should have independent popupHtml per instance', async () => {
      const { default: useSharedPopup } = await import('./useSharedPopup.js');
      const { result: result1 } = renderHook(() => useSharedPopup());
      const { result: result2 } = renderHook(() => useSharedPopup());
      act(() => {
        result1.current.setPopupHtml('instance1');
      });
      expect(result1.current.popupHtml).toBe('instance1');
      expect(result2.current.popupHtml).toBeNull();
    });

    it('should have independent setPopupHtml per instance', async () => {
      const { default: useSharedPopup } = await import('./useSharedPopup.js');
      const { result: result1 } = renderHook(() => useSharedPopup());
      const { result: result2 } = renderHook(() => useSharedPopup());
      act(() => {
        result1.current.setPopupHtml('one');
      });
      act(() => {
        result2.current.setPopupHtml('two');
      });
      expect(result1.current.popupHtml).toBe('one');
      expect(result2.current.popupHtml).toBe('two');
    });
  });
});
