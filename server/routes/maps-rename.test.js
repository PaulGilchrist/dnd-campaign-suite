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

function setupActiveMap(campaign, mapKey) {
    if (mapKey === null) {
        MOCK_ACTIVE_MAPS.delete(campaign);
    } else {
        MOCK_ACTIVE_MAPS.set(campaign, mapKey);
    }
}

function clearMocks() {
    MOCK_FS.clear();
    MOCK_ACTIVE_MAPS.clear();
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
    publish: vi.fn((_key, _data) => {
        // captured by tests that need it
    }),
    activeMaps: {
        get: vi.fn((campaign) => MOCK_ACTIVE_MAPS.get(campaign)),
        set: vi.fn((campaign, value) => {
            MOCK_ACTIVE_MAPS.set(campaign, value);
        }),
        delete: vi.fn((campaign) => {
            MOCK_ACTIVE_MAPS.delete(campaign);
        }),
    },
}));

// ─── Helpers ───────────────────────────────────────────────────────────────────

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(maps);
    return app;
}

// ─── PUT /api/campaigns/:campaign/maps/:mapname/rename ─────────────────────────

describe('maps - PUT /api/campaigns/:campaign/maps/:mapname/rename', () => {
    afterEach(clearMocks);

    it('should return 400 when newName is missing', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, []);

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/maps/old-map.json/rename')
            .send({});

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'New map name is required');
    });

    it('should return 400 when newName is empty string', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, []);

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/maps/old-map.json/rename')
            .send({ newName: '' });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'New map name is required');
    });

    it('should return 400 when newName is whitespace only', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, []);

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/maps/old-map.json/rename')
            .send({ newName: '   ' });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'New map name is required');
    });

    it('should return 404 when old map does not exist', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, []);

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/maps/nonexistent.json/rename')
            .send({ newName: 'New Name' });

        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error', 'Map not found');
    });

    it('should return 400 when new name already exists (different from old)', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, []);

        setupFs(`${mapsDir}/old-map.json`, { displayName: 'Old Map' });
        setupFs(`${mapsDir}/new-map.json`, { displayName: 'New Map' });

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/maps/old-map.json/rename')
            .send({ newName: 'New Map' });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'A map with this name already exists');
    });

    it('should rename the map file successfully', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, []);

        setupFs(`${mapsDir}/old-map.json`, { displayName: 'Old Map', name: 'old-map', type: 'indoor' });

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/maps/old-map.json/rename')
            .send({ newName: 'Renamed Map' });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('message', 'Map renamed successfully');
        expect(res.body).toHaveProperty('map');
        expect(res.body.map.name).toBe('Renamed Map');
        expect(res.body.map.fileName).toBe('renamed-map.json');

        // Old file should be deleted
        expect(MOCK_FS.has(`${mapsDir}/old-map.json`)).toBe(false);
        // New file should exist
        expect(MOCK_FS.has(`${mapsDir}/renamed-map.json`)).toBe(true);

        const newMapData = JSON.parse(MOCK_FS.get(`${mapsDir}/renamed-map.json`));
        expect(newMapData.displayName).toBe('Renamed Map');
        expect(newMapData.name).toBe('renamed-map');
    });

    it('should update displayName and name in the map data', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, []);

        setupFs(`${mapsDir}/old-name.json`, { displayName: 'Old', name: 'old-name', type: 'indoor', gridSize: 10 });

        const app = createTestApp();
        await request(app)
            .put('/api/campaigns/test-campaign/maps/old-name.json/rename')
            .send({ newName: 'Completely New Name' });

        const newData = JSON.parse(MOCK_FS.get(`${mapsDir}/completely-new-name.json`));
        expect(newData.displayName).toBe('Completely New Name');
        expect(newData.name).toBe('completely-new-name');
        expect(newData.gridSize).toBe(10);
    });

    it('should update active map in memory when file name changes', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, []);

        setupFs(`${mapsDir}/old-name.json`, { displayName: 'Old' });
        // Store the key without .json to match how the code stores it internally
        setupActiveMap('test-campaign', 'old-name');

        const app = createTestApp();
        await request(app)
            .put('/api/campaigns/test-campaign/maps/old-name.json/rename')
            .send({ newName: 'New Name' });

        expect(MOCK_ACTIVE_MAPS.get('test-campaign')).toBe('new-name');
    });

    it('should NOT update active map when only displayName changes (same filename)', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, []);

        setupFs(`${mapsDir}/old-name.json`, { displayName: 'Old', name: 'old-name', type: 'indoor' });
        setupActiveMap('test-campaign', 'old-name.json');

        // Rename to same kebab-case name (e.g., "Old Name" -> "old-name")
        const app = createTestApp();
        await request(app)
            .put('/api/campaigns/test-campaign/maps/old-name.json/rename')
            .send({ newName: 'Old Name' });

        // Since oldFileName === newFileName, the file isn't moved and active map key stays the same
        expect(MOCK_ACTIVE_MAPS.get('test-campaign')).toBe('old-name.json');
        expect(MOCK_FS.has(`${mapsDir}/old-name.json`)).toBe(true);
    });

    it('should broadcast maps-list change with old and new names', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, []);

        setupFs(`${mapsDir}/old-map.json`, { displayName: 'Old Map' });

        const app = createTestApp();
        await request(app)
            .put('/api/campaigns/test-campaign/maps/old-map.json/rename')
            .send({ newName: 'New Map' });

        expect(changeData.publish).toHaveBeenCalledWith(
            'maps-list-test-campaign',
            expect.objectContaining({
                action: 'renamed',
            }),
            'test-campaign'
        );
    });

    it('should preserve other map data fields during rename', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, []);

        const originalData = {
            displayName: 'Old',
            name: 'old',
            type: 'indoor',
            gridSize: 15,
            walls: [{ x1: 0, y1: 0, x2: 10, y2: 0 }],
            placedItems: [{ type: 'token' }],
            fog: [],
            zoom: 2,
        };

        setupFs(`${mapsDir}/old.json`, originalData);

        const app = createTestApp();
        await request(app)
            .put('/api/campaigns/test-campaign/maps/old.json/rename')
            .send({ newName: 'New Name' });

        const newData = JSON.parse(MOCK_FS.get(`${mapsDir}/new-name.json`));
        expect(newData.type).toBe('indoor');
        expect(newData.gridSize).toBe(15);
        expect(newData.walls).toEqual([{ x1: 0, y1: 0, x2: 10, y2: 0 }]);
        expect(newData.placedItems).toEqual([{ type: 'token' }]);
        expect(newData.fog).toEqual([]);
        expect(newData.zoom).toBe(2);
    });

    it('should handle names with uppercase letters', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, []);

        setupFs(`${mapsDir}/old.json`, { displayName: 'Old' });

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/maps/old.json/rename')
            .send({ newName: 'UPPERCASE NAME' });

        expect(res.status).toBe(200);
        expect(MOCK_FS.has(`${mapsDir}/uppercase-name.json`)).toBe(true);
    });

    it('should handle names with special characters', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, []);

        setupFs(`${mapsDir}/old.json`, { displayName: 'Old' });

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/maps/old.json/rename')
            .send({ newName: 'Map & Cave!' });

        expect(res.status).toBe(200);
        expect(MOCK_FS.has(`${mapsDir}/map--cave.json`)).toBe(true);
    });

    it('should handle campaign names with special characters', async () => {
        const mapsDir = '/mock/campaigns/test-campaign-123/maps';
        MOCK_FS.set(mapsDir, []);

        setupFs(`${mapsDir}/map1.json`, { displayName: 'Map 1' });

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign-123/maps/map1.json/rename')
            .send({ newName: 'Renamed Map' });

        expect(res.status).toBe(200);
    });
});

