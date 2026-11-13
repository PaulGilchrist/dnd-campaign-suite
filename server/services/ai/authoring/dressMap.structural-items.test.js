// @maintained-by-ai
// bug-ai-dress-wall-as-item-sentinel-contradiction — the liveDressPlanSchema
// whitelists TARGETS (item|poi|token), so the model smuggled the wall ask
// through as `target:'item', item:{type:'wall'}` rows: the preview listed
// `add wall at 4,5` lines while the modal copy promised walls were impossible
// (and Apply landed generic "?" placeholder props). The applier now refuses
// structural-noun item TYPES fail-closed through the ordinary all-or-nothing
// error lane; registered prop sprites (stairs/door/arrowSlitWall — itemSprites
// ART_TYPES) stay placeable, and id-addressed removes of legacy wall rows keep
// working (the cleanup lane is never blocked).
import { describe, it, expect, vi, beforeEach } from 'vitest';

const MOCK_FS = new Map();

vi.mock('fs', () => ({
    default: {
        // Deliberately NO writeFileSync — the proposal-only contract stands.
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

const STRUCTURAL_REFUSAL = /item type "wall" names a structural layer/;

const indoorDoc = (over) => ({
    name: 'xa-dress-1', type: 'indoor', gridSize: 10, walls: [],
    placedItems: [], items: [], pois: [], terrain: {}, ...over,
});

const writePlan = (ops) => vi.fn(async () => JSON.stringify({ ops }));

beforeEach(() => MOCK_FS.clear());

describe('applyDressOps — structural item nouns are refused fail-closed', () => {
    it('an add-item op typed "wall" rejects the WHOLE plan (all-or-nothing)', () => {
        const res = applyDressOps(indoorDoc(), [
            { op: 'add', target: 'item', item: { type: 'wall', name: 'stone wall' }, gridX: 4, gridY: 5 },
            { op: 'add', target: 'item', item: { type: 'chest' }, gridX: 5, gridY: 6 },
        ]);
        expect(res.errors.join(' ')).toMatch(STRUCTURAL_REFUSAL);
        // The instruction names the served prop vocabulary (model-guiding copy).
        expect(res.errors.join(' ')).toMatch(/place a real prop instead/);
        expect(res.updated).toBeUndefined();
        expect(res.preview).toBeUndefined();
        expect(res.errors.join(' ')).not.toMatch(/add chest/); // nothing half-applies
    });

    it('structural nouns beyond wall share the refusal (barricade / doorway / "stone wall")', () => {
        for (const type of ['barricade', 'doorway', 'stone wall', 'stone_wall', 'Fence']) {
            const res = applyDressOps(indoorDoc(), [
                { op: 'add', target: 'item', item: { type }, gridX: 2, gridY: 2 },
            ]);
            expect(res.errors, type).toHaveLength(1);
            expect(res.errors[0], type).toMatch(/names a structural layer/);
        }
    });

    it('SERVED prop types stay placeable — incl. the sprite-backed structural nouns', () => {
        // door/secretDoor/stairs/arrowSlitWall have real art (itemSprites.js):
        // the modal hint and prompt advertise them, so they must keep landing.
        const res = applyDressOps(indoorDoc(), [
            { op: 'add', target: 'item', item: { type: 'door', name: 'oaken door' }, gridX: 3, gridY: 1 },
            { op: 'add', target: 'item', item: { type: 'stairs' }, gridX: 4, gridY: 1 },
            { op: 'add', target: 'item', item: { type: 'arrowSlitWall' }, gridX: 5, gridY: 1 },
            { op: 'add', target: 'item', item: { type: 'chest' }, gridX: 6, gridY: 1 },
        ]);
        expect(res.errors).toBeUndefined();
        expect(res.updated.placedItems.map((r) => r.type)).toEqual(['door', 'stairs', 'arrowSlitWall', 'chest']);
        expect(res.preview).toEqual([
            'add door at 3,1', 'add stairs at 4,1', 'add arrowSlitWall at 5,1', 'add chest at 6,1',
        ]);
    });

    it('unknown-but-not-structural prop nouns keep the honest placeholder lane', () => {
        const res = applyDressOps(indoorDoc(), [
            { op: 'add', target: 'item', item: { type: 'rubble pile' }, gridX: 2, gridY: 7 },
        ]);
        expect(res.errors).toBeUndefined();
        expect(res.updated.placedItems[0].type).toBe('rubble pile');
    });

    it('removing a legacy wall-typed row stays allowed (cleanup is not dressing)', () => {
        const res = applyDressOps(indoorDoc({
            placedItems: [{ id: 'ai-dress-item-wall-4-5-0', type: 'wall', name: 'stone wall', gridX: 4, gridY: 5, visible: true }],
        }), [
            { op: 'remove', target: 'item', id: 'ai-dress-item-wall-4-5-0' },
        ]);
        expect(res.errors).toBeUndefined();
        expect(res.preview).toEqual(['remove stone wall at 4,5']);
        expect(res.updated.placedItems).toEqual([]);
    });
});

describe('dressMapProposal — the wall ask is refusible or repaired, never previewed as walls', () => {
    it('a persistent wall proposal exhausts both attempts and errors with the structural copy', async () => {
        MOCK_FS.set(`${MAPS}/xa-dress-1.json`, indoorDoc());
        const chatFn = writePlan([
            { op: 'add', target: 'item', item: { type: 'wall', name: 'stone wall' }, gridX: 4, gridY: 5 },
        ]);
        const log = vi.fn();
        const res = await dressMapProposal({
            campaign: 'unit', mapName: 'xa-dress-1',
            instruction: 'Build a stone wall around the center of the room.', aiConfig: AI, chatFn, log,
        });
        expect(res.ok).toBe(false);
        expect(res.errors.join(' ')).toMatch(STRUCTURAL_REFUSAL);
        expect(chatFn).toHaveBeenCalledTimes(2); // schema-valid shape → applied twice, both refused
        // The repair turn carries the plain-English refusal back to the model.
        const second = chatFn.mock.calls[1][0].messages;
        expect(JSON.stringify(second[second.length - 1])).toMatch(/names a structural layer/);
        // Refusal audit stays honest (zero applied ops).
        expect(log).toHaveBeenCalledWith('unit', expect.objectContaining({ type: 'ai_dress', ops: 0 }));
    });

    it('the system prompt states the item.type prop law before the first call', async () => {
        MOCK_FS.set(`${MAPS}/xa-dress-1.json`, indoorDoc());
        const chatFn = writePlan([]);
        await dressMapProposal({ campaign: 'unit', mapName: 'xa-dress-1', instruction: 'dress it', aiConfig: AI, chatFn });
        const system = chatFn.mock.calls[0][0].messages[0].content;
        expect(system).toMatch(/never a structural noun/);
    });

    it('a repaired furniture-only proposal previews honestly (no wall rows reach the GM)', async () => {
        MOCK_FS.set(`${MAPS}/xa-dress-1.json`, indoorDoc());
        const chatFn = vi.fn()
            .mockResolvedValueOnce(JSON.stringify({
                ops: [{ op: 'add', target: 'item', item: { type: 'wall' }, gridX: 4, gridY: 5 }],
            }))
            .mockResolvedValueOnce(JSON.stringify({
                ops: [{ op: 'add', target: 'item', item: { type: 'chest' }, gridX: 5, gridY: 6 }],
            }));
        const res = await dressMapProposal({
            campaign: 'unit', mapName: 'xa-dress-1',
            instruction: 'Build a stone wall around the center of the room.', aiConfig: AI, chatFn,
        });
        expect(res.ok).toBe(true);
        expect(res.preview).toEqual(['add chest at 5,6']);
        expect(res.preview.join(' ')).not.toMatch(/wall/);
    });
});
