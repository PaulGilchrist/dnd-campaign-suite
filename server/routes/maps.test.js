import { request } from '../test-utils/localhostSupertest.js';
import express from 'express';
import maps from './maps.js';
import * as changeData from '../utils/changeData.js';

// ─── Mocks ─────────────────────────────────────────────────────────────────────

const MOCK_FS = new Map();
const MOCK_ACTIVE_MAPS = new Map();
let publishedEvents = [];

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
    publishedEvents = [];
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
    publish: vi.fn((key, data) => {
        publishedEvents.push({ key, data });
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

function dirEntry(name, isDir) {
    return {
        name,
        isDirectory: () => isDir,
        isFile: () => !isDir,
    };
}

// ─── GET /api/campaigns/:campaign/maps ─────────────────────────────────────────

describe('maps - GET /api/campaigns/:campaign/maps', () => {
    afterEach(clearMocks);

    it('should return empty maps list when maps directory does not exist', async () => {
        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/maps');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('maps');
        expect(res.body.maps).toEqual([]);
    });

    it('should return all map files in a campaign', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, [
            dirEntry('dungeon-1.json', false),
            dirEntry('town-square.json', false),
            dirEntry('forest-clearing.json', false),
        ]);

        // Pre-populate map data files
        setupFs(`${mapsDir}/dungeon-1.json`, { displayName: 'Dungeon Level 1', type: 'indoor' });
        setupFs(`${mapsDir}/town-square.json`, { displayName: 'Town Square', type: 'indoor' });
        setupFs(`${mapsDir}/forest-clearing.json`, { displayName: 'Forest Clearing', type: 'outdoor' });

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/maps');

        expect(res.status).toBe(200);
        expect(res.body.maps).toHaveLength(3);
        expect(res.body.maps.map(m => m.fileName)).toEqual(['dungeon-1.json', 'forest-clearing.json', 'town-square.json']);
    });

    it('should return maps sorted alphabetically by filename', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, [
            dirEntry('zebra-map.json', false),
            dirEntry('alpha-map.json', false),
            dirEntry('middle-map.json', false),
        ]);

        setupFs(`${mapsDir}/zebra-map.json`, { displayName: 'Zebra', type: 'indoor' });
        setupFs(`${mapsDir}/alpha-map.json`, { displayName: 'Alpha', type: 'indoor' });
        setupFs(`${mapsDir}/middle-map.json`, { displayName: 'Middle', type: 'indoor' });

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/maps');

        expect(res.status).toBe(200);
        const fileNames = res.body.maps.map(m => m.fileName);
        const sorted = [...fileNames].sort();
        expect(fileNames).toEqual(sorted);
    });

    it('should only return .json files, not other file types', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, [
            dirEntry('map1.json', false),
            dirEntry('map1.png', false),
            dirEntry('readme.txt', false),
        ]);

        setupFs(`${mapsDir}/map1.json`, { displayName: 'Map 1' });

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/maps');

        expect(res.status).toBe(200);
        expect(res.body.maps).toHaveLength(1);
        expect(res.body.maps[0].fileName).toBe('map1.json');
    });

    it('should read map type from JSON content', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, [
            dirEntry('outdoor-map.json', false),
            dirEntry('indoor-map.json', false),
        ]);

        setupFs(`${mapsDir}/outdoor-map.json`, { displayName: 'Outdoor Map', type: 'outdoor' });
        setupFs(`${mapsDir}/indoor-map.json`, { displayName: 'Indoor Map', type: 'indoor' });

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/maps');

        expect(res.status).toBe(200);
        const outdoorMap = res.body.maps.find(m => m.fileName === 'outdoor-map.json');
        const indoorMap = res.body.maps.find(m => m.fileName === 'indoor-map.json');
        expect(outdoorMap.type).toBe('outdoor');
        expect(indoorMap.type).toBe('indoor');
    });

    it('should default to indoor type when type is not specified in JSON', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, [
            dirEntry('no-type-map.json', false),
        ]);

        setupFs(`${mapsDir}/no-type-map.json`, { displayName: 'No Type Map' });

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/maps');

        expect(res.status).toBe(200);
        expect(res.body.maps[0].type).toBe('indoor');
    });

    it('should use displayName from JSON content', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, [
            dirEntry('my-dungeon-level-3.json', false),
        ]);

        setupFs(`${mapsDir}/my-dungeon-level-3.json`, { displayName: 'Dungeon Level III', type: 'indoor' });

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/maps');

        expect(res.status).toBe(200);
        expect(res.body.maps[0].name).toBe('Dungeon Level III');
        expect(res.body.maps[0].fileName).toBe('my-dungeon-level-3.json');
    });

    it('should use filename as display name when displayName is not in JSON', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, [
            dirEntry('town-square.json', false),
        ]);

        setupFs(`${mapsDir}/town-square.json`, { type: 'indoor' });

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/maps');

        expect(res.status).toBe(200);
        expect(res.body.maps[0].name).toBe('town-square');
        expect(res.body.maps[0].fileName).toBe('town-square.json');
    });

    it('should mark the active map correctly', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, [
            dirEntry('map-a.json', false),
            dirEntry('map-b.json', false),
            dirEntry('map-c.json', false),
        ]);

        setupFs(`${mapsDir}/map-a.json`, { displayName: 'Map A', type: 'indoor' });
        setupFs(`${mapsDir}/map-b.json`, { displayName: 'Map B', type: 'indoor' });
        setupFs(`${mapsDir}/map-c.json`, { displayName: 'Map C', type: 'indoor' });
        setupActiveMap('test-campaign', 'map-b');

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/maps');

        expect(res.status).toBe(200);
        const mapB = res.body.maps.find(m => m.fileName === 'map-b.json');
        const mapA = res.body.maps.find(m => m.fileName === 'map-a.json');
        expect(mapB.isActive).toBe(true);
        expect(mapA.isActive).toBe(false);
    });

    it('should have no active map when none is set', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, [
            dirEntry('map-a.json', false),
        ]);

        setupFs(`${mapsDir}/map-a.json`, { displayName: 'Map A' });

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/maps');

        expect(res.status).toBe(200);
        expect(res.body.maps[0].isActive).toBe(false);
    });

    it('should handle malformed JSON gracefully (fallback to defaults)', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, [
            dirEntry('bad-json.json', false),
        ]);

        // Store raw string instead of parsed object to simulate malformed JSON
        const fsModule = await import('fs');
        const originalReadFileSync = fsModule.default.readFileSync;
        fsModule.default.readFileSync = vi.fn((path) => {
            if (path.includes('bad-json.json')) return '{invalid json content';
            return originalReadFileSync(path);
        });

        MOCK_FS.set(mapsDir, [
            dirEntry('bad-json.json', false),
        ]);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/maps');

        expect(res.status).toBe(200);
        expect(res.body.maps).toHaveLength(1);
        expect(res.body.maps[0].type).toBe('indoor');
    });

    it('should return only maps for the specified campaign', async () => {
        const mapsDir = '/mock/campaigns/other-campaign/maps';
        MOCK_FS.set(mapsDir, [
            dirEntry('other-map.json', false),
        ]);

        setupFs(`${mapsDir}/other-map.json`, { displayName: 'Other Map' });

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/maps');

        expect(res.status).toBe(200);
        expect(res.body.maps).toEqual([]);
    });

    it('should handle campaign names with special characters', async () => {
        const mapsDir = '/mock/campaigns/my-special-campaign-123/maps';
        MOCK_FS.set(mapsDir, [
            dirEntry('map1.json', false),
        ]);

        setupFs(`${mapsDir}/map1.json`, { displayName: 'Map 1' });

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/my-special-campaign-123/maps');

        expect(res.status).toBe(200);
        expect(res.body.maps).toHaveLength(1);
    });

    it('should return map objects with all expected fields', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, [
            dirEntry('full-map.json', false),
        ]);

        setupFs(`${mapsDir}/full-map.json`, { displayName: 'Full Map', type: 'indoor' });

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/maps');

        expect(res.status).toBe(200);
        const map = res.body.maps[0];
        expect(map).toHaveProperty('name');
        expect(map).toHaveProperty('fileName');
        expect(map).toHaveProperty('type');
        expect(map).toHaveProperty('isActive');
    });
});