// ─── PUT /api/campaigns/:campaign/maps/:mapname/activate ──────────────────────

describe('maps - PUT /api/campaigns/:campaign/maps/:mapname/activate', () => {
    afterEach(clearMocks);

    it('should return 404 when map file does not exist', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, []);

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/maps/nonexistent.json/activate');

        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error', 'Map not found');
    });

    it('should activate the map and return success', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, []);

        setupFs(`${mapsDir}/map-to-activate.json`, { displayName: 'To Activate' });

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/maps/map-to-activate.json/activate');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('message', 'Map activated successfully');
        expect(res.body).toHaveProperty('activeMap', 'map-to-activate');

        expect(MOCK_ACTIVE_MAPS.get('test-campaign')).toBe('map-to-activate');
    });

    it('should switch active map from a previously active one', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, []);

        setupFs(`${mapsDir}/map-a.json`, { displayName: 'Map A' });
        setupFs(`${mapsDir}/map-b.json`, { displayName: 'Map B' });
        setupActiveMap('test-campaign', 'map-a.json');

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/maps/map-b.json/activate');

        expect(res.status).toBe(200);
        expect(res.body.activeMap).toBe('map-b');
        expect(MOCK_ACTIVE_MAPS.get('test-campaign')).toBe('map-b');
    });

    it('should broadcast map-activate change', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, []);

        setupFs(`${mapsDir}/map-x.json`, { displayName: 'Map X' });

        const app = createTestApp();
        await request(app)
            .put('/api/campaigns/test-campaign/maps/map-x.json/activate');

        expect(changeData.publish).toHaveBeenCalledWith(
            'map-activate-test-campaign',
            { activeMap: 'map-x' },
            'test-campaign'
        );
    });

    it('should broadcast maps-list change with activation', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, []);

        setupFs(`${mapsDir}/map-y.json`, { displayName: 'Map Y' });

        const app = createTestApp();
        await request(app)
            .put('/api/campaigns/test-campaign/maps/map-y.json/activate');

        expect(changeData.publish).toHaveBeenCalledWith(
            'maps-list-test-campaign',
            { action: 'activated', activeMap: 'map-y' },
            'test-campaign'
        );
    });

    it('should normalize mapname without .json extension', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, []);

        setupFs(`${mapsDir}/map-no-ext.json`, { displayName: 'No Ext' });

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/maps/map-no-ext/activate');

        expect(res.status).toBe(200);
        expect(MOCK_ACTIVE_MAPS.get('test-campaign')).toBe('map-no-ext');
    });

    it('should handle campaign names with special characters', async () => {
        const mapsDir = '/mock/campaigns/test-campaign-123/maps';
        MOCK_FS.set(mapsDir, []);

        setupFs(`${mapsDir}/map1.json`, { displayName: 'Map 1' });

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign-123/maps/map1.json/activate');

        expect(res.status).toBe(200);
    });
});

