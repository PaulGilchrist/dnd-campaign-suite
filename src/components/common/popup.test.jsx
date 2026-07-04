/* @cleaned-by-ai */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Popup from './Popup.jsx';

vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

describe('Popup', () => {
  it('renders popup overlay with sanitized HTML when html prop is provided', () => {
    const handleClose = vi.fn();
    render(<Popup html="<b>Test Content</b>" onClickOrKeyDown={handleClose} />);

    expect(screen.getByTestId('popup-overlay')).toBeInTheDocument();
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('renders children when html prop is not provided', () => {
    const handleClose = vi.fn();
    render(<Popup onClickOrKeyDown={handleClose}><span>Child Content</span></Popup>);

    expect(screen.getByTestId('popup-overlay')).toBeInTheDocument();
    expect(screen.getByText('Child Content')).toBeInTheDocument();
  });

  it('calls onClickOrKeyDown when overlay is clicked', () => {
    const handleClose = vi.fn();
    render(<Popup html="<b>Test</b>" onClickOrKeyDown={handleClose} />);

    fireEvent.click(screen.getByTestId('popup-overlay'));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClickOrKeyDown when Escape key is pressed', () => {
    const handleClose = vi.fn();
    render(<Popup html="<b>Test</b>" onClickOrKeyDown={handleClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