// ─── POST /api/campaigns/:campaign/maps ────────────────────────────────────────

describe('maps - POST /api/campaigns/:campaign/maps', () => {
    afterEach(clearMocks);

    it('should return 400 when name is missing', async () => {
        const app = createTestApp();
        const res = await request(app).post('/api/campaigns/test-campaign/maps').send({});

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'Map name is required');
    });

    it('should return 400 when name is empty string', async () => {
        const app = createTestApp();
        const res = await request(app).post('/api/campaigns/test-campaign/maps').send({ name: '' });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'Map name is required');
    });

    it('should return 400 when name is whitespace only', async () => {
        const app = createTestApp();
        const res = await request(app).post('/api/campaigns/test-campaign/maps').send({ name: '   ' });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'Map name is required');
    });

    it('should create an indoor map with default values', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, []);

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'Dungeon Level 1', gridSize: 10, type: 'indoor' });

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('message', 'Map created successfully');
        expect(res.body).toHaveProperty('map');
        expect(res.body.map.name).toBe('Dungeon Level 1');

        const mapPath = `${mapsDir}/dungeon-level-1.json`;
        expect(MOCK_FS.has(mapPath)).toBe(true);
        const mapData = JSON.parse(MOCK_FS.get(mapPath));
        expect(mapData.displayName).toBe('Dungeon Level 1');
        expect(mapData.name).toBe('dungeon-level-1');
        expect(mapData.type).toBe('indoor');
        expect(mapData.gridSize).toBe(10);
        expect(mapData.walls).toEqual([]);
        expect(mapData.placedItems).toEqual([]);
        expect(mapData.zoom).toBe(1);
        expect(mapData.panX).toBe(0);
        expect(mapData.panY).toBe(0);
    });

    it('should create an outdoor map without walls/items', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, []);

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'Forest Region', gridSize: 50, type: 'outdoor' });

        expect(res.status).toBe(201);

        const mapPath = `${mapsDir}/forest-region.json`;
        const mapData = JSON.parse(MOCK_FS.get(mapPath));
        expect(mapData.type).toBe('outdoor');
        expect(mapData).not.toHaveProperty('walls');
        expect(mapData).not.toHaveProperty('placedItems');
        expect(mapData.gridSize).toBe(50);
        expect(mapData.terrain).toEqual({});
        expect(mapData.pois).toEqual([]);
    });

    it('should clamp gridSize to valid range (5-100)', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, []);

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'Tiny Map', gridSize: 1, type: 'indoor' });

        expect(res.status).toBe(201);
        const mapPath = `${mapsDir}/tiny-map.json`;
        const mapData = JSON.parse(MOCK_FS.get(mapPath));
        expect(mapData.gridSize).toBe(5);
    });

    it('should clamp gridSize to maximum when too large', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, []);

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'Huge Map', gridSize: 200, type: 'indoor' });

        expect(res.status).toBe(201);
        const mapPath = `${mapsDir}/huge-map.json`;
        const mapData = JSON.parse(MOCK_FS.get(mapPath));
        expect(mapData.gridSize).toBe(100);
    });

    it('should use default gridSize of 20 when not provided', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, []);

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'Default Grid Map', type: 'indoor' });

        expect(res.status).toBe(201);
        const mapPath = `${mapsDir}/default-grid-map.json`;
        const mapData = JSON.parse(MOCK_FS.get(mapPath));
        expect(mapData.gridSize).toBe(20);
    });

    it('should return 400 when map with same name already exists', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, []);

        const existingPath = `${mapsDir}/dungeon-level-1.json`;
        MOCK_FS.set(existingPath, JSON.stringify({ displayName: 'Existing Map' }));

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'Dungeon Level 1', type: 'indoor' });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'A map with this name already exists');
    });

    it('should sanitize map name for filename (spaces to hyphens)', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, []);

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'Dungeon   Level   1', type: 'indoor' });

        expect(res.status).toBe(201);
        expect(MOCK_FS.has(`${mapsDir}/dungeon-level-1.json`)).toBe(true);
    });

    it('should sanitize map name for filename (remove special chars)', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, []);

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'Dungeon & Cave!', type: 'indoor' });

        expect(res.status).toBe(201);
        expect(MOCK_FS.has(`${mapsDir}/dungeon--cave.json`)).toBe(true);
    });

    it('should create maps directory if it does not exist', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.delete(mapsDir);

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'New Map', type: 'indoor' });

        expect(res.status).toBe(201);
        expect(MOCK_FS.has(mapsDir)).toBe(true);
    });

    it('should broadcast maps-list change on creation', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, []);

        const app = createTestApp();
        await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'Broadcast Test', type: 'indoor' });

        expect(changeData.publish).toHaveBeenCalledWith(
            'maps-list-test-campaign',
            { action: 'created', map: { name: 'Broadcast Test', fileName: 'broadcast-test.json' } },
            'test-campaign'
        );
    });

    it('should preserve provided walls on indoor map', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, []);

        const walls = [
            { x1: 0, y1: 0, x2: 10, y2: 0 },
            { x1: 10, y1: 0, x2: 10, y2: 10 },
        ];

        const app = createTestApp();
        await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'Walled Room', type: 'indoor', walls });

        const mapPath = `${mapsDir}/walled-room.json`;
        const mapData = JSON.parse(MOCK_FS.get(mapPath));
        expect(mapData.walls).toEqual(walls);
    });

    it('should preserve provided placedItems on indoor map', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, []);

        const items = [{ type: 'token', x: 5, y: 5 }];

        const app = createTestApp();
        await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'Items Map', type: 'indoor', placedItems: items });

        const mapPath = `${mapsDir}/items-map.json`;
        const mapData = JSON.parse(MOCK_FS.get(mapPath));
        expect(mapData.placedItems).toEqual(items);
    });

    it('should preserve provided terrain on outdoor map', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, []);

        const terrain = { grass: '#228B22', water: '#1E90FF' };

        const app = createTestApp();
        await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'Terrain Map', type: 'outdoor', terrain });

        const mapPath = `${mapsDir}/terrain-map.json`;
        const mapData = JSON.parse(MOCK_FS.get(mapPath));
        expect(mapData.terrain).toEqual(terrain);
    });

    it('should preserve provided pois on outdoor map', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, []);

        const pois = [{ name: 'Tree', x: 10, y: 20 }];

        const app = createTestApp();
        await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'POI Map', type: 'outdoor', pois });

        const mapPath = `${mapsDir}/poi-map.json`;
        const mapData = JSON.parse(MOCK_FS.get(mapPath));
        expect(mapData.pois).toEqual(pois);
    });

    it('should preserve optional indoor fields (fog, paintCells, items, players, rooms)', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, []);

        const app = createTestApp();
        await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({
                name: 'Complex Map',
                type: 'indoor',
                fog: [{ cells: [[0, 0, 5, 5]] }],
                paintCells: [{ x: 1, y: 1, color: 'red' }],
                items: [{ type: 'token' }],
                players: [{ name: 'Hero', x: 0, y: 0 }],
                rooms: [{ name: 'Room 1', cells: [[0, 0, 5, 5]] }],
            });

        const mapPath = `${mapsDir}/complex-map.json`;
        const mapData = JSON.parse(MOCK_FS.get(mapPath));
        expect(mapData.fog).toEqual([{ cells: [[0, 0, 5, 5]] }]);
        expect(mapData.paintCells).toEqual([{ x: 1, y: 1, color: 'red' }]);
        expect(mapData.items).toEqual([{ type: 'token' }]);
        expect(mapData.players).toEqual([{ name: 'Hero', x: 0, y: 0 }]);
        expect(mapData.rooms).toEqual([{ name: 'Room 1', cells: [[0, 0, 5, 5]] }]);
    });

    it('should preserve parentHex, parentTerrain, bgFill, generationMode, description, seed on indoor maps', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, []);

        const app = createTestApp();
        await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({
                name: 'Detailed Map',
                type: 'indoor',
                parentHex: { x: 1, y: 2 },
                parentTerrain: 'forest',
                bgFill: '#333333',
                generationMode: 'random',
                description: 'A detailed map',
                seed: 42,
            });

        const mapPath = `${mapsDir}/detailed-map.json`;
        const mapData = JSON.parse(MOCK_FS.get(mapPath));
        expect(mapData.parentHex).toEqual({ x: 1, y: 2 });
        expect(mapData.parentTerrain).toBe('forest');
        expect(mapData.bgFill).toBe('#333333');
        expect(mapData.generationMode).toBe('random');
        expect(mapData.description).toBe('A detailed map');
        expect(mapData.seed).toBe(42);
    });

    it('should handle names with uppercase letters', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, []);

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'DUNGEON LEVEL 1', type: 'indoor' });

        expect(res.status).toBe(201);
        expect(MOCK_FS.has(`${mapsDir}/dungeon-level-1.json`)).toBe(true);
    });

    it('should handle names with numbers', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, []);

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'Map 123', type: 'indoor' });

        expect(res.status).toBe(201);
        expect(MOCK_FS.has(`${mapsDir}/map-123.json`)).toBe(true);
    });
});

