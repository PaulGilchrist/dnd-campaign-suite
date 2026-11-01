// @maintained-by-ai
// The app's in-app named-delete confirm — a11y tier introduced for the MapsManager
// "Delete Map" dialog (681199249), extracted VERBATIM from MapsManager.jsx so the
// indoor map editor's token/prop/player removal lanes ride the SAME dialog instead
// of a native window.confirm (backlog 2026-11-01 AZ2). Structure preserved:
// role="dialog" + aria-modal + heading-labelled-by + initial focus on the dialog's
// first focusable element + two-way Tab trap + Cancel / `.delete-confirm-btn`
// action row. Reuses the existing `.maps-manager-modal*` CSS chrome (imported here
// so every consumer renders styled, Vite dedupes the import).
import { useEffect, useRef } from 'react';
import '../maps-manager/MapsManager.css';

// Focusable-element probe for the dialog's focus trap (mirrors the semantics
// AiInstructionModal established for role="dialog" overlays; a shared trap hook
// does not exist app-wide yet, so it lives beside its dialogs).
const MODAL_FOCUSABLE_SELECTOR =
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function getModalFocusable(modalEl) {
    return Array.from(modalEl.querySelectorAll(MODAL_FOCUSABLE_SELECTOR)).filter(el => !el.disabled);
}

function DeleteConfirmModal({ titleId, title, confirmLabel, onCancel, onConfirm, children }) {
    const modalRef = useRef(null);

    // Move focus into the dialog when it opens so keyboard and screen-reader
    // users land on the confirm instead of behind the backdrop.
    useEffect(() => {
        const focusable = getModalFocusable(modalRef.current);
        if (focusable.length > 0) {
            focusable[0].focus();
        }
    }, []);

    // Focus trap: while focus is inside the dialog, Tab from the LAST element
    // wraps to the FIRST and Shift+Tab from the FIRST wraps to the LAST.
    const handleKeyDown = (e) => {
        if (e.key !== 'Tab') return;
        const focusable = getModalFocusable(modalRef.current);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;
        if (!modalRef.current.contains(active)) {
            e.preventDefault();
            (e.shiftKey ? last : first).focus();
        } else if (e.shiftKey && active === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && active === last) {
            e.preventDefault();
            first.focus();
        }
    };

    return (
        <div className="maps-manager-modal-overlay">
            <div
                className="maps-manager-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                ref={modalRef}
                onKeyDown={handleKeyDown}
            >
                <h3 id={titleId}>{title}</h3>
                <p>{children}</p>
                <div className="maps-manager-modal-actions">
                    <button onClick={onCancel}>Cancel</button>
                    <button className="delete-confirm-btn" onClick={onConfirm}>
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default DeleteConfirmModal;
