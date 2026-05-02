import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WizardFooter from './wizard-footer';

describe('WizardFooter', () => {
  const mockProps = {
    currentStep: 1,
    isFirstStep: false,
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

  it('should render the Previous button when not on first step', () => {
    render(<WizardFooter {...mockProps} />);

    expect(screen.getByText('Previous')).toBeInTheDocument();
    });

  it('should render the Cancel button when on first step', () => {
    const propsOnFirstStep = {
       ...mockProps,
      isFirstStep: true,
      };

    render(<WizardFooter {...propsOnFirstStep} />);

    expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

  it('should disable the Cancel/Previous button when on first step', () => {
    const propsOnFirstStep = {
       ...mockProps,
      isFirstStep: true,
      };

    render(<WizardFooter {...propsOnFirstStep} />);

    const cancelButton = screen.getByText('Cancel');
    expect(cancelButton).toBeDisabled();
    });

  it('should render the Next button when not on last step', () => {
    render(<WizardFooter {...mockProps} />);

    expect(screen.getByText('Next')).toBeInTheDocument();
    });

  it('should render the Create Character button when on last step', () => {
    const propsOnLastStep = {
       ...mockProps,
      isLastStep: true,
      };

    render(<WizardFooter {...propsOnLastStep} />);

    expect(screen.getByText('Create Character')).toBeInTheDocument();
    });

  it('should render the Save Changes button when on last step and editing', () => {
    const propsEditing = {
       ...mockProps,
      isLastStep: true,
      isEditing: true,
      };

    render(<WizardFooter {...propsEditing} />);

    expect(screen.getByText('Save Changes')).toBeInTheDocument();
    });

  it('should call onPrevious when Previous button is clicked', () => {
    render(<WizardFooter {...mockProps} />);

    fireEvent.click(screen.getByText('Previous'));

    expect(mockProps.onPrevious).toHaveBeenCalled();
    });

  it('should render Cancel button disabled when on first step', () => {
      const propsOnFirstStep = {
          ...mockProps,
        isFirstStep: true,
         };

    render(<WizardFooter {...propsOnFirstStep} />);

        // The button is disabled on first step
      const cancelButton = screen.getByText('Cancel');
      expect(cancelButton).toBeDisabled();
       });

  it('should call onNext when Next button is clicked', () => {
    render(<WizardFooter {...mockProps} />);

    fireEvent.click(screen.getByText('Next'));

    expect(mockProps.onNext).toHaveBeenCalled();
    });

  it('should call onSubmit when Create Character button is clicked', () => {
    const propsOnLastStep = {
       ...mockProps,
      isLastStep: true,
      };

    render(<WizardFooter {...propsOnLastStep} />);

    fireEvent.click(screen.getByText('Create Character'));

    expect(mockProps.onSubmit).toHaveBeenCalled();
    });

  it('should call onSubmit when Save Changes button is clicked', () => {
    const propsEditing = {
       ...mockProps,
      isLastStep: true,
      isEditing: true,
      };

    render(<WizardFooter {...propsEditing} />);

    fireEvent.click(screen.getByText('Save Changes'));

    expect(mockProps.onSubmit).toHaveBeenCalled();
    });

  it('should disable Next button when isNextDisabled is true', () => {
    const propsWithDisabledNext = {
       ...mockProps,
      isNextDisabled: true,
      };

    render(<WizardFooter {...propsWithDisabledNext} />);

    const nextButton = screen.getByText('Next');
    expect(nextButton).toBeDisabled();
    });

  it('should not disable Next button when isNextDisabled is false', () => {
    render(<WizardFooter {...mockProps} />);

    const nextButton = screen.getByText('Next');
    expect(nextButton).not.toBeDisabled();
    });

  it('should not show Cancel button when not on first step', () => {
    render(<WizardFooter {...mockProps} />);

    expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
    });

  it('should not show Create Character button when not on last step', () => {
    render(<WizardFooter {...mockProps} />);

    expect(screen.queryByText('Create Character')).not.toBeInTheDocument();
    });

  it('should not show Save Changes button when not editing', () => {
    const propsOnLastStep = {
       ...mockProps,
      isLastStep: true,
      isEditing: false,
      };

    render(<WizardFooter {...propsOnLastStep} />);

    expect(screen.queryByText('Save Changes')).not.toBeInTheDocument();
    });

  it('should render with default props', () => {
    render(<WizardFooter
      currentStep={0}
      isFirstStep={true}
      isLastStep={false}
      onCancel={vi.fn()}
      onPrevious={vi.fn()}
      onNext={vi.fn()}
      onSubmit={vi.fn()}
     />);

    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
    });
});