// ─── GET /api/campaigns/:campaign/maps/:mapname ────────────────────────────────

describe('maps - GET /api/campaigns/:campaign/maps/:mapname', () => {
    afterEach(clearMocks);

    it('should return 404 when map file does not exist', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, []);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/maps/nonexistent.json');

        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error', 'Map not found');
    });

    it('should return map data when file exists', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, []);

        const mapData = {
            displayName: 'Test Map',
            name: 'test-map',
            type: 'indoor',
            gridSize: 10,
            walls: [{ x1: 0, y1: 0, x2: 10, y2: 0 }],
            zoom: 1.5,
        };

        setupFs(`${mapsDir}/test-map.json`, mapData);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/maps/test-map.json');

        expect(res.status).toBe(200);
        expect(res.body).toEqual(mapData);
    });

    it('should normalize mapname without .json extension', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, []);

        setupFs(`${mapsDir}/test-map.json`, { displayName: 'Test Map' });

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/maps/test-map');

        expect(res.status).toBe(200);
        expect(res.body.displayName).toBe('Test Map');
    });

    it('should return full map data including all fields', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, []);

        const mapData = {
            displayName: 'Full Map',
            name: 'full-map',
            type: 'indoor',
            gridSize: 15,
            walls: [],
            placedItems: [],
            paintCells: [],
            items: [],
            players: [],
            fog: [],
            rooms: [],
            zoom: 2,
            panX: 100,
            panY: 200,
        };

        setupFs(`${mapsDir}/full-map.json`, mapData);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/maps/full-map.json');

        expect(res.status).toBe(200);
        expect(res.body).toEqual(mapData);
    });

    it('should handle campaign names with special characters', async () => {
        const mapsDir = '/mock/campaigns/my-special-campaign/maps';
        MOCK_FS.set(mapsDir, []);

        setupFs(`${mapsDir}/map1.json`, { displayName: 'Map 1' });

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/my-special-campaign/maps/map1.json');

        expect(res.status).toBe(200);
        expect(res.body.displayName).toBe('Map 1');
    });
});

