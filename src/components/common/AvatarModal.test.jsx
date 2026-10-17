// @maintained-by-ai
// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AvatarModal from './AvatarModal.jsx';

/** Render the modal with sensible defaults; pass props to override. */
const renderModal = (props = {}) =>
  render(<AvatarModal name="Gandalf" onClose={vi.fn()} {...props} />);

describe('AvatarModal', () => {
  describe('image display', () => {
    it('displays the image at the given path unchanged when no campaignName is set', () => {
      renderModal({ imagePath: '/images/gandalf.png' });

      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src', '/images/gandalf.png');
      expect(img).toHaveAttribute('alt', 'Gandalf');
    });

    it('prefers the image over the letter fallback when both are available', () => {
      renderModal({ imagePath: '/images/gandalf.png' });

      expect(screen.getByRole('img')).toBeInTheDocument();
      expect(screen.queryByText('G')).not.toBeInTheDocument();
    });

    it.each([
      ['https://example.com/gandalf.png'],
      ['http://example.com/gandalf.png'],
    ])('serves external URLs unchanged even when campaignName is set', (url) => {
      renderModal({ imagePath: url, campaignName: 'frostfall' });

      expect(screen.getByRole('img')).toHaveAttribute('src', url);
    });

    it('prefixes the campaign directory onto relative campaign image paths', () => {
      renderModal({ imagePath: 'images/npcs/gandalf.png', campaignName: 'frostfall' });

      expect(screen.getByRole('img')).toHaveAttribute(
        'src',
        'campaigns/frostfall/images/npcs/gandalf.png'
      );
    });

    // Documents current string-join behaviour: a leading slash on imagePath is
    // preserved, so the joined URL contains a double slash. Servers normalise
    // this, but the exact output is pinned here so a join refactor is deliberate.
    it('preserves a leading slash on the image path when joining the campaign directory', () => {
      renderModal({ imagePath: '/images/gandalf.png', campaignName: 'frostfall' });

      expect(screen.getByRole('img')).toHaveAttribute(
        'src',
        'campaigns/frostfall//images/gandalf.png'
      );
    });
  });

  describe('letter fallback', () => {
    it('shows the uppercased initial when no image is available', () => {
      renderModal({ name: 'gandalf' });

      expect(screen.getByText('G')).toBeInTheDocument();
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    it.each([['empty string', ''], ['null', null], ['undefined', undefined]])(
      'shows "?" when name is %s',
      (_label, name) => {
        renderModal({ name });

        expect(screen.getByText('?')).toBeInTheDocument();
        expect(screen.queryByRole('img')).not.toBeInTheDocument();
      }
    );

    it.each([['null', null], ['undefined', undefined]])(
      'shows the initial instead of an img element when imagePath is %s',
      (_label, imagePath) => {
        renderModal({ imagePath });

        expect(screen.getByText('G')).toBeInTheDocument();
        expect(screen.queryByRole('img')).not.toBeInTheDocument();
      }
    );
  });

  describe('closing', () => {
    it('calls onClose when the close button is clicked', () => {
      const handleClose = vi.fn();
      renderModal({ imagePath: '/images/gandalf.png', onClose: handleClose });

      fireEvent.click(screen.getByLabelText('Close'));
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when the overlay background is clicked', () => {
      const handleClose = vi.fn();
      renderModal({ onClose: handleClose });

      fireEvent.click(screen.getByTestId('avatar-modal-overlay'));
      expect(handleClose).not.toHaveBeenCalled();
    });

    it('does not close when a click bubbles up from the modal body', () => {
      const handleClose = vi.fn();
      renderModal({ imagePath: '/images/gandalf.png', onClose: handleClose });

      // Clicking the image bubbles up through the modal to the overlay.
      fireEvent.click(screen.getByRole('img'));
      expect(handleClose).not.toHaveBeenCalled();
      expect(screen.getByRole('img')).toBeInTheDocument();
    });

    it('calls onClose when Escape is pressed', () => {
      const handleClose = vi.fn();
      renderModal({ onClose: handleClose });

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it.each(['Enter', 'Tab', 'e'])(
      'ignores the %s key',
      (key) => {
        const handleClose = vi.fn();
        renderModal({ onClose: handleClose });

        fireEvent.keyDown(document, { key });
        expect(handleClose).not.toHaveBeenCalled();
      }
    );

    it('closes exactly once — repeat presses after the first do not re-fire onClose', () => {
      const handleClose = vi.fn();
      renderModal({ onClose: handleClose });

      fireEvent.keyDown(document, { key: 'Escape' });
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(handleClose).toHaveBeenCalledTimes(1);

      // Same guard applies after closing via the button.
      fireEvent.click(screen.getByLabelText('Close'));
      expect(handleClose).toHaveBeenCalledTimes(2);
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(handleClose).toHaveBeenCalledTimes(2);
    });

    it('no longer responds to Escape after the modal is unmounted', () => {
      const handleClose = vi.fn();
      const { unmount } = renderModal({ onClose: handleClose });

      unmount();
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(handleClose).not.toHaveBeenCalled();
    });
  });
});
