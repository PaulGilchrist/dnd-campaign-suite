// @maintained-by-ai 2026-11-28
/**
 * Submission lane for CharacterCreationWizard — isolates the handleSubmit
 * boundary (CharacterCreationWizard.jsx handleSubmit) by mocking every hook,
 * validator and chrome. Pins what the integration lane (#2048, real
 * validators) cannot see: submit-chain ordering, byte-exact validator-call
 * args, and the four early-return branches (step / final / ability-cap /
 * selection-cap re-check).
 *
 * Owned elsewhere (do not restate here):
 *  - edit-flow onComplete byte-exact payload with real validators
 *    -> CharacterCreationWizard.integration.test.jsx
 *  - loaded over-cap feats/skills disabling the sidebar + footer Save with
 *    REAL validators -> CharacterCreationWizard.over-cap-save-gate.test.jsx
 *  - footer button labels / disabled states -> WizardFooter.test.jsx
 *  - per-step field behavior -> WizardStep*.test.jsx
 *  - validator business logic -> src/config/utils*.test.js
 *
 * There is no create-vs-edit API dispatch, no fetch POST assembly, and no
 * double-submit guard in the source — submit runs the same
 * validateStep -> validateFinalFormData -> validateAbilityTotals ->
 * validateSelectionCaps chain and calls onComplete(formData) in both modes —
 * so nothing is pinned for those.
 *
 * Trim log vs previous revision:
 *  - the three refusal tests (step-fail, final-fail, FT-001 submit-recheck)
 *    consolidated into one parameterized walk over all four branch failures
 *    — identical harness shape (fail one validator, click submit, assert the
 *    surfaced errors + which later validators submit never reached). This
 *    also adds the previously-uncovered selection-cap re-check branch
 *    (handleSubmit's defense-in-depth against the shipped over-cap FT-002
 *    bug: the gate can be open per navigation hook yet submit must still
 *    refuse an over-cap build).
 *  - FT-001 trimmed to its unique face: the mount-time ability-cap audit
 *    closing the sidebar Save gate (saveGateEnabled wiring). Its submit
 *    refusal half now lives in the parameterized walk.
 *  - happy-chain test extended to pin all four validator args + the chain
 *    ordering (previously pinned only validateStep/validateFinalFormData).
 *  - beforeEach now restores the validateSelectionCaps default too — it was
 *    the one mock a test could permanently override.
 */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharacterCreationWizard from './CharacterCreationWizard.jsx';
import { validateStep, validateFinalFormData, validateAbilityTotals, validateSelectionCaps } from '../../config/utils.js';

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

// saveGateEnabled oracle for the ability-cap audit test.
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

  const mockGetVisibleSteps = ({ ruleset } = {}) =>
    mockSteps
      .filter((s) => !(ruleset !== '2024' && s.step === 5))
      .map((s, i) => ({ ...s, displayNumber: i + 1 }));

  return {
    WIZARD_STEPS: mockSteps,
    getVisibleSteps: vi.fn(mockGetVisibleSteps),
    // Save-cause sentence oracle: this file asserts the gate BOOLEAN via the
    // sidebar mock's isSaveEnabled span, never the title, so the helper is
    // stubbed inert (titleless like an unblocked Save).
    getSaveCauseTitle: vi.fn(() => undefined),
  };
});

vi.mock('../../config/utils.js', () => ({
  validateStep: vi.fn(() => Promise.resolve({})),
  validateFinalFormData: vi.fn(() => ({})),
  validateAbilityTotals: vi.fn(() => Promise.resolve({})),
  validateSelectionCaps: vi.fn(() => Promise.resolve({})),
  hasDuplicateCharacterName: vi.fn(() => false),
  DUPLICATE_CHARACTER_NAME_ERROR: 'A character with that name already exists',
  CHARACTER_NAME_REQUIRED_ERROR: 'Character name is required',
}));

