// @maintained-by-ai
// Open-focus + close-focus-restore tier for the sheet .sp-overlay chooser modals
// (backlog 2026-11-17: the Wild-Shape chooser left document.activeElement on
// BODY while open, so a keyboard user had no entrance into the 74-beast list).
// This composes the THREE existing house idioms verbatim — it is not a new
// focus framework:
//  1. common/DeleteConfirmModal.jsx initial-focus law — the first focusable,
//     non-disabled element inside the overlay takes focus when it opens (the
//     PartyInventory Add/Give `[role=dialog]`+autoFocus choosers set the same
//     entrance precedent);
//  2. common/popup.jsx pull rule — only grab when focus is NOT already inside
//     the overlay, so a child that owns focus itself (an autoFocus editor) is
//     never fought;
//  3. ui/useMenuRoving.js open-capture/close-restore — the pre-open anchor is
//     captured once on mount (with the body-root fallback: no usable anchor
//     stamps `tabindex="-1"` on the overlay's parent so the restore lands on a
//     programmatic focus target without joining the Tab sequence), and the
//     restore runs one microtask after the overlay unmounts, acting ONLY when
//     focus actually fell out (body/html or a detached node). A surface that
//     mounted above the closing chooser and pulled focus itself (a roll-result
//     Popup) wins the race untouched.
// `ready` gates the entrance grab until the interactive face is mounted — the
// chooser family renders a LoadingView with nothing focusable first.
import { useEffect } from 'react';

const OVERLAY_FOCUSABLE_SELECTOR =
    'input, button, select, textarea, [tabindex]:not([tabindex="-1"])';

function firstFocusableIn(overlay) {
    return Array.from(overlay.querySelectorAll(OVERLAY_FOCUSABLE_SELECTOR))
        .find(el => !el.disabled) || null;
}

// overlayRef points at the overlay ROOT element (the .sp-overlay div); the
// effect wiring lives entirely on the consumer's mounted lifetime — when the
// chooser unmounts (any dismissal path funnels through the host's state flip),
// the restore fires. Returns nothing.
export function useOverlayEntranceFocus(overlayRef, ready = true) {
    // DECLARED FIRST on purpose: effects run in declaration order, so the
    // pre-open anchor is captured BEFORE the entrance pull moves focus —
    // otherwise the capture would read its own grab as the "pre-open" state.
    useEffect(() => {
        const overlay = overlayRef.current;
        const active = document.activeElement;
        const usable = active
            && active !== document.body
            && active !== document.documentElement
            && active.isConnected
            && !(overlay && overlay.contains(active));
        let anchor = usable ? active : null;
        if (!anchor && overlay && overlay.parentElement) {
            const host = overlay.parentElement;
            if (!host.hasAttribute('tabindex')) host.setAttribute('tabindex', '-1');
            anchor = host;
        }
        return () => {
            let restored = false;
            // Promise.resolve().then is the microtask queue (same deferral as
            // useMenuRoving's restoreMenuFocus, and queueMicrotask stays out of
            // the eslint globals allowlist). In a normal state-flip close the
            // DOM is already detached here and this pass wins.
            const restoreFocusIfStranded = () => {
                if (restored) return;
                const current = document.activeElement;
                const stranded = !current
                    || current === document.body
                    || current === document.documentElement
                    || !current.isConnected;
                if (!stranded || !anchor || !anchor.isConnected) return;
                restored = true;
                anchor.focus();
            };
            Promise.resolve().then(restoreFocusIfStranded);
            // focus/blur UI nicety fallback: React 19's concurrent root
            // unmount (host view swap while the chooser was open) detaches the
            // DOM one task AFTER the passive cleanup, so the microtask check
            // can still see focus "inside" a not-yet-removed overlay. One
            // extra tick re-runs the same idempotent, never-fighting check.
            setTimeout(restoreFocusIfStranded, 0);
        };
    }, [overlayRef]);

    useEffect(() => {
        if (!ready) return undefined;
        const overlay = overlayRef.current;
        if (!overlay || overlay.contains(document.activeElement)) return undefined;
        const entrance = firstFocusableIn(overlay);
        if (entrance) entrance.focus();
        return undefined;
    }, [overlayRef, ready]);
}

export default useOverlayEntranceFocus;
