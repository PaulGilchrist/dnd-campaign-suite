import { useModalDismiss } from '../../hooks/ui/useModalDismiss.js';

/**
 * Name-entry modal for the seeded quick-create campaigns (Arena/Starter).
 * Extracted from CampaignSelection so the parent stays under the complexity
 * cap; styling rides the shared .modal-* tier in CampaignSelection.css.
 * a11y tier mirrors common/DeleteConfirmModal.jsx (backlog 2026-11-04 CP):
 * role="dialog" + aria-modal + heading-labelled-by, so [role=dialog] locators
 * and screen readers reach the seed modal like every other dialog in the app.
 * Only one seed modal is ever mounted (parent singleton guard), so deriving a
 * per-preset heading id here can never collide.
 * `error` is the inline denial lane (backlog 2026-11-11 LZ): a refused create
 * (e.g. the CAMPAIGN_LOCK 403) renders here with the typed name preserved —
 * the app never drops to the full-page error screen for it.
 * Escape and a pure backdrop click route to onCancel (backlog 2026-11-13 DG:
 * WAI-ARIA modal-dismiss parity with the DeleteConfirmModal family — an
 * un-submitted name is nothing to discard, so no confirm arms); while
 * `seeding` is true both buttons are disabled and the dismiss lanes stay
 * inert mid-create. Wiring lives in hooks/ui/useModalDismiss.js.
 */
/**
 * Inline denial strip shared by both quick-create modals (backlog 2026-11-11
 * LZ): a refused create (e.g. the CAMPAIGN_LOCK 403) renders inside the open
 * modal with the typed name preserved — the app never drops to the full-page
 * error screen for it. Hoisted (complexity ceiling, mirroring the DeleteNotice
 * sink in CampaignSelection.jsx); styling is .modal-error in
 * CampaignSelection.css.
 */
export function ModalError({ message }) {
  if (!message) return null;
  return <div className="modal-error" role="alert">{message}</div>;
}

function SeededCampaignModal({ preset, name, onNameChange, seeding, onCreate, onCancel, error }) {
  const titleId = `seeded-campaign-title-${preset.prefix.toLowerCase()}`;
  const { handleKeyDown, handleOverlayMouseDown, handleOverlayClick } =
    useModalDismiss(onCancel, { disabled: seeding });
  return (
    <div
      className="modal-overlay"
      role="presentation"
      onMouseDown={handleOverlayMouseDown}
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
    >
      <div className="modal-content" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId}>{preset.button}</h2>
        <p className="seeded-campaign-note">{preset.note}</p>
        <input
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Enter campaign name"
          className="modal-input"
          autoFocus
        />
        <ModalError message={error} />
        <div className="modal-buttons">
          <button className="modal-btn-primary" onClick={onCreate} disabled={seeding}>
            {seeding ? 'Creating…' : 'Create'}
          </button>
          <button className="modal-btn-secondary" onClick={onCancel} disabled={seeding}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default SeededCampaignModal;
