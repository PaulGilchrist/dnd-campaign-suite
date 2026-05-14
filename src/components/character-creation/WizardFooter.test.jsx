import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import WizardFooter from './WizardFooter.jsx';

describe('WizardFooter', () => {
  const defaultProps = {
    currentStep: 1,
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

  it('should render cancel button on first step', () => {
    render(<WizardFooter {...defaultProps} />);

    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('should render previous button when not on first step', () => {
    render(<WizardFooter {...defaultProps} isFirstStep={false} />);

    expect(screen.getByText('Previous')).toBeInTheDocument();
  });

  it('should disable cancel button on first step', () => {
    render(<WizardFooter {...defaultProps} />);

    expect(screen.getByText('Cancel')).toBeDisabled();
  });

  it('should call onPrevious when previous button is clicked', () => {
    render(<WizardFooter {...defaultProps} isFirstStep={false} />);

    fireEvent.click(screen.getByText('Previous'));

    expect(defaultProps.onPrevious).toHaveBeenCalled();
  });

  it('should render Next button when not on last step', () => {
    render(<WizardFooter {...defaultProps} />);

    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('should render Create Character button on last step when not editing', () => {
    render(<WizardFooter {...defaultProps} isLastStep={true} />);

    expect(screen.getByText('Create Character')).toBeInTheDocument();
  });

  it('should render Save Changes button on last step when editing', () => {
    render(<WizardFooter {...defaultProps} isLastStep={true} isEditing={true} />);

    expect(screen.getByText('Save Changes')).toBeInTheDocument();
  });

  it('should call onNext when Next button is clicked', () => {
    render(<WizardFooter {...defaultProps} />);

    fireEvent.click(screen.getByText('Next'));

    expect(defaultProps.onNext).toHaveBeenCalled();
  });

  it('should call onSubmit when Create Character button is clicked', () => {
    render(<WizardFooter {...defaultProps} isLastStep={true} />);

    fireEvent.click(screen.getByText('Create Character'));

    expect(defaultProps.onSubmit).toHaveBeenCalled();
  });

  it('should disable Next button when isNextDisabled is true', () => {
    render(<WizardFooter {...defaultProps} isNextDisabled={true} />);

    expect(screen.getByText('Next')).toBeDisabled();
  });

  it('should show Cancel button on first step', () => {
    render(<WizardFooter {...defaultProps} />);

    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.queryByText('Previous')).not.toBeInTheDocument();
  });
});
