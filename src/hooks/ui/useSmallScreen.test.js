// @maintained-by-ai
// Contract for the small-screen breakpoint hook (backlog 2026-11-23
// collapsible-sidebar). jsdom has no matchMedia, so the hook's documented
// fallback lane is live in tests: window.innerWidth + the `resize` listener.
// The breakpoint value is pinned to the CSS media-query prelude (App.css /
// Sidebar.css 768px blocks are pinned by App.css.test.jsx).
import { renderHook, act, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import useSmallScreen, { SMALL_SCREEN_MAX_PX } from './useSmallScreen.js';

function setViewportWidth(width) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
}

afterEach(() => {
  cleanup();
  // Restore jsdom's prototype getter (default 1024) for sibling suites.
  delete window.innerWidth;
});

describe('useSmallScreen', () => {
  it('pins the breakpoint to the CSS media-query seam (768px)', () => {
    // Keep in lockstep with the `@media (max-width: 768px)` preludes pinned
    // in App.css.test.jsx — a rename on one side must break this loudly.
    expect(SMALL_SCREEN_MAX_PX).toBe(768);
  });

  it('reads desktop (1024) as NOT small on mount', () => {
    const { result } = renderHook(() => useSmallScreen());
    expect(result.current).toBe(false);
  });

  it('reads a 420px viewport as small on mount', () => {
    setViewportWidth(420);
    const { result } = renderHook(() => useSmallScreen());
    expect(result.current).toBe(true);
  });

  it('includes the boundary width and excludes one pixel past it', () => {
    setViewportWidth(SMALL_SCREEN_MAX_PX);
    const at = renderHook(() => useSmallScreen());
    expect(at.result.current).toBe(true);
    cleanup();

    setViewportWidth(SMALL_SCREEN_MAX_PX + 1);
    const past = renderHook(() => useSmallScreen());
    expect(past.result.current).toBe(false);
  });

  it('re-evaluates live on a window resize (both directions)', () => {
    setViewportWidth(1280);
    const { result } = renderHook(() => useSmallScreen());
    expect(result.current).toBe(false);

    act(() => {
      setViewportWidth(420);
      window.dispatchEvent(new Event('resize'));
    });
    expect(result.current).toBe(true);

    act(() => {
      setViewportWidth(1280);
      window.dispatchEvent(new Event('resize'));
    });
    expect(result.current).toBe(false);
  });
});
