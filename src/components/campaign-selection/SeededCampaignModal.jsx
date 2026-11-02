/**
 * Name-entry modal for the seeded quick-create campaigns (Arena/Starter).
 * Extracted from CampaignSelection so the parent stays under the complexity
 * cap; styling rides the shared .modal-* tier in CampaignSelection.css.
 */
function SeededCampaignModal({ preset, name, onNameChange, seeding, onCreate, onCancel }) {
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>{preset.button}</h2>
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
