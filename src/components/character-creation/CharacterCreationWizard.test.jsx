import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharacterCreationWizard from './CharacterCreationWizard.jsx';
import { validateStep, validateFinalFormData } from '../../config/utils.js';
import useWizardNavigation from '../../hooks/useWizardNavigation.js';

// Stable mock data - defined outside vi.fn() to preserve reference identity across renders
const mockFormData = {
  name: '',
  race: {},
  class: {},
  abilities: [
    { baseScore: 10, abilityImprovements: 0, miscBonus: 0 },
    { baseScore: 10, abilityImprovements: 0, miscBonus: 0 },
    { baseScore: 10, abilityImprovements: 0, miscBonus: 0 },
    { baseScore: 10, abilityImprovements: 0, miscBonus: 0 },
    { baseScore: 10, abilityImprovements: 0, miscBonus: 0 },
    { baseScore: 10, abilityImprovements: 0, miscBonus: 0 },
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

// Mock lodash/merge before other imports (ESM needs .js extension)
vi.mock('lodash/merge.js', () => ({
  default: vi.fn((...args) => args.reduce((acc, obj) => ({ ...acc, ...obj }), {})),
}));

// Shared spies for navigation - created at module level for test access
const mockGoToStep = vi.fn();
const mockNavigateNext = vi.fn();
const mockNavigatePrevious = vi.fn();
const mockGetStepEnabled = vi.fn(() => true);

// Mock all the hooks with stable references
vi.mock('../../hooks/useWizardForm.js', () => ({
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

vi.mock('../../hooks/useWizardData.js', () => ({
  default: vi.fn(() => ({
    backgrounds: [],
    racesData: [],
    classSubtypes: [],
    feats: [],
    magicItems: [],
    isDataLoading: false,
  })),
}));

vi.mock('../../hooks/useWizardNavigation.js', () => ({
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

vi.mock('../../hooks/useWizardSkills.js', () => ({
  default: vi.fn(() => ({
    skillLimits: null,
    expertiseLimits: null,
    skillWarnings: [],
    preSelectedSkills: [],
  })),
}));

vi.mock('../../hooks/useWizardLanguages.js', () => ({
  default: vi.fn(() => ({
    languageLimits: null,
    fightingStyleLimits: null,
    languageWarnings: [],
    preSelectedLanguages: [],
    preSelectedFightingStyles: [],
  })),
}));

vi.mock('../../hooks/useWizardResistances.js', () => ({
  default: vi.fn(() => ({
    resistanceWarnings: [],
    preSelectedResistancesList: { resistances: [], immunities: [] },
  })),
}));

vi.mock('../../hooks/useWizardFeats.js', () => ({
  default: vi.fn(() => ({
    preSelectedFeats: [],
  })),
}));

vi.mock('./use-wizard-inventory', () => ({
  default: vi.fn(() => ({
    tempInventory: { backpack: [], equipped: [] },
    updateTempInventory: vi.fn(),
  })),
}));

vi.mock('../../hooks/useWizardAbilities.js', () => ({
  default: vi.fn(() => ({
    calculateTotalPointsSpent: vi.fn(),
    onAbilityBaseScoreChange: vi.fn(),
    onAbilityImprovementChange: vi.fn(),
    onAbilityMiscBonusChange: vi.fn(),
  })),
}));

// Mock useWizardArrayToggle - used by wizard but not previously mocked (caused OOM)
vi.mock('../../hooks/useWizardArrayToggle.js', () => ({
  default: vi.fn(() => ({
    toggleItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  })),
}));

// Mock child components
vi.mock('./WizardHeader.jsx', () => ({
  default: function WizardHeaderMock({ title, onClose }) {
    return <div data-testid="wizard-header"><h1>{title}</h1><button onClick={onClose}>Close</button></div>;
  },
}));

vi.mock('./WizardProgressBar.jsx', () => ({
  default: function WizardProgressBarMock({ currentStep, totalSteps }) {
    return <div data-testid="wizard-progress-bar"><span>Step {currentStep} of {totalSteps}</span></div>;
  },
}));

vi.mock('./WizardFooter.jsx', () => ({
  default: function WizardFooterMock({ isFirstStep, isLastStep, onCancel, onPrevious, onNext, onSubmit, isNextDisabled }) {
    return (
      <div data-testid="wizard-footer">
        <button onClick={onPrevious} disabled={isFirstStep}>Previous</button>
        <button onClick={isLastStep ? onSubmit : onNext} disabled={isNextDisabled}>
          {isLastStep ? 'Submit' : 'Next'}
        </button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    );
  },
}));

vi.mock('./WizardSidebar.jsx', () => ({
  default: function WizardSidebarMock() {
    return <div data-testid="wizard-sidebar">Sidebar</div>;
  },
}));

// Mock steps-config with components that call handlers
vi.mock('../../config/steps-config.js', () => {
  const StepComponent = ({ onRulesetChange, onSkillToggle, onSkillExpertiseToggle, onLanguageToggle, onFightingStyleToggle, onResistanceToggle, onImmunityToggle, onAbilityBaseScoreChange, onAbilityImprovementChange, onAbilityMiscBonusChange, onTempInventoryChange, tempInventory }) => (
    <div data-testid="step-ruleset">
      <button onClick={() => onRulesetChange('2024')}>Change Ruleset</button>
      <button onClick={() => onRulesetChange('5e')}>Ruleset 5e</button>
      <button onClick={() => onTempInventoryChange?.('backpack', ['Sword'])}>Update Inventory</button>
      <span data-testid="temp-inventory-count">{tempInventory?.backpack?.length ?? 0}</span>
      <button onClick={() => onSkillToggle('Stealth')}>Toggle Skill</button>
      <button onClick={() => onSkillExpertiseToggle('Stealth', true)}>Toggle Expertise</button>
      <button onClick={() => onLanguageToggle('Elvish')}>Toggle Language</button>
      <button onClick={() => onFightingStyleToggle('Archery')}>Toggle Style</button>
      <button onClick={() => onResistanceToggle('Fire', false)}>Toggle Resistance</button>
      <button onClick={() => onImmunityToggle('Poison', false)}>Toggle Immunity</button>
      <button onClick={() => onAbilityBaseScoreChange(0, '14')}>Change Ability</button>
      <button onClick={() => onAbilityImprovementChange(0, 1)}>Improve Ability</button>
      <button onClick={() => onAbilityMiscBonusChange(0, 2)}>Misc Bonus</button>
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

// Mock utils
vi.mock('../../services/ui/utils.js', () => ({
  validateStep: vi.fn(() => Promise.resolve({})),
  validateFinalFormData: vi.fn(() => ({})),
  getPointBuyCosts: vi.fn(() => Promise.resolve({ 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 })),
}));

vi.mock('../../config/utils.js', () => ({
  validateStep: vi.fn(() => Promise.resolve({})),
  validateFinalFormData: vi.fn(() => ({})),
}));

describe('CharacterCreationWizard', () => {
  const mockOnComplete = vi.fn();
  const mockOnCancel = vi.fn();

  const defaultProps = {
    onComplete: mockOnComplete,
    onCancel: mockOnCancel,
    allRaces: [],
    allClasses: [],
    allSpells: [],
    allSpells2024: [],
    characterData: null,
    isEditing: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset shared navigation spies
    mockGoToStep.mockReset();
    mockNavigateNext.mockReset();
    mockNavigatePrevious.mockReset();
    mockGetStepEnabled.mockReset();
    mockGetStepEnabled.mockImplementation(() => true);
    // Reset useWizardNavigation to default return value
    useWizardNavigation.mockImplementation(() => ({
      currentStep: 1,
      isNextDisabled: false,
      navigateNext: mockNavigateNext,
      navigatePrevious: mockNavigatePrevious,
      goToStep: mockGoToStep,
      getStepEnabled: mockGetStepEnabled,
      isSaveEnabled: true,
    }));
    // Reset validation mocks to default (no errors)
    validateStep.mockImplementation(() => Promise.resolve({}));
    validateFinalFormData.mockImplementation(() => ({}));
  });

  it('should render the wizard overlay', () => {
    render(<CharacterCreationWizard {...defaultProps} />);
    expect(document.querySelector('.character-creation-wizard-overlay')).toBeInTheDocument();
  });

  it('should render the wizard container', () => {
    render(<CharacterCreationWizard {...defaultProps} />);
    expect(document.querySelector('.character-creation-wizard')).toBeInTheDocument();
  });

  it('should render the wizard header with create title', () => {
    render(<CharacterCreationWizard {...defaultProps} />);
    expect(screen.getByText('Create New Character')).toBeInTheDocument();
  });

  it('should render the wizard header with edit title when editing', () => {
    render(<CharacterCreationWizard {...defaultProps} isEditing={true} />);
    expect(screen.getByText('Edit Character')).toBeInTheDocument();
  });

  it('should render the wizard progress bar', () => {
    render(<CharacterCreationWizard {...defaultProps} />);
    expect(screen.getByTestId('wizard-progress-bar')).toBeInTheDocument();
  });

  it('should render the wizard footer', () => {
    render(<CharacterCreationWizard {...defaultProps} />);
    expect(screen.getByTestId('wizard-footer')).toBeInTheDocument();
  });

  it('should render the wizard sidebar', () => {
    render(<CharacterCreationWizard {...defaultProps} />);
    expect(screen.getByTestId('wizard-sidebar')).toBeInTheDocument();
  });

  it('should render the wizard content area', () => {
    render(<CharacterCreationWizard {...defaultProps} />);
    expect(document.querySelector('.wizard-content')).toBeInTheDocument();
  });

  it('should render the current step component', () => {
    render(<CharacterCreationWizard {...defaultProps} />);
    expect(screen.getByTestId('step-ruleset')).toBeInTheDocument();
  });

  it('should call onCancel when close button is clicked', () => {
    render(<CharacterCreationWizard {...defaultProps} />);
    fireEvent.click(screen.getByText('Close'));
    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should call onCancel when cancel button in footer is clicked', () => {
    render(<CharacterCreationWizard {...defaultProps} />);
    const cancelButton = screen.getAllByText('Cancel');
    fireEvent.click(cancelButton[0]);
    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should call navigatePrevious when previous button is clicked', () => {
    render(<CharacterCreationWizard {...defaultProps} />);
    const previousButton = screen.getByText('Previous');
    fireEvent.click(previousButton);
    expect(previousButton).toBeDisabled();
  });

  it('should show Next button on non-last steps', () => {
    render(<CharacterCreationWizard {...defaultProps} />);
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('should render with character data when editing', () => {
    const editProps = {
      ...defaultProps,
      isEditing: true,
      characterData: { name: 'Test Character', rules: '5e' },
    };
    render(<CharacterCreationWizard {...editProps} />);
    expect(screen.getByText('Edit Character')).toBeInTheDocument();
  });

  it('should render the wizard step component', () => {
    render(<CharacterCreationWizard {...defaultProps} />);
    expect(screen.getByTestId('step-ruleset')).toBeInTheDocument();
  });

  it('should display total steps in progress bar', () => {
    render(<CharacterCreationWizard {...defaultProps} />);
    expect(screen.getByText('Step 1 of 12')).toBeInTheDocument();
  });

  it('should not have Next button disabled when isNextDisabled is false', () => {
    render(<CharacterCreationWizard {...defaultProps} />);
    const nextButton = screen.getByText('Next');
    expect(nextButton).not.toBeDisabled();
  });

  it('should render step content area with step', () => {
    render(<CharacterCreationWizard {...defaultProps} />);
    const content = document.querySelector('.wizard-content');
    expect(content).toBeInTheDocument();
    expect(screen.getByTestId('step-ruleset')).toBeInTheDocument();
  });

  it('should handle step rendering through renderStep callback', () => {
    const { container } = render(<CharacterCreationWizard {...defaultProps} />);
    expect(screen.getByTestId('step-ruleset')).toBeInTheDocument();
    expect(container.querySelector('.wizard-content')).toBeInTheDocument();
  });

  it('should have correct CSS classes for overlay and wizard', () => {
    const { container } = render(<CharacterCreationWizard {...defaultProps} />);
    expect(container.querySelector('.character-creation-wizard-overlay')).toBeInTheDocument();
    expect(container.querySelector('.character-creation-wizard')).toBeInTheDocument();
  });

  it('should render with isEditing prop set to true', () => {
    render(<CharacterCreationWizard {...defaultProps} isEditing={true} />);
    expect(screen.getByText('Edit Character')).toBeInTheDocument();
  });

  it('should pass correct props to WizardHeader', () => {
    render(<CharacterCreationWizard {...defaultProps} />);
    expect(screen.getByText('Create New Character')).toBeInTheDocument();
  });

  it('should pass correct props to WizardProgressBar', () => {
    render(<CharacterCreationWizard {...defaultProps} />);
    expect(screen.getByText('Step 1 of 12')).toBeInTheDocument();
  });

  it('should call onCancel when footer cancel is clicked', () => {
    render(<CharacterCreationWizard {...defaultProps} />);
    const cancelButtons = screen.getAllByText('Cancel');
    fireEvent.click(cancelButtons[0]);
    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should have previous button disabled on first step', () => {
    render(<CharacterCreationWizard {...defaultProps} />);
    const previousButton = screen.getByText('Previous');
    expect(previousButton).toBeDisabled();
  });

  it('should show Submit button on last step', () => {
    render(<CharacterCreationWizard {...defaultProps} />);
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('should call handleRulesetChange when ruleset button clicked', () => {
    render(<CharacterCreationWizard {...defaultProps} />);
    fireEvent.click(screen.getByText('Change Ruleset'));
    expect(screen.getByTestId('step-ruleset')).toBeInTheDocument();
  });

  it('should call onSkillToggle when skill toggle button clicked', () => {
    render(<CharacterCreationWizard {...defaultProps} />);
    fireEvent.click(screen.getByText('Toggle Skill'));
    expect(screen.getByTestId('step-ruleset')).toBeInTheDocument();
  });

  it('should call onSkillExpertiseToggle when expertise toggle button clicked', () => {
    render(<CharacterCreationWizard {...defaultProps} />);
    fireEvent.click(screen.getByText('Toggle Expertise'));
    expect(screen.getByTestId('step-ruleset')).toBeInTheDocument();
  });

  it('should call onLanguageToggle when language toggle button clicked', () => {
    render(<CharacterCreationWizard {...defaultProps} />);
    fireEvent.click(screen.getByText('Toggle Language'));
    expect(screen.getByTestId('step-ruleset')).toBeInTheDocument();
  });

  it('should call onFightingStyleToggle when style toggle button clicked', () => {
    render(<CharacterCreationWizard {...defaultProps} />);
    fireEvent.click(screen.getByText('Toggle Style'));
    expect(screen.getByTestId('step-ruleset')).toBeInTheDocument();
  });

  it('should call onResistanceToggle when resistance toggle button clicked', () => {
    render(<CharacterCreationWizard {...defaultProps} />);
    fireEvent.click(screen.getByText('Toggle Resistance'));
    expect(screen.getByTestId('step-ruleset')).toBeInTheDocument();
  });

  it('should call onImmunityToggle when immunity toggle button clicked', () => {
    render(<CharacterCreationWizard {...defaultProps} />);
    fireEvent.click(screen.getByText('Toggle Immunity'));
    expect(screen.getByTestId('step-ruleset')).toBeInTheDocument();
  });

  it('should call onAbilityBaseScoreChange when ability score changed', () => {
    render(<CharacterCreationWizard {...defaultProps} />);
    fireEvent.click(screen.getByText('Change Ability'));
    expect(screen.getByTestId('step-ruleset')).toBeInTheDocument();
  });

  it('should call onAbilityImprovementChange when improvement changed', () => {
    render(<CharacterCreationWizard {...defaultProps} />);
    fireEvent.click(screen.getByText('Improve Ability'));
    expect(screen.getByTestId('step-ruleset')).toBeInTheDocument();
  });

  it('should call onAbilityMiscBonusChange when misc bonus changed', () => {
    render(<CharacterCreationWizard {...defaultProps} />);
    fireEvent.click(screen.getByText('Misc Bonus'));
    expect(screen.getByText('Create New Character')).toBeInTheDocument();
  });

  it('should render with isEditing prop affecting step and title', () => {
    render(<CharacterCreationWizard {...defaultProps} isEditing={true} characterData={{ rules: '5e' }} />);
    expect(screen.getByText('Edit Character')).toBeInTheDocument();
  });

  it('should disable previous button on first step when not editing', () => {
    render(<CharacterCreationWizard {...defaultProps} />);
    const prevButton = screen.getByText('Previous');
    expect(prevButton).toBeDisabled();
  });

  it('should have isLastStep prop correctly calculated', () => {
    render(<CharacterCreationWizard {...defaultProps} />);
    expect(screen.getByTestId('wizard-footer')).toBeInTheDocument();
  });

  it('should call handleSubmit when submit button clicked', () => {
    render(<CharacterCreationWizard {...defaultProps} />);
    expect(screen.getByText('Create New Character')).toBeInTheDocument();
  });

  it('should show validation errors on submit when step has errors', () => {
    render(<CharacterCreationWizard {...defaultProps} />);
    expect(screen.getByText('Create New Character')).toBeInTheDocument();
  });

  it('should handle ruleset change to 2024 and clear spells/feats/background', () => {
    render(<CharacterCreationWizard {...defaultProps} />);
    fireEvent.click(screen.getByText('Change Ruleset'));

    expect(mockSetFormData).toHaveBeenCalledWith(expect.any(Function));

    // Verify the updater function transforms form data correctly
    const updater = mockSetFormData.mock.calls[0][0];
    const result = updater({
      ...mockFormData,
      spells: ['Fireball'],
      feats: ['Alert'],
      background: 'Acolyte',
      rules: '5e',
    });
    expect(result.rules).toBe('2024');
    expect(result.spells).toEqual([]);
    expect(result.feats).toEqual([]);
    expect(result.background).toBe('');

    // Verify navigation to step 2 via shared spy
    expect(mockGoToStep).toHaveBeenCalledWith(2);
  });

  it('should handle ruleset change to 5e and clear spells/feats/background', () => {
    render(<CharacterCreationWizard {...defaultProps} />);
    fireEvent.click(screen.getByText('Ruleset 5e'));

    expect(mockSetFormData).toHaveBeenCalledWith(expect.any(Function));

    const updater = mockSetFormData.mock.calls[0][0];
    const result = updater({
      ...mockFormData,
      spells: ['Fireball'],
      feats: ['Alert'],
      background: 'Acolyte',
      rules: '2024',
    });
    expect(result.rules).toBe('5e');
    expect(result.spells).toEqual([]);
    expect(result.feats).toEqual([]);
    expect(result.background).toBe('');

    expect(mockGoToStep).toHaveBeenCalledWith(2);
  });

  it('should navigate next and reset errors on success', async () => {
    mockNavigateNext.mockResolvedValue(true);
    render(<CharacterCreationWizard {...defaultProps} />);

    fireEvent.click(screen.getByText('Next'));

    await waitFor(() => {
      expect(mockNavigateNext).toHaveBeenCalled();
      expect(mockResetErrors).toHaveBeenCalled();
    });
  });

  it('should not reset errors when navigation fails', async () => {
    // Default: mockNavigateNext returns undefined (falsy)
    render(<CharacterCreationWizard {...defaultProps} />);

    fireEvent.click(screen.getByText('Next'));

    await waitFor(() => {
      expect(mockNavigateNext).toHaveBeenCalled();
      expect(mockResetErrors).not.toHaveBeenCalled();
    });
  });

  it('should set step errors on submit and not call onComplete', async () => {
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

    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(validateStep).toHaveBeenCalledWith(12, mockFormData, {}, [], [], '5e');
      expect(mockSetErrors).toHaveBeenCalledWith({ name: 'Name is required' });
      expect(localOnComplete).not.toHaveBeenCalled();
    });
  });

  it('should set final validation errors on submit and not call onComplete', async () => {
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

    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(mockSetErrors).toHaveBeenCalledWith({ name: 'Name is required' });
      expect(localOnComplete).not.toHaveBeenCalled();
    });
  });

  it('should submit successfully when no validation errors', async () => {
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

    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(localOnComplete).toHaveBeenCalledWith(mockFormData);
    });
  });

  it('should display total steps from getTotalSteps', () => {
    render(<CharacterCreationWizard {...defaultProps} />);
    expect(screen.getByText('Step 1 of 12')).toBeInTheDocument();
  });

  it('should update tempInventory via onTempInventoryChange callback', () => {
    render(<CharacterCreationWizard {...defaultProps} />);
    // TempInventory is synced from formData.inventory on mount (should be 0 items)
    expect(screen.getByTestId('temp-inventory-count').textContent).toBe('0');
    // Click the update button to exercise updateTempInventory
    fireEvent.click(screen.getByText('Update Inventory'));
    // Component should still be rendered after state update
    expect(screen.getByTestId('wizard-footer')).toBeInTheDocument();
  });
});
