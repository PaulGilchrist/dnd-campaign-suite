// @cleaned-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharacterCreationWizard from './CharacterCreationWizard.jsx';
import { validateStep, validateFinalFormData } from '../../config/utils.js';
import useWizardNavigation from '../../hooks/wizard/useWizardNavigation.js';

const mockFormData = {
  name: '',
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

const mockErrors = {};
const mockSetFormData = vi.fn();
const mockSetErrors = vi.fn();
const mockUpdateField = vi.fn();
const mockUpdateArrayField = vi.fn();
const mockUpdateAbility = vi.fn();
const mockUpdateInventory = vi.fn();
const mockUpdateClass = vi.fn();
const mockResetErrors = vi.fn();

const mockGoToStep = vi.fn();
const mockNavigateNext = vi.fn();
const mockNavigatePrevious = vi.fn();
const mockGetStepEnabled = vi.fn(() => true);

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
    updateClass: mockUpdateClass,
    resetErrors: mockResetErrors,
  })),
}));

vi.mock('../../hooks/wizard/useWizardData.js', () => ({
  default: vi.fn(() => ({
    backgrounds: [],
    racesData: [],
    classSubtypes: [],
    feats: [],
    magicItems: [],
    isDataLoading: false,
  })),
}));

vi.mock('../../hooks/wizard/useWizardNavigation.js', () => ({
  default: vi.fn(() => ({
    currentStep: 1,
    isNextDisabled: false,
    navigateNext: mockNavigateNext,
    navigatePrevious: mockNavigatePrevious,
    goToStep: mockGoToStep,
    getStepEnabled: mockGetStepEnabled,
    isSaveEnabled: true,
  })),
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
  default: vi.fn(() => ({
    preSelectedFeats: [],
  })),
}));

vi.mock('../../hooks/wizard/useWizardFeatBuffs.js', () => ({
  default: vi.fn(() => ({
    computedBuffs: {},
  })),
}));

vi.mock('../../hooks/wizard/useWizardSpells.js', () => ({
  default: vi.fn(() => ({
    preSelectedSpells: [],
  })),
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
    calculateTotalPointsSpent: vi.fn(),
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
  })),
}));

vi.mock('./WizardHeader.jsx', () => ({
  default: function WizardHeaderMock({ title, onClose }) {
    return (
      <div data-testid="wizard-header">
        <h2>{title}</h2>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>
    );
  },
}));

vi.mock('./WizardProgressBar.jsx', () => ({
  default: function WizardProgressBarMock({ currentStep, totalSteps, isEditing }) {
    return (
      <div data-testid="wizard-progress-bar">
        <span>Step {currentStep} of {totalSteps}</span>
        <span data-testid="is-editing-flag">{isEditing ? 'true' : 'false'}</span>
      </div>
    );
  },
}));

