// @maintained-by-ai
// Route tests for the 2026-11-10 improvement: the change-data write lanes must
// refuse malformed activeConditions rows (GB incident: an object entry POSTed
// via the API crashed key.charAt in initiative/displayCreatureUtils.js and
// froze the ENTIRE Initiative view to zero cards in every tab). Well-formed
// string-array writes keep their byte-identical 200 pass-through.
import { request } from '../test-utils/localhostSupertest.js';
import express from 'express';

vi.mock('../utils/changeData.js', () => ({
    warnIfNewTopLevelKey: vi.fn(),
    characterChangeData: new Map(),
    publish: vi.fn(),
    saveFile: vi.fn(),
    debouncedSave: vi.fn(),
    markDirty: vi.fn(),
}));

import { characterChangeData, publish, markDirty } from '../utils/changeData.js';
import campaignsChangedata from './campaigns-changedata.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(campaignsChangedata);
    return app;
}

beforeEach(() => {
    vi.mocked(markDirty).mockClear();
    vi.mocked(publish).mockClear();
    characterChangeData.set('test-campaign', {});
});

describe('activeConditions top-level key write lane (POST /:campaign/activeConditions)', () => {
    const post = (value) => request(createTestApp())
        .post('/api/campaigns/test-campaign/activeConditions')
        .send({ value });

    it('accepts bare string keys — 200, stored byte-as-sent', async () => {
        const res = await post(['poisoned', 'prone']);
        expect(res.status).toBe(200);
        expect(characterChangeData.get('test-campaign').activeConditions).toEqual(['poisoned', 'prone']);
    });

    it('accepts the honest clear faces: [] and null', async () => {
        expect((await post([])).status).toBe(200);
        expect((await post(null)).status).toBe(200);
        expect(characterChangeData.get('test-campaign').activeConditions).toBeNull();
    });

    it('refuses an object entry — plain-English 400, key never persisted', async () => {
        const res = await post([{ key: 'x', name: 'Prone' }]);
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/must contain only condition-key strings/);
        expect(res.body.error).toContain('entry 0 is an object');
        expect('activeConditions' in characterChangeData.get('test-campaign')).toBe(false);
        expect(markDirty).not.toHaveBeenCalled();
    });

    it('refuses mixed string/object and string/number arrays', async () => {
        const mixed = await post(['poisoned', { key: 'x' }]);
        expect(mixed.status).toBe(400);
        expect(mixed.body.error).toMatch(/entry 1 is an object/);
        expect((await post(['prone', 42])).status).toBe(400);
        expect('activeConditions' in characterChangeData.get('test-campaign')).toBe(false);
    });

    it('refuses a non-array object shape with the array-shape sentence', async () => {
        const res = await post({ poisoned: true, prone: true });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/must be an array of condition-key strings/);
    });

    it('refusal broadcasts the denial echo (visible rejection), never the bad value', async () => {
        await post([{ key: 'x' }]);
        expect(publish).toHaveBeenCalledWith(
            'denied-test-campaign-activeConditions',
            expect.objectContaining({ key: 'activeConditions' }),
            'test-campaign',
        );
        expect(publish).not.toHaveBeenCalledWith(
            'change-test-campaign-activeConditions',
            expect.anything(),
            'test-campaign',
        );
    });
});

describe('activeConditions nested in creature-store writes (POST /:campaign/<Name>)', () => {
    const monster = (props) => request(createTestApp())
        .post('/api/campaigns/test-campaign/Goblin%201')
        .send({ value: props });

    it('accepts honest condition state alongside economy props (byte pass-through)', async () => {
        const res = await monster({
            activeConditions: ['prone', 'stunned'],
            monsterLegendaryUses: { max: 3, used: 1 },
            hitPoints: 7,
        });
        expect(res.status).toBe(200);
        expect(characterChangeData.get('test-campaign')['Goblin 1'].activeConditions)
            .toEqual(['prone', 'stunned']);
    });

    it('accepts null-cleared conditions (clear seams)', async () => {
        const res = await monster({ activeConditions: null });
        expect(res.status).toBe(200);
    });

    it('refuses an object entry inside the store — prior store untouched', async () => {
        const res = await monster({ activeConditions: [{ key: 'x' }] });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/condition-key strings/);
        expect(characterChangeData.get('test-campaign')['Goblin 1']).toBeUndefined();
    });

    it('stores without an activeConditions field are untouched by the scan', async () => {
        const res = await monster({ hitPoints: 7, currentHitPoints: 5 });
        expect(res.status).toBe(200);
    });
});

describe('activeConditions via scoped PATCH /:campaign/<Name> (merged-truth guard)', () => {
    function seedStore() {
        characterChangeData.get('test-campaign')['Goblin 1'] = {
            activeConditions: ['prone'],
            currentHitPoints: 5,
        };
    }

    const patch = (value) => request(createTestApp())
        .patch('/api/campaigns/test-campaign/Goblin%201')
        .send({ value });

    it('accepts a well-formed string-array slice and merges it', async () => {
        seedStore();
        const res = await patch({ activeConditions: ['poisoned', 'prone'] });
        expect(res.status).toBe(200);
        expect(characterChangeData.get('test-campaign')['Goblin 1'].activeConditions)
            .toEqual(['poisoned', 'prone']);
    });

    it('refuses a malformed slice — the stored bucket keeps prior truth', async () => {
        seedStore();
        const res = await patch({ activeConditions: [{ key: 'x' }] });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/condition-key strings/);
        expect(characterChangeData.get('test-campaign')['Goblin 1'].activeConditions).toEqual(['prone']);
        expect(publish).not.toHaveBeenCalledWith(
            'change-test-campaign-Goblin 1',
            expect.anything(),
            'test-campaign',
        );
    });
});
