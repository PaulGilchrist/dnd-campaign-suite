import { request } from '../test-utils/localhostSupertest.js';
import express from 'express';
import campaignsAdmin from './campaigns-admin.js';

const mockFsState = { exists: new Set(), files: new Map(), mkdir: new Map(), readdir: new Map(), stats: new Map() };

function mockCreateWriteStream(p) {
    mockFsState.exists.add(p);
    const dir = p.slice(0, p.lastIndexOf('/'));
    const names = mockFsState.readdir.get(dir) || [];
    const name = p.slice(p.lastIndexOf('/') + 1);
    if (!names.includes(name)) {
        mockFsState.readdir.set(dir, [...names, name]);
        mockFsState.stats.set(p, { size: 1024, mtime: new Date() });
    }
    return { on: vi.fn(), write: () => {}, end: () => {}, bytesWritten: 1024 };
}

function mockStat(p) {
    const s = mockFsState.stats.get(p) || {};
    return { isDirectory: () => true, size: s.size ?? 1024, mtime: s.mtime ?? new Date('2026-01-01T00:00:00.000Z') };
}

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
        createWriteStream: vi.fn((p) => mockCreateWriteStream(p)),
        statSync: vi.fn((p) => mockStat(p)),
    },
    existsSync: vi.fn((p) => mockFsState.exists.has(p)),
    mkdirSync: vi.fn((p) => { mockFsState.exists.add(p); mockFsState.mkdir.set(p, true); }),
    renameSync: vi.fn((oldPath, newPath) => { if (mockFsState.exists.has(oldPath)) mockFsState.exists.delete(oldPath); mockFsState.exists.add(newPath); }),
    rmSync: vi.fn((p) => { mockFsState.exists.delete(p); }),
    writeFileSync: vi.fn((p, data) => { mockFsState.files.set(p, data); }),
    readdirSync: vi.fn((p) => { const entries = mockFsState.readdir.get(p); if (entries === undefined) throw new Error('ENOENT'); return entries; }),
    readFileSync: vi.fn((p) => { if (mockFsState.files.has(p)) return mockFsState.files.get(p); throw new Error('ENOENT'); }),
    unlinkSync: vi.fn((p) => { mockFsState.files.delete(p); mockFsState.exists.delete(p); }),
    createWriteStream: vi.fn((p) => mockCreateWriteStream(p)),
    statSync: vi.fn((p) => mockStat(p)),
}));

vi.mock('../utils/campaignPaths.js', () => {
    let seq = 0;
    return {
        campaignDir: (name) => `/mock/campaigns/${name}`,
        campaignMapsDir: (name) => `/mock/campaigns/${name}/maps`,
        campaignImagesDir: (name) => `/mock/campaigns/${name}/images`,
        campaignDataDir: (name) => `/mock/campaigns/${name}/data`,
        campaignDataFile: (campaign, fileName) => `/mock/campaigns/${campaign}/data/${fileName}`,
        campaignSnapshotDir: () => '/mock/campaigns/.snapshots',
        campaignSnapshotFile: (campaign) => `/mock/campaigns/.snapshots/${campaign}.zip`,
        snapshotTimestamp: () => {
            seq += 1000;
            return new Date(1760000000000 + seq).toISOString().slice(0, 23).replace(/[:.]/g, '-');
        },
        campaignTimestampedSnapshotFile: (campaign, timestamp) => `/mock/campaigns/.snapshots/${campaign}-${timestamp}.zip`,
    };
});

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
function ensureSnapshot(campaign) { mockFsState.exists.add(`/mock/campaigns/.snapshots/${campaign}.zip`); setSnapshotDir([...snapshotDir(), `${campaign}.zip`]); }
function removeSnapshot(campaign) { mockFsState.exists.delete(`/mock/campaigns/.snapshots/${campaign}.zip`); }
function snapshotDir() { return mockFsState.readdir.get('/mock/campaigns/.snapshots') || []; }
function setSnapshotDir(names) { mockFsState.readdir.set('/mock/campaigns/.snapshots', names); }

