// @maintained-by-ai
// Staging-map lane (backlog 2026-10-26 run E): accepted travel events reuse
// ONE map per campaign instead of spawning a per-event arena. This file owns
// create-once / reuse-wipe-and-reseed / cover-tier semantics. Routing
// (eventTitle ⇒ staging, manual ⇒ arena) is pinned in
// components/hex-map/hooks/useEncounterGeneration.test.js; the auto-encounter
// audit copy stays in autoEncounterService.test.js.
//
// Cover truth = rules/combat/coverService.js computeCover (REAL, not mocked):
// 1/2 = single-cell barrel/…/statue, 3/4 = two-cell altar/bed/bookshelf/table,
// FULL = closed door item on the ray interior. Randomization is rng-injected —
// no timers (npm run guard:no-timers).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as mapsService from '../maps/mapsService.js';
import { computeCover, COVER } from '../rules/combat/coverService.js';
import {
    STAGING_MAP_NAME,
    STAGING_MAP_SLUG,
    HALF_COVER_ITEM_TYPES,
    THREE_QUARTER_COVER_ITEM_TYPES,
    generateCoverLayout,
    stageEventEncounterMap,
} from './encounterStagingService.js';

vi.mock('../maps/mapsService.js', async () => {
    const actual = await vi.importActual('../maps/mapsService.js');
    return { ...actual, loadMaps: vi.fn(), createMap: vi.fn(), saveMapData: vi.fn() };
});

const CN = 'test-campaign';
const BASELINE_MAPS = [
    { name: 'Battle Arena', fileName: 'battle-arena.json', type: 'indoor' },
    { name: 'Test Map', fileName: 'test-map.json', type: 'indoor' },
];
const STAGING_ROW = { name: STAGING_MAP_NAME, fileName: `${STAGING_MAP_SLUG}.json`, type: 'indoor' };

const TWO_CELL_TYPES = new Set(THREE_QUARTER_COVER_ITEM_TYPES);

function seededRandom(seed) {
    let state = seed >>> 0;
    return () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 4294967296;
    };
}

const cellOf = (item) => `${item.gridX},${item.gridY}`;
const occupiedOf = (item) => {
    if (!TWO_CELL_TYPES.has(item.type)) return [cellOf(item)];
    const vertical = (item.rotation || 0) % 180 === 90;
    return [
        cellOf(item),
        vertical ? `${item.gridX},${item.gridY + 1}` : `${item.gridX + 1},${item.gridY}`,
    ];
};
const coverCells = (items) =>
    new Set(items.filter((i) => String(i.id).startsWith('stage-cover-')).flatMap(occupiedOf));

const eventArgs = (overrides = {}) => ({
    campaignName: CN,
    terrainType: 'forest',
    q: 11,
    r: 10,
    gridSize: 30,
    decorItems: [{ id: 'tree-0', type: 'tree', gridX: 4, gridY: 22, visible: true }],
    monsterItems: [{ id: 'enc-monster-0', type: 'npc', name: 'Wolf', gridX: 9, gridY: 15, visible: true }],
    players: [{ id: 'alice', name: 'Alice', gridX: 14, gridY: 14 }],
    bgFill: '#2D5E37',
    ...overrides,
});

beforeEach(() => {
    vi.clearAllMocks();
    mapsService.loadMaps.mockResolvedValue({ maps: BASELINE_MAPS });
    mapsService.createMap.mockResolvedValue({ message: 'Map created successfully' });
    mapsService.saveMapData.mockResolvedValue({ message: 'Map saved successfully' });
});

describe('staging map identity', () => {
    it('resolves by a stable, re-findable name/slug', () => {
        expect(STAGING_MAP_NAME).toBe('Travel Encounter Stage');
        expect(STAGING_MAP_SLUG).toBe('travel-encounter-stage');
        expect(mapsService.toKebabCase(STAGING_MAP_NAME)).toBe(STAGING_MAP_SLUG);
    });
});

