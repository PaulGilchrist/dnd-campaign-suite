// @cleaned-by-ai
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
  it('returns popupHtml, setPopupHtml, value, and Provider', async () => {
    const { default: useSharedPopup } = await import('./useSharedPopup.js');
    const { result } = renderHook(() => useSharedPopup());
    expect(result.current).toHaveProperty('popupHtml');
    expect(result.current).toHaveProperty('setPopupHtml');
    expect(result.current).toHaveProperty('value');
    expect(result.current).toHaveProperty('Provider');
  });

  it('initializes popupHtml as null', async () => {
    const { default: useSharedPopup } = await import('./useSharedPopup.js');
    const { result } = renderHook(() => useSharedPopup());
    expect(result.current.popupHtml).toBeNull();
  });

  it('sets Provider to DiceRollContext.Provider', async () => {
    const { default: useSharedPopup } = await import('./useSharedPopup.js');
    const { result } = renderHook(() => useSharedPopup());
    expect(result.current.Provider).toBe(DiceRollContext.Provider);
  });

  it('value object has _isShared set to true', async () => {
    const { default: useSharedPopup } = await import('./useSharedPopup.js');
    const { result } = renderHook(() => useSharedPopup());
    expect(result.current.value._isShared).toBe(true);
  });

  it('value.popupHtml updates when setPopupHtml is called', async () => {
    const { default: useSharedPopup } = await import('./useSharedPopup.js');
    const { result } = renderHook(() => useSharedPopup());
    act(() => {
      result.current.setPopupHtml('<p>Updated</p>');
    });
    expect(result.current.value.popupHtml).toBe('<p>Updated</p>');
  });

  it('returns the same value object reference on re-render (memoization)', async () => {
    const { default: useSharedPopup } = await import('./useSharedPopup.js');
    const { result, rerender } = renderHook(() => useSharedPopup());
    const firstValue = result.current.value;
    rerender();
    expect(result.current.value).toBe(firstValue);
  });

  it('allows wrapping a component with the Provider', async () => {
    const { default: useSharedPopup } = await import('./useSharedPopup.js');
    const { result } = renderHook(() => useSharedPopup());
    const Provider = result.current.Provider;

    const TestComponent = () => {
      const ctx = React.useContext(DiceRollContext);
      expect(ctx._isShared).toBe(true);
      return React.createElement('span', null, 'ok');
    };

    const app = React.createElement(
      Provider,
      { value: result.current.value },
      React.createElement(TestComponent)
    );
    expect(app.type).toBe(Provider);
    expect(app.props.value).toBe(result.current.value);
  });

  it('has independent value objects per instance', async () => {
    const { default: useSharedPopup } = await import('./useSharedPopup.js');
    const { result: result1 } = renderHook(() => useSharedPopup());
    const { result: result2 } = renderHook(() => useSharedPopup());
    expect(result1.current.value).not.toBe(result2.current.value);
  });

  it('has independent popupHtml per instance', async () => {
    const { default: useSharedPopup } = await import('./useSharedPopup.js');
    const { result: result1 } = renderHook(() => useSharedPopup());
    const { result: result2 } = renderHook(() => useSharedPopup());
    act(() => {
      result1.current.setPopupHtml('instance1');
    });
    expect(result1.current.popupHtml).toBe('instance1');
    expect(result2.current.popupHtml).toBeNull();
  });
});
