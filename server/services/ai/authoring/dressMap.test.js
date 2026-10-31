// @maintained-by-ai
// Campaign-authoring residual item 2 — "AI Dress": in-place ops on the LIVE
// map document (owner-locked: never regenerate). Fixtures are real seeded
// generator output (deterministic), covering the id-addressed remove/move
// legs, the reject-before-propose all-or-nothing gate, hex terrain-cell
// validation, the digest's blob exclusion, and the hard rule that the
// service NEVER writes — disk access is a read-only fs mock.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const MOCK_FS = new Map();

vi.mock('fs', () => ({
    default: {
        // Deliberately NO writeFileSync: any write attempt throws loudly —
        // the proposal-only contract is enforced by the runtime, not asserted.
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
    publish: vi.fn(),
    markDirty: vi.fn(),
    activeMaps: new Map(),
    characterChangeData: new Map(),
}));

vi.mock('../providers/localProvider.js', () => ({ chat: vi.fn(), isLocalEndpoint: () => true }));
vi.mock('../index.js', () => ({ aiConfigLive: (c) => !!(c && c.mode && c.mode !== 'off') }));

import { dressMapProposal, applyDressOps } from './dressMap.js';
import { liveDressPlanSchema } from './entitySchemas.js';
import { generateDungeon } from '../../../../src/services/maps/dungeonGenerator.js';
import { generateHexTerrain } from '../../../../src/services/maps/hexTerrainGenerator.js';

const AI = { mode: 'autopilot', endpoint: 'http://localhost:1234/v1', model: 'm' };
const MAPS = '/mock/campaigns/unit/maps';

function indoorFixture() {
    const g = generateDungeon({ gridSize: 25, density: 0.5, seed: 7 });
    return {
        name: 'sunken-temple', displayName: 'Sunken Temple', type: 'indoor', draft: true,
        gridSize: g.gridSize, walls: g.walls, placedItems: g.placedItems,
        paintCells: [], items: [{ id: 'tok-goblin-1', name: 'Goblin', type: 'monster', gridX: 4, gridY: 4, visible: true }],
        players: [{ id: 'feyranger', name: 'FeyRanger', gridX: 9, gridY: 8 }],
        fog: ['0,0'], revealed: ['1,1'], terrain: {}, pois: [], description: g.description, seed: g.seed,
    };
}

function hexFixture() {
    const g = generateHexTerrain({ gridSize: 8, seed: 4 });
    return {
        name: 'north-reach', displayName: 'North Reach', type: 'outdoor', draft: true,
        gridSize: 8, terrain: g.terrain, rivers: g.rivers, pois: [], zoom: 1, panX: 0, panY: 0,
    };
}

const writePlan = (ops) => vi.fn(async () => JSON.stringify({ ops }));

beforeEach(() => { MOCK_FS.clear(); });

describe('dressMapProposal — gates before any model call', () => {
    it('AI_OFF / NO_INSTRUCTION / MAP_NOT_FOUND never wake the model', async () => {
        const chatFn = writePlan([]);
        expect((await dressMapProposal({ campaign: 'unit', mapName: 'x', instruction: 'go', aiConfig: { mode: 'off' }, chatFn })).code).toBe('AI_OFF');
        MOCK_FS.set(`${MAPS}/x.json`, indoorFixture());
        expect((await dressMapProposal({ campaign: 'unit', mapName: 'x', instruction: '  ', aiConfig: AI, chatFn })).code).toBe('NO_INSTRUCTION');
        expect((await dressMapProposal({ campaign: 'unit', mapName: 'missing', instruction: 'go', aiConfig: AI, chatFn })).code).toBe('MAP_NOT_FOUND');
        expect(chatFn).not.toHaveBeenCalled();
    });
});

describe('dressMapProposal — indoor happy lane', () => {
    it('id-addressed add/remove/move dress the live doc; walls/players/draft ride through untouched; nothing is written', async () => {
        const doc = indoorFixture();
        MOCK_FS.set(`${MAPS}/sunken-temple.json`, doc);
        const torch = doc.placedItems[0];
        expect(torch, 'seeded fixture carries placed items to address by id').toBeTruthy();

        const chatFn = writePlan([
            { op: 'add', target: 'item', item: { type: 'chest' }, gridX: 2, gridY: 2 },
            { op: 'remove', target: 'item', id: torch.id },
            { op: 'move', target: 'token', id: 'tok-goblin-1', gridX: 9, gridY: 6 },
        ]);
        const log = vi.fn();
        const res = await dressMapProposal({ campaign: 'unit', mapName: 'sunken-temple', instruction: 'trap it, thin the candles', aiConfig: AI, chatFn, log });

        expect(res.ok).toBe(true);
        // Constrained decoding feeds off the SAME schema object the validator uses.
        expect(chatFn.mock.calls[0][0].responseSchema).toBe(liveDressPlanSchema);
        expect(res.preview).toEqual([
            'add chest at 2,2',
            `remove ${torch.type} at ${torch.gridX},${torch.gridY}`,
            'move Goblin → 9,6',
        ]);
        const chest = res.updated.placedItems.find(i => i.type === 'chest' && i.gridX === 2 && i.gridY === 2);
        expect(chest.id).toMatch(/^ai-dress-item-chest-2-2-/);
        expect(res.updated.placedItems.some(i => i.id === torch.id)).toBe(false);
        expect(res.updated.items[0]).toMatchObject({ id: 'tok-goblin-1', gridX: 9, gridY: 6 });
        // Untouchable layers are byte-identical; the draft flag survives.
        expect(JSON.stringify(res.updated.walls)).toBe(JSON.stringify(doc.walls));
        expect(JSON.stringify(res.updated.revealed)).toBe(JSON.stringify(doc.revealed));
        expect(res.updated.players).toEqual(doc.players);
        expect(res.updated.draft).toBe(true);
        // Proposal only — the on-disk fixture is EXACTLY what it was.
        expect(MOCK_FS.get(`${MAPS}/sunken-temple.json`)).toBe(doc);
        expect(log).toHaveBeenCalledWith('unit', expect.objectContaining({ type: 'ai_dress', map: 'sunken-temple', ops: 3, attempts: 1 }));
    });

    it('the digest stays compact: ids and cells in, walls/paint/fog/revealed blobs out', async () => {
        const doc = indoorFixture();
        doc.walls = Array.from({ length: 500 }, (_, i) => [i, 3]);
        MOCK_FS.set(`${MAPS}/sunken-temple.json`, doc);
        const chatFn = writePlan([{ op: 'add', target: 'item', item: { type: 'chest' }, gridX: 1, gridY: 1 }]);
        await dressMapProposal({ campaign: 'unit', mapName: 'sunken-temple', instruction: 'add a chest', aiConfig: AI, chatFn });

        const prompt = JSON.stringify(chatFn.mock.calls[0][0].messages);
        expect(prompt).toContain(doc.placedItems[0].id); // real addressing survives
        expect(prompt).not.toContain('"walls"');
        expect(prompt).not.toContain('"paintCells"');
        expect(prompt).not.toContain('"revealed"');
        expect(prompt).not.toContain('"fog"');
    });
});

describe('dressMapProposal — reject-before-propose (all-or-nothing)', () => {
    beforeEach(() => MOCK_FS.set(`${MAPS}/sunken-temple.json`, indoorFixture()));

    it('an out-of-bounds add rejects the WHOLE plan after ≤2 repair attempts', async () => {
        const chatFn = writePlan([
            { op: 'add', target: 'item', item: { type: 'chest' }, gridX: 2, gridY: 2 },
            // inside the schema's generous ≤200 bounds, outside the 25×25 doc —
            // this must be the APPLIER (live-document bounds) refusing.
            { op: 'add', target: 'token', token: { name: 'Ogre' }, gridX: 30, gridY: 3 },
        ]);
        const res = await dressMapProposal({ campaign: 'unit', mapName: 'sunken-temple', instruction: 'x', aiConfig: AI, chatFn });
        expect(res.ok).toBe(false);
        expect(res.errors.join(' ')).toMatch(/outside the map/);
        expect(chatFn).toHaveBeenCalledTimes(2);
        // the repair turn carries the concrete error back to the model
        const second = chatFn.mock.calls[1][0].messages;
        expect(JSON.stringify(second[second.length - 1])).toMatch(/outside the map/);
    });

    it('a remove/move citing an id the live document does not have is refused', async () => {
        const chatFn = writePlan([{ op: 'remove', target: 'item', id: 'torch-0-2-4' }]);
        const res = await dressMapProposal({ campaign: 'unit', mapName: 'sunken-temple', instruction: 'x', aiConfig: AI, chatFn });
        expect(res.ok).toBe(false);
        expect(res.errors.join(' ')).toMatch(/not in this map/);
    });

    it('schema-garbage answers (unknown fields, invented verbs) fail closed', async () => {
        const chatFn = writePlan([{ op: 'repaint', target: 'walls' }]);
        const res = await dressMapProposal({ campaign: 'unit', mapName: 'sunken-temple', instruction: 'x', aiConfig: AI, chatFn });
        expect(res.ok).toBe(false);
        expect(res.errors.join(' ')).toMatch(/must be one of/);
    });
});

describe('applyDressOps — remove previews read as plain English, never raw ids', () => {
    const doc = (over) => ({ type: 'indoor', gridSize: 10, placedItems: [], items: [], pois: [], ...over });
    const UUID = '94fcd0bfe9e4cf6e1118f736b920e7a2';

    it('types the removed row with its own fields using the add ops\' `at x,y` idiom', () => {
        const res = applyDressOps(doc({
            placedItems: [{ id: UUID, type: 'chest', gridX: 4, gridY: 5, visible: true }],
            items: [{ id: 'tok-1', name: 'Goblin', gridX: 1, gridY: 2 }],
            pois: [{ id: 'poi-1', label: 'Temple Door', gridX: 3, gridY: 7 }],
        }), [
            { op: 'remove', target: 'item', id: UUID },
            { op: 'remove', target: 'token', id: 'tok-1' },
            { op: 'remove', target: 'poi', id: 'poi-1' },
        ]);
        expect(res.preview).toEqual([
            'remove chest at 4,5',
            'remove Goblin at 1,2',
            'remove Temple Door at 3,7',
        ]);
        for (const line of res.preview) expect(line).not.toContain(UUID);
    });

    it('falls back to a readable noun (never a UUID) when the row has no type/name/label', () => {
        const res = applyDressOps(doc({
            placedItems: [{ id: UUID, gridX: 6, gridY: 1 }],
        }), [
            { op: 'remove', target: 'item', id: UUID },
        ]);
        expect(res.preview).toEqual(['remove row at 6,1']);
        expect(res.preview[0]).not.toContain(UUID);
    });

    it('speaks q,r on hex maps', () => {
        const res = applyDressOps(
            doc({ type: 'outdoor', terrain: { '2,3': 'forest' }, pois: [{ id: 'poi-1', label: 'Gate', q: 2, r: 3 }] }),
            [{ op: 'remove', target: 'poi', id: 'poi-1' }],
        );
        expect(res.preview).toEqual(['remove Gate at 2,3']);
    });

    it('an unplaceable row still names itself without a phantom coordinate', () => {
        const res = applyDressOps(doc({ items: [{ id: 'tok-x', name: 'Ogre' }] }),
            [{ op: 'remove', target: 'token', id: 'tok-x' }]);
        expect(res.preview).toEqual(['remove Ogre']);
    });
});

describe('dressMapProposal + applyDressOps — hex terrain cells', () => {
    it('POI ops validate against the ACTUAL terrain cells and speak q/r', async () => {
        const doc = hexFixture();
        MOCK_FS.set(`${MAPS}/north-reach.json`, doc);
        const cell = Object.keys(doc.terrain)[0].split(',').map(Number);
        const chatFn = writePlan([
            { op: 'add', target: 'poi', poi: { name: 'Temple Door', targetMap: 'sunken-temple' }, gridX: cell[0], gridY: cell[1] },
        ]);
        const res = await dressMapProposal({ campaign: 'unit', mapName: 'North Reach', instruction: 'mark the temple', aiConfig: AI, chatFn });
        expect(res.ok).toBe(true); // display name resolves via the kebab fallback
        expect(res.updated.pois[0]).toMatchObject({ q: cell[0], r: cell[1], label: 'Temple Door', linkedMap: 'sunken-temple' });
    });

    it('a POI on a non-existent hex cell, and item ops on a hex map, are refused', async () => {
        // A live document that has DRIFTED from generator output (sparse
        // terrain — e.g. a hand-made map) is exactly why hex placement is
        // checked against the actual cell set, never a computed box.
        const doc = { ...hexFixture(), terrain: { '0,0': 'forest', '1,0': 'hills' } };
        MOCK_FS.set(`${MAPS}/north-reach.json`, doc);
        const chatFn = writePlan([{ op: 'add', target: 'poi', poi: { name: 'Nowhere' }, gridX: 5, gridY: 5 }]);
        const res = await dressMapProposal({ campaign: 'unit', mapName: 'north-reach', instruction: 'x', aiConfig: AI, chatFn });
        expect(res.ok).toBe(false);
        expect(res.errors.join(' ')).toMatch(/outside the map/);

        const wrong = applyDressOps(doc, [{ op: 'add', target: 'item', item: { type: 'chest' }, gridX: 1, gridY: 1 }]);
        expect(wrong.errors.join(' ')).toMatch(/indoor-only/);
    });
});
