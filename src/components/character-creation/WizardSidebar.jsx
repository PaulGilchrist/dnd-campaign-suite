import { WIZARD_STEPS } from '../../config/steps-config.js';

/**
 * Left sidebar navigation for the character creation wizard.
 * Displays clickable tabs for each wizard step and a save button.
 *
 * @param {Object} props
 * @param {number} props.currentStep - The currently active step.
 * @param {boolean} props.isEditing - When true, hide step 1 (Ruleset).
 * @param {string} props.ruleset - The ruleset ('5e' or '2024'). When '5e', step 5 (Background) is hidden.
 * @param {function} props.getStepEnabled - Takes a step number, returns boolean for whether that tab is clickable.
 * @param {function} props.goToStep - Takes a step number, navigates to it.
 * @param {boolean} props.isSaveEnabled - Whether the save button is active.
 * @param {function} props.onSave - Called when the save tab is clicked.
 */
export default function WizardSidebar({ currentStep, isEditing, ruleset, getStepEnabled, goToStep, isSaveEnabled, onSave }) {
  const visibleSteps = WIZARD_STEPS.filter(step => {
    if (isEditing && step.step === 1) return false;
    if (ruleset !== '2024' && step.step === 5) return false;
    return true;
  });

  return (
    <div className="wizard-sidebar">
      {visibleSteps.map(stepConfig => {
        const stepNum = stepConfig.step;
        const isActive = stepNum === currentStep;
        const isEnabled = getStepEnabled(stepNum);
        return (
          <button
            key={stepNum}
            className={`sidebar-tab ${isActive ? 'active' : ''} ${!isEnabled ? 'disabled' : ''}`}
            onClick={() => goToStep(stepNum)}
            disabled={!isEnabled}
          >
            <span className="sidebar-tab-number">{stepNum}</span>
            <span className="sidebar-tab-title">{stepConfig.title}</span>
          </button>
        );
      })}
      <button
        className={`sidebar-save ${!isSaveEnabled ? 'disabled' : ''}`}
        onClick={onSave}
        disabled={!isSaveEnabled}
      >
        <span className="sidebar-tab-number">✓</span>
        <span className="sidebar-tab-title">Save</span>
      </button>
    </div>
  );
}
