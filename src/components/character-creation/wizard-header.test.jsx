import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import WizardHeader from './wizard-header';

describe('WizardHeader', () => {
  it('should render the title', () => {
    render(<WizardHeader title="Test Title" onClose={() => {}} />);

    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('should render close button', () => {
    render(<WizardHeader title="Test Title" onClose={() => {}} />);

    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', () => {
    const mockOnClose = vi.fn();
    render(<WizardHeader title="Test Title" onClose={mockOnClose} />);

    fireEvent.click(screen.getByRole('button'));

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should render h2 element with title', () => {
    render(<WizardHeader title="Create Character" onClose={() => {}} />);

    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveTextContent('Create Character');
  });
});
