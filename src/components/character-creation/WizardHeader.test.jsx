// @cleaned-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WizardHeader from './WizardHeader.jsx';

describe('WizardHeader', () => {
  const baseProps = {
    title: 'Test Title',
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the heading with the provided title', () => {
    render(<WizardHeader title="Create Character" onClose={() => {}} />);
    const heading = screen.getByRole('heading', { level: 2, name: 'Create Character' });
    expect(heading).toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', () => {
    render(<WizardHeader {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: '×' }));
    expect(baseProps.onClose).toHaveBeenCalledTimes(1);
  });
});
