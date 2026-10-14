import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import NpcAvatar from './NpcAvatar.jsx';

vi.mock('../common/AvatarImage.jsx', () => ({
    default: vi.fn(({ name, imagePath }) => (
        <div data-testid={`avatar-${name}`} className="avatar-wrapper">
            <img src={imagePath} alt={name} />
        </div>
    )),
}));

describe('NpcAvatar', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('image rendering', () => {
        it('renders AvatarImage with imageUrl, and prioritizes imagePath over imageUrl', () => {
            const { rerender } = render(<NpcAvatar name="Goblin" imageUrl="https://example.com/goblin.png" />);
            expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/goblin.png');

            rerender(<NpcAvatar name="Goblin" imageUrl="https://example.com/old.png" imagePath="https://example.com/new.png" />);
            expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/new.png');
        });
    });

    describe('initial rendering', () => {
        it('renders the first letter of the name (uppercased) when no image is provided', () => {
            const { unmount } = render(<NpcAvatar name="Goblin" />);
            expect(screen.getByText('G')).toBeInTheDocument();
            unmount();

            render(<NpcAvatar name="goblin" />);
            expect(screen.getByText('G')).toBeInTheDocument();
        });

        it.each([
            [null],
            [''],
        ])('renders a question mark when name is %s', (name) => {
            render(<NpcAvatar name={name} />);
            expect(screen.getByText('?')).toBeInTheDocument();
        });
    });

    describe('interaction', () => {
        it('calls onClick when the avatar is clicked', () => {
            const onClickMock = vi.fn();
            const { container } = render(<NpcAvatar name="Goblin" onClick={onClickMock} />);
            fireEvent.click(container.querySelector('.npc-avatar'));
            expect(onClickMock).toHaveBeenCalledTimes(1);
        });
    });
});
