// @cleaned-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WizardStepRules from './WizardStepRules.jsx';

const mockProps = {
  ruleset: '5e',
  errors: {},
  onRulesetChange: vi.fn(),
};

function createMockProps(overrides = {}) {
  return { ...mockProps, ...overrides };
}

describe('WizardStepRules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Header and descriptions', () => {
    it('should render the step header and description', () => {
      render(<WizardStepRules {...mockProps} />);

      expect(screen.getByRole('heading', { name: 'Select Rules System' })).toBeInTheDocument();
      expect(screen.getByText(/Choose which D&D ruleset your character will follow:/)).toBeInTheDocument();
    });
  });

  describe('Ruleset options', () => {
    it('should render both 5e and 2024 options with their titles, descriptions, and features', () => {
      render(<WizardStepRules {...mockProps} />);

      expect(screen.getByRole('heading', { name: '5th Edition (5e)' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: '2024 Rules (Essentials)' })).toBeInTheDocument();
      expect(screen.getByText(/The classic D&D ruleset from 2014/)).toBeInTheDocument();
      expect(screen.getByText(/The updated D&D ruleset/)).toBeInTheDocument();
      expect(screen.getByText('Traditional spell slots')).toBeInTheDocument();
      expect(screen.getByText('Classic class features')).toBeInTheDocument();
      expect(screen.getByText('Revised spell mechanics')).toBeInTheDocument();
      expect(screen.getByText('Updated class features')).toBeInTheDocument();
    });

    it('should mark the matching ruleset option as selected', () => {
      render(<WizardStepRules {...mockProps} />);

      const fiveEOption = screen.getByRole('heading', { name: '5th Edition (5e)' }).closest('.rules-option');
      const twentyTwentyFourOption = screen.getByRole('heading', { name: '2024 Rules (Essentials)' }).closest('.rules-option');

      expect(fiveEOption).toHaveClass('selected');
      expect(twentyTwentyFourOption).not.toHaveClass('selected');
    });

    it('should mark the 2024 option as selected when ruleset is 2024', () => {
      render(<WizardStepRules {...createMockProps({ ruleset: '2024' })} />);

      const fiveEOption = screen.getByRole('heading', { name: '5th Edition (5e)' }).closest('.rules-option');
      const twentyTwentyFourOption = screen.getByRole('heading', { name: '2024 Rules (Essentials)' }).closest('.rules-option');

      expect(fiveEOption).not.toHaveClass('selected');
      expect(twentyTwentyFourOption).toHaveClass('selected');
    });
  });

  describe('Selection switching', () => {
    it('should call onRulesetChange with the correct ruleset when an option is clicked', () => {
      const { rerender } = render(<WizardStepRules {...mockProps} />);

      const fiveEOption = screen.getByRole('heading', { name: '5th Edition (5e)' }).closest('.rules-option');
      const twentyTwentyFourOption = screen.getByRole('heading', { name: '2024 Rules (Essentials)' }).closest('.rules-option');

      fireEvent.click(fiveEOption);
      expect(mockProps.onRulesetChange).toHaveBeenCalledWith('5e');

      fireEvent.click(twentyTwentyFourOption);
      expect(mockProps.onRulesetChange).toHaveBeenCalledWith('2024');

      // Switch to 2024 via props then click 5e to confirm independent click handlers
      rerender(<WizardStepRules {...createMockProps({ ruleset: '2024' })} />);
      fireEvent.click(fiveEOption);
      expect(mockProps.onRulesetChange).toHaveBeenCalledWith('5e');
    });
  });

  describe('Error display', () => {
    it('should render the error message with the error-message class when a ruleset error exists', () => {
      const errorMessage = 'Please select a ruleset';
      render(<WizardStepRules {...createMockProps({ errors: { ruleset: errorMessage } })} />);

      const errorEl = screen.getByText(errorMessage);
      expect(errorEl).toBeInTheDocument();
      expect(errorEl).toHaveClass('error-message');
    });

    it('should not render an error message when errors object is empty', () => {
      render(<WizardStepRules {...createMockProps({ errors: {} })} />);

      expect(screen.queryByText(/select a ruleset/)).not.toBeInTheDocument();
    });
  });
});
