// @improved-by-ai
// @cleaned-by-ai
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Players from './Players.jsx';

const CELL_SIZE = 50;
const RADIUS = 20;

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

        it('should not render image when characters is missing or has no matching character', () => {
            const player = makePlayer({ name: 'Thorin' });
            const { container } = renderComponent({}, [player], undefined);
            const image = container.querySelector('image.creature-image');
            expect(image).toBeNull();
            const initial = container.querySelector('text.creature-initial');
            expect(initial).toBeInTheDocument();
        });

        it('should render nothing when player name is empty string', () => {
            const player = makePlayer({ name: '' });
            const { container } = renderComponent({}, [player], []);
            const initial = container.querySelector('text.creature-initial');
            expect(initial).toBeInTheDocument();
            expect(initial.textContent).toBe('');
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
            expect(circle).toHaveAttribute('r', String(RADIUS));
        });

        it('should render creature name text at correct position with correct attributes and content', () => {
            const player = makePlayer({ gridX: 2, gridY: 3, name: 'Thorin' });
            const { container } = renderComponent({}, [player], []);
            const nameText = container.querySelector('text.creature-name');
            expect(nameText).toBeInTheDocument();
            expect(nameText).toHaveAttribute('x', String(gridCenterX(2)));
            expect(nameText).toHaveAttribute('y', String(gridCenterY(3) + RADIUS - 4));
            expect(nameText).toHaveAttribute('text-anchor', 'middle');
            expect(nameText).toHaveAttribute('dominant-baseline', 'central');
            expect(nameText).toHaveAttribute('font-size', '18');
            expect(nameText).toHaveAttribute('font-weight', 'bold');
            expect(nameText.textContent).toBe('Thorin');
        });

        it('should render creature initial when no character exists with correct attributes and uppercase conversion', () => {
            const player = makePlayer({ name: 'Thorin' });
            const { container } = renderComponent({}, [player], []);
            const initialText = container.querySelector('text.creature-initial');
            expect(initialText).toBeInTheDocument();
            expect(initialText.textContent).toBe('T');
            expect(initialText).toHaveAttribute('x', String(gridCenterX(2)));
            expect(initialText).toHaveAttribute('y', String(gridCenterY(3)));
            expect(initialText).toHaveAttribute('text-anchor', 'middle');
            expect(initialText).toHaveAttribute('dominant-baseline', 'central');
            expect(initialText).toHaveAttribute('fill', '#fff');
            expect(initialText).toHaveAttribute('font-size', '16');
            expect(initialText).toHaveAttribute('font-weight', 'bold');
        });

        it('should render creature-group with cursor grab style', () => {
            const player = makePlayer({ id: 'player-1' });
            const { container } = renderComponent({}, [player], []);
            const group = container.querySelector('g.creature-group');
            expect(group).toHaveAttribute('style', 'cursor: grab;');
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

        it('should pass through http(s) URLs directly', () => {
            const player = makePlayer({ name: 'Thorin' });
            const character = makeCharacter({ imagePath: 'https://example.com/thorin.png' });
            const { container } = renderComponent({}, [player], [character]);
            const image = container.querySelector('image.creature-image');
            expect(image).toBeInTheDocument();
            expect(image).toHaveAttribute('xlink:href', 'https://example.com/thorin.png');
        });

        it('should not render image when campaignName is missing and path is relative', () => {
            const player = makePlayer({ name: 'Thorin' });
            const character = makeCharacter({ imagePath: 'images/thorin.png' });
            const { container } = render(
                <svg width={1200} height={800}>
                    <Players
                        players={[player]}
                        characters={[character]}
                        gridCenterX={gridCenterX}
                        gridCenterY={gridCenterY}
                        campaignName=""
                    />
                </svg>
            );
            const image = container.querySelector('image.creature-image');
            expect(image).toBeNull();
        });

        it('should render image with correct dimensions and positioning', () => {
            const player = makePlayer({ name: 'Thorin' });
            const character = makeCharacter();
            const { container } = renderComponent({}, [player], [character]);
            const image = container.querySelector('image.creature-image');
            const cx = gridCenterX(2);
            const cy = gridCenterY(3);
            expect(image).toHaveAttribute('x', String(cx - RADIUS + 2));
            expect(image).toHaveAttribute('y', String(cy - RADIUS + 2));
            expect(image).toHaveAttribute('width', String(RADIUS * 2 - 4));
            expect(image).toHaveAttribute('height', String(RADIUS * 2 - 4));
            expect(image).toHaveAttribute('preserveAspectRatio', 'xMidYMid slice');
            expect(image).toHaveAttribute('clip-path', 'url(#creature-clip-player-1)');
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

        it('should render clipPath inner circle with correct attributes', () => {
            const player = makePlayer({ id: 'player-1', gridX: 2, gridY: 3 });
            const { container } = renderComponent({}, [player], []);
            const clipPath = container.querySelector('clipPath[id="creature-clip-player-1"]');
            const circle = clipPath.querySelector('circle');
            expect(circle).toHaveAttribute('cx', String(gridCenterX(2)));
            expect(circle).toHaveAttribute('cy', String(gridCenterY(3)));
            expect(circle).toHaveAttribute('r', String(RADIUS));
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

        it('should combine dragging and selected classes', () => {
            const player = makePlayer({ id: 'player-1' });
            const dragging = { creatureId: 'player-1' };
            const selectedPlayer = { id: 'player-1' };
            const { container } = renderComponent({ dragging, selectedPlayer }, [player], []);
            const circle = container.querySelector('circle.creature-circle');
            expect(circle).toHaveClass('dragging');
            expect(circle).toHaveClass('selected');
        });
    });

    describe('drag invalid state', () => {
        it('should apply drag-invalid class when the dragged player is over an invalid cell', () => {
            const player = makePlayer({ id: 'player-1' });
            const dragging = { playerId: 'player-1', invalid: true };
            const { container } = renderComponent({ dragging }, [player], []);
            const circle = container.querySelector('circle.creature-circle');
            expect(circle).toHaveClass('drag-invalid');
        });

        it('should not apply drag-invalid class when the dragged player is over a valid cell', () => {
            const player = makePlayer({ id: 'player-1' });
            const dragging = { playerId: 'player-1', invalid: false };
            const { container } = renderComponent({ dragging }, [player], []);
            const circle = container.querySelector('circle.creature-circle');
            expect(circle).not.toHaveClass('drag-invalid');
        });

        it('should not apply drag-invalid class when a different player is dragged', () => {
            const player = makePlayer({ id: 'player-1' });
            const dragging = { playerId: 'player-2', invalid: true };
            const { container } = renderComponent({ dragging }, [player], []);
            const circle = container.querySelector('circle.creature-circle');
            expect(circle).not.toHaveClass('drag-invalid');
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

        it('should not select a different player than the one rendered', () => {
            const player = makePlayer({ id: 'player-1', name: 'Thorin', gridX: 1, gridY: 1 });
            const selectedPlayer = { id: 'player-99' };
            const { container } = renderComponent({ selectedPlayer }, [player], []);
            const circle = container.querySelector('circle.creature-circle');
            expect(circle).not.toHaveClass('selected');
        });

        it('should render selection highlight rect with correct attributes when player is selected', () => {
            const player = makePlayer({ id: 'player-1', gridX: 2, gridY: 3 });
            const selectedPlayer = { id: 'player-1' };
            const { container } = renderComponent({ selectedPlayer }, [player], []);
            const rect = container.querySelector('rect[stroke="#FFD700"]');
            const cx = gridCenterX(2);
            const cy = gridCenterY(3);
            expect(rect).toBeInTheDocument();
            expect(rect).toHaveAttribute('x', String(cx - RADIUS - 3));
            expect(rect).toHaveAttribute('y', String(cy - RADIUS - 3));
            expect(rect).toHaveAttribute('width', String((RADIUS + 3) * 2));
            expect(rect).toHaveAttribute('height', String((RADIUS + 3) * 2));
            expect(rect).toHaveAttribute('fill', 'none');
            expect(rect).toHaveAttribute('stroke-width', '2');
            expect(rect).toHaveAttribute('rx', '4');
            expect(rect).toHaveAttribute('stroke-dasharray', '4 2');
            expect(rect).toHaveAttribute('pointer-events', 'none');
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
            expect(groups.length).toBe(1);
        });

        it('should not hide creature when fog does not cover cell', () => {
            const player = makePlayer({ gridX: 2, gridY: 3 });
            const fog = new Set(['5,5']);
            const { container } = renderComponent({ isLocalhost: false, fog }, [player], []);
            const groups = container.querySelectorAll('g.creature-group');
            expect(groups.length).toBe(1);
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

        it('should hide all creatures when fog covers all cells', () => {
            const players = [
                makePlayer({ id: 'p1', gridX: 0, gridY: 0 }),
                makePlayer({ id: 'p2', gridX: 1, gridY: 1 }),
            ];
            const fog = new Set(['0,0', '1,1']);
            const { container } = renderComponent({ isLocalhost: false, fog }, players, []);
            const groups = container.querySelectorAll('g.creature-group');
            expect(groups.length).toBe(0);
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

        it('should call handlePointerDown with correct player id for each player', () => {
            const players = [
                makePlayer({ id: 'p1', gridX: 0, gridY: 0 }),
                makePlayer({ id: 'p2', gridX: 1, gridY: 1 }),
            ];
            const handlePointerDown = vi.fn();
            const { container } = renderComponent({ handlePointerDown }, players, []);
            const groups = container.querySelectorAll('g.creature-group');
            groups[0].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
            expect(handlePointerDown).toHaveBeenCalledWith(expect.any(Object), 'p1');
            handlePointerDown.mockClear();
            groups[1].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
            expect(handlePointerDown).toHaveBeenCalledWith(expect.any(Object), 'p2');
        });

        it('should call setSelectedPlayer on context menu', () => {
            const player = makePlayer({ id: 'player-1' });
            const setSelectedPlayer = vi.fn();
            const { container } = renderComponent({ setSelectedPlayer }, [player], []);
            const circle = container.querySelector('circle.creature-circle');
            circle.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
            expect(setSelectedPlayer).toHaveBeenCalledWith(player);
        });

        it('should select the correct player when multiple exist via context menu', () => {
            const players = [
                makePlayer({ id: 'p1', name: 'Thorin' }),
                makePlayer({ id: 'p2', name: 'Gimli' }),
            ];
            const setSelectedPlayer = vi.fn();
            const { container } = renderComponent({ setSelectedPlayer }, players, []);
            const groups = container.querySelectorAll('g.creature-group');
            const circle = groups[1].querySelector('circle.creature-circle');
            circle.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
            expect(setSelectedPlayer).toHaveBeenCalledWith(players[1]);
        });
    });
});
