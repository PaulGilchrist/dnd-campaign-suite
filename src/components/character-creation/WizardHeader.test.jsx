import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import WizardHeader from './WizardHeader.jsx';

describe('WizardHeader', () => {
  it('renders the heading with the provided title', () => {
    render(<WizardHeader title="Test Title" onClose={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Test Title' })).toBeInTheDocument();
  });

  it('renders the close button and calls onClose when clicked', () => {
    const onClose = vi.fn();
    render(<WizardHeader title="Test" onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: '×' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
