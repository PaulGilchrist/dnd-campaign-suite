// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AvatarModal from './AvatarModal.jsx';

describe('AvatarModal', () => {
  describe('image rendering', () => {
    it('should render the full-size image with correct src and alt', () => {
      render(<AvatarModal name="Gandalf" imagePath="/images/gandalf.png" onClose={vi.fn()} />);

      const img = screen.getByRole('img');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', '/images/gandalf.png');
      expect(img).toHaveAttribute('alt', 'Gandalf');
    });

    it('should render the image inside the avatar-modal container', () => {
      render(<AvatarModal name="Gandalf" imagePath="/images/gandalf.png" onClose={vi.fn()} />);

      expect(screen.getByRole('img').closest('.avatar-modal')).toBeInTheDocument();
    });
  });

  describe('initial fallback rendering', () => {
    it('should render the initial letter for a name', () => {
      render(<AvatarModal name="Gandalf" onClose={vi.fn()} />);
      expect(screen.getByText('G')).toBeInTheDocument();
    });

    it('should render "?" for an empty name', () => {
      render(<AvatarModal name="" onClose={vi.fn()} />);
      expect(screen.getByText('?')).toBeInTheDocument();
    });

    it('should render "?" for null name', () => {
      render(<AvatarModal name={null} onClose={vi.fn()} />);
      expect(screen.getByText('?')).toBeInTheDocument();
    });

    it('should render "?" for undefined name', () => {
      render(<AvatarModal name={undefined} onClose={vi.fn()} />);
      expect(screen.getByText('?')).toBeInTheDocument();
    });

    it('should uppercase the initial regardless of input case', () => {
      render(<AvatarModal name="gandalf" onClose={vi.fn()} />);
      expect(screen.getByText('G')).toBeInTheDocument();
    });

    it('should render the initial inside the avatar-modal-initial element', () => {
      render(<AvatarModal name="Gandalf" onClose={vi.fn()} />);

      const initial = screen.getByText('G');
      expect(initial).toHaveClass('avatar-modal-initial');
      expect(initial.closest('.avatar-modal')).toBeInTheDocument();
    });
  });

  describe('overlay and close interactions', () => {
    it('should render the overlay with correct testid', () => {
      render(<AvatarModal name="Gandalf" onClose={vi.fn()} />);
      expect(screen.getByTestId('avatar-modal-overlay')).toBeInTheDocument();
    });

    it('should set role="presentation" on the overlay', () => {
      render(<AvatarModal name="Gandalf" onClose={vi.fn()} />);
      expect(screen.getByTestId('avatar-modal-overlay')).toHaveAttribute('role', 'presentation');
    });

    it('should render a close button with aria-label', () => {
      render(<AvatarModal name="Gandalf" imagePath="/images/gandalf.png" onClose={vi.fn()} />);
      expect(screen.getByLabelText('Close')).toBeInTheDocument();
    });

    it('should call onClose when overlay is clicked', () => {
      const handleClose = vi.fn();
      render(<AvatarModal name="Gandalf" onClose={handleClose} />);

      fireEvent.click(screen.getByTestId('avatar-modal-overlay'));
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('should not call onClose when modal content is clicked', () => {
      const handleClose = vi.fn();
      render(<AvatarModal name="Gandalf" onClose={handleClose} />);

      const modalContent = screen.getByTestId('avatar-modal-overlay').querySelector('.avatar-modal');
      fireEvent.click(modalContent);
      expect(handleClose).not.toHaveBeenCalled();
    });

    it('should not call onClose when the image inside modal is clicked', () => {
      const handleClose = vi.fn();
      render(<AvatarModal name="Gandalf" imagePath="/images/gandalf.png" onClose={handleClose} />);

      fireEvent.click(screen.getByRole('img'));
      expect(handleClose).not.toHaveBeenCalled();
    });

    it('should call onClose when close button is clicked', () => {
      const handleClose = vi.fn();
      render(<AvatarModal name="Gandalf" onClose={handleClose} />);

      fireEvent.click(screen.getByLabelText('Close'));
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose on Escape keydown', () => {
      const handleClose = vi.fn();
      render(<AvatarModal name="Gandalf" onClose={handleClose} />);

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('should remove event listener on unmount', () => {
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

    it('should call onClose only once even if Escape is pressed multiple times', () => {
      const handleClose = vi.fn();
      render(<AvatarModal name="Gandalf" onClose={handleClose} />);

      fireEvent.keyDown(document, { key: 'Escape' });
      fireEvent.keyDown(document, { key: 'Escape' });
      fireEvent.keyDown(document, { key: 'Escape' });

      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });
});
