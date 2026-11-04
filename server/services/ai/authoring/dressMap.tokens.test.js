// @maintained-by-ai
// Regression (bug-ai-dress-tokens-invisible-write-only-lane): dress `token`
// ops applied with success feedback but wrote into the legacy doc.items lane,
// which has ZERO renderers app-wide (PlacedItems filters placedItems; Map3D
// is fed the placedItems prop) — the GM's confirmed preview produced markers
// nobody ever saw. Tokens must land in the ONE rendered creature lane
// (placedItems npc/monster rows), the digest must source `tokens` from that
// same lane (so move/remove cite ids the renderer agrees with), and the
// legacy lane must stay byte-untouched.
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

const indoorDoc = (over) => ({
    name: 'test-map', type: 'indoor', gridSize: 20,
    placedItems: [], items: [], pois: [], walls: [], revealed: [], fog: [],
    ...over,
});

const writePlan = (ops) => vi.fn(async () => JSON.stringify({ ops }));

beforeEach(() => MOCK_FS.clear());

describe('applyDressOps — token adds land in the RENDERED placedItems lane', () => {
    it('shapes monster and npc tokens like the palette NPC rows and never touches the legacy lane', () => {
        const res = applyDressOps(indoorDoc(), [
            { op: 'add', target: 'token', token: { name: 'QA Goblin', kind: 'monster' }, gridX: 3, gridY: 3 },
            { op: 'add', target: 'token', token: { name: 'QA Marta', kind: 'npc' }, gridX: 5, gridY: 5 },
        ]);
        expect(res.updated.items).toEqual([]); // write-only lane stays dead
        expect(res.updated.placedItems).toHaveLength(2);
        expect(res.updated.placedItems[0]).toMatchObject({
            id: 'ai-dress-token-3-3-0', name: 'QA Goblin', type: 'monster',
            gridX: 3, gridY: 3, visible: true,
        });
        expect(res.updated.placedItems[1]).toMatchObject({
            id: 'ai-dress-token-5-5-1', name: 'QA Marta', type: 'npc',
            gridX: 5, gridY: 5, visible: true,
        });
        expect(res.preview).toEqual([
            'add monster token QA Goblin at 3,3',
            'add npc token QA Marta at 5,5',
        ]);
    });

    it('kind defaults to monster and fromEncounter rides through', () => {
        const res = applyDressOps(indoorDoc(), [
            { op: 'add', target: 'token', token: { name: 'Ogre', fromEncounter: 'Ferry Ambush' }, gridX: 1, gridY: 2 },
        ]);
        expect(res.updated.placedItems[0]).toMatchObject({ type: 'monster', fromEncounter: 'Ferry Ambush' });
    });

    it('move/remove cite the digest id INSIDE the rendered lane', () => {
        const start = indoorDoc({
            placedItems: [
                { id: 'npc-thug', name: 'Thug 1', type: 'npc', gridX: 2, gridY: 1, visible: true },
                { id: 'barrel-1', type: 'barrel', gridX: 10, gridY: 10, visible: true },
            ],
        });
        const moved = applyDressOps(start, [{ op: 'move', target: 'token', id: 'npc-thug', gridX: 6, gridY: 6 }]);
        expect(moved.updated.placedItems.find(i => i.id === 'npc-thug')).toMatchObject({ gridX: 6, gridY: 6 });
        expect(moved.preview).toEqual(['move Thug 1 → 6,6']);

        const removed = applyDressOps(start, [{ op: 'remove', target: 'token', id: 'npc-thug' }]);
        // named by NAME (client-preview parity), and the sibling prop survives
        expect(removed.preview).toEqual(['remove Thug 1 at 2,1']);
        expect(removed.updated.placedItems.map(i => i.id)).toEqual(['barrel-1']);
    });

    it('the retired legacy items[] lane cannot be cited by move/remove', () => {
        const res = applyDressOps(indoorDoc({
            items: [{ id: 'ai-dress-token-3-3-0', name: 'Old Ghost', type: 'monster', gridX: 3, gridY: 3, visible: true }],
        }), [{ op: 'remove', target: 'token', id: 'ai-dress-token-3-3-0' }]);
        expect(res.errors.join(' ')).toMatch(/not in this map/);
    });
});

describe('buildMapDigest — tokens source = the rendered creature rows', () => {
    it('splits placedItems creature rows onto tokens, props onto items; legacy rows surface nowhere', async () => {
        MOCK_FS.set(`${MAPS}/test-map.json`, indoorDoc({
            placedItems: [
                { id: 'npc-thug', name: 'Thug 1', type: 'npc', gridX: 2, gridY: 1, visible: true },
                { id: 'tok-gob', name: 'QA Goblin', type: 'monster', gridX: 3, gridY: 3, visible: true },
                { id: 'chest-1', type: 'chest', gridX: 8, gridY: 1, visible: true },
            ],
            items: [{ id: 'legacy-1', name: 'Invisible', type: 'monster', gridX: 9, gridY: 9, visible: true }],
        }));
        const chatFn = writePlan([{ op: 'add', target: 'item', item: { type: 'torch' }, gridX: 1, gridY: 1 }]);
        await dressMapProposal({ campaign: 'unit', mapName: 'test-map', instruction: 'light it', aiConfig: AI, chatFn });
        const prompt = JSON.stringify(chatFn.mock.calls[0][0].messages);
        expect(prompt).toContain('\\"tokens\\"');
        expect(prompt).toContain('npc-thug');  // palette NPC tokens are digest tokens
        expect(prompt).toContain('QA Goblin');
        expect(prompt).toContain('chest-1');   // props still ride the items digest lane
        expect(prompt).not.toContain('legacy-1');
        expect(prompt).not.toContain('Invisible');
    });

    it('an add → move/remove round-trip cites the ids the FIRST proposal\'s digest exposed', async () => {
        const doc = indoorDoc();
        MOCK_FS.set(`${MAPS}/test-map.json`, doc);
        const first = await dressMapProposal({
            campaign: 'unit', mapName: 'test-map', instruction: 'goblin',
            aiConfig: AI, chatFn: writePlan([{ op: 'add', target: 'token', token: { name: 'QA Goblin', kind: 'monster' }, gridX: 3, gridY: 3 }]),
        });
        expect(first.ok).toBe(true);
        const added = first.updated.placedItems[0];

        // GM applies; the next dress sees the row in the digest and can cite it.
        const round = applyDressOps(first.updated, [
            { op: 'move', target: 'token', id: added.id, gridX: 9, gridY: 9 },
            { op: 'remove', target: 'token', id: added.id },
        ]);
        expect(round.preview).toEqual([`move QA Goblin → 9,9`, 'remove QA Goblin at 9,9']);
        expect(round.updated.placedItems).toEqual([]);
    });
});
