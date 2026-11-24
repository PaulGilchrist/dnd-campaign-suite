import { useState, useCallback, useEffect } from 'react';
import { hasDuplicateCharacterName, DUPLICATE_CHARACTER_NAME_ERROR, CHARACTER_NAME_REQUIRED_ERROR } from '../../config/utils.js';

/**
 * Live inline name guard for the wizard's Basic step. Blank/whitespace →
 * required hint, collision → duplicate hint, valid → cleared. Mirrors
 * NPCs/Quests/Factions (updateField clears errors.name on each keystroke —
 * this re-arms it while the name is still invalid). The required hint only
 * arms once the user has first interacted with the field (typed or blurred):
 * a pristine empty name on arrival must not render error styling before the
 * user did anything (advancement is still gated by the disabled Next/Save
 * lanes). The duplicate check stays live from the first keystroke. Only
 * writes when the message actually changes so the happy path stays
 * untouched. Rendered inline by WizardStepBasic's existing `.error-message`
 * span beneath the name input.
 */
function useWizardNameGuard(name, existingNames, errors, setErrors, updateField) {
  const [nameTouched, setNameTouched] = useState(false);

  const handleFieldChange = useCallback((field, value) => {
    if (field === 'name') {
      setNameTouched(true);
    }
    updateField(field, value);
  }, [updateField]);

  const handleNameBlur = useCallback(() => setNameTouched(true), []);

  useEffect(() => {
    const trimmedName = (name || '').trim();
    let expectedNameError = null;
    if (!trimmedName) {
      if (nameTouched) {
        expectedNameError = CHARACTER_NAME_REQUIRED_ERROR;
      }
    } else if (hasDuplicateCharacterName(name, existingNames)) {
      expectedNameError = DUPLICATE_CHARACTER_NAME_ERROR;
    }
    // Write only to raise/change a live name message, or to clear one this
    // guard owns — never churn errors owned by other validators.
    const isLiveNameError = errors.name === DUPLICATE_CHARACTER_NAME_ERROR || errors.name === CHARACTER_NAME_REQUIRED_ERROR;
    if (expectedNameError ? errors.name !== expectedNameError : isLiveNameError) {
      setErrors({ ...errors, name: expectedNameError });
    }
  }, [name, existingNames, errors, setErrors, nameTouched]);

  return { handleFieldChange, handleNameBlur };
}

export default useWizardNameGuard;
