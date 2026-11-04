// @maintained-by-ai
// ─── Lane: PUT /maps/:mapname/deactivate (backlog 2026-11-04 CQ) ──────────────
// The maps list had ACTIVATE but no DEACTIVATE: restarting the server was the
// only null-reset of the memory-only activeMaps dict. These cases pin the
// deactivate twin of the activate lane at every seam: GM-only gate (same 403),
// activeMaps + '__map__' clear ({ activeMapName: null } — the gridless shape),
// the twin map-activate / maps-list SSE publishes carrying activeMap: null,
// and the honest 409 when the named map is NOT the active one (the real active
// map stays active, zero writes, zero broadcasts). Harness mirrors
// maps-active-map-context.test.js.
import express from 'express';
import { request } from '../test-utils/localhostSupertest.js';
import maps from './maps.js';
import * as changeData from '../utils/changeData.js';

// ─── Mocks ─────────────────────────────────────────────────────────────────────

const MOCK_FS = new Map();
const MOCK_ACTIVE_MAPS = new Map();

function setupFs(path, content) {
    if (content === null) {
        MOCK_FS.delete(path);
    } else {
        MOCK_FS.set(path, content);
    }
}

function clearMocks() {
    MOCK_FS.clear();
    MOCK_ACTIVE_MAPS.clear();
    changeData.characterChangeData.clear();
    vi.clearAllMocks();
}

vi.mock('fs', () => ({
    default: {
        existsSync: vi.fn((path) => MOCK_FS.has(path) || MOCK_FS.has(path + '.json') || MOCK_FS.get(path) !== undefined),
        readFileSync: vi.fn((path) => {
            const content = MOCK_FS.get(path);
            if (content === undefined) {
                throw new Error(`ENOENT: no such file or directory, open '${path}'`);
            }
            return JSON.stringify(content);
        }),
        writeFileSync: vi.fn((path, data) => {
            MOCK_FS.set(path, data);
        }),
        readdirSync: vi.fn((dirPath) => {
            const entries = MOCK_FS.get(dirPath);
            if (entries === undefined) {
                throw new Error('ENOENT: no such file or directory');
            }
            return entries;
        }),
        mkdirSync: vi.fn((dirPath) => {
            MOCK_FS.set(dirPath, { __directory__: true });
        }),
        unlinkSync: vi.fn((path) => {
            MOCK_FS.delete(path);
        }),
    },
}));

vi.mock('../utils/campaignPaths.js', () => ({
    campaignMapsDir: vi.fn((campaign) => `/mock/campaigns/${campaign}/maps`),
    normalizeMapFile: vi.fn((name) => (name.endsWith('.json') ? name : `${name}.json`)),
}));

vi.mock('../utils/changeData.js', () => ({
    warnIfNewTopLevelKey: vi.fn(),
    publish: vi.fn(),
    activeMaps: {
        get: vi.fn((campaign) => MOCK_ACTIVE_MAPS.get(campaign)),
        set: vi.fn((campaign, value) => {
            MOCK_ACTIVE_MAPS.set(campaign, value);
        }),
        delete: vi.fn((campaign) => {
            MOCK_ACTIVE_MAPS.delete(campaign);
        }),
    },
    characterChangeData: new Map(),
    markDirty: vi.fn(),
}));

// ─── Helpers ───────────────────────────────────────────────────────────────────

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(maps);
    return app;
}

