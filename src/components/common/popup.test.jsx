import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Popup from './popup.jsx';

vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

const { sanitizeHtml } = await import('../../services/ui/sanitize.js');

describe('Popup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Rendering ──

  describe('rendering', () => {
    it('renders popup overlay with sanitized HTML when html prop is provided', () => {
      const handleClose = vi.fn();
      render(<Popup html="<b>Test Content</b>" onClickOrKeyDown={handleClose} />);

      expect(screen.getByTestId('popup-overlay')).toBeInTheDocument();
      expect(screen.getByText('Test Content')).toBeInTheDocument();
      expect(sanitizeHtml).toHaveBeenCalledWith('<b>Test Content</b>');
    });

    it('renders children when html prop is not provided', () => {
      const handleClose = vi.fn();
      render(
        <Popup onClickOrKeyDown={handleClose}>
          <span>Child Content</span>
        </Popup>
      );

      expect(screen.getByTestId('popup-overlay')).toBeInTheDocument();
      expect(screen.getByText('Child Content')).toBeInTheDocument();
    });

    it('renders html over children when both are provided', () => {
      const handleClose = vi.fn();
      render(
        <Popup html="<b>HTML Content</b>" onClickOrKeyDown={handleClose}>
          <span>Child Content</span>
        </Popup>
      );

      expect(screen.getByText('HTML Content')).toBeInTheDocument();
      expect(screen.queryByText('Child Content')).not.toBeInTheDocument();
      expect(sanitizeHtml).toHaveBeenCalledWith('<b>HTML Content</b>');
    });

    it('renders nothing when neither html nor children are provided', () => {
      const handleClose = vi.fn();
      render(<Popup onClickOrKeyDown={handleClose} />);

      expect(screen.getByTestId('popup-overlay')).toBeInTheDocument();
      expect(screen.queryAllByText(/./).length).toBe(0);
    });

    it('applies popup-overlay and popup-modal CSS classes', () => {
      const handleClose = vi.fn();
      render(<Popup html="<b>Test</b>" onClickOrKeyDown={handleClose} />);

      expect(screen.getByTestId('popup-overlay')).toHaveClass('popup-overlay');
      expect(screen.getByTestId('popup-overlay').querySelector('.popup-modal')).toHaveClass('popup-modal');
    });
  });

  // ── Overlay click behavior ──

  describe('overlay click', () => {
    it('calls onClickOrKeyDown when overlay is clicked', () => {
      const handleClose = vi.fn();
      render(<Popup html="<b>Test</b>" onClickOrKeyDown={handleClose} />);

      fireEvent.click(screen.getByTestId('popup-overlay'));
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('does NOT call onClickOrKeyDown when the inner modal is clicked', () => {
      const handleClose = vi.fn();
      render(<Popup html="<b>Test</b>" onClickOrKeyDown={handleClose} />);

      const modal = screen.getByTestId('popup-overlay').querySelector('.popup-modal');
      fireEvent.click(modal);
      expect(handleClose).not.toHaveBeenCalled();
    });

    it('does NOT call onClickOrKeyDown when modal content is clicked', () => {
      const handleClose = vi.fn();
      render(<Popup html="<b>Test Content</b>" onClickOrKeyDown={handleClose} />);

      const modalContent = screen.getByTestId('popup-overlay').querySelector('.popup-modal > div');
      fireEvent.click(modalContent);
      expect(handleClose).not.toHaveBeenCalled();
    });
  });

  // ── Keyboard behavior ──

  describe('keyboard', () => {
    it('calls onClickOrKeyDown when any key is pressed', () => {
      const handleClose = vi.fn();
      render(<Popup html="<b>Test</b>" onClickOrKeyDown={handleClose} />);

      fireEvent.keyDown(document, { key: 'a' });
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClickOrKeyDown when Escape key is pressed', () => {
      const handleClose = vi.fn();
      render(<Popup html="<b>Test</b>" onClickOrKeyDown={handleClose} />);

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClickOrKeyDown when Enter key is pressed', () => {
      const handleClose = vi.fn();
      render(<Popup html="<b>Test</b>" onClickOrKeyDown={handleClose} />);

      fireEvent.keyDown(document, { key: 'Enter' });
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('only calls onClickOrKeyDown once per keypress even if handler re-adds listener', () => {
      const handleClose = vi.fn();
      render(<Popup html="<b>Test</b>" onClickOrKeyDown={handleClose} />);

      // First key press triggers the handler
      fireEvent.keyDown(document, { key: 'a' });
      expect(handleClose).toHaveBeenCalledTimes(1);

      // The handler removes the event listener, so a second keypress should not trigger it
      fireEvent.keyDown(document, { key: 'b' });
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('removes event listener on unmount', () => {
      const handleClose = vi.fn();
      const { unmount } = render(<Popup html="<b>Test</b>" onClickOrKeyDown={handleClose} />);

      unmount();

      // After unmount, keydown should not trigger the handler
      fireEvent.keyDown(document, { key: 'a' });
      expect(handleClose).not.toHaveBeenCalled();
    });
  });

  // ── Callback identity ──

  describe('callback behavior', () => {
    it('uses useCallback to memoize the handler', () => {
      const handleClose = vi.fn();
      const { rerender } = render(
        <Popup html="<b>Test</b>" onClickOrKeyDown={handleClose} />
      );

      // Re-render with same props should not change behavior
      rerender(<Popup html="<b>Test</b>" onClickOrKeyDown={handleClose} />);

      fireEvent.keyDown(document, { key: 'a' });
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('updates the event listener when onClickOrKeyDown changes', () => {
      const handleClose1 = vi.fn();
      const handleClose2 = vi.fn();

      const { rerender } = render(
        <Popup html="<b>Test</b>" onClickOrKeyDown={handleClose1} />
      );

      // The initial listener fires handleClose1
      fireEvent.keyDown(document, { key: 'a' });
      expect(handleClose1).toHaveBeenCalledTimes(1);

      // Switch to a new handler
      rerender(<Popup html="<b>Test</b>" onClickOrKeyDown={handleClose2} />);

      // Now the new listener fires handleClose2
      fireEvent.keyDown(document, { key: 'b' });
      expect(handleClose2).toHaveBeenCalledTimes(1);
    });
  });

  // ── sanitizeHtml behavior ──

  describe('sanitizeHtml integration', () => {
    it('passes html through sanitizeHtml before rendering', () => {
      const handleClose = vi.fn();
      const maliciousHtml = '<script>alert("xss")</script><b>Safe</b>';
      render(<Popup html={maliciousHtml} onClickOrKeyDown={handleClose} />);

      expect(sanitizeHtml).toHaveBeenCalledWith(maliciousHtml);
    });

    it('renders complex HTML with multiple allowed tags', () => {
      const handleClose = vi.fn();
      const complexHtml = '<h1>Title</h1><p>Para with <b>bold</b> and <i>italic</i></p><ul><li>Item</li></ul>';
      render(<Popup html={complexHtml} onClickOrKeyDown={handleClose} />);

      expect(screen.getByTestId('popup-overlay')).toBeInTheDocument();
      expect(sanitizeHtml).toHaveBeenCalledWith(complexHtml);
    });
  });

  // ── Role and accessibility ──

  describe('accessibility', () => {
    it('applies role="presentation" to the overlay', () => {
      const handleClose = vi.fn();
      render(<Popup html="<b>Test</b>" onClickOrKeyDown={handleClose} />);

      expect(screen.getByTestId('popup-overlay')).toHaveAttribute('role', 'presentation');
    });
  });
});
