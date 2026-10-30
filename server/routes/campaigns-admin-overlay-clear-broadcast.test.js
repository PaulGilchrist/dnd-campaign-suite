// Regression: admin wipes that delete spellOverlayData for a campaign must
// broadcast `spell-overlay-<campaign> {action:'clear'}` over SSE, exactly like
// the in-editor Clear All does (spell-overlay.js publishes every action).
// Without it, mounted map tabs keep painting ghost AoE geometry forever —
// server truth is [] but the tabs never re-probe (useSpellOverlay only
// fetches on campaign mount). Harness mirrors campaigns-admin-full-reset.test.js.
import { request } from '../test-utils/localhostSupertest.js';
import express from 'express';
import campaignsAdmin from './campaigns-admin.js';

const mockFsState = { exists: new Set(), files: new Map(), readdir: new Map(), mkdir: new Map(), stats: new Map() };

vi.mock('fs', () => ({
    default: {
        existsSync: vi.fn((p) => mockFsState.exists.has(p)),
        mkdirSync: vi.fn((p) => { mockFsState.exists.add(p); mockFsState.mkdir.set(p, true); }),
        renameSync: vi.fn((oldPath, newPath) => { if (mockFsState.exists.has(oldPath)) mockFsState.exists.delete(oldPath); mockFsState.exists.add(newPath); }),
        rmSync: vi.fn((p) => { mockFsState.exists.delete(p); }),
        writeFileSync: vi.fn((p, data) => { mockFsState.files.set(p, data); }),
        readdirSync: vi.fn((p) => { const entries = mockFsState.readdir.get(p); if (entries === undefined) return []; return entries; }),
        readFileSync: vi.fn((p) => { if (mockFsState.files.has(p)) return mockFsState.files.get(p); throw new Error('ENOENT'); }),
        unlinkSync: vi.fn((p) => { mockFsState.files.delete(p); mockFsState.exists.delete(p); }),
        createWriteStream: vi.fn(() => ({ on: vi.fn((event, cb) => { if (event === 'error') return { on: () => {} }; if (event === 'close') setTimeout(cb, 0); return {}; }), write: () => {}, end: () => {}, bytesWritten: 1024 })),
        statSync: vi.fn((p) => ({ isDirectory: () => true, size: (mockFsState.stats.get(p) || {}).size ?? 1024, mtime: (mockFsState.stats.get(p) || {}).mtime ?? new Date() })),
    },
    existsSync: vi.fn((p) => mockFsState.exists.has(p)),
    mkdirSync: vi.fn((p) => { mockFsState.exists.add(p); mockFsState.mkdir.set(p, true); }),
    renameSync: vi.fn((oldPath, newPath) => { if (mockFsState.exists.has(oldPath)) mockFsState.exists.delete(oldPath); mockFsState.exists.add(newPath); }),
    rmSync: vi.fn((p) => { mockFsState.exists.delete(p); }),
    writeFileSync: vi.fn((p, data) => { mockFsState.files.set(p, data); }),
    readdirSync: vi.fn((p) => { const entries = mockFsState.readdir.get(p); if (entries === undefined) return []; return entries; }),
    readFileSync: vi.fn((p) => { if (mockFsState.files.has(p)) return mockFsState.files.get(p); throw new Error('ENOENT'); }),
    unlinkSync: vi.fn((p) => { mockFsState.files.delete(p); mockFsState.exists.delete(p); }),
    createWriteStream: vi.fn(() => ({ on: vi.fn((event, cb) => { if (event === 'error') return { on: () => {} }; if (event === 'close') setTimeout(cb, 0); return {}; }), write: () => {}, end: () => {}, bytesWritten: 1024 })),
    statSync: vi.fn((p) => ({ isDirectory: () => true, size: (mockFsState.stats.get(p) || {}).size ?? 1024, mtime: (mockFsState.stats.get(p) || {}).mtime ?? new Date() })),
}));

