// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import WizardFooter from './WizardFooter.jsx';

describe('WizardFooter', () => {
  const baseProps = {
    isFirstStep: true,
    isLastStep: false,
    onCancel: vi.fn(),
    onPrevious: vi.fn(),
    onNext: vi.fn(),
    onSubmit: vi.fn(),
    isEditing: false,
    isNextDisabled: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('button rendering', () => {
    it('renders the wizard-footer container', () => {
      render(<WizardFooter {...baseProps} />);
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      const footer = screen.getByRole('button', { name: /cancel/i }).closest('.wizard-footer');
      expect(footer).toBeInTheDocument();
    });

    it('renders a Cancel button on the first step', () => {
      render(<WizardFooter {...baseProps} isFirstStep={true} />);
      const btn = screen.getByRole('button', { name: 'Cancel' });
      expect(btn).toBeInTheDocument();
      expect(btn).toHaveClass('btn btn-secondary');
    });

    it('renders a Previous button when not on the first step', () => {
      render(<WizardFooter {...baseProps} isFirstStep={false} />);
      const btn = screen.getByRole('button', { name: 'Previous' });
      expect(btn).toBeInTheDocument();
      expect(btn).toHaveClass('btn btn-secondary');
    });

    it('renders a Next button when not on the last step', () => {
      render(<WizardFooter {...baseProps} isLastStep={false} />);
      const btn = screen.getByRole('button', { name: 'Next' });
      expect(btn).toBeInTheDocument();
      expect(btn).toHaveClass('btn btn-primary');
    });

    it('renders a Create Character button on the last step when not editing', () => {
      render(<WizardFooter {...baseProps} isLastStep={true} isEditing={false} />);
      const btn = screen.getByRole('button', { name: 'Create Character' });
      expect(btn).toBeInTheDocument();
      expect(btn).toHaveClass('btn btn-success');
    });

    it('renders a Save Changes button on the last step when editing', () => {
      render(<WizardFooter {...baseProps} isLastStep={true} isEditing={true} />);
      const btn = screen.getByRole('button', { name: 'Save Changes' });
      expect(btn).toBeInTheDocument();
      expect(btn).toHaveClass('btn btn-success');
    });
  });

  describe('button disabled states', () => {
    it('disables the Cancel button on the first step', () => {
      render(<WizardFooter {...baseProps} isFirstStep={true} />);
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    });

    it('enables the Previous button when not on the first step', () => {
      render(<WizardFooter {...baseProps} isFirstStep={false} />);
      expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled();
    });

    it('disables the Next button when isNextDisabled is true', () => {
      render(<WizardFooter {...baseProps} isLastStep={false} isNextDisabled={true} />);
      expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    });

    it('enables the Next button when isNextDisabled is false', () => {
      render(<WizardFooter {...baseProps} isLastStep={false} isNextDisabled={false} />);
      expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
    });

    it('enables the Create Character button on the last step', () => {
      render(<WizardFooter {...baseProps} isLastStep={true} isEditing={false} />);
      expect(screen.getByRole('button', { name: 'Create Character' })).toBeEnabled();
    });

    it('enables the Save Changes button on the last step when editing', () => {
      render(<WizardFooter {...baseProps} isLastStep={true} isEditing={true} />);
      expect(screen.getByRole('button', { name: 'Save Changes' })).toBeEnabled();
    });
  });

  describe('callback invocation', () => {
    it('renders Cancel as a disabled button on the first step', () => {
      render(<WizardFooter {...baseProps} isFirstStep={true} />);
      expect(screen.getByRole('button', { name: 'Cancel' })).toHaveAttribute('disabled');
    });

    it('calls onPrevious when Previous button is clicked', () => {
      render(<WizardFooter {...baseProps} isFirstStep={false} />);
      fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
      expect(baseProps.onPrevious).toHaveBeenCalledTimes(1);
      expect(baseProps.onCancel).not.toHaveBeenCalled();
    });

    it('calls onNext when Next button is clicked', () => {
      render(<WizardFooter {...baseProps} isLastStep={false} />);
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      expect(baseProps.onNext).toHaveBeenCalledTimes(1);
    });

    it('calls onSubmit when Create Character button is clicked', () => {
      render(<WizardFooter {...baseProps} isLastStep={true} isEditing={false} />);
      fireEvent.click(screen.getByRole('button', { name: 'Create Character' }));
      expect(baseProps.onSubmit).toHaveBeenCalledTimes(1);
    });

    it('calls onSubmit when Save Changes button is clicked', () => {
      render(<WizardFooter {...baseProps} isLastStep={true} isEditing={true} />);
      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
      expect(baseProps.onSubmit).toHaveBeenCalledTimes(1);
    });
  });

  describe('mutual exclusivity', () => {
    it('shows Cancel but not Previous on the first step', () => {
      render(<WizardFooter {...baseProps} isFirstStep={true} />);
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Previous' })).not.toBeInTheDocument();
    });

    it('shows Previous but not Cancel when not on the first step and not on the last step', () => {
      render(<WizardFooter {...baseProps} isFirstStep={false} isLastStep={false} />);
      expect(screen.getByRole('button', { name: 'Previous' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    });

    it('shows Previous but not Cancel when not on the first step and on the last step', () => {
      render(<WizardFooter {...baseProps} isFirstStep={false} isLastStep={true} />);
      expect(screen.getByRole('button', { name: 'Previous' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    });

    it('shows Next but not Create Character or Save Changes when not on the last step', () => {
      render(<WizardFooter {...baseProps} isLastStep={false} />);
      expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Create Character' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Save Changes' })).not.toBeInTheDocument();
    });

    it('shows Create Character but not Save Changes or Next when on the last step and not editing', () => {
      render(<WizardFooter {...baseProps} isLastStep={true} isEditing={false} />);
      expect(screen.getByRole('button', { name: 'Create Character' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Save Changes' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
    });

    it('shows Save Changes but not Create Character or Next when on the last step and editing', () => {
      render(<WizardFooter {...baseProps} isLastStep={true} isEditing={true} />);
      expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Create Character' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
    });
  });

  describe('default prop values', () => {
    it('uses isEditing default of false', () => {
      const { rerender } = render(<WizardFooter {...baseProps} isLastStep={true} />);
      expect(screen.getByRole('button', { name: 'Create Character' })).toBeInTheDocument();

      rerender(<WizardFooter {...baseProps} isLastStep={true} isEditing={true} />);
      expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();
    });

    it('uses isNextDisabled default of false', () => {
      render(<WizardFooter {...baseProps} isLastStep={false} />);
      expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
    });
  });
});