describe('campaignsAdmin - POST /api/campaigns/:campaign/admin/snapshot', () => {
    beforeEach(() => { setSnapshotDir([]); });
    afterEach(() => { removeCampaign('test-campaign'); removeSnapshot('test-campaign'); setSnapshotDir([]); vi.clearAllMocks(); });

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
        const res = await request(createTestApp()).post('/api/campaigns/test-campaign/admin/snapshot').set('Host', 'localhost');
        expect(res.status).toBe(200); expect(res.body.message).toBe('Snapshot created');
        expect(typeof res.body.size).toBe('number');
    });

    it('should return a timestamped filename', async () => {
        ensureCampaign('test-campaign');
        const res = await request(createTestApp()).post('/api/campaigns/test-campaign/admin/snapshot').set('Host', 'localhost');
        expect(res.status).toBe(200);
        expect(res.body.filename).toMatch(/^test-campaign-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}\.zip$/);
    });

    it('should never overwrite existing snapshots — repeated snapshots get unique names', async () => {
        ensureCampaign('test-campaign');
        const first = await request(createTestApp()).post('/api/campaigns/test-campaign/admin/snapshot').set('Host', 'localhost');
        const second = await request(createTestApp()).post('/api/campaigns/test-campaign/admin/snapshot').set('Host', 'localhost');
        expect(first.status).toBe(200); expect(second.status).toBe(200);
        expect(second.body.filename).not.toBe(first.body.filename);
    });

    it('should prune snapshots beyond the 10 newest after creating one', async () => {
        ensureCampaign('test-campaign');
        // Mock fs defaults statSync mtime to 2026-01-01 (the newly created snapshot);
        // existing snapshots are all older (Dec 2025), oldest two must be pruned.
        const existing = [];
        for (let i = 1; i <= 11; i += 1) {
            const name = `test-campaign-2025-12-${String(i).padStart(2, '0')}T00-00-00-000.zip`;
            existing.push(name);
            mockFsState.stats.set(`/mock/campaigns/.snapshots/${name}`, { size: 100, mtime: new Date(Date.UTC(2025, 11, i)) });
        }
        setSnapshotDir(existing);
        const { default: fsMock } = await import('fs');

        const res = await request(createTestApp()).post('/api/campaigns/test-campaign/admin/snapshot').set('Host', 'localhost');
        expect(res.status).toBe(200);

        const pruned = fsMock.rmSync.mock.calls.map(([p]) => p).filter((p) => p.includes('.snapshots'));
        expect(pruned).toContain('/mock/campaigns/.snapshots/test-campaign-2025-12-01T00-00-00-000.zip');
        expect(pruned).toContain('/mock/campaigns/.snapshots/test-campaign-2025-12-02T00-00-00-000.zip');
        expect(pruned).not.toContain('/mock/campaigns/.snapshots/test-campaign-2025-12-11T00-00-00-000.zip');
        expect(pruned).toHaveLength(2);
    });
});

describe('campaignsAdmin - GET /api/campaigns/:campaign/admin/snapshots', () => {
    beforeEach(() => { setSnapshotDir([]); });
    afterEach(() => { removeCampaign('test-campaign'); setSnapshotDir([]); mockFsState.stats.clear(); vi.clearAllMocks(); });

    it('should reject non-localhost requests', async () => {
        const res = await request(createTestApp()).get('/api/campaigns/test-campaign/admin/snapshots').set('Host', 'example.com');
        expect(res.status).toBe(403); expect(res.body.error).toBe('Only available on localhost');
    });

    it('should return 404 when campaign does not exist', async () => {
        const res = await request(createTestApp()).get('/api/campaigns/test-campaign/admin/snapshots').set('Host', 'localhost');
        expect(res.status).toBe(404); expect(res.body.error).toBe('Campaign not found');
    });

    it('should return an empty list when no snapshots exist', async () => {
        ensureCampaign('test-campaign');
        const res = await request(createTestApp()).get('/api/campaigns/test-campaign/admin/snapshots').set('Host', 'localhost');
        expect(res.status).toBe(200); expect(res.body.snapshots).toEqual([]);
    });

    it('should list snapshots newest-first with filename, size and timestamp', async () => {
        ensureCampaign('test-campaign');
        const names = ['test-campaign-2026-10-09T00-00-00-000.zip', 'test-campaign-2026-10-10T00-00-00-000.zip'];
        setSnapshotDir(names);
        mockFsState.stats.set('/mock/campaigns/.snapshots/test-campaign-2026-10-09T00-00-00-000.zip', { size: 111, mtime: new Date('2026-10-09T00:00:00.000Z') });
        mockFsState.stats.set('/mock/campaigns/.snapshots/test-campaign-2026-10-10T00-00-00-000.zip', { size: 222, mtime: new Date('2026-10-10T00:00:00.000Z') });

        const res = await request(createTestApp()).get('/api/campaigns/test-campaign/admin/snapshots').set('Host', 'localhost');
        expect(res.status).toBe(200);
        expect(res.body.snapshots).toEqual([
            { filename: 'test-campaign-2026-10-10T00-00-00-000.zip', size: 222, timestamp: '2026-10-10T00:00:00.000Z' },
            { filename: 'test-campaign-2026-10-09T00-00-00-000.zip', size: 111, timestamp: '2026-10-09T00:00:00.000Z' },
        ]);
    });

    it('should ignore other campaigns zips', async () => {
        ensureCampaign('test-campaign');
        setSnapshotDir(['other-campaign-2026-10-10T00-00-00-000.zip', 'unrelated.txt']);
        const res = await request(createTestApp()).get('/api/campaigns/test-campaign/admin/snapshots').set('Host', 'localhost');
        expect(res.status).toBe(200); expect(res.body.snapshots).toEqual([]);
    });
});