// ─── PUT /api/campaigns/:campaign/maps/:mapname ────────────────────────────────

describe('maps - PUT /api/campaigns/:campaign/maps/:mapname', () => {
    afterEach(clearMocks);

    it('should save map data and return success', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, []);

        const initialData = { displayName: 'Old Name', name: 'old-name', type: 'indoor' };
        setupFs(`${mapsDir}/test-map.json`, initialData);

        const updatedData = { displayName: 'New Name', name: 'new-name', type: 'indoor', gridSize: 25 };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/maps/test-map.json')
            .send(updatedData);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('message', 'Map saved successfully');

        const savedData = JSON.parse(MOCK_FS.get(`${mapsDir}/test-map.json`));
        expect(savedData.displayName).toBe('New Name');
        expect(savedData.gridSize).toBe(25);
    });

    it('should create maps directory if it does not exist', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.delete(mapsDir);

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/maps/new-map.json')
            .send({ displayName: 'New Map', type: 'indoor' });

        expect(res.status).toBe(200);
        expect(MOCK_FS.has(mapsDir)).toBe(true);
    });

    it('should broadcast map-data change on save', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, []);

        setupFs(`${mapsDir}/test-map.json`, { displayName: 'Test Map' });

        const app = createTestApp();
        await request(app)
            .put('/api/campaigns/test-campaign/maps/test-map.json')
            .send({ displayName: 'Updated Map' });

        expect(changeData.publish).toHaveBeenCalledWith(
            'map-data-test-campaign-test-map',
            expect.objectContaining({ displayName: 'Updated Map' }),
            'test-campaign'
        );
    });

    it('should handle saving outdoor map data', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, []);

        setupFs(`${mapsDir}/outdoor.json`, { displayName: 'Outdoor', type: 'outdoor', terrain: {} });

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/maps/outdoor.json')
            .send({ displayName: 'Updated Outdoor', type: 'outdoor', terrain: { grass: '#228B22' }, pois: [] });

        expect(res.status).toBe(200);
        const savedData = JSON.parse(MOCK_FS.get(`${mapsDir}/outdoor.json`));
        expect(savedData.terrain).toEqual({ grass: '#228B22' });
    });

    it('should handle campaign names with special characters', async () => {
        const mapsDir = '/mock/campaigns/test-campaign-123/maps';
        MOCK_FS.set(mapsDir, []);

        setupFs(`${mapsDir}/map1.json`, { displayName: 'Map 1' });

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign-123/maps/map1.json')
            .send({ displayName: 'Updated Map 1' });

        expect(res.status).toBe(200);
    });
});

