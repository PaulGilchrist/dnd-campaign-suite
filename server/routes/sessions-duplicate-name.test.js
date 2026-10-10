// Regression tests for duplicate-name overwrite: POST (full-array overwrite)
// and PUT (rename upsert) must reject names that collide case-insensitively,
// mirroring the quests/factions validateList / findDuplicateNameError guards.
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

import sessions from './sessions.js';

function sessionsPath(campaign) {
    return `/mock/campaigns/${campaign}/data/sessions.json`;
}

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(sessions);
    return app;
}

afterEach(() => {
    FILE_SYSTEM.clear();
});

describe('sessions - POST duplicate-name guard (validateList)', () => {
    it('rejects creating a session whose name collides case-insensitively and leaves data untouched', async () => {
        setupFs({
            [sessionsPath('test-campaign')]: [
                { name: 'QA Sess A', status: 'planned' },
            ],
        });
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/sessions')
            .send({ sessions: [
                { name: 'QA Sess A', status: 'planned' },
                { name: 'qa sess A', status: 'planned' },
            ] });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'A session with that name already exists');

        const content = JSON.parse(FILE_SYSTEM.get(sessionsPath('test-campaign')));
        expect(content).toHaveLength(1);
        expect(content[0].name).toBe('QA Sess A');
    });

    it('rejects renaming a session onto another existing session name', async () => {
        setupFs({
            [sessionsPath('test-campaign')]: [
                { name: 'QA Sess A' },
                { name: 'QA Sess B' },
            ],
        });
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/sessions')
            .send({ sessions: [
                { name: 'QA Sess A' },
                { name: 'qa sess a' },
            ] });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'A session with that name already exists');
        const content = JSON.parse(FILE_SYSTEM.get(sessionsPath('test-campaign')));
        expect(content.find(s => s.name === 'QA Sess B')).toBeDefined();
    });

    it('allows saving a session under its own name (self-match excluded)', async () => {
        setupFs({
            [sessionsPath('test-campaign')]: [{ name: 'QA Sess A', status: 'planned' }],
        });
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/sessions')
            .send({ sessions: [{ name: 'QA Sess A', status: 'played' }] });

        expect(res.status).toBe(200);
        const content = JSON.parse(FILE_SYSTEM.get(sessionsPath('test-campaign')));
        expect(content[0].status).toBe('played');
    });

    it('allows renaming to a unique name and creating unique sessions', async () => {
        setupFs({
            [sessionsPath('test-campaign')]: [{ name: 'QA Sess A' }],
        });
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/sessions')
            .send({ sessions: [
                { name: 'Renamed Unique Session' },
                { name: 'Another Unique Session' },
            ] });

        expect(res.status).toBe(200);
        const content = JSON.parse(FILE_SYSTEM.get(sessionsPath('test-campaign')));
        expect(content).toHaveLength(2);
    });
});

describe('sessions - PUT rename duplicate-name guard', () => {
    it('rejects renaming an existing session onto another session name with a message and leaves data untouched', async () => {
        setupFs({
            [sessionsPath('test-campaign')]: [
                { name: 'QA Sess A', status: 'planned' },
                { name: 'QA Sess B', status: 'planned' },
            ],
        });
        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/sessions/QA Sess A')
            .send({ name: 'qa sess b', status: 'played' });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'A session with that name already exists');

        const content = JSON.parse(FILE_SYSTEM.get(sessionsPath('test-campaign')));
        expect(content).toHaveLength(2);
        expect(content[0]).toEqual({ name: 'QA Sess A', status: 'planned' });
        expect(content[1]).toEqual({ name: 'QA Sess B', status: 'planned' });
    });

    it('exempts editing a session while keeping its own name', async () => {
        setupFs({
            [sessionsPath('test-campaign')]: [
                { name: 'QA Sess A', status: 'planned' },
                { name: 'QA Sess B', status: 'planned' },
            ],
        });
        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/sessions/QA Sess A')
            .send({ name: 'QA Sess A', status: 'played' });

        expect(res.status).toBe(200);
        const content = JSON.parse(FILE_SYSTEM.get(sessionsPath('test-campaign')));
        expect(content.find(s => s.name === 'QA Sess A').status).toBe('played');
    });
});