// ─── GET /api/campaigns/:campaign/active-map ───────────────────────────────────

describe('maps - GET /api/campaigns/:campaign/active-map', () => {
    afterEach(clearMocks);

    it('should return null when no map is active', async () => {
        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/active-map');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('activeMapName', null);
    });

    it('should return the active map name when one is set', async () => {
        setupActiveMap('test-campaign', 'current-map.json');

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/active-map');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('activeMapName', 'current-map.json');
    });

    it('should return null when active map was cleared', async () => {
        setupActiveMap('test-campaign', 'some-map.json');
        MOCK_ACTIVE_MAPS.delete('test-campaign');

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/active-map');

        expect(res.status).toBe(200);
        expect(res.body.activeMapName).toBeNull();
    });

    it('should handle different campaigns having different active maps', async () => {
        setupActiveMap('campaign-a', 'map-a.json');
        setupActiveMap('campaign-b', 'map-b.json');

        const app = createTestApp();

        const resA = await request(app).get('/api/campaigns/campaign-a/active-map');
        expect(resA.body.activeMapName).toBe('map-a.json');

        const resB = await request(app).get('/api/campaigns/campaign-b/active-map');
        expect(resB.body.activeMapName).toBe('map-b.json');
    });

    it('should handle campaign names with special characters', async () => {
        setupActiveMap('test-campaign-123', 'map1.json');

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign-123/active-map');

        expect(res.status).toBe(200);
        expect(res.body.activeMapName).toBe('map1.json');
    });
});

// ─── PUT /api/campaigns/:campaign/maps/:mapname/description ────────────────────

