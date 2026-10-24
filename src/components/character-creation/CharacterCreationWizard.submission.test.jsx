// @maintained-by-ai
/**
 * Submission lane for CharacterCreationWizard — isolates the handleSubmit
 * boundary (CharacterCreationWizard.jsx handleSubmit) by mocking every hook,
 * validator and chrome. Pins what the integration lane (#363, real
 * validators) cannot see: submit-chain ordering, byte-exact validator-call
 * args, and the three early-return branches (step / final / ability-cap).
 *
 * Owned elsewhere (do not restate here):
 *  - edit-flow onComplete byte-exact payload with real validators
 *    -> CharacterCreationWizard.integration.test.jsx test 3
 *  - footer button labels / disabled states -> WizardFooter.test.jsx
 *  - per-step field behavior -> WizardStep*.test.jsx
 *
 * There is no create-vs-edit API dispatch, no fetch POST assembly, and no
 * double-submit guard in the source — submit runs the same
 * validateStep -> validateFinalFormData -> validateAbilityTotals chain and
 * calls onComplete(formData) in both modes — so nothing is pinned for those.
 *
 * Trim log vs previous revision:
 *  - "calls onComplete with formData when all validations pass" folded into
 *    the chain test below (the standalone happy payload is strictly weaker
 *    than #363's real-validator edit-flow pin; the chain test keeps the
 *    call wiring that #363 cannot spy).
 *  - "passes the character ruleset to validateStep" + "calls
 *    validateFinalFormData after validateStep passes" consolidated into one
 *    byte-exact chain test (same execution path, both validator calls).
 *  - "does not call validateFinalFormData when step validation fails"
 *    merged into "blocks submit when step validation fails" (identical
 *    setup and assertions split across two tests).
 *  - dead mocks purged: updateClass (component never destructures it),
 *    sidebar goToStep buttons / step-1 ruleset buttons / header close
 *    (nothing in this lane clicks them), getTotalSteps/getDisplayNumber
 *    (never imported by the component), calculateTotalPointsSpent
 *    (never destructured), per-step mock components for steps 1-11
 *    (unreachable — currentStep is always the last canonical step here).
 *  - useWizardData mock now supplies every destructured key
 *    (allRacesData / allClassesData were missing); useWizardFeatAbilityChoices
 *    mock supplies the missing handleFeatAbilityModeChange.
 */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharacterCreationWizard from './CharacterCreationWizard.jsx';
import { validateStep, validateFinalFormData, validateAbilityTotals } from '../../config/utils.js';

