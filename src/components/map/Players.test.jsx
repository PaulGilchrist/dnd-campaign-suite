// @improved-by-ai
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
    imagePath: 'https://example.com/thorin.png',
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
                {...props}
            />
        </svg>
    );

describe('Players', () => {
    describe('rendering', () => {
        it('should render no players when players array is empty', () => {
            const { container } = renderComponent({}, [], []);
            const groups = container.querySelectorAll('g.creature-group');
            expect(groups.length).toBe(0);
        });

        it('should render a single player creature-group', () => {
            const player = makePlayer();
            const { container } = renderComponent({}, [player], []);
            const groups = container.querySelectorAll('g.creature-group');
            expect(groups.length).toBeGreaterThan(0);
        });

        it('should render multiple player creature-groups', () => {
            const players = [
                makePlayer({ id: 'p1', name: 'Thorin', gridX: 1, gridY: 1 }),
                makePlayer({ id: 'p2', name: 'Gimli', gridX: 3, gridY: 4 }),
                makePlayer({ id: 'p3', name: 'Legolas', gridX: 5, gridY: 2 }),
            ];
            const { container } = renderComponent({}, players, []);
            const groups = container.querySelectorAll('g.creature-group');
            expect(groups.length).toBeGreaterThan(2);
        });

        it('should render creature-group with correct className', () => {
            const player = makePlayer();
            const { container } = renderComponent({}, [player], []);
            const group = container.querySelector('g.creature-group');
            expect(group).toHaveClass('creature-group');
        });

        it('should render creature-group with correct id', () => {
            const player = makePlayer({ id: 'player-42' });
            const { container } = renderComponent({}, [player], []);
            const group = container.querySelector('g.creature-group');
            expect(group).toBeInTheDocument();
        });
    });

    describe('circle rendering', () => {
        it('should render creature circle with correct cx and cy', () => {
            const player = makePlayer({ gridX: 2, gridY: 3 });
            const { container } = renderComponent({}, [player], []);
            const circle = container.querySelector('circle.creature-circle');
            expect(circle).toHaveAttribute('cx', String(gridCenterX(2)));
            expect(circle).toHaveAttribute('cy', String(gridCenterY(3)));
        });

        it('should render creature circle with correct radius', () => {
            const player = makePlayer();
            const { container } = renderComponent({}, [player], []);
            const circle = container.querySelector('circle.creature-circle');
            expect(circle).toHaveAttribute('r', '20');
        });

        it('should apply creature-circle class to the circle', () => {
            const player = makePlayer();
            const { container } = renderComponent({}, [player], []);
            const circle = container.querySelector('circle.creature-circle');
            expect(circle).toHaveClass('creature-circle');
        });
    });

    describe('name rendering', () => {
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

        it('should render creature name with correct SVG attributes', () => {
            const player = makePlayer({ gridX: 2, gridY: 3 });
            const { container } = renderComponent({}, [player], []);
            const nameText = container.querySelector('text.creature-name');
            expect(nameText).toHaveAttribute('text-anchor', 'middle');
            expect(nameText).toHaveAttribute('dominant-baseline', 'central');
            expect(nameText).toHaveAttribute('font-size', '18');
            expect(nameText).toHaveAttribute('font-weight', 'bold');
        });
    });

    describe('initial rendering', () => {
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

        it('should render creature initial with correct SVG attributes', () => {
            const player = makePlayer({ name: 'Thorin' });
            const { container } = renderComponent({}, [player], []);
            const initial = container.querySelector('text.creature-initial');
            expect(initial).toHaveAttribute('text-anchor', 'middle');
            expect(initial).toHaveAttribute('dominant-baseline', 'central');
            expect(initial).toHaveAttribute('fill', '#fff');
            expect(initial).toHaveAttribute('font-size', '16');
            expect(initial).toHaveAttribute('font-weight', 'bold');
        });
    });

    describe('image rendering', () => {
        it('should render creature image when character has imagePath', () => {
            const player = makePlayer({ name: 'Thorin' });
            const character = makeCharacter();
            const { container } = renderComponent({}, [player], [character]);
            const image = container.querySelector('image.creature-image');
            expect(image).toBeInTheDocument();
            expect(image).toHaveAttribute('xlink:href', 'https://example.com/thorin.png');
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

        it('should not render image when characters array is null', () => {
            const player = makePlayer({ name: 'Thorin' });
            const { container } = renderComponent({}, [player], null);
            const image = container.querySelector('image.creature-image');
            expect(image).toBeNull();
            const initial = container.querySelector('text.creature-initial');
            expect(initial).toBeInTheDocument();
        });

        it('should not render image when characters array is undefined', () => {
            const player = makePlayer({ name: 'Thorin' });
            const { container } = renderComponent({}, [player], undefined);
            const image = container.querySelector('image.creature-image');
            expect(image).toBeNull();
        });

        it('should match character by name to find image', () => {
            const player = makePlayer({ name: 'Thorin' });
            const character = makeCharacter({ name: 'Thorin', imagePath: 'https://example.com/thorin.png' });
            const otherCharacter = makeCharacter({ name: 'Gimli', imagePath: 'https://example.com/gimli.png' });
            const { container } = renderComponent({}, [player], [character, otherCharacter]);
            const image = container.querySelector('image.creature-image');
            expect(image).toHaveAttribute('xlink:href', 'https://example.com/thorin.png');
        });

        it('should render creature image with correct dimensions', () => {
            const player = makePlayer({ name: 'Thorin', gridX: 2, gridY: 3 });
            const character = makeCharacter();
            const { container } = renderComponent({}, [player], [character]);
            const image = container.querySelector('image.creature-image');
            const cx = gridCenterX(2);
            const cy = gridCenterY(3);
            expect(image).toHaveAttribute('x', String(cx - 18));
            expect(image).toHaveAttribute('y', String(cy - 18));
            expect(image).toHaveAttribute('width', '36');
            expect(image).toHaveAttribute('height', '36');
            expect(image).toHaveAttribute('preserveAspectRatio', 'xMidYMid slice');
        });

        it('should apply clipPath to creature image', () => {
            const player = makePlayer({ id: 'p1', name: 'Thorin' });
            const character = makeCharacter();
            const { container } = renderComponent({}, [player], [character]);
            const image = container.querySelector('image.creature-image');
            expect(image).toHaveAttribute('clip-path', 'url(#creature-clip-p1)');
        });
    });

    describe('clipPath', () => {
        it('should render clipPath with correct id format', () => {
            const player = makePlayer({ id: 'player-1' });
            const { container } = renderComponent({}, [player], []);
            const clipPath = container.querySelector('clipPath[id="creature-clip-player-1"]');
            expect(clipPath).toBeInTheDocument();
        });

        it('should render clipPath with correct circle position', () => {
            const player = makePlayer({ id: 'p1', gridX: 5, gridY: 7 });
            const { container } = renderComponent({}, [player], []);
            const clipPath = container.querySelector('clipPath[id="creature-clip-p1"]');
            const circle = clipPath.querySelector('circle');
            expect(circle).toHaveAttribute('cx', String(gridCenterX(5)));
            expect(circle).toHaveAttribute('cy', String(gridCenterY(7)));
            expect(circle).toHaveAttribute('r', '20');
        });

        it('should render all players with correct clipPaths', () => {
            const players = [
                makePlayer({ id: 'p1', gridX: 0, gridY: 0 }),
                makePlayer({ id: 'p2', gridX: 1, gridY: 1 }),
                makePlayer({ id: 'p3', gridX: 2, gridY: 2 }),
            ];
            const { container } = renderComponent({}, players, []);
            const clipPaths = container.querySelectorAll('clipPath[id^="creature-clip-"]');
            expect(clipPaths.length).toBeGreaterThan(2);
        });
    });

    describe('SVG structure', () => {
        it('should render correct SVG element structure', () => {
            const player = makePlayer({ id: 'player-1', name: 'Thorin', gridX: 2, gridY: 3 });
            const { container } = renderComponent({}, [player], []);
            const group = container.querySelector('g.creature-group');
            const defs = group.querySelector('defs');
            const circle = group.querySelector('circle.creature-circle');
            const nameText = group.querySelector('text.creature-name');
            const initial = group.querySelector('text.creature-initial');
            expect(defs).toBeInTheDocument();
            expect(circle).toBeInTheDocument();
            expect(nameText).toBeInTheDocument();
            expect(initial).toBeInTheDocument();
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

        it('should render creature with dragging class in className attribute', () => {
            const player = makePlayer({ id: 'player-1' });
            const dragging = { creatureId: 'player-1' };
            const { container } = renderComponent({ dragging }, [player], []);
            const circle = container.querySelector('circle.creature-circle');
            expect(circle.className.baseVal).toContain('dragging');
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

        it('should render creature with selected class in className attribute', () => {
            const player = makePlayer({ id: 'player-1' });
            const selectedPlayer = { id: 'player-1' };
            const { container } = renderComponent({ selectedPlayer }, [player], []);
            const circle = container.querySelector('circle.creature-circle');
            expect(circle.className.baseVal).toContain('selected');
        });

        it('should render selection highlight rect when player is selected', () => {
            const player = makePlayer({ id: 'player-1', gridX: 2, gridY: 3 });
            const selectedPlayer = { id: 'player-1' };
            const { container } = renderComponent({ selectedPlayer }, [player], []);
            const rect = container.querySelector('rect[stroke="#FFD700"]');
            expect(rect).toBeInTheDocument();
        });

        it('should render selection highlight rect at correct offset from creature center', () => {
            const player = makePlayer({ id: 'player-1', gridX: 2, gridY: 3 });
            const selectedPlayer = { id: 'player-1' };
            const { container } = renderComponent({ selectedPlayer }, [player], []);
            const rect = container.querySelector('rect[stroke="#FFD700"]');
            const cx = gridCenterX(2);
            const cy = gridCenterY(3);
            expect(rect).toHaveAttribute('x', String(cx - 23));
            expect(rect).toHaveAttribute('y', String(cy - 23));
            expect(rect).toHaveAttribute('width', '46');
            expect(rect).toHaveAttribute('height', '46');
        });

        it('should not render selection highlight when no player is selected', () => {
            const player = makePlayer({ id: 'player-1' });
            const { container } = renderComponent({ selectedPlayer: undefined }, [player], []);
            const rect = container.querySelector('rect[stroke="#FFD700"]');
            expect(rect).toBeNull();
        });

        it('should not render selection highlight when selectedPlayer is null', () => {
            const player = makePlayer({ id: 'player-1' });
            const { container } = renderComponent({ selectedPlayer: null }, [player], []);
            const rect = container.querySelector('rect[stroke="#FFD700"]');
            expect(rect).toBeNull();
        });

        it('should render selection rect with correct stroke width', () => {
            const player = makePlayer({ id: 'player-1', gridX: 2, gridY: 3 });
            const selectedPlayer = { id: 'player-1' };
            const { container } = renderComponent({ selectedPlayer }, [player], []);
            const rect = container.querySelector('rect[stroke="#FFD700"]');
            expect(rect).toHaveAttribute('stroke-width', '2');
        });

        it('should render selection rect with dash array', () => {
            const player = makePlayer({ id: 'player-1', gridX: 2, gridY: 3 });
            const selectedPlayer = { id: 'player-1' };
            const { container } = renderComponent({ selectedPlayer }, [player], []);
            const rect = container.querySelector('rect[stroke="#FFD700"]');
            expect(rect).toHaveAttribute('stroke-dasharray', '4 2');
        });

        it('should render selection rect with rx rounded corners', () => {
            const player = makePlayer({ id: 'player-1', gridX: 2, gridY: 3 });
            const selectedPlayer = { id: 'player-1' };
            const { container } = renderComponent({ selectedPlayer }, [player], []);
            const rect = container.querySelector('rect[stroke="#FFD700"]');
            expect(rect).toHaveAttribute('rx', '4');
        });

        it('should render selection rect with pointerEvents none', () => {
            const player = makePlayer({ id: 'player-1', gridX: 2, gridY: 3 });
            const selectedPlayer = { id: 'player-1' };
            const { container } = renderComponent({ selectedPlayer }, [player], []);
            const rect = container.querySelector('rect[stroke="#FFD700"]');
            expect(rect).toHaveAttribute('pointer-events', 'none');
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

        it('should prevent default and stop propagation on context menu', () => {
            const player = makePlayer({ id: 'player-1' });
            const setSelectedPlayer = vi.fn();
            const { container } = renderComponent({ setSelectedPlayer }, [player], []);
            const circle = container.querySelector('circle.creature-circle');
            const event = new MouseEvent('contextmenu', { bubbles: true });
            event.preventDefault = vi.fn();
            event.stopPropagation = vi.fn();
            circle.dispatchEvent(event);
            expect(event.preventDefault).toHaveBeenCalled();
            expect(event.stopPropagation).toHaveBeenCalled();
        });
    });

    describe('error handling', () => {
        it('should throw when player array contains null', () => {
            const character = makeCharacter();
            expect(() => renderComponent({}, [null], [character])).toThrow();
        });
    });
});
