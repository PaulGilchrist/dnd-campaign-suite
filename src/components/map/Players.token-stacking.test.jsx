// Same-cell stacking on the PLAYER token layer (backlog GA 2026-11-10): a
// token buried under another token must render visibly offset (transform on
// its group) so its painted circle is a distinct, grabbable surface; single
// tokens and stack tops keep NO transform attribute (byte-unchanged render).
// Offset DERIVATION/paint order is pinned in services/maps/tokenStackOffsets.
// test.js; the placed-token lane in PlacedItems.token-stacking.test.jsx.

import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Players from './Players.jsx';

const CELL_SIZE = 40;
const gridCenterX = (gx) => gx * CELL_SIZE + CELL_SIZE / 2;
const gridCenterY = (gy) => gy * CELL_SIZE + CELL_SIZE / 2;

const renderPlayers = (players, tokenOffsets) =>
    render(
        <svg>
            <Players
                players={players}
                characters={[]}
                gridCenterX={gridCenterX}
                gridCenterY={gridCenterY}
                isLocalhost
                campaignName="test-campaign"
                handlePointerDown={vi.fn()}
                setSelectedPlayer={vi.fn()}
                tokenOffsets={tokenOffsets}
            />
        </svg>
    );

describe('Players token stacking', () => {
    it('renders no transform attribute when no stack offsets are supplied (byte-unchanged face)', () => {
        const { container } = renderPlayers(
            [{ id: 'ef', name: 'EvasiveFighter', gridX: 3, gridY: 3 }],
            new Map()
        );
        const group = container.querySelector('g.creature-group');
        expect(group.hasAttribute('transform')).toBe(false);
    });

    it('accepts an absent tokenOffsets prop without throwing', () => {
        const { container } = render(
            <svg>
                <Players
                    players={[{ id: 'ef', name: 'EvasiveFighter', gridX: 3, gridY: 3 }]}
                    characters={[]}
                    gridCenterX={gridCenterX}
                    gridCenterY={gridCenterY}
                    isLocalhost
                    campaignName="test-campaign"
                    handlePointerDown={vi.fn()}
                    setSelectedPlayer={vi.fn()}
                />
            </svg>
        );
        expect(container.querySelector('g.creature-group').hasAttribute('transform')).toBe(false);
    });

    it('offsets the buried token group and keeps the stack top centred', () => {
        const { container } = renderPlayers(
            [
                { id: 'ef', name: 'EvasiveFighter', gridX: 3, gridY: 3 },
                { id: 'fr', name: 'FeyRanger', gridX: 3, gridY: 3 },
            ],
            new Map([['ef', { dx: -10, dy: -10 }], ['fr', { dx: 0, dy: 0 }]])
        );
        const groups = container.querySelectorAll('g.creature-group');
        expect(groups[0]).toHaveAttribute('transform', 'translate(-10, -10)');
        // Stack top (and every single-token cell) carries no attribute at all.
        expect(groups[1].hasAttribute('transform')).toBe(false);
    });

    it('stacking is per-cell: a lone token sharing the board with a crowded cell stays untransformed', () => {
        const { container } = renderPlayers(
            [
                { id: 'ef', name: 'EvasiveFighter', gridX: 3, gridY: 3 },
                { id: 'fr', name: 'FeyRanger', gridX: 3, gridY: 3 },
                { id: 'ep', name: 'ElderPaladin', gridX: 7, gridY: 1 },
            ],
            new Map([['ef', { dx: -10, dy: -10 }], ['fr', { dx: 0, dy: 0 }]])
        );
        const groups = container.querySelectorAll('g.creature-group');
        expect(groups[2].hasAttribute('transform')).toBe(false);
        // cx/cy attributes are untouched — the offset rides the group transform,
        // so grid math (fog, ranges) still reads the true cell centre.
        const buriedCircle = groups[0].querySelector('circle.creature-circle');
        expect(buriedCircle).toHaveAttribute('cx', String(gridCenterX(3)));
    });
});