// One branch failure per handleSubmit gate. `maxCalls` pins which later
// validators submit must NOT reach: 0 = never called at all; 1 = only the
// component's mount-time cap audit ran, never a submit-path call (ability
// and selection validators each get exactly one mount audit from the static
// fixture, so a second call would prove submit reached them).
const REFUSAL_BRANCHES = [
  {
    label: 'step',
    fail: () => validateStep.mockImplementation(() => Promise.resolve({ name: 'Name is required' })),
    errors: { name: 'Name is required' },
    maxCalls: [[validateFinalFormData, 0], [validateAbilityTotals, 1], [validateSelectionCaps, 1]],
  },
  {
    label: 'final',
    fail: () => validateFinalFormData.mockImplementation(() => ({ name: 'Name collides with an existing character' })),
    errors: { name: 'Name collides with an existing character' },
    maxCalls: [[validateAbilityTotals, 1], [validateSelectionCaps, 1]],
  },
  {
    label: 'ability-cap',
    fail: () => validateAbilityTotals.mockImplementation(() => Promise.resolve({ ability_4_totalScore: 'Wisdom total 21 exceeds the maximum of 20' })),
    errors: { ability_4_totalScore: 'Wisdom total 21 exceeds the maximum of 20' },
    maxCalls: [[validateSelectionCaps, 1]],
  },
  {
    label: 'selection-cap',
    fail: () => validateSelectionCaps.mockImplementation(() => Promise.resolve({ feats: 'You have selected 1 of 0 allowed feat(s)' })),
    errors: { feats: 'You have selected 1 of 0 allowed feat(s)' },
    maxCalls: [],
  },
];

describe('CharacterCreationWizard - Submission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    validateStep.mockImplementation(() => Promise.resolve({}));
    validateFinalFormData.mockImplementation(() => ({}));
    validateAbilityTotals.mockImplementation(() => Promise.resolve({}));
    validateSelectionCaps.mockImplementation(() => Promise.resolve({}));
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

  const submit = async () => {
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create Character' }));
    });
  };

  it('routes create-flow submit through the full validation chain and completes with the live form state', async () => {
    const { onComplete } = renderWizard({ existingCharacters: ['Brutus'] });

    await submit();

    await waitFor(() => expect(onComplete).toHaveBeenCalledWith(mockFormData));
    // Byte-exact wiring the integration lane cannot spy (its validators are
    // real): submit runs each validator against the live step, live form
    // state, the character's ruleset, and the campaign name list — and the
    // two cap validators are re-checked with the audit args.
    expect(validateStep).toHaveBeenCalledTimes(1);
    expect(validateStep).toHaveBeenCalledWith(12, mockFormData, { racesData: [], classSubtypes: [], ruleset: '5e', allFeats: [] });
    expect(validateFinalFormData).toHaveBeenCalledTimes(1);
    expect(validateFinalFormData).toHaveBeenCalledWith(mockFormData, ['Brutus']);
    expect(validateAbilityTotals).toHaveBeenLastCalledWith(mockFormData, { allFeats: [], racesData: [], ruleset: '5e' });
    expect(validateSelectionCaps).toHaveBeenLastCalledWith(mockFormData, { allFeats: [] });
    // Chain ordering: each stage completes before the next runs, and
    // onComplete fires only after the last validator.
    const lastOrder = (m) => m.mock.invocationCallOrder[m.mock.invocationCallOrder.length - 1];
    expect(lastOrder(validateStep)).toBeLessThan(lastOrder(validateFinalFormData));
    expect(lastOrder(validateFinalFormData)).toBeLessThan(lastOrder(validateAbilityTotals));
    expect(lastOrder(validateAbilityTotals)).toBeLessThan(lastOrder(validateSelectionCaps));
    expect(lastOrder(validateSelectionCaps)).toBeLessThan(lastOrder(onComplete));
    // A clean submit mutates no form state on the way out.
    expect(mockSetErrors).not.toHaveBeenCalled();
    expect(mockSetFormData).not.toHaveBeenCalled();
  });

  it.each(REFUSAL_BRANCHES)(
    'refuses submit when the $label validator reports errors: surfaces them, skips later validators, never completes',
    async ({ fail, errors, maxCalls }) => {
      fail();
      const { onComplete } = renderWizard();

      await submit();

      await waitFor(() => expect(mockSetErrors).toHaveBeenCalledWith(errors));
      for (const [validator, max] of maxCalls) {
        expect(validator).toHaveBeenCalledTimes(max);
      }
      expect(onComplete).not.toHaveBeenCalled();
    }
  );

  it('mount-time ability-cap audit closes the sidebar Save gate (FT-001)', async () => {
    validateAbilityTotals.mockImplementation(() =>
      Promise.resolve({ ability_4_totalScore: 'Wisdom total 21 exceeds the maximum of 20' })
    );
    renderWizard();

    // The wizard's real saveGateEnabled = isSaveEnabled && abilitiesWithinCap
    // && selectionsWithinCap: an over-cap audit must flip the sidebar off
    // without any submit click.
    await waitFor(() => {
      expect(screen.getByTestId('sidebar-save-enabled')).toHaveTextContent('false');
    });
  });
});
