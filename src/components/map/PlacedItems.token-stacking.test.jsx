// Same-cell stacking on the PLACED-item creature-token lane (backlog
// GA 2026-11-10): tokens on a crowded cell swap their 40×40 transparent cell
// rect for a circle matching the token art (barrel precedent), and buried
// tokens render visibly offset — so painted-where = grabbable-where and the
// visually topmost token under the pointer is exactly the token that takes
// the press. Single tokens keep the rect + no transform attribute
// (byte-unchanged — also pinned by PlacedItems.hit-area-classes.test.jsx).
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

const renderItems = (items, tokenOffsets) =>
    render(<PlacedItems {...baseProps} placedItems={items} tokenOffsets={tokenOffsets} />);

describe('PlacedItems token stacking', () => {
    it('unstacked token: no transform attribute, rect hit area (byte-unchanged face)', () => {
        const { container } = renderItems([makeItem()], new Map());
        const group = container.querySelector('g.npc-group');
        expect(group.hasAttribute('transform')).toBe(false);
        expect(group.querySelector('rect.placed-hit-area')).toBeInTheDocument();
        expect(group.querySelector('circle.placed-hit-area')).toBeNull();
    });

    it('stack-top token on a crowded cell: centred (no transform) but circle hit area', () => {
        // The {dx:0,dy:0} entry marks a CROWDED cell's top: its hit surface
        // shrinks from the full-cell rect to the visible circle so it can
        // never invisibly steal presses from a buried neighbour's art.
        const { container } = renderItems(
            [makeItem({ id: 'top' })],
            new Map([['top', { dx: 0, dy: 0 }]])
        );
        const group = container.querySelector('g.npc-group');
        expect(group.hasAttribute('transform')).toBe(false);
        expect(group.querySelector('rect.placed-hit-area')).toBeNull();
        expect(group.querySelector('circle.placed-hit-area')).toBeInTheDocument();
    });

    it('stack-top right-click still arms the context menu through the circle', () => {
        const setSelectedItem = vi.fn();
        const { container } = render(
            <PlacedItems {...baseProps} setSelectedItem={setSelectedItem}
                placedItems={[makeItem({ id: 'top' })]}
                tokenOffsets={new Map([['top', { dx: 0, dy: 0 }]])} />
        );
        fireEvent.contextMenu(container.querySelector('circle.placed-hit-area'));
        expect(setSelectedItem).toHaveBeenCalledWith(expect.objectContaining({ id: 'top' }));
    });

    it('buried token: group carries the stacking translate and the hit area becomes a circle', () => {
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
        expect(hit).toHaveAttribute('r', '20');
    });

    it('stacking is per-token: an offset neighbour leaves a single-cell token untransformed', () => {
        const { container } = renderItems(
            [
                makeItem({ id: 'a', name: 'Wolf', gridX: 2, gridY: 2 }),
                makeItem({ id: 'b', name: 'Thug', gridX: 5, gridY: 5 }),
            ],
            new Map([['a', { dx: -10, dy: -10 }]])
        );
        const groups = container.querySelectorAll('g.npc-group');
        expect(groups[0]).toHaveAttribute('transform', 'translate(-10, -10)');
        expect(groups[1].hasAttribute('transform')).toBe(false);
        expect(groups[1].querySelector('rect.placed-hit-area')).toBeInTheDocument();
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
        // Fade follows the same seam: buried art fades, centred top does not.
        expect(goblin).toHaveClass('token-buried');
        expect(thug).not.toHaveClass('token-buried');
        // Byte-unchanged faces: crowd-top and single keep the bare class.
        expect(thug.getAttribute('class')).toBe('npc-group');
    });

    it('single and crowd-top tokens never carry the fade class (full-opacity faces)', () => {
        const { container } = renderItems(
            [makeItem({ id: 'lone', name: 'Wolf', gridX: 9, gridY: 9 })],
            new Map()
        );
        const lone = container.querySelector('g.npc-group');
        expect(lone).not.toHaveClass('token-buried');
        expect(lone.getAttribute('class')).toBe('npc-group');
    });

    it('re-stack face: the fade class follows the LIVE offset, not a cached flag', () => {
        const items = [makeItem({ id: 'a', name: 'Wolf' }), makeItem({ id: 'b', name: 'Thug' })];
        const { container, rerender } = renderItems(
            items,
            new Map([['a', { dx: -10, dy: -10 }], ['b', { dx: 0, dy: 0 }]])
        );
        expect(container.querySelector('g[title="Wolf"]')).toHaveClass('token-buried');
        expect(container.querySelector('g[title="Thug"]')).not.toHaveClass('token-buried');
        // The crowd lifts: both tokens re-stack to singles — full opacity again.
        rerender(<PlacedItems {...baseProps} placedItems={items} tokenOffsets={new Map()} />);
        expect(container.querySelector('g[title="Wolf"]')).not.toHaveClass('token-buried');
        expect(container.querySelector('g[title="Wolf"]').getAttribute('class')).toBe('npc-group');
        expect(container.querySelector('g[title="Thug"]').getAttribute('class')).toBe('npc-group');
    });
});
