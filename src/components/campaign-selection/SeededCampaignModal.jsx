/**
 * Name-entry modal for the seeded quick-create campaigns (Arena/Starter).
 * Extracted from CampaignSelection so the parent stays under the complexity
 * cap; styling rides the shared .modal-* tier in CampaignSelection.css.
 * a11y tier mirrors common/DeleteConfirmModal.jsx (backlog 2026-11-04 CP):
 * role="dialog" + aria-modal + heading-labelled-by, so [role=dialog] locators
 * and screen readers reach the seed modal like every other dialog in the app.
 * Only one seed modal is ever mounted (parent singleton guard), so deriving a
 * per-preset heading id here can never collide.
 */
function SeededCampaignModal({ preset, name, onNameChange, seeding, onCreate, onCancel }) {
  const titleId = `seeded-campaign-title-${preset.prefix.toLowerCase()}`;
  return (
    <div className="modal-overlay">
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
