import { useCallback, useRef } from 'react';
import cloneDeep from 'lodash/cloneDeep';
import isEqual from 'lodash/isEqual';

// Shared reload-discard guard for the five .ct-* CRUD lanes (NPCs/Quests/
// Factions/Settlements/Notes, improve 2026-10-28-T backlog): the 409 conflict
// banner's one-click "Reload list" recovery closes the editor and refetches —
// silently throwing away an in-progress draft. Components seed the snapshot
// wherever the editor opens (new/edit/generate), re-baseline it wherever a
// save leaves the editor open, and clear it on close; handleReloadList asks
// confirmDiscardDraft first. Lifted verbatim from NPCs.jsx (ba51c25ee), which
// mirrors the wizard's close-guard (CharacterCreationWizard.jsx
// initialSnapshotRef): deep-compare the draft against the seed, and with a
// dirty editor the house NAMED-confirm states the loss up front — Cancel
// keeps the banner, editor, and draft fully inert.
export function useReloadGuard({ modalOpen, formData, confirmMessage }) {
  // Deep snapshot of the draft the editor was seeded with (null when closed).
  const draftSnapshot = useRef(null);

  // Record the seed the editor was just opened with (openNew/openEdit/generate).
  const seedDraft = useCallback((seed) => {
    draftSnapshot.current = cloneDeep(seed);
  }, []);

  const clearDraft = useCallback(() => {
    draftSnapshot.current = null;
  }, []);

  // Returns true when the caller may proceed with discarding the open draft.
  // Two tolls share this one dirty-check: the 409 banner's "Reload list"
  // (no argument → the lane's reload confirmMessage) and the ×/Cancel close
  // path via each lane's handleRequestClose (improve 2026-10-29-V backlog),
  // which passes the wizard-precedent NAMED copy — `Discard changes to "X"?`
  // (CharacterCreationWizard.jsx handleRequestClose). Only a modal-open,
  // deep-different-from-seed draft pays any confirm at all; the override is
  // optional so every pre-existing reload call-site is unchanged.
  const confirmDiscardDraft = useCallback((overrideMessage) => {
    if (
      modalOpen &&
      formData &&
      draftSnapshot.current &&
      !isEqual(formData, draftSnapshot.current) &&
      !window.confirm(overrideMessage || confirmMessage)
    ) {
      return false;
    }
    return true;
  }, [modalOpen, formData, confirmMessage]);

  return { seedDraft, clearDraft, confirmDiscardDraft };
}
