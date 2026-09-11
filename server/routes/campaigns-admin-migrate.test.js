import request from 'supertest';
import express from 'express';
import campaignsAdmin from './campaigns-admin.js';

// Mock filesystem state
const mockFsState = {
    exists: new Set(),
    files: new Map(),
    readdir: new Map(),
};

vi.mock('fs', () => ({
    default: {
        existsSync: vi.fn((path) => mockFsState.exists.has(path)),
        mkdirSync: vi.fn((path) => {
            mockFsState.exists.add(path);
        }),
        renameSync: vi.fn((oldPath, newPath) => {
            if (mockFsState.exists.has(oldPath)) {
                mockFsState.exists.delete(oldPath);
            }
            mockFsState.exists.add(newPath);
        }),
        rmSync: vi.fn((path) => {
            mockFsState.exists.delete(path);
        }),
        writeFileSync: vi.fn((path, data) => {
            mockFsState.files.set(path, data);
        }),
        readdirSync: vi.fn((path) => {
            const entries = mockFsState.readdir.get(path);
            if (entries === undefined) {
                throw new Error('ENOENT: no such file or directory');
            }
            return entries;
        }),
        readFileSync: vi.fn((path) => {
            if (mockFsState.files.has(path)) {
                return mockFsState.files.get(path);
            }
            throw new Error('ENOENT: no such file or directory');
        }),
        unlinkSync: vi.fn((path) => {
            mockFsState.files.delete(path);
            mockFsState.exists.delete(path);
        }),
        createWriteStream: vi.fn(() => ({
            on: vi.fn((event, cb) => {
                if (event === 'error') return { on: () => {} };
                if (event === 'close') setTimeout(cb, 0);
                return {};
            }),
            write: () => {},
            end: () => {},
            bytesWritten: 1024,
        })),
        statSync: vi.fn(() => ({ isDirectory: () => true })),
    },
    existsSync: vi.fn((path) => mockFsState.exists.has(path)),
    mkdirSync: vi.fn((path) => {
        mockFsState.exists.add(path);
    }),
    renameSync: vi.fn((oldPath, newPath) => {
        if (mockFsState.exists.has(oldPath)) {
            mockFsState.exists.delete(oldPath);
        }
        mockFsState.exists.add(newPath);
    }),
    rmSync: vi.fn((path) => {
        mockFsState.exists.delete(path);
    }),
    writeFileSync: vi.fn((path, data) => {
        mockFsState.files.set(path, data);
    }),
    readdirSync: vi.fn((path) => {
        const entries = mockFsState.readdir.get(path);
        if (entries === undefined) {
            throw new Error('ENOENT: no such file or directory');
        }
        return entries;
    }),
    readFileSync: vi.fn((path) => {
        if (mockFsState.files.has(path)) {
            return mockFsState.files.get(path);
        }
        throw new Error('ENOENT: no such file or directory');
    }),
    unlinkSync: vi.fn((path) => {
        mockFsState.files.delete(path);
        mockFsState.exists.delete(path);
    }),
    createWriteStream: vi.fn(() => ({
        on: vi.fn((event, cb) => {
            if (event === 'error') return { on: () => {} };
            if (event === 'close') setTimeout(cb, 0);
            return {};
        }),
        write: () => {},
        end: () => {},
        bytesWritten: 1024,
    })),
    statSync: vi.fn(() => ({ isDirectory: () => true })),
}));

vi.mock('../utils/campaignPaths.js', () => ({
    campaignDir: (name) => `/mock/campaigns/${name}`,
    campaignMapsDir: (name) => `/mock/campaigns/${name}/maps`,
    campaignImagesDir: (name) => `/mock/campaigns/${name}/images`,
    campaignDataDir: (name) => `/mock/campaigns/${name}/data`,
    campaignDataFile: (campaign, fileName) => `/mock/campaigns/${campaign}/data/${fileName}`,
    campaignSnapshotDir: () => '/mock/campaigns/.snapshots',
    campaignSnapshotFile: (campaign) => `/mock/campaigns/.snapshots/${campaign}.zip`,
}));