const mapsDir = '/mock/campaigns/test-campaign/maps';
const deactivateUrl = (mapname) => `/api/campaigns/test-campaign/maps/${mapname}/deactivate`;

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('maps - PUT /maps/:mapname/deactivate', () => {
    afterEach(clearMocks);

    describe('active map (GM)', () => {
        beforeEach(() => {
            setupFs(`${mapsDir}/battle-arena.json`, { displayName: 'Battle Arena' });
            setupFs(`${mapsDir}/test-map.json`, { displayName: 'Test Map' });
            MOCK_ACTIVE_MAPS.set('test-campaign', 'battle-arena');
            changeData.characterChangeData.set('test-campaign', { __map__: { activeMapName: 'battle-arena' } });
        });

        it('clears the memory activeMaps entry and stamps gridless __map__', async () => {
            const res = await request(createTestApp())
                .put(deactivateUrl('battle-arena.json'));

            expect(res.status).toBe(200);
            expect(res.body).toEqual({ message: 'Map deactivated successfully', activeMap: null });
            expect(MOCK_ACTIVE_MAPS.has('test-campaign')).toBe(false);
            expect(changeData.characterChangeData.get('test-campaign').__map__).toEqual({ activeMapName: null });
        });

        it('broadcasts the deactivate twin of the activate SSE pair', async () => {
            const res = await request(createTestApp())
                .put(deactivateUrl('battle-arena.json'));

            expect(res.status).toBe(200);
            expect(changeData.publish).toHaveBeenCalledWith(
                'map-activate-test-campaign',
                { activeMap: null },
                'test-campaign'
            );
            expect(changeData.publish).toHaveBeenCalledWith(
                'maps-list-test-campaign',
                { action: 'deactivated', activeMap: null, map: 'battle-arena' },
                'test-campaign'
            );
            // change-<campaign>-__map__ echo comes via the shared
            // stampActiveMapContext seam (same as activate/delete).
            expect(changeData.publish).toHaveBeenCalledWith(
                'change-test-campaign-__map__',
                { activeMapName: null },
                'test-campaign'
            );
        });

        it('leaves the map files untouched (deactivate is a pointer reset, not a delete)', async () => {
            await request(createTestApp()).put(deactivateUrl('battle-arena.json'));

            expect(MOCK_FS.has(`${mapsDir}/battle-arena.json`)).toBe(true);
            expect(MOCK_FS.has(`${mapsDir}/test-map.json`)).toBe(true);
        });

        it('resolves display-name segments through normalizeMapFile (slug parity with activate)', async () => {
            const res = await request(createTestApp()).put(deactivateUrl('battle-arena'));
            expect(res.status).toBe(200);
            expect(MOCK_ACTIVE_MAPS.has('test-campaign')).toBe(false);
        });
    });

    describe('non-active map — honest refusal, zero corruption', () => {
        beforeEach(() => {
            setupFs(`${mapsDir}/battle-arena.json`, { displayName: 'Battle Arena' });
            setupFs(`${mapsDir}/test-map.json`, { displayName: 'Test Map' });
            MOCK_ACTIVE_MAPS.set('test-campaign', 'battle-arena');
            changeData.characterChangeData.set('test-campaign', { __map__: { activeMapName: 'battle-arena' } });
        });

        it('409s naming the real active map, which stays active', async () => {
            const res = await request(createTestApp())
                .put(deactivateUrl('test-map.json'));

            expect(res.status).toBe(409);
            expect(res.body.error).toContain('is not the active map');
            expect(res.body.error).toContain('battle-arena');
            expect(res.body.activeMap).toBe('battle-arena');
            expect(MOCK_ACTIVE_MAPS.get('test-campaign')).toBe('battle-arena');
            expect(changeData.characterChangeData.get('test-campaign').__map__).toEqual({ activeMapName: 'battle-arena' });
        });

        it('publishes nothing on the refusal face', async () => {
            await request(createTestApp()).put(deactivateUrl('test-map.json'));
            expect(changeData.publish).not.toHaveBeenCalled();
        });

        it('409s with a no-map message when nothing is active', async () => {
            MOCK_ACTIVE_MAPS.delete('test-campaign');

            const res = await request(createTestApp()).put(deactivateUrl('test-map.json'));

            expect(res.status).toBe(409);
            expect(res.body.error).toContain('no map is currently active');
            expect(res.body.activeMap).toBeNull();
        });
    });

    describe('missing map', () => {
        it('404s and never touches the active pointer', async () => {
            setupFs(`${mapsDir}/battle-arena.json`, { displayName: 'Battle Arena' });
            MOCK_ACTIVE_MAPS.set('test-campaign', 'battle-arena');

            const res = await request(createTestApp()).put(deactivateUrl('ghost-map.json'));

            expect(res.status).toBe(404);
            expect(res.body.error).toBe('Map not found');
            expect(MOCK_ACTIVE_MAPS.get('test-campaign')).toBe('battle-arena');
            expect(changeData.publish).not.toHaveBeenCalled();
        });
    });

    describe('GM-authority gate (non-localhost)', () => {
        const FOREIGN_HOST = '100.92.171.80';

        it('rejects with the canonical 403 and leaves the active map in place', async () => {
            setupFs(`${mapsDir}/battle-arena.json`, { displayName: 'Battle Arena' });
            MOCK_ACTIVE_MAPS.set('test-campaign', 'battle-arena');
            changeData.characterChangeData.set('test-campaign', { __map__: { activeMapName: 'battle-arena' } });

            const res = await request(createTestApp())
                .put(deactivateUrl('battle-arena.json'))
                .set('Host', FOREIGN_HOST);

            expect(res.status).toBe(403);
            expect(res.body.error).toBe('Access denied: GM-only feature');
            expect(MOCK_ACTIVE_MAPS.get('test-campaign')).toBe('battle-arena');
            expect(changeData.characterChangeData.get('test-campaign').__map__).toEqual({ activeMapName: 'battle-arena' });
            expect(changeData.publish).not.toHaveBeenCalled();
        });
    });
});
