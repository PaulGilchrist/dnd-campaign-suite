// @maintained-by-ai
// Campaign-authoring Phase 5 — map pipeline: real in-process generators +
// deterministic dressing. The model's mapPlan (params + ops) is the only
// input; grid JSON never passes through it. All checks are seeded-deterministic.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const MOCK_FS = new Map();

vi.mock('fs', () => ({
    default: {
        existsSync: vi.fn((p) => MOCK_FS.has(p)),
        mkdirSync: vi.fn(),
        readFileSync: vi.fn((p) => {
            const c = MOCK_FS.get(p);
            if (c === undefined) throw new Error(`ENOENT ${p}`);
            return typeof c === 'string' ? c : JSON.stringify(c);
        }),
        writeFileSync: vi.fn((p, data) => { MOCK_FS.set(p, JSON.parse(data)); }),
    },
}));

vi.mock('../../../utils/campaignPaths.js', () => ({
    campaignMapsDir: (c) => `/mock/campaigns/${c}/maps`,
    ensureDataDir: (c) => `/mock/campaigns/${c}/data`,
}));

const publish = vi.fn();
vi.mock('../../../utils/changeData.js', () => ({
    publish: (...a) => publish(...a),
}));

import { applyMapPlans } from './applyMaps.js';

const MAPS = '/mock/campaigns/unit/maps';
const readMap = (slug) => MOCK_FS.get(`${MAPS}/${slug}.json`);

beforeEach(() => { MOCK_FS.clear(); publish.mockClear(); });

describe('applyMapPlans — dungeon', () => {
    const plan = () => ({
        name: 'sunken-temple',
        displayName: 'Sunken Temple',
        generator: 'dungeon',
        params: { gridSize: 25, density: 0.5, seed: 1 },
        dressing: {
            pois: [{ name: 'Ruin Mouth', gridX: 1, gridY: 1 }],
            placedItemOps: [
                { op: 'add', item: { type: 'chest', gridX: 3, gridY: 3 } },
                { op: 'remove', itemIndex: 0 },
            ],
            tokens: [{ encounterName: 'Ferry Ambush', creatureName: 'Goblin', gridX: 5, gridY: 5 }],
        },
    });

    it('generates, dresses, stamps draft, and broadcasts like the create lane', () => {
        expect(applyMapPlans('unit', [plan()])).toBe(1);
        const doc = readMap('sunken-temple');
        expect(doc).toMatchObject({
            name: 'sunken-temple', displayName: 'Sunken Temple', type: 'indoor', draft: true,
            gridSize: 25, generationMode: 'ai-designed',
        });
        expect(doc.walls.length).toBeGreaterThan(0);
        // seed 1/density 0.5/grid 25 generated ≥1 item (the remove op relied on it).
        const chest = doc.placedItems.find(i => i.type === 'chest' && i.gridX === 3 && i.gridY === 3);
        expect(chest).toMatchObject({ visible: true, rotation: 0 });
        expect(chest.id).toMatch(/^ai-chest-/);
        // Monster token rides the items[] lane the map editors already render.
        expect(doc.items).toEqual([expect.objectContaining({ name: 'Goblin', type: 'monster', gridX: 5, gridY: 5, fromEncounter: 'Ferry Ambush' })]);
        expect(doc.pois[0]).toMatchObject({ label: 'Ruin Mouth', gridX: 1, gridY: 1 });
        expect(publish).toHaveBeenCalledWith('maps-list-unit',
            { action: 'created', map: { name: 'Sunken Temple', fileName: 'sunken-temple.json', slug: 'sunken-temple' } }, 'unit');
    });

    it('is deterministic for a given seed', () => {
        applyMapPlans('unit', [plan()]);
        const first = JSON.stringify(readMap('sunken-temple').walls);
        MOCK_FS.clear();
        applyMapPlans('unit', [plan()]);
        expect(JSON.stringify(readMap('sunken-temple').walls)).toBe(first);
    });

    it('rejects out-of-bounds dressing and stale itemIndex BEFORE writing', () => {
        const bad = plan();
        bad.dressing.tokens[0].gridX = 99;
        expect(() => applyMapPlans('unit', [bad])).toThrow(/outside the map/);
        expect(MOCK_FS.size).toBe(0); // all-or-nothing: nothing half-written

        const stale = plan();
        stale.dressing.placedItemOps = [{ op: 'remove', itemIndex: 9999 }];
        expect(() => applyMapPlans('unit', [stale])).toThrow(/does not address a generated item/);
        expect(MOCK_FS.size).toBe(0);
    });
});

describe('applyMapPlans — hex', () => {
    it('builds an outdoor document with q/r POIs and linkedMap portals', () => {
        const plans = [
            { name: 'dusk-mere', displayName: 'Dusk Mere', generator: 'hex', params: { gridSize: 8, seed: 2 } },
            {
                name: 'north-reach', displayName: 'North Reach', generator: 'hex', params: { gridSize: 8, seed: 4 },
                dressing: { pois: [{ name: 'Temple Door', gridX: 2, gridY: 3, targetMap: 'dusk-mere' }] },
            },
        ];
        expect(applyMapPlans('unit', plans)).toBe(2);
        const mere = readMap('dusk-mere');
        expect(mere.type).toBe('outdoor');
        expect(Object.keys(mere.terrain).length).toBeGreaterThan(30); // hex cells keyed "q,r"
        expect(Array.isArray(mere.rivers)).toBe(true);
        expect(mere.draft).toBe(true);

        const north = readMap('north-reach');
        expect(north.pois[0]).toMatchObject({ q: 2, r: 3, label: 'Temple Door', linkedMap: 'dusk-mere' });
    });

    it('refuses dungeon-only dressing on a hex map', () => {
        const plan = { name: 'wrong', displayName: 'Wrong', generator: 'hex', params: { gridSize: 6, seed: 1 }, dressing: { placedItemOps: [{ op: 'add', item: { type: 'chest', gridX: 1, gridY: 1 } }] } };
        expect(() => applyMapPlans('unit', [plan])).toThrow(/dungeon-only/);
        expect(MOCK_FS.size).toBe(0);
    });
});
