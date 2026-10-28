// @maintained-by-ai
/**
 * Rollback snapshot SELECTION: POST /admin/rollback widened with an optional
 * { filename } body. Mirrors the mocked-fs rig of
 * campaigns-admin-snapshots.test.js. Covers: the legacy no-body newest-first
 * lane (exact prior behavior), exact older-snapshot restore, and the strict
 * disk-inert rejections (unsafe name → 400, well-formed but unlisted → 404)
 * with assertions that rmSync/extract-zip/saveFile never ran. Foreign-Host
 * 403 is gated before any work.
 */
import { request } from '../test-utils/localhostSupertest.js';
import express from 'express';
import campaignsAdmin from './campaigns-admin.js';

const mockFsState = { exists: new Set(), files: new Map(), mkdir: new Map(), readdir: new Map(), stats: new Map() };

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
        createWriteStream: vi.fn((p) => { mockFsState.exists.add(p); return { on: vi.fn(), write: () => {}, end: () => {}, bytesWritten: 1024 }; }),
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
    createWriteStream: vi.fn((p) => { mockFsState.exists.add(p); return { on: vi.fn(), write: () => {}, end: () => {}, bytesWritten: 1024 }; }),
    statSync: vi.fn((p) => mockStat(p)),
}));

vi.mock('../utils/campaignPaths.js', () => ({
    campaignDir: (name) => `/mock/campaigns/${name}`,
    campaignMapsDir: (name) => `/mock/campaigns/${name}/maps`,
    campaignImagesDir: (name) => `/mock/campaigns/${name}/images`,
    campaignDataDir: (name) => `/mock/campaigns/${name}/data`,
    campaignDataFile: (campaign, fileName) => `/mock/campaigns/${campaign}/data/${fileName}`,
    campaignSnapshotDir: () => '/mock/campaigns/.snapshots',
    campaignSnapshotFile: (campaign) => `/mock/campaigns/.snapshots/${campaign}.zip`,
    snapshotTimestamp: () => '2026-01-01T00-00-00-000',
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
        constructor() { this.bytesWritten = 1024; this._listeners = {}; this._dest = null; }
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
    return { ZipArchive: MockZipArchive, default: { ZipArchive: MockZipArchive } };
});
vi.mock('extract-zip', () => ({ default: vi.fn().mockResolvedValue(undefined) }));
vi.mock('multer', () => {
    const multerInstance = {
        single: vi.fn((field) => (req, res, next) => {
            if (req._multerFile) req.file = { buffer: req._multerFile, field, originalname: 'test.zip' };
            next();
        }),
        array: vi.fn(() => (req, res, next) => next()),
        fields: vi.fn(() => (req, res, next) => next()),
    };
    const multerFn = Object.assign(function multer() { return multerInstance; }, { memoryStorage: () => ({}), diskStorage: () => ({}) });
    return { default: multerFn };
});

const SNAP_DIR = '/mock/campaigns/.snapshots';
const CAMPAIGN_PATH = '/mock/campaigns/test-campaign';

function createTestApp() { const app = express(); app.use(express.json()); app.use(campaignsAdmin); return app; }
function snapshotDir() { return mockFsState.readdir.get(SNAP_DIR) || []; }
function setSnapshotDir(names) { mockFsState.readdir.set(SNAP_DIR, names); mockFsState.exists.add(SNAP_DIR); for (const n of names) mockFsState.exists.add(`${SNAP_DIR}/${n}`); }

// Two timestamped snapshots (older + newest) and the legacy zip, all listed.
function seedThreeSnapshots() {
    mockFsState.exists.add(CAMPAIGN_PATH);
    setSnapshotDir([
        'test-campaign-2026-10-08T00-00-00-000.zip',
        'test-campaign-2026-10-09T00-00-00-000.zip',
        'test-campaign.zip',
    ]);
    mockFsState.stats.set(`${SNAP_DIR}/test-campaign-2026-10-08T00-00-00-000.zip`, { size: 100, mtime: new Date('2026-10-08T00:00:00.000Z') });
    mockFsState.stats.set(`${SNAP_DIR}/test-campaign-2026-10-09T00-00-00-000.zip`, { size: 200, mtime: new Date('2026-10-09T00:00:00.000Z') });
    mockFsState.stats.set(`${SNAP_DIR}/test-campaign.zip`, { size: 50, mtime: new Date('2026-10-01T00:00:00.000Z') });
}

async function postRollback(body, host = 'localhost') {
    const call = request(createTestApp()).post('/api/campaigns/test-campaign/admin/rollback').set('Host', host);
    if (body !== undefined) call.send(body).set('Content-Type', 'application/json');
    return call;
}

async function diskInertAssertions() {
    const fsMock = (await import('fs')).default;
    const extractZip = (await import('extract-zip')).default;
    const { saveFile } = await import('../utils/changeData.js');
    expect(extractZip).not.toHaveBeenCalled();
    expect(saveFile).not.toHaveBeenCalled();
    // No rmSync against the campaign dir or the snapshot dir.
    const removals = fsMock.rmSync.mock.calls.map(([p]) => p);
    expect(removals.filter((p) => String(p).startsWith('/mock/campaigns'))).toHaveLength(0);
    // Snapshot list untouched.
    expect(snapshotDir()).toHaveLength(3);
    expect(mockFsState.exists.has(CAMPAIGN_PATH)).toBe(true);
}

describe('POST /admin/rollback with { filename } selection', () => {
    beforeEach(() => { setSnapshotDir([]); });
    afterEach(() => { mockFsState.exists.delete(CAMPAIGN_PATH); setSnapshotDir([]); mockFsState.stats.clear(); vi.clearAllMocks(); });

    it('keeps the legacy newest-first lane when no body is sent', async () => {
        seedThreeSnapshots();
        const extractZip = (await import('extract-zip')).default;
        const res = await postRollback(undefined);
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ message: 'Rollback complete', restored: 'test-campaign-2026-10-09T00-00-00-000.zip' });
        expect(extractZip).toHaveBeenCalledWith(`${SNAP_DIR}/test-campaign-2026-10-09T00-00-00-000.zip`, { dir: CAMPAIGN_PATH });
    });

    it('treats an empty body object as the legacy lane too', async () => {
        seedThreeSnapshots();
        const res = await postRollback({});
        expect(res.status).toBe(200);
        expect(res.body.restored).toBe('test-campaign-2026-10-09T00-00-00-000.zip');
    });

    it('restores EXACTLY the named older snapshot (not the newest)', async () => {
        seedThreeSnapshots();
        const extractZip = (await import('extract-zip')).default;
        const { publish } = await import('../utils/changeData.js');
        const res = await postRollback({ filename: 'test-campaign-2026-10-08T00-00-00-000.zip' });
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ message: 'Rollback complete', restored: 'test-campaign-2026-10-08T00-00-00-000.zip' });
        expect(extractZip).toHaveBeenCalledWith(`${SNAP_DIR}/test-campaign-2026-10-08T00-00-00-000.zip`, { dir: CAMPAIGN_PATH });
        expect(extractZip.mock.calls).toHaveLength(1);
        // Same mechanics as the newest lane: flush + reload broadcast.
        const { saveFile } = await import('../utils/changeData.js');
        expect(saveFile).toHaveBeenCalled();
        expect(publish).toHaveBeenCalledWith('reload-test-campaign', null, 'test-campaign');
    });

    it('restores the legacy <campaign>.zip when it is explicitly named', async () => {
        seedThreeSnapshots();
        const extractZip = (await import('extract-zip')).default;
        const res = await postRollback({ filename: 'test-campaign.zip' });
        expect(res.status).toBe(200);
        expect(res.body.restored).toBe('test-campaign.zip');
        expect(extractZip).toHaveBeenCalledWith(`${SNAP_DIR}/test-campaign.zip`, { dir: CAMPAIGN_PATH });
    });

    it.each([
        ['path traversal', '../other-campaign-2026-10-09T00-00-00-000.zip'],
        ['path separator', 'sub/test-campaign-2026-10-08T00-00-00-000.zip'],
        ['backslash separator', '..\\test-campaign.zip'],
        ['embedded parent segment', 'test-campaign-../../x.zip'],
        ['another campaign prefix', 'other-campaign-2026-10-09T00-00-00-000.zip'],
        ['non-zip file', 'test-campaign-2026-10-08T00-00-00-000.txt'],
        ['non-string value', 42],
    ])('rejects a %s filename with 400 and stays disk-inert', async (_label, filename) => {
        seedThreeSnapshots();
        const res = await postRollback({ filename });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Invalid snapshot filename');
        await diskInertAssertions();
    });

    it('rejects a well-formed but unlisted filename with 404 and stays disk-inert', async () => {
        seedThreeSnapshots();
        const res = await postRollback({ filename: 'test-campaign-2026-10-01T00-00-00-000.zip' });
        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Snapshot not found');
        await diskInertAssertions();
    });

    it('returns 404 No snapshot found even with a filename when nothing exists', async () => {
        mockFsState.exists.add(CAMPAIGN_PATH);
        const extractZip = (await import('extract-zip')).default;
        const res = await postRollback({ filename: 'test-campaign-2026-10-08T00-00-00-000.zip' });
        expect(res.status).toBe(404);
        expect(res.body.error).toBe('No snapshot found');
        expect(extractZip).not.toHaveBeenCalled();
        expect(mockFsState.exists.has(CAMPAIGN_PATH)).toBe(true);
    });

    it('gates foreign Host with 403 before reading the body', async () => {
        seedThreeSnapshots();
        const res = await postRollback({ filename: 'test-campaign-2026-10-08T00-00-00-000.zip' }, 'example.com');
        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Only available on localhost');
        await diskInertAssertions();
    });

    it('returns 404 for a bad filename when the campaign does not exist', async () => {
        const res = await postRollback({ filename: 'test-campaign.zip' });
        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Campaign not found');
    });
});
