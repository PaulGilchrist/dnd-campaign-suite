import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharacterCreationWizard from './character-creation-wizard';

// Mock all the hooks
vi.mock('./use-wizard-form', () => ({
  default: vi.fn(() => ({
    formData: {
      name: '',
      race: {},
      class: {},
      abilities: [],
      skillProficiencies: [],
      expertSkills: [],
      languages: [],
      resistances: [],
      immunities: [],
      spells: [],
      feats: [],
      inventory: {},
      rules: '5e',
     },
    errors: {},
    setFormData: vi.fn(),
    setErrors: vi.fn(),
    updateField: vi.fn(),
    updateArrayField: vi.fn(),
    updateAbility: vi.fn(),
    updateInventory: vi.fn(),
    updateClass: vi.fn(),
    resetErrors: vi.fn(),
  })),
}));

vi.mock('./use-wizard-data', () => ({
  default: vi.fn(() => ({
    backgrounds: [],
    racesData: [],
    classSubtypes: [],
    feats: [],
    magicItems: [],
    isDataLoading: false,
  })),
}));

vi.mock('./use-wizard-navigation', () => ({
  default: vi.fn(() => ({
    currentStep: 1,
    isNextDisabled: false,
    navigateNext: vi.fn(),
    navigatePrevious: vi.fn(),
    goToStep: vi.fn(),
  })),
}));

vi.mock('./use-wizard-skills', () => ({
  default: vi.fn(() => ({
    skillLimits: null,
    expertiseLimits: null,
    skillWarnings: [],
    preSelectedSkills: [],
  })),
}));

vi.mock('./use-wizard-languages', () => ({
  default: vi.fn(() => ({
    languageLimits: null,
    fightingStyleLimits: null,
    languageWarnings: [],
    preSelectedLanguages: [],
    preSelectedFightingStyles: [],
  })),
}));

vi.mock('./use-wizard-resistances', () => ({
  default: vi.fn(() => ({
    resistanceWarnings: [],
    preSelectedResistancesList: { resistances: [], immunities: [] },
  })),
}));

vi.mock('./use-wizard-feats', () => ({
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

vi.mock('./use-wizard-abilities', () => ({
  default: vi.fn(() => ({
    calculateTotalPointsSpent: vi.fn(),
  })),
}));

// Mock child components
vi.mock('./wizard-header', () => ({
  default: function WizardHeaderMock({ title, onClose }) {
    return <div data-testid="wizard-header"><h1>{title}</h1><button onClick={onClose}>Close</button></div>;
    },
}));

vi.mock('./wizard-progress-bar', () => ({
  default: function WizardProgressBarMock({ currentStep, totalSteps, isEditing }) {
    return <div data-testid="wizard-progress-bar"><span>Step {currentStep} of {totalSteps}</span></div>;
    },
}));

vi.mock('./wizard-footer', () => ({
  default: function WizardFooterMock({ currentStep, isFirstStep, isLastStep, onCancel, onPrevious, onNext, onSubmit, isEditing, isNextDisabled }) {
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

// Mock steps-config
vi.mock('./steps-config', () => ({
  WIZARD_STEPS: [
    { step: 1, title: 'Ruleset', component: () => <div data-testid="step-ruleset">Ruleset Step</div>, getProps: () => ({}) },
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
}));

// Mock utils
vi.mock('./utils', () => ({
  validateStep: vi.fn(() => Promise.resolve({})),
  validateFinalFormData: vi.fn(() => ({})),
  getPointBuyCosts: vi.fn(() => Promise.resolve({ 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 })),
}));

describe('CharacterCreationWizard', () => {
  const mockProps = {
    onComplete: vi.fn(),
    onCancel: vi.fn(),
    allRaces: [],
    allClasses: [],
    allSpells: [],
    allSpells2024: [],
    characterData: null,
    isEditing: false,
   };

  beforeEach(() => {
    vi.clearAllMocks();
   });

  it('should render the wizard overlay', () => {
    render(<CharacterCreationWizard {...mockProps} />);
     
    expect(document.querySelector('.character-creation-wizard-overlay')).toBeInTheDocument();
   });

  it('should render the wizard container', () => {
    render(<CharacterCreationWizard {...mockProps} />);
     
    expect(document.querySelector('.character-creation-wizard')).toBeInTheDocument();
   });

  it('should render the wizard header with create title', () => {
    render(<CharacterCreationWizard {...mockProps} />);
     
    expect(screen.getByText('Create New Character')).toBeInTheDocument();
   });

  it('should render the wizard header with edit title when editing', () => {
    render(<CharacterCreationWizard {...mockProps} isEditing={true} />);
     
    expect(screen.getByText('Edit Character')).toBeInTheDocument();
   });

  it('should render the wizard progress bar', () => {
    render(<CharacterCreationWizard {...mockProps} />);
     
    expect(screen.getByTestId('wizard-progress-bar')).toBeInTheDocument();
   });

  it('should render the wizard footer', () => {
    render(<CharacterCreationWizard {...mockProps} />);
     
    expect(screen.getByTestId('wizard-footer')).toBeInTheDocument();
   });

  it('should render the wizard content area', () => {
    render(<CharacterCreationWizard {...mockProps} />);
     
    expect(document.querySelector('.wizard-content')).toBeInTheDocument();
   });

  it('should render the current step component', () => {
    render(<CharacterCreationWizard {...mockProps} />);
     
    expect(screen.getByTestId('step-ruleset')).toBeInTheDocument();
   });

  it('should call onCancel when close button is clicked', () => {
    render(<CharacterCreationWizard {...mockProps} />);
     
    fireEvent.click(screen.getByText('Close'));
     
    expect(mockProps.onCancel).toHaveBeenCalled();
   });

  it('should call onCancel when cancel button in footer is clicked', () => {
    render(<CharacterCreationWizard {...mockProps} />);
     
    const cancelButton = screen.getAllByText('Cancel');
    fireEvent.click(cancelButton[0]);
     
    expect(mockProps.onCancel).toHaveBeenCalled();
   });

  it('should call navigatePrevious when previous button is clicked', () => {
    render(<CharacterCreationWizard {...mockProps} />);
     
    const previousButton = screen.getByText('Previous');
    fireEvent.click(previousButton);
     
    // The button should be disabled on first step
    expect(previousButton).toBeDisabled();
   });

  it('should show Next button on non-last steps', () => {
    render(<CharacterCreationWizard {...mockProps} />);
     
    expect(screen.getByText('Next')).toBeInTheDocument();
   });

  it('should render with character data when editing', () => {
    const editProps = {
      ...mockProps,
      isEditing: true,
      characterData: { name: 'Test Character', rules: '5e' },
     };
    
    render(<CharacterCreationWizard {...editProps} />);
     
    expect(screen.getByText('Edit Character')).toBeInTheDocument();
   });

  it('should render the wizard step component', () => {
    render(<CharacterCreationWizard {...mockProps} />);
     
    expect(screen.getByTestId('step-ruleset')).toBeInTheDocument();
   });

  it('should display total steps in progress bar', () => {
    render(<CharacterCreationWizard {...mockProps} />);
     
    expect(screen.getByText('Step 1 of 12')).toBeInTheDocument();
   });

  it('should not have Next button disabled when isNextDisabled is false', () => {
    render(<CharacterCreationWizard {...mockProps} />);
     
    const nextButton = screen.getByText('Next');
    expect(nextButton).not.toBeDisabled();
   });
});