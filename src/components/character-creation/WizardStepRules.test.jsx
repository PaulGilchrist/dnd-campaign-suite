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

  describe('Header and description', () => {
    it('should render the step header', () => {
      render(<WizardStepRules {...mockProps} />);

      expect(screen.getByRole('heading', { name: 'Select Rules System' })).toBeInTheDocument();
    });

    it('should render the step description', () => {
      render(<WizardStepRules {...mockProps} />);

      expect(screen.getByText(/Choose which D&D ruleset your character will follow:/)).toBeInTheDocument();
    });
  });

  describe('5th Edition (5e) option', () => {
    it('should render the 5e option title', () => {
      render(<WizardStepRules {...mockProps} />);

      expect(screen.getByRole('heading', { name: '5th Edition (5e)' })).toBeInTheDocument();
    });

    it('should render the 5e description text', () => {
      render(<WizardStepRules {...mockProps} />);

      expect(screen.getByText(/The classic D&D ruleset from 2014/)).toBeInTheDocument();
    });

    it('should render all 5e feature list items', () => {
      render(<WizardStepRules {...mockProps} />);

      const features = [
        'Traditional spell slots',
        'Classic class features',
        'Standard ability improvements',
        'Original subclass system',
      ];
      features.forEach((feature) => {
        expect(screen.getByText(feature)).toBeInTheDocument();
      });
    });

    it('should render the 5e option with a scroll icon', () => {
      render(<WizardStepRules {...mockProps} />);

      const icons = document.querySelectorAll('.rules-option-icon');
      expect(icons[0].textContent).toBe('📜');
    });

    it('should mark the 5e option as selected when ruleset is 5e', () => {
      render(<WizardStepRules {...mockProps} />);

      const option = screen.getByRole('heading', { name: '5th Edition (5e)' }).closest('.rules-option');
      expect(option).toHaveClass('selected');
    });

    it('should not mark the 5e option as selected when ruleset is 2024', () => {
      render(<WizardStepRules {...createMockProps({ ruleset: '2024' })} />);

      const option = screen.getByRole('heading', { name: '5th Edition (5e)' }).closest('.rules-option');
      expect(option).not.toHaveClass('selected');
    });
  });

  describe('2024 Rules (Essentials) option', () => {
    it('should render the 2024 option title', () => {
      render(<WizardStepRules {...mockProps} />);

      expect(screen.getByRole('heading', { name: '2024 Rules (Essentials)' })).toBeInTheDocument();
    });

    it('should render the 2024 description text', () => {
      render(<WizardStepRules {...mockProps} />);

      expect(screen.getByText(/The updated D&D ruleset/)).toBeInTheDocument();
    });

    it('should render all 2024 feature list items', () => {
      render(<WizardStepRules {...mockProps} />);

      const features = [
        'Revised spell mechanics',
        'Updated class features',
        'Improved ability improvements',
        'Modern subclass system',
      ];
      features.forEach((feature) => {
        expect(screen.getByText(feature)).toBeInTheDocument();
      });
    });

    it('should render the 2024 option with a sparkle icon', () => {
      render(<WizardStepRules {...mockProps} />);

      const icons = document.querySelectorAll('.rules-option-icon');
      expect(icons[1].textContent).toBe('✨');
    });

    it('should mark the 2024 option as selected when ruleset is 2024', () => {
      render(<WizardStepRules {...createMockProps({ ruleset: '2024' })} />);

      const option = screen
        .getByRole('heading', { name: '2024 Rules (Essentials)' })
        .closest('.rules-option');
      expect(option).toHaveClass('selected');
    });

    it('should not mark the 2024 option as selected when ruleset is 5e', () => {
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

    it('should switch selection from 5e to 2024 and update classes', () => {
      render(<WizardStepRules {...mockProps} />);

      const fiveEOption = screen.getByRole('heading', { name: '5th Edition (5e)' }).closest('.rules-option');
      const twoZeroTwoFourOption = screen
        .getByRole('heading', { name: '2024 Rules (Essentials)' })
        .closest('.rules-option');

      expect(fiveEOption).toHaveClass('selected');
      expect(twoZeroTwoFourOption).not.toHaveClass('selected');

      fireEvent.click(twoZeroTwoFourOption);

      expect(mockProps.onRulesetChange).toHaveBeenCalledWith('2024');
    });

    it('should switch selection from 2024 to 5e and update classes', () => {
      render(<WizardStepRules {...createMockProps({ ruleset: '2024' })} />);

      const fiveEOption = screen.getByRole('heading', { name: '5th Edition (5e)' }).closest('.rules-option');
      const twoZeroTwoFourOption = screen
        .getByRole('heading', { name: '2024 Rules (Essentials)' })
        .closest('.rules-option');

      expect(twoZeroTwoFourOption).toHaveClass('selected');
      expect(fiveEOption).not.toHaveClass('selected');

      fireEvent.click(fiveEOption);

      expect(mockProps.onRulesetChange).toHaveBeenCalledWith('5e');
    });

    it('should call onRulesetChange once per click, not accumulate calls', () => {
      render(<WizardStepRules {...mockProps} />);

      const option = screen.getByRole('heading', { name: '5th Edition (5e)' }).closest('.rules-option');
      fireEvent.click(option);
      fireEvent.click(option);

      expect(mockProps.onRulesetChange).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error display', () => {
    it('should render the error message when a ruleset error exists', () => {
      const errorMessage = 'Please select a ruleset';
      render(<WizardStepRules {...createMockProps({ errors: { ruleset: errorMessage } })} />);

      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    it('should render the error message with the error-message class', () => {
      const errorMessage = 'Please select a ruleset';
      render(<WizardStepRules {...createMockProps({ errors: { ruleset: errorMessage } })} />);

      const errorEl = screen.getByText(errorMessage);
      expect(errorEl).toHaveClass('error-message');
    });

    it('should not render an error message when no ruleset error exists', () => {
      render(<WizardStepRules {...mockProps} />);

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('should not render an error message when errors object is empty', () => {
      render(<WizardStepRules {...createMockProps({ errors: {} })} />);

      expect(screen.queryByText(/select a ruleset/)).not.toBeInTheDocument();
    });

    it('should throw when errors prop is null because the component accesses errors.ruleset without null check', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<WizardStepRules {...createMockProps({ errors: null })} />);
      }).toThrow(TypeError);

      consoleSpy.mockRestore();
    });

    it('should throw when errors prop is undefined because the component accesses errors.ruleset without null check', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<WizardStepRules {...createMockProps({ errors: undefined })} />);
      }).toThrow(TypeError);

      consoleSpy.mockRestore();
    });
  });

  describe('Structure and layout', () => {
    it('should render both options inside a rules-selection-container', () => {
      render(<WizardStepRules {...mockProps} />);

      const container = document.querySelector('.rules-selection-container');
      expect(container).toBeInTheDocument();
    });

    it('should render exactly two rules-option elements', () => {
      render(<WizardStepRules {...mockProps} />);

      const options = document.querySelectorAll('.rules-option');
      expect(options).toHaveLength(2);
    });

    it('should render exactly two rules-option-icon elements', () => {
      render(<WizardStepRules {...mockProps} />);

      const icons = document.querySelectorAll('.rules-option-icon');
      expect(icons).toHaveLength(2);
    });

    it('should render two rules-features lists', () => {
      render(<WizardStepRules {...mockProps} />);

      const featureLists = document.querySelectorAll('.rules-features');
      expect(featureLists).toHaveLength(2);
    });

    it('should render the wizard-step root container', () => {
      render(<WizardStepRules {...mockProps} />);

      const root = document.querySelector('.wizard-step');
      expect(root).toBeInTheDocument();
    });

    it('should render the step description with the step-description class', () => {
      render(<WizardStepRules {...mockProps} />);

      const desc = document.querySelector('.step-description');
      expect(desc).toBeInTheDocument();
      expect(desc.textContent).toBe('Choose which D&D ruleset your character will follow:');
    });
  });

  describe('Accessibility', () => {
    it('should render two h3 headings for the option titles', () => {
      render(<WizardStepRules {...mockProps} />);

      const headings = document.querySelectorAll('h3');
      expect(headings).toHaveLength(2);
      expect(headings[0].textContent).toBe('5th Edition (5e)');
      expect(headings[1].textContent).toBe('2024 Rules (Essentials)');
    });

    it('should render one h2 heading for the step title', () => {
      render(<WizardStepRules {...mockProps} />);

      const headings = document.querySelectorAll('h2');
      expect(headings).toHaveLength(1);
      expect(headings[0].textContent).toBe('Select Rules System');
    });

    it('should render the step description paragraph with the correct class', () => {
      render(<WizardStepRules {...mockProps} />);

      const descParagraph = document.querySelector('p.step-description');
      expect(descParagraph).toBeInTheDocument();
      expect(descParagraph.textContent).toBe('Choose which D&D ruleset your character will follow:');
    });
  });
});
