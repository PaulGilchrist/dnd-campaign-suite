// Same-cell token stacking derivation (backlog GA 2026-11-10: overlapping
// tokens made drag-grabs ambiguous — paint order alone decided the mover and
// the buried token was invisible). This is the PURE seam pinned by the fix:
// buildTokenStackOffsets fans multi-token cells into deterministic offsets
// that mirror SVG paint order (Players layer bottom → monster rows → npc
// rows top), keeping the stack top centred so the VISUALLY topmost token is
// exactly the token hit-testing grabs. Component wiring is owned by
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
    it('single-token cells get NO entry (byte-unchanged render path)', () => {
        const { players, items } = buildTokenStackOffsets({
            mapData: { players: [player('ef', 1, 2)] },
            placedItems: [item('w1', 'npc', 5, 5)],
        });
        expect(players.size).toBe(0);
        expect(items.size).toBe(0);
    });

    it('handles missing props without throwing', () => {
        expect(() => buildTokenStackOffsets({})).not.toThrow();
        const empty = buildTokenStackOffsets({ mapData: null, placedItems: null });
        expect(empty.players.size).toBe(0);
        expect(empty.items.size).toBe(0);
    });

    it('player + npc on one cell: the painted-top npc stays centred, the buried player fans top-left', () => {
        const { players, items } = buildTokenStackOffsets({
            mapData: { players: [player('ef', 3, 3)] },
            placedItems: [item('wolf', 'npc', 3, 3)],
        });
        // The GA witness face: EvasiveFighter (player layer, painted FIRST)
        // is the one that shifts; the Wolf npc token hit-tested topmost.
        expect(players.get('ef')).toEqual({ dx: -STACK_OFFSET_PX, dy: -STACK_OFFSET_PX });
        expect(items.get('wolf')).toEqual({ dx: 0, dy: 0 });
    });

    it('stack order follows PLACEMENT paint order, not array order (monster rows paint before npc rows)', () => {
        const { items } = buildTokenStackOffsets({
            mapData: { players: [] },
            placedItems: [item('npcTop', 'npc', 1, 1), item('mobBottom', 'monster', 1, 1)],
        });
        // Even listed FIRST, the monster renders in the earlier renderItems
        // pass → it is the buried token and must carry the offset.
        expect(items.get('mobBottom')).toEqual({ dx: -STACK_OFFSET_PX, dy: -STACK_OFFSET_PX });
        expect(items.get('npcTop')).toEqual({ dx: 0, dy: 0 });
    });

    it('within one type the later array entry paints on top and stays centred', () => {
        const { players } = buildTokenStackOffsets({
            mapData: { players: [player('a', 2, 2), player('b', 2, 2)] },
            placedItems: [],
        });
        expect(players.get('a')).toEqual({ dx: -STACK_OFFSET_PX, dy: -STACK_OFFSET_PX });
        expect(players.get('b')).toEqual({ dx: 0, dy: 0 });
    });

    it('three-token cells fan monotonically bottom → top', () => {
        const { players, items } = buildTokenStackOffsets({
            mapData: { players: [player('ef', 4, 4)] },
            placedItems: [item('wolf', 'monster', 4, 4), item('thug', 'npc', 4, 4)],
        });
        expect(players.get('ef')).toEqual({ dx: -2 * STACK_OFFSET_PX, dy: -2 * STACK_OFFSET_PX });
        expect(items.get('wolf')).toEqual({ dx: -STACK_OFFSET_PX, dy: -STACK_OFFSET_PX });
        expect(items.get('thug')).toEqual({ dx: 0, dy: 0 });
    });

    it('deep stacks cap the fan so offsets never leave the cell neighbourhood', () => {
        const four = buildTokenStackOffsets({
            mapData: { players: [player('p1', 0, 0), player('p2', 0, 0), player('p3', 0, 0), player('p4', 0, 0)] },
            placedItems: [],
        });
        // Paint order p1..p4: top p4 centred, p3/p2 one & two steps back…
        expect(four.players.get('p4')).toEqual({ dx: 0, dy: 0 });
        expect(four.players.get('p3')).toEqual({ dx: -STACK_OFFSET_PX, dy: -STACK_OFFSET_PX });
        expect(four.players.get('p2')).toEqual({ dx: -2 * STACK_OFFSET_PX, dy: -2 * STACK_OFFSET_PX });
        // …and p5+ collapse onto the cap step (still deterministic).
        expect(four.players.get('p1')).toEqual({ dx: -MAX_STACK_OFFSET_STEPS * STACK_OFFSET_PX, dy: -MAX_STACK_OFFSET_STEPS * STACK_OFFSET_PX });
    });

    it('the dragged token leaves its stack (siblings re-centre, mover rides the true cell centre)', () => {
        const { players, items } = buildTokenStackOffsets({
            mapData: { players: [player('ef', 3, 3)] },
            placedItems: [item('wolf', 'npc', 3, 3)],
            dragging: { playerId: 'ef' },
        });
        // With ef lifted, the wolf cell holds ONE token → no stack at all.
        expect(players.size).toBe(0);
        expect(items.size).toBe(0);

        const itemLift = buildTokenStackOffsets({
            mapData: { players: [player('ef', 3, 3)] },
            placedItems: [item('wolf', 'npc', 3, 3)],
            itemDragging: { itemId: 'wolf' },
        });
        expect(itemLift.players.size).toBe(0);
        expect(itemLift.items.size).toBe(0);
    });

    it('tokens without finite grid coords are skipped, not stacked on a shared NaN cell', () => {
        const { players } = buildTokenStackOffsets({
            mapData: { players: [player('a', null, null), player('b', undefined, 2)] },
            placedItems: [],
        });
        expect(players.size).toBe(0);
    });

    it('derivation is deterministic: same inputs → byte-identical offset maps', () => {
        const input = {
            mapData: { players: [player('ef', 3, 3), player('fr', 9, 9)] },
            placedItems: [item('wolf', 'monster', 3, 3), item('thug', 'npc', 3, 3)],
        };
        const a = buildTokenStackOffsets(input);
        const b = buildTokenStackOffsets(input);
        expect([...a.players]).toEqual([...b.players]);
        expect([...a.items]).toEqual([...b.items]);
    });
});

describe('tokenStackTransform', () => {
    it('returns undefined (ABSENT attribute) for missing maps, missing ids and centred stack tops', () => {
        expect(tokenStackTransform(undefined, 'a')).toBeUndefined();
        expect(tokenStackTransform(new Map(), 'a')).toBeUndefined();
        expect(tokenStackTransform(new Map([['a', { dx: 0, dy: 0 }]]), 'a')).toBeUndefined();
    });

    it('emits an SVG translate for offset tokens', () => {
        const offsets = new Map([['ef', { dx: -10, dy: -10 }]]);
        expect(tokenStackTransform(offsets, 'ef')).toBe('translate(-10, -10)');
    });
});