const mockFormData = {
  name: 'Submission Test',
  race: {},
  class: {},
  abilities: [
    { baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
    { baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
    { baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
    { baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
    { baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
    { baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
  ],
  skillProficiencies: [],
  expertSkills: [],
  languages: [],
  resistances: [],
  immunities: [],
  spells: [],
  feats: [],
  inventory: { backpack: [], equipped: [] },
  rules: '5e',
};

// Stable identities so the wizard's real effects (duplicate-name guard,
// inventory sync) never see churn from re-created mock objects.
const mockErrors = {};
const mockSetFormData = vi.fn();
const mockSetErrors = vi.fn();
const mockUpdateField = vi.fn();
const mockUpdateArrayField = vi.fn();
const mockUpdateAbility = vi.fn();
const mockUpdateInventory = vi.fn();
const mockResetErrors = vi.fn();

// Submit lives on the last canonical step (12); nav is a fixed fixture —
// navigation itself belongs to the integration / navigation-hook lanes.
const navState = {
  currentStep: 12,
  isNextDisabled: false,
  navigateNext: () => Promise.resolve(true),
  navigatePrevious: () => {},
  goToStep: () => {},
  getStepEnabled: () => true,
  isSaveEnabled: true,
};

vi.mock('../../hooks/wizard/useWizardForm.js', () => ({
  default: vi.fn(() => ({
    formData: mockFormData,
    errors: mockErrors,
    setFormData: mockSetFormData,
    setErrors: mockSetErrors,
    updateField: mockUpdateField,
    updateArrayField: mockUpdateArrayField,
    updateAbility: mockUpdateAbility,
    updateInventory: mockUpdateInventory,
    resetErrors: mockResetErrors,
  })),
}));

vi.mock('../../hooks/wizard/useWizardData.js', () => ({
  default: vi.fn(() => ({
    backgrounds: [],
    racesData: [],
    allRacesData: [],
    classSubtypes: [],
    allClassesData: [],
    feats: [],
    magicItems: [],
  })),
}));

vi.mock('../../hooks/wizard/useWizardNavigation.js', () => ({
  default: vi.fn(() => navState),
}));

vi.mock('../../hooks/wizard/useWizardSkills.js', () => ({
  default: vi.fn(() => ({
    skillLimits: null,
    expertiseLimits: null,
    skillWarnings: [],
    preSelectedSkills: [],
  })),
}));

vi.mock('../../hooks/wizard/useWizardLanguages.js', () => ({
  default: vi.fn(() => ({
    languageLimits: null,
    fightingStyleLimits: null,
    languageWarnings: [],
    preSelectedLanguages: [],
    preSelectedFightingStyles: [],
  })),
}));

vi.mock('../../hooks/wizard/useWizardResistances.js', () => ({
  default: vi.fn(() => ({
    resistanceWarnings: [],
    preSelectedResistancesList: { resistances: [], immunities: [] },
  })),
}));

vi.mock('../../hooks/wizard/useWizardFeats.js', () => ({
  default: vi.fn(() => ({ preSelectedFeats: [] })),
}));

vi.mock('../../hooks/wizard/useWizardFeatBuffs.js', () => ({
  default: vi.fn(() => ({ computedBuffs: {} })),
}));

vi.mock('../../hooks/wizard/useWizardSpells.js', () => ({
  default: vi.fn(() => ({ preSelectedSpells: [] })),
}));

vi.mock('../../hooks/wizard/useWizardBackgroundAbility.js', () => ({
  default: vi.fn(() => ({
    backgroundAbilityNames: [],
    backgroundAbilityAssignments: {},
    updateBackgroundIncrease: vi.fn(),
    backgroundValidationWarnings: [],
  })),
}));

vi.mock('../../hooks/wizard/useWizardAbilities.js', () => ({
  default: vi.fn(() => ({
    onAbilityBaseScoreChange: vi.fn(),
    onAbilityMiscIncreaseChange: vi.fn(),
  })),
}));

vi.mock('../../hooks/wizard/useWizardArrayToggle.js', () => ({
  default: vi.fn(() => ({
    toggleItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  })),
}));

vi.mock('../../hooks/wizard/useWizardFeatAbilityChoices.js', () => ({
  default: vi.fn(() => ({
    featAbilityChoices: [],
    featAbilityAssignments: {},
    handleFeatAbilityChoice: vi.fn(),
    handleFeatAbilityModeChange: vi.fn(),
  })),
}));

vi.mock('./WizardHeader.jsx', () => ({
  default: function WizardHeaderMock({ title }) {
    return <h2>{title}</h2>;
  },
}));

vi.mock('./WizardProgressBar.jsx', () => ({
  default: () => null,
}));

// Submit button oracle for this lane; labels themselves are owned by
// WizardFooter.test.jsx.
vi.mock('./WizardFooter.jsx', () => ({
  default: function WizardFooterMock({ isFirstStep, isLastStep, onCancel, onPrevious, onNext, onSubmit, isNextDisabled, isEditing }) {
    return (
      <div data-testid="wizard-footer">
        <button className="btn btn-secondary" onClick={isFirstStep ? onCancel : onPrevious} disabled={isFirstStep}>
          {isFirstStep ? 'Cancel' : 'Previous'}
        </button>
        {isLastStep ? (
          <button className="btn btn-success" onClick={onSubmit}>
            {isEditing ? 'Save Changes' : 'Create Character'}
          </button>
        ) : (
          <button className="btn btn-primary" onClick={onNext} disabled={isNextDisabled}>
            Next
          </button>
        )}
      </div>
    );
  },
}));

// isSaveEnabled span is the cap-gate prop oracle for the FT-001 test.
vi.mock('./WizardSidebar.jsx', () => ({
  default: function WizardSidebarMock({ isSaveEnabled }) {
    return (
      <div data-testid="wizard-sidebar">
        <span data-testid="sidebar-save-enabled">{isSaveEnabled ? 'true' : 'false'}</span>
      </div>
    );
  },
}));

vi.mock('../../config/steps-config.js', () => {
  const Placeholder = () => <div data-testid="wizard-step-placeholder" />;
  const mockSteps = Array.from({ length: 12 }, (_, i) => ({
    step: i + 1,
    title: `Step ${i + 1}`,
    component: Placeholder,
    getProps: () => ({}),
  }));

  const mockGetVisibleSteps = ({ isEditing = false, ruleset } = {}) =>
    mockSteps
      .filter((s) => !(isEditing && s.step === 1) && !(ruleset !== '2024' && s.step === 5))
      .map((s, i) => ({ ...s, displayNumber: i + 1 }));

  return {
    WIZARD_STEPS: mockSteps,
    getVisibleSteps: vi.fn(mockGetVisibleSteps),
  };
});

vi.mock('../../config/utils.js', () => ({
  validateStep: vi.fn(() => Promise.resolve({})),
  validateFinalFormData: vi.fn(() => ({})),
  validateAbilityTotals: vi.fn(() => Promise.resolve({})),
  hasDuplicateCharacterName: vi.fn(() => false),
  DUPLICATE_CHARACTER_NAME_ERROR: 'A character with that name already exists',
  CHARACTER_NAME_REQUIRED_ERROR: 'Character name is required',
}));

describe('CharacterCreationWizard - Submission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    validateStep.mockImplementation(() => Promise.resolve({}));
    validateFinalFormData.mockImplementation(() => ({}));
    validateAbilityTotals.mockImplementation(() => Promise.resolve({}));
  });

  function renderWizard(props = {}) {
    const onComplete = vi.fn();
    const onCancel = vi.fn();
    render(
      <CharacterCreationWizard
        onComplete={onComplete}
        onCancel={onCancel}
        allClasses={[]}
        characterData={{ rules: '5e' }}
        isEditing={false}
        campaignName="test-campaign"
        existingCharacters={[]}
        {...props}
      />
    );
    return { onComplete };
  }

  it('routes create-flow submit through the validation chain and completes with the live form state', async () => {
    const { onComplete } = renderWizard({ existingCharacters: ['Brutus'] });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create Character' }));
    });

    await waitFor(() => expect(onComplete).toHaveBeenCalledWith(mockFormData));
    // Byte-exact wiring #363 cannot spy (its validators are real): submit
    // runs each validator exactly once against the live step, live form
    // state, the character's ruleset, and the campaign name list.
    expect(validateStep).toHaveBeenCalledTimes(1);
    expect(validateStep).toHaveBeenCalledWith(12, mockFormData, { racesData: [], classSubtypes: [], ruleset: '5e', allFeats: [] });
    expect(validateFinalFormData).toHaveBeenCalledTimes(1);
    expect(validateFinalFormData).toHaveBeenCalledWith(mockFormData, ['Brutus']);
    expect(mockSetErrors).not.toHaveBeenCalled();
    expect(mockSetFormData).not.toHaveBeenCalled();
  });

  it('blocks submit when step validation fails: surfaces step errors without running later validators', async () => {
    validateStep.mockImplementation(() => Promise.resolve({ name: 'Name is required' }));
    const { onComplete } = renderWizard();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create Character' }));
    });

    await waitFor(() => {
      expect(mockSetErrors).toHaveBeenCalledWith({ name: 'Name is required' });
    });
    expect(validateFinalFormData).not.toHaveBeenCalled();
    // Only the render-time cap-gate effect may have called it — submit
    // returns before the ability check.
    expect(validateAbilityTotals).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('blocks submit when final validation fails: surfaces final errors before the ability-cap check', async () => {
    validateFinalFormData.mockImplementation(() => ({ name: 'Name collides with an existing character' }));
    const { onComplete } = renderWizard();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create Character' }));
    });

    await waitFor(() => {
      expect(mockSetErrors).toHaveBeenCalledWith({ name: 'Name collides with an existing character' });
    });
    // Only the render-time cap-gate effect may have called it — submit
    // returns before the ability check.
    expect(validateAbilityTotals).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('FT-001: blocks submit and keeps sidebar save disabled when an ability total exceeds the cap', async () => {
    const capErrors = { ability_4_totalScore: 'Wisdom total 21 exceeds the maximum of 20' };
    validateAbilityTotals.mockImplementation(() => Promise.resolve(capErrors));
    const { onComplete } = renderWizard({ characterData: { rules: '2024' } });

    // Cap-gate effect closes the sidebar save gate (isSaveEnabled prop)...
    await waitFor(() => {
      expect(screen.getByTestId('sidebar-save-enabled')).toHaveTextContent('false');
    });
    // ...and handleSubmit re-checks the cap on click, refusing to complete.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create Character' }));
    });

    await waitFor(() => {
      expect(mockSetErrors).toHaveBeenCalledWith(capErrors);
    });
    expect(onComplete).not.toHaveBeenCalled();
  });
});
