import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AvatarModal from './AvatarModal.jsx';

describe('AvatarModal', () => {
    describe('with imagePath', () => {
        it('should render the full-size image', () => {
            render(<AvatarModal name="Gandalf" imagePath="/images/gandalf.png" onClose={vi.fn()} />);
            const img = screen.getByRole('img');
            expect(img).toBeInTheDocument();
            expect(img).toHaveAttribute('src', '/images/gandalf.png');
            expect(img).toHaveAttribute('alt', 'Gandalf');
        });

        it('should apply the avatar-modal-image class', () => {
            const { container } = render(<AvatarModal name="Gandalf" imagePath="/images/gandalf.png" onClose={vi.fn()} />);
            expect(container.querySelector('.avatar-modal-image')).toBeInTheDocument();
        });
    });

    describe('without imagePath (initial fallback)', () => {
        it('should render the initial letter', () => {
            render(<AvatarModal name="Gandalf" onClose={vi.fn()} />);
            expect(screen.getByText('G')).toBeInTheDocument();
            expect(screen.getByText('G').className).toBe('avatar-modal-initial');
        });

        it('should render "?" for empty name', () => {
            render(<AvatarModal name="" onClose={vi.fn()} />);
            expect(screen.getByText('?')).toBeInTheDocument();
        });

        it('should uppercase the initial', () => {
            render(<AvatarModal name="gandalf" onClose={vi.fn()} />);
            expect(screen.getByText('G')).toBeInTheDocument();
        });
    });

    describe('overlay and close', () => {
        it('should render the overlay with correct testid', () => {
            render(<AvatarModal name="Gandalf" onClose={vi.fn()} />);
            expect(screen.getByTestId('avatar-modal-overlay')).toBeInTheDocument();
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
            fireEvent.click(screen.getByTestId('avatar-modal-overlay').querySelector('.avatar-modal'));
            expect(handleClose).not.toHaveBeenCalled();
        });

        it('should call onClose when close button is clicked', () => {
            const handleClose = vi.fn();
            render(<AvatarModal name="Gandalf" onClose={handleClose} />);
            fireEvent.click(screen.getByLabelText('Close'));
            expect(handleClose).toHaveBeenCalledTimes(1);
        });

        it('should call onClose on keydown', () => {
            const handleClose = vi.fn();
            render(<AvatarModal name="Gandalf" onClose={handleClose} />);
            fireEvent.keyDown(document, { key: 'Escape' });
            expect(handleClose).toHaveBeenCalledTimes(1);
        });

        it('should remove event listener on unmount', () => {
            const handleClose = vi.fn();
            const { unmount } = render(<AvatarModal name="Gandalf" onClose={handleClose} />);
            unmount();
            fireEvent.keyDown(document, { key: 'Escape' });
            expect(handleClose).not.toHaveBeenCalled();
        });
    });
});
