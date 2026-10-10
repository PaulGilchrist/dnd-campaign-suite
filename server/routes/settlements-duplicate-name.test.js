// Regression tests for duplicate-name overwrite: PUT must reject renames
// that collide case-insensitively with another existing settlement's name,
// and POST must reject duplicate-name lists (mirrors npcs-duplicate-name /
// quests-duplicate-name guards).
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

import settlements from './settlements.js';

function settlementsPath(campaign) {
    return `/mock/campaigns/${campaign}/data/settlements.json`;
}

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(settlements);
    return app;
}

afterEach(() => {
    FILE_SYSTEM.clear();
});

describe('settlements - PUT duplicate-name guard', () => {
    it('rejects a rename colliding case-insensitively with another settlement and leaves data untouched', async () => {
        setupFs({
            [settlementsPath('test-campaign')]: [
                { name: 'QA Riverside Hamlet', population: '1,200 souls' },
                { name: 'Ironhaven', population: '5,000 souls' },
            ],
        });
        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/settlements/Ironhaven')
            .send({ name: 'qa riverside hamlet', population: '' });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'A settlement with that name already exists');

        const content = JSON.parse(FILE_SYSTEM.get(settlementsPath('test-campaign')));
        expect(content).toHaveLength(2);
        expect(content.map(s => s.name)).toEqual(['QA Riverside Hamlet', 'Ironhaven']);
        expect(content[0].population).toBe('1,200 souls');
    });

    it('rejects a rename colliding exactly with another settlement name', async () => {
        setupFs({
            [settlementsPath('test-campaign')]: [
                { name: 'QA Riverside Hamlet', population: '1,200 souls' },
                { name: 'Ironhaven', population: '5,000 souls' },
            ],
        });
        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/settlements/Ironhaven')
            .send({ name: 'QA Riverside Hamlet', population: '' });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'A settlement with that name already exists');
    });

    it('rejects creating a settlement when the PUT creates a case-different duplicate', async () => {
        setupFs({
            [settlementsPath('test-campaign')]: [
                { name: 'QA Riverside Hamlet', population: '1,200 souls' },
            ],
        });
        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/settlements/qa%20riverside%20hamlet')
            .send({ name: 'QA RIVERSIDE HAMLET', population: '' });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'A settlement with that name already exists');

        const content = JSON.parse(FILE_SYSTEM.get(settlementsPath('test-campaign')));
        expect(content).toHaveLength(1);
        expect(content[0].population).toBe('1,200 souls');
    });

    it('allows saving a settlement under its own name (self-edit)', async () => {
        setupFs({
            [settlementsPath('test-campaign')]: [{ name: 'QA Riverside Hamlet', population: '1,200 souls' }],
        });
        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/settlements/QA%20Riverside%20Hamlet')
            .send({ name: 'QA Riverside Hamlet', population: '1,500 souls' });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
        const content = JSON.parse(FILE_SYSTEM.get(settlementsPath('test-campaign')));
        expect(content[0].population).toBe('1,500 souls');
    });

    it('allows renaming to a unique name', async () => {
        setupFs({
            [settlementsPath('test-campaign')]: [{ name: 'Old Hamlet' }],
        });
        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/settlements/Old%20Hamlet')
            .send({ name: 'Fresh Hamlet' });

        expect(res.status).toBe(200);
        const content = JSON.parse(FILE_SYSTEM.get(settlementsPath('test-campaign')));
        expect(content).toHaveLength(1);
        expect(content[0].name).toBe('Fresh Hamlet');
    });

    it('rejects a save with an empty name', async () => {
        setupFs({ [settlementsPath('test-campaign')]: [{ name: 'QA Riverside Hamlet' }] });
        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/settlements/QA%20Riverside%20Hamlet')
            .send({ name: '   ' });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'Settlement name is required');
    });

    it('creates a new settlement when no name collision exists', async () => {
        setupFs({ [settlementsPath('test-campaign')]: [{ name: 'QA Riverside Hamlet' }] });
        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/settlements/Brand%20New%20Hamlet')
            .send({ name: 'Brand New Hamlet', population: '50 souls' });

        expect(res.status).toBe(200);
        const content = JSON.parse(FILE_SYSTEM.get(settlementsPath('test-campaign')));
        expect(content).toHaveLength(2);
    });
});

describe('settlements - POST duplicate-name guard (validateList)', () => {
    it('rejects a list whose names collide case-insensitively and leaves data untouched', async () => {
        setupFs({
            [settlementsPath('test-campaign')]: [
                { name: 'QA Riverside Hamlet' },
            ],
        });
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/settlements')
            .send({ settlements: [
                { name: 'QA Riverside Hamlet' },
                { name: 'qa riverside HAMLET' },
            ] });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'A settlement with that name already exists');

        const content = JSON.parse(FILE_SYSTEM.get(settlementsPath('test-campaign')));
        expect(content).toHaveLength(1);
        expect(content[0].name).toBe('QA Riverside Hamlet');
    });

    it('allows saving a unique-name list', async () => {
        setupFs({
            [settlementsPath('test-campaign')]: [],
        });
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/settlements')
            .send({ settlements: [
                { name: 'QA Riverside Hamlet' },
                { name: 'Ironhaven' },
            ] });

        expect(res.status).toBe(200);
        const content = JSON.parse(FILE_SYSTEM.get(settlementsPath('test-campaign')));
        expect(content).toHaveLength(2);
    });
});