vi.mock('../utils/changeData.js', () => ({
    characterChangeData: new Map(),
    spellOverlayData: new Map(),
    activeMaps: new Map(),
    saveFile: vi.fn(),
    markDirty: vi.fn(),
    publish: vi.fn(),
    readFile: vi.fn(),
}));

vi.mock('./log.js', () => ({
    logCache: new Map(),
}));

vi.mock('archiver', () => ({
    default: {
        ZipArchive: vi.fn().mockImplementation(() => ({
            on: vi.fn().mockReturnThis(),
            pipe: vi.fn().mockReturnThis(),
            directory: vi.fn().mockReturnThis(),
            finalize: vi.fn(),
            abort: vi.fn(),
        })),
    },
}));

vi.mock('extract-zip', () => ({
    default: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('multer', () => {
    const multerInstance = {
        single: vi.fn(() => (req, res, next) => next()),
        array: vi.fn(() => (req, res, next) => next()),
        fields: vi.fn(() => (req, res, next) => next()),
    };
    const multerFn = Object.assign(function multer() {
        return multerInstance;
    }, {
        memoryStorage: () => ({}),
        diskStorage: () => ({}),
    });
    return { default: multerFn };
});

// ─── Helpers ───────────────────────────────────────────────────────────────────

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(campaignsAdmin);
    return app;
}

function ensureRealCampaignsDir(campaignNames) {
    const realPath = `${process.cwd()}/public/campaigns`;
    mockFsState.exists.add(realPath);
    mockFsState.readdir.set(realPath, campaignNames || []);
}

// ─── Tests: POST /api/campaigns/migrate-image-paths ────────────────────────────

describe('campaignsAdmin - POST /api/campaigns/migrate-image-paths', () => {

    beforeEach(() => {
        mockFsState.exists.clear();
        mockFsState.files.clear();
        mockFsState.readdir.clear();
    });

    it('should return early when campaigns directory does not exist', async () => {
        const app = createTestApp();
        const res = await request(app).post('/api/campaigns/migrate-image-paths').set('Host', 'localhost');
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('No campaigns directory found');
    });

    it('should migrate imagePath in character JSON files', async () => {
        const app = createTestApp();
        const realCampaignsDir = `${process.cwd()}/public/campaigns`;
        const realCampaignPath = `${realCampaignsDir}/test-campaign`;
        ensureRealCampaignsDir(['test-campaign']);
        mockFsState.exists.add(realCampaignPath);
        const charPath = `${realCampaignPath}/character1.json`;
        mockFsState.exists.add(charPath);
        const imageData = JSON.stringify({
            name: 'Hero',
            imagePath: 'campaigns/test-campaign/images/hero.png',
        });
        mockFsState.files.set(charPath, imageData);
        mockFsState.readdir.set(realCampaignPath, ['character1.json']);

        const res = await request(app).post('/api/campaigns/migrate-image-paths').set('Host', 'localhost');
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Migration complete. Migrated 1 imagePath fields.');

        // Verify the file was rewritten with relative path
        const written = mockFsState.files.get(charPath);
        const parsed = JSON.parse(written);
        expect(parsed.imagePath).toBe('images/hero.png');
    });

    it('should skip character JSON files without imagePath', async () => {
        const app = createTestApp();
        const realCampaignsDir = `${process.cwd()}/public/campaigns`;
        const realCampaignPath = `${realCampaignsDir}/test-campaign`;
        ensureRealCampaignsDir(['test-campaign']);
        mockFsState.exists.add(realCampaignPath);
        const charPath = `${realCampaignPath}/character1.json`;
        const imageData = JSON.stringify({
            name: 'Hero',
            level: 5,
        });
        mockFsState.files.set(charPath, imageData);
        mockFsState.readdir.set(realCampaignPath, ['character1.json']);

        const res = await request(app).post('/api/campaigns/migrate-image-paths').set('Host', 'localhost');
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Migration complete. Migrated 0 imagePath fields.');
    });

    it('should skip character JSON files with imagePath that does not include campaigns/', async () => {
        const app = createTestApp();
        const realCampaignsDir = `${process.cwd()}/public/campaigns`;
        const realCampaignPath = `${realCampaignsDir}/test-campaign`;
        ensureRealCampaignsDir(['test-campaign']);
        mockFsState.exists.add(realCampaignPath);
        const charPath = `${realCampaignPath}/character1.json`;
        const imageData = JSON.stringify({
            name: 'Hero',
            imagePath: 'images/hero.png',
        });
        mockFsState.files.set(charPath, imageData);
        mockFsState.readdir.set(realCampaignPath, ['character1.json']);

        const res = await request(app).post('/api/campaigns/migrate-image-paths').set('Host', 'localhost');
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Migration complete. Migrated 0 imagePath fields.');
    });

    it('should migrate imagePath in NPC data files', async () => {
        const app = createTestApp();
        const realCampaignsDir = `${process.cwd()}/public/campaigns`;
        const realCampaignPath = `${realCampaignsDir}/test-campaign`;
        ensureRealCampaignsDir(['test-campaign']);
        mockFsState.exists.add(realCampaignPath);
        mockFsState.exists.add(`${realCampaignPath}/data`);
        const npcsPath = `${realCampaignPath}/data/npcs.json`;
        mockFsState.exists.add(npcsPath);
        const npcData = JSON.stringify([
            { name: 'Goblin', imagePath: 'campaigns/test-campaign/images/goblin.png' },
            { name: 'Dragon', imagePath: 'campaigns/test-campaign/images/dragon.png' },
            { name: 'NPC without image' },
        ]);
        mockFsState.files.set(npcsPath, npcData);
        mockFsState.readdir.set(realCampaignPath, ['data']);
        mockFsState.readdir.set(`${realCampaignPath}/data`, ['npcs.json']);

        const res = await request(app).post('/api/campaigns/migrate-image-paths').set('Host', 'localhost');
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Migration complete. Migrated 2 imagePath fields.');

        // Verify NPCs were rewritten
        const written = mockFsState.files.get(npcsPath);
        const parsed = JSON.parse(written);
        expect(parsed[0].imagePath).toBe('images/goblin.png');
        expect(parsed[1].imagePath).toBe('images/dragon.png');
        expect(parsed[2].imagePath).toBeUndefined();
    });

    it('should not write npc file if no changes needed', async () => {
        const app = createTestApp();
        const realCampaignsDir = `${process.cwd()}/public/campaigns`;
        const realCampaignPath = `${realCampaignsDir}/test-campaign`;
        ensureRealCampaignsDir(['test-campaign']);
        mockFsState.exists.add(realCampaignPath);
        const npcPath = `${realCampaignPath}/data/npcs.json`;
        mockFsState.exists.add(`${realCampaignPath}/data`);
        mockFsState.exists.add(npcPath);
        const npcData = JSON.stringify([
            { name: 'Goblin' },
        ]);
        mockFsState.files.set(npcPath, npcData);
        mockFsState.readdir.set(realCampaignPath, ['data']);
        mockFsState.readdir.set(`${realCampaignPath}/data`, ['npcs.json']);

        const res = await request(app).post('/api/campaigns/migrate-image-paths').set('Host', 'localhost');
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Migration complete. Migrated 0 imagePath fields.');

        // File should not have been rewritten
        const written = mockFsState.files.get(npcPath);
        expect(written).toBe(npcData);
    });

    it('should handle campaign with no npcs.json', async () => {
        const app = createTestApp();
        const realCampaignsDir = `${process.cwd()}/public/campaigns`;
        const realCampaignPath = `${realCampaignsDir}/test-campaign`;
        ensureRealCampaignsDir(['test-campaign']);
        mockFsState.exists.add(realCampaignPath);
        mockFsState.readdir.set(realCampaignPath, ['character1.json']);
        mockFsState.files.set(`${realCampaignPath}/character1.json`, JSON.stringify({
            name: 'Hero',
            level: 5,
        }));

        const res = await request(app).post('/api/campaigns/migrate-image-paths').set('Host', 'localhost');
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Migration complete. Migrated 0 imagePath fields.');
    });

    it('should handle multiple campaigns', async () => {
        const app = createTestApp();
        const realCampaignsDir = `${process.cwd()}/public/campaigns`;
        const realCampaignPath1 = `${realCampaignsDir}/campaign-a`;
        const realCampaignPath2 = `${realCampaignsDir}/campaign-b`;
        ensureRealCampaignsDir(['campaign-a', 'campaign-b']);
        mockFsState.exists.add(realCampaignPath1);
        mockFsState.exists.add(realCampaignPath2);

        const charPath1 = `${realCampaignPath1}/char1.json`;
        const charData1 = JSON.stringify({ name: 'Hero1', imagePath: 'campaigns/campaign-a/images/hero1.png' });
        mockFsState.files.set(charPath1, charData1);
        mockFsState.readdir.set(realCampaignPath1, ['char1.json']);

        const charPath2 = `${realCampaignPath2}/char2.json`;
        const charData2 = JSON.stringify({ name: 'Hero2', imagePath: 'campaigns/campaign-b/images/hero2.png' });
        mockFsState.files.set(charPath2, charData2);
        mockFsState.readdir.set(realCampaignPath2, ['char2.json']);

        const res = await request(app).post('/api/campaigns/migrate-image-paths').set('Host', 'localhost');
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Migration complete. Migrated 2 imagePath fields.');

        const written1 = mockFsState.files.get(charPath1);
        const parsed1 = JSON.parse(written1);
        expect(parsed1.imagePath).toBe('images/hero1.png');

        const written2 = mockFsState.files.get(charPath2);
        const parsed2 = JSON.parse(written2);
        expect(parsed2.imagePath).toBe('images/hero2.png');
    });

    it('should skip non-json files in campaign directory', async () => {
        const app = createTestApp();
        const realCampaignsDir = `${process.cwd()}/public/campaigns`;
        const realCampaignPath = `${realCampaignsDir}/test-campaign`;
        ensureRealCampaignsDir(['test-campaign']);
        mockFsState.exists.add(realCampaignPath);
        mockFsState.readdir.set(realCampaignPath, ['character1.json', 'readme.txt', 'map.png']);
        mockFsState.files.set(`${realCampaignPath}/character1.json`, JSON.stringify({
            name: 'Hero',
            level: 5,
        }));

        const res = await request(app).post('/api/campaigns/migrate-image-paths').set('Host', 'localhost');
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Migration complete. Migrated 0 imagePath fields.');
    });

    it('should handle character with non-string imagePath', async () => {
        const app = createTestApp();
        const realCampaignsDir = `${process.cwd()}/public/campaigns`;
        const realCampaignPath = `${realCampaignsDir}/test-campaign`;
        ensureRealCampaignsDir(['test-campaign']);
        mockFsState.exists.add(realCampaignPath);
        const charPath = `${realCampaignPath}/character1.json`;
        const imageData = JSON.stringify({
            name: 'Hero',
            imagePath: 123,
        });
        mockFsState.files.set(charPath, imageData);
        mockFsState.readdir.set(realCampaignPath, ['character1.json']);

        const res = await request(app).post('/api/campaigns/migrate-image-paths').set('Host', 'localhost');
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Migration complete. Migrated 0 imagePath fields.');

        // File must not have been rewritten
        expect(mockFsState.files.get(charPath)).toBe(imageData);
    });
});
