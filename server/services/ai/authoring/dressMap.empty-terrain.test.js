// @maintained-by-ai
// Backlog (2026-11-01 BB): an outdoor map created without terrain (POST /maps
// defaults terrain:{}) refused EVERY dress placement op as
// `lands at (x,y) — outside the map (0 hex cells)` — a coordinate-bug reading
// for what is really "generate terrain first". The applier now detects the
// zero-cell terrain set and pushes a distinct hint; maps WITH terrain keep the
// original extent refusal byte-identical (and indoor maps never see the hint).
import { describe, it, expect, vi, beforeEach } from 'vitest';

const MOCK_FS = new Map();

vi.mock('fs', () => ({
    default: {
        existsSync: vi.fn((p) => MOCK_FS.has(p)),
        readFileSync: vi.fn((p) => {
            const c = MOCK_FS.get(p);
            if (c === undefined) throw new Error(`ENOENT ${p}`);
            return typeof c === 'string' ? c : JSON.stringify(c);
        }),
    },
}));

vi.mock('../../../utils/campaignPaths.js', () => ({
    campaignMapsDir: (c) => `/mock/campaigns/${c}/maps`,
    normalizeMapFile: (n) => (n.endsWith('.json') ? n : `${n}.json`),
}));

// routes/maps.js loads for its single toKebabCase implementation.
vi.mock('../../../utils/changeData.js', () => ({
    warnIfNewTopLevelKey: vi.fn(),
    publish: vi.fn(),
    markDirty: vi.fn(),
    activeMaps: new Map(),
    characterChangeData: new Map(),
}));

vi.mock('../providers/localProvider.js', () => ({ chat: vi.fn(), isLocalEndpoint: () => true }));
vi.mock('../index.js', () => ({ aiConfigLive: (c) => !!(c && c.mode && c.mode !== 'off') }));

import { dressMapProposal, applyDressOps } from './dressMap.js';

const AI = { mode: 'autopilot', endpoint: 'http://localhost:1234/v1', model: 'm' };
const MAPS = '/mock/campaigns/unit/maps';

const TERRAIN_HINT = /this hex map has no terrain — generate terrain first/;

const emptyHexDoc = (over) => ({
    name: 'barren-reach', type: 'outdoor', gridSize: 8,
    terrain: {}, pois: [], ...over,
});
const terrainHexDoc = (over) => ({
    name: 'north-reach', type: 'outdoor', gridSize: 8,
    terrain: { '0,0': 'forest', '1,0': 'hills' }, pois: [], ...over,
});

const writePlan = (ops) => vi.fn(async () => JSON.stringify({ ops }));

beforeEach(() => MOCK_FS.clear());

describe('applyDressOps — zero-cell terrain gets the generate-terrain hint', () => {
    it('POI add on a terrain-less hex map names terrain generation, never the (0 hex cells) extent lie', () => {
        const res = applyDressOps(emptyHexDoc(), [
            { op: 'add', target: 'poi', poi: { name: 'Gate' }, gridX: 2, gridY: 2 },
        ]);
        expect(res.errors.join(' ')).toMatch(TERRAIN_HINT);
        expect(res.errors.join(' ')).not.toMatch(/outside the map/);
        expect(res.errors.join(' ')).not.toMatch(/0 hex cells/);
    });

    it('token add and poi move are refused with the same hint (every placement op)', () => {
        const res = applyDressOps(emptyHexDoc({ pois: [{ id: 'poi-1', label: 'Well', q: 2, r: 2 }] }), [
            { op: 'add', target: 'token', token: { name: 'Goblin', kind: 'monster' }, gridX: 1, gridY: 1 },
            { op: 'move', target: 'poi', id: 'poi-1', gridX: 3, gridY: 3 },
        ]);
        expect(res.errors).toHaveLength(2);
        for (const line of res.errors) expect(line).toMatch(TERRAIN_HINT);
    });

    it('all-or-nothing survives: one placement op refuses the whole proposal', async () => {
        MOCK_FS.set(`${MAPS}/barren-reach.json`, emptyHexDoc());
        const chatFn = writePlan([
            { op: 'add', target: 'poi', poi: { name: 'Gate' }, gridX: 2, gridY: 2 },
        ]);
        const res = await dressMapProposal({ campaign: 'unit', mapName: 'barren-reach', instruction: 'gate it', aiConfig: AI, chatFn });
        expect(res.ok).toBe(false);
        expect(res.updated).toBeUndefined();
        expect(res.errors.join(' ')).toMatch(TERRAIN_HINT);
        // the repair turn carries the plain-English hint back to the model
        const second = chatFn.mock.calls[1][0].messages;
        expect(JSON.stringify(second[second.length - 1])).toMatch(TERRAIN_HINT);
    });

    it('id-addressed removes need no ground and still resolve on a terrain-less map', () => {
        const res = applyDressOps(emptyHexDoc({ pois: [{ id: 'poi-1', label: 'Well', q: 2, r: 2 }] }), [
            { op: 'remove', target: 'poi', id: 'poi-1' },
        ]);
        expect(res.errors).toBeUndefined();
        expect(res.preview).toEqual(['remove Well at 2,2']);
    });
});

describe('applyDressOps — regression: maps WITH terrain keep the original refusals', () => {
    it('an out-of-range POI on a hex map still reads "outside the map (2 hex cells)"', () => {
        const res = applyDressOps(terrainHexDoc(), [
            { op: 'add', target: 'poi', poi: { name: 'Nowhere' }, gridX: 5, gridY: 5 },
        ]);
        expect(res.errors.join(' ')).toMatch(/lands at \(5,5\) — outside the map \(2 hex cells\)/);
        expect(res.errors.join(' ')).not.toMatch(TERRAIN_HINT);
    });

    it('an in-range POI on a hex map still applies unchanged', () => {
        const res = applyDressOps(terrainHexDoc(), [
            { op: 'add', target: 'poi', poi: { name: 'Gate' }, gridX: 1, gridY: 0 },
        ]);
        expect(res.errors).toBeUndefined();
        expect(res.updated.pois[0]).toMatchObject({ label: 'Gate', q: 1, r: 0 });
    });

    it('token ops on a hex map WITH terrain keep the indoor-only refusal', () => {
        const res = applyDressOps(terrainHexDoc(), [
            { op: 'add', target: 'token', token: { name: 'Goblin', kind: 'monster' }, gridX: 0, gridY: 0 },
        ]);
        expect(res.errors.join(' ')).toMatch(/indoor-only/);
        expect(res.errors.join(' ')).not.toMatch(TERRAIN_HINT);
    });

    it('indoor out-of-range ops never see the hex hint', () => {
        const res = applyDressOps(
            { type: 'indoor', gridSize: 10, placedItems: [], items: [], pois: [], terrain: {} },
            [{ op: 'add', target: 'item', item: { type: 'chest' }, gridX: 40, gridY: 3 }],
        );
        expect(res.errors.join(' ')).toMatch(/outside the map \(10×10 grid\)/);
        expect(res.errors.join(' ')).not.toMatch(TERRAIN_HINT);
    });
});
