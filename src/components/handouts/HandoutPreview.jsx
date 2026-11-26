import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import './HandoutPreview.css';
import './HandoutCards.css';

/**
 * Shared handout preview shell (learnability-engagement backlog Item 4).
 *
 * Each handout screen button opens THIS preview: the paper sheet renders as a
 * real light-face page on screen (WYSIWYG), and the footer's Print button runs
 * window.print() with the portal-only isolation lane in HandoutPreview.css —
 * the generalized `ct-modal` print-only trick (App.css's
 * `.ct-container:has(.ct-modal)` sibling-hiding idiom, factored here into a
 * body portal so it works from ANY host: a view, an open .ct-modal, or the
 * mc-overlay bestiary theatre). Only the sheet hits paper; every screen chrome
 * (header, footer, sidebar, the view behind) is `display:none`d on print.
 *
 * Pure presentation: reads props, writes nothing, never touches the runtime
 * store. Escape/backdrop/Close are zero-state dismissals.
 */
function HandoutPreview({ label, campaignName, onClose, children }) {
  // House overlay law (EncounterModal.jsx, DiceTray idiom): Escape is
  // x-parity. Document CAPTURE + stopPropagation: the preview is rendered
  // from inside host modals too (Load list, session planner, monster card),
  // and the keystroke must answer ONLY the topmost preview — the host's own
  // Escape listener never runs (same capture-consumption reason
  // EncounterModal's delete-dialog lane documents).
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    document.addEventListener('keydown', handleKey, true);
    return () => document.removeEventListener('keydown', handleKey, true);
  }, [onClose]);

  return createPortal(
    // The kit (.ct-modal*, .ct-btn) is scoped under .ct-container, and
    // App.css's print-only modal trick (the lane generalized here) keys off
    // `.ct-container:has(.ct-modal)` — so the portal ROOT carries the kit
    // class. Being a body child, the isolation rule below still owns paper.
    <div className="ct-container handout-preview-portal">
      <div
        className="ct-modal-overlay handout-preview-overlay"
        role="presentation"
        onClick={(e) => {
          // Backdrop dismiss mirrors the Load modal convention: in-panel
          // clicks are inert, a pure backdrop click closes.
          if (e.target.closest('.ct-modal')) return;
          onClose();
        }}
      >
        <div className="ct-modal handout-preview-modal" role="dialog" aria-modal="true" aria-label={`${label} preview`}>
          <div className="ct-modal-header no-print">
            <h3><i className="fa-solid fa-print" /> {label}</h3>
            <button className="ct-modal-close" onClick={onClose} aria-label="Close">
              &times;
            </button>
          </div>

          <div className="ct-modal-body">
            <article className="handout-page">
              {children}
              <footer className="handout-footer">
                {campaignName ? `${campaignName} · ` : ''}{label}
              </footer>
            </article>
          </div>

          <div className="ct-modal-footer no-print">
            <div className="ct-modal-buttons">
              <button type="button" className="ct-btn" onClick={onClose}>Close preview</button>
              <button
                type="button"
                className="ct-btn ct-btn-primary"
                onClick={() => window.print()}
                title="Print this handout"
                autoFocus
              >
                <i className="fa-solid fa-print" /> Print
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default HandoutPreview;
