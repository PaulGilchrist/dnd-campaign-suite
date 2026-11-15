// @maintained-by-ai
// Same-cell token stacking derivation (backlog GA 2026-11-10: overlapping
// tokens made drag-grabs ambiguous — paint order alone decided the mover and
// the buried token was invisible). This is the PURE seam pinned by the fix:
// buildTokenStackOffsets fans multi-token cells into deterministic offsets
// that mirror SVG paint order (Players layer bottom → monster rows → npc
// rows top), keeping the stack top centred so the VISUALLY topmost token is
// exactly the token hit-testing grabs. Component wiring (including the
// crowded-cell circle-vs-rect hit area via isStackedToken) is owned by
// Players.token-stacking.test.jsx and PlacedItems.token-stacking.test.jsx.

import { describe, it, expect } from 'vitest';
import {
    buildTokenStackOffsets,
    tokenStackTransform,
    STACK_OFFSET_PX,
    MAX_STACK_OFFSET_STEPS,
} from './tokenStackOffsets.js';

const player = (id, gridX, gridY) => ({ id, name: id, gridX, gridY });
const item = (id, type, gridX, gridY) => ({ id, name: id, type, gridX, gridY });

describe('buildTokenStackOffsets', () => {
    it('single-token cells and missing props get NO entries (byte-unchanged render path)', () => {
        const { players, items } = buildTokenStackOffsets({
            mapData: { players: [player('ef', 1, 2)] },
            placedItems: [item('w1', 'npc', 5, 5)],
        });
        expect(players.size).toBe(0);
        expect(items.size).toBe(0);

        expect(() => buildTokenStackOffsets({})).not.toThrow();
        const empty = buildTokenStackOffsets({ mapData: null, placedItems: null });
        expect(empty.players.size).toBe(0);
        expect(empty.items.size).toBe(0);
    });

    it('fans a full stack in SVG paint order, not array order: player buried, monster next, npc centred', () => {
        const { players, items } = buildTokenStackOffsets({
            // npc listed FIRST yet the monster still paints below it
            // (per-type renderItems passes), and the whole Players layer
            // paints below every creature — the GA witness face.
            mapData: { players: [player('ef', 3, 3)] },
            placedItems: [item('thug', 'npc', 3, 3), item('wolf', 'monster', 3, 3)],
        });
        expect(players.get('ef')).toEqual({ dx: -2 * STACK_OFFSET_PX, dy: -2 * STACK_OFFSET_PX });
        expect(items.get('wolf')).toEqual({ dx: -STACK_OFFSET_PX, dy: -STACK_OFFSET_PX });
        expect(items.get('thug')).toEqual({ dx: 0, dy: 0 });
        // Same-type ordering follows the array: the later entry paints on top
        // (proven separately with a pure player stack below).
        const pair = buildTokenStackOffsets({
            mapData: { players: [player('a', 2, 2), player('b', 2, 2)] },
            placedItems: [],
        });
        expect(pair.players.get('a')).toEqual({ dx: -STACK_OFFSET_PX, dy: -STACK_OFFSET_PX });
        expect(pair.players.get('b')).toEqual({ dx: 0, dy: 0 });
    });

    it('deep stacks cap the fan so offsets never leave the cell neighbourhood', () => {
        const { players } = buildTokenStackOffsets({
            mapData: { players: [player('p1', 0, 0), player('p2', 0, 0), player('p3', 0, 0), player('p4', 0, 0)] },
            placedItems: [],
        });
        // Paint order p1..p4: top p4 centred, p3/p2 one & two steps back…
        expect(players.get('p4')).toEqual({ dx: 0, dy: 0 });
        expect(players.get('p3')).toEqual({ dx: -STACK_OFFSET_PX, dy: -STACK_OFFSET_PX });
        expect(players.get('p2')).toEqual({ dx: -2 * STACK_OFFSET_PX, dy: -2 * STACK_OFFSET_PX });
        // …and the deepest token, three steps from the top, collapses onto
        // the cap step (still deterministic).
        expect(players.get('p1')).toEqual({ dx: -MAX_STACK_OFFSET_STEPS * STACK_OFFSET_PX, dy: -MAX_STACK_OFFSET_STEPS * STACK_OFFSET_PX });
    });

    it('the dragged token leaves its stack (siblings re-centre, mover rides the true cell centre)', () => {
        const stacked = {
            mapData: { players: [player('ef', 3, 3)] },
            placedItems: [item('wolf', 'npc', 3, 3)],
        };
        // With ef lifted, the wolf cell holds ONE token → no stack at all.
        const playerLift = buildTokenStackOffsets({ ...stacked, dragging: { playerId: 'ef' } });
        expect(playerLift.players.size).toBe(0);
        expect(playerLift.items.size).toBe(0);

        const itemLift = buildTokenStackOffsets({ ...stacked, itemDragging: { itemId: 'wolf' } });
        expect(itemLift.players.size).toBe(0);
        expect(itemLift.items.size).toBe(0);
    });

    it('tokens without finite grid coords are skipped, not stacked on a shared NaN cell', () => {
        const { players, items } = buildTokenStackOffsets({
            mapData: { players: [player('a', null, null), player('b', undefined, 2)] },
            placedItems: [item('w1', 'npc', 'x', 1)],
        });
        expect(players.size).toBe(0);
        expect(items.size).toBe(0);
    });
});

describe('tokenStackTransform', () => {
    it('emits an SVG translate for offset tokens and undefined (ABSENT attribute) otherwise', () => {
        expect(tokenStackTransform(new Map([['ef', { dx: -10, dy: -10 }]]), 'ef')).toBe('translate(-10, -10)');
        // missing map, missing id, and centred stack tops all render with no
        // transform attribute at all.
        expect(tokenStackTransform(undefined, 'a')).toBeUndefined();
        expect(tokenStackTransform(new Map(), 'a')).toBeUndefined();
        expect(tokenStackTransform(new Map([['a', { dx: 0, dy: 0 }]]), 'a')).toBeUndefined();
    });
});
