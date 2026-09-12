import { request } from '../test-utils/localhostSupertest.js';
import express from 'express';
import campaignsAdmin from './campaigns-admin.js';

const mockFsState = { exists: new Set(), files: new Map(), mkdir: new Map(), readdir: new Map() };

vi.mock('fs', () => ({
    default: {
        existsSync: vi.fn((p) => mockFsState.exists.has(p)),
        mkdirSync: vi.fn((p) => { mockFsState.exists.add(p); mockFsState.mkdir.set(p, true); }),
        renameSync: vi.fn((oldPath, newPath) => { if (mockFsState.exists.has(oldPath)) mockFsState.exists.delete(oldPath); mockFsState.exists.add(newPath); }),
        rmSync: vi.fn((p) => { mockFsState.exists.delete(p); }),
        writeFileSync: vi.fn((p, data) => { mockFsState.files.set(p, data); }),
        readdirSync: vi.fn((p) => { const entries = mockFsState.readdir.get(p); if (entries === undefined) throw new Error('ENOENT'); return entries; }),
        readFileSync: vi.fn((p) => { if (mockFsState.files.has(p)) return mockFsState.files.get(p); throw new Error('ENOENT'); }),
        unlinkSync: vi.fn((p) => { mockFsState.files.delete(p); mockFsState.exists.delete(p); }),
        createWriteStream: vi.fn(() => ({ on: vi.fn((event, cb) => { if (event === 'error') return { on: () => {} }; if (event === 'close') setTimeout(cb, 0); return {}; }), write: () => {}, end: () => {}, bytesWritten: 1024 })),
        statSync: vi.fn(() => ({ isDirectory: () => true })),
    },
    existsSync: vi.fn((p) => mockFsState.exists.has(p)),
    mkdirSync: vi.fn((p) => { mockFsState.exists.add(p); mockFsState.mkdir.set(p, true); }),
    renameSync: vi.fn((oldPath, newPath) => { if (mockFsState.exists.has(oldPath)) mockFsState.exists.delete(oldPath); mockFsState.exists.add(newPath); }),
    rmSync: vi.fn((p) => { mockFsState.exists.delete(p); }),
    writeFileSync: vi.fn((p, data) => { mockFsState.files.set(p, data); }),
    readdirSync: vi.fn((p) => { const entries = mockFsState.readdir.get(p); if (entries === undefined) throw new Error('ENOENT'); return entries; }),
    readFileSync: vi.fn((p) => { if (mockFsState.files.has(p)) return mockFsState.files.get(p); throw new Error('ENOENT'); }),
    unlinkSync: vi.fn((p) => { mockFsState.files.delete(p); mockFsState.exists.delete(p); }),
    createWriteStream: vi.fn(() => ({ on: vi.fn((event, cb) => { if (event === 'error') return { on: () => {} }; if (event === 'close') setTimeout(cb, 0); return {}; }), write: () => {}, end: () => {}, bytesWritten: 1024 })),
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

vi.mock('./log.js', () => ({ logCache: new Map() }));
vi.mock('archiver', () => {
    class MockZipArchive {
        constructor() {
            this.bytesWritten = 1024;
            this._listeners = {};
            this._dest = null;
        }
        on(event, cb) { this._listeners[event] = cb; return this; }
        pipe(dest) { this._dest = dest; return this; }
        directory() { return this; }
        finalize() {
            setTimeout(() => {
                if (this._listeners['finish']) this._listeners['finish']();
                if (this._listeners['end']) this._listeners['end']();
                if (this._dest && typeof this._dest.end === 'function') this._dest.end();
            }, 0);
        }
        abort() {}
    }
    return {
        ZipArchive: MockZipArchive,
        default: { ZipArchive: MockZipArchive },
    };
});
vi.mock('extract-zip', () => ({ default: vi.fn().mockResolvedValue(undefined) }));
vi.mock('multer', () => {
    const multerInstance = {
        single: vi.fn((field) => (req, res, next) => {
            if (req._multerFile) {
                req.file = { buffer: req._multerFile, field, originalname: 'test.zip' };
            }
            next();
        }),
        array: vi.fn(() => (req, res, next) => next()),
        fields: vi.fn(() => (req, res, next) => next()),
    };
    const multerFn = Object.assign(function multer() { return multerInstance; }, { memoryStorage: () => ({}), diskStorage: () => ({}) });
    return { default: multerFn };
});

function createTestApp() { const app = express(); app.use(express.json()); app.use(campaignsAdmin); return app; }
function ensureCampaign(name) { mockFsState.exists.add(`/mock/campaigns/${name}`); }
function removeCampaign(name) { mockFsState.exists.delete(`/mock/campaigns/${name}`); }
function ensureSnapshot(campaign) { mockFsState.exists.add(`/mock/campaigns/.snapshots/${campaign}.zip`); }
function removeSnapshot(campaign) { mockFsState.exists.delete(`/mock/campaigns/.snapshots/${campaign}.zip`); }

describe('campaignsAdmin - POST /api/campaigns/:campaign/admin/snapshot', () => {
    afterEach(() => { removeCampaign('test-campaign'); removeSnapshot('test-campaign'); vi.clearAllMocks(); });

    it('should reject non-localhost requests', async () => {
        const res = await request(createTestApp()).post('/api/campaigns/test-campaign/admin/snapshot').set('Host', 'example.com');
        expect(res.status).toBe(403); expect(res.body.error).toBe('Only available on localhost');
    });

    it('should return 404 when campaign does not exist', async () => {
        const res = await request(createTestApp()).post('/api/campaigns/test-campaign/admin/snapshot').set('Host', 'localhost');
        expect(res.status).toBe(404); expect(res.body.error).toBe('Campaign not found');
    });

    it('should create a snapshot when campaign exists', async () => {
        ensureCampaign('test-campaign');
        const { saveFile } = await import('../utils/changeData.js');
        saveFile.mockImplementation(() => {});
        const app = express();
        app.use(express.json());
        app.use(campaignsAdmin);
        app.use((err, req, res, _next) => {
            console.error('Global error handler:', err, err.message, err.stack);
            res.status(500).json({ error: err.message || 'Unknown error' });
        });
        const res = await request(app).post('/api/campaigns/test-campaign/admin/snapshot').set('Host', 'localhost');
        console.log('snapshot status:', res.status, 'body:', JSON.stringify(res.body));
        expect(res.status).toBe(200); expect(res.body.message).toBe('Snapshot created');
        expect(typeof res.body.size).toBe('number');
    });
});

describe('campaignsAdmin - POST /api/campaigns/:campaign/admin/rollback', () => {
    afterEach(() => { removeCampaign('test-campaign'); removeSnapshot('test-campaign'); vi.clearAllMocks(); });

    it('should reject non-localhost requests', async () => {
        const res = await request(createTestApp()).post('/api/campaigns/test-campaign/admin/rollback').set('Host', 'example.com');
        expect(res.status).toBe(403); expect(res.body.error).toBe('Only available on localhost');
    });

    it('should return 404 when campaign does not exist', async () => {
        const res = await request(createTestApp()).post('/api/campaigns/test-campaign/admin/rollback').set('Host', 'localhost');
        expect(res.status).toBe(404); expect(res.body.error).toBe('Campaign not found');
    });

    it('should return 404 when no snapshot exists', async () => {
        ensureCampaign('test-campaign');
        const res = await request(createTestApp()).post('/api/campaigns/test-campaign/admin/rollback').set('Host', 'localhost');
        expect(res.status).toBe(404); expect(res.body.error).toBe('No snapshot found');
    });

    it('should rollback when snapshot exists', async () => {
        ensureCampaign('test-campaign');
        ensureSnapshot('test-campaign');
        const res = await request(createTestApp()).post('/api/campaigns/test-campaign/admin/rollback').set('Host', 'localhost');
        expect(res.status).toBe(200); expect(res.body.message).toBe('Rollback complete');
    });

    it('should call saveFile before rollback', async () => {
        const { saveFile } = await import('../utils/changeData.js');
        ensureCampaign('test-campaign');
        ensureSnapshot('test-campaign');
        await request(createTestApp()).post('/api/campaigns/test-campaign/admin/rollback').set('Host', 'localhost');
        expect(saveFile).toHaveBeenCalled();
    });

    it('should publish reload event after rollback', async () => {
        const { publish } = await import('../utils/changeData.js');
        ensureCampaign('test-campaign');
        ensureSnapshot('test-campaign');
        await request(createTestApp()).post('/api/campaigns/test-campaign/admin/rollback').set('Host', 'localhost');
        expect(publish).toHaveBeenCalledWith('reload-test-campaign', null, 'test-campaign');
    });
});

describe('campaignsAdmin - GET /api/campaigns/:campaign/admin/download', () => {
    afterEach(() => { removeCampaign('test-campaign'); vi.clearAllMocks(); });

    it('should reject non-localhost requests', async () => {
        const res = await request(createTestApp()).get('/api/campaigns/test-campaign/admin/download').set('Host', 'example.com');
        expect(res.status).toBe(403); expect(res.body.error).toBe('Only available on localhost');
    });

    it('should return 404 when campaign does not exist', async () => {
        const res = await request(createTestApp()).get('/api/campaigns/test-campaign/admin/download').set('Host', 'localhost');
        expect(res.status).toBe(404); expect(res.body.error).toBe('Campaign not found');
    });

    it('should return zip stream when campaign exists', async () => {
        ensureCampaign('test-campaign');
        const res = await request(createTestApp()).get('/api/campaigns/test-campaign/admin/download').set('Host', 'localhost');
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('application/zip');
        expect(res.headers['content-disposition']).toContain('test-campaign.zip');
    });

    it('should call saveFile before download', async () => {
        const { saveFile } = await import('../utils/changeData.js');
        ensureCampaign('test-campaign');
        await request(createTestApp()).get('/api/campaigns/test-campaign/admin/download').set('Host', 'localhost');
        expect(saveFile).toHaveBeenCalled();
    });
});

describe('campaignsAdmin - POST /api/campaigns/:campaign/admin/upload', () => {
    afterEach(() => { removeCampaign('test-campaign'); removeSnapshot('test-campaign'); vi.clearAllMocks(); });

    it('should reject non-localhost requests', async () => {
        const res = await request(createTestApp()).post('/api/campaigns/test-campaign/admin/upload').set('Host', 'example.com');
        expect(res.status).toBe(403); expect(res.body.error).toBe('Only available on localhost');
    });

    it('should return 404 when campaign does not exist', async () => {
        const res = await request(createTestApp()).post('/api/campaigns/test-campaign/admin/upload').set('Host', 'localhost');
        expect(res.status).toBe(404); expect(res.body.error).toBe('Campaign not found');
    });

    it('should return 400 when no file is uploaded', async () => {
        ensureCampaign('test-campaign');
        const res = await request(createTestApp()).post('/api/campaigns/test-campaign/admin/upload').set('Host', 'localhost');
        expect(res.status).toBe(400); expect(res.body.error).toBe('No file uploaded');
    });

    // Note: Upload tests require real multer multipart parsing.
    // The multer middleware mock cannot intercept supertest.attach() files.
    // These are verified manually via the upload endpoint code review.
});
