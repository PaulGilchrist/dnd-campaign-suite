// @maintained-by-ai 2026-11-14
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

// includeOffsets=false omits the tokenOffsets prop entirely (players-less-doc
// callers), otherwise it is passed through as given.
const playerEl = (players, tokenOffsets, includeOffsets = true) => {
    const props = {
        players,
        characters: [],
        gridCenterX,
        gridCenterY,
        isLocalhost: true,
        campaignName: 'test-campaign',
        handlePointerDown: vi.fn(),
        setSelectedPlayer: vi.fn(),
    };
    if (includeOffsets) props.tokenOffsets = tokenOffsets;
    return (
        <svg>
            <Players {...props} />
        </svg>
    );
};

const EF = { id: 'ef', name: 'EvasiveFighter', gridX: 3, gridY: 3 };
const FR = { id: 'fr', name: 'FeyRanger', gridX: 3, gridY: 3 };
const EP = { id: 'ep', name: 'ElderPaladin', gridX: 7, gridY: 1 };

describe('Players token stacking', () => {
    it('renders the byte-unchanged face for single tokens, with and without the tokenOffsets prop', () => {
        for (const includeOffsets of [true, false]) {
            const { container } = render(
                playerEl([EF], includeOffsets ? new Map() : undefined, includeOffsets)
            );
            const group = container.querySelector('g.creature-group');
            expect(group.hasAttribute('transform')).toBe(false);
            expect(group.getAttribute('class')).toBe('creature-group');
        }
    });

    it('fans the buried token out with transform + fade class while the stack top and lone-cell tokens stay centred and plain', () => {
        const { container } = render(
            playerEl([EF, FR, EP], new Map([['ef', { dx: -10, dy: -10 }], ['fr', { dx: 0, dy: 0 }]]))
        );
        const groups = container.querySelectorAll('g.creature-group');
        // Buried: offset rides the group transform AND fades with the class.
        expect(groups[0]).toHaveAttribute('transform', 'translate(-10, -10)');
        expect(groups[0]).toHaveClass('token-buried');
        // Stack top and the lone token in another cell: bare class, no attribute.
        for (const top of [groups[1], groups[2]]) {
            expect(top.hasAttribute('transform')).toBe(false);
            expect(top.getAttribute('class')).toBe('creature-group');
        }
        // cx/cy attributes are untouched — grid math (fog, ranges) still reads
        // the true cell centre even for the shifted token.
        const buriedCircle = groups[0].querySelector('circle.creature-circle');
        expect(buriedCircle).toHaveAttribute('cx', String(gridCenterX(3)));
        expect(buriedCircle).toHaveAttribute('cy', String(gridCenterY(3)));
    });

    it('follows the live offset on re-stack: transform and fade swap roles, and a dissolved stack restores bare faces', () => {
        const { container, rerender } = render(
            playerEl([EF, FR], new Map([['ef', { dx: -10, dy: -10 }], ['fr', { dx: 0, dy: 0 }]]))
        );
        expect(container.querySelector('g[transform]')).toHaveClass('token-buried');
        // Roles swap: ef re-stacks to the cell centre, fr becomes buried.
        rerender(playerEl([EF, FR], new Map([['ef', { dx: 0, dy: 0 }], ['fr', { dx: -10, dy: -10 }]])));
        const swapped = container.querySelectorAll('g.creature-group');
        expect(swapped[0]).not.toHaveClass('token-buried');
        expect(swapped[0].hasAttribute('transform')).toBe(false);
        expect(swapped[1]).toHaveClass('token-buried');
        expect(swapped[1]).toHaveAttribute('transform', 'translate(-10, -10)');
        // Stack dissolves entirely: every token back to the byte-unchanged face.
        rerender(playerEl([EF, FR], new Map()));
        const singles = container.querySelectorAll('g.creature-group');
        for (const group of singles) {
            expect(group.hasAttribute('transform')).toBe(false);
            expect(group.getAttribute('class')).toBe('creature-group');
        }
    });
});