describe('generateCoverLayout', () => {
    it('seeds all three cover tiers every reuse (AC3 producers present)', () => {
        for (const seed of [1, 2, 3, 4, 5]) {
            const items = generateCoverLayout({ gridSize: 30, rng: seededRandom(seed) });
            expect(items.some((i) => HALF_COVER_ITEM_TYPES.includes(i.type))).toBe(true);
            expect(items.some((i) => THREE_QUARTER_COVER_ITEM_TYPES.includes(i.type))).toBe(true);
            const full = items.find((i) => i.type === 'door');
            expect(full).toBeTruthy();
            expect(full.open).toBe(false); // closed ⇒ computeCover FULL
            expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
            expect(items.every((i) => i.visible === true)).toBe(true);
        }
    });

    it('each tier classifies through the REAL coverService ladder: half +2, 3/4 +5, full auto-block', () => {
        const items = generateCoverLayout({ gridSize: 30, rng: seededRandom(7) });
        const tierItem = (predicate) => items.find(predicate);

        const half = tierItem((i) => HALF_COVER_ITEM_TYPES.includes(i.type));
        expect(computeCover({ gridX: half.gridX - 2, gridY: half.gridY }, { gridX: half.gridX + 2, gridY: half.gridY }, [], [half]))
            .toEqual({ level: COVER.HALF, acBonus: 2 });

        const three = tierItem((i) => TWO_CELL_TYPES.has(i.type));
        expect(computeCover({ gridX: three.gridX - 2, gridY: three.gridY }, { gridX: three.gridX + 2, gridY: three.gridY }, [], [three]))
            .toEqual({ level: COVER.THREE_QUARTER, acBonus: 5 });

        const door = tierItem((i) => i.type === 'door');
        expect(computeCover({ gridX: door.gridX - 2, gridY: door.gridY }, { gridX: door.gridX + 2, gridY: door.gridY }, [], [door]))
            .toEqual({ level: COVER.FULL, acBonus: null });

        // Sanity: the same ray with the door removed is NOT covered.
        expect(computeCover({ gridX: door.gridX - 2, gridY: door.gridY }, { gridX: door.gridX + 2, gridY: door.gridY }, [], []))
            .toEqual({ level: COVER.NONE, acBonus: 0 });
    });

    it('keeps reserved combatant cells clear (no cover under a token)', () => {
        const blocked = ['14,13', '15,13', '16,13', '14,14', '9,15'];
        const items = generateCoverLayout({ gridSize: 30, blockedCells: blocked, rng: seededRandom(99) });
        expect(items.length).toBeGreaterThan(0);
        for (const item of items) {
            for (const cell of occupiedOf(item)) {
                expect(blocked).not.toContain(cell);
            }
        }
    });

    it('two-cell items stay in bounds on BOTH occupied cells', () => {
        const items = generateCoverLayout({ gridSize: 30, rng: seededRandom(123) });
        const wide = items.filter((i) => TWO_CELL_TYPES.has(i.type));
        expect(wide.length).toBeGreaterThanOrEqual(2);
        for (const item of wide) {
            for (const cell of occupiedOf(item)) {
                const [x, y] = cell.split(',').map(Number);
                expect(x).toBeGreaterThanOrEqual(0);
                expect(x).toBeLessThan(30);
                expect(y).toBeGreaterThanOrEqual(0);
                expect(y).toBeLessThan(30);
            }
        }
    });

    it('is deterministic under a mocked rng and differs across seeds', () => {
        const a = generateCoverLayout({ gridSize: 30, rng: seededRandom(5) });
        const b = generateCoverLayout({ gridSize: 30, rng: seededRandom(5) });
        const c = generateCoverLayout({ gridSize: 30, rng: seededRandom(6) });
        expect(a).toEqual(b);
        expect(coverCells(c)).not.toEqual(coverCells(a));
    });

    it('centers the scatter around the combatant spawn zone (ring around the grid centre)', () => {
        const items = generateCoverLayout({ gridSize: 30, rng: seededRandom(31) });
        for (const item of items) {
            const dist = Math.hypot(item.gridX - 15, item.gridY - 15);
            expect(dist).toBeGreaterThanOrEqual(2);
            expect(dist).toBeLessThanOrEqual(13);
        }
    });
});

