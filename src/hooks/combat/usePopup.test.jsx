// @maintained-by-ai: 2026-10-14
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import usePopup from './usePopup.js';

// Authoritative seam for the popup contract cited by useDiceRoll,
// useSharedPopup, and char-sheet components that drive popups directly
// via setPopupHtml. Ephemeral UI state — no server sync (AGENTS.md).

describe('usePopup', () => {
  it('exposes showPopup, popupHtml (initially null) and setPopupHtml', () => {
    const { result } = renderHook(() => usePopup(() => ''));
    expect(result.current).toHaveProperty('showPopup');
    expect(result.current).toHaveProperty('popupHtml');
    expect(result.current).toHaveProperty('setPopupHtml');
    expect(result.current.popupHtml).toBeNull();
  });

  it('showPopup passes the entity to buildHtml and updates popupHtml on truthy results', () => {
    const buildHtml = vi.fn((e) => `<p>${e.name}</p>`);
    const { result } = renderHook(() => usePopup(buildHtml));

    act(() => result.current.showPopup({ name: 'A' }));
    expect(buildHtml).toHaveBeenCalledWith({ name: 'A' });
    expect(result.current.popupHtml).toBe('<p>A</p>');

    act(() => result.current.showPopup({ name: 'B' }));
    expect(result.current.popupHtml).toBe('<p>B</p>');
  });

  it('showPopup leaves popupHtml unchanged when buildHtml returns falsy', () => {
    const { result } = renderHook(() => usePopup((e) => e?.html || null));

    act(() => result.current.showPopup({ html: '<p>keep</p>' }));
    act(() => result.current.showPopup(null));
    expect(result.current.popupHtml).toBe('<p>keep</p>');
  });

  it('setPopupHtml drives popupHtml directly, including null (useDiceRoll contract)', () => {
    const { result } = renderHook(() => usePopup(() => null));

    act(() => result.current.setPopupHtml('<p>custom</p>'));
    expect(result.current.popupHtml).toBe('<p>custom</p>');

    act(() => result.current.setPopupHtml(null));
    expect(result.current.popupHtml).toBeNull();
  });
});
