import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WizardFooter from './WizardFooter.jsx';

describe('WizardFooter', () => {
  const createProps = (overrides = {}) => ({
    onCancel: vi.fn(),
    onPrevious: vi.fn(),
    onNext: vi.fn(),
    onSubmit: vi.fn(),
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('button visibility — first step', () => {
    it('shows Cancel (disabled) and Next on the first non-last step', () => {
      const { container } = render(<WizardFooter {...createProps()} isFirstStep isLastStep={false} />);
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Cancel' })).toHaveClass('btn btn-secondary');
      expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Next' })).toHaveClass('btn btn-primary');
      expect(screen.queryByRole('button', { name: 'Previous' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Create Character' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Save Changes' })).not.toBeInTheDocument();
      expect(container.querySelectorAll('button')).toHaveLength(2);
    });

    it('shows Cancel (disabled) and Create Character on the first+last step (single-step wizard, create mode)', () => {
      render(<WizardFooter {...createProps()} isFirstStep isLastStep />);
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Create Character' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Create Character' })).toHaveClass('btn btn-success');
      expect(screen.queryByRole('button', { name: 'Previous' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
    });

    it('shows Cancel (disabled) and Save Changes on the first+last step when editing', () => {
      render(<WizardFooter {...createProps()} isFirstStep isLastStep isEditing />);
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Save Changes' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Save Changes' })).toHaveClass('btn btn-success');
      expect(screen.queryByRole('button', { name: 'Previous' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Create Character' })).not.toBeInTheDocument();
    });

    it('disables Next when isNextDisabled on the first step', () => {
      render(<WizardFooter {...createProps()} isFirstStep isLastStep={false} isNextDisabled />);
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    });
  });

  describe('button visibility — non-first step', () => {
    it('shows Previous and Next on a middle step (not first, not last)', () => {
      render(<WizardFooter {...createProps()} isFirstStep={false} isLastStep={false} />);
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Previous' })).toHaveClass('btn btn-secondary');
      expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Next' })).toHaveClass('btn btn-primary');
      expect(screen.queryByRole('button', { name: 'Create Character' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Save Changes' })).not.toBeInTheDocument();
    });

    it('disables Next when isNextDisabled on first and middle steps', () => {
      render(<WizardFooter {...createProps()} isFirstStep isLastStep={false} isNextDisabled />);
      expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
      cleanup();
      render(<WizardFooter {...createProps()} isFirstStep={false} isLastStep={false} isNextDisabled />);
      expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    });

    it('shows Previous and Create Character on the last non-first step (create mode)', () => {
      render(<WizardFooter {...createProps()} isFirstStep={false} isLastStep />);
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Create Character' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Create Character' })).toHaveClass('btn btn-success');
      expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Save Changes' })).not.toBeInTheDocument();
    });

    it('shows Previous and Save Changes on the last non-first step when editing', () => {
      render(<WizardFooter {...createProps()} isFirstStep={false} isLastStep isEditing />);
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Save Changes' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Save Changes' })).toHaveClass('btn btn-success');
      expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Create Character' })).not.toBeInTheDocument();
    });
  });

  describe('callback invocation', () => {
    it('calls onPrevious when Previous is clicked', () => {
      const onPrevious = vi.fn();
      render(<WizardFooter {...createProps({ onPrevious })} isFirstStep={false} />);
      fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
      expect(onPrevious).toHaveBeenCalledTimes(1);
    });

    it('calls onNext when Next is clicked', () => {
      const onNext = vi.fn();
      render(<WizardFooter {...createProps({ onNext })} isLastStep={false} />);
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      expect(onNext).toHaveBeenCalledTimes(1);
    });

    it('calls onSubmit when Create Character is clicked', () => {
      const onSubmit = vi.fn();
      render(<WizardFooter {...createProps({ onSubmit })} isLastStep />);
      fireEvent.click(screen.getByRole('button', { name: 'Create Character' }));
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    it('calls onSubmit when Save Changes is clicked', () => {
      const onSubmit = vi.fn();
      render(<WizardFooter {...createProps({ onSubmit })} isLastStep isEditing />);
      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
  });

});
