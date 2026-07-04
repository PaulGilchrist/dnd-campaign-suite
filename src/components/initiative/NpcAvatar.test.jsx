// @improved-by-ai
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

    describe('with image', () => {
        it.each([
            ['imagePath', '/images/goblin.png', undefined],
            ['imageUrl', undefined, 'https://example.com/orc.jpg'],
            ['imagePath preferred over imageUrl', '/images/troll.png', 'https://example.com/troll.jpg'],
        ])('should render AvatarImage with %s', (_, imagePath, imageUrl) => {
            render(<NpcAvatar name="Goblin" imagePath={imagePath} imageUrl={imageUrl} onClick={onClickMock} />);
            expect(screen.getByRole('img')).toHaveAttribute('src', imagePath || 'https://example.com/orc.jpg');
        });
    });

    describe('without image', () => {
        it.each([
            ['null', null],
            ['undefined', undefined],
            ['empty string', ''],
        ])('should render question mark when name is %s', (_, name) => {
            render(<NpcAvatar name={name} onClick={onClickMock} />);
            expect(screen.getByText('?')).toBeInTheDocument();
        });

        it('should render uppercase initial for name', () => {
            render(<NpcAvatar name="Goblin" onClick={onClickMock} />);
            expect(screen.getByText('G')).toBeInTheDocument();
        });

        it('should render the initial span', () => {
            render(<NpcAvatar name="Mimic" onClick={onClickMock} />);
            expect(screen.getByText('M').tagName).toBe('SPAN');
        });
    });

    describe('onClick', () => {
        it('should call onClick when clicked with image', () => {
            render(<NpcAvatar name="Goblin" imagePath="/images/goblin.png" onClick={onClickMock} />);
            fireEvent.click(screen.getByRole('img'));
            expect(onClickMock).toHaveBeenCalledTimes(1);
        });

        it('should call onClick when clicked without image', () => {
            render(<NpcAvatar name="Goblin" onClick={onClickMock} />);
            fireEvent.click(screen.getByText('G'));
            expect(onClickMock).toHaveBeenCalledTimes(1);
        });
    });

    describe('CSS class', () => {
        it('should render with npc-avatar class in both branches', () => {
            render(<NpcAvatar name="Goblin" imagePath="/images/goblin.png" onClick={onClickMock} />);
            expect(document.querySelector('.npc-avatar')).toBeTruthy();
        });
    });
});
