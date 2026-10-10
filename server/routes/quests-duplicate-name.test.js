// Regression tests for duplicate-name overwrite: POST (full-array overwrite —
// the create/rename seam for GUID-keyed quests) must reject lists whose names
// collide case-insensitively, mirroring the NPC/Maps duplicate-name guards.
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

import quests from './quests.js';

function questsPath(campaign) {
    return `/mock/campaigns/${campaign}/data/quests.json`;
}

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(quests);
    return app;
}

afterEach(() => {
    FILE_SYSTEM.clear();
});

describe('quests - POST duplicate-name guard', () => {
    it('rejects creating a quest whose name collides case-insensitively and leaves data untouched', async () => {
        setupFs({
            [questsPath('test-campaign')]: [
                { id: 'q1', name: 'QA Parity Quest', status: 'active' },
            ],
        });
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/quests')
            .send({ quests: [
                { id: 'q1', name: 'QA Parity Quest', status: 'active' },
                { id: 'q2', name: 'qa parity QUEST', status: 'active' },
            ] });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'A quest with that name already exists');

        const content = JSON.parse(FILE_SYSTEM.get(questsPath('test-campaign')));
        expect(content).toHaveLength(1);
        expect(content[0].id).toBe('q1');
        expect(content[0].name).toBe('QA Parity Quest');
    });

    it('rejects renaming a quest onto another existing quest name', async () => {
        setupFs({
            [questsPath('test-campaign')]: [
                { id: 'q1', name: 'The Lost Artifact' },
                { id: 'q2', name: 'QA Parity Quest' },
            ],
        });
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/quests')
            .send({ quests: [
                { id: 'q1', name: 'The Lost Artifact' },
                { id: 'q2', name: 'the lost artifact' },
            ] });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'A quest with that name already exists');
        const content = JSON.parse(FILE_SYSTEM.get(questsPath('test-campaign')));
        expect(content.find(q => q.id === 'q2').name).toBe('QA Parity Quest');
    });

    it('allows saving a quest under its own name (self-match excluded)', async () => {
        setupFs({
            [questsPath('test-campaign')]: [{ id: 'q1', name: 'QA Parity Quest', status: 'active' }],
        });
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/quests')
            .send({ quests: [{ id: 'q1', name: 'QA Parity Quest', status: 'completed' }] });

        expect(res.status).toBe(200);
        const content = JSON.parse(FILE_SYSTEM.get(questsPath('test-campaign')));
        expect(content[0].status).toBe('completed');
    });

    it('allows renaming to a unique name and creating unique quests', async () => {
        setupFs({
            [questsPath('test-campaign')]: [{ id: 'q1', name: 'QA Parity Quest' }],
        });
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/quests')
            .send({ quests: [
                { id: 'q1', name: 'Renamed Unique Quest' },
                { id: 'q2', name: 'Another Unique Quest' },
            ] });

        expect(res.status).toBe(200);
        const content = JSON.parse(FILE_SYSTEM.get(questsPath('test-campaign')));
        expect(content).toHaveLength(2);
    });
});
