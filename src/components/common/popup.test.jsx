// @maintained-by-ai 2026-10-17
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

  // ── Modal-family dismissal law (backlog XE 2026-11-16) ──
  // A face with a plain close handler (every consumer's onClickOrKeyDown today)
  // answers Escape and a PURE backdrop click through the shared useModalDismiss
  // tier — identical to pressing its Done. A drag that starts inside the panel
  // (text selection released over the backdrop) never dismisses, and faces the
  // caller marks dismissable={false} (staged-damage popups: the
  // hit-popup-backdrop-void-guard) keep Escape AND backdrop fully inert.

  const overlay = () => screen.getByTestId('popup-overlay');
  const panel = () => overlay().querySelector('.popup-modal');
  const pureBackdropClick = () => {
    fireEvent.mouseDown(overlay());
    fireEvent.click(overlay());
  };

  describe('modal-family dismissal', () => {
    it('closes exactly once on a pure backdrop click (mousedown and click both on the overlay)', () => {
      const handleClose = vi.fn();
      renderPopup({ html: '<b>Test Content</b>', onClickOrKeyDown: handleClose });

      pureBackdropClick();
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('closes exactly once when Escape is pressed while focus lives in the panel', () => {
      const handleClose = vi.fn();
      renderPopup({ html: '<b>Test Content</b>', onClickOrKeyDown: handleClose });

      fireEvent.keyDown(panel(), { key: 'Escape' });
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('a dismissable popup pulls focus into its panel on open (Escape reachability)', () => {
      renderPopup({ html: '<b>Test Content</b>', onClickOrKeyDown: vi.fn() });

      expect(document.activeElement).toBe(panel());
    });

    it('does not dismiss when the drag started inside the panel (mousedown in panel, click on backdrop)', () => {
      const handleClose = vi.fn();
      renderPopup({ html: '<b>Test Content</b>', onClickOrKeyDown: handleClose });

      fireEvent.mouseDown(panel());
      fireEvent.click(overlay());
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

        const target = overlay().querySelector(selector);
        fireEvent.mouseDown(target);
        fireEvent.click(target);
        expect(handleClose).not.toHaveBeenCalled();
      }
    );
  });

  describe('guarded faces (dismissable={false}) stay fully inert', () => {
    it('does not close on a pure backdrop click', () => {
      const handleClose = vi.fn();
      renderPopup({ html: '<b>Test Content</b>', onClickOrKeyDown: handleClose, dismissable: false });

      pureBackdropClick();
      expect(handleClose).not.toHaveBeenCalled();
    });

    it('does not close on Escape', () => {
      const handleClose = vi.fn();
      renderPopup({ html: '<b>Test Content</b>', onClickOrKeyDown: handleClose, dismissable: false });

      fireEvent.keyDown(panel(), { key: 'Escape' });
      expect(handleClose).not.toHaveBeenCalled();
    });

    it('never steals focus on open (guarded chrome unchanged)', () => {
      renderPopup({ html: '<b>Test Content</b>', onClickOrKeyDown: vi.fn(), dismissable: false });

      expect(document.activeElement).not.toBe(panel());
    });
  });

  describe('faces without a close handler are inert', () => {
    it('backdrop click and Escape never fire anything without onClickOrKeyDown', () => {
      renderPopup({ html: '<b>Test Content</b>' });

      pureBackdropClick();
      fireEvent.keyDown(panel(), { key: 'Escape' });
      expect(panel()).toBeInTheDocument();
    });
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
