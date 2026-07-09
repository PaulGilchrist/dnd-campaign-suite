// @cleaned-by-ai
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Players from './Players.jsx';

const CELL_SIZE = 50;

const makePlayer = (overrides = {}) => ({
    id: 'player-1',
    name: 'Thorin',
    gridX: 2,
    gridY: 3,
    ...overrides,
});

const makeCharacter = (overrides = {}) => ({
    name: 'Thorin',
    imagePath: 'images/thorin.png',
    ...overrides,
});

const gridCenterX = (gx) => gx * CELL_SIZE + CELL_SIZE / 2;
const gridCenterY = (gy) => gy * CELL_SIZE + CELL_SIZE / 2;

const renderComponent = (props, players = [], characters = []) =>
    render(
        <svg width={1200} height={800}>
            <Players
                players={players}
                characters={characters}
                gridCenterX={gridCenterX}
                gridCenterY={gridCenterY}
                isLocalhost={true}
                fog={undefined}
                dragging={undefined}
                handlePointerDown={vi.fn()}
                selectedPlayer={undefined}
                setSelectedPlayer={vi.fn()}
                campaignName="test-campaign"
                {...props}
            />
        </svg>
    );

describe('Players', () => {
    describe('empty / edge cases', () => {
        it('should render nothing when players array is empty', () => {
            const { container } = renderComponent({}, [], []);
            const groups = container.querySelectorAll('g.creature-group');
            expect(groups.length).toBe(0);
        });

        it('should not render image when characters array is undefined', () => {
            const player = makePlayer({ name: 'Thorin' });
            const { container } = renderComponent({}, [player], undefined);
            const image = container.querySelector('image.creature-image');
            expect(image).toBeNull();
            const initial = container.querySelector('text.creature-initial');
            expect(initial).toBeInTheDocument();
        });
    });

    describe('creature rendering', () => {
        it('should render multiple player creature-groups', () => {
            const players = [
                makePlayer({ id: 'p1', name: 'Thorin', gridX: 1, gridY: 1 }),
                makePlayer({ id: 'p2', name: 'Gimli', gridX: 3, gridY: 4 }),
                makePlayer({ id: 'p3', name: 'Legolas', gridX: 5, gridY: 2 }),
            ];
            const { container } = renderComponent({}, players, []);
            const groups = container.querySelectorAll('g.creature-group');
            expect(groups.length).toBe(3);
        });

        it('should render creature circle with correct cx and cy', () => {
            const player = makePlayer({ gridX: 2, gridY: 3 });
            const { container } = renderComponent({}, [player], []);
            const circle = container.querySelector('circle.creature-circle');
            expect(circle).toHaveAttribute('cx', String(gridCenterX(2)));
            expect(circle).toHaveAttribute('cy', String(gridCenterY(3)));
        });

        it('should render creature name text at correct position', () => {
            const player = makePlayer({ gridX: 2, gridY: 3 });
            const { container } = renderComponent({}, [player], []);
            const nameText = container.querySelector('text.creature-name');
            expect(nameText).toBeInTheDocument();
            expect(nameText).toHaveAttribute('x', String(gridCenterX(2)));
            expect(nameText).toHaveAttribute('y', String(gridCenterY(3) + 20 - 4));
        });

        it('should render correct player name in text', () => {
            const player = makePlayer({ name: 'Thorin' });
            const { container } = renderComponent({}, [player], []);
            const nameText = container.querySelector('text.creature-name');
            expect(nameText.textContent).toBe('Thorin');
        });

        it('should render creature initial when no character exists', () => {
            const player = makePlayer({ name: 'Thorin' });
            const { container } = renderComponent({}, [player], []);
            const initialText = container.querySelector('text.creature-initial');
            expect(initialText).toBeInTheDocument();
            expect(initialText.textContent).toBe('T');
        });

        it('should render uppercase initial from player name', () => {
            const player = makePlayer({ name: 'aragorn' });
            const { container } = renderComponent({}, [player], []);
            const initialText = container.querySelector('text.creature-initial');
            expect(initialText.textContent).toBe('A');
        });
    });

    describe('image rendering', () => {
        it('should render creature image when character has imagePath', () => {
            const player = makePlayer({ name: 'Thorin' });
            const character = makeCharacter();
            const { container } = renderComponent({}, [player], [character]);
            const image = container.querySelector('image.creature-image');
            expect(image).toBeInTheDocument();
            expect(image).toHaveAttribute('xlink:href', 'campaigns/test-campaign/images/thorin.png');
        });

        it('should not render image when character has no imagePath', () => {
            const player = makePlayer({ name: 'Thorin' });
            const character = makeCharacter({ imagePath: null });
            const { container } = renderComponent({}, [player], [character]);
            const image = container.querySelector('image.creature-image');
            expect(image).toBeNull();
            const initial = container.querySelector('text.creature-initial');
            expect(initial).toBeInTheDocument();
        });

        it('should match character by name to find image', () => {
            const player = makePlayer({ name: 'Thorin' });
            const character = makeCharacter({ name: 'Thorin', imagePath: 'images/thorin.png' });
            const otherCharacter = makeCharacter({ name: 'Gimli', imagePath: 'images/gimli.png' });
            const { container } = renderComponent({}, [player], [character, otherCharacter]);
            const image = container.querySelector('image.creature-image');
            expect(image).toHaveAttribute('xlink:href', 'campaigns/test-campaign/images/thorin.png');
        });
    });

    describe('clipPath', () => {
        it('should render clipPath with correct id format', () => {
            const player = makePlayer({ id: 'player-1' });
            const { container } = renderComponent({}, [player], []);
            const clipPath = container.querySelector('clipPath[id="creature-clip-player-1"]');
            expect(clipPath).toBeInTheDocument();
        });

        it('should render all players with correct clipPaths', () => {
            const players = [
                makePlayer({ id: 'p1', gridX: 0, gridY: 0 }),
                makePlayer({ id: 'p2', gridX: 1, gridY: 1 }),
                makePlayer({ id: 'p3', gridX: 2, gridY: 2 }),
            ];
            const { container } = renderComponent({}, players, []);
            const clipPaths = container.querySelectorAll('clipPath[id^="creature-clip-"]');
            expect(clipPaths.length).toBe(3);
        });
    });

    describe('dragging state', () => {
        it('should apply dragging class when player is being dragged', () => {
            const player = makePlayer({ id: 'player-1' });
            const dragging = { creatureId: 'player-1' };
            const { container } = renderComponent({ dragging }, [player], []);
            const circle = container.querySelector('circle.creature-circle');
            expect(circle).toHaveClass('dragging');
        });

        it('should not apply dragging class when different creature is being dragged', () => {
            const player = makePlayer({ id: 'player-1' });
            const dragging = { creatureId: 'player-2' };
            const { container } = renderComponent({ dragging }, [player], []);
            const circle = container.querySelector('circle.creature-circle');
            expect(circle).not.toHaveClass('dragging');
        });
    });

    describe('selected state', () => {
        it('should apply selected class when player is selected', () => {
            const player = makePlayer({ id: 'player-1' });
            const selectedPlayer = { id: 'player-1' };
            const { container } = renderComponent({ selectedPlayer }, [player], []);
            const circle = container.querySelector('circle.creature-circle');
            expect(circle).toHaveClass('selected');
        });

        it('should not apply selected class when different player is selected', () => {
            const player = makePlayer({ id: 'player-1' });
            const selectedPlayer = { id: 'player-2' };
            const { container } = renderComponent({ selectedPlayer }, [player], []);
            const circle = container.querySelector('circle.creature-circle');
            expect(circle).not.toHaveClass('selected');
        });

        it('should render selection highlight rect when player is selected', () => {
            const player = makePlayer({ id: 'player-1', gridX: 2, gridY: 3 });
            const selectedPlayer = { id: 'player-1' };
            const { container } = renderComponent({ selectedPlayer }, [player], []);
            const rect = container.querySelector('rect[stroke="#FFD700"]');
            expect(rect).toBeInTheDocument();
        });

        it('should not render selection highlight when no player is selected', () => {
            const player = makePlayer({ id: 'player-1' });
            const { container } = renderComponent({ selectedPlayer: null }, [player], []);
            const rect = container.querySelector('rect[stroke="#FFD700"]');
            expect(rect).toBeNull();
        });
    });

    describe('fog of war', () => {
        it('should hide creature from non-localhost when fog covers cell', () => {
            const player = makePlayer({ gridX: 2, gridY: 3 });
            const fog = new Set(['2,3']);
            const { container } = renderComponent({ isLocalhost: false, fog }, [player], []);
            const groups = container.querySelectorAll('g.creature-group');
            expect(groups.length).toBe(0);
        });

        it('should render creature for localhost even when fog covers cell', () => {
            const player = makePlayer({ gridX: 2, gridY: 3 });
            const fog = new Set(['2,3']);
            const { container } = renderComponent({ isLocalhost: true, fog }, [player], []);
            const groups = container.querySelectorAll('g.creature-group');
            expect(groups.length).toBeGreaterThan(0);
        });

        it('should render creature when fog is undefined', () => {
            const player = makePlayer({ gridX: 2, gridY: 3 });
            const { container } = renderComponent({ isLocalhost: false, fog: undefined }, [player], []);
            const groups = container.querySelectorAll('g.creature-group');
            expect(groups.length).toBeGreaterThan(0);
        });

        it('should not hide creature when fog does not cover cell', () => {
            const player = makePlayer({ gridX: 2, gridY: 3 });
            const fog = new Set(['5,5']);
            const { container } = renderComponent({ isLocalhost: false, fog }, [player], []);
            const groups = container.querySelectorAll('g.creature-group');
            expect(groups.length).toBeGreaterThan(0);
        });

        it('should render fog correctly when fog is a Set with multiple cells', () => {
            const players = [
                makePlayer({ id: 'p1', gridX: 1, gridY: 1 }),
                makePlayer({ id: 'p2', gridX: 2, gridY: 2 }),
                makePlayer({ id: 'p3', gridX: 3, gridY: 3 }),
            ];
            const fog = new Set(['1,1', '3,3']);
            const { container } = renderComponent({ isLocalhost: false, fog }, players, []);
            const groups = container.querySelectorAll('g.creature-group');
            expect(groups.length).toBe(1);
            const circle = groups[0].querySelector('circle.creature-circle');
            expect(circle).toHaveAttribute('cx', String(gridCenterX(2)));
        });
    });

    describe('event handling', () => {
        it('should call handlePointerDown on pointer down', () => {
            const player = makePlayer({ id: 'player-1' });
            const handlePointerDown = vi.fn();
            const { container } = renderComponent({ handlePointerDown }, [player], []);
            const group = container.querySelector('g.creature-group');
            group.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
            expect(handlePointerDown).toHaveBeenCalledWith(expect.any(Object), 'player-1');
        });

        it('should call setSelectedPlayer on context menu', () => {
            const player = makePlayer({ id: 'player-1' });
            const setSelectedPlayer = vi.fn();
            const { container } = renderComponent({ setSelectedPlayer }, [player], []);
            const circle = container.querySelector('circle.creature-circle');
            circle.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
            expect(setSelectedPlayer).toHaveBeenCalledWith(player);
        });
    });
});
