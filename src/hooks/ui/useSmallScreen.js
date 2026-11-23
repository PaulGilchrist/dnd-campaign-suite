// @maintained-by-ai
// Small-viewport breakpoint listener for the collapsible sidebar (backlog
// 2026-11-23 collapsible-sidebar). Below SMALL_SCREEN_MAX_PX the sidebar
// docks off-canvas behind a toggle (see Sidebar.jsx + the 768px media block
// in Sidebar.css); at desktop widths it stays an always-visible fixed column.
// This is PURELY per-client display state — a viewport measurement, never the
// runtime store, never an /api write (two tabs collapse independently).
// The breakpoint MUST stay in lockstep with the CSS media query: App.css.test
// pins the `@media (max-width: 768px)` preludes, and useSmallScreen.test.js
// pins this constant to the same number.
import { useEffect, useState } from 'react';

export const SMALL_SCREEN_MAX_PX = 768;

const MEDIA_QUERY = `(max-width: ${SMALL_SCREEN_MAX_PX}px)`;

// matchMedia keeps JS and CSS judging the breakpoint identically (fractional
// zoom widths included). jsdom has none, so fall back to innerWidth there —
// the resize listener below is the test seam (drive innerWidth + dispatch
// `resize`).
function readSmallScreen() {
  if (typeof window.matchMedia === 'function') {
    return window.matchMedia(MEDIA_QUERY).matches;
  }
  return window.innerWidth <= SMALL_SCREEN_MAX_PX;
}

export function useSmallScreen() {
  const [isSmallScreen, setIsSmallScreen] = useState(readSmallScreen);

  useEffect(() => {
    const update = () => setIsSmallScreen(readSmallScreen());
    update();
    const mql = typeof window.matchMedia === 'function'
      ? window.matchMedia(MEDIA_QUERY)
      : null;
    mql?.addEventListener('change', update);
    window.addEventListener('resize', update);
    return () => {
      mql?.removeEventListener('change', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return isSmallScreen;
}

export default useSmallScreen;
