import { request } from '../test-utils/localhostSupertest.js';
import express from 'express';
import fs from 'fs';
import campaignsAdmin from './campaigns-admin.js';

// Regression for bug-campaign-crud-unauthorized-lan: POST /api/campaigns
// (create), PUT /api/campaigns/:campaign (rename → fs.renameSync), and
// DELETE /api/campaigns/:campaign (fs.rmSync recursive) executed their
// route bodies for ANY client while every admin sibling enforced the
// isLocalhost host gate. These cases pin the 403 gate + disk-inertness for
// non-localhost Hosts and prove localhost still passes.

const mockFsState = { exists: new Set(), files: new Map(), readdir: new Map() };

// Mirrors campaigns-admin-clear-changedata.test.js: vi.mock factories are
// hoisted so the fs mock must be spelled out inline (twice — default + named).
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
    ['test-campaign', 'lan-create', 'old-campaign', 'new-campaign', 'delete-target'].forEach(removeCampaign);
    vi.clearAllMocks();
});

describe('campaignsAdmin - campaign CRUD localhost guard (POST/PUT/DELETE /api/campaigns)', () => {
    describe('POST /api/campaigns (create)', () => {
        it('should reject non-localhost requests without touching the disk', async () => {
            const res = await request(createTestApp()).post('/api/campaigns').set('Host', FOREIGN_HOST).send({ campaignName: 'lan-create' });
            expect(res.status).toBe(403);
            expect(res.body.error).toBe('Only available on localhost');
            expect(fs.mkdirSync).not.toHaveBeenCalled();
            expect(mockFsState.exists.has('/mock/campaigns/lan-create')).toBe(false);
        });

        it('should still allow localhost to create a campaign', async () => {
            const res = await request(createTestApp()).post('/api/campaigns').set('Host', 'localhost').send({ campaignName: 'test-campaign' });
            expect(res.status).toBe(201);
            expect(res.body.message).toBe('Campaign created successfully');
            expect(mockFsState.exists.has('/mock/campaigns/test-campaign')).toBe(true);
        });
    });

    describe('PUT /api/campaigns/:campaign (rename)', () => {
        it('should reject non-localhost requests even for an existing campaign, without renaming', async () => {
            ensureCampaign('old-campaign');
            const res = await request(createTestApp()).put('/api/campaigns/old-campaign').set('Host', FOREIGN_HOST).send({ newName: 'new-campaign' });
            expect(res.status).toBe(403);
            expect(res.body.error).toBe('Only available on localhost');
            expect(fs.renameSync).not.toHaveBeenCalled();
            expect(mockFsState.exists.has('/mock/campaigns/old-campaign')).toBe(true);
            expect(mockFsState.exists.has('/mock/campaigns/new-campaign')).toBe(false);
        });

        it('should still allow localhost to rename an existing campaign', async () => {
            ensureCampaign('old-campaign');
            const res = await request(createTestApp()).put('/api/campaigns/old-campaign').set('Host', 'localhost').send({ newName: 'new-campaign' });
            expect(res.status).toBe(200);
            expect(res.body.message).toBe('Campaign renamed successfully');
            expect(mockFsState.exists.has('/mock/campaigns/new-campaign')).toBe(true);
        });
    });

    describe('DELETE /api/campaigns/:campaign (recursive destroy)', () => {
        it('should reject non-localhost requests even for an existing campaign, without deleting', async () => {
            ensureCampaign('delete-target');
            const res = await request(createTestApp()).delete('/api/campaigns/delete-target').set('Host', FOREIGN_HOST);
            expect(res.status).toBe(403);
            expect(res.body.error).toBe('Only available on localhost');
            expect(fs.rmSync).not.toHaveBeenCalled();
            expect(mockFsState.exists.has('/mock/campaigns/delete-target')).toBe(true);
        });

        it('should still allow localhost to delete an existing campaign', async () => {
            ensureCampaign('delete-target');
            const res = await request(createTestApp()).delete('/api/campaigns/delete-target').set('Host', 'localhost');
            expect(res.status).toBe(200);
            expect(res.body.message).toBe('Campaign deleted successfully');
            expect(mockFsState.exists.has('/mock/campaigns/delete-target')).toBe(false);
        });
    });
});
