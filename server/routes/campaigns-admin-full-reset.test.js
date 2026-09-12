import { request } from '../test-utils/localhostSupertest.js';
import express from 'express';
import campaignsAdmin from './campaigns-admin.js';
import path from 'path';

const mockFsState = { exists: new Set(), files: new Map(), readdir: new Map(), mkdir: new Map() };

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
function getChangeDataPath(campaign) { return path.join(process.cwd(), 'public', 'campaigns', campaign, 'data', 'character-change-data.json'); }

describe('campaignsAdmin - POST /api/campaigns/:campaign/admin/full-reset', () => {
    afterEach(() => {
        removeCampaign('test-campaign');
        const changeDataPath = getChangeDataPath('test-campaign');
        mockFsState.exists.delete(changeDataPath);
        vi.clearAllMocks();
    });

    it('should reject non-localhost requests', async () => {
        const res = await request(createTestApp()).post('/api/campaigns/test-campaign/admin/full-reset').set('Host', 'example.com');
        expect(res.status).toBe(403); expect(res.body.error).toBe('Only available on localhost');
    });

    it('should clear change data file and maps', async () => {
        ensureCampaign('test-campaign');
        const changeDataPath = getChangeDataPath('test-campaign');
        mockFsState.exists.add(changeDataPath);
        mockFsState.files.set(changeDataPath, '{}');
        const { characterChangeData, spellOverlayData, activeMaps } = await import('../utils/changeData.js');
        characterChangeData.set('test-campaign', { key: 'value' });
        spellOverlayData.set('test-campaign', []);
        activeMaps.set('test-campaign', 'map1');
        const res = await request(createTestApp()).post('/api/campaigns/test-campaign/admin/full-reset').set('Host', 'localhost');
        expect(res.status).toBe(200); expect(res.body.message).toBe('Full reset complete');
        expect(mockFsState.files.has(changeDataPath)).toBe(false);
        expect(characterChangeData.has('test-campaign')).toBe(false);
        expect(spellOverlayData.has('test-campaign')).toBe(false);
        expect(activeMaps.has('test-campaign')).toBe(false);
    });

    it('should clear log file and cache', async () => {
        ensureCampaign('test-campaign');
        const logPath = `/mock/campaigns/test-campaign/data/campaign-log.json`;
        mockFsState.exists.add(logPath);
        mockFsState.files.set(logPath, '[]');
        const { logCache } = await import('./log.js');
        logCache.set('test-campaign', [{ timestamp: Date.now(), message: 'test' }]);
        const res = await request(createTestApp()).post('/api/campaigns/test-campaign/admin/full-reset').set('Host', 'localhost');
        expect(res.status).toBe(200); expect(res.body.message).toBe('Full reset complete');
        expect(mockFsState.files.has(logPath)).toBe(false);
        expect(logCache.has('test-campaign')).toBe(false);
    });

    it('should publish SSE events for both change data and log', async () => {
        ensureCampaign('test-campaign');
        const { publish } = await import('../utils/changeData.js');
        await request(createTestApp()).post('/api/campaigns/test-campaign/admin/full-reset').set('Host', 'localhost');
        expect(publish).toHaveBeenCalledWith('change-test-campaign-combatSummary', null, 'test-campaign');
        expect(publish).toHaveBeenCalledWith('log-test-campaign', null, 'test-campaign');
    });

    it('should succeed even if change data file does not exist', async () => {
        ensureCampaign('test-campaign');
        const res = await request(createTestApp()).post('/api/campaigns/test-campaign/admin/full-reset').set('Host', 'localhost');
        expect(res.status).toBe(200); expect(res.body.message).toBe('Full reset complete');
    });

    it('should return 500 on change data filesystem error', async () => {
        ensureCampaign('test-campaign');
        const changeDataPath = getChangeDataPath('test-campaign');
        const fsMock = await import('fs');
        mockFsState.exists.add(changeDataPath);
        fsMock.default.unlinkSync = () => { throw new Error('Permission denied'); };
        const res = await request(createTestApp()).post('/api/campaigns/test-campaign/admin/full-reset').set('Host', 'localhost');
        expect(res.status).toBe(500); expect(res.body.error).toBe('Failed to clear change data');
    });

    it('should return 500 on log filesystem error', async () => {
        ensureCampaign('test-campaign');
        const logPath = `/mock/campaigns/test-campaign/data/campaign-log.json`;
        mockFsState.exists.add(logPath);
        const fsMock = await import('fs');
        const orig = fsMock.default.unlinkSync;
        fsMock.default.unlinkSync = (p) => { if (p === logPath) throw new Error('Permission denied'); return orig(p); };
        const res = await request(createTestApp()).post('/api/campaigns/test-campaign/admin/full-reset').set('Host', 'localhost');
        fsMock.default.unlinkSync = orig;
        expect(res.status).toBe(500); expect(res.body.error).toBe('Failed to clear log');
    });
});
