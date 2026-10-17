// @maintained-by-ai
// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Popup from './popup.jsx';

// NOTE: sanitize.js is intentionally NOT mocked — it is pure and fast under
// jsdom (and covered by its own unit tests in services/ui/sanitize.test.js).
// Using the real sanitizer proves Popup actually routes html through it.

const renderPopup = (props = {}, ui = undefined) =>
  render(<Popup {...(ui ? { children: ui } : {})} {...props} />);

describe('Popup', () => {
  // ── Content rendering ──

  describe('content rendering', () => {
    it('renders safe HTML markup as real elements', () => {
      renderPopup({
        html: '<h3>Fireball</h3><ul><li><b>8d6</b> fire damage</li></ul>',
      });

      const overlay = screen.getByTestId('popup-overlay');
      expect(overlay.querySelector('h3')).toHaveTextContent('Fireball');
      expect(overlay.querySelector('li b')).toHaveTextContent('8d6');
    });

    it('strips dangerous markup instead of injecting it raw', () => {
      renderPopup({
        html: '<p>Safe</p><script>window.evil = true</script><img src=x onerror="steal()">',
      });

      const overlay = screen.getByTestId('popup-overlay');
      expect(overlay).toHaveTextContent('Safe');
      expect(overlay.querySelector('script')).toBeNull();
      expect(overlay.querySelector('[onerror]')).toBeNull();
    });

    it('renders children when no html is provided', () => {
      renderPopup({}, <span>Child Content</span>);

      expect(screen.getByText('Child Content')).toBeInTheDocument();
    });

    it('falls back to children when html is an empty string', () => {
      renderPopup({ html: '' }, <span>Child Content</span>);

      expect(screen.getByText('Child Content')).toBeInTheDocument();
    });

    it('prefers html over children when both are provided', () => {
      renderPopup({ html: '<b>HTML Content</b>' }, <span>Child Content</span>);

      expect(screen.getByText('HTML Content')).toBeInTheDocument();
      expect(screen.queryByText('Child Content')).not.toBeInTheDocument();
    });
  });

  // ── No click-to-dismiss behavior ──

  describe('no click dismissal', () => {
    it('does not close when the overlay background is clicked', () => {
      const handleClose = vi.fn();
      renderPopup({ html: '<b>Test Content</b>', onClickOrKeyDown: handleClose });

      fireEvent.click(screen.getByTestId('popup-overlay'));
      expect(handleClose).not.toHaveBeenCalled();
    });

    it.each(['.popup-modal', 'button', 'input'])(
      'does not close when content inside the popup (%s) is clicked',
      (selector) => {
        const handleClose = vi.fn();
        renderPopup(
          { onClickOrKeyDown: handleClose },
          <>
            <button type="button">Click Me</button>
            <input type="text" aria-label="Target name" />
          </>
        );

        fireEvent.click(screen.getByTestId('popup-overlay').querySelector(selector));
        expect(handleClose).not.toHaveBeenCalled();
      }
    );
  });

  // ── Footer Done button ──

  describe('footer Done button', () => {
    it('renders a Done button by default when onClickOrKeyDown is provided', () => {
      renderPopup({ html: '<b>Test Content</b>', onClickOrKeyDown: vi.fn() });

      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });

    it('closes exactly once when the Done button is clicked', () => {
      const handleClose = vi.fn();
      renderPopup({ html: '<b>Test Content</b>', onClickOrKeyDown: handleClose });

      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('does not render a Done button when showCloseButton is false', () => {
      renderPopup({
        html: '<b>Test Content</b>',
        onClickOrKeyDown: vi.fn(),
        showCloseButton: false,
      });

      expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
      // Content must still be visible without the close row.
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('does not render a Done button without a close handler', () => {
      renderPopup({ html: '<b>Test Content</b>' });

      expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    });
  });
});
