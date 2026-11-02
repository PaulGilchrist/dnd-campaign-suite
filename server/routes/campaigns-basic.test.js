import { request } from '../test-utils/localhostSupertest.js';
import express from 'express';
import campaignsBasic from './campaigns-basic.js';
import * as campaignPaths from '../utils/campaignPaths.js';

// ─── Mocks ─────────────────────────────────────────────────────────────────────

// Mock fs.readdirSync per-path
const MOCK_REaddir = new Map();

function setupReaddir(path, entries) {
    MOCK_REaddir.set(path, entries);
}

function clearMockFs() {
    MOCK_REaddir.clear();
    MOCK_FILES.clear();
}

vi.mock('fs', () => ({
    default: {
        readdirSync: vi.fn((dirPath) => {
            const entries = MOCK_REaddir.get(dirPath);
            if (entries === undefined) {
                throw new Error('ENOENT: no such file or directory');
            }
            return entries;
        }),
        existsSync: vi.fn((p) => MOCK_FILES.has(p)),
        readFileSync: vi.fn((p) => {
            if (MOCK_FILES.has(p)) return MOCK_FILES.get(p);
            throw new Error('ENOENT');
        }),
    },
}));

// Campaign-type resolution (campaigns-meta.js) reads per-campaign data files.
const MOCK_FILES = new Map();

vi.mock('../utils/campaignPaths.js', () => ({
    campaignsRoot: vi.fn(() => '/mock/campaigns/root'),
    campaignDir: vi.fn((campaign) => `/mock/campaigns/root/${campaign}`),
    campaignDataFile: vi.fn((campaign, fileName) => `/mock/campaigns/root/${campaign}/data/${fileName}`),
}));



// ─── Helpers ───────────────────────────────────────────────────────────────────

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(campaignsBasic);
    return app;
}

function dirEntry(name, isDir) {
    return {
        name,
        isDirectory: () => isDir,
        isFile: () => !isDir,
    };
}

// ─── /api/campaigns ────────────────────────────────────────────────────────────

describe('campaignsBasic - GET /api/campaigns', () => {
    afterEach(clearMockFs);

    it('should return a list of campaign folder names', async () => {
        setupReaddir('/mock/campaigns/root', [
            dirEntry('test-campaign-a', true),
            dirEntry('test-campaign-b', true),
        ]);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('folders');
        expect(Array.isArray(res.body.folders)).toBe(true);
        expect(res.body.folders).toContain('test-campaign-a');
        expect(res.body.folders).toContain('test-campaign-b');
    });

    it('should return folders sorted alphabetically', async () => {
        setupReaddir('/mock/campaigns/root', [
            dirEntry('test-campaign-c', true),
            dirEntry('test-campaign-a', true),
            dirEntry('test-campaign-b', true),
        ]);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns');

        expect(res.status).toBe(200);
        const folders = res.body.folders;
        const sorted = [...folders].sort();
        expect(folders).toEqual(sorted);
    });

    it('should only return directories, not files', async () => {
        setupReaddir('/mock/campaigns/root', [
            dirEntry('test-campaign-a', true),
            dirEntry('schema.json', false),
        ]);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns');

        expect(res.status).toBe(200);
        expect(res.body.folders).not.toContain('schema.json');
        expect(res.body.folders).toContain('test-campaign-a');
    });

    it('should return an empty folders array when no campaigns exist', async () => {
        setupReaddir('/mock/campaigns/root', []);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns');

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.folders)).toBe(true);
    });

    it('should return 500 when campaigns directory does not exist', async () => {
        setupReaddir('/mock/campaigns/root', undefined);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns');

        expect(res.status).toBe(500);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('ENOENT: no such file or directory');
    });

    it('should exclude hidden directories (starting with .)', async () => {
        setupReaddir('/mock/campaigns/root', [
            dirEntry('test-campaign-a', true),
            dirEntry('.hidden-campaign', true),
            dirEntry('test-campaign-b', true),
        ]);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns');

        expect(res.status).toBe(200);
        expect(res.body.folders).toContain('test-campaign-a');
        expect(res.body.folders).toContain('test-campaign-b');
        expect(res.body.folders).not.toContain('.hidden-campaign');
    });

    it('maps every folder to its type (meta file, starter-seed inference, else standard)', async () => {
        setupReaddir('/mock/campaigns/root', [
            dirEntry('Arena One', true),
            dirEntry('Starter One', true),
            dirEntry('Plain One', true),
        ]);
        MOCK_FILES.set('/mock/campaigns/root/Arena One/data/campaign-meta.json', JSON.stringify({ type: 'arena' }));
        MOCK_FILES.set('/mock/campaigns/root/Starter One/data/starter-seed.json', JSON.stringify({ version: 1 }));

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns');

        expect(res.status).toBe(200);
        expect(res.body.types).toEqual({
            'Arena One': 'arena',
            'Starter One': 'starter',
            'Plain One': 'standard',
        });
    });

    it('should return 404 for non-existent routes', async () => {
        const app = createTestApp();
        const res = await request(app).get('/api/nonexistent');

        expect(res.status).toBe(404);
    });
});

// ─── /api/campaigns/:campaign ──────────────────────────────────────────────────

describe('campaignsBasic - GET /api/campaigns/:campaign', () => {
    afterEach(clearMockFs);

    it('should return json files in a campaign directory', async () => {
        setupReaddir('/mock/campaigns/root/test-campaign', [
            dirEntry('character1.json', false),
            dirEntry('character2.json', false),
        ]);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('files');
        expect(Array.isArray(res.body.files)).toBe(true);
        expect(res.body.files).toContain('character1.json');
        expect(res.body.files).toContain('character2.json');
    });

    it('should return files sorted alphabetically', async () => {
        setupReaddir('/mock/campaigns/root/test-campaign', [
            dirEntry('zebra.json', false),
            dirEntry('alpha.json', false),
            dirEntry('middle.json', false),
        ]);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign');

        expect(res.status).toBe(200);
        const files = res.body.files;
        const sorted = [...files].sort();
        expect(files).toEqual(sorted);
    });

    it('should only return .json files, not other file types', async () => {
        setupReaddir('/mock/campaigns/root/test-campaign', [
            dirEntry('character.json', false),
            dirEntry('character.txt', false),
            dirEntry('data.csv', false),
        ]);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign');

        expect(res.status).toBe(200);
        expect(res.body.files).toContain('character.json');
        expect(res.body.files).not.toContain('character.txt');
        expect(res.body.files).not.toContain('data.csv');
    });

    it('should return an empty files array when campaign has no json files', async () => {
        setupReaddir('/mock/campaigns/root/test-campaign', [
            dirEntry('readme.txt', false),
        ]);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign');

        expect(res.status).toBe(200);
        expect(res.body.files).toEqual([]);
    });

    it('should return 500 when campaign directory does not exist', async () => {
        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/nonexistent-campaign');

        expect(res.status).toBe(500);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('ENOENT: no such file or directory');
    });

    it('should return 500 on filesystem error', async () => {
        setupReaddir('/mock/campaigns/root/test-campaign', undefined);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign');

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('ENOENT: no such file or directory');
    });

    it('should call campaignDir with the campaign name from URL params', async () => {
        setupReaddir('/mock/campaigns/root/my-special-campaign', [
            dirEntry('character.json', false),
        ]);

        const app = createTestApp();
        await request(app).get('/api/campaigns/my-special-campaign');

        expect(campaignPaths.campaignDir).toHaveBeenCalledWith('my-special-campaign');
    });
});