vi.mock('./WizardFooter.jsx', () => ({
  default: function WizardFooterMock({ isFirstStep, isLastStep, onCancel, onPrevious, onNext, onSubmit, isNextDisabled, isEditing }) {
    return (
      <div data-testid="wizard-footer">
        <button
          className="btn btn-secondary"
          onClick={isFirstStep ? onCancel : onPrevious}
          disabled={isFirstStep}
        >
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

vi.mock('./WizardSidebar.jsx', () => ({
  default: function WizardSidebarMock({ currentStep, goToStep, isSaveEnabled }) {
    return (
      <div data-testid="wizard-sidebar">
        <span data-testid="sidebar-step">{currentStep}</span>
        <span data-testid="sidebar-save-enabled">{isSaveEnabled ? 'true' : 'false'}</span>
        <button onClick={() => goToStep(1)}>Go Step 1</button>
        <button onClick={() => goToStep(6)}>Go Step 6</button>
      </div>
    );
  },
}));

vi.mock('../../config/steps-config.js', () => {
  const StepComponent = ({
    onRulesetChange,
    onTempInventoryChange,
    tempInventory,
  }) => (
    <div data-testid="step-ruleset">
      <button onClick={() => onRulesetChange('2024')}>Change Ruleset</button>
      <button onClick={() => onRulesetChange('5e')}>Ruleset 5e</button>
      <button onClick={() => onTempInventoryChange?.('backpack', ['Sword'])}>Update Inventory</button>
      <span data-testid="temp-inventory-count">{tempInventory?.backpack?.length ?? 0}</span>
    </div>
  );
  StepComponent.displayName = 'StepComponent';

  return {
    WIZARD_STEPS: [
      { step: 1, title: 'Ruleset', component: StepComponent, getProps: (props) => props },
      { step: 2, title: 'Basic Information', component: () => <div data-testid="step-basic">Basic Step</div>, getProps: () => ({}) },
      { step: 3, title: 'Race & Class', component: () => <div data-testid="step-race-class">Race & Class Step</div>, getProps: () => ({}) },
      { step: 4, title: 'Feats', component: () => <div data-testid="step-feats">Feats Step</div>, getProps: () => ({}) },
      { step: 5, title: 'Ability Scores', component: () => <div data-testid="step-abilities">Abilities Step</div>, getProps: () => ({}) },
      { step: 6, title: 'Skill Proficiencies', component: () => <div data-testid="step-skills">Skills Step</div>, getProps: () => ({}) },
      { step: 7, title: 'Languages & Fighting Styles', component: () => <div data-testid="step-languages">Languages Step</div>, getProps: () => ({}) },
      { step: 8, title: 'Resistances & Immunities', component: () => <div data-testid="step-resistances">Resistances Step</div>, getProps: () => ({}) },
      { step: 9, title: 'Spells', component: () => <div data-testid="step-spells">Spells Step</div>, getProps: () => ({}) },
      { step: 10, title: 'Magic Items', component: () => <div data-testid="step-magic-items">Magic Items Step</div>, getProps: () => ({}) },
      { step: 11, title: 'Inventory', component: () => <div data-testid="step-inventory">Inventory Step</div>, getProps: () => ({}) },
      { step: 12, title: 'Special Actions', component: () => <div data-testid="step-special">Special Step</div>, getProps: () => ({}) },
    ],
    getTotalSteps: vi.fn(() => 12),
  };
});

vi.mock('../../config/utils.js', () => ({
  validateStep: vi.fn(() => Promise.resolve({})),
  validateFinalFormData: vi.fn(() => ({})),
}));

describe('CharacterCreationWizard - Submission', () => {
  const mockOnComplete = vi.fn();
  const mockOnCancel = vi.fn();

  const defaultProps = {
    onComplete: mockOnComplete,
    onCancel: mockOnCancel,
    allClasses: [],
    allSpells: [],
    characterData: null,
    isEditing: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGoToStep.mockReset();
    mockNavigateNext.mockReset();
    mockNavigatePrevious.mockReset();
    mockGetStepEnabled.mockReset();
    mockGetStepEnabled.mockImplementation(() => true);
    useWizardNavigation.mockImplementation(() => ({
      currentStep: 1,
      isNextDisabled: false,
      navigateNext: mockNavigateNext,
      navigatePrevious: mockNavigatePrevious,
      goToStep: mockGoToStep,
      getStepEnabled: mockGetStepEnabled,
      isSaveEnabled: true,
    }));
    validateStep.mockImplementation(() => Promise.resolve({}));
    validateFinalFormData.mockImplementation(() => ({}));
  });

  it('calls onComplete with formData when all validations pass', async () => {
    useWizardNavigation.mockImplementation(() => ({
      currentStep: 12,
      isNextDisabled: false,
      navigateNext: mockNavigateNext,
      navigatePrevious: mockNavigatePrevious,
      goToStep: mockGoToStep,
      getStepEnabled: mockGetStepEnabled,
      isSaveEnabled: true,
    }));

    const localOnComplete = vi.fn();
    render(<CharacterCreationWizard {...defaultProps} onComplete={localOnComplete} characterData={{ rules: '5e' }} />);

    await act(async () => {
      fireEvent.click(screen.getByText('Create Character'));
    });

    await waitFor(() => {
      expect(localOnComplete).toHaveBeenCalledWith(mockFormData);
    });
  });

  it('calls onComplete with formData when all validations pass (2024 ruleset)', async () => {
    useWizardNavigation.mockImplementation(() => ({
      currentStep: 12,
      isNextDisabled: false,
      navigateNext: mockNavigateNext,
      navigatePrevious: mockNavigatePrevious,
      goToStep: mockGoToStep,
      getStepEnabled: mockGetStepEnabled,
      isSaveEnabled: true,
    }));

    const localOnComplete = vi.fn();
    render(<CharacterCreationWizard {...defaultProps} onComplete={localOnComplete} characterData={{ rules: '2024' }} />);

    await act(async () => {
      fireEvent.click(screen.getByText('Create Character'));
    });

    await waitFor(() => {
      expect(localOnComplete).toHaveBeenCalledWith(mockFormData);
      expect(validateStep).toHaveBeenCalledWith(12, mockFormData, {}, [], [], '2024');
    });
  });

  it('sets step errors and does not call onComplete when step validation fails', async () => {
    validateStep.mockImplementation(() => Promise.resolve({ name: 'Name is required' }));
    useWizardNavigation.mockImplementation(() => ({
      currentStep: 12,
      isNextDisabled: false,
      navigateNext: mockNavigateNext,
      navigatePrevious: mockNavigatePrevious,
      goToStep: mockGoToStep,
      getStepEnabled: mockGetStepEnabled,
      isSaveEnabled: true,
    }));

    const localOnComplete = vi.fn();
    render(<CharacterCreationWizard {...defaultProps} onComplete={localOnComplete} characterData={{ rules: '5e' }} />);

    await act(async () => {
      fireEvent.click(screen.getByText('Create Character'));
    });

    await waitFor(() => {
      expect(mockSetErrors).toHaveBeenCalledWith({ name: 'Name is required' });
      expect(localOnComplete).not.toHaveBeenCalled();
    });
  });

  it('sets final validation errors and does not call onComplete when final validation fails', async () => {
    validateStep.mockImplementation(() => Promise.resolve({}));
    validateFinalFormData.mockImplementation(() => ({ name: 'Name is required' }));
    useWizardNavigation.mockImplementation(() => ({
      currentStep: 12,
      isNextDisabled: false,
      navigateNext: mockNavigateNext,
      navigatePrevious: mockNavigatePrevious,
      goToStep: mockGoToStep,
      getStepEnabled: mockGetStepEnabled,
      isSaveEnabled: true,
    }));

    const localOnComplete = vi.fn();
    render(<CharacterCreationWizard {...defaultProps} onComplete={localOnComplete} characterData={{ rules: '5e' }} />);

    await act(async () => {
      fireEvent.click(screen.getByText('Create Character'));
    });

    await waitFor(() => {
      expect(mockSetErrors).toHaveBeenCalledWith({ name: 'Name is required' });
      expect(localOnComplete).not.toHaveBeenCalled();
    });
  });
});
