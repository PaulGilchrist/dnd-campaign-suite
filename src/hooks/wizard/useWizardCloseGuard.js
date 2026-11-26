import { useCallback, useEffect, useState } from 'react';
import cloneDeep from 'lodash/cloneDeep';
import { useReloadGuard } from '../management/useReloadGuard.js';
import useWizardEscape from './useWizardEscape.js';

/**
 * Unsaved-changes guard for the character wizard: deep-compares formData
 * against the initial draft snapshot on any close request (footer Cancel /
 * header × / Escape).
 * Item 7 F11 conversion: the house NAMED-confirm semantics now ride the
 * shared useReloadGuard + DiscardDraftDialog lane (identical to the six
 * .ct-* CRUD surfaces). A surviving native window.confirm here blocked
 * every automated driver call while open — it is what wedged the Item 7
 * e2e session when the new Escape lane surfaced it. Cancel/Escape/backdrop
 * KEEP with zero writes; `Yes, Discard` closes; clean drafts close
 * silently (the hook's dirty-check; useState's lazy initializer pins the
 * first-render draft, which the effect below seeds into the guard).
 * Post-save the parent unmounts the wizard, so no double-prompt.
 * Hoisted out of CharacterCreationWizard (max-statements budget,
 * useWizardEscape/WizardStepRenderer precedent).
 */
export default function useWizardCloseGuard({ formData, isEditing, characterData, onCancel }) {
  const [initialSnapshot] = useState(() => cloneDeep(formData));
  const { seedDraft, confirmDiscardDraft, discardDialog } = useReloadGuard({
    modalOpen: true,
    formData,
    confirmMessage: 'Discard this new character draft?',
  });
  useEffect(() => {
    seedDraft(initialSnapshot);
  }, [seedDraft, initialSnapshot]);

  const handleRequestClose = useCallback(async () => {
    const trimmedName = (formData.name || '').trim();
    const named = isEditing
      ? `Discard changes to "${trimmedName || characterData?.name || 'this character'}"?`
      : trimmedName
        ? `Discard changes to "${trimmedName}"?`
        : null; // unnamed new draft → the hook's default copy
    const proceed = await confirmDiscardDraft(named);
    if (proceed) {
      onCancel();
    }
  }, [formData, isEditing, characterData, onCancel, confirmDiscardDraft]);

  // F11 (visual audit 2026-11-25, Item 7): Escape rides the same keep-progress
  // close lane as × / Cancel (see useWizardEscape for the child-dialog law).
  useWizardEscape(handleRequestClose);

  return { discardDialog, handleRequestClose };
}
