// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WizardSidebar from './WizardSidebar.jsx';

const createProps = (overrides = {}) => ({
  currentStep: 2,
  isEditing: false,
  getStepEnabled: () => true,
  goToStep: vi.fn(),
  isSaveEnabled: true,
  onSave: vi.fn(),
  ...overrides,
});

const renderSidebar = (props = {}) => render(<WizardSidebar {...createProps(props)} />);

describe('WizardSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('layout and container', () => {
    it('renders the wizard-sidebar container', () => {
      const { container } = renderSidebar();
      expect(container.querySelector('.wizard-sidebar')).toBeInTheDocument();
    });

    it('renders all 12 step tabs when not editing', () => {
      renderSidebar();
      const allButtons = screen.getAllByRole('button');
      const stepTabs = allButtons.filter((btn) => btn.classList.contains('sidebar-tab'));
      expect(stepTabs).toHaveLength(12);
    });

    it('renders the Save button alongside step tabs', () => {
      renderSidebar();
      const allButtons = screen.getAllByRole('button');
      const saveButtons = allButtons.filter((btn) => btn.classList.contains('sidebar-save'));
      expect(saveButtons).toHaveLength(1);
    });
  });

  describe('step rendering', () => {
    it('renders all expected step titles when not editing', () => {
      renderSidebar();
      expect(screen.getByText('Ruleset')).toBeInTheDocument();
      expect(screen.getByText('Basic Information')).toBeInTheDocument();
      expect(screen.getByText('Race & Class')).toBeInTheDocument();
      expect(screen.getByText('Feats')).toBeInTheDocument();
      expect(screen.getByText('Ability Scores')).toBeInTheDocument();
      expect(screen.getByText('Skill Proficiencies')).toBeInTheDocument();
      expect(screen.getByText('Languages & Fighting Styles')).toBeInTheDocument();
      expect(screen.getByText('Resistances & Immunities')).toBeInTheDocument();
      expect(screen.getByText('Spells')).toBeInTheDocument();
      expect(screen.getByText('Magic Items')).toBeInTheDocument();
      expect(screen.getByText('Inventory')).toBeInTheDocument();
      expect(screen.getByText('Special Actions')).toBeInTheDocument();
    });

    it('renders step numbers in each tab', () => {
      renderSidebar();
      const tabNumbers = document.querySelectorAll('.sidebar-tab-number');
      expect(tabNumbers).toHaveLength(13);
      tabNumbers.forEach((el, index) => {
        if (index < 12) {
          expect(el.textContent).toBe(String(index + 1));
        }
      });
    });

    it('hides step 1 (Ruleset) when editing', () => {
      renderSidebar({ isEditing: true });
      expect(screen.queryByText('Ruleset')).not.toBeInTheDocument();
    });

    it('renders 11 step tabs when editing', () => {
      renderSidebar({ isEditing: true });
      const allButtons = screen.getAllByRole('button');
      const stepTabs = allButtons.filter((btn) => btn.classList.contains('sidebar-tab'));
      expect(stepTabs).toHaveLength(11);
    });

    it('renders step titles without Ruleset when editing', () => {
      renderSidebar({ isEditing: true });
      expect(screen.queryByText('Ruleset')).not.toBeInTheDocument();
      expect(screen.getByText('Basic Information')).toBeInTheDocument();
      expect(screen.getByText('Special Actions')).toBeInTheDocument();
    });
  });

  describe('active state', () => {
    it('highlights the current step as active', () => {
      renderSidebar({ currentStep: 3 });
      const activeTab = screen.getByText('Race & Class').closest('.sidebar-tab');
      expect(activeTab).toHaveClass('active');
    });

    it('marks non-current tabs as inactive', () => {
      renderSidebar({ currentStep: 3 });
      const inactiveTab = screen.getByText('Basic Information').closest('.sidebar-tab');
      expect(inactiveTab).not.toHaveClass('active');
    });

    it('highlights step 1 as active when currentStep is 1', () => {
      renderSidebar({ currentStep: 1 });
      const activeTab = screen.getByText('Ruleset').closest('.sidebar-tab');
      expect(activeTab).toHaveClass('active');
    });

    it('highlights the last step as active when currentStep is 12', () => {
      renderSidebar({ currentStep: 12 });
      const activeTab = screen.getByText('Special Actions').closest('.sidebar-tab');
      expect(activeTab).toHaveClass('active');
    });
  });

  describe('disabled state', () => {
    it('disables tabs based on getStepEnabled', () => {
      renderSidebar({ getStepEnabled: (step) => step !== 3 });
      const disabledTab = screen.getByText('Race & Class').closest('.sidebar-tab');
      expect(disabledTab).toHaveClass('disabled');
      expect(disabledTab).toHaveAttribute('disabled');
    });

    it('keeps enabled tabs without disabled class', () => {
      renderSidebar({ getStepEnabled: (step) => step !== 3 });
      const enabledTab = screen.getByText('Basic Information').closest('.sidebar-tab');
      expect(enabledTab).not.toHaveClass('disabled');
    });

    it('does not disable any tabs when all steps are enabled', () => {
      renderSidebar();
      const allButtons = screen.getAllByRole('button');
      const stepTabs = allButtons.filter((btn) => btn.classList.contains('sidebar-tab'));
      stepTabs.forEach((tab) => {
        expect(tab).not.toHaveClass('disabled');
      });
    });

    it('disables all tabs when no steps are enabled', () => {
      renderSidebar({ getStepEnabled: () => false });
      const allButtons = screen.getAllByRole('button');
      const stepTabs = allButtons.filter((btn) => btn.classList.contains('sidebar-tab'));
      stepTabs.forEach((tab) => {
        expect(tab).toHaveClass('disabled');
      });
    });
  });

  describe('navigation interaction', () => {
    it('calls goToStep with the correct step number when an enabled tab is clicked', () => {
      const props = createProps();
      render(<WizardSidebar {...props} />);
      fireEvent.click(screen.getByText('Basic Information').closest('.sidebar-tab'));
      expect(props.goToStep).toHaveBeenCalledWith(2);
    });

    it('calls goToStep with step 3 when Race & Class tab is clicked', () => {
      const props = createProps();
      render(<WizardSidebar {...props} />);
      fireEvent.click(screen.getByText('Race & Class').closest('.sidebar-tab'));
      expect(props.goToStep).toHaveBeenCalledWith(3);
    });

    it('does not call goToStep when a disabled tab is clicked', () => {
      const props = createProps({ getStepEnabled: (step) => step !== 5 });
      render(<WizardSidebar {...props} />);
      fireEvent.click(screen.getByText('Ability Scores').closest('.sidebar-tab'));
      expect(props.goToStep).not.toHaveBeenCalled();
    });

    it('calls goToStep for the last step tab', () => {
      const props = createProps();
      render(<WizardSidebar {...props} />);
      fireEvent.click(screen.getByText('Special Actions').closest('.sidebar-tab'));
      expect(props.goToStep).toHaveBeenCalledWith(12);
    });
  });

  describe('save button', () => {
    it('renders the Save button in the sidebar-save container', () => {
      renderSidebar();
      const saveContainer = screen.getByText('Save').closest('.sidebar-save');
      expect(saveContainer).toBeInTheDocument();
      expect(saveContainer).toHaveClass('sidebar-save');
    });

    it('renders the checkmark symbol in the save button', () => {
      renderSidebar();
      const saveButton = screen.getByText('Save').closest('.sidebar-save');
      const checkmark = saveButton.querySelector('.sidebar-tab-number');
      expect(checkmark).toHaveTextContent('✓');
    });

    it('disables the save button when isSaveEnabled is false', () => {
      renderSidebar({ isSaveEnabled: false });
      const saveContainer = screen.getByText('Save').closest('.sidebar-save');
      expect(saveContainer).toHaveClass('disabled');
      expect(saveContainer).toBeDisabled();
    });

    it('enables the save button when isSaveEnabled is true', () => {
      renderSidebar({ isSaveEnabled: true });
      const saveContainer = screen.getByText('Save').closest('.sidebar-save');
      expect(saveContainer).not.toBeDisabled();
    });

    it('calls onSave when the save button is clicked', () => {
      const props = createProps();
      render(<WizardSidebar {...props} />);
      fireEvent.click(screen.getByText('Save').closest('.sidebar-save'));
      expect(props.onSave).toHaveBeenCalled();
    });

    it('does not call onSave when the save button is disabled', () => {
      const props = createProps({ isSaveEnabled: false });
      render(<WizardSidebar {...props} />);
      fireEvent.click(screen.getByText('Save').closest('.sidebar-save'));
      expect(props.onSave).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('handles currentStep outside the valid range without crashing', () => {
      renderSidebar({ currentStep: 99 });
      const allButtons = screen.getAllByRole('button');
      const stepTabs = allButtons.filter((btn) => btn.classList.contains('sidebar-tab'));
      stepTabs.forEach((tab) => {
        expect(tab).not.toHaveClass('active');
      });
    });

    it('handles currentStep of 0 without crashing', () => {
      renderSidebar({ currentStep: 0 });
      const allButtons = screen.getAllByRole('button');
      const stepTabs = allButtons.filter((btn) => btn.classList.contains('sidebar-tab'));
      stepTabs.forEach((tab) => {
        expect(tab).not.toHaveClass('active');
      });
    });

    it('handles negative currentStep without crashing', () => {
      renderSidebar({ currentStep: -1 });
      const allButtons = screen.getAllByRole('button');
      const stepTabs = allButtons.filter((btn) => btn.classList.contains('sidebar-tab'));
      stepTabs.forEach((tab) => {
        expect(tab).not.toHaveClass('active');
      });
    });

    it('handles getStepEnabled returning non-boolean truthy/falsy values', () => {
      renderSidebar({ getStepEnabled: (step) => (step === 2 ? 1 : 0) });
      const enabledTab = screen.getByText('Basic Information').closest('.sidebar-tab');
      expect(enabledTab).not.toHaveClass('disabled');
      const disabledTab = screen.getByText('Race & Class').closest('.sidebar-tab');
      expect(disabledTab).toHaveClass('disabled');
    });

    it('renders correctly with all steps disabled', () => {
      renderSidebar({ getStepEnabled: () => false });
      const allButtons = screen.getAllByRole('button');
      const stepTabs = allButtons.filter((btn) => btn.classList.contains('sidebar-tab'));
      expect(stepTabs).toHaveLength(12);
      stepTabs.forEach((tab) => {
        expect(tab).toHaveClass('disabled');
      });
    });

    it('renders correctly when editing with all steps disabled', () => {
      renderSidebar({ isEditing: true, getStepEnabled: () => false });
      const allButtons = screen.getAllByRole('button');
      const stepTabs = allButtons.filter((btn) => btn.classList.contains('sidebar-tab'));
      expect(stepTabs).toHaveLength(11);
      stepTabs.forEach((tab) => {
        expect(tab).toHaveClass('disabled');
      });
      expect(screen.queryByText('Ruleset')).not.toBeInTheDocument();
    });
  });
});
