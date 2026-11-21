// @maintained-by-ai
// Pure placement math for the quick-spawn map-token stamp (2026-11-20 CCC
// backlog). Every law the opt-in flow promises the GM is pinned here without a
// single fetch: party-relative anchor, fixed preferred offset, deterministic
// occupied-cell scan, grid clamping, saturation → null, the exact placedItems
// row shape of the owner map fixtures, and the series-renumber token follow
// (board 'Goblin' → 'Goblin 1' drags its token along with it).
import { describe, it, expect } from 'vitest';
import {
    SPAWN_TOKEN_PREFERRED_OFFSET,
    partyAnchor,
    occupiedCells,
    findFreeSpawnCell,
    spawnTokenId,
    buildSpawnTokenRows,
    renumberSeriesToken,
} from './spawnTokenPlacement.js';

const indoorDoc = (over = {}) => ({
    name: 'qa-sandbox',
    type: 'indoor',
    gridSize: 20,
    players: [{ id: 'alice', name: 'Alice', gridX: 3, gridY: 4 }],
    placedItems: [],
    ...over,
});

describe('partyAnchor', () => {
    it('rounds the centroid of the players[] tokens', () => {
        const doc = indoorDoc({ players: [
            { name: 'A', gridX: 1, gridY: 10 },
            { name: 'B', gridX: 2, gridY: 10 },
            { name: 'C', gridX: 35, gridY: 11 },
        ] });
        expect(partyAnchor(doc)).toEqual({ gridX: 13, gridY: 10 });
    });

    it('skips coordinate-less player rows and falls back to the grid centre when the party has no tokens', () => {
        expect(partyAnchor(indoorDoc({ players: [{ name: 'Ghost' }] }))).toEqual({ gridX: 10, gridY: 10 });
        expect(partyAnchor(indoorDoc({ players: [] }))).toEqual({ gridX: 10, gridY: 10 });
        expect(partyAnchor(indoorDoc({ gridSize: 0, players: [] }))).toEqual({ gridX: 0, gridY: 0 });
    });
});

describe('occupiedCells', () => {
    it('unions players[] and placedItems[] cells and ignores rows without finite coords', () => {
        const doc = indoorDoc({ placedItems: [
            { id: 'a', type: 'npc', name: 'Goblin', gridX: 5, gridY: 4, visible: true },
            { id: 'b', type: 'barrel', gridX: 7 },
        ] });
        expect([...occupiedCells(doc)].sort()).toEqual(['3,4', '5,4']);
    });
});

describe('findFreeSpawnCell', () => {
    const occ = (...cells) => new Set(cells);

    it('takes the party + preferred offset cell when free', () => {
        const cell = findFreeSpawnCell({ anchor: { gridX: 3, gridY: 4 }, occupied: occ(), gridSize: 20 });
        expect(cell).toEqual({
            gridX: 3 + SPAWN_TOKEN_PREFERRED_OFFSET.dx,
            gridY: 4 + SPAWN_TOKEN_PREFERRED_OFFSET.dy,
        });
    });

    it('scans deterministically to the next free cell when the preferred one is occupied', () => {
        // Preferred (5,4) taken → ring 1 walks dx-then-dy: (4,3) first free.
        const once = findFreeSpawnCell({ anchor: { gridX: 3, gridY: 4 }, occupied: occ('5,4'), gridSize: 20 });
        expect(once).toEqual({ gridX: 4, gridY: 3 });
        const twice = findFreeSpawnCell({ anchor: { gridX: 3, gridY: 4 }, occupied: occ('5,4', '4,3'), gridSize: 20 });
        expect(twice).toEqual({ gridX: 4, gridY: 4 });
        // Same inputs, same answer — no rng anywhere in the scan.
        expect(findFreeSpawnCell({ anchor: { gridX: 3, gridY: 4 }, occupied: occ('5,4'), gridSize: 20 })).toEqual(once);
    });

    it('clamps candidates inside the grid bounds (edge anchors never escape)', () => {
        const cell = findFreeSpawnCell({ anchor: { gridX: 19, gridY: 19 }, occupied: occ(), gridSize: 20 });
        expect(cell).toEqual({ gridX: 19, gridY: 19 });
        // Clamped duplicates still dodge occupancy: (19,19) taken → ring 1.
        const moved = findFreeSpawnCell({ anchor: { gridX: 19, gridY: 19 }, occupied: occ('19,19'), gridSize: 20 });
        expect(moved).toEqual({ gridX: 18, gridY: 18 });
    });

    it('returns null only when the whole clamped scan neighbourhood is occupied', () => {
        const occupied = occ();
        for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) occupied.add(`${x},${y}`);
        expect(findFreeSpawnCell({ anchor: { gridX: 1, gridY: 1 }, occupied, gridSize: 4 })).toBeNull();
    });
});

