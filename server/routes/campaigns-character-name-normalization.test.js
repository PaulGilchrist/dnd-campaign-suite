// @maintained-by-ai
// Server-boundary name normalization for the character create (POST) and
// rename/save (PUT) lanes (2026-10-28-P backlog): " X " stores as "X" with
// filename "X.json" (no edge underscores), "A  B" collapses to "A B", the
// duplicate-name guard matches normalized spellings, and blank-after-trim
// names are rejected with an honest 400. Harness mirrors
// campaigns-character-duplicate-name.test.js (Map-backed fs mock).
import express from 'express';
import { request } from '../test-utils/localhostSupertest.js';
import { publish, removeChangeDataKey } from '../utils/changeData.js';

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


// Minimal sheet-loadable sections (campaigns-character.js shape guard): the
// 201/200 lanes must send full bodies; the 400-name/400-dupe lanes short-
// circuit BEFORE the guard and keep their historical payloads.
const VALID_SECTIONS = {
    race: { name: 'Human' },
    class: { name: 'Fighter', subclass: { name: 'Champion' } },
    abilities: [{ name: 'Strength', score: 10 }],
    inventory: { magicItems: [], equipped: [] },
};

beforeEach(() => {
    vi.mocked(publish).mockClear();
    vi.mocked(removeChangeDataKey).mockClear();
});

afterEach(() => {
    FILE_SYSTEM.clear();
});

describe('campaignsCharacter - POST name normalization', () => {
    it('trims edge spaces from the stored name and the filename (criterion 1)', async () => {
        setupFs({});

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign')
            .send({ character: { name: ' QA Trim Probe ', ...VALID_SECTIONS, level: 1 } });

        expect(res.status).toBe(201);
        expect(res.body.fileName).toBe('QA_Trim_Probe.json');
        expect(res.body.character.name).toBe('QA Trim Probe');
        const persisted = JSON.parse(FILE_SYSTEM.get('/mock/campaigns/test-campaign/QA_Trim_Probe.json'));
        expect(persisted.name).toBe('QA Trim Probe');
    });

    it('rejects a duplicate given the exact normalized name (criterion 2)', async () => {
        setupFs({
            '/mock/campaigns/test-campaign/QA_Trim_Probe.json': { name: 'QA Trim Probe', class: 'Fighter', level: 1 },
        });

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign')
            .send({ character: { name: 'QA Trim Probe', class: 'Wizard', level: 3 } });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('A character with that name already exists');
    });

    it('double-space and padded spellings collapse onto the same file → 400 dupe (criterion 2)', async () => {
        setupFs({
            '/mock/campaigns/test-campaign/QA_Trim_Probe.json': { name: 'QA Trim Probe', class: 'Fighter', level: 1 },
        });

        const app = createTestApp();
        const padded = await request(app)
            .post('/api/campaigns/test-campaign')
            .send({ character: { name: ' QA Trim Probe ', class: 'Wizard', level: 3 } });
        const doubled = await request(app)
            .post('/api/campaigns/test-campaign')
            .send({ character: { name: 'QA  Trim  Probe', class: 'Wizard', level: 3 } });

        expect(padded.status).toBe(400);
        expect(padded.body.error).toBe('A character with that name already exists');
        expect(doubled.status).toBe(400);
        expect(doubled.body.error).toBe('A character with that name already exists');
        // Original untouched, no second file written.
        expect(JSON.parse(FILE_SYSTEM.get('/mock/campaigns/test-campaign/QA_Trim_Probe.json')).level).toBe(1);
        expect([...FILE_SYSTEM.keys()]).toEqual(['/mock/campaigns/test-campaign', '/mock/campaigns/test-campaign/QA_Trim_Probe.json']);
    });

    it('rejects blank/whitespace-only/missing names with an honest 400', async () => {
        setupFs({});
        const app = createTestApp();

        for (const name of ['', '   ', undefined]) {
            const res = await request(app)
                .post('/api/campaigns/test-campaign')
                .send({ character: { name, class: 'Fighter', level: 1 } });
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Character name is required');
        }
        expect([...FILE_SYSTEM.keys()]).toEqual(['/mock/campaigns/test-campaign']);
    });

    it('is byte-identical for clean names (criterion 5)', async () => {
        setupFs({});

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign')
            .send({ character: { name: 'Thorin Oakenshield!', ...VALID_SECTIONS, level: 5 } });

        expect(res.status).toBe(201);
        expect(res.body.fileName).toBe('Thorin_Oakenshield_.json');
        const persisted = JSON.parse(FILE_SYSTEM.get('/mock/campaigns/test-campaign/Thorin_Oakenshield_.json'));
        expect(persisted.name).toBe('Thorin Oakenshield!');
    });
});

