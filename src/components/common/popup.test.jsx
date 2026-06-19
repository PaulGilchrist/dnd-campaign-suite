/* @improved-by-ai */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Popup from './Popup.jsx';

vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

describe('Popup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render popup overlay with sanitized HTML', () => {
    const handleClose = vi.fn();
    render(<Popup html="<b>Test Content</b>" onClickOrKeyDown={handleClose} />);

    expect(screen.getByTestId('popup-overlay')).toBeInTheDocument();
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('should render children when html prop is not provided', () => {
    const handleClose = vi.fn();
    render(<Popup onClickOrKeyDown={handleClose}><span>Child Content</span></Popup>);

    expect(screen.getByTestId('popup-overlay')).toBeInTheDocument();
    expect(screen.getByText('Child Content')).toBeInTheDocument();
  });

  it('should render children when html prop is empty string', () => {
    const handleClose = vi.fn();
    render(<Popup html="" onClickOrKeyDown={handleClose}><span>Fallback</span></Popup>);

    expect(screen.getByTestId('popup-overlay')).toBeInTheDocument();
    expect(screen.getByText('Fallback')).toBeInTheDocument();
  });

  it('should call onClickOrKeyDown when overlay is clicked', () => {
    const handleClose = vi.fn();
    render(<Popup html="<b>Test</b>" onClickOrKeyDown={handleClose} />);

    fireEvent.click(screen.getByTestId('popup-overlay'));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('should call onClickOrKeyDown when Escape key is pressed', () => {
    const handleClose = vi.fn();
    render(<Popup html="<b>Test</b>" onClickOrKeyDown={handleClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('should remove event listeners on unmount', () => {
    const handleClose = vi.fn();
    const { unmount } = render(<Popup html="<b>Test</b>" onClickOrKeyDown={handleClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);

    unmount();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('should call sanitizeHtml with provided HTML', async () => {
    const handleClose = vi.fn();
    render(<Popup html="<b>Safe HTML</b>" onClickOrKeyDown={handleClose} />);

    const { sanitizeHtml } = await import('../../services/ui/sanitize.js');
    expect(sanitizeHtml).toHaveBeenCalledWith('<b>Safe HTML</b>');
  });

  it('should set correct ARIA role on overlay', () => {
    const handleClose = vi.fn();
    render(<Popup html="<b>Test</b>" onClickOrKeyDown={handleClose} />);

    expect(screen.getByTestId('popup-overlay').getAttribute('role')).toBe('presentation');
  });

  it('should update event listener when onClickOrKeyDown callback changes', () => {
    const handleClose1 = vi.fn();
    const handleClose2 = vi.fn();
    const { rerender } = render(<Popup html="<b>Test</b>" onClickOrKeyDown={handleClose1} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(handleClose1).toHaveBeenCalledTimes(1);

    rerender(<Popup html="<b>Test</b>" onClickOrKeyDown={handleClose2} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(handleClose2).toHaveBeenCalledTimes(1);
    expect(handleClose1).toHaveBeenCalledTimes(1);
  });
});
