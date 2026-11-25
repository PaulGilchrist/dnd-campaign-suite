import { getVisibleSteps, getLadderCauseTitle } from '../../config/steps-config.js';

/**
 * Left sidebar navigation for the character creation wizard.
 * Displays clickable tabs for each wizard step and a save button.
 * Tab numbers come from getVisibleSteps so the indicator stays consecutive
 * and matches the content headings.
 *
 * @param {Object} props
 * @param {number} props.currentStep - The currently active canonical step.
 * @param {string} props.ruleset - The ruleset ('5e' or '2024'). When '5e', step 5 (Background) is hidden.
 * @param {function} props.getStepEnabled - Takes a canonical step number, returns boolean for whether that tab is clickable.
 * @param {function} props.goToStep - Takes a canonical step number, navigates to it.
 * @param {boolean} props.isSaveEnabled - Whether the save button is active.
 * @param {function} props.onSave - Called when the save tab is clicked.
 * @param {number|null} props.firstInvalidStep - Canonical number of the first
 *   step failing the valid-prefix ladder (null when none). Ladder-disabled
 *   tabs and Save name it in their `title` so the cause is discoverable.
 * @param {string} [props.saveCauseTitle] - Full cause sentence for the
 *   disabled Save button (ladder or caps belt), computed once by the wizard
 *   via getSaveCauseTitle so both save controls always agree. Falls back to
 *   the ladder cause when not provided.
 */
export default function WizardSidebar({ currentStep, ruleset, getStepEnabled, goToStep, isSaveEnabled, onSave, firstInvalidStep, saveCauseTitle }) {
  const visibleSteps = getVisibleSteps({ ruleset });

  // Cause-naming idiom (mirrors the NPC list's disabled Add-to-Initiative
  // chip): a disabled control says WHICH step it is waiting on. Only set
  // when something actually blocks the ladder — enabled buttons stay bare.
  // Shared with the edit-mode footer Save Changes via getLadderCauseTitle.
  const ladderCause = getLadderCauseTitle(firstInvalidStep, { ruleset });

  // Save owns a second blocker besides the ladder — the caps belt — so it
  // rides the wizard's single getSaveCauseTitle sentence when supplied,
  // falling back to the ladder cause for ladder-only callers/tests.
  const saveCause = saveCauseTitle || ladderCause;

  return (
    <div className="wizard-sidebar">
      {/* The Ruleset tab is visible in BOTH flows — edit rides the same
          ledger-guarded switch lane as fresh builds (see the wizard's
          handleRulesetChange). */}
      {visibleSteps.map(stepConfig => {
        const isActive = stepConfig.step === currentStep;
        const isEnabled = getStepEnabled(stepConfig.step);
        return (
          <button
            key={stepConfig.step}
            className={`sidebar-tab ${isActive ? 'active' : ''} ${!isEnabled ? 'disabled' : ''}`}
            onClick={() => goToStep(stepConfig.step)}
            disabled={!isEnabled}
            title={!isEnabled ? ladderCause : undefined}
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
        title={!isSaveEnabled ? saveCause : undefined}
      >
        <span className="sidebar-tab-number">✓</span>
        <span className="sidebar-tab-title">Save</span>
      </button>
    </div>
  );
}
