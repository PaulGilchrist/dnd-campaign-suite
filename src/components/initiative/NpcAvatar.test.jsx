// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import NpcAvatar from './NpcAvatar.jsx';

vi.mock('../common/AvatarImage.jsx', () => ({
    default: vi.fn(({ name, imagePath, size: _size }) => {
        return (
            <div data-testid={`avatar-${name}`} className="avatar-wrapper">
                {imagePath ? <img src={imagePath} alt={name} /> : <span>{name?.charAt(0).toUpperCase() || '?'}</span>}
            </div>
        );
    }),
}));

describe('NpcAvatar', () => {
    let onClickMock;

    beforeEach(() => {
        onClickMock = vi.fn();
    });

    describe('rendering with image path', () => {
        it('should render AvatarImage with imagePath', () => {
            render(<NpcAvatar name="Goblin" imagePath="/images/goblin.png" onClick={onClickMock} />);
            expect(screen.getByTestId('avatar-Goblin')).toBeInTheDocument();
            expect(screen.getByTestId('avatar-Goblin').querySelector('img')).toHaveAttribute('src', '/images/goblin.png');
        });

        it('should render AvatarImage with imageUrl when imagePath is omitted', () => {
            render(<NpcAvatar name="Orc" imageUrl="https://example.com/orc.jpg" onClick={onClickMock} />);
            expect(screen.getByTestId('avatar-Orc').querySelector('img')).toHaveAttribute('src', 'https://example.com/orc.jpg');
        });

        it('should prefer imagePath over imageUrl', () => {
            render(
                <NpcAvatar
                    name="Troll"
                    imageUrl="https://example.com/troll.jpg"
                    imagePath="/images/troll.png"
                    onClick={onClickMock}
                />
            );
            expect(screen.getByTestId('avatar-Troll').querySelector('img')).toHaveAttribute('src', '/images/troll.png');
        });
    });

    describe('rendering without image', () => {
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

        it('should render first character of multi-word name', () => {
            render(<NpcAvatar name="Green Dragon" onClick={onClickMock} />);
            expect(screen.getByText('G')).toBeInTheDocument();
        });

        it('should render span for initial when only name is provided', () => {
            render(<NpcAvatar name="Mimic" onClick={onClickMock} />);
            expect(screen.getByText('M')).toBeInTheDocument();
        });
    });

    describe('onClick interaction', () => {
        it('should call onClick when npc-avatar container is clicked with image', () => {
            render(<NpcAvatar name="Goblin" imagePath="/images/goblin.png" onClick={onClickMock} />);
            fireEvent.click(screen.getByRole('img'));
            expect(onClickMock).toHaveBeenCalledTimes(1);
        });

        it('should call onClick when clicked without image', () => {
            render(<NpcAvatar name="Goblin" onClick={onClickMock} />);
            fireEvent.click(screen.getByText('G'));
            expect(onClickMock).toHaveBeenCalledTimes(1);
        });

        it('should not call onClick when onClick prop is not provided', () => {
            render(<NpcAvatar name="Goblin" imagePath="/images/goblin.png" />);
            fireEvent.click(screen.getByRole('img'));
            expect(onClickMock).not.toHaveBeenCalled();
        });

        it('should pass correct event to onClick', () => {
            render(<NpcAvatar name="Goblin" onClick={onClickMock} />);
            fireEvent.click(screen.getByText('G'));
            expect(onClickMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'click' }));
        });
    });

    describe('CSS class', () => {
        it('should always render with npc-avatar class', () => {
            render(<NpcAvatar name="Goblin" onClick={onClickMock} />);
            expect(screen.getByText('G').parentElement).toHaveClass('npc-avatar');
        });

        it('should render npc-avatar class when image is present', () => {
            render(<NpcAvatar name="Goblin" imagePath="/images/goblin.png" onClick={onClickMock} />);
            expect(screen.getByTestId('avatar-Goblin').parentElement).toHaveClass('npc-avatar');
        });
    });

    describe('edge cases', () => {
        it('should handle all props as null', () => {
            render(<NpcAvatar name={null} imageUrl={null} imagePath={null} onClick={null} />);
            expect(screen.getByText('?')).toBeInTheDocument();
        });

        it('should render AvatarImage when only imageUrl is provided', () => {
            render(<NpcAvatar name="Beholder" imageUrl="https://example.com/beholder.png" onClick={onClickMock} />);
            expect(screen.getByTestId('avatar-Beholder').querySelector('img')).toHaveAttribute('src', 'https://example.com/beholder.png');
        });
    });
});
