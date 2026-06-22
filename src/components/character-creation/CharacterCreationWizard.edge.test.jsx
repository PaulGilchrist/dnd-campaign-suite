// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharacterCreationWizard from './CharacterCreationWizard.jsx';
import useWizardNavigation from '../../hooks/wizard/useWizardNavigation.js';
import { validateStep, validateFinalFormData } from '../../config/utils.js';

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
  const ExpertiseToggleStep = ({ onSkillExpertiseToggle }) => (
    <div data-testid="step-expertise">
      <button onClick={() => onSkillExpertiseToggle('Athletics', true)}>Expert Athletics</button>
      <button onClick={() => onSkillExpertiseToggle('Stealth', false)}>Not Expert Stealth</button>
    </div>
  );
  ExpertiseToggleStep.displayName = 'ExpertiseToggleStep';

  return {
    WIZARD_STEPS: [
      { step: 1, title: 'Ruleset', component: () => <div data-testid="step-ruleset">Ruleset</div>, getProps: () => ({}) },
      { step: 2, title: 'Basic Information', component: () => <div data-testid="step-basic">Basic</div>, getProps: () => ({}) },
      { step: 3, title: 'Expertise', component: ExpertiseToggleStep, getProps: (props) => ({ onSkillExpertiseToggle: props.onSkillExpertiseToggle }) },
    ],
    getTotalSteps: vi.fn(() => 3),
  };
});

vi.mock('../../config/utils.js', () => ({
  validateStep: vi.fn(() => Promise.resolve({})),
  validateFinalFormData: vi.fn(() => ({})),
}));

describe('CharacterCreationWizard - Edge cases', () => {
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

  it('renders nothing in the content area when stepConfig is not found', () => {
    useWizardNavigation.mockImplementation(() => ({
      currentStep: 99,
      isNextDisabled: false,
      navigateNext: mockNavigateNext,
      navigatePrevious: mockNavigatePrevious,
      goToStep: mockGoToStep,
      getStepEnabled: mockGetStepEnabled,
      isSaveEnabled: true,
    }));
    const { container } = render(<CharacterCreationWizard {...defaultProps} />);
    const contentArea = container.querySelector('.wizard-content');
    expect(contentArea).toBeInTheDocument();
    expect(contentArea.children.length).toBe(0);
  });

  it('renders the ruleset step when step 1 is configured', () => {
    render(<CharacterCreationWizard {...defaultProps} />);
    expect(screen.getByTestId('step-ruleset')).toBeInTheDocument();
  });

  it('renders the basic step when step 2 is configured', () => {
    useWizardNavigation.mockImplementation(() => ({
      currentStep: 2,
      isNextDisabled: false,
      navigateNext: mockNavigateNext,
      navigatePrevious: mockNavigatePrevious,
      goToStep: mockGoToStep,
      getStepEnabled: mockGetStepEnabled,
      isSaveEnabled: true,
    }));
    render(<CharacterCreationWizard {...defaultProps} />);
    expect(screen.getByTestId('step-basic')).toBeInTheDocument();
  });

  it('calls addExpertSkill when onSkillExpertiseToggle is called with isExpert=true', () => {
    useWizardNavigation.mockImplementation(() => ({
      currentStep: 3,
      isNextDisabled: false,
      navigateNext: mockNavigateNext,
      navigatePrevious: mockNavigatePrevious,
      goToStep: mockGoToStep,
      getStepEnabled: mockGetStepEnabled,
      isSaveEnabled: true,
    }));
    render(<CharacterCreationWizard {...defaultProps} />);
    expect(screen.getByTestId('step-expertise')).toBeInTheDocument();
    const expertBtn = screen.getByText('Expert Athletics');
    fireEvent.click(expertBtn);
  });

  it('calls removeExpertSkill when onSkillExpertiseToggle is called with isExpert=false', () => {
    useWizardNavigation.mockImplementation(() => ({
      currentStep: 3,
      isNextDisabled: false,
      navigateNext: mockNavigateNext,
      navigatePrevious: mockNavigatePrevious,
      goToStep: mockGoToStep,
      getStepEnabled: mockGetStepEnabled,
      isSaveEnabled: true,
    }));
    render(<CharacterCreationWizard {...defaultProps} />);
    expect(screen.getByTestId('step-expertise')).toBeInTheDocument();
    const notExpertBtn = screen.getByText('Not Expert Stealth');
    fireEvent.click(notExpertBtn);
  });
});
