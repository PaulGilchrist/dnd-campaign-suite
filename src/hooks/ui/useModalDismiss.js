// @maintained-by-ai
// Escape + pure-backdrop dismiss wiring for the quick-create dialog family
// (backlog 2026-11-13 DG): the New Campaign / New Arena Battle / New Starter
// Adventure modals used to answer ONLY their Cancel/Create buttons, trapping a
// GM who expects the app-wide dialog behaviour the shared
// common/DeleteConfirmModal.jsx tier gained in 3f41dc16b. Structure mirrored
// from that reference (do not diverge): panel keydown routes Escape to
// onCancel, and the overlay tracks whether the in-flight drag STARTED inside
// the panel so a mouseup released over the backdrop (text selection dragged
// off the panel) never dismisses — only a mousedown+click fully on the
// backdrop counts as a click-outside. `disabled` mirrors a consumer whose
// Cancel button is disabled while a create is in flight (the seeded modal's
// `seeding` flag): no dismiss path may fire mid-create.
import { useEffect, useRef } from 'react';

export function useModalDismiss(onCancel, { disabled = false, panelSelector = '.modal-content' } = {}) {
    // True while the in-flight drag started inside the dialog panel (the
    // DeleteConfirmModal panelMouseDown guard).
    const panelMouseDownRef = useRef(false);

    // The window-level rescue lane (below) is bound once per mount, so it reads
    // the live onCancel/disabled through refs — never a stale closure.
    const cancelRef = useRef(onCancel);
    const disabledRef = useRef(disabled);
    useEffect(() => {
        cancelRef.current = onCancel;
        disabledRef.current = disabled;
    });

    // Escape (WAI-ARIA modal law: a dialog always answers Escape). While focus
    // lives inside the panel (its input autoFocuses on open), a panel/overlay
    // keydown handler reaches it exactly like the reference tier's.
    const handleKeyDown = (e) => {
        if (e.key === 'Escape' && !disabled) {
            onCancel();
        }
    };

    // Escape rescue for focus stranded OUTSIDE the panel
    // (bug-quick-create-seeded-modal-escape-dead-after-refused-create): the
    // seeded quick-create modals toggle `disabled={seeding}` on BOTH footer
    // buttons, so the clicked Create sheds activeElement to BODY mid-create and
    // nothing refocuses — a keydown dispatched at BODY never bubbles through
    // the overlay, leaving the subtree lane above permanently inert after any
    // create attempt. Mirrors the map context-menu law ("the listener lives on
    // window because dismissal must answer with focus on the menu, the board
    // behind it, or nowhere"): window sees every keydown regardless of focus.
    // The two lanes fire EXACTLY once, and the rescue only answers the
    // documented stranded-focus face: a keydown TARGETED at <body>/<html> (the
    // disabled-button focus drop). A keydown still targeted inside a panel is
    // left to the subtree lane (which keeps stacked same-class dialogs
    // per-dialog scoped), and any other target stays with elements' own
    // handlers — notably AvatarModal's shipped one-shot document-level Escape
    // lane, which this listener must never double-fire. It also acts only while
    // a dialog with this panel class is mounted (persistent-host consumers like
    // CampaignSelection call the hook while their modal is closed too).
    useEffect(() => {
        const handleWindowKeyDown = (e) => {
            if (e.key !== 'Escape' || disabledRef.current) return;
            const target = e.target;
            if (target !== document.body && target !== document.documentElement) return;
            if (!document.querySelector(panelSelector)) return;
            cancelRef.current();
        };
        window.addEventListener('keydown', handleWindowKeyDown);
        return () => window.removeEventListener('keydown', handleWindowKeyDown);
    }, [panelSelector]);

    const handleOverlayMouseDown = (e) => {
        panelMouseDownRef.current = Boolean(e.target.closest(panelSelector));
    };

    const handleOverlayClick = (e) => {
        const insidePanel = Boolean(e.target.closest(panelSelector));
        const dragStartedInPanel = panelMouseDownRef.current;
        panelMouseDownRef.current = false;
        if (insidePanel || dragStartedInPanel || disabled) return;
        onCancel();
    };

    return { handleKeyDown, handleOverlayMouseDown, handleOverlayClick };
}

export default useModalDismiss;
