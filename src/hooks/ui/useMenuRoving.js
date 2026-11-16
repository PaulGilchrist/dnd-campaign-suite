import { useEffect, useRef } from 'react';

// Roving-arrow navigation + open-focus + close-focus-restore for the shared
// SVG role=menu context menus (backlog 2026-11-16 XC, extracted verbatim from
// ItemContextMenu.jsx so the hex POIContextMenu adopts the same tier — bug-
// hex-poi-menu-no-keyboard-rove-or-focus-first). A role=menu widget promises
// arrow-key navigation to assistive tech; this hook keeps that promise once
// per seam: opening moves focus into the first entry and Arrow/Home/End rove
// the rows with wrap. Activation (Enter/Space) stays in MenuOption, and menu-
// level Escape DISMISS stays with the host menus (modal-family law of
// 3f41dc16b: dismiss routes to the plain close handler, never activating the
// focused option). MenuOption carries tabIndex={0}, so Tab already walks the
// rows natively; Arrow/Home/End give the full menu pattern without touching
// focus when no item row is present.
const NAV_DIRECTIONS = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };

function focusMenuRow(root, key) {
    const items = Array.from(root.querySelectorAll('[role="menuitem"]'));
    if (items.length === 0) return;
    let next;
    if (key === 'Home') next = items[0];
    else if (key === 'End') next = items[items.length - 1];
    else {
        const delta = NAV_DIRECTIONS[key];
        const idx = items.indexOf(document.activeElement);
        // Focus landing outside the rows (e.g. the svg root) starts the walk
        // at the top (down) or bottom (up) instead of stranding.
        next = idx === -1
            ? items[delta > 0 ? 0 : items.length - 1]
            : items[(idx + delta + items.length) % items.length];
    }
    if (next && typeof next.focus === 'function') next.focus();
}

// Documented fallback anchor (improvement 2026-11-16 XF backlog): a pointer
// open (right-click on the hit-rect) can leave document.activeElement on
// <body>, because unfocusable SVG chrome blurs whatever was focused. When no
// usable pre-open anchor exists the restore lands on the menu's board root —
// the containing <svg> (parent element outside an svg in tests), stamped
// tabindex="-1" on open so it is a programmatic focus target without joining
// the Tab sequence. Keyboard users stay inside the map instead of falling to
// <body> at the document's end.
function focusableMenuHost(menu) {
    const host = menu.closest('svg') || menu.parentElement;
    if (host && !host.hasAttribute('tabindex')) host.setAttribute('tabindex', '-1');
    return host || null;
}

// Restore machinery, implemented ONCE here for both menu families: the host
// effects capture the anchor while opening and call this when the menu's
// mounted state flips to closed (every dismissal path — Escape, backdrop/
// svg-root click, menu-item activation, the ✕ row, rename-commit/revert —
// funnels through that single transition). Deferred one microtask so focus
// committed in the SAME render wins the race: the inline rename input's
// autoFocus, the indoor rename autocomplete's refocus, and the Delete dialog's
// own pull all land before this check runs. We only act when focus actually
// fell out (body/html or a detached node): a surface that took focus is never
// fought, and a missing/detached anchor never throws.
function restoreMenuFocus(anchor, fallback) {
    if (!anchor && !fallback) return;
    // Promise.resolve().then is the microtask queue — same deferral as
    // queueMicrotask without needing the global in the eslint allowlist.
    Promise.resolve().then(() => {
        const active = document.activeElement;
        const stranded = !active
            || active === document.body
            || active === document.documentElement
            || !active.isConnected;
        if (!stranded) return;
        const target = anchor && anchor.isConnected ? anchor : fallback;
        if (target && target.isConnected && typeof target.focus === 'function') target.focus();
    });
}

// menuRef points at the role=menu root; openKey identifies the armed menu
// (null/falsy = closed): focus lands on the first entry whenever it changes
// to a truthy value. Hosts pass null while a lane owns focus itself — the hex
// menu does this while its inline rename editor is mounted so the input's
// autoFocus is never stolen. menuOpen is the menu's MOUNTED state (kept
// distinct from openKey because the hex rename arm nulls openKey while the
// menu stays open): the focus-restore fires on its true→false transition (or
// an unmount while open), so dismissing a rename never pulls focus out of the
// live editor. Returns the onKeyDown handler the host wires on the menu root.
// Rows are re-queried on every key, so commit faces that add/remove rows after
// opening (link picker, the indoor visibility label flip) always rove the live
// row set.
export function useMenuRoving(menuRef, openKey, menuOpen) {
    const anchorRef = useRef(null);
    const fallbackRef = useRef(null);

    useEffect(() => {
        if (!menuOpen) return undefined;
        return () => {
            restoreMenuFocus(anchorRef.current, fallbackRef.current);
            anchorRef.current = null;
            fallbackRef.current = null;
        };
    }, [menuOpen]);

    useEffect(() => {
        if (!openKey) return undefined;
        const menu = menuRef.current;
        if (!menu) return undefined;
        // Capture the pre-open anchor once per open. Focus already inside the
        // menu (the indoor anchor key re-arms when the selection moves under
        // the menu) keeps the original anchor; body/html captures as null so
        // the board-root fallback applies on close.
        const active = document.activeElement;
        if (active
            && active !== document.body
            && active !== document.documentElement
            && !menu.contains(active)) {
            anchorRef.current = active;
        }
        fallbackRef.current = focusableMenuHost(menu);
        const first = menu.querySelector('[role="menuitem"]');
        if (first && typeof first.focus === 'function') first.focus();
    }, [menuRef, openKey]);

    return function handleMenuKeyDown(e) {
        if (!(e.key in NAV_DIRECTIONS) && e.key !== 'Home' && e.key !== 'End') return;
        // An inline rename editor (.context-menu-input, both lanes) owns
        // arrows/Home/End for native caret movement — never rove over it.
        if (e.target instanceof HTMLElement && e.target.classList.contains('context-menu-input')) return;
        e.preventDefault(); // arrows/Home/End scroll the page natively
        if (menuRef.current) focusMenuRow(menuRef.current, e.key);
    };
}

export default useMenuRoving;
