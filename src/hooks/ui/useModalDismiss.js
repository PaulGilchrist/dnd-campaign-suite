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
import { useRef } from 'react';

export function useModalDismiss(onCancel, { disabled = false, panelSelector = '.modal-content' } = {}) {
    // True while the in-flight drag started inside the dialog panel (the
    // DeleteConfirmModal panelMouseDown guard).
    const panelMouseDownRef = useRef(false);

    // Escape (WAI-ARIA modal law: a dialog always answers Escape). Focus lives
    // inside the panel (its input autoFocuses on open), so a panel/overlay
    // keydown handler reaches it exactly like the reference tier's.
    const handleKeyDown = (e) => {
        if (e.key === 'Escape' && !disabled) {
            onCancel();
        }
    };

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
