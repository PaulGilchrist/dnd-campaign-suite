import { request } from '../test-utils/localhostSupertest.js';
import express from 'express';
import campaignsAdmin from './campaigns-admin.js';

const mockFsState = { exists: new Set(), files: new Map(), readdir: new Map() };

vi.mock('fs', () => ({
    default: {
        existsSync: vi.fn((p) => mockFsState.exists.has(p)),
        mkdirSync: vi.fn((p) => { mockFsState.exists.add(p); }),
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
    mkdirSync: vi.fn((p) => { mockFsState.exists.add(p); }),
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
vi.mock('archiver', () => ({ default: { ZipArchive: vi.fn().mockImplementation(() => ({ on: vi.fn().mockReturnThis(), pipe: vi.fn().mockReturnThis(), directory: vi.fn().mockReturnThis(), finalize: vi.fn(), abort: vi.fn() })) } }));
vi.mock('extract-zip', () => ({ default: vi.fn().mockResolvedValue(undefined) }));
vi.mock('multer', () => {
    const multerInstance = { single: vi.fn(() => (req, res, next) => next()), array: vi.fn(() => (req, res, next) => next()), fields: vi.fn(() => (req, res, next) => next()) };
    const multerFn = Object.assign(function multer() { return multerInstance; }, { memoryStorage: () => ({}), diskStorage: () => ({}) });
    return { default: multerFn };
});

function createTestApp() { const app = express(); app.use(express.json()); app.use(campaignsAdmin); return app; }
function ensureCampaign(name) { mockFsState.exists.add(`/mock/campaigns/${name}`); }
function removeCampaign(name) { mockFsState.exists.delete(`/mock/campaigns/${name}`); }
function getLogPath(campaign) { return `/mock/campaigns/${campaign}/data/campaign-log.json`; }

describe('campaignsAdmin - POST /api/campaigns/:campaign/admin/clear-log', () => {
    afterEach(() => { removeCampaign('test-campaign'); vi.clearAllMocks(); });

    it('should reject non-localhost requests', async () => {
        const res = await request(createTestApp()).post('/api/campaigns/test-campaign/admin/clear-log').set('Host', 'example.com');
        expect(res.status).toBe(403); expect(res.body.error).toBe('Only available on localhost');
    });

    it('should delete the log file if it exists', async () => {
        ensureCampaign('test-campaign');
        const logPath = getLogPath('test-campaign');
        mockFsState.exists.add(logPath);
        mockFsState.files.set(logPath, '[]');
        const res = await request(createTestApp()).post('/api/campaigns/test-campaign/admin/clear-log').set('Host', 'localhost');
        expect(res.status).toBe(200); expect(res.body.message).toBe('Campaign log cleared');
        expect(mockFsState.files.has(logPath)).toBe(false);
    });

    it('should succeed even if log file does not exist', async () => {
        ensureCampaign('test-campaign');
        const res = await request(createTestApp()).post('/api/campaigns/test-campaign/admin/clear-log').set('Host', 'localhost');
        expect(res.status).toBe(200); expect(res.body.message).toBe('Campaign log cleared');
    });

    it('should delete from logCache', async () => {
        const { logCache } = await import('./log.js');
        ensureCampaign('test-campaign');
        logCache.set('test-campaign', [{ timestamp: Date.now(), message: 'test' }]);
        expect(logCache.has('test-campaign')).toBe(true);
        await request(createTestApp()).post('/api/campaigns/test-campaign/admin/clear-log').set('Host', 'localhost');
        expect(logCache.has('test-campaign')).toBe(false);
    });

    it('should publish SSE event for log', async () => {
        const { publish } = await import('../utils/changeData.js');
        ensureCampaign('test-campaign');
        await request(createTestApp()).post('/api/campaigns/test-campaign/admin/clear-log').set('Host', 'localhost');
        expect(publish).toHaveBeenCalledWith('log-test-campaign', null, 'test-campaign');
    });

    it('should return 500 on filesystem error', async () => {
        ensureCampaign('test-campaign');
        const logPath = getLogPath('test-campaign');
        const fsMock = await import('fs');
        mockFsState.exists.add(logPath);
        fsMock.default.unlinkSync = () => { throw new Error('Permission denied'); };
        const res = await request(createTestApp()).post('/api/campaigns/test-campaign/admin/clear-log').set('Host', 'localhost');
        expect(res.status).toBe(500); expect(res.body.error).toBe('Failed to delete log file');
    });
});
