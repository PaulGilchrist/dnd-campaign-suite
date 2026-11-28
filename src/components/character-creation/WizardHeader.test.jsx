// @maintained-by-ai 2026-11-28
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import WizardHeader from './WizardHeader.jsx';

// Component lane only: WizardHeader is a generic pass-through of `title`
// and `onClose`. The wizard's title-building and close-wiring lanes live
// in CharacterCreationWizard.header.test.jsx / .close-guard.test.jsx.
describe('WizardHeader', () => {
  it('renders the title prop as the header heading', () => {
    render(<WizardHeader title="Edit Character" onClose={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Edit Character' })).toBeInTheDocument();
  });

  it('routes the × close button click to onClose exactly once', () => {
    const onClose = vi.fn();
    render(<WizardHeader title="Create New Character" onClose={onClose} />);
    const close = screen.getByRole('button', { name: 'Close character wizard' });
    // Lock the accessible name — the × glyph alone is unreadable to AT.
    expect(close).toHaveAttribute('aria-label', 'Close character wizard');
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
