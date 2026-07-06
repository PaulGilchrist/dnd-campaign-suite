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

    it('should render AvatarImage when imagePath is provided', () => {
        render(<NpcAvatar name="Goblin" imagePath="/images/goblin.png" onClick={onClickMock} />);
        expect(screen.getByRole('img')).toHaveAttribute('src', '/images/goblin.png');
    });

    it('should render AvatarImage when imageUrl is provided', () => {
        render(<NpcAvatar name="Goblin" imageUrl="https://example.com/orc.jpg" onClick={onClickMock} />);
        expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/orc.jpg');
    });

    it('should render initial when no image is provided', () => {
        render(<NpcAvatar name="Goblin" onClick={onClickMock} />);
        expect(screen.getByText('G')).toBeInTheDocument();
    });

    it('should render question mark when name is falsy', () => {
        render(<NpcAvatar name={null} onClick={onClickMock} />);
        expect(screen.getByText('?')).toBeInTheDocument();
    });

    it('should call onClick when clicked', () => {
        render(<NpcAvatar name="Goblin" imagePath="/images/goblin.png" onClick={onClickMock} />);
        fireEvent.click(screen.getByRole('img'));
        expect(onClickMock).toHaveBeenCalledTimes(1);
    });
});
