// Live-sync broadcast tests (improve settlements-sessions-no-list-sse):
// settlement list create/update (PUT upsert), whole-list POST replacement, and
// delete must publish `settlements-list-<campaign>` SSE events (mirroring
// npcs-list broadcasts from routes/npcs.js) so other GM tabs' settlement
// lists update without reload; rejected writes stay silent.
import express from 'express';
import { request } from '../test-utils/localhostSupertest.js';

const FILE_SYSTEM = new Map();

function setupFs(entries) {
    FILE_SYSTEM.clear();
    for (const [p, content] of Object.entries(entries)) {
        FILE_SYSTEM.set(p, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
    }
}

vi.mock('fs', () => ({
    default: {
        existsSync: (p) => FILE_SYSTEM.has(p),
        readFileSync: (p) => {
            const val = FILE_SYSTEM.get(p);
            if (val === undefined) throw new Error(`ENOENT: ${p}`);
            return val;
        },
        writeFileSync: (p, c) => FILE_SYSTEM.set(p, c),
    },
    existsSync: (p) => FILE_SYSTEM.has(p),
    readFileSync: (p) => {
        const val = FILE_SYSTEM.get(p);
        if (val === undefined) throw new Error(`ENOENT: ${p}`);
        return val;
    },
    writeFileSync: (p, c) => FILE_SYSTEM.set(p, c),
}));

vi.mock('../utils/campaignPaths.js', () => ({
    campaignDataFile: (campaign, name) => `/mock/campaigns/${campaign}/data/${name}`,
    ensureDataDir: vi.fn((campaign) => `/mock/campaigns/${campaign}/data`),
}));

const publishSpy = vi.hoisted(() => vi.fn());
vi.mock('../utils/changeData.js', () => ({
    publish: publishSpy,
}));

import settlements from './settlements.js';

function settlementsPath(campaign) {
    return `/mock/campaigns/${campaign}/data/settlements.json`;
}

const app = express();
app.use(express.json());
app.use(settlements);

describe('Settlement live-sync broadcasts', () => {
    beforeEach(() => {
        publishSpy.mockClear();
        setupFs({});
    });

    it('publishes settlements-list created event when PUT creates a new settlement', async () => {
        const res = await request(app)
            .put('/api/campaigns/test-campaign/settlements/Fallcrest')
            .send({ name: 'Fallcrest', size: 'village' });

        expect(res.status).toBe(200);
        expect(publishSpy).toHaveBeenCalledWith(
            'settlements-list-test-campaign',
            { action: 'created', name: 'Fallcrest' },
            'test-campaign'
        );
    });

    it('publishes settlements-list updated event when PUT updates an existing settlement', async () => {
        setupFs({ [settlementsPath('test-campaign')]: [{ name: 'Ironhaven', size: 'town' }] });

        const res = await request(app)
            .put('/api/campaigns/test-campaign/settlements/Ironhaven')
            .send({ name: 'Ironhaven', size: 'city' });

        expect(res.status).toBe(200);
        expect(publishSpy).toHaveBeenCalledWith(
            'settlements-list-test-campaign',
            { action: 'updated', name: 'Ironhaven' },
            'test-campaign'
        );
    });

    it('publishes settlements-list deleted event when DELETE removes a settlement', async () => {
        setupFs({ [settlementsPath('test-campaign')]: [{ name: 'Ironhaven' }] });

        const res = await request(app).delete('/api/campaigns/test-campaign/settlements/Ironhaven');

        expect(res.status).toBe(200);
        expect(publishSpy).toHaveBeenCalledWith(
            'settlements-list-test-campaign',
            { action: 'deleted', name: 'Ironhaven' },
            'test-campaign'
        );
    });

    it('publishes settlements-list replaced event when POST overwrites the whole list', async () => {
        const res = await request(app)
            .post('/api/campaigns/test-campaign/settlements')
            .send({ settlements: [{ name: 'Ironhaven' }] });

        expect(res.status).toBe(200);
        expect(publishSpy).toHaveBeenCalledWith(
            'settlements-list-test-campaign',
            { action: 'replaced' },
            'test-campaign'
        );
    });

    it('does not broadcast when PUT is rejected for a duplicate name', async () => {
        setupFs({ [settlementsPath('test-campaign')]: [{ name: 'Ironhaven' }] });

        const res = await request(app)
            .put('/api/campaigns/test-campaign/settlements/Other')
            .send({ name: 'ironhaven' });

        expect(res.status).toBe(400);
        expect(publishSpy).not.toHaveBeenCalled();
    });

    it('does not broadcast when PUT is rejected for a stale stamp (409)', async () => {
        setupFs({ [settlementsPath('test-campaign')]: [{ name: 'Ironhaven', updatedAt: 5 }] });

        const res = await request(app)
            .put('/api/campaigns/test-campaign/settlements/Ironhaven')
            .send({ name: 'Ironhaven', size: 'city', updatedAt: 2 });

        expect(res.status).toBe(409);
        expect(publishSpy).not.toHaveBeenCalled();
    });
});
