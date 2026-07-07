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
    let onClickMock;

    beforeEach(() => {
        onClickMock = vi.fn();
    });

    it('should render AvatarImage when an image source is provided', () => {
        render(<NpcAvatar name="Goblin" imageUrl="https://example.com/goblin.png" onClick={onClickMock} />);
        expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/goblin.png');
    });

    it('should render the first letter of the name when no image is provided', () => {
        render(<NpcAvatar name="Goblin" onClick={onClickMock} />);
        expect(screen.getByText('G')).toBeInTheDocument();
    });

    it('should render a question mark when name is falsy', () => {
        render(<NpcAvatar name={null} onClick={onClickMock} />);
        expect(screen.getByText('?')).toBeInTheDocument();
    });

    it('should call onClick when the avatar is clicked', () => {
        const { container } = render(<NpcAvatar name="Goblin" onClick={onClickMock} />);
        fireEvent.click(container.querySelector('.npc-avatar'));
        expect(onClickMock).toHaveBeenCalledTimes(1);
    });
});
