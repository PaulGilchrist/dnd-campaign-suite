// Regression tests for duplicate-name overwrite: POST (full-array overwrite —
// the create/rename seam for GUID-keyed factions) must reject lists whose
// names collide case-insensitively, mirroring the NPC/Maps duplicate-name guards.
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

import factions from './factions.js';

function factionsPath(campaign) {
    return `/mock/campaigns/${campaign}/data/factions.json`;
}

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(factions);
    return app;
}

afterEach(() => {
    FILE_SYSTEM.clear();
});

describe('factions - POST duplicate-name guard', () => {
    it('rejects creating a faction whose name collides case-insensitively and leaves data untouched', async () => {
        setupFs({
            [factionsPath('test-campaign')]: [
                { id: 'f1', name: 'QA Parity Faction', influence: 5 },
            ],
        });
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/factions')
            .send({ factions: [
                { id: 'f1', name: 'QA Parity Faction', influence: 5 },
                { id: 'f2', name: 'qa parity faction', influence: 3 },
            ] });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'A faction with that name already exists');

        const content = JSON.parse(FILE_SYSTEM.get(factionsPath('test-campaign')));
        expect(content).toHaveLength(1);
        expect(content[0].id).toBe('f1');
        expect(content[0].influence).toBe(5);
    });

    it('rejects renaming a faction onto another existing faction name', async () => {
        setupFs({
            [factionsPath('test-campaign')]: [
                { id: 'f1', name: 'The Iron Consortium' },
                { id: 'f2', name: 'QA Parity Faction' },
            ],
        });
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/factions')
            .send({ factions: [
                { id: 'f1', name: 'The Iron Consortium' },
                { id: 'f2', name: 'the iron consortium' },
            ] });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'A faction with that name already exists');
        const content = JSON.parse(FILE_SYSTEM.get(factionsPath('test-campaign')));
        expect(content.find(f => f.id === 'f2').name).toBe('QA Parity Faction');
    });

    it('allows saving a faction under its own name (self-match excluded)', async () => {
        setupFs({
            [factionsPath('test-campaign')]: [{ id: 'f1', name: 'QA Parity Faction', influence: 5 }],
        });
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/factions')
            .send({ factions: [{ id: 'f1', name: 'QA Parity Faction', influence: 7 }] });

        expect(res.status).toBe(200);
        const content = JSON.parse(FILE_SYSTEM.get(factionsPath('test-campaign')));
        expect(content[0].influence).toBe(7);
    });

    it('allows renaming to a unique name and creating unique factions', async () => {
        setupFs({
            [factionsPath('test-campaign')]: [{ id: 'f1', name: 'QA Parity Faction' }],
        });
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/factions')
            .send({ factions: [
                { id: 'f1', name: 'Renamed Unique Faction' },
                { id: 'f2', name: 'Another Unique Faction' },
            ] });

        expect(res.status).toBe(200);
        const content = JSON.parse(FILE_SYSTEM.get(factionsPath('test-campaign')));
        expect(content).toHaveLength(2);
    });
});
