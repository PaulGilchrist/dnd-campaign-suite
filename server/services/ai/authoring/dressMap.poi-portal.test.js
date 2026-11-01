// @maintained-by-ai
// Regression (bug-ai-dress-poi-portal-inert-on-indoor-maps): the dress op set
// advertised poi.targetMap for EVERY map kind, but linkedMap has zero indoor
// consumers (the whole Enter/portal machine lives in src/components/hex-map/),
// so applying it on an indoor map persisted a fake door that could never open.
// The applier must refuse it exactly like the INDOOR_ONLY item/token pair, the
// prompt must say so, and valid hex portals must name their destination.
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

vi.mock('../../../utils/changeData.js', () => ({
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

const indoorDoc = (over) => ({
    name: 'test-map', type: 'indoor', gridSize: 25,
    placedItems: [], items: [], pois: [], walls: [], revealed: [], fog: [],
    ...over,
});
const hexDoc = (over) => ({
    name: 'north-reach', type: 'outdoor', gridSize: 8,
    terrain: { '7,2': 'grass', '6,2': 'hills', '7,3': 'forest' },
    pois: [],
    ...over,
});

const portalAdd = {
    op: 'add', target: 'poi',
    poi: { name: 'QA AY Gate', description: 'A gate to the arena.', targetMap: 'battle-arena' },
    gridX: 7, gridY: 2,
};
const writePlan = (ops) => vi.fn(async () => JSON.stringify({ ops }));

beforeEach(() => MOCK_FS.clear());

describe('applyDressOps — poi portals are outdoor-only', () => {
    it('refuses poi.targetMap on an indoor map (mirrors the item/token INDOOR_ONLY gate)', () => {
        const res = applyDressOps(indoorDoc(), [portalAdd]);
        expect(res.errors.join(' ')).toMatch(/ops\[0\] "add poi": poi portals are outdoor-only \(party travel is hex-based\)/);
    });

    it('all-or-nothing: a plain indoor poi alongside a portal op writes NEITHER row', () => {
        const res = applyDressOps(indoorDoc(), [
            { op: 'add', target: 'poi', poi: { name: 'Shrine' }, gridX: 6, gridY: 3 },
            portalAdd,
        ]);
        expect(res.errors).toHaveLength(1);
        expect(res.updated).toBeUndefined();
    });

    it('a plain indoor poi (no targetMap) still applies with the generic copy', () => {
        const res = applyDressOps(indoorDoc(), [
            { op: 'add', target: 'poi', poi: { name: 'Shrine' }, gridX: 6, gridY: 3 },
        ]);
        expect(res.preview).toEqual(['add POI Shrine at 6,3']);
        expect(res.updated.pois[0]).not.toHaveProperty('linkedMap');
    });

    it('a valid hex portal applies AND names the destination in the preview', () => {
        const res = applyDressOps(hexDoc(), [portalAdd]);
        expect(res.updated.pois[0]).toMatchObject({ q: 7, r: 2, label: 'QA AY Gate', linkedMap: 'battle-arena' });
        expect(res.preview).toEqual(['add portal POI QA AY Gate → battle-arena at 7,2']);
    });

    it('a poi move/remove citing an existing row is unaffected by the gate', () => {
        const res = applyDressOps(indoorDoc({
            pois: [{ id: 'poi-1', label: 'Old Door', gridX: 1, gridY: 1, linkedMap: 'battle-arena' }],
        }), [
            { op: 'move', target: 'poi', id: 'poi-1', gridX: 2, gridY: 2 },
            { op: 'remove', target: 'poi', id: 'poi-1' },
        ]);
        expect(res.updated.pois).toEqual([]);
    });
});

describe('dressMapProposal — indoor portal refusal feeds the repair loop', () => {
    beforeEach(() => MOCK_FS.set(`${MAPS}/test-map.json`, indoorDoc()));

    it('the system prompt advertises portals as outdoor-only', async () => {
        const chatFn = writePlan([{ op: 'add', target: 'poi', poi: { name: 'Shrine' }, gridX: 6, gridY: 3 }]);
        const res = await dressMapProposal({ campaign: 'unit', mapName: 'test-map', instruction: 'add a shrine', aiConfig: AI, chatFn });
        expect(res.ok).toBe(true);
        expect(chatFn.mock.calls[0][0].messages[0].content).toMatch(/portals are OUTDOOR hex maps only/);
    });

    it('a persistent portal proposal fails closed with the outdoor-only error surfaced to the model', async () => {
        const chatFn = writePlan([portalAdd]);
        const res = await dressMapProposal({ campaign: 'unit', mapName: 'test-map', instruction: 'open a gate', aiConfig: AI, chatFn });
        expect(res.ok).toBe(false);
        expect(res.errors.join(' ')).toMatch(/poi portals are outdoor-only/);
        expect(chatFn).toHaveBeenCalledTimes(2);
        // the repair turn quotes the exact error so the model can re-propose
        // without the link instead of the GM approving a dead door
        const second = chatFn.mock.calls[1][0].messages;
        expect(JSON.stringify(second[second.length - 1])).toMatch(/poi portals are outdoor-only/);
    });
});
