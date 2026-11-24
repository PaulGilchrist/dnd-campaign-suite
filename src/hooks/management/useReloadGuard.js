import { useCallback, useEffect, useRef, useState, createElement } from 'react';
import cloneDeep from 'lodash/cloneDeep';
import isEqual from 'lodash/isEqual';
import DiscardDraftDialog from '../../components/common/DiscardDraftDialog.jsx';

// Shared reload-discard guard for the six .ct-* CRUD lanes (NPCs/Quests/
// Factions/Settlements/Sessions/Notes, improve 2026-10-28-T backlog): the 409
// conflict banner's one-click "Reload list" recovery closes the editor and
// refetches — silently throwing away an in-progress draft. Components seed the
// snapshot wherever the editor opens (new/edit/generate), re-baseline it
// wherever a save leaves the editor open, and clear it on close; handleReloadList
// asks confirmDiscardDraft first. Lifted verbatim from NPCs.jsx (ba51c25ee),
// which mirrors the wizard's close-guard (CharacterCreationWizard.jsx
// initialSnapshotRef): deep-compare the draft against the seed, and with a
// dirty editor the loss is NAMED up front — Keep (Cancel/Escape/backdrop)
// keeps the banner, editor, and draft fully inert.
// QA backlog 2026-11-24: the toll is no longer a native window.confirm. The
// hook stages the ask as a pending promise and hands the host a `discardDialog`
// element riding the shared DeleteConfirmModal role="dialog" tier — so the
// verdict arrives asynchronously: `await confirmDiscardDraft()` resolves true
// when the caller may proceed with discarding the open draft, false when the
// draft stays. Two tolls share this one dirty-check: the 409 banner's "Reload
// list" (no argument → the lane's reload confirmMessage) and the ×/Cancel close
// path via each lane's handleRequestClose (improve 2026-10-29-V backlog), which
// passes the wizard-precedent NAMED copy — `Discard changes to "X"?`
// (CharacterCreationWizard.jsx handleRequestClose). Only a modal-open,
// deep-different-from-seed draft pays any toll at all; clean drafts resolve
// true silently, exactly like the retired native fast path.
export function useReloadGuard({ modalOpen, formData, confirmMessage }) {
  // Deep snapshot of the draft the editor was seeded with (null when closed).
  const draftSnapshot = useRef(null);
  // Pending verdict of the open toll (null while idle). Held in a ref so
  // settle() answers the EXACT promise that armed it, never a newer one.
  const resolveRef = useRef(null);
  // Message state drives the dialog's mount (the resolve itself is not state).
  const [discardRequest, setDiscardRequest] = useState(null);

  // Answer the armed toll exactly once: clear the arm, then settle the
  // promise. With nothing armed this is a no-op, so internal closes that run
  // clearDraft after an already-settled toll stay inert.
  const settleDiscard = useCallback((proceed) => {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    setDiscardRequest(null);
    if (resolve) resolve(proceed);
  }, []);

  // Record the seed the editor was just opened with (openNew/openEdit/generate).
  const seedDraft = useCallback((seed) => {
    draftSnapshot.current = cloneDeep(seed);
  }, []);

  const clearDraft = useCallback(() => {
    draftSnapshot.current = null;
    // A toll still armed while the draft vanishes out from under it (e.g. a
    // save/delete close racing an open dialog) is answered KEEP: the caller's
    // proceed-branch must never fire for a draft that is already gone.
    settleDiscard(false);
  }, [settleDiscard]);

  // Resolves true when the caller may proceed with discarding the open draft.
  // A dirty draft arms the in-app dialog; a re-entrant ask answers the PREVIOUS
  // pending toll KEEP before arming the new one (last ask wins, none stranded).
  const confirmDiscardDraft = useCallback((overrideMessage) => {
    if (
      !(
        modalOpen &&
        formData &&
        draftSnapshot.current &&
        !isEqual(formData, draftSnapshot.current)
      )
    ) {
      return Promise.resolve(true);
    }
    return new Promise((resolve) => {
      settleDiscard(false);
      resolveRef.current = resolve;
      setDiscardRequest({ message: overrideMessage || confirmMessage });
    });
  }, [modalOpen, formData, confirmMessage, settleDiscard]);

  // Never strand a pending toll on unmount (view-switch mid-dialog): the
  // caller's proceed-branch is answered KEEP.
  useEffect(() => () => {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    if (resolve) resolve(false);
  }, []);

  // The SAME deep-diff verdict confirmDiscardDraft gates on, exposed WITHOUT
  // the toll (backlog 2026-11-08 EK): the music editor's Cancel/mood-switch
  // discard rides its own DeleteConfirmModal, so its host asks the modal
  // whenever this returns true and only proceeds silently otherwise.
  const isDraftDirty = useCallback(() => (
    !!(modalOpen &&
      formData &&
      draftSnapshot.current &&
      !isEqual(formData, draftSnapshot.current))
  ), [modalOpen, formData]);

  // The toll's dialog element, or null while idle. The hook cannot render, so
  // every lane mounts this in its own tree — as a SIBLING of the editor modal
  // (EncounterModal.delete-confirm-modal law) so the dialog's own backdrop
  // dismisses only the toll and never the editor underneath.
  const discardDialog = discardRequest
    ? createElement(DiscardDraftDialog, {
        message: discardRequest.message,
        onKeep: () => settleDiscard(false),
        onDiscard: () => settleDiscard(true),
      })
    : null;

  return { seedDraft, clearDraft, confirmDiscardDraft, isDraftDirty, discardDialog };
}
