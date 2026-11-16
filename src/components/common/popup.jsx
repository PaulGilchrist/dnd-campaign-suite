// @maintained-by-ai
// Shared full-viewport popup surface for roll results, feature descriptions and
// loud zero-stakes refusals (e.g. .mc-no-target-refusal). Modal-family dismissal
// law (backlog XE 2026-11-16): every face whose onClickOrKeyDown is a plain close
// (ALL current consumers — char-sheet, initiative, party-inventory) also answers
// Escape and a pure backdrop click via the shared hooks/ui/useModalDismiss.js
// tier (DeleteConfirmModal/SeededCampaignModal precedent, drag-guard included),
// finally making the app-wide "click to dismiss" hint true. Consumers whose Done
// GATES a pending apply (AttackResultPopup's staged-damage face, the
// hit-popup-backdrop-void-guard law) pass dismissable={false}: there the footer
// handler is suppressed entirely and Escape/backdrop stay inert, so staged damage
// can only commit (Done) or be honestly cancelled.
import { useEffect, useRef } from 'react';
import { sanitizeHtml } from '../../services/ui/sanitize.js';
import { useModalDismiss } from '../../hooks/ui/useModalDismiss.js';
import './popup.css'

function Popup({ html, children, onClickOrKeyDown, showCloseButton = true, dismissable = true }) {
    // Guarded = no dismiss path may fire: either the caller marks the face as
    // staging a pending apply, or there is no close handler to route to at all.
    const guarded = !dismissable || !onClickOrKeyDown;
    const modalRef = useRef(null);
    const { handleKeyDown, handleOverlayMouseDown, handleOverlayClick } = useModalDismiss(
        onClickOrKeyDown, { disabled: guarded, panelSelector: '.popup-modal' });

    // The panel keydown handler only sees Escape while focus lives inside the
    // panel, so an open dismissable popup pulls focus onto itself (the
    // DeleteConfirmModal initial-focus law; tabIndex -1 marks the container,
    // the same tier) AND KEEPS it there while it stays open. Initiative cards
    // re-key on every runtime-state tick (key `${name}-${runtimeStateTick}`),
    // and MonsterNameAutocomplete's refocus-on-remount used to yank
    // activeElement back out of the panel right after the opening roll
    // committed — silently leaving the shipped Escape listener inert on
    // roll-result faces (bug-roll-result-popup-escape-inert-when-opened-over-
    // stat-modal). The fixed overlay already swallows every outside pointer, so
    // the only way focus escapes a dismissable popup is such a programmatic
    // steal — trap it back onto the panel. Focus that lands inside ANY popup
    // overlay (a stacked popup layer mounting above this one) is left alone —
    // the trap only reclaims from outside the layer, so no two popups ever
    // ping-pong focus — and a child that already auto-focused inside the
    // panel keeps the caret. Guarded faces (staged damage) never
    // move focus and never attach the trap — their chrome stays exactly as the
    // void guard shipped it.
    useEffect(() => {
        if (guarded) return;
        const panel = modalRef.current;
        if (!panel) return;
        const reclaimFocus = () => {
            const active = document.activeElement;
            const insidePopupLayer = active && typeof active.closest === 'function'
                && active.closest('[data-testid="popup-overlay"]');
            if (!panel.contains(active) && !insidePopupLayer) {
                panel.focus({ preventScroll: true });
            }
        };
        if (!panel.contains(document.activeElement)) {
            panel.focus();
        }
        document.addEventListener('focusin', reclaimFocus);
        return () => document.removeEventListener('focusin', reclaimFocus);
    }, [guarded]);

    return (
        <div className="popup-overlay" data-testid="popup-overlay" role="presentation"
             onMouseDown={handleOverlayMouseDown} onClick={handleOverlayClick}>
             <div className="popup-modal" ref={modalRef} tabIndex={-1} onKeyDown={handleKeyDown}>
                  {html ? <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}></div> : children}
                  {showCloseButton && onClickOrKeyDown && (
                    <div className="popup-close-row">
                      <button type="button" className="popup-close-btn" onClick={onClickOrKeyDown}>Done</button>
                    </div>
                  )}
             </div>
        </div>
    );
}

export default Popup
