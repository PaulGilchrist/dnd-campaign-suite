// Regression tests for the character-creation duplicate-name overwrite:
// POST /api/campaigns/:campaign must reject a name whose target file already
// exists (400 "A character with that name already exists") instead of silently
// overwriting the existing character JSON, mirroring the NPCs/Quests/
// Settlements duplicate-name guards.
import express from 'express';
import { request } from '../test-utils/localhostSupertest.js';

const FILE_SYSTEM = new Map();

function setupFs(entries) {
    FILE_SYSTEM.clear();
    FILE_SYSTEM.set('/mock/campaigns/test-campaign', '');
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
        unlinkSync: (p) => { FILE_SYSTEM.delete(p); },
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
    unlinkSync: (p) => { FILE_SYSTEM.delete(p); },
    renameSync: (oldPath, newPath) => {
        const data = FILE_SYSTEM.get(oldPath);
        if (data !== undefined) {
            FILE_SYSTEM.set(newPath, data);
            FILE_SYSTEM.delete(oldPath);
        }
    },
}));

vi.mock('../utils/campaignPaths.js', () => ({
    campaignDir: vi.fn((campaign) => `/mock/campaigns/${campaign}`),
    campaignImagesDir: vi.fn((campaign) => `/mock/campaigns/${campaign}/images`),
}));

vi.mock('../utils/imageUtils.js', () => ({
    processImageUpload: vi.fn(),
    deleteCharacterImage: vi.fn(),
}));

vi.mock('../utils/changeData.js', () => ({
    publish: vi.fn(),
    removeChangeDataKey: vi.fn(),
}));

import campaignsCharacter from './campaigns-character.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(campaignsCharacter);
    return app;
}

afterEach(() => {
    FILE_SYSTEM.clear();
});

describe('campaignsCharacter - POST duplicate-name guard', () => {
    it('rejects creating a character whose file already exists and leaves the original untouched', async () => {
        const original = { name: 'AasimarTest', race: { name: 'Orc' }, class: { name: 'Rogue' }, level: 20 };
        setupFs({
            '/mock/campaigns/test-campaign/AasimarTest.json': original,
        });

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign')
            .send({ character: { name: 'AasimarTest', race: { name: 'Human' }, class: { name: 'Wizard' }, level: 1 } });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'A character with that name already exists');

        const persisted = JSON.parse(FILE_SYSTEM.get('/mock/campaigns/test-campaign/AasimarTest.json'));
        expect(persisted.level).toBe(20);
        expect(persisted.class.name).toBe('Rogue');
    });

    it('rejects a duplicate whose name sanitizes to the same filename', async () => {
        setupFs({
            '/mock/campaigns/test-campaign/Bob_Lee.json': { name: 'Bob Lee', level: 20 },
        });

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign')
            .send({ character: { name: 'Bob-Lee', level: 1 } });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'A character with that name already exists');
        expect(JSON.parse(FILE_SYSTEM.get('/mock/campaigns/test-campaign/Bob_Lee.json')).level).toBe(20);
    });

    it('creates a uniquely-named character normally', async () => {
        setupFs({
            '/mock/campaigns/test-campaign/AasimarTest.json': { name: 'AasimarTest', level: 20 },
        });

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign')
            .send({ character: { name: 'BrandNewHero', level: 1 } });

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('fileName', 'BrandNewHero.json');
        expect(FILE_SYSTEM.has('/mock/campaigns/test-campaign/BrandNewHero.json')).toBe(true);
    });
});
