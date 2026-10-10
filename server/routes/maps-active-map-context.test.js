import { request } from '../test-utils/localhostSupertest.js';
import express from 'express';
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

// ─── __map__ runtime key stays in sync with activeMaps ───────────────

describe('maps - __map__ runtime key sync', () => {
    afterEach(clearMocks);

    it('should stamp __map__ with the activated map on activate', async () => {
        setupFs(`${mapsDir}/battle-arena.json`, { displayName: 'Battle Arena' });
        changeData.characterChangeData.set('test-campaign', { __map__: { activeMapName: null } });

        const res = await request(createTestApp())
            .put('/api/campaigns/test-campaign/maps/battle-arena.json/activate');

        expect(res.status).toBe(200);
        expect(changeData.characterChangeData.get('test-campaign').__map__).toEqual({ activeMapName: 'battle-arena' });
    });

    it('should repair a null-clobbered __map__ on activate', async () => {
        setupFs(`${mapsDir}/battle-arena.json`, { displayName: 'Battle Arena' });
        changeData.characterChangeData.set('test-campaign', {});

        await request(createTestApp())
            .put('/api/campaigns/test-campaign/maps/battle-arena.json/activate');

        expect(changeData.characterChangeData.get('test-campaign').__map__).toEqual({ activeMapName: 'battle-arena' });
    });

    it('should broadcast the __map__ change via SSE on activate', async () => {
        setupFs(`${mapsDir}/battle-arena.json`, { displayName: 'Battle Arena' });

        await request(createTestApp())
            .put('/api/campaigns/test-campaign/maps/battle-arena.json/activate');

        expect(changeData.publish).toHaveBeenCalledWith(
            'change-test-campaign-__map__',
            { activeMapName: 'battle-arena' },
            'test-campaign'
        );
    });

    it('should clear __map__ when the active map is deleted', async () => {
        setupFs(`${mapsDir}/battle-arena.json`, { displayName: 'Battle Arena' });
        MOCK_ACTIVE_MAPS.set('test-campaign', 'battle-arena');
        changeData.characterChangeData.set('test-campaign', { __map__: { activeMapName: 'battle-arena' } });

        await request(createTestApp())
            .delete('/api/campaigns/test-campaign/maps/battle-arena.json');

        expect(changeData.characterChangeData.get('test-campaign').__map__).toEqual({ activeMapName: null });
    });

    it('should leave __map__ untouched when a non-active map is deleted', async () => {
        setupFs(`${mapsDir}/test-map.json`, { displayName: 'Test Map' });
        changeData.characterChangeData.set('test-campaign', { __map__: { activeMapName: 'battle-arena' } });

        await request(createTestApp())
            .delete('/api/campaigns/test-campaign/maps/test-map.json');

        expect(changeData.characterChangeData.get('test-campaign').__map__).toEqual({ activeMapName: 'battle-arena' });
    });

    it('should update __map__ when the active map is renamed', async () => {
        setupFs(`${mapsDir}/old-arena.json`, { displayName: 'Old Arena' });
        MOCK_ACTIVE_MAPS.set('test-campaign', 'old-arena');
        changeData.characterChangeData.set('test-campaign', { __map__: { activeMapName: 'old-arena' } });

        await request(createTestApp())
            .put('/api/campaigns/test-campaign/maps/old-arena.json/rename')
            .send({ newName: 'New Arena' });

        expect(changeData.characterChangeData.get('test-campaign').__map__).toEqual({ activeMapName: 'new-arena' });
    });

    it('should leave __map__ untouched when a non-active map is renamed', async () => {
        setupFs(`${mapsDir}/side-map.json`, { displayName: 'Side Map' });
        changeData.characterChangeData.set('test-campaign', { __map__: { activeMapName: 'battle-arena' } });

        await request(createTestApp())
            .put('/api/campaigns/test-campaign/maps/side-map.json/rename')
            .send({ newName: 'Renamed Side' });

        expect(changeData.characterChangeData.get('test-campaign').__map__).toEqual({ activeMapName: 'battle-arena' });
    });
});
