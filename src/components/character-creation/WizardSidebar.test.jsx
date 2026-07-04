// @cleaned-by-ai
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

  describe('rendering', () => {
    it('renders step tabs with correct titles', () => {
      renderSidebar();
      expect(screen.getByText('Basic Information')).toBeInTheDocument();
      expect(screen.getByText('Race & Class')).toBeInTheDocument();
      expect(screen.getByText('Special Actions')).toBeInTheDocument();
    });

    it('hides step 1 (Ruleset) when editing', () => {
      renderSidebar({ isEditing: true });
      expect(screen.queryByText('Ruleset')).not.toBeInTheDocument();
      expect(screen.getByText('Basic Information')).toBeInTheDocument();
    });
  });

  describe('active state', () => {
    it('highlights the current step as active and others as inactive', () => {
      renderSidebar({ currentStep: 3 });
      const activeTab = screen.getByText('Race & Class').closest('.sidebar-tab');
      expect(activeTab).toHaveClass('active');
      const inactiveTab = screen.getByText('Basic Information').closest('.sidebar-tab');
      expect(inactiveTab).not.toHaveClass('active');
    });
  });

  describe('disabled state', () => {
    it('disables tabs based on getStepEnabled', () => {
      renderSidebar({ getStepEnabled: (step) => step !== 3 });
      const disabledTab = screen.getByText('Race & Class').closest('.sidebar-tab');
      expect(disabledTab).toHaveClass('disabled');
      expect(disabledTab).toHaveAttribute('disabled');
      const enabledTab = screen.getByText('Basic Information').closest('.sidebar-tab');
      expect(enabledTab).not.toHaveClass('disabled');
    });

    it('disables the save button when isSaveEnabled is false', () => {
      renderSidebar({ isSaveEnabled: false });
      const saveButton = screen.getByText('Save').closest('.sidebar-save');
      expect(saveButton).toHaveClass('disabled');
      expect(saveButton).toBeDisabled();
    });
  });

  describe('navigation interaction', () => {
    it('calls goToStep with the correct step number when a tab is clicked', () => {
      const props = createProps();
      render(<WizardSidebar {...props} />);
      fireEvent.click(screen.getByText('Race & Class').closest('.sidebar-tab'));
      expect(props.goToStep).toHaveBeenCalledWith(3);
    });
  });

  describe('save button interaction', () => {
    it('calls onSave when the save button is clicked', () => {
      const props = createProps();
      render(<WizardSidebar {...props} />);
      fireEvent.click(screen.getByText('Save').closest('.sidebar-save'));
      expect(props.onSave).toHaveBeenCalled();
    });
  });
});
