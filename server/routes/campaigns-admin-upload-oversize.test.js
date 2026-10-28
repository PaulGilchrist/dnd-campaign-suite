// @maintained-by-ai
/**
 * Middleware-stage failures of POST /api/campaigns/:campaign/admin/upload
 * (bug-admin-oversize-upload-html-error): multer aborts oversized and
 * malformed uploads BEFORE the route body runs, so these errors must be
 * converted to the JSON shape every other admin error uses — never the
 * default Express HTML page with its stack trace and absolute server paths.
 *
 * The multer mock mirrors the sibling snapshots file (middleware callback
 * contract) but additionally honours req._multerError to simulate MulterError
 * pass-through, which the sibling's note says supertest.attach() cannot
 * exercise with real parsing.
 */
import { request } from '../test-utils/localhostSupertest.js';
import express from 'express';
import campaignsAdmin from './campaigns-admin.js';

const mockFsState = { exists: new Set(), files: new Map(), mkdir: new Map(), readdir: new Map(), stats: new Map() };

// Set before a request; injected onto req by createTestApp's pre-middleware
// and surfaced by the mocked multer middleware via next(err).
let pendingMulterError = null;

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
            if (req._multerError) return next(req._multerError);
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

function multerError(code, message) {
    // Real MulterError shape (multer 2.x): Error with name/code set, message
    // a static library string.
    const err = new Error(message);
    err.name = 'MulterError';
    err.code = code;
    return err;
}

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => {
        if (pendingMulterError) req._multerError = pendingMulterError;
        next();
    });
    app.use(campaignsAdmin);
    return app;
}

function ensureCampaign(name) { mockFsState.exists.add(`/mock/campaigns/${name}`); }
function removeCampaign(name) { mockFsState.exists.delete(`/mock/campaigns/${name}`); }
function snapshotDir() { return mockFsState.readdir.get('/mock/campaigns/.snapshots') || []; }
function setSnapshotDir(names) { mockFsState.readdir.set('/mock/campaigns/.snapshots', names); }

const uploadUrl = '/api/campaigns/test-campaign/admin/upload';

describe('campaignsAdmin - POST /admin/upload multer middleware errors', () => {
    beforeEach(() => { pendingMulterError = null; setSnapshotDir([]); ensureCampaign('test-campaign'); });
    afterEach(() => { pendingMulterError = null; removeCampaign('test-campaign'); setSnapshotDir([]); vi.clearAllMocks(); });

    it('answers an oversized upload with JSON 413, not an HTML stack page', async () => {
        pendingMulterError = multerError('LIMIT_FILE_SIZE', 'File too large');
        const res = await request(createTestApp()).post(uploadUrl).set('Host', 'localhost');

        expect(res.status).toBe(413);
        expect(res.body).toEqual({ error: 'File too large (limit 100 MB)' });
        expect(res.headers['content-type']).toMatch(/application\/json/);
        // No stack traces, node_modules frames, HTML, or absolute paths ever
        // leave the server.
        expect(res.text).not.toMatch(/MulterError|node_modules|<!DOCTYPE|at [A-Za-z]+ \(|\/Users\/|\/home\//);
    });

    it('answers a non-size MulterError with JSON 400 carrying only the static message', async () => {
        pendingMulterError = multerError('LIMIT_UNEXPECTED_FILE', 'Unexpected field');
        const res = await request(createTestApp()).post(uploadUrl).set('Host', 'localhost');

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'Unexpected field' });
        expect(res.text).not.toMatch(/MulterError|node_modules|<!DOCTYPE|at [A-Za-z]+ \(/);
    });

    it('answers a non-Multer middleware failure with a generic JSON 400, hiding internals', async () => {
        pendingMulterError = new Error('Multipart: Boundary not found near /Users/secret/path');
        const res = await request(createTestApp()).post(uploadUrl).set('Host', 'localhost');

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'Upload failed: could not read the uploaded file' });
        expect(res.text).not.toContain('/Users/secret/path');
        expect(res.text).not.toContain('Boundary');
    });

    it('keeps the localhost gate first: a remote oversized upload gets 403', async () => {
        pendingMulterError = multerError('LIMIT_FILE_SIZE', 'File too large');
        const res = await request(createTestApp()).post(uploadUrl).set('Host', 'example.com');

        expect(res.status).toBe(403);
        expect(res.body).toEqual({ error: 'Only available on localhost' });
    });

    it('passes clean requests through untouched: no file still gets 400 No file uploaded', async () => {
        const res = await request(createTestApp()).post(uploadUrl).set('Host', 'localhost');

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('No file uploaded');
    });

    it('passes a valid file through to the route body: snapshot, extract, 200 Upload complete', async () => {
        // Prove the wrapper did not break the happy lane the sibling file
        // could not exercise with mocked multer: inject req._multerFile
        // before the router so the mocked middleware attaches req.file.
        const app = express();
        app.use(express.json());
        app.use((req, res, next) => { req._multerFile = Buffer.from('zipbytes'); next(); });
        app.use(campaignsAdmin);

        const res = await request(app).post(uploadUrl).set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Upload complete');
        expect(res.body.snapshot).toMatch(/^test-campaign-.*\.zip$/);
        expect(snapshotDir().length).toBe(1);
    });
});
