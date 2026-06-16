import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
        vi.clearAllMocks();
        onClickMock = vi.fn();
    });

    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    describe('rendering with image path', () => {
        it('should render npc-avatar container with imagePath', () => {
            render(
                <NpcAvatar
                    name="Goblin"
                    imagePath="/images/goblin.png"
                    onClick={onClickMock}
                />
            );
            const container = document.querySelector('.npc-avatar');
            expect(container).toBeInTheDocument();
            expect(container.querySelector('img')).toHaveAttribute('src', '/images/goblin.png');
        });

        it('should render npc-avatar container with imageUrl when imagePath is omitted', () => {
            render(
                <NpcAvatar
                    name="Orc"
                    imageUrl="https://example.com/orc.jpg"
                    onClick={onClickMock}
                />
            );
            const container = document.querySelector('.npc-avatar');
            expect(container).toBeInTheDocument();
            expect(container.querySelector('img')).toHaveAttribute('src', 'https://example.com/orc.jpg');
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
            const container = document.querySelector('.npc-avatar');
            expect(container.querySelector('img')).toHaveAttribute('src', '/images/troll.png');
        });

        it('should render AvatarImage component', () => {
            render(
                <NpcAvatar
                    name="Goblin"
                    imagePath="/images/goblin.png"
                    onClick={onClickMock}
                />
            );
            expect(screen.getByTestId('avatar-Goblin')).toBeInTheDocument();
        });
    });

    describe('rendering without image', () => {
        it('should render initial letter when no image is provided', () => {
            render(
                <NpcAvatar
                    name="Goblin"
                    onClick={onClickMock}
                />
            );
            expect(screen.getByText('G')).toBeInTheDocument();
        });

        it('should render initial letter for imageUrl fallback when no imagePath', () => {
            render(
                <NpcAvatar
                    name="Orc"
                    imageUrl="https://example.com/orc.jpg"
                    onClick={onClickMock}
                />
            );
            const container = document.querySelector('.npc-avatar');
            expect(container.querySelector('img')).toBeInTheDocument();
        });

        it('should render question mark when name is null', () => {
            render(
                <NpcAvatar
                    name={null}
                    onClick={onClickMock}
                />
            );
            expect(screen.getByText('?')).toBeInTheDocument();
        });

        it('should render question mark when name is undefined', () => {
            render(
                <NpcAvatar
                    name={undefined}
                    onClick={onClickMock}
                />
            );
            expect(screen.getByText('?')).toBeInTheDocument();
        });

        it('should render question mark when name is empty string', () => {
            render(
                <NpcAvatar
                    name=""
                    onClick={onClickMock}
                />
            );
            expect(screen.getByText('?')).toBeInTheDocument();
        });

        it('should render uppercase initial for lowercase name', () => {
            render(
                <NpcAvatar
                    name="goblin"
                    onClick={onClickMock}
                />
            );
            expect(screen.getByText('G')).toBeInTheDocument();
        });

        it('should render first character of multi-word name', () => {
            render(
                <NpcAvatar
                    name="Green Dragon"
                    onClick={onClickMock}
                />
            );
            expect(screen.getByText('G')).toBeInTheDocument();
        });
    });

    describe('onClick interaction', () => {
        it('should call onClick when npc-avatar container is clicked with image', () => {
            render(
                <NpcAvatar
                    name="Goblin"
                    imagePath="/images/goblin.png"
                    onClick={onClickMock}
                />
            );
            const container = document.querySelector('.npc-avatar');
            fireEvent.click(container);
            expect(onClickMock).toHaveBeenCalledTimes(1);
        });

        it('should call onClick when npc-avatar container is clicked without image', () => {
            render(
                <NpcAvatar
                    name="Goblin"
                    onClick={onClickMock}
                />
            );
            const container = document.querySelector('.npc-avatar');
            fireEvent.click(container);
            expect(onClickMock).toHaveBeenCalledTimes(1);
        });

        it('should not call onClick when onClick prop is not provided', () => {
            render(
                <NpcAvatar
                    name="Goblin"
                    imagePath="/images/goblin.png"
                />
            );
            const container = document.querySelector('.npc-avatar');
            fireEvent.click(container);
            // No error should occur and no mock should be called
            expect(onClickMock).not.toHaveBeenCalled();
        });

        it('should pass correct event to onClick', () => {
            render(
                <NpcAvatar
                    name="Goblin"
                    onClick={onClickMock}
                />
            );
            const container = document.querySelector('.npc-avatar');
            fireEvent.click(container);
            expect(onClickMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'click' }));
        });
    });

    describe('CSS class', () => {
        it('should always render with npc-avatar class', () => {
            render(<NpcAvatar name="Goblin" onClick={onClickMock} />);
            expect(document.querySelector('.npc-avatar')).toHaveClass('npc-avatar');
        });

        it('should render npc-avatar class when image is present', () => {
            render(
                <NpcAvatar
                    name="Goblin"
                    imagePath="/images/goblin.png"
                    onClick={onClickMock}
                />
            );
            expect(document.querySelector('.npc-avatar')).toHaveClass('npc-avatar');
        });
    });

    describe('edge cases', () => {
        it('should handle all props as null/undefined', () => {
            render(
                <NpcAvatar
                    name={null}
                    imageUrl={null}
                    imagePath={null}
                    onClick={null}
                />
            );
            expect(screen.getByText('?')).toBeInTheDocument();
        });

        it('should handle only imageUrl provided', () => {
            render(
                <NpcAvatar
                    name="Beholder"
                    imageUrl="https://example.com/beholder.png"
                    onClick={onClickMock}
                />
            );
            const container = document.querySelector('.npc-avatar');
            expect(container.querySelector('img')).toHaveAttribute('src', 'https://example.com/beholder.png');
        });

        it('should render span for initial when only name is provided', () => {
            render(<NpcAvatar name="Mimic" onClick={onClickMock} />);
            const container = document.querySelector('.npc-avatar');
            const span = container.querySelector('span');
            expect(span).toBeInTheDocument();
            expect(span).toHaveTextContent('M');
        });
    });
});
