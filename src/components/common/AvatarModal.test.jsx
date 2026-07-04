// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AvatarModal from './AvatarModal.jsx';

describe('AvatarModal', () => {
  describe('image rendering', () => {
    it('renders the full-size image with correct src and alt', () => {
      render(<AvatarModal name="Gandalf" imagePath="/images/gandalf.png" onClose={vi.fn()} />);

      const img = screen.getByRole('img');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', '/images/gandalf.png');
      expect(img).toHaveAttribute('alt', 'Gandalf');
    });
  });

  describe('initial fallback rendering', () => {
    it('renders the initial letter for a name, uppercased', () => {
      render(<AvatarModal name="gandalf" onClose={vi.fn()} />);
      expect(screen.getByText('G')).toBeInTheDocument();
    });

    it('renders "?" for empty, null, or undefined name', () => {
      const { rerender } = render(<AvatarModal name="" onClose={vi.fn()} />);
      expect(screen.getByText('?')).toBeInTheDocument();

      rerender(<AvatarModal name={null} onClose={vi.fn()} />);
      expect(screen.getByText('?')).toBeInTheDocument();

      rerender(<AvatarModal name={undefined} onClose={vi.fn()} />);
      expect(screen.getByText('?')).toBeInTheDocument();
    });
  });

  describe('overlay and close interactions', () => {
    it('renders a close button with aria-label', () => {
      render(<AvatarModal name="Gandalf" imagePath="/images/gandalf.png" onClose={vi.fn()} />);
      expect(screen.getByLabelText('Close')).toBeInTheDocument();
    });

    it('calls onClose when overlay is clicked', () => {
      const handleClose = vi.fn();
      render(<AvatarModal name="Gandalf" onClose={handleClose} />);

      fireEvent.click(screen.getByTestId('avatar-modal-overlay'));
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when close button is clicked', () => {
      const handleClose = vi.fn();
      render(<AvatarModal name="Gandalf" onClose={handleClose} />);

      fireEvent.click(screen.getByLabelText('Close'));
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when Escape is pressed', () => {
      const handleClose = vi.fn();
      render(<AvatarModal name="Gandalf" onClose={handleClose} />);

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose when modal content is clicked', () => {
      const handleClose = vi.fn();
      render(<AvatarModal name="Gandalf" onClose={handleClose} />);

      const modalContent = screen.getByTestId('avatar-modal-overlay').querySelector('.avatar-modal');
      fireEvent.click(modalContent);
      expect(handleClose).not.toHaveBeenCalled();
    });

    it('removes event listener on unmount', () => {
      const handleClose = vi.fn();
      const { unmount } = render(<AvatarModal name="Gandalf" onClose={handleClose} />);

      // Verify listener works before unmount
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(handleClose).toHaveBeenCalledTimes(1);

      unmount();

      // Listener should be removed after unmount
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });
});