// ─── DELETE /api/campaigns/:campaign/maps/:mapname ─────────────────────────────

describe('maps - DELETE /api/campaigns/:campaign/maps/:mapname', () => {
    afterEach(clearMocks);

    it('should return 404 when map file does not exist', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, []);

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-campaign/maps/nonexistent.json');

        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error', 'Map not found');
    });

    it('should delete the map file and return success', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, []);

        setupFs(`${mapsDir}/test-map.json`, { displayName: 'To Delete' });

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-campaign/maps/test-map.json');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('message', 'Map deleted successfully');
        expect(MOCK_FS.has(`${mapsDir}/test-map.json`)).toBe(false);
    });

    it('should clear active map if deleted map was active', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, []);

        setupFs(`${mapsDir}/active-map.json`, { displayName: 'Active Map' });
        // Key is stored without .json extension in the code
        setupActiveMap('test-campaign', 'active-map');

        const app = createTestApp();
        await request(app).delete('/api/campaigns/test-campaign/maps/active-map.json');

        expect(changeData.activeMaps.delete).toHaveBeenCalledTimes(1);
    });

    it('should not clear active map if deleted map was not active', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, []);

        setupFs(`${mapsDir}/map-a.json`, { displayName: 'Map A' });
        setupFs(`${mapsDir}/map-b.json`, { displayName: 'Map B' });
        setupActiveMap('test-campaign', 'map-b.json');

        const app = createTestApp();
        await request(app).delete('/api/campaigns/test-campaign/maps/map-a.json');

        expect(MOCK_ACTIVE_MAPS.get('test-campaign')).toBe('map-b.json');
    });

    it('should broadcast maps-list change on deletion', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, []);

        setupFs(`${mapsDir}/test-map.json`, { displayName: 'To Delete' });

        const app = createTestApp();
        await request(app).delete('/api/campaigns/test-campaign/maps/test-map.json');

        expect(changeData.publish).toHaveBeenCalledWith(
            'maps-list-test-campaign',
            expect.objectContaining({ action: 'deleted' }),
            'test-campaign'
        );
    });

    it('should normalize mapname without .json extension', async () => {
        const mapsDir = '/mock/campaigns/test-campaign/maps';
        MOCK_FS.set(mapsDir, []);

        setupFs(`${mapsDir}/test-map.json`, { displayName: 'To Delete' });

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-campaign/maps/test-map');

        expect(res.status).toBe(200);
        expect(MOCK_FS.has(`${mapsDir}/test-map.json`)).toBe(false);
    });

    it('should handle campaign names with special characters', async () => {
        const mapsDir = '/mock/campaigns/test-campaign-123/maps';
        MOCK_FS.set(mapsDir, []);

        setupFs(`${mapsDir}/map1.json`, { displayName: 'Map 1' });

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-campaign-123/maps/map1.json');

        expect(res.status).toBe(200);
    });
});
