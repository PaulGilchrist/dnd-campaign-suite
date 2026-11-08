// @maintained-by-ai
// The app's in-app named-delete confirm — a11y tier introduced for the MapsManager
// "Delete Map" dialog (681199249), extracted VERBATIM from MapsManager.jsx so the
// indoor map editor's token/prop/player removal lanes ride the SAME dialog instead
// of a native window.confirm (backlog 2026-11-01 AZ2). Structure preserved:
// role="dialog" + aria-modal + heading-labelled-by + initial focus on the dialog's
// first focusable element + two-way Tab trap + Cancel / `.delete-confirm-btn`
// action row. Rides the neutral global `.modal-shell-*` confirmation shell
// (App.css, backlog EN 2026-11-08) — the visuals were copied VERBATIM from
// the original `.maps-manager-modal*` chrome so every consumer renders
// byte-equivalent while combat/hostile confirms no longer borrow a
// maps-manager class name (style-bleed guard); App.css is imported globally
// by App.jsx, so no per-component CSS import is needed here.
import { useEffect, useRef } from 'react';

// Focusable-element probe for the dialog's focus trap (mirrors the semantics
// AiInstructionModal established for role="dialog" overlays; a shared trap hook
// does not exist app-wide yet, so it lives beside its dialogs).
const MODAL_FOCUSABLE_SELECTOR =
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function getModalFocusable(modalEl) {
    return Array.from(modalEl.querySelectorAll(MODAL_FOCUSABLE_SELECTOR)).filter(el => !el.disabled);
}

// Optional typed-name extension (backlog 2026-11-04 CO, campaign-delete lane):
// pass `typedConfirm={{ label, value, onChange }}` to arm an exact-name input
// ABOVE the action row (the shared modal's initial focus lands on it, being
// the first focusable element), and `error` to surface inline copy (role="alert")
// WITHOUT closing the dialog — the destructive lanes that used to ride a raw
// window.prompt for the typed gate. Consumers that omit both props render
// byte-identical to the original tier (pinned by DeleteConfirmModal.test.jsx).
function DeleteConfirmModal({ titleId, title, confirmLabel, onCancel, onConfirm, children, typedConfirm, error }) {
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
        <div className="modal-shell-overlay">
            <div
                className="modal-shell"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                ref={modalRef}
                onKeyDown={handleKeyDown}
            >
                <h3 id={titleId}>{title}</h3>
                <p>{children}</p>
                {typedConfirm && (
                    <div className="delete-confirm-typed">
                        <label className="delete-confirm-typed-label" htmlFor={`${titleId}-typed-input`}>
                            {typedConfirm.label}
                        </label>
                        <input
                            id={`${titleId}-typed-input`}
                            className="delete-confirm-typed-input"
                            type="text"
                            value={typedConfirm.value}
                            onChange={(e) => typedConfirm.onChange(e.target.value)}
                            autoComplete="off"
                        />
                    </div>
                )}
                {error && (
                    <p className="delete-confirm-error" role="alert">{error}</p>
                )}
                <div className="modal-shell-actions">
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
