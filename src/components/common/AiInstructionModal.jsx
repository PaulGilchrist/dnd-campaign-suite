import { useEffect } from 'react';
import './AiInstructionModal.css';

/**
 * Tiny shared shell for the AI instruction surfaces (refine / dress).
 *
 * Why a new shell instead of an existing modal family: every established
 * overlay in the app is host-scoped — `.ct-modal-overlay` styles only match
 * under `.ct-container` (so the EncounterBuilder refine face and the
 * MapsManager dress rows get no chrome), `.maps-manager-modal` carries
 * delete-dialog semantics, and `.sp-overlay`/.mc-overlay belong to the
 * combat-prompt flows. This shell mirrors the `.ct-modal` tokens (same CSS
 * variables, radius and shadow) so it reads as the same chrome everywhere,
 * and follows the house close pattern: header × + Escape, backdrop inert.
 *
 * It stacks above the host editors deliberately: the refine button lives
 * INSIDE the NPC/quest/faction modals (z-index 1000), so the shell uses
 * 1100 for the sanctioned modal-over-modal face. While `busy` the modal is
 * non-dismissible, matching the old inline rows' disabled × semantics.
 */
function AiInstructionModal({ title, closeLabel, busy = false, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  return (
    <div className="ai-instruction-overlay">
      <div className="ai-instruction-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="ai-instruction-header">
          <h3>{title}</h3>
          <button type="button" className="ai-instruction-close" onClick={onClose}
            disabled={busy} aria-label={closeLabel} title={closeLabel}>
            &times;
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default AiInstructionModal;
