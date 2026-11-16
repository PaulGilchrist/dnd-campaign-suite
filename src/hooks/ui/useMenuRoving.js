import { useEffect } from 'react';

// Roving-arrow navigation + open-focus for the shared SVG role=menu context
// menus (backlog 2026-11-16 XC, extracted verbatim from ItemContextMenu.jsx
// so the hex POIContextMenu adopts the same tier — bug-hex-poi-menu-no-
// keyboard-rove-or-focus-first). A role=menu widget promises arrow-key
// navigation to assistive tech; this hook keeps that promise once per seam:
// opening moves focus into the first entry and Arrow/Home/End rove the rows
// with wrap. Activation (Enter/Space) stays in MenuOption, and menu-level
// Escape DISMISS stays with the host menus (modal-family law of 3f41dc16b:
// dismiss routes to the plain close handler, never activating the focused
// option). MenuOption carries tabIndex={0}, so Tab already walks the rows
// natively; Arrow/Home/End give the full menu pattern without touching
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

// menuRef points at the role=menu root; openKey identifies the armed menu
// (null/falsy = closed): focus lands on the first entry whenever it changes
// to a truthy value. Hosts pass null while a lane owns focus itself — the
// hex menu does this while its inline rename editor is mounted so the
// input's autoFocus is never stolen. Returns the onKeyDown handler the host
// wires on the menu root. Rows are re-queried on every key, so commit faces
// that add/remove rows after opening (link picker, the indoor visibility
// label flip) always rove the live row set. No focus-restore on close: the
// invoking hit-rects are unfocusable pointer chrome, and Rename/Delete lanes
// move focus into their own popover/dialog — restoring would fight that.
export function useMenuRoving(menuRef, openKey) {
    useEffect(() => {
        if (!openKey) return undefined;
        const first = menuRef.current?.querySelector('[role="menuitem"]');
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