describe('maps - PUT /api/campaigns/:campaign/maps/:mapname/description', () => {
    afterEach(clearMocks);

    it('should return 404 when map file does not exist', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, []);

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/maps/nonexistent.json/description')
            .send({ description: 'New description' });

        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error', 'Map not found');
    });

    it('should update the description and return success', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, []);

        setupFs(`${mapsDir}/test-map.json`, { displayName: 'Test Map', description: 'Old description' });

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/maps/test-map.json/description')
            .send({ description: 'New description' });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('message', 'Map description updated successfully');

        const updatedData = JSON.parse(MOCK_FS.get(`${mapsDir}/test-map.json`));
        expect(updatedData.description).toBe('New description');
    });

    it('should set description to empty string when not provided', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, []);

        setupFs(`${mapsDir}/test-map.json`, { displayName: 'Test Map', description: 'Some description' });

        const app = createTestApp();
        await request(app)
            .put('/api/campaigns/test-campaign/maps/test-map.json/description')
            .send({ description: '' });

        const updatedData = JSON.parse(MOCK_FS.get(`${mapsDir}/test-map.json`));
        expect(updatedData.description).toBe('');
    });

    it('should broadcast map-data change after updating description', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, []);

        setupFs(`${mapsDir}/test-map.json`, { displayName: 'Test Map' });

        const app = createTestApp();
        await request(app)
            .put('/api/campaigns/test-campaign/maps/test-map.json/description')
            .send({ description: 'Broadcast test' });

        expect(changeData.publish).toHaveBeenCalledWith(
            'map-data-test-campaign-test-map',
            expect.objectContaining({ description: 'Broadcast test' }),
            'test-campaign'
        );
    });

    it('should preserve all other map fields when updating description', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, []);

        const originalData = {
            displayName: 'Full Map',
            name: 'full-map',
            type: 'indoor',
            gridSize: 20,
            walls: [{ x1: 0, y1: 0, x2: 10, y2: 0 }],
            description: 'Old desc',
            zoom: 1.5,
        };

        setupFs(`${mapsDir}/full-map.json`, originalData);

        const app = createTestApp();
        await request(app)
            .put('/api/campaigns/test-campaign/maps/full-map.json/description')
            .send({ description: 'Updated desc' });

        const updatedData = JSON.parse(MOCK_FS.get(`${mapsDir}/full-map.json`));
        expect(updatedData.displayName).toBe('Full Map');
        expect(updatedData.name).toBe('full-map');
        expect(updatedData.type).toBe('indoor');
        expect(updatedData.gridSize).toBe(20);
        expect(updatedData.walls).toEqual([{ x1: 0, y1: 0, x2: 10, y2: 0 }]);
        expect(updatedData.description).toBe('Updated desc');
        expect(updatedData.zoom).toBe(1.5);
    });

    it('should handle description with special characters', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, []);

        setupFs(`${mapsDir}/test-map.json`, { displayName: 'Test Map' });

        const specialDesc = 'Dragon: ドラゴン 🐉 <script>alert("xss")</script>';

        const app = createTestApp();
        await request(app)
            .put('/api/campaigns/test-campaign/maps/test-map.json/description')
            .send({ description: specialDesc });

        const updatedData = JSON.parse(MOCK_FS.get(`${mapsDir}/test-map.json`));
        expect(updatedData.description).toBe(specialDesc);
    });

    it('should handle description with newlines and long text', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, []);

        setupFs(`${mapsDir}/test-map.json`, { displayName: 'Test Map' });

        const longDesc = 'A'.repeat(5000) + '\n\n' + 'B'.repeat(5000);

        const app = createTestApp();
        await request(app)
            .put('/api/campaigns/test-campaign/maps/test-map.json/description')
            .send({ description: longDesc });

        const updatedData = JSON.parse(MOCK_FS.get(`${mapsDir}/test-map.json`));
        expect(updatedData.description).toBe(longDesc);
    });

    it('should normalize mapname without .json extension', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, []);

        setupFs(`${mapsDir}/test-map.json`, { displayName: 'Test Map' });

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/maps/test-map/description')
            .send({ description: 'No extension test' });

        expect(res.status).toBe(200);
    });

    it('should handle campaign names with special characters', async () => {
        const mapsDir = '/mock/campaigns/test-campaign-123/maps';
        MOCK_FS.set(mapsDir, []);

        setupFs(`${mapsDir}/map1.json`, { displayName: 'Map 1' });

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign-123/maps/map1.json/description')
            .send({ description: 'Special campaign' });

        expect(res.status).toBe(200);
    });
});
