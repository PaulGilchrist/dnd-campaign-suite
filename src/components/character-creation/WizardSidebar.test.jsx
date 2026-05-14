import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WizardSidebar from './WizardSidebar.jsx';

describe('WizardSidebar', () => {
  const defaultProps = {
    currentStep: 2,
    isEditing: false,
    getStepEnabled: () => true,
    goToStep: vi.fn(),
    isSaveEnabled: true,
    onSave: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render all 12 step tabs when not editing', () => {
    render(<WizardSidebar {...defaultProps} />);

    const stepTabs = document.querySelectorAll('.sidebar-tab');
    expect(stepTabs.length).toBe(12);
    expect(screen.getByText('Ruleset')).toBeInTheDocument();
  });

  it('should hide step 1 (Ruleset) when editing', () => {
    render(<WizardSidebar {...defaultProps} isEditing={true} />);

    const stepTabs = document.querySelectorAll('.sidebar-tab');
    expect(stepTabs.length).toBe(11);
    expect(screen.queryByText('Ruleset')).not.toBeInTheDocument();
  });

  it('should highlight the current step as active', () => {
    render(<WizardSidebar {...defaultProps} currentStep={3} />);

    const activeTab = screen.getByText('Race & Class').closest('.sidebar-tab');
    expect(activeTab).toHaveClass('active');

    const inactiveTab = screen.getByText('Basic Information').closest('.sidebar-tab');
    expect(inactiveTab).not.toHaveClass('active');
  });

  it('should disable tabs based on getStepEnabled', () => {
    const getStepEnabled = (step) => step !== 3;
    render(<WizardSidebar {...defaultProps} getStepEnabled={getStepEnabled} />);

    const disabledTab = screen.getByText('Race & Class').closest('.sidebar-tab');
    expect(disabledTab).toHaveClass('disabled');
    expect(disabledTab).toBeDisabled();

    const enabledTab = screen.getByText('Basic Information').closest('.sidebar-tab');
    expect(enabledTab).not.toHaveClass('disabled');
    expect(enabledTab).not.toBeDisabled();
  });

  it('should call goToStep when an enabled tab is clicked', () => {
    render(<WizardSidebar {...defaultProps} />);

    fireEvent.click(screen.getByText('Basic Information').closest('.sidebar-tab'));

    expect(defaultProps.goToStep).toHaveBeenCalledWith(2);
  });

  it('should not call goToStep when a disabled tab is clicked', () => {
    const getStepEnabled = (step) => step !== 5;
    render(<WizardSidebar {...defaultProps} getStepEnabled={getStepEnabled} />);

    const disabledTab = screen.getByText('Ability Scores').closest('.sidebar-tab');
    fireEvent.click(disabledTab);

    expect(defaultProps.goToStep).not.toHaveBeenCalled();
  });

  it('should render the Save button', () => {
    render(<WizardSidebar {...defaultProps} />);

    expect(screen.getByText('Save')).toBeInTheDocument();
  });

  it('should disable the Save button when isSaveEnabled is false', () => {
    render(<WizardSidebar {...defaultProps} isSaveEnabled={false} />);

    const saveButton = screen.getByText('Save').closest('.sidebar-save');
    expect(saveButton).toHaveClass('disabled');
    expect(saveButton).toBeDisabled();
  });

  it('should enable the Save button when isSaveEnabled is true', () => {
    render(<WizardSidebar {...defaultProps} isSaveEnabled={true} />);

    const saveButton = screen.getByText('Save').closest('.sidebar-save');
    expect(saveButton).not.toBeDisabled();
  });

  it('should call onSave when the Save button is clicked', () => {
    render(<WizardSidebar {...defaultProps} />);

    fireEvent.click(screen.getByText('Save').closest('.sidebar-save'));

    expect(defaultProps.onSave).toHaveBeenCalled();
  });
});