describe('campaignsAdmin - POST /api/campaigns/:campaign/admin/rollback', () => {
    beforeEach(() => { setSnapshotDir([]); });
    afterEach(() => { removeCampaign('test-campaign'); removeSnapshot('test-campaign'); setSnapshotDir([]); mockFsState.stats.clear(); vi.clearAllMocks(); });

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
        expect(res.body.restored).toBe('test-campaign.zip');
    });

    it('should restore from the NEWEST timestamped snapshot', async () => {
        ensureCampaign('test-campaign');
        const extractZip = (await import('extract-zip')).default;
        setSnapshotDir(['test-campaign-2026-10-09T00-00-00-000.zip', 'test-campaign-2026-10-10T00-00-00-000.zip']);
        mockFsState.stats.set('/mock/campaigns/.snapshots/test-campaign-2026-10-09T00-00-00-000.zip', { size: 100, mtime: new Date('2026-10-09T00:00:00.000Z') });
        mockFsState.stats.set('/mock/campaigns/.snapshots/test-campaign-2026-10-10T00-00-00-000.zip', { size: 200, mtime: new Date('2026-10-10T00:00:00.000Z') });

        const res = await request(createTestApp()).post('/api/campaigns/test-campaign/admin/rollback').set('Host', 'localhost');
        expect(res.status).toBe(200);
        expect(res.body.restored).toBe('test-campaign-2026-10-10T00-00-00-000.zip');
        expect(extractZip).toHaveBeenCalledWith('/mock/campaigns/.snapshots/test-campaign-2026-10-10T00-00-00-000.zip', { dir: '/mock/campaigns/test-campaign' });
    });

    it('should fall back to legacy <campaign>.zip when no timestamped snapshots exist', async () => {
        ensureCampaign('test-campaign');
        const extractZip = (await import('extract-zip')).default;
        ensureSnapshot('test-campaign');
        mockFsState.stats.set('/mock/campaigns/.snapshots/test-campaign.zip', { size: 300, mtime: new Date('2026-10-01T00:00:00.000Z') });

        const res = await request(createTestApp()).post('/api/campaigns/test-campaign/admin/rollback').set('Host', 'localhost');
        expect(res.status).toBe(200);
        expect(res.body.restored).toBe('test-campaign.zip');
        expect(extractZip).toHaveBeenCalledWith('/mock/campaigns/.snapshots/test-campaign.zip', { dir: '/mock/campaigns/test-campaign' });
    });

    it('should prefer newer timestamped snapshot over legacy zip', async () => {
        ensureCampaign('test-campaign');
        setSnapshotDir(['test-campaign.zip', 'test-campaign-2026-10-10T00-00-00-000.zip']);
        mockFsState.stats.set('/mock/campaigns/.snapshots/test-campaign.zip', { size: 300, mtime: new Date('2026-10-01T00:00:00.000Z') });
        mockFsState.stats.set('/mock/campaigns/.snapshots/test-campaign-2026-10-10T00-00-00-000.zip', { size: 400, mtime: new Date('2026-10-10T00:00:00.000Z') });

        const res = await request(createTestApp()).post('/api/campaigns/test-campaign/admin/rollback').set('Host', 'localhost');
        expect(res.status).toBe(200);
        expect(res.body.restored).toBe('test-campaign-2026-10-10T00-00-00-000.zip');
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
