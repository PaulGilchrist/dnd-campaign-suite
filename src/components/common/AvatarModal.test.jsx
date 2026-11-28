// @maintained-by-ai 2026-11-27 — shared avatar zoom: owns the src/letter branch
// wiring (branch-by-branch resolution is canonical in avatarSrc.test.js), the
// dangling-path degrade, the close lanes (×, one-shot document Escape, backdrop
// with the .avatar-modal drag guard), and the focus tier (pull/retain/restore —
// CreatureCard.avatarImagePopup.test.jsx explicitly defers these here; the
// arming decision lives at the CharSummary-AvatarZoomArming seam).
// panelEl() queries the .avatar-modal class on purpose: it is a behavioral
// contract (the panelSelector handed to useModalDismiss) as well as popup.css.
// Escape legs dispatch AT document/panel targets: a keydown targeted at
// document.body would also trip useModalDismiss's window-level rescue lane.
import { useState } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AvatarModal from './AvatarModal.jsx';

/** Render the modal with sensible defaults; pass props to override. */
const renderModal = (props = {}) =>
  render(<AvatarModal name="Grimtooth" onClose={vi.fn()} {...props} />);

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
  // Only the WIRING is pinned here: distinctively-named fixtures prove the
  // modal routes imagePath + campaignName into resolveAvatarSrc in that order
  // and paints the result; the falsy-src side drops to the letter branch.
  it('paints the campaign-prefixed resolved src named after the character, hiding the letter fallback', () => {
    renderModal({
      name: 'Mirkwood Bal',
      imagePath: 'images/npcs/mirkwood-bal.png',
      campaignName: 'my-campaign',
    });

    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'campaigns/my-campaign/images/npcs/mirkwood-bal.png');
    expect(img).toHaveAttribute('alt', 'Mirkwood Bal');
    expect(screen.queryByText('M')).not.toBeInTheDocument();
  });

  describe('letter fallback', () => {
    it('shows the uppercased initial when no image resolves', () => {
      renderModal({ name: 'mirkwood bal', imagePath: null });

      expect(screen.getByText('M')).toBeInTheDocument();
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    it('shows "?" when the name is empty', () => {
      renderModal({ name: '' });

      expect(screen.getByText('?')).toBeInTheDocument();
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });
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
      expect(screen.getByText('G')).toBeInTheDocument();
    });

    it('shows the letter fallback when a "successful" load decodes zero pixels', () => {
      renderModal({ imagePath: '/images/empty.png' });
      fireEvent.load(screen.getByRole('img'));

      expect(screen.queryByRole('img')).not.toBeInTheDocument();
      expect(screen.getByText('G')).toBeInTheDocument();
    });

    it('keeps the painting image on a successful load (no lingering fallback)', () => {
      renderModal({ imagePath: '/images/grimtooth.png' });
      const img = screen.getByRole('img');
      Object.defineProperty(img, 'naturalWidth', { value: 494 });
      fireEvent.load(img);

      expect(screen.getByRole('img')).toHaveAttribute('src', '/images/grimtooth.png');
      expect(screen.queryByText('G')).not.toBeInTheDocument();
    });
  });

  describe('closing', () => {
    it('calls onClose when the close button is clicked', () => {
      const handleClose = vi.fn();
      renderModal({ imagePath: '/images/grimtooth.png', onClose: handleClose });

      fireEvent.click(screen.getByLabelText('Close'));
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    // Backdrop dismiss lane (backlog 2026-11-16, modal-family law shared with
    // DeleteConfirmModal/quick-create): a PURE backdrop click — mousedown AND
    // click both on the overlay — routes to onClose. A drag that started
    // inside .avatar-modal (text selection released over the backdrop) never
    // dismisses, and neither does a click bubbling up from the panel body —
    // together these prove the panelSelector '.avatar-modal' is wired in.
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
      renderModal({ imagePath: '/images/grimtooth.png', onClose: handleClose });

      fireEvent.mouseDown(screen.getByRole('img'));
      fireEvent.click(screen.getByTestId('avatar-modal-overlay'));
      expect(handleClose).not.toHaveBeenCalled();
    });

    it('does not close when a click bubbles up from the modal body', () => {
      const handleClose = vi.fn();
      renderModal({ imagePath: '/images/grimtooth.png', onClose: handleClose });

      fireEvent.click(screen.getByRole('img'));
      expect(handleClose).not.toHaveBeenCalled();
      expect(screen.getByRole('img')).toBeInTheDocument();
    });

    // One-shot document Escape lane: the first press closes and removes the
    // listener, repeat presses are inert until a fresh gesture re-arms the
    // count, and unmounting unbinds entirely.
    it('closes exactly once per Escape gesture; repeat presses never re-fire onClose', () => {
      const handleClose = vi.fn();
      renderModal({ onClose: handleClose });

      fireEvent.keyDown(document, { key: 'Escape' });
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(handleClose).toHaveBeenCalledTimes(1);

      // The × lane still answers afterwards (listener removal rides onClose,
      // not a permanent kill switch).
      fireEvent.click(screen.getByLabelText('Close'));
      expect(handleClose).toHaveBeenCalledTimes(2);
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(handleClose).toHaveBeenCalledTimes(2);
    });

    it('ignores keydowns that are not Escape', () => {
      const handleClose = vi.fn();
      renderModal({ onClose: handleClose });

      fireEvent.keyDown(document, { key: 'Enter' });
      expect(handleClose).not.toHaveBeenCalled();
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
    it('pulls focus into the panel on open and marks it programmatically focusable (tabIndex -1, no Tab stop)', () => {
      render(<ZoomHarness />);
      openFromAvatar();

      expect(document.activeElement).toBe(panelEl());
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

    it('Escape from the focused × closes the zoom', () => {
      render(<ZoomHarness />);
      openFromAvatar();

      const closeButton = screen.getByRole('button', { name: 'Close' });
      closeButton.focus();
      fireEvent.keyDown(closeButton, { key: 'Escape' });
      expect(screen.queryByTestId('avatar-modal-overlay')).not.toBeInTheDocument();
    });

    // Every close lane (×, Escape, backdrop) funnels through the consumer's
    // open flag, so one restore leg rides the real unmount path.
    it('Escape restores focus to the avatar that opened the zoom', async () => {
      render(<ZoomHarness />);
      const opener = openFromAvatar();

      fireEvent.keyDown(panelEl(), { key: 'Escape' });
      await flush();
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
