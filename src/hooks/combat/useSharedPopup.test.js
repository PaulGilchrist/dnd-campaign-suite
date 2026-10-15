// @maintained-by-ai: 2026-10-14
import React from 'react';
import { render, renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import useSharedPopup from './useSharedPopup.js';
import { DiceRollContext, useDiceRollPopup } from './DiceRollContext.js';

// Seam unique to useSharedPopup: it adapts usePopup's state into a memoized
// DiceRollContext value flagged _isShared (consumers like useLoggedDiceRoll
// route writes through it). The underlying usePopup contract (showPopup /
// buildHtml / setPopupHtml) is authoritative in usePopup.test.jsx, so the
// real hook is used here — no mock to drift.

describe('useSharedPopup', () => {
  it('exposes popupHtml (initially null), setPopupHtml, _isShared value, and DiceRollContext.Provider', () => {
    const { result } = renderHook(() => useSharedPopup());
    expect(result.current.popupHtml).toBeNull();
    expect(typeof result.current.setPopupHtml).toBe('function');
    expect(result.current.Provider).toBe(DiceRollContext.Provider);
    expect(result.current.value._isShared).toBe(true);
  });

  it('memoizes value: stable across re-renders, refreshed when popupHtml changes', () => {
    const { result, rerender } = renderHook(() => useSharedPopup());
    const first = result.current.value;

    rerender();
    expect(result.current.value).toBe(first);

    act(() => result.current.setPopupHtml('<p>Updated</p>'));
    expect(result.current.value.popupHtml).toBe('<p>Updated</p>');
    expect(result.current.value).not.toBe(first);
  });

  it('delivers the shared value to consumers through the Provider', () => {
    const { result } = renderHook(() => useSharedPopup());
    const Provider = result.current.Provider;
    let seen = null;
    const Consumer = () => {
      seen = useDiceRollPopup();
      return null;
    };

    const { rerender } = render(
      React.createElement(Provider, { value: result.current.value },
        React.createElement(Consumer))
    );
    expect(seen._isShared).toBe(true);
    expect(seen.popupHtml).toBeNull();

    act(() => result.current.setPopupHtml('<p>shared</p>'));
    rerender(
      React.createElement(Provider, { value: result.current.value },
        React.createElement(Consumer))
    );
    expect(seen.popupHtml).toBe('<p>shared</p>');
  });

  it('keeps state independent per hook instance', () => {
    const { result: a } = renderHook(() => useSharedPopup());
    const { result: b } = renderHook(() => useSharedPopup());

    act(() => a.current.setPopupHtml('instance-a'));
    expect(a.current.popupHtml).toBe('instance-a');
    expect(a.current.value.popupHtml).toBe('instance-a');
    expect(b.current.popupHtml).toBeNull();
    expect(b.current.value.popupHtml).toBeNull();
  });
});