describe('stageEventEncounterMap — create once, reuse forever', () => {
    it('AC1: first accept creates exactly ONE staging map (POST + authoritative PUT) with combatants placed', async () => {
        const r = await stageEventEncounterMap(eventArgs({ rng: seededRandom(11) }));

        expect(r).toEqual({ label: 'Travel Encounter Stage', reused: false });
        expect(mapsService.createMap).toHaveBeenCalledTimes(1);
        expect(mapsService.createMap).toHaveBeenCalledWith(CN, STAGING_MAP_NAME, expect.objectContaining({
            type: 'indoor',
            gridSize: 30,
            players: [{ id: 'alice', name: 'Alice', gridX: 14, gridY: 14 }],
            fog: [],
            walls: [],
            parentTerrain: 'forest',
            parentHex: { q: 11, r: 10 },
            bgFill: '#2D5E37',
        }));
        expect(mapsService.saveMapData).toHaveBeenCalledTimes(1);
        const doc = mapsService.saveMapData.mock.calls[0][2];
        expect(mapsService.saveMapData.mock.calls[0][1]).toBe(STAGING_MAP_NAME);
        expect(doc.displayName).toBe(STAGING_MAP_NAME);
        expect(doc.name).toBe(STAGING_MAP_SLUG);
        // Party token, the event's monster token, and fresh cover all placed.
        expect(doc.players).toHaveLength(1);
        expect(doc.placedItems.some((i) => i.type === 'npc' && i.name === 'Wolf')).toBe(true);
        expect(coverCells(doc.placedItems).size).toBeGreaterThan(0);
    });

    it('AC2: a second accept does NOT create a map — one reuse PUT re-targets the SAME document', async () => {
        await stageEventEncounterMap(eventArgs({ rng: seededRandom(11) }));
        mapsService.loadMaps.mockResolvedValue({ maps: [...BASELINE_MAPS, STAGING_ROW] });

        const r = await stageEventEncounterMap(eventArgs({
            rng: seededRandom(12),
            q: 8,
            r: 3,
            monsterItems: [{ id: 'enc-monster-0', type: 'npc', name: 'Orc', gridX: 20, gridY: 20, visible: true }],
        }));

        expect(r).toEqual({ label: 'Travel Encounter Stage', reused: true });
        // Map-list count is unchanged: the only POST was the first accept's
        // legitimate create — the reuse leg wrote a single PUT.
        expect(mapsService.createMap).toHaveBeenCalledTimes(1);
        expect(mapsService.saveMapData).toHaveBeenCalledTimes(2);
    });

    it('AC3: reuse WIPES the previous placed items and reseeds a different cover layout', async () => {
        await stageEventEncounterMap(eventArgs({ rng: seededRandom(21) }));
        const firstPut = mapsService.saveMapData.mock.calls[0][2];
        mapsService.loadMaps.mockResolvedValue({ maps: [...BASELINE_MAPS, STAGING_ROW] });

        await stageEventEncounterMap(eventArgs({
            rng: seededRandom(22),
            monsterItems: [{ id: 'enc-monster-0', type: 'npc', name: 'Orc', gridX: 20, gridY: 20, visible: true }],
        }));
        const secondPut = mapsService.saveMapData.mock.calls[1][2];

        const firstCover = coverCells(firstPut.placedItems);
        const secondCover = coverCells(secondPut.placedItems);
        // Positions differ between the event-1 and event-2 layouts…
        expect(secondCover).not.toEqual(firstCover);
        // …and nothing from event 1 survives the wipe (previous cover cells
        // AND the previous monster token are gone from the document).
        const survivors = [...secondCover].filter((cell) => firstCover.has(cell));
        expect(survivors).toEqual([]);
        expect(secondPut.placedItems.some((i) => i.type === 'npc' && i.name === 'Wolf')).toBe(false);
        expect(secondPut.placedItems.some((i) => i.type === 'npc' && i.name === 'Orc')).toBe(true);
        // The reseed still carries every tier (this is the AC3 diff the live
        // GET comparison replays on the map document).
        expect(secondCover.size).toBeGreaterThan(0);
        const types = secondPut.placedItems.filter((i) => String(i.id).startsWith('stage-cover-')).map((i) => i.type);
        expect(types.some((t) => HALF_COVER_ITEM_TYPES.includes(t))).toBe(true);
        expect(types.some((t) => THREE_QUARTER_COVER_ITEM_TYPES.includes(t))).toBe(true);
        expect(types).toContain('door');
    });

    it('never covers a combatant cell on either leg', async () => {
        const reserved = ['14,14', '9,15', '4,22']; // party + monster + decor
        await stageEventEncounterMap(eventArgs({ rng: seededRandom(41) }));
        const doc = mapsService.saveMapData.mock.calls[0][2];
        for (const cell of coverCells(doc.placedItems)) {
            expect(reserved).not.toContain(cell);
        }
    });

    it('a lost create race still lands the authoritative full-document PUT', async () => {
        mapsService.createMap.mockResolvedValue({ alreadyExists: true });
        const r = await stageEventEncounterMap(eventArgs({ rng: seededRandom(51) }));
        expect(r.reused).toBe(false); // list said absent at resolve time
        expect(mapsService.saveMapData).toHaveBeenCalledTimes(1);
        expect(mapsService.saveMapData.mock.calls[0][2].placedItems.length).toBeGreaterThan(0);
    });

    it('propagates transport failures untouched (hook owns the audit log)', async () => {
        mapsService.loadMaps.mockRejectedValue(new Error('list down'));
        await expect(stageEventEncounterMap(eventArgs())).rejects.toThrow('list down');
        expect(mapsService.createMap).not.toHaveBeenCalled();
        expect(mapsService.saveMapData).not.toHaveBeenCalled();
    });
});
