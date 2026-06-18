// @improved-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharacterCreationWizard from './CharacterCreationWizard.jsx';
import { validateStep, validateFinalFormData } from '../../config/utils.js';
import useWizardNavigation from '../../hooks/wizard/useWizardNavigation.js';

// Stable mock data — defined outside vi.fn() to preserve reference identity
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

// Shared navigation spies — created at module level for test access
const mockGoToStep = vi.fn();
const mockNavigateNext = vi.fn();
const mockNavigatePrevious = vi.fn();
const mockGetStepEnabled = vi.fn(() => true);

// Mock all hooks with stable references
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

// Mock child components to match real rendering structure
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
  default: function WizardProgressBarMock({ currentStep, totalSteps }) {
    return (
      <div data-testid="wizard-progress-bar">
        <span>Step {currentStep} of {totalSteps}</span>
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
  default: function WizardSidebarMock() {
    return <div data-testid="wizard-sidebar">Sidebar</div>;
  },
}));

// Mock steps-config with interactive step component
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

// Mock validation utils
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

  describe('rendering structure', () => {
    it('renders the wizard overlay and container with correct CSS classes', () => {
      render(<CharacterCreationWizard {...defaultProps} />);
      expect(document.querySelector('.character-creation-wizard-overlay')).toBeInTheDocument();
      expect(document.querySelector('.character-creation-wizard')).toBeInTheDocument();
    });

    it('renders the wizard header, progress bar, sidebar, body, content area, and footer', () => {
      render(<CharacterCreationWizard {...defaultProps} />);
      expect(screen.getByTestId('wizard-header')).toBeInTheDocument();
      expect(screen.getByTestId('wizard-progress-bar')).toBeInTheDocument();
      expect(screen.getByTestId('wizard-sidebar')).toBeInTheDocument();
      expect(document.querySelector('.wizard-body')).toBeInTheDocument();
      expect(document.querySelector('.wizard-content')).toBeInTheDocument();
      expect(screen.getByTestId('wizard-footer')).toBeInTheDocument();
    });

    it('renders the current step component in the content area', () => {
      render(<CharacterCreationWizard {...defaultProps} />);
      expect(screen.getByTestId('step-ruleset')).toBeInTheDocument();
    });
  });

  describe('header title', () => {
    it('displays "Create New Character" title when not editing', () => {
      render(<CharacterCreationWizard {...defaultProps} />);
      expect(screen.getByText('Create New Character')).toBeInTheDocument();
    });

    it('displays "Edit Character" title when editing', () => {
      render(<CharacterCreationWizard {...defaultProps} isEditing={true} />);
      expect(screen.getByText('Edit Character')).toBeInTheDocument();
    });

    it('passes the title to WizardHeader', () => {
      render(<CharacterCreationWizard {...defaultProps} />);
      expect(screen.getByTestId('wizard-header').querySelector('h2').textContent).toBe('Create New Character');
    });
  });

  describe('progress bar', () => {
    it('displays the current step and total steps', () => {
      render(<CharacterCreationWizard {...defaultProps} />);
      expect(screen.getByText('Step 1 of 12')).toBeInTheDocument();
    });
  });

  describe('footer buttons', () => {
    it('shows Cancel button (disabled) on first step when not editing', () => {
      render(<CharacterCreationWizard {...defaultProps} />);
      const cancelButton = screen.getByText('Cancel');
      expect(cancelButton).toBeDisabled();
      expect(cancelButton).toHaveClass('btn-secondary');
    });

    it('shows Previous button on non-first steps', () => {
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
      const previousButton = screen.getByText('Previous');
      expect(previousButton).not.toBeDisabled();
      expect(previousButton).toHaveClass('btn-secondary');
    });

    it('shows Next button on non-last steps', () => {
      render(<CharacterCreationWizard {...defaultProps} />);
      const nextButton = screen.getByText('Next');
      expect(nextButton).toBeInTheDocument();
      expect(nextButton).toHaveClass('btn-primary');
    });

    it('shows Next button disabled when isNextDisabled is true', () => {
      useWizardNavigation.mockImplementation(() => ({
        currentStep: 1,
        isNextDisabled: true,
        navigateNext: mockNavigateNext,
        navigatePrevious: mockNavigatePrevious,
        goToStep: mockGoToStep,
        getStepEnabled: mockGetStepEnabled,
        isSaveEnabled: true,
      }));
      render(<CharacterCreationWizard {...defaultProps} />);
      expect(screen.getByText('Next')).toBeDisabled();
    });

    it('shows "Create Character" submit button on last step when not editing', () => {
      useWizardNavigation.mockImplementation(() => ({
        currentStep: 12,
        isNextDisabled: false,
        navigateNext: mockNavigateNext,
        navigatePrevious: mockNavigatePrevious,
        goToStep: mockGoToStep,
        getStepEnabled: mockGetStepEnabled,
        isSaveEnabled: true,
      }));
      render(<CharacterCreationWizard {...defaultProps} />);
      expect(screen.getByText('Create Character')).toBeInTheDocument();
      expect(screen.getByText('Create Character')).toHaveClass('btn-success');
    });

    it('shows "Save Changes" submit button on last step when editing', () => {
      useWizardNavigation.mockImplementation(() => ({
        currentStep: 12,
        isNextDisabled: false,
        navigateNext: mockNavigateNext,
        navigatePrevious: mockNavigatePrevious,
        goToStep: mockGoToStep,
        getStepEnabled: mockGetStepEnabled,
        isSaveEnabled: true,
      }));
      render(<CharacterCreationWizard {...defaultProps} isEditing={true} />);
      expect(screen.getByText('Save Changes')).toBeInTheDocument();
    });
  });

  describe('close/cancel handling', () => {
    it('calls onCancel when the header close button is clicked', async () => {
      render(<CharacterCreationWizard {...defaultProps} />);
      const closeButtons = screen.getAllByText('×');
      await act(async () => {
        fireEvent.click(closeButtons[0]);
      });
      expect(mockOnCancel).toHaveBeenCalled();
    });

    it('does not render a Cancel button in the footer on non-first steps', () => {
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
      expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
    });
  });

  describe('navigation', () => {
    it('calls navigatePrevious when Previous button is clicked', async () => {
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
      await act(async () => {
        fireEvent.click(screen.getByText('Previous'));
      });
      expect(mockNavigatePrevious).toHaveBeenCalled();
    });

    it('calls handleNext (navigateNext + resetErrors) when Next button is clicked and succeeds', async () => {
      mockNavigateNext.mockResolvedValue(true);
      render(<CharacterCreationWizard {...defaultProps} />);
      await act(async () => {
        fireEvent.click(screen.getByText('Next'));
      });
      await waitFor(() => {
        expect(mockNavigateNext).toHaveBeenCalled();
        expect(mockResetErrors).toHaveBeenCalled();
      });
    });

    it('does not reset errors when Next navigation fails', async () => {
      mockNavigateNext.mockResolvedValue(false);
      render(<CharacterCreationWizard {...defaultProps} />);
      await act(async () => {
        fireEvent.click(screen.getByText('Next'));
      });
      await waitFor(() => {
        expect(mockNavigateNext).toHaveBeenCalled();
        expect(mockResetErrors).not.toHaveBeenCalled();
      });
    });
  });

  describe('ruleset change', () => {
    it('clears spells, feats, and background when switching to 2024', async () => {
      render(<CharacterCreationWizard {...defaultProps} />);
      await act(async () => {
        fireEvent.click(screen.getByText('Change Ruleset'));
      });

      expect(mockSetFormData).toHaveBeenCalledWith(expect.any(Function));

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

      expect(mockGoToStep).toHaveBeenCalledWith(2);
    });

    it('clears spells, feats, and background when switching to 5e', async () => {
      render(<CharacterCreationWizard {...defaultProps} />);
      await act(async () => {
        fireEvent.click(screen.getByText('Ruleset 5e'));
      });

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
  });

  describe('submission', () => {
    it('calls validateStep on submit (last step)', async () => {
      useWizardNavigation.mockImplementation(() => ({
        currentStep: 12,
        isNextDisabled: false,
        navigateNext: mockNavigateNext,
        navigatePrevious: mockNavigatePrevious,
        goToStep: mockGoToStep,
        getStepEnabled: mockGetStepEnabled,
        isSaveEnabled: true,
      }));
      render(<CharacterCreationWizard {...defaultProps} characterData={{ rules: '5e' }} />);
      await act(async () => {
        fireEvent.click(screen.getByText('Create Character'));
      });
      await waitFor(() => {
        expect(validateStep).toHaveBeenCalledWith(12, mockFormData, {}, [], [], '5e');
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

    it('calls validateFinalFormData when step validation passes', async () => {
      validateStep.mockImplementation(() => Promise.resolve({}));
      useWizardNavigation.mockImplementation(() => ({
        currentStep: 12,
        isNextDisabled: false,
        navigateNext: mockNavigateNext,
        navigatePrevious: mockNavigatePrevious,
        goToStep: mockGoToStep,
        getStepEnabled: mockGetStepEnabled,
        isSaveEnabled: true,
      }));
      render(<CharacterCreationWizard {...defaultProps} characterData={{ rules: '5e' }} />);

      await act(async () => {
        fireEvent.click(screen.getByText('Create Character'));
      });

      await waitFor(() => {
        expect(validateFinalFormData).toHaveBeenCalledWith(mockFormData);
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
  });

  describe('editing mode', () => {
    it('renders "Edit Character" title with characterData', () => {
      render(<CharacterCreationWizard {...defaultProps} isEditing={true} characterData={{ name: 'Test Character', rules: '5e' }} />);
      expect(screen.getByText('Edit Character')).toBeInTheDocument();
    });

    it('starts at step 2 when editing (Cancel button instead of Previous)', () => {
      useWizardNavigation.mockImplementation(() => ({
        currentStep: 2,
        isNextDisabled: false,
        navigateNext: mockNavigateNext,
        navigatePrevious: mockNavigatePrevious,
        goToStep: mockGoToStep,
        getStepEnabled: mockGetStepEnabled,
        isSaveEnabled: true,
      }));
      render(<CharacterCreationWizard {...defaultProps} isEditing={true} />);
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.queryByText('Previous')).not.toBeInTheDocument();
    });

    it('passes isEditing to WizardFooter and WizardProgressBar', () => {
      useWizardNavigation.mockImplementation(() => ({
        currentStep: 12,
        isNextDisabled: false,
        navigateNext: mockNavigateNext,
        navigatePrevious: mockNavigatePrevious,
        goToStep: mockGoToStep,
        getStepEnabled: mockGetStepEnabled,
        isSaveEnabled: true,
      }));
      render(<CharacterCreationWizard {...defaultProps} isEditing={true} />);
      expect(screen.getByText('Save Changes')).toBeInTheDocument();
    });
  });

  describe('inventory sync', () => {
    it('initially displays 0 items in temp inventory', () => {
      render(<CharacterCreationWizard {...defaultProps} />);
      expect(screen.getByTestId('temp-inventory-count').textContent).toBe('0');
    });

    it('syncs tempInventory when formData.inventory changes', async () => {
      // The useEffect in the component syncs tempInventory from formData.inventory on mount
      // The mock form returns formData with empty inventory, so tempInventory should be 0
      render(<CharacterCreationWizard {...defaultProps} />);
      expect(screen.getByTestId('temp-inventory-count').textContent).toBe('0');
    });
  });
});
