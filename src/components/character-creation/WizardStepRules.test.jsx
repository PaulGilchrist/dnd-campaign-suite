// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WizardStepRules from './WizardStepRules.jsx';

function createMockProps(overrides = {}) {
  return {
    ruleset: '5e',
    errors: {},
    onRulesetChange: overrides.onRulesetChange || vi.fn(),
    ...overrides,
  };
}

describe('WizardStepRules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render the step heading, description, and both ruleset options', () => {
      render(<WizardStepRules stepNumber={1} {...createMockProps()} />);
      expect(screen.getByRole('heading', { name: 'Select Rules System' })).toBeInTheDocument();
      expect(screen.getByText(/Choose which D&D ruleset your character will follow:/)).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: '5th Edition (5e)' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: '2024 Rules (Essentials)' })).toBeInTheDocument();
    });

    it('should render option content for both 5e and 2024', () => {
      render(<WizardStepRules stepNumber={1} {...createMockProps()} />);
      // 5e content
      expect(screen.getByText(/The classic D&D ruleset from 2014/)).toBeInTheDocument();
      expect(screen.getByText('Traditional spell slots')).toBeInTheDocument();
      expect(screen.getByText('Classic class features')).toBeInTheDocument();
      expect(screen.getByText('Standard ability improvements')).toBeInTheDocument();
      expect(screen.getByText('Original subclass system')).toBeInTheDocument();
      // 2024 content
      expect(screen.getByText(/The updated D&D ruleset/)).toBeInTheDocument();
      expect(screen.getByText('Revised spell mechanics')).toBeInTheDocument();
      expect(screen.getByText('Updated class features')).toBeInTheDocument();
      expect(screen.getByText('Improved ability improvements')).toBeInTheDocument();
      expect(screen.getByText('Modern subclass system')).toBeInTheDocument();
    });
  });

  describe('selection state', () => {
    it('should mark the matching ruleset option as selected', () => {
      render(<WizardStepRules stepNumber={1} {...createMockProps({ ruleset: '5e' })} />);
      expect(screen.getByTestId('rules-option-5e')).toHaveClass('selected');
      expect(screen.getByTestId('rules-option-2024')).not.toHaveClass('selected');
    });

    it('should mark the 2024 option as selected when ruleset is 2024', () => {
      render(<WizardStepRules stepNumber={1} {...createMockProps({ ruleset: '2024' })} />);
      expect(screen.getByTestId('rules-option-5e')).not.toHaveClass('selected');
      expect(screen.getByTestId('rules-option-2024')).toHaveClass('selected');
    });
  });

  describe('selection switching', () => {
    it('should call onRulesetChange with the clicked ruleset', () => {
      const onRulesetChange = vi.fn();
      render(<WizardStepRules stepNumber={1} {...createMockProps({ onRulesetChange })} />);
      fireEvent.click(screen.getByTestId('rules-option-5e'));
      expect(onRulesetChange).toHaveBeenCalledWith('5e');
    });

    it('should call onRulesetChange with 2024 when the 2024 option is clicked', () => {
      const onRulesetChange = vi.fn();
      render(<WizardStepRules stepNumber={1} {...createMockProps({ onRulesetChange })} />);
      fireEvent.click(screen.getByTestId('rules-option-2024'));
      expect(onRulesetChange).toHaveBeenCalledWith('2024');
    });

    it('should call onRulesetChange independently for each click', () => {
      const onRulesetChange = vi.fn();
      render(<WizardStepRules stepNumber={1} {...createMockProps({ onRulesetChange })} />);
      fireEvent.click(screen.getByTestId('rules-option-5e'));
      fireEvent.click(screen.getByTestId('rules-option-2024'));
      fireEvent.click(screen.getByTestId('rules-option-5e'));
      expect(onRulesetChange).toHaveBeenCalledWith('5e');
      expect(onRulesetChange).toHaveBeenCalledWith('2024');
      expect(onRulesetChange).toHaveBeenCalledWith('5e');
      expect(onRulesetChange).toHaveBeenCalledTimes(3);
    });
  });

  describe('error display', () => {
    it.each([
      [{ ruleset: 'Please select a ruleset' }, true],
      [{}, false],
      [undefined, false],
    ])('should %s an error message when errors is %j', (errors, shouldRender) => {
      render(<WizardStepRules stepNumber={1} {...createMockProps({ errors })} />);
      if (shouldRender) {
        const errorEl = screen.getByText('Please select a ruleset');
        expect(errorEl).toBeInTheDocument();
        expect(errorEl).toHaveClass('error-message');
      } else {
        expect(screen.queryByText('Please select a ruleset')).not.toBeInTheDocument();
      }
    });
  });
});
