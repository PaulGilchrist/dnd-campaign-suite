import { useModalDismiss } from '../../hooks/ui/useModalDismiss.js';
import { seededDefaultName } from '../../services/campaign/seededCampaign.js';

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

/**
 * Pre-commit lock disclosure (backlog 2026-11-22 QQ): under CAMPAIGN_LOCK the
 * create guard (server/utils/campaignLock.js createCampaignCreateGuard) allows
 * ONLY the lock's own member names, so a create whose name is not an allowlist
 * member (the seeded prefills' dated default `Arena-YYYYMMDD` /
 * `Starter-YYYYMMDD`, and the standard modal's empty/typed name) honest-403s.
 * This note names the allowed campaigns inside the modal BEFORE the operator
 * commits, so the denial is no longer blind. Disclosure only — the prefills
 * are unchanged and nothing renders when no lock is active (fail-open fetch).
 * The seeded copy names the preset's own dated default via `prefix` so it can
 * never claim a stale pattern; an empty allowlist (malformed config) renders
 * nothing honest. Same admin-lock-note class as the Admin rename/delete notes
 * (styled by a `.campaign-selection` .modal-content mirror rule in
 * CampaignSelection.css, since Admin's rule is scoped to `.campaign-admin`).
 */
export function SeedLockNote({ campaignLocked, lockNames, prefix }) {
  if (!campaignLocked || lockNames.length === 0) return null;
  const defaultClause = prefix
    ? `the prefilled default (${seededDefaultName(prefix)}) `
    : 'a name outside the allowlist ';
  return (
    <p className="admin-lock-note">
      Campaign is locked — {defaultClause}will be refused. Only these campaign
      names are allowed: {lockNames.join(', ')}.
    </p>
  );
}

function SeededCampaignModal({ preset, name, onNameChange, seeding, onCreate, onCancel, error, lockHint }) {
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
          aria-label="New campaign name"
          placeholder="Enter campaign name"
          className="modal-input"
          autoFocus
        />
        <ModalError message={error} />
        <SeedLockNote campaignLocked={lockHint.campaignLocked} lockNames={lockHint.lockNames} prefix={preset.prefix} />
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
