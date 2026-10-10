// Live-sync broadcast tests: NPC create/update/delete must publish
// `npcs-list-<campaign>` SSE events (mirroring maps-list broadcasts) so
// other GM tabs' NPC management lists update without reload.
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
        renameSync: (oldPath, newPath) => {
            const data = FILE_SYSTEM.get(oldPath);
            if (data !== undefined) {
                FILE_SYSTEM.set(newPath, data);
                FILE_SYSTEM.delete(oldPath);
            }
        },
    },
    existsSync: (p) => FILE_SYSTEM.has(p),
    readFileSync: (p) => {
        const val = FILE_SYSTEM.get(p);
        if (val === undefined) throw new Error(`ENOENT: ${p}`);
        return val;
    },
    writeFileSync: (p, c) => FILE_SYSTEM.set(p, c),
    renameSync: (oldPath, newPath) => {
        const data = FILE_SYSTEM.get(oldPath);
        if (data !== undefined) {
            FILE_SYSTEM.set(newPath, data);
            FILE_SYSTEM.delete(oldPath);
        }
    },
}));

vi.mock('../utils/campaignPaths.js', () => ({
    campaignDataFile: (campaign, name) => `/mock/campaigns/${campaign}/data/${name}`,
    ensureDataDir: vi.fn((campaign) => `/mock/campaigns/${campaign}/data`),
    campaignImagesDir: vi.fn((campaign) => `/mock/campaigns/${campaign}/images`),
}));

vi.mock('../utils/imageUtils.js', () => ({
    processImageUpload: vi.fn(),
    deleteCharacterImage: vi.fn(),
}));

const publishSpy = vi.hoisted(() => vi.fn());
vi.mock('../utils/changeData.js', () => ({
    publish: publishSpy,
}));

import npcs from './npcs.js';

function npcsPath(campaign) {
    return `/mock/campaigns/${campaign}/data/npcs.json`;
}

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(npcs);
    return app;
}

const app = createTestApp();

describe('NPC live-sync broadcasts', () => {
    beforeEach(() => {
        publishSpy.mockClear();
        setupFs({});
    });

    it('publishes npcs-list created event when PUT creates a new NPC', async () => {
        const res = await request(app)
            .put('/api/campaigns/test-campaign/npcs/Quartermaster%20Bog')
            .send({ name: 'Quartermaster Bog', race: 'Human' });

        expect(res.status).toBe(200);
        expect(publishSpy).toHaveBeenCalledWith(
            'npcs-list-test-campaign',
            { action: 'created', name: 'Quartermaster Bog' },
            'test-campaign'
        );
    });

    it('publishes npcs-list updated event when PUT updates an existing NPC', async () => {
        setupFs({ [npcsPath('test-campaign')]: [{ name: 'Bog', race: 'Human' }] });

        const res = await request(app)
            .put('/api/campaigns/test-campaign/npcs/Bog')
            .send({ name: 'Bog', race: 'Half-Orc' });

        expect(res.status).toBe(200);
        expect(publishSpy).toHaveBeenCalledWith(
            'npcs-list-test-campaign',
            { action: 'updated', name: 'Bog' },
            'test-campaign'
        );
    });

    it('publishes npcs-list deleted event when DELETE removes an NPC', async () => {
        setupFs({ [npcsPath('test-campaign')]: [{ name: 'Bog' }] });

        const res = await request(app).delete('/api/campaigns/test-campaign/npcs/Bog');

        expect(res.status).toBe(200);
        expect(publishSpy).toHaveBeenCalledWith(
            'npcs-list-test-campaign',
            { action: 'deleted', name: 'Bog' },
            'test-campaign'
        );
    });

    it('publishes npcs-list replaced event when POST overwrites the whole list', async () => {
        const res = await request(app)
            .post('/api/campaigns/test-campaign/npcs')
            .send({ npcs: [{ name: 'Bog' }] });

        expect(res.status).toBe(200);
        expect(publishSpy).toHaveBeenCalledWith(
            'npcs-list-test-campaign',
            { action: 'replaced' },
            'test-campaign'
        );
    });

    it('does not broadcast when PUT is rejected for a duplicate name', async () => {
        setupFs({ [npcsPath('test-campaign')]: [{ name: 'Bog' }] });

        const res = await request(app)
            .put('/api/campaigns/test-campaign/npcs/Other')
            .send({ name: 'bog' });

        expect(res.status).toBe(400);
        expect(publishSpy).not.toHaveBeenCalled();
    });
});
