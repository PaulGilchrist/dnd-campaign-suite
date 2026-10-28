// @maintained-by-ai
/**
 * POST /api/campaigns/:campaign/admin/upload-inspect — the read-only dry-run
 * companion of /admin/upload (backlog 2026-10-28-O: empty/foreign zip
 * accepted silently). Lists the archive's entry names via yauzl and reports
 * how many are recognizable campaign content, WITHOUT touching campaign
 * data. Corrupt archives answer with the JSON 400 shape; the localhost gate
 * and multer error wrapper behave exactly as on /admin/upload.
 *
 * Mirrors the rig of campaigns-admin-upload-oversize.test.js (mocked fs /
 * paths / changeData / multer, file injection via req._multerFile) but keeps
 * the REAL yauzl: the zips here are genuine buffers, hand-built in stored
 * (uncompressed) form so no zip-writer npm dependency is needed.
 */
import { request } from '../test-utils/localhostSupertest.js';
import express from 'express';
import campaignsAdmin from './campaigns-admin.js';

const mockFsState = { exists: new Set(), files: new Map(), mkdir: new Map(), readdir: new Map(), stats: new Map() };

vi.mock('fs', () => ({
    default: {
        existsSync: vi.fn((p) => mockFsState.exists.has(p)),
        mkdirSync: vi.fn((p) => { mockFsState.exists.add(p); mockFsState.mkdir.set(p, true); }),
        renameSync: vi.fn(),
        rmSync: vi.fn((p) => { mockFsState.exists.delete(p); }),
        writeFileSync: vi.fn((p, data) => { mockFsState.files.set(p, data); }),
        readdirSync: vi.fn((p) => { const entries = mockFsState.readdir.get(p); if (entries === undefined) throw new Error('ENOENT'); return entries; }),
        readFileSync: vi.fn((p) => { if (mockFsState.files.has(p)) return mockFsState.files.get(p); throw new Error('ENOENT'); }),
        unlinkSync: vi.fn((p) => { mockFsState.files.delete(p); mockFsState.exists.delete(p); }),
        createWriteStream: vi.fn(),
        statSync: vi.fn((p) => mockStat(p)),
    },
    existsSync: vi.fn((p) => mockFsState.exists.has(p)),
    mkdirSync: vi.fn((p) => { mockFsState.exists.add(p); mockFsState.mkdir.set(p, true); }),
    renameSync: vi.fn(),
    rmSync: vi.fn((p) => { mockFsState.exists.delete(p); }),
    writeFileSync: vi.fn((p, data) => { mockFsState.files.set(p, data); }),
    readdirSync: vi.fn((p) => { const entries = mockFsState.readdir.get(p); if (entries === undefined) throw new Error('ENOENT'); return entries; }),
    readFileSync: vi.fn((p) => { if (mockFsState.files.has(p)) return mockFsState.files.get(p); throw new Error('ENOENT'); }),
    unlinkSync: vi.fn((p) => { mockFsState.files.delete(p); mockFsState.exists.delete(p); }),
    createWriteStream: vi.fn(),
    statSync: vi.fn((p) => mockStat(p)),
}));

function mockStat(p) {
    const s = mockFsState.stats.get(p) || {};
    return { isDirectory: () => true, size: s.size ?? 1024, mtime: s.mtime ?? new Date('2026-01-01T00:00:00.000Z') };
}

vi.mock('../utils/campaignPaths.js', () => ({
    campaignDir: (name) => `/mock/campaigns/${name}`,
    campaignMapsDir: (name) => `/mock/campaigns/${name}/maps`,
    campaignImagesDir: (name) => `/mock/campaigns/${name}/images`,
    campaignDataDir: (name) => `/mock/campaigns/${name}/data`,
    campaignDataFile: (campaign, fileName) => `/mock/campaigns/${campaign}/data/${fileName}`,
    campaignSnapshotDir: () => '/mock/campaigns/.snapshots',
    campaignSnapshotFile: (campaign) => `/mock/campaigns/.snapshots/${campaign}.zip`,
    snapshotTimestamp: () => '2026-01-01T00-00-00-000',
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
vi.mock('archiver', () => ({
    ZipArchive: class {},
    default: { ZipArchive: class {} },
}));
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
    };
    const multerFn = Object.assign(function multer() { return multerInstance; }, { memoryStorage: () => ({}) });
    return { default: multerFn };
});

// --- Minimal real-zip builder (stored entries, no npm deps) ---------------

const CRC_TABLE = (() => {
    const table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        table[n] = c;
    }
    return table;
})();

function crc32(buf) {
    let c = -1;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
}

