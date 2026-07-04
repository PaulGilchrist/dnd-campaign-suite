// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import WizardFooter from './WizardFooter.jsx';

describe('WizardFooter', () => {
  const baseProps = {
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

  describe('button visibility', () => {
    it('renders Cancel (disabled) on the first step', () => {
      render(<WizardFooter {...baseProps} isFirstStep />);
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
      expect(screen.queryByRole('button', { name: 'Previous' })).not.toBeInTheDocument();
    });

    it('renders Previous on non-first steps', () => {
      render(<WizardFooter {...baseProps} isFirstStep={false} />);
      expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled();
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    });

    it('renders Next when not on the last step', () => {
      render(<WizardFooter {...baseProps} isLastStep={false} />);
      expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
      expect(screen.queryByRole('button', { name: 'Create Character' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Save Changes' })).not.toBeInTheDocument();
    });

    it('renders Create Character on the last step when not editing', () => {
      render(<WizardFooter {...baseProps} isLastStep isEditing={false} />);
      expect(screen.getByRole('button', { name: 'Create Character' })).toBeEnabled();
      expect(screen.queryByRole('button', { name: 'Save Changes' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
    });

    it('renders Save Changes on the last step when editing', () => {
      render(<WizardFooter {...baseProps} isLastStep isEditing />);
      expect(screen.getByRole('button', { name: 'Save Changes' })).toBeEnabled();
      expect(screen.queryByRole('button', { name: 'Create Character' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
    });
  });

  describe('button disabled states', () => {
    it('disables Next when isNextDisabled is true', () => {
      render(<WizardFooter {...baseProps} isLastStep={false} isNextDisabled />);
      expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    });
  });

  describe('callback invocation', () => {
    it('calls onPrevious when Previous is clicked', () => {
      render(<WizardFooter {...baseProps} isFirstStep={false} />);
      fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
      expect(baseProps.onPrevious).toHaveBeenCalledTimes(1);
      expect(baseProps.onCancel).not.toHaveBeenCalled();
    });

    it('calls onNext when Next is clicked', () => {
      render(<WizardFooter {...baseProps} isLastStep={false} />);
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      expect(baseProps.onNext).toHaveBeenCalledTimes(1);
    });

    it('calls onSubmit when Create Character is clicked', () => {
      render(<WizardFooter {...baseProps} isLastStep isEditing={false} />);
      fireEvent.click(screen.getByRole('button', { name: 'Create Character' }));
      expect(baseProps.onSubmit).toHaveBeenCalledTimes(1);
    });

    it('calls onSubmit when Save Changes is clicked', () => {
      render(<WizardFooter {...baseProps} isLastStep isEditing />);
      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
      expect(baseProps.onSubmit).toHaveBeenCalledTimes(1);
    });
  });

  describe('default prop values', () => {
    it('defaults isEditing to false (shows Create Character)', () => {
      const { rerender } = render(<WizardFooter {...baseProps} isLastStep />);
      expect(screen.getByRole('button', { name: 'Create Character' })).toBeInTheDocument();

      rerender(<WizardFooter {...baseProps} isLastStep isEditing />);
      expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();
    });

    it('defaults isNextDisabled to false (Next is enabled)', () => {
      render(<WizardFooter {...baseProps} isLastStep={false} />);
      expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
    });
  });
});
