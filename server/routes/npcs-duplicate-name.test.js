// Regression tests for duplicate-name overwrite: PUT must reject renames
// that collide case-insensitively with another existing NPC's name,
// mirroring the maps rename guard ("A map with this name already exists").
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

afterEach(() => {
    FILE_SYSTEM.clear();
});

describe('npcs - PUT duplicate-name guard', () => {
    it('rejects a rename colliding case-insensitively with another NPC and leaves data untouched', async () => {
        setupFs({
            [npcsPath('test-campaign')]: [
                { name: 'QA Test NPC', race: 'Human' },
                { name: 'Other Guy', race: 'Elf' },
            ],
        });
        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/npcs/Other%20Guy')
            .send({ name: 'qa test npc', race: 'Elf' });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'An NPC with that name already exists');

        const content = JSON.parse(FILE_SYSTEM.get(npcsPath('test-campaign')));
        expect(content).toHaveLength(2);
        expect(content.map(n => n.name)).toEqual(['QA Test NPC', 'Other Guy']);
        expect(content[0].race).toBe('Human');
    });

    it('rejects a rename colliding exactly with another NPC name', async () => {
        setupFs({
            [npcsPath('test-campaign')]: [
                { name: 'QA Test NPC', race: 'Human' },
                { name: 'Other Guy', race: 'Elf' },
            ],
        });
        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/npcs/Other%20Guy')
            .send({ name: 'QA Test NPC', race: 'Elf' });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'An NPC with that name already exists');
    });

    it('allows saving an NPC under its own name (case-insensitive self-match)', async () => {
        setupFs({
            [npcsPath('test-campaign')]: [{ name: 'QA Test NPC', race: 'Human' }],
        });
        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/npcs/QA%20Test%20NPC')
            .send({ name: 'QA Test NPC', race: 'Human', goals: 'updated' });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
        const content = JSON.parse(FILE_SYSTEM.get(npcsPath('test-campaign')));
        expect(content[0].goals).toBe('updated');
    });

    it('allows renaming to a unique name', async () => {
        setupFs({
            [npcsPath('test-campaign')]: [{ name: 'Old Name', race: 'Human' }],
        });
        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/npcs/Old%20Name')
            .send({ name: 'Fresh Name', race: 'Human' });

        expect(res.status).toBe(200);
        const content = JSON.parse(FILE_SYSTEM.get(npcsPath('test-campaign')));
        expect(content).toHaveLength(1);
        expect(content[0].name).toBe('Fresh Name');
    });

    it('rejects a save with an empty name', async () => {
        setupFs({ [npcsPath('test-campaign')]: [{ name: 'QA Test NPC' }] });
        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/npcs/QA%20Test%20NPC')
            .send({ name: '   ' });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'NPC name is required');
    });

    it('creates a new NPC when no name collision exists', async () => {
        setupFs({ [npcsPath('test-campaign')]: [{ name: 'QA Test NPC' }] });
        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/npcs/Brand%20New%20NPC')
            .send({ name: 'Brand New NPC', race: 'Dwarf' });

        expect(res.status).toBe(200);
        const content = JSON.parse(FILE_SYSTEM.get(npcsPath('test-campaign')));
        expect(content).toHaveLength(2);
    });
});
