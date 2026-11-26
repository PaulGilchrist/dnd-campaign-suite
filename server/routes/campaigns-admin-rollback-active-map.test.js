// @maintained-by-ai
/**
 * Rollback active-map pointer RECONCILE pin (bug-playtest-rollback-ghost-active-map-pointer,
 * 2026-11-25): the Encounter Playtest activates its staged `travel-encounter-stage`
 * map through the /activate lane, which writes the memory-only `activeMaps`. The
 * rollback deletes that file with `fs.rmSync` + snapshot extract, and
 * reloadCampaign() reloaded change data and the log cache but left activeMaps
 * pointing at the ghost — GET /active-map served the deleted slug and the GM's
 * honest Deactivate of the restored active map 409'd ("battle-arena is not the
 * active map — travel-encounter-stage stays active."). reloadCampaign now
 * reconciles the pointer from the freshly reloaded '__map__' value: kept only if
 * the restored folder holds the file, otherwise deleted (admin-clear idiom).
 * Mirrors the mocked-fs rig of campaigns-admin-rollback-selection.test.js.
 */
import { request } from '../test-utils/localhostSupertest.js';
import express from 'express';
import campaignsAdmin from './campaigns-admin.js';

const mockFsState = { exists: new Set(), files: new Map(), readdir: new Map(), stats: new Map() };

function mockStat(p) {
    const s = mockFsState.stats.get(p) || {};
    return { isDirectory: () => true, size: s.size ?? 1024, mtime: s.mtime ?? new Date('2026-01-01T00:00:00.000Z') };
}

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
        statSync: vi.fn((p) => mockStat(p)),
    },
    existsSync: vi.fn((p) => mockFsState.exists.has(p)),
    mkdirSync: vi.fn((p) => { mockFsState.exists.add(p); }),
    renameSync: vi.fn((oldPath, newPath) => { if (mockFsState.exists.has(oldPath)) mockFsState.exists.delete(oldPath); mockFsState.exists.add(newPath); }),
    rmSync: vi.fn((p) => { mockFsState.exists.delete(p); }),
    writeFileSync: vi.fn((p, data) => { mockFsState.files.set(p, data); }),
    readdirSync: vi.fn((p) => { const entries = mockFsState.readdir.get(p); if (entries === undefined) throw new Error('ENOENT'); return entries; }),
    readFileSync: vi.fn((p) => { if (mockFsState.files.has(p)) return mockFsState.files.get(p); throw new Error('ENOENT'); }),
    unlinkSync: vi.fn((p) => { mockFsState.files.delete(p); mockFsState.exists.delete(p); }),
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
    warnIfNewTopLevelKey: vi.fn(),
    characterChangeData: new Map(),
    spellOverlayData: new Map(),
    activeMaps: new Map(),
    saveFile: vi.fn(),
    markDirty: vi.fn(),
    publish: vi.fn(),
    readFile: vi.fn(),
}));

vi.mock('./log.js', () => ({ logCache: new Map(), flushLogs: vi.fn() }));
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

const SNAP_DIR = '/mock/campaigns/.snapshots';
const CAMPAIGN_PATH = '/mock/campaigns/test-campaign';
const MAPS_DIR = `${CAMPAIGN_PATH}/maps`;

function createTestApp() { const app = express(); app.use(express.json()); app.use(campaignsAdmin); return app; }
function setSnapshotDir(names) { mockFsState.readdir.set(SNAP_DIR, names); mockFsState.exists.add(SNAP_DIR); for (const n of names) mockFsState.exists.add(`${SNAP_DIR}/${n}`); }

function seedSnapshot() {
    mockFsState.exists.add(CAMPAIGN_PATH);
    setSnapshotDir(['test-campaign-2026-11-25T00-00-00-000.zip']);
    mockFsState.stats.set(`${SNAP_DIR}/test-campaign-2026-11-25T00-00-00-000.zip`, { size: 100, mtime: new Date('2026-11-25T00:00:00.000Z') });
}

async function postRollback() {
    return request(createTestApp()).post('/api/campaigns/test-campaign/admin/rollback').set('Host', 'localhost');
}

describe('POST /admin/rollback reconciles the active-map pointer', () => {
    beforeEach(() => { setSnapshotDir([]); });
    afterEach(() => {
        mockFsState.exists.delete(CAMPAIGN_PATH);
        mockFsState.exists.delete(MAPS_DIR);
        mockFsState.exists.delete(`${MAPS_DIR}/battle-arena.json`);
        setSnapshotDir([]);
        mockFsState.stats.clear();
        vi.clearAllMocks();
    });

    it('re-points activeMaps from the staged ghost to the restored __map__ slug whose file exists', async () => {
        seedSnapshot();
        const { characterChangeData, activeMaps } = await import('../utils/changeData.js');
        // Mid-playtest face: memory pointer on the staged doc (its file dies
        // with the rollback rm); the snapshot's disk __map__ names battle-arena.
        activeMaps.set('test-campaign', 'travel-encounter-stage');
        // readFile is mocked — seed the Map with the value it would hydrate
        // from the RESTORED character-change-data.json.
        characterChangeData.set('test-campaign', { __map__: { activeMapName: 'battle-arena' } });
        mockFsState.exists.add(MAPS_DIR);
        mockFsState.exists.add(`${MAPS_DIR}/battle-arena.json`);

        const res = await postRollback();
        expect(res.status).toBe(200);
        // The ghost is gone and the pointer matches the restored disk: the GM's
        // Deactivate of battle-arena (the two-source truth) now succeeds.
        expect(activeMaps.get('test-campaign')).toBe('battle-arena');
    });

    it('clears the pointer when the restored __map__ names a file the restored folder does not hold', async () => {
        seedSnapshot();
        const { characterChangeData, activeMaps } = await import('../utils/changeData.js');
        activeMaps.set('test-campaign', 'travel-encounter-stage');
        characterChangeData.set('test-campaign', { __map__: { activeMapName: 'travel-encounter-stage' } });
        mockFsState.exists.add(MAPS_DIR);

        const res = await postRollback();
        expect(res.status).toBe(200);
        expect(activeMaps.has('test-campaign')).toBe(false);
    });

    it('clears the pointer when the restored change data carries no __map__ at all', async () => {
        seedSnapshot();
        const { characterChangeData, activeMaps } = await import('../utils/changeData.js');
        activeMaps.set('test-campaign', 'travel-encounter-stage');
        characterChangeData.set('test-campaign', {});
        mockFsState.exists.add(MAPS_DIR);
        mockFsState.exists.add(`${MAPS_DIR}/battle-arena.json`);

        const res = await postRollback();
        expect(res.status).toBe(200);
        expect(activeMaps.has('test-campaign')).toBe(false);
    });

    it.each([
        ['path traversal', '../secret-char'],
        ['forward slash', 'maps/battle-arena'],
        ['backslash', 'maps\\battle-arena'],
    ])('never promotes a %s __map__ value into activeMaps', async (_label, slug) => {
        seedSnapshot();
        const { characterChangeData, activeMaps } = await import('../utils/changeData.js');
        activeMaps.set('test-campaign', 'travel-encounter-stage');
        characterChangeData.set('test-campaign', { __map__: { activeMapName: slug } });
        mockFsState.exists.add(MAPS_DIR);
        mockFsState.exists.add(`${MAPS_DIR}/battle-arena.json`);

        const res = await postRollback();
        expect(res.status).toBe(200);
        expect(activeMaps.has('test-campaign')).toBe(false);
    });
});