vi.mock('../utils/campaignPaths.js', () => ({
    campaignDir: (name) => `/mock/campaigns/${name}`,
    campaignMapsDir: (name) => `/mock/campaigns/${name}/maps`,
    campaignImagesDir: (name) => `/mock/campaigns/${name}/images`,
    campaignDataDir: (name) => `/mock/campaigns/${name}/data`,
    campaignDataFile: (campaign, fileName) => `/mock/campaigns/${campaign}/data/${fileName}`,
    campaignSnapshotDir: () => '/mock/campaigns/.snapshots',
    campaignSnapshotFile: (campaign) => `/mock/campaigns/.snapshots/${campaign}.zip`,
    snapshotTimestamp: () => '2026-10-10T12-00-00-000',
    campaignTimestampedSnapshotFile: (campaign, timestamp) => `/mock/campaigns/.snapshots/${campaign}-${timestamp}.zip`,
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
        constructor() { this._listeners = {}; this._dest = null; }
        on(event, cb) { this._listeners[event] = cb; return this; }
        pipe(dest) { this._dest = dest; return this; }
        directory() { return this; }
        finalize() {
            setTimeout(() => {
                if (this._listeners['end']) this._listeners['end']();
                if (this._dest && typeof this._dest.end === 'function') this._dest.end();
            }, 0);
        }
        abort() {}
    }
    return { ZipArchive: MockZipArchive, default: { ZipArchive: MockZipArchive } };
});
vi.mock('extract-zip', () => ({ default: vi.fn().mockResolvedValue(undefined) }));
vi.mock('multer', () => {
    const multerInstance = { single: vi.fn(() => (req, res, next) => next()), array: vi.fn(() => (req, res, next) => next()), fields: vi.fn(() => (req, res, next) => next()) };
    const multerFn = Object.assign(function multer() { return multerInstance; }, { memoryStorage: () => ({}), diskStorage: () => ({}) });
    return { default: multerFn };
});

function createTestApp() { const app = express(); app.use(express.json()); app.use(campaignsAdmin); return app; }
function ensureCampaign(name) { mockFsState.exists.add(`/mock/campaigns/${name}`); }
function removeCampaign(name) { mockFsState.exists.delete(`/mock/campaigns/${name}`); }

describe('campaignsAdmin - overlay clear broadcast on every spellOverlayData wipe', () => {
    afterEach(() => {
        removeCampaign('test-campaign');
        vi.clearAllMocks();
    });

    it('clear-change-data publishes spell-overlay clear so mounted tabs retire ghost geometry', async () => {
        ensureCampaign('test-campaign');
        const { publish, spellOverlayData } = await import('../utils/changeData.js');
        spellOverlayData.set('test-campaign', [{ id: 'ghost-1', shape: 'cone' }]);
        const res = await request(createTestApp()).post('/api/campaigns/test-campaign/admin/clear-change-data').set('Host', 'localhost');
        expect(res.status).toBe(200);
        expect(spellOverlayData.has('test-campaign')).toBe(false);
        expect(publish).toHaveBeenCalledWith('spell-overlay-test-campaign', { action: 'clear' }, 'test-campaign');
    });

    it('full-reset publishes spell-overlay clear', async () => {
        ensureCampaign('test-campaign');
        const { publish, spellOverlayData } = await import('../utils/changeData.js');
        spellOverlayData.set('test-campaign', [{ id: 'ghost-1', shape: 'cone' }]);
        const res = await request(createTestApp()).post('/api/campaigns/test-campaign/admin/full-reset').set('Host', 'localhost');
        expect(res.status).toBe(200);
        expect(spellOverlayData.has('test-campaign')).toBe(false);
        expect(publish).toHaveBeenCalledWith('spell-overlay-test-campaign', { action: 'clear' }, 'test-campaign');
    });

    it('campaign delete publishes spell-overlay clear', async () => {
        ensureCampaign('test-campaign');
        const { publish, spellOverlayData } = await import('../utils/changeData.js');
        spellOverlayData.set('test-campaign', [{ id: 'ghost-1', shape: 'cone' }]);
        const res = await request(createTestApp()).delete('/api/campaigns/test-campaign').set('Host', 'localhost');
        expect(res.status).toBe(200);
        expect(spellOverlayData.has('test-campaign')).toBe(false);
        expect(publish).toHaveBeenCalledWith('spell-overlay-test-campaign', { action: 'clear' }, 'test-campaign');
    });
});
