import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WizardStepRules from './wizard-step-rules';

describe('WizardStepRules', () => {
  const mockProps = {
    ruleset: '5e',
    errors: {},
    onRulesetChange: vi.fn(),
   };

  beforeEach(() => {
    vi.clearAllMocks();
   });

  it('should render the wizard step header', () => {
    render(<WizardStepRules {...mockProps} />);

    expect(screen.getByText('Select Rules System')).toBeInTheDocument();
   });

  it('should render the step description', () => {
    render(<WizardStepRules {...mockProps} />);

    expect(screen.getByText('Choose which D&D ruleset your character will follow:')).toBeInTheDocument();
   });

  it('should render the 5e rules option', () => {
    render(<WizardStepRules {...mockProps} />);

    expect(screen.getByText('5th Edition (5e)')).toBeInTheDocument();
    expect(screen.getByText(/The classic D&D ruleset from 2014/)).toBeInTheDocument();
   });

  it('should render the 2024 rules option', () => {
    render(<WizardStepRules {...mockProps} />);

    expect(screen.getByText('2024 Rules (Essentials)')).toBeInTheDocument();
    expect(screen.getByText(/The updated D&D ruleset/)).toBeInTheDocument();
   });

  it('should mark 5e as selected when ruleset is 5e', () => {
    render(<WizardStepRules {...mockProps} />);

    const selectedOption = screen.getByText('5th Edition (5e)').closest('.rules-option');
    expect(selectedOption).toHaveClass('selected');
   });

  it('should mark 2024 as selected when ruleset is 2024', () => {
    const propsWith2024 = {
       ...mockProps,
      ruleset: '2024',
     };

    render(<WizardStepRules {...propsWith2024} />);

    const selectedOption = screen.getByText('2024 Rules (Essentials)').closest('.rules-option');
    expect(selectedOption).toHaveClass('selected');
   });

  it('should call onRulesetChange when 5e option is clicked', () => {
    render(<WizardStepRules {...mockProps} />);

    const fiveEOption = screen.getByText('5th Edition (5e)').closest('.rules-option');
    fireEvent.click(fiveEOption);

    expect(mockProps.onRulesetChange).toHaveBeenCalledWith('5e');
   });

  it('should call onRulesetChange when 2024 option is clicked', () => {
    render(<WizardStepRules {...mockProps} />);

    const twoZeroTwoFourOption = screen.getByText('2024 Rules (Essentials)').closest('.rules-option');
    fireEvent.click(twoZeroTwoFourOption);

    expect(mockProps.onRulesetChange).toHaveBeenCalledWith('2024');
   });

  it('should display error message when ruleset error exists', () => {
    const propsWithError = {
       ...mockProps,
      errors: {
        ruleset: 'Please select a ruleset',
       },
     };

    render(<WizardStepRules {...propsWithError} />);

    expect(screen.getByText('Please select a ruleset')).toBeInTheDocument();
   });

  it('should not display error message when no errors exist', () => {
    render(<WizardStepRules {...mockProps} />);

    expect(screen.queryByText('Please select a ruleset')).not.toBeInTheDocument();
   });

  it('should render 5e features list', () => {
    render(<WizardStepRules {...mockProps} />);

    expect(screen.getByText('Traditional spell slots')).toBeInTheDocument();
    expect(screen.getByText('Classic class features')).toBeInTheDocument();
    expect(screen.getByText('Standard ability improvements')).toBeInTheDocument();
    expect(screen.getByText('Original subclass system')).toBeInTheDocument();
   });

  it('should render 2024 features list', () => {
    render(<WizardStepRules {...mockProps} />);

    expect(screen.getByText('Revised spell mechanics')).toBeInTheDocument();
    expect(screen.getByText('Updated class features')).toBeInTheDocument();
    expect(screen.getByText('Improved ability improvements')).toBeInTheDocument();
    expect(screen.getByText('Modern subclass system')).toBeInTheDocument();
   });

  it('should switch selection from 5e to 2024', () => {
    render(<WizardStepRules {...mockProps} />);

    // Initially 5e is selected
    let fiveEOption = screen.getByText('5th Edition (5e)').closest('.rules-option');
    expect(fiveEOption).toHaveClass('selected');

    // Click on 2024 option
    const twoZeroTwoFourOption = screen.getByText('2024 Rules (Essentials)').closest('.rules-option');
    fireEvent.click(twoZeroTwoFourOption);

    expect(mockProps.onRulesetChange).toHaveBeenCalledWith('2024');
   });

  it('should render rules option icons', () => {
    render(<WizardStepRules {...mockProps} />);

      const icons = document.querySelectorAll('.rules-option-icon');
      expect(icons.length).toBe(2);
      });
});