// @maintained-by-ai 2026-11-26
// ─── Lane: Players — core token face ──────────────────────────────────────────
// Owned here: token count/geometry, portrait-vs-initial rendering, the image
// URL law, selection + drag state chrome, the fog cull law (visitor hides,
// GM sees all), and the per-token pointer wiring (drag opener + right-click
// opener receive the CORRECT player).
// Owned in sibling files (not re-pinned here): visitor/owned opener GATE law →
// Players.context-menu-gate.test.jsx; ring color + hideLabel cosmetics →
// Players.cosmetics.test.jsx; same-cell stacking transform/fade →
// Players.token-stacking.test.jsx; zero-chip DOM + ownership ring →
// Players.token-status.test.jsx; Select-tool exclusion cue →
// Players.select-armed-cue.test.jsx.
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
    // Backlog 2026-10-27-M: a whole-document PUT that stripped `players` used
    // to land here as undefined/null and throw "players.map is not a
    // function" — the render path must degrade to an empty token list.
    it('degrades to an empty token list for [], undefined, and null players (players-less-doc guard)', () => {
        for (const players of [[], undefined, null]) {
            const { container, unmount } = renderComponent({ players });
            expect(container.querySelectorAll('g.creature-group').length).toBe(0);
            unmount();
        }
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
        expect(container.querySelector('text.creature-initial')).toBeNull();
    });

    it('passes http(s) image URLs through unchanged (no campaign prefix)', () => {
        for (const url of ['https://example.com/thorin.png', 'http://example.com/thorin.png']) {
            const { container, unmount } = renderComponent(
                {},
                [makePlayer()],
                [makeCharacter({ imagePath: url })]
            );
            expect(container.querySelector('image.creature-image')).toHaveAttribute('xlink:href', url);
            unmount();
        }
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

    it('highlights the selected token with class and dashed rect, and nothing else', () => {
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

        // Negative path: a different selection or none paints no chrome.
        for (const selectedPlayer of [{ id: 'player-2' }, null]) {
            const { container: other, unmount } = renderComponent({ selectedPlayer });
            expect(other.querySelector('circle.creature-circle')).not.toHaveClass('selected');
            expect(other.querySelector('rect[stroke="#FFD700"]')).toBeNull();
            unmount();
        }
    });

    it('marks exactly the dragged disc with the right state classes', () => {
        const players = [
            makePlayer({ id: 'p1', gridX: 0, gridY: 0 }),
            makePlayer({ id: 'p2', gridX: 1, gridY: 1 }),
        ];
        const STATE_CLASSES = ['dragging', 'selected', 'drag-invalid'];
        const cases = [
            {
                label: 'drag and selection classes stack on one disc',
                dragging: { playerId: 'p1', pointerId: 1 },
                selectedPlayer: { id: 'p1' },
                expected: { p1: ['dragging', 'selected'], p2: [] },
            },
            {
                label: 'invalid cell flags the dragged disc (stacked on dragging)',
                dragging: { playerId: 'p1', invalid: true },
                expected: { p1: ['dragging', 'drag-invalid'], p2: [] },
            },
            {
                label: 'valid drag paints dragging without the invalid flag',
                dragging: { playerId: 'p1', invalid: false },
                expected: { p1: ['dragging'], p2: [] },
            },
            {
                label: 'dragging another player flags that disc, not this one',
                dragging: { playerId: 'p2', invalid: true },
                expected: { p1: [], p2: ['dragging', 'drag-invalid'] },
            },
        ];
        for (const { label, dragging, selectedPlayer, expected } of cases) {
            const { container, unmount } = renderComponent({ dragging, selectedPlayer }, players);
            const discs = container.querySelectorAll('circle.creature-circle');
            expect(discs.length).toBe(2);
            ['p1', 'p2'].forEach((id, i) => {
                for (const cls of STATE_CLASSES) {
                    if (expected[id].includes(cls)) {
                        expect(discs[i], `${label}: ${id}`).toHaveClass(cls);
                    } else {
                        expect(discs[i], `${label}: ${id}`).not.toHaveClass(cls);
                    }
                }
            });
            unmount();
        }
    });

    it('culls fogged tokens for visitors while the GM sees every token', () => {
        const players = [
            makePlayer({ id: 'p1', gridX: 1, gridY: 1 }),
            makePlayer({ id: 'p2', gridX: 2, gridY: 2 }),
            makePlayer({ id: 'p3', gridX: 3, gridY: 3 }),
        ];
        const fog = new Set(['1,1', '3,3']);
        const visitor = renderComponent({ isLocalhost: false, fog }, players);
        const groups = visitor.container.querySelectorAll('g.creature-group');
        expect(groups.length).toBe(1);
        expect(groups[0].querySelector('circle.creature-circle')).toHaveAttribute('cx', String(gridCenterX(2)));
        visitor.unmount();

        // The GM (localhost) sees all tokens, including fully-fogged ones.
        const gm = renderComponent({ isLocalhost: true, fog }, players);
        expect(gm.container.querySelectorAll('g.creature-group').length).toBe(3);
    });

    it('routes pointerdown and contextmenu to the correct player on every token', () => {
        const players = [
            makePlayer({ id: 'p1', name: 'Thorin', gridX: 0, gridY: 0 }),
            makePlayer({ id: 'p2', name: 'Gimli', gridX: 1, gridY: 1 }),
        ];
        const handlePointerDown = vi.fn();
        const setSelectedPlayer = vi.fn();
        const { container } = renderComponent({ handlePointerDown, setSelectedPlayer }, players);
        const groups = container.querySelectorAll('g.creature-group');
        expect(groups.length).toBe(2);
        groups.forEach((group, i) => {
            handlePointerDown.mockClear();
            setSelectedPlayer.mockClear();
            group.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
            expect(handlePointerDown).toHaveBeenCalledWith(expect.any(Object), players[i].id);
            group.querySelector('circle.creature-circle')
                .dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
            expect(setSelectedPlayer).toHaveBeenCalledWith(players[i]);
        });
    });
});
