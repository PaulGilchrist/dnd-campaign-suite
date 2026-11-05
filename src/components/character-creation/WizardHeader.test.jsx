// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import WizardHeader from './WizardHeader.jsx';

const createProps = (overrides = {}) => ({
  title: 'Create New Character',
  onClose: vi.fn(),
  ...overrides,
});

describe('WizardHeader', () => {
  it('renders the title prop as the header heading', () => {
    const props = createProps({ title: 'Edit Character' });
    render(<WizardHeader {...props} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Edit Character' })).toBeInTheDocument();
  });

  it('routes the × close button click to onClose exactly once', () => {
    const props = createProps();
    render(<WizardHeader {...props} />);
    const close = screen.getByRole('button', { name: 'Close character wizard' });
    // Lock the accessible name — the × glyph alone is unreadable to AT.
    expect(close).toHaveAttribute('aria-label', 'Close character wizard');
    expect(props.onClose).not.toHaveBeenCalled();
    fireEvent.click(close);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});
