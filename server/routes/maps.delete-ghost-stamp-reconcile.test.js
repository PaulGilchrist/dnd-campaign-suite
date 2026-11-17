// @maintained-by-ai
// maps.delete-ghost-stamp-reconcile.test.js — bug-opened-map-delete-leaves-ghost-active-map:
// the GM row-Open force-stamp (MapContextSync) writes the persisted '__map__'
// change-data key WITHOUT ever touching the in-memory activeMaps, so the DELETE
// route's old `activeMaps.get() === mapKey` guard left '__map__' naming a
// deleted (404-ing) map forever — a ghost active-map context SSE-replayed to
// every tab. The delete (and rename-away) handler must ALSO reconcile the
// persisted key. Mock harness mirrors maps-active-map-context.test.js.

import { request } from '../test-utils/localhostSupertest.js';
import express from 'express';
import maps from './maps.js';
import * as changeData from '../utils/changeData.js';

// ─── Mocks (mirrors maps-active-map-context.test.js) ─────────────────────────

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
    changeData.publish.mockClear();
    changeData.characterChangeData.clear();
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
const stamp = () => changeData.characterChangeData.get('test-campaign').__map__;

// ─── DELETE reconciles the persisted '__map__' stamp ─────────────────────────

describe('maps — delete reconciles a client force-stamped __map__ (ghost-active-map fix)', () => {
    afterEach(clearMocks);

    it('clears __map__ when deleting an Opened-but-never-Activated map (activeMaps never learned the slug)', async () => {
        setupFs(`${mapsDir}/fix-ghost-1.json`, { displayName: 'Fix Ghost 1' });
        // The exact shape MapContextSync force-stamps via the wildcard POST:
        // persisted '__map__' carries the slug, activeMaps stays empty.
        changeData.characterChangeData.set('test-campaign', { __map__: { activeMapName: 'fix-ghost-1' } });

        const res = await request(createTestApp())
            .delete('/api/campaigns/test-campaign/maps/fix-ghost-1.json');

        expect(res.status).toBe(200);
        expect(stamp()).toEqual({ activeMapName: null });
        expect(changeData.publish).toHaveBeenCalledWith(
            'change-test-campaign-__map__',
            { activeMapName: null },
            'test-campaign'
        );
        // null face so every live tab disarms (deactivate-route twin)
        expect(changeData.publish).toHaveBeenCalledWith(
            'map-activate-test-campaign',
            { activeMap: null },
            'test-campaign'
        );
    });

    it('still clears __map__ on the honest activate→delete lane (regression-safe)', async () => {
        setupFs(`${mapsDir}/battle-arena.json`, { displayName: 'Battle Arena' });
        MOCK_ACTIVE_MAPS.set('test-campaign', 'battle-arena');
        changeData.characterChangeData.set('test-campaign', { __map__: { activeMapName: 'battle-arena' } });

        const res = await request(createTestApp())
            .delete('/api/campaigns/test-campaign/maps/battle-arena.json');

        expect(res.status).toBe(200);
        expect(stamp()).toEqual({ activeMapName: null });
        expect(changeData.activeMaps.delete).toHaveBeenCalledWith('test-campaign');
        expect(changeData.publish).toHaveBeenCalledWith(
            'map-activate-test-campaign',
            { activeMap: null },
            'test-campaign'
        );
    });

    it('leaves __map__ untouched when deleting a map the stamp does not name', async () => {
        setupFs(`${mapsDir}/side-map.json`, { displayName: 'Side Map' });
        changeData.characterChangeData.set('test-campaign', { __map__: { activeMapName: 'battle-arena' } });

        const res = await request(createTestApp())
            .delete('/api/campaigns/test-campaign/maps/side-map.json');

        expect(res.status).toBe(200);
        expect(stamp()).toEqual({ activeMapName: 'battle-arena' });
        expect(changeData.publish).not.toHaveBeenCalledWith(
            'change-test-campaign-__map__',
            expect.anything(),
            'test-campaign'
        );
        expect(changeData.publish).not.toHaveBeenCalledWith(
            'map-activate-test-campaign',
            expect.anything(),
            'test-campaign'
        );
    });

    it('rename-away of a client force-stamped map moves __map__ to the new slug', async () => {
        setupFs(`${mapsDir}/old-stamp.json`, { displayName: 'Old Stamp' });
        changeData.characterChangeData.set('test-campaign', { __map__: { activeMapName: 'old-stamp' } });

        const res = await request(createTestApp())
            .put('/api/campaigns/test-campaign/maps/old-stamp.json/rename')
            .send({ newName: 'New Stamp' });

        expect(res.status).toBe(200);
        expect(stamp()).toEqual({ activeMapName: 'new-stamp' });
    });

    it('rename of a map the stamp does not name leaves __map__ untouched', async () => {
        setupFs(`${mapsDir}/side-map.json`, { displayName: 'Side Map' });
        changeData.characterChangeData.set('test-campaign', { __map__: { activeMapName: 'battle-arena' } });

        const res = await request(createTestApp())
            .put('/api/campaigns/test-campaign/maps/side-map.json/rename')
            .send({ newName: 'Renamed Side' });

        expect(res.status).toBe(200);
        expect(stamp()).toEqual({ activeMapName: 'battle-arena' });
    });
});