describe('spawnTokenId', () => {
    it('kebab-slugs the name and embeds the cell (staging coverId precedent)', () => {
        expect(spawnTokenId('Goblin 2', { gridX: 5, gridY: 4 })).toBe('quick-spawn-goblin-2-5-4');
    });
});

describe('buildSpawnTokenRows', () => {
    it('emits fixture-shaped rows named EXACTLY after the board names', () => {
        const rows = buildSpawnTokenRows(indoorDoc(), ['Goblin']);
        expect(rows).toEqual([
            { id: 'quick-spawn-goblin-5-4', type: 'npc', name: 'Goblin', gridX: 5, gridY: 4, visible: true },
        ]);
    });

    it('never stacks a batch on one cell — later names scan to the next free cell', () => {
        const rows = buildSpawnTokenRows(indoorDoc(), ['Goblin 1', 'Goblin 2']);
        expect(rows.map(r => r.name)).toEqual(['Goblin 1', 'Goblin 2']);
        expect(rows.map(r => `${r.gridX},${r.gridY}`)).toEqual(['5,4', '4,3']);
        const keys = new Set(rows.map(r => `${r.gridX},${r.gridY}`));
        expect(keys.size).toBe(rows.length);
    });

    it('stops short instead of teleporting survivors when the neighbourhood saturates', () => {
        // 2×2 grid, party on (1,1): only (0,0), (0,1), (1,0) are ever free —
        // the fourth name draws nothing and the batch TRUNCATES loudly.
        const doc = indoorDoc({ gridSize: 2, players: [{ name: 'Alice', gridX: 1, gridY: 1 }] });
        const rows = buildSpawnTokenRows(doc, ['Goblin 1', 'Goblin 2', 'Goblin 3', 'Goblin 4']);
        expect(rows.map(r => `${r.gridX},${r.gridY}`)).toEqual(['0,0', '0,1', '1,0']);
    });

    it('blocks cells already held by players[] AND placedItems[] tokens', () => {
        const doc = indoorDoc({ placedItems: [
            { id: 'g1', type: 'npc', name: 'Goblin', gridX: 5, gridY: 4, visible: true },
        ] });
        const rows = buildSpawnTokenRows(doc, ['Goblin 2']);
        expect(rows[0].gridX).not.toBe(5);
        expect(rows[0].gridY).not.toBe(4);
        expect(rows[0].name).toBe('Goblin 2');
    });
});

describe('renumberSeriesToken', () => {
    const mkPlain = () => ({ id: 'quick-spawn-goblin-5-4', type: 'npc', name: 'Goblin', gridX: 5, gridY: 4, visible: true });

    it('follows the join-lane renumber: orphaned plain token takes the lowest unclaimed board number', () => {
        const rows = [mkPlain()];
        expect(renumberSeriesToken(rows, ['Goblin 1', 'Goblin 2', 'Alice'], 'Goblin')).toBe(true);
        expect(rows[0].name).toBe('Goblin 1');
    });

    it('is a no-op while the plain board row still exists, when no token is orphaned, or when no free series number is on the board', () => {
        expect(renumberSeriesToken([mkPlain()], ['Goblin', 'Goblin 2'], 'Goblin')).toBe(false);
        expect(renumberSeriesToken([{ ...mkPlain(), name: 'Orc' }], ['Goblin 1'], 'Goblin')).toBe(false);
        const untouched = [mkPlain()];
        expect(renumberSeriesToken(untouched, ['Goblin 3'], 'Goblin')).toBe(false);
        expect(untouched[0].name).toBe('Goblin');
    });

    it('skips numbers already claimed by another token', () => {
        const rows = [
            mkPlain(),
            { id: 'x', type: 'npc', name: 'Goblin 1', gridX: 8, gridY: 8, visible: true },
        ];
        expect(renumberSeriesToken(rows, ['Goblin 1', 'Goblin 2'], 'Goblin')).toBe(true);
        expect(rows[0].name).toBe('Goblin 2');
    });
});
