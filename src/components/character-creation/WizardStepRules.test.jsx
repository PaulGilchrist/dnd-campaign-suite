// @improved-by-ai
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

  describe('5th Edition (5e) option', () => {
    it('should render the 5e option with its title, description, and features', () => {
      render(<WizardStepRules {...mockProps} />);

      expect(screen.getByRole('heading', { name: '5th Edition (5e)' })).toBeInTheDocument();
      expect(screen.getByText(/The classic D&D ruleset from 2014/)).toBeInTheDocument();
      expect(screen.getByText('Traditional spell slots')).toBeInTheDocument();
      expect(screen.getByText('Classic class features')).toBeInTheDocument();
      expect(screen.getByText('Standard ability improvements')).toBeInTheDocument();
      expect(screen.getByText('Original subclass system')).toBeInTheDocument();
    });

    it('should mark the 5e option as selected when ruleset is 5e', () => {
      render(<WizardStepRules {...mockProps} />);

      const option = screen.getByRole('heading', { name: '5th Edition (5e)' }).closest('.rules-option');
      expect(option).toHaveClass('selected');
    });

    it('should mark the 5e option as not selected when ruleset is 2024', () => {
      render(<WizardStepRules {...createMockProps({ ruleset: '2024' })} />);

      const option = screen.getByRole('heading', { name: '5th Edition (5e)' }).closest('.rules-option');
      expect(option).not.toHaveClass('selected');
    });
  });

  describe('2024 Rules (Essentials) option', () => {
    it('should render the 2024 option with its title, description, and features', () => {
      render(<WizardStepRules {...mockProps} />);

      expect(screen.getByRole('heading', { name: '2024 Rules (Essentials)' })).toBeInTheDocument();
      expect(screen.getByText(/The updated D&D ruleset/)).toBeInTheDocument();
      expect(screen.getByText('Revised spell mechanics')).toBeInTheDocument();
      expect(screen.getByText('Updated class features')).toBeInTheDocument();
      expect(screen.getByText('Improved ability improvements')).toBeInTheDocument();
      expect(screen.getByText('Modern subclass system')).toBeInTheDocument();
    });

    it('should mark the 2024 option as selected when ruleset is 2024', () => {
      render(<WizardStepRules {...createMockProps({ ruleset: '2024' })} />);

      const option = screen
        .getByRole('heading', { name: '2024 Rules (Essentials)' })
        .closest('.rules-option');
      expect(option).toHaveClass('selected');
    });

    it('should mark the 2024 option as not selected when ruleset is 5e', () => {
      render(<WizardStepRules {...mockProps} />);

      const option = screen
        .getByRole('heading', { name: '2024 Rules (Essentials)' })
        .closest('.rules-option');
      expect(option).not.toHaveClass('selected');
    });
  });

  describe('Selection switching', () => {
    it('should call onRulesetChange with 5e when the 5e option is clicked', () => {
      render(<WizardStepRules {...mockProps} />);

      const option = screen.getByRole('heading', { name: '5th Edition (5e)' }).closest('.rules-option');
      fireEvent.click(option);

      expect(mockProps.onRulesetChange).toHaveBeenCalledWith('5e');
    });

    it('should call onRulesetChange with 2024 when the 2024 option is clicked', () => {
      render(<WizardStepRules {...mockProps} />);

      const option = screen.getByRole('heading', { name: '2024 Rules (Essentials)' }).closest('.rules-option');
      fireEvent.click(option);

      expect(mockProps.onRulesetChange).toHaveBeenCalledWith('2024');
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
