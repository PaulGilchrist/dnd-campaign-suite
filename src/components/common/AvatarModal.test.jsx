// @maintained-by-ai 2026-10-17
// @improved-by-ai
import { useState } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AvatarModal from './AvatarModal.jsx';

/** Render the modal with sensible defaults; pass props to override. */
const renderModal = (props = {}) =>
  render(<AvatarModal name="Gandalf" onClose={vi.fn()} {...props} />);

const panelEl = () =>
  screen.getByTestId('avatar-modal-overlay').querySelector('.avatar-modal');

// Consumer-shaped harness: the zoom mounts/unmounts through an open flag
// exactly like CreatureCard/MonsterCardModal/CharSummary, so close-lane focus
// restore rides the real unmount path.
function ZoomHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button data-testid="opener-avatar" onClick={() => setOpen(true)}>
        Goblin avatar
      </button>
      {open && (
        <AvatarModal
          name="Goblin"
          imagePath="/images/goblin.png"
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

// Open the zoom the way a keyboard user does: focus the avatar, then activate
// it while it still holds focus (jsdom clicks never move focus themselves).
const openFromAvatar = () => {
  const opener = screen.getByTestId('opener-avatar');
  opener.focus();
  fireEvent.click(opener);
  return opener;
};

// Flush the unmount's passive cleanup + any deferred restore faces.
const flush = () => act(async () => {});

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

  // Dangling-path degrade (backlog 2026-11-17 CD): a zoom whose image fails to
  // load converges onto the SAME letter-fallback branch an empty imagePath
  // already renders — never a persisted broken-image glyph on the full-screen
  // scrim. Detection mirrors AvatarImage (error event + naturalWidth probe).
  describe('failed image load (dangling path)', () => {
    it('shows the letter fallback when the zoomed image fails to load', () => {
      renderModal({ imagePath: '/images/missing.png' });
      fireEvent.error(screen.getByRole('img'));

      expect(screen.queryByRole('img')).not.toBeInTheDocument();
      expect(panelEl().querySelector('.avatar-modal-initial')).toHaveTextContent('G');
    });

    it('shows the letter fallback when a "successful" load decodes zero pixels', () => {
      renderModal({ imagePath: '/images/empty.png' });
      fireEvent.load(screen.getByRole('img'));

      expect(screen.queryByRole('img')).not.toBeInTheDocument();
      expect(screen.getByText('G')).toBeInTheDocument();
    });

    it('keeps the painting image on a successful load (no lingering fallback)', () => {
      renderModal({ imagePath: '/images/gandalf.png' });
      const img = screen.getByRole('img');
      Object.defineProperty(img, 'naturalWidth', { value: 494 });
      fireEvent.load(img);

      expect(screen.getByRole('img')).toHaveClass('avatar-modal-image');
      expect(panelEl().querySelector('.avatar-modal-initial')).toBeNull();
    });

    it('the degraded zoom still closes via the × lane', () => {
      const handleClose = vi.fn();
      renderModal({ imagePath: '/images/missing.png', onClose: handleClose });
      fireEvent.error(screen.getByRole('img'));

      fireEvent.click(screen.getByLabelText('Close'));
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('closing', () => {
    it('calls onClose when the close button is clicked', () => {
      const handleClose = vi.fn();
      renderModal({ imagePath: '/images/gandalf.png', onClose: handleClose });

      fireEvent.click(screen.getByLabelText('Close'));
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    // Backdrop dismiss lane (backlog 2026-11-16, modal-family law shared with
    // DeleteConfirmModal/quick-create): a PURE backdrop click — mousedown AND
    // click both on the overlay — routes to onClose. A drag that started inside
    // .avatar-modal (text selection released over the backdrop) never dismisses.
    it('calls onClose exactly once on a pure backdrop click (mousedown and click both on the overlay)', () => {
      const handleClose = vi.fn();
      renderModal({ onClose: handleClose });

      const overlay = screen.getByTestId('avatar-modal-overlay');
      fireEvent.mouseDown(overlay);
      fireEvent.click(overlay);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when a drag started inside the modal body and released over the backdrop', () => {
      const handleClose = vi.fn();
      renderModal({ imagePath: '/images/gandalf.png', onClose: handleClose });

      const overlay = screen.getByTestId('avatar-modal-overlay');
      fireEvent.mouseDown(screen.getByRole('img'));
      fireEvent.click(overlay);
      expect(handleClose).not.toHaveBeenCalled();
    });

    it('does not close when a backdrop press releases inside the modal body', () => {
      const handleClose = vi.fn();
      renderModal({ imagePath: '/images/gandalf.png', onClose: handleClose });

      fireEvent.mouseDown(screen.getByTestId('avatar-modal-overlay'));
      fireEvent.click(screen.getByRole('img'));
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

  // Keyboard tier (backlog 2026-11-16 YG): the shared Popup's on-open focus
  // pull + focusin retention, mirrored into the avatar zoom so an Enter-opened
  // overlay never leaves a keyboard user on the avatar behind it.
  describe('keyboard focus tier', () => {
    it('pulls focus into the .avatar-modal panel on open (any open lane)', () => {
      render(<ZoomHarness />);
      openFromAvatar();

      expect(document.activeElement).toBe(panelEl());
    });

    it('marks the panel programmatically focusable (tabIndex -1, no Tab stop)', () => {
      render(<ZoomHarness />);
      openFromAvatar();

      expect(panelEl()).toHaveAttribute('tabindex', '-1');
    });

    it('leaves focus alone once it is inside the zoom layer (× keeps focus)', () => {
      render(<ZoomHarness />);
      openFromAvatar();

      const closeButton = screen.getByRole('button', { name: 'Close' });
      closeButton.focus();
      expect(document.activeElement).toBe(closeButton);
    });

    it('re-claims the panel when a host remount steals focus after open', () => {
      render(<ZoomHarness />);
      const opener = openFromAvatar();

      // Native focus() so jsdom dispatches focusout/focusin exactly like the
      // live card re-key remount does (Popup's retention-steal face).
      opener.focus();
      expect(document.activeElement).toBe(panelEl());
    });

    it('Escape from inside the panel closes the zoom without tabbing first', () => {
      render(<ZoomHarness />);
      openFromAvatar();

      fireEvent.keyDown(panelEl(), { key: 'Escape' });
      expect(screen.queryByTestId('avatar-modal-overlay')).not.toBeInTheDocument();
    });

    it('Escape from the focused × closes the zoom', () => {
      render(<ZoomHarness />);
      openFromAvatar();

      const closeButton = screen.getByRole('button', { name: 'Close' });
      closeButton.focus();
      fireEvent.keyDown(closeButton, { key: 'Escape' });
      expect(screen.queryByTestId('avatar-modal-overlay')).not.toBeInTheDocument();
    });

    it('Escape restores focus to the avatar that opened the zoom', async () => {
      render(<ZoomHarness />);
      const opener = openFromAvatar();

      fireEvent.keyDown(panelEl(), { key: 'Escape' });
      await flush();
      expect(document.activeElement).toBe(opener);
    });

    it('the × click restores focus to the opening avatar too', async () => {
      render(<ZoomHarness />);
      const opener = openFromAvatar();

      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      await flush();
      expect(document.activeElement).toBe(opener);
    });

    it('a pure backdrop click closes and restores focus to the opening avatar', async () => {
      render(<ZoomHarness />);
      const opener = openFromAvatar();

      const overlay = screen.getByTestId('avatar-modal-overlay');
      fireEvent.mouseDown(overlay);
      fireEvent.click(overlay);
      await flush();
      expect(screen.queryByTestId('avatar-modal-overlay')).not.toBeInTheDocument();
      expect(document.activeElement).toBe(opener);
    });

    it('a vanished opener leaves focus on body (Popup close face) without throwing', () => {
      // Standalone opener (outside the React tree) so it can honestly detach
      // while the zoom is open — the card re-key/host-teardown face.
      const opener = document.createElement('button');
      document.body.appendChild(opener);
      opener.focus();
      const { unmount } = renderModal();
      expect(document.activeElement).toBe(panelEl());

      opener.remove();
      expect(() => unmount()).not.toThrow();
      expect(screen.queryByTestId('avatar-modal-overlay')).not.toBeInTheDocument();
      expect(document.activeElement).toBe(document.body);
    });
  });
});