describe('campaignsCharacter - PUT name normalization (rename/save lane)', () => {
    it('rename to " QA Trim Probe2 " stores the trimmed name at QA_Trim_Probe2.json (criterion 3)', async () => {
        setupFs({
            '/mock/campaigns/test-campaign/QA_Trim_Probe.json': { name: 'QA Trim Probe', class: 'Fighter', level: 1, imagePath: '' },
        });

        const app = createTestApp();
        // Client sends the URL derived from the UNtrimmed input (legacy lane);
        // the server normalizes and lands on the canonical path regardless.
        const res = await request(app)
            .put('/api/campaigns/test-campaign/_QA_Trim_Probe2_.json')
            .send({ name: ' QA Trim Probe2 ', ...VALID_SECTIONS, level: 1, imagePath: '', originalFileName: 'QA_Trim_Probe.json' });

        expect(res.status).toBe(200);
        expect(FILE_SYSTEM.has('/mock/campaigns/test-campaign/QA_Trim_Probe.json')).toBe(false);
        const persisted = JSON.parse(FILE_SYSTEM.get('/mock/campaigns/test-campaign/QA_Trim_Probe2.json'));
        expect(persisted.name).toBe('QA Trim Probe2');
        expect(publish).toHaveBeenCalledWith('character-test-campaign-QA_Trim_Probe2.json', expect.objectContaining({ name: 'QA Trim Probe2' }), 'test-campaign');
        expect(removeChangeDataKey).toHaveBeenCalledWith('test-campaign', 'QA Trim Probe');
    });

    it('standard save with a padded name normalizes the stored name at the same file', async () => {
        setupFs({
            '/mock/campaigns/test-campaign/QA_Trim_Probe.json': { name: 'QA Trim Probe', class: 'Fighter', level: 1, imagePath: '' },
        });

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/QA_Trim_Probe.json')
            .send({ name: '  QA Trim Probe  ', ...VALID_SECTIONS, level: 2, imagePath: '', originalFileName: 'QA_Trim_Probe.json' });

        expect(res.status).toBe(200);
        const persisted = JSON.parse(FILE_SYSTEM.get('/mock/campaigns/test-campaign/QA_Trim_Probe.json'));
        expect(persisted.name).toBe('QA Trim Probe');
        expect(persisted.level).toBe(2);
    });

    it('rejects blank/missing names with an honest 400 and leaves the file untouched', async () => {
        setupFs({
            '/mock/campaigns/test-campaign/QA_Trim_Probe.json': { name: 'QA Trim Probe', class: 'Fighter', level: 1 },
        });

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/QA_Trim_Probe.json')
            .send({ name: '   ', class: 'Fighter', level: 9 });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Character name is required');
        expect(JSON.parse(FILE_SYSTEM.get('/mock/campaigns/test-campaign/QA_Trim_Probe.json')).level).toBe(1);
    });

    it('is byte-identical for clean renames (criterion 5)', async () => {
        setupFs({
            '/mock/campaigns/test-campaign/OldName.json': { name: 'OldName', class: 'Fighter', level: 3, imagePath: '' },
        });

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/NewName.json')
            .send({ name: 'NewName', ...VALID_SECTIONS, level: 7, imagePath: '', originalFileName: 'OldName.json' });

        expect(res.status).toBe(200);
        expect(FILE_SYSTEM.has('/mock/campaigns/test-campaign/OldName.json')).toBe(false);
        expect(JSON.parse(FILE_SYSTEM.get('/mock/campaigns/test-campaign/NewName.json')).name).toBe('NewName');
    });
});
