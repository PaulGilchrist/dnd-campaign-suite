// @maintained-by-ai: 2026-10-14
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

const renderComponent = (props = {}, players = [makePlayer()], characters = []) =>
    render(
        <svg width={1200} height={800}>
            <Players
                players={players}
                characters={characters}
                gridCenterX={gridCenterX}
                gridCenterY={gridCenterY}
                isLocalhost={true}
                campaignName="test-campaign"
                handlePointerDown={vi.fn()}
                setSelectedPlayer={vi.fn()}
                {...props}
            />
        </svg>
    );

describe('Players', () => {
    it('renders nothing when players array is empty', () => {
        const { container } = renderComponent({}, []);
        expect(container.querySelectorAll('g.creature-group').length).toBe(0);
    });

    it('renders one token group with grab cursor and clipPath per player', () => {
        const players = [
            makePlayer({ id: 'p1', name: 'Thorin', gridX: 1, gridY: 1 }),
            makePlayer({ id: 'p2', name: 'Gimli', gridX: 3, gridY: 4 }),
            makePlayer({ id: 'p3', name: 'Legolas', gridX: 5, gridY: 2 }),
        ];
        const { container } = renderComponent({}, players);
        const groups = container.querySelectorAll('g.creature-group');
        expect(groups.length).toBe(3);
        groups.forEach((group, i) => {
            expect(group).toHaveAttribute('style', 'cursor: grab;');
            expect(group.querySelector(`clipPath[id="creature-clip-${players[i].id}"] circle`)).toBeInTheDocument();
        });
    });

    it('positions circle, clip circle, and name text at the player grid center', () => {
        const { container } = renderComponent();
        const cx = gridCenterX(2);
        const cy = gridCenterY(3);
        const circle = container.querySelector('circle.creature-circle');
        expect(circle).toHaveAttribute('cx', String(cx));
        expect(circle).toHaveAttribute('cy', String(cy));
        expect(circle).toHaveAttribute('r', String(RADIUS));
        const clipCircle = container.querySelector('clipPath[id="creature-clip-player-1"] circle');
        expect(clipCircle).toHaveAttribute('cx', String(cx));
        expect(clipCircle).toHaveAttribute('r', String(RADIUS));
        const nameText = container.querySelector('text.creature-name');
        expect(nameText).toHaveAttribute('x', String(cx));
        expect(nameText).toHaveAttribute('y', String(cy + RADIUS - 4));
        expect(nameText.textContent).toBe('Thorin');
    });

    it('shows the campaign portrait matched by name, clipped to the token', () => {
        const characters = [
            makeCharacter({ name: 'Gimli', imagePath: 'images/gimli.png' }),
            makeCharacter(),
        ];
        const { container } = renderComponent({}, [makePlayer()], characters);
        const image = container.querySelector('image.creature-image');
        const cx = gridCenterX(2);
        const cy = gridCenterY(3);
        expect(image).toHaveAttribute('xlink:href', 'campaigns/test-campaign/images/thorin.png');
        expect(image).toHaveAttribute('x', String(cx - RADIUS + 2));
        expect(image).toHaveAttribute('y', String(cy - RADIUS + 2));
        expect(image).toHaveAttribute('width', String(RADIUS * 2 - 4));
        expect(image).toHaveAttribute('height', String(RADIUS * 2 - 4));
        expect(image).toHaveAttribute('preserveAspectRatio', 'xMidYMid slice');
        expect(image).toHaveAttribute('clip-path', 'url(#creature-clip-player-1)');
    });

    it('passes http(s) image URLs through unchanged', () => {
        const characters = [makeCharacter({ imagePath: 'https://example.com/thorin.png' })];
        const { container } = renderComponent({}, [makePlayer()], characters);
        expect(container.querySelector('image.creature-image')).toHaveAttribute('xlink:href', 'https://example.com/thorin.png');
    });

    it('falls back to the uppercase initial at token center when no portrait is available', () => {
        const cases = [
            { label: 'no matching character', characters: [] },
            { label: 'character has no imagePath', characters: [makeCharacter({ imagePath: null })] },
            { label: 'campaignName is missing', characters: [makeCharacter()], props: { campaignName: '' } },
            { label: 'player name is empty', characters: [], players: [makePlayer({ name: '' })], initial: '' },
        ];
        const cx = gridCenterX(2);
        const cy = gridCenterY(3);
        for (const { label, characters, props = {}, players, initial = 'T' } of cases) {
            const { container } = renderComponent(props, players ?? [makePlayer()], characters);
            expect(container.querySelector('image.creature-image'), label).toBeNull();
            const token = container.querySelector('text.creature-initial');
            expect(token, label).toBeInTheDocument();
            expect(token).toHaveAttribute('x', String(cx));
            expect(token).toHaveAttribute('y', String(cy));
            expect(token.textContent, label).toBe(initial);
        }
    });

    it('marks the selected player with class and highlight rect', () => {
        const { container } = renderComponent({ selectedPlayer: { id: 'player-1' } });
        const cx = gridCenterX(2);
        const cy = gridCenterY(3);
        expect(container.querySelector('circle.creature-circle')).toHaveClass('selected');
        const rect = container.querySelector('rect[stroke="#FFD700"]');
        expect(rect).toBeInTheDocument();
        expect(rect).toHaveAttribute('x', String(cx - RADIUS - 3));
        expect(rect).toHaveAttribute('y', String(cy - RADIUS - 3));
        expect(rect).toHaveAttribute('width', String((RADIUS + 3) * 2));
        expect(rect).toHaveAttribute('height', String((RADIUS + 3) * 2));
        expect(rect).toHaveAttribute('fill', 'none');
        expect(rect).toHaveAttribute('stroke-dasharray', '4 2');
        expect(rect).toHaveAttribute('pointer-events', 'none');
    });

    it('leaves unselected tokens unhighlighted', () => {
        for (const selectedPlayer of [{ id: 'player-2' }, null]) {
            const { container } = renderComponent({ selectedPlayer });
            expect(container.querySelector('circle.creature-circle')).not.toHaveClass('selected');
            expect(container.querySelector('rect[stroke="#FFD700"]')).toBeNull();
        }
    });

    // FIXME: source bug — usePlayerDragging sets dragging={playerId,...} but
    // Players.jsx gates the 'dragging' class on dragging.creatureId (legacy field
    // the app never produces), so the drag feedback in Map.css never applies.
    // Source should check dragging.playerId; leaving this test failing to guard it.
    it('marks the token being dragged, combined with selection', () => {
        const { container } = renderComponent({
            dragging: { playerId: 'player-1', pointerId: 1 },
            selectedPlayer: { id: 'player-1' },
        });
        const circle = container.querySelector('circle.creature-circle');
        expect(circle).toHaveClass('dragging');
        expect(circle).toHaveClass('selected');
    });

    it('flags drag-invalid only for the dragged player over an invalid cell', () => {
        const cases = [
            { dragging: { playerId: 'player-1', invalid: true }, invalid: true },
            { dragging: { playerId: 'player-1', invalid: false }, invalid: false },
            { dragging: { playerId: 'player-2', invalid: true }, invalid: false },
        ];
        for (const { dragging, invalid } of cases) {
            const { container } = renderComponent({ dragging });
            const circle = container.querySelector('circle.creature-circle');
            if (invalid) expect(circle).toHaveClass('drag-invalid');
            else expect(circle).not.toHaveClass('drag-invalid');
        }
    });

    it('hides fogged tokens from players but shows them on localhost', () => {
        const fog = new Set(['2,3']);
        const player = renderComponent({ isLocalhost: false, fog });
        expect(player.container.querySelectorAll('g.creature-group').length).toBe(0);
        const gm = renderComponent({ isLocalhost: true, fog });
        expect(gm.container.querySelectorAll('g.creature-group').length).toBe(1);
    });

    it('renders only the unfogged tokens for players', () => {
        const players = [
            makePlayer({ id: 'p1', gridX: 1, gridY: 1 }),
            makePlayer({ id: 'p2', gridX: 2, gridY: 2 }),
            makePlayer({ id: 'p3', gridX: 3, gridY: 3 }),
        ];
        const fog = new Set(['1,1', '3,3']);
        const { container } = renderComponent({ isLocalhost: false, fog }, players);
        const groups = container.querySelectorAll('g.creature-group');
        expect(groups.length).toBe(1);
        expect(groups[0].querySelector('circle.creature-circle')).toHaveAttribute('cx', String(gridCenterX(2)));
    });

    it('calls handlePointerDown with the id of each clicked player', () => {
        const players = [
            makePlayer({ id: 'p1', gridX: 0, gridY: 0 }),
            makePlayer({ id: 'p2', gridX: 1, gridY: 1 }),
        ];
        const handlePointerDown = vi.fn();
        const { container } = renderComponent({ handlePointerDown }, players);
        const groups = container.querySelectorAll('g.creature-group');
        groups.forEach((group, i) => {
            handlePointerDown.mockClear();
            group.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
            expect(handlePointerDown).toHaveBeenCalledWith(expect.any(Object), players[i].id);
        });
    });

    it('selects the correct player via context menu', () => {
        const players = [
            makePlayer({ id: 'p1', name: 'Thorin' }),
            makePlayer({ id: 'p2', name: 'Gimli' }),
        ];
        const setSelectedPlayer = vi.fn();
        const { container } = renderComponent({ setSelectedPlayer }, players);
        const circle = container.querySelectorAll('g.creature-group')[1].querySelector('circle.creature-circle');
        circle.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
        expect(setSelectedPlayer).toHaveBeenCalledWith(players[1]);
    });
});
