import { request } from '../test-utils/localhostSupertest.js';
import express from 'express';
import fs from 'fs';
import campaignsAdmin from './campaigns-admin.js';

// Regression for bug-migrate-image-paths-ungated-dead-route (owner decision
// 2026-10-28: delete). POST /api/campaigns/migrate-image-paths was a completed
// one-time migration with zero client callers and no isLocalhost gate — in an
// isolated mount of this router a foreign Host got a 200 and the bulk-rewrite
// body executed across EVERY campaign. The endpoint is now deleted; these
// cases pin that it stays gone (404 for any Host, zero filesystem activity)
// while the sibling admin lanes keep enforcing the host gate.

const mockFsState = { exists: new Set(), files: new Map(), readdir: new Map() };

// Mirrors campaigns-admin-crud-localhost-guard.test.js: vi.mock factories are
// hoisted so the fs mock must be spelled out inline (default + named).
vi.mock('fs', () => {
    const impl = {
        existsSync: vi.fn((path) => mockFsState.exists.has(path)),
        mkdirSync: vi.fn((p) => { mockFsState.exists.add(p); }),
        renameSync: vi.fn((oldPath, newPath) => { if (mockFsState.exists.has(oldPath)) mockFsState.exists.delete(oldPath); mockFsState.exists.add(newPath); }),
        rmSync: vi.fn((p) => { mockFsState.exists.delete(p); }),
        writeFileSync: vi.fn((p, data) => { mockFsState.files.set(p, data); }),
        readdirSync: vi.fn((p) => { const entries = mockFsState.readdir.get(p); if (entries === undefined) throw new Error('ENOENT'); return entries; }),
        readFileSync: vi.fn((p) => { if (mockFsState.files.has(p)) return mockFsState.files.get(p); throw new Error('ENOENT'); }),
        unlinkSync: vi.fn((p) => { mockFsState.files.delete(p); mockFsState.exists.delete(p); }),
        statSync: vi.fn(() => ({ isDirectory: () => true })),
    };
    return { default: impl, ...impl };
});

vi.mock('../utils/campaignPaths.js', () => ({
    campaignDir: (name) => `/mock/campaigns/${name}`,
    campaignMapsDir: (name) => `/mock/campaigns/${name}/maps`,
    campaignImagesDir: (name) => `/mock/campaigns/${name}/images`,
    campaignDataDir: (name) => `/mock/campaigns/${name}/data`,
    campaignDataFile: (campaign, fileName) => `/mock/campaigns/${campaign}/data/${fileName}`,
    campaignSnapshotDir: () => '/mock/campaigns/.snapshots',
    campaignSnapshotFile: (campaign) => `/mock/campaigns/.snapshots/${campaign}.zip`,
    snapshotTimestamp: () => '0000-00-00T00-00-00-000',
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
vi.mock('archiver', () => ({ default: { ZipArchive: vi.fn().mockImplementation(() => ({ on: vi.fn().mockReturnThis(), pipe: vi.fn().mockReturnThis(), directory: vi.fn().mockReturnThis(), finalize: vi.fn(), abort: vi.fn() })) } }));
vi.mock('extract-zip', () => ({ default: vi.fn().mockResolvedValue(undefined) }));
vi.mock('multer', () => {
    const multerInstance = { single: vi.fn(() => (req, res, next) => next()), array: vi.fn(() => (req, res, next) => next()), fields: vi.fn(() => (req, res, next) => next()) };
    const multerFn = Object.assign(function multer() { return multerInstance; }, { memoryStorage: () => ({}), diskStorage: () => ({}) });
    return { default: multerFn };
});

const FOREIGN_HOST = '100.92.171.80';

function createTestApp() { const app = express(); app.use(express.json()); app.use(campaignsAdmin); return app; }
function ensureCampaign(name) { mockFsState.exists.add(`/mock/campaigns/${name}`); }
function removeCampaign(name) { mockFsState.exists.delete(`/mock/campaigns/${name}`); }

afterEach(() => {
    removeCampaign('test-campaign');
    vi.clearAllMocks();
});

describe('campaignsAdmin - POST /api/campaigns/migrate-image-paths (deleted endpoint)', () => {
    it('should 404 for localhost — the legacy route no longer exists', async () => {
        const res = await request(createTestApp()).post('/api/campaigns/migrate-image-paths').set('Host', 'localhost');
        expect(res.status).toBe(404);
        expect(fs.readdirSync).not.toHaveBeenCalled();
        expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('should 404 for a non-localhost host — the ungated bulk-rewrite lane is gone', async () => {
        // Pre-fix this was the authority gap: foreign Host got 200 and the
        // migration body ran. It must never come back.
        const res = await request(createTestApp()).post('/api/campaigns/migrate-image-paths').set('Host', FOREIGN_HOST);
        expect(res.status).toBe(404);
        expect(fs.readdirSync).not.toHaveBeenCalled();
        expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('should still reject non-localhost requests on the sibling admin lane', async () => {
        const res = await request(createTestApp()).post('/api/campaigns/test-campaign/admin/clear-change-data').set('Host', FOREIGN_HOST);
        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Only available on localhost');
        expect(fs.unlinkSync).not.toHaveBeenCalled();
    });

    it('should still serve localhost on the sibling admin lane', async () => {
        ensureCampaign('test-campaign');
        const res = await request(createTestApp()).get('/api/campaigns/test-campaign/admin/snapshots').set('Host', 'localhost');
        expect(res.status).toBe(200);
        expect(res.body.snapshots).toEqual([]);
    });
});
