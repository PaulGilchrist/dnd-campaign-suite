import { getVisibleSteps } from '../../config/steps-config.js';

/**
 * Left sidebar navigation for the character creation wizard.
 * Displays clickable tabs for each wizard step and a save button.
 * Tab numbers come from getVisibleSteps so the indicator stays consecutive
 * and matches the content headings.
 *
 * @param {Object} props
 * @param {number} props.currentStep - The currently active canonical step.
 * @param {boolean} props.isEditing - When true, hide step 1 (Ruleset).
 * @param {string} props.ruleset - The ruleset ('5e' or '2024'). When '5e', step 5 (Background) is hidden.
 * @param {function} props.getStepEnabled - Takes a canonical step number, returns boolean for whether that tab is clickable.
 * @param {function} props.goToStep - Takes a canonical step number, navigates to it.
 * @param {boolean} props.isSaveEnabled - Whether the save button is active.
 * @param {function} props.onSave - Called when the save tab is clicked.
 */
export default function WizardSidebar({ currentStep, isEditing, ruleset, getStepEnabled, goToStep, isSaveEnabled, onSave }) {
  const visibleSteps = getVisibleSteps({ isEditing, ruleset });

  return (
    <div className="wizard-sidebar">
      {visibleSteps.map(stepConfig => {
        const isActive = stepConfig.step === currentStep;
        const isEnabled = getStepEnabled(stepConfig.step);
        return (
          <button
            key={stepConfig.step}
            className={`sidebar-tab ${isActive ? 'active' : ''} ${!isEnabled ? 'disabled' : ''}`}
            onClick={() => goToStep(stepConfig.step)}
            disabled={!isEnabled}
          >
            <span className="sidebar-tab-number">{stepConfig.displayNumber}</span>
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
