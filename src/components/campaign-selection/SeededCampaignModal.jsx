import { useEffect, useRef } from 'react';
import { useModalDismiss } from '../../hooks/ui/useModalDismiss.js';
import { seedLockNoteText } from '../../services/campaign/seededCampaign.js';

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
 * Pre-commit lock disclosure (backlog 2026-11-22 QQ, sharpened by the
 * seed-prefill-lock-aware improve): renders `seedLockNoteText` — the copy law
 * shared with the lock-aware prefill (`seedPrefillName`, both in
 * services/campaign/seededCampaign.js) so prefill and disclosure can never
 * drift. Under CAMPAIGN_LOCK the create guard
 * (server/utils/campaignLock.js createCampaignCreateGuard) allows ONLY the
 * lock's own member names, so the note enumerates them inside the modal
 * BEFORE the operator commits, and never claims a refusal about a current
 * input that would actually commit. An empty allowlist (malformed config)
 * renders nothing honest. Same admin-lock-note class as the Admin
 * rename/delete notes (styled by a `.campaign-selection` .modal-content
 * mirror rule in CampaignSelection.css, since Admin's rule is scoped to
 * `.campaign-admin`).
 */
export function SeedLockNote({ campaignLocked, lockNames, prefix, value }) {
  const text = seedLockNoteText({ campaignLocked, lockNames, prefix, value });
  if (!text) return null;
  return <p className="admin-lock-note">{text}</p>;
}

function SeededCampaignModal({ preset, name, onNameChange, seeding, onCreate, onCancel, error, lockHint }) {
  const titleId = `seeded-campaign-title-${preset.prefix.toLowerCase()}`;
  const { handleKeyDown, handleOverlayMouseDown, handleOverlayClick } =
    useModalDismiss(onCancel, { disabled: seeding });

  // Focus restoration after a create attempt (backlog SS 2026-11-22): BOTH
  // footer buttons flip `disabled={seeding}`, so the clicked Create sheds
  // activeElement to BODY mid-create (the same stranded-focus face the
  // useModalDismiss window-rescue lane answers for Escape). When the pass
  // ends with the modal still open — the refusal face keeps the typed name
  // in the input, so that is exactly the field to return to — refocus it on
  // the seeding true→false transition. Only that edge fires: initial mount
  // starts at false (autoFocus owns that face), and a SUCCESS unmounts the
  // modal before the effect re-runs, so focus is never stolen on close or
  // mid-create.
  const nameInputRef = useRef(null);
  const wasSeedingRef = useRef(false);
  useEffect(() => {
    if (wasSeedingRef.current && !seeding && nameInputRef.current) {
      nameInputRef.current.focus();
    }
    wasSeedingRef.current = seeding;
  }, [seeding]);
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
          ref={nameInputRef}
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          aria-label="New campaign name"
          placeholder="Enter campaign name"
          className="modal-input"
          autoFocus
        />
        <ModalError message={error} />
        <SeedLockNote campaignLocked={lockHint.campaignLocked} lockNames={lockHint.lockNames} prefix={preset.prefix} value={name} />
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