/** Build a valid zip buffer holding zero or more 0-byte stored entries. */
function buildZip(names) {
    const locals = [];
    const centrals = [];
    let offset = 0;
    for (const name of names) {
        const nameBuf = Buffer.from(name, 'utf8');
        const crc = crc32(Buffer.alloc(0));
        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt16LE(0x0800, 6); // UTF-8 names
        local.writeUInt16LE(0, 8); // stored
        local.writeUInt32LE(crc, 14);
        local.writeUInt16LE(nameBuf.length, 26);
        locals.push(local, nameBuf);

        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(20, 4);
        central.writeUInt16LE(20, 6);
        central.writeUInt16LE(0x0800, 8);
        central.writeUInt32LE(crc, 16);
        central.writeUInt16LE(nameBuf.length, 28);
        central.writeUInt32LE(offset, 42);
        centrals.push(central, nameBuf);

        offset += local.length + nameBuf.length;
    }
    const localPart = Buffer.concat(locals);
    const centralPart = Buffer.concat(centrals);

    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(names.length, 8);
    eocd.writeUInt16LE(names.length, 10);
    eocd.writeUInt32LE(centralPart.length, 12);
    eocd.writeUInt32LE(localPart.length, 16);

    return Buffer.concat([localPart, centralPart, eocd]);
}

function createTestApp(fileBuffer) {
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => {
        if (fileBuffer !== undefined) req._multerFile = fileBuffer;
        next();
    });
    app.use(campaignsAdmin);
    return app;
}

function ensureCampaign(name) { mockFsState.exists.add(`/mock/campaigns/${name}`); }

const inspectUrl = '/api/campaigns/test-campaign/admin/upload-inspect';

describe('campaignsAdmin - POST /admin/upload-inspect', () => {
    beforeEach(() => { mockFsState.exists.clear(); ensureCampaign('test-campaign'); });
    afterEach(() => { vi.clearAllMocks(); });

    it('reports an empty archive as zero entries / zero recognizable — the classic silent-wipe zip', async () => {
        const res = await request(createTestApp(buildZip([]))).post(inspectUrl).set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ entryCount: 0, recognizableCount: 0, recognizable: [] });
    });

    it('reports a foreign archive (readme + snapshots dir only) as unrecognizable', async () => {
        const zip = buildZip(['readme.txt', 'config.yaml', '.snapshots/old.zip']);
        const res = await request(createTestApp(zip)).post(inspectUrl).set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body.entryCount).toBe(3);
        expect(res.body.recognizableCount).toBe(0);
    });

    it('recognises a real campaign backup (data/ dir + character JSONs)', async () => {
        const zip = buildZip(['data/', 'data/npcs.json', 'Hero.json', 'maps/', 'maps/test-map.json', 'images/']);
        const res = await request(createTestApp(zip)).post(inspectUrl).set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body.entryCount).toBe(6);
        expect(res.body.recognizableCount).toBe(3);
        expect(res.body.recognizable).toEqual(['data/', 'data/npcs.json', 'Hero.json']);
    });

    it('recognises a top-level known campaign file (npcs.json) and never a campaign- prefix file alone', async () => {
        const withNpcs = await request(createTestApp(buildZip(['npcs.json']))).post(inspectUrl).set('Host', 'localhost');
        expect(withNpcs.status).toBe(200);
        expect(withNpcs.body.recognizableCount).toBe(1);

        const onlyLog = await request(createTestApp(buildZip(['campaign-log.json']))).post(inspectUrl).set('Host', 'localhost');
        expect(onlyLog.body.recognizableCount).toBe(0);
    });

    it('answers a corrupt archive with a clear JSON 400 and no data read', async () => {
        const res = await request(createTestApp(Buffer.from('this is not a zip archive'))).post(inspectUrl).set('Host', 'localhost');

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'Could not read the archive — it is not a valid zip file' });
    });

    it('400s a clean request with no file', async () => {
        const res = await request(createTestApp(undefined)).post(inspectUrl).set('Host', 'localhost');

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'No file uploaded' });
    });

    it('404s when the campaign does not exist', async () => {
        mockFsState.exists.delete('/mock/campaigns/test-campaign');
        const res = await request(createTestApp(buildZip([]))).post(inspectUrl).set('Host', 'localhost');

        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: 'Campaign not found' });
    });

    it('is localhost-gated like the upload route (foreign Host 403, even mid-multer-error)', async () => {
        const app = express();
        app.use((req, res, next) => {
            const err = new Error('File too large');
            err.name = 'MulterError';
            err.code = 'LIMIT_FILE_SIZE';
            req._multerError = err;
            next();
        });
        app.use(campaignsAdmin);

        const res = await request(app).post(inspectUrl).set('Host', 'example.com');
        expect(res.status).toBe(403);
        expect(res.body).toEqual({ error: 'Only available on localhost' });
    });

    it('converts an oversized multer abort into the JSON 413 shape, same as /admin/upload', async () => {
        const app = express();
        app.use((req, res, next) => {
            const err = new Error('File too large');
            err.name = 'MulterError';
            err.code = 'LIMIT_FILE_SIZE';
            req._multerError = err;
            next();
        });
        app.use(campaignsAdmin);

        const res = await request(app).post(inspectUrl).set('Host', 'localhost');
        expect(res.status).toBe(413);
        expect(res.body).toEqual({ error: 'File too large (limit 100 MB)' });
    });
});
