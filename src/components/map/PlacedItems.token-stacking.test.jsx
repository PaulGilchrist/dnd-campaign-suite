// @maintained-by-ai
// Same-cell stacking on the PLACED-item creature-token lane (backlog
// GA 2026-11-10): tokens on a crowded cell swap their 40×40 transparent cell
// rect for a circle matching the token art (barrel precedent), and buried
// tokens render visibly offset + faded — so painted-where = grabbable-where
// and the visually topmost token under the pointer is exactly the token that
// takes the press. Single tokens keep the rect, no transform attribute and
// the bare class (byte-unchanged — also pinned by
// PlacedItems.hit-area-classes.test.jsx).
// Offset DERIVATION/paint order lives in services/maps/tokenStackOffsets.
// test.js; the player lane in Players.token-stacking.test.jsx.

import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PlacedItems, { baseProps } from './PlacedItems.test-utils';

const makeItem = (overrides) => ({
    id: 'item-1',
    type: 'npc',
    name: 'Wolf',
    gridX: 0,
    gridY: 0,
    visible: true,
    ...overrides,
});

const renderItems = (items, tokenOffsets, overrides = {}) =>
    render(<PlacedItems {...baseProps} {...overrides} placedItems={items} tokenOffsets={tokenOffsets} />);

describe('PlacedItems token stacking', () => {
    it('stacking is per-token: a buried neighbour translates while a single token keeps the byte-unchanged rect face', () => {
        const { container } = renderItems(
            [
                makeItem({ id: 'a', name: 'Wolf', gridX: 2, gridY: 2 }),
                makeItem({ id: 'b', name: 'Thug', gridX: 5, gridY: 5 }),
            ],
            new Map([['a', { dx: -10, dy: -10 }]])
        );
        const wolf = container.querySelector('g[title="Wolf"]');
        const thug = container.querySelector('g[title="Thug"]');
        expect(wolf).toHaveAttribute('transform', 'translate(-10, -10)');
        // The uninvolved token is byte-unchanged: no transform, bare class,
        // full-cell rect hit area (no circle).
        expect(thug.hasAttribute('transform')).toBe(false);
        expect(thug.getAttribute('class')).toBe('npc-group');
        expect(thug.querySelector('rect.placed-hit-area')).toBeInTheDocument();
        expect(thug.querySelector('circle.placed-hit-area')).toBeNull();
    });

    it('crowded-cell stack top: centred (no transform), no fade, circle hit area that still arms the menu', () => {
        // The {dx:0,dy:0} entry marks a CROWDED cell's top: its hit surface
        // shrinks from the full-cell rect to the visible circle so it can
        // never invisibly steal presses from a buried neighbour's art.
        const setSelectedItem = vi.fn();
        const { container } = renderItems(
            [makeItem({ id: 'top' })],
            new Map([['top', { dx: 0, dy: 0 }]]),
            { setSelectedItem }
        );
        const group = container.querySelector('g.npc-group');
        expect(group.hasAttribute('transform')).toBe(false);
        expect(group.getAttribute('class')).toBe('npc-group');
        expect(group.querySelector('rect.placed-hit-area')).toBeNull();
        const hit = group.querySelector('circle.placed-hit-area');
        expect(hit).toBeInTheDocument();
        // Right-click through the circle still arms the context menu.
        fireEvent.contextMenu(hit);
        expect(setSelectedItem).toHaveBeenCalledWith(expect.objectContaining({ id: 'top' }));
    });

    it('buried token: stacking translate and the hit area becomes a circle sized to the token art', () => {
        const { container } = renderItems(
            [makeItem({ id: 'mob', type: 'monster', name: 'Goblin' })],
            new Map([['mob', { dx: -10, dy: -10 }]])
        );
        const group = container.querySelector('g.npc-group');
        expect(group).toHaveAttribute('transform', 'translate(-10, -10)');
        expect(group).toHaveClass('token-buried');
        expect(group.querySelector('rect.placed-hit-area')).toBeNull();
        const hit = group.querySelector('circle.placed-hit-area');
        expect(hit).toBeInTheDocument();
        // r=20 matches the token art circle — painted hit = grabbable hit.
        expect(hit).toHaveAttribute('r', '20');
    });

    it('monster and npc tokens on one cell stack in paint order (monster buried, npc centred)', () => {
        const { container } = renderItems(
            [makeItem({ id: 'npcTop', name: 'Thug' }), makeItem({ id: 'mob', type: 'monster', name: 'Goblin' })],
            new Map([['mob', { dx: -10, dy: -10 }], ['npcTop', { dx: 0, dy: 0 }]])
        );
        // PlacedItems dispatches the monster pass BEFORE the npc pass — the
        // centred token must be the npc, the offset one the monster.
        const goblin = container.querySelector('g[title="Goblin"]');
        const thug = container.querySelector('g[title="Thug"]');
        const groups = container.querySelectorAll('g.npc-group');
        expect(groups[0]).toBe(goblin); // monster pass paints first (lower)
        expect(goblin).toHaveAttribute('transform', 'translate(-10, -10)');
        expect(thug.hasAttribute('transform')).toBe(false);
        // Fade follows the same seam: buried art fades, centred top does not
        // with the byte-unchanged bare class.
        expect(goblin).toHaveClass('token-buried');
        expect(thug.getAttribute('class')).toBe('npc-group');
    });

    it('re-stack face: the fade class and hit shape follow the LIVE offsets, not a cached flag', () => {
        const items = [makeItem({ id: 'a', name: 'Wolf' }), makeItem({ id: 'b', name: 'Thug' })];
        const { container, rerender } = renderItems(
            items,
            new Map([['a', { dx: -10, dy: -10 }], ['b', { dx: 0, dy: 0 }]])
        );
        expect(container.querySelector('g[title="Wolf"]')).toHaveClass('token-buried');
        expect(container.querySelector('g[title="Thug"]')).not.toHaveClass('token-buried');
        // The crowd lifts: both tokens re-stack to singles — full-opacity,
        // bare-class faces with the full-cell rect hit area back.
        rerender(<PlacedItems {...baseProps} placedItems={items} tokenOffsets={new Map()} />);
        const wolf = container.querySelector('g[title="Wolf"]');
        expect(wolf).not.toHaveClass('token-buried');
        expect(wolf.getAttribute('class')).toBe('npc-group');
        expect(wolf.querySelector('rect.placed-hit-area')).toBeInTheDocument();
        expect(container.querySelector('g[title="Thug"]').getAttribute('class')).toBe('npc-group');
    });
});
