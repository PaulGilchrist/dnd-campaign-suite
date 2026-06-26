import request from 'supertest';
import express from 'express';
import fs from 'fs';
import path from 'path';
import mapsRouter from './maps.js';
import { activeMaps } from '../utils/changeData.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(mapsRouter);
    return app;
}

const testCampaignsDir = path.join(process.cwd(), 'public', 'campaigns');

function ensureCampaignsDir() {
    if (!fs.existsSync(testCampaignsDir)) {
        fs.mkdirSync(testCampaignsDir, { recursive: true });
    }
}

function createCampaignDir(name) {
    const campaignDir = path.join(testCampaignsDir, name);
    if (!fs.existsSync(campaignDir)) {
        fs.mkdirSync(campaignDir, { recursive: true });
    }
    return campaignDir;
}

function createMapsDir(campaignName) {
    const mapsDir = path.join(testCampaignsDir, campaignName, 'maps');
    if (!fs.existsSync(mapsDir)) {
        fs.mkdirSync(mapsDir, { recursive: true });
    }
    return mapsDir;
}

function removeCampaignDir(name) {
    const campaignDir = path.join(testCampaignsDir, name);
    if (fs.existsSync(campaignDir)) {
        fs.rmSync(campaignDir, { recursive: true, force: true });
    }
}

function cleanupCampaign(name) {
    removeCampaignDir(name);
    activeMaps.delete(name);
}

describe('maps - GET /api/campaigns/:campaign/maps', () => {
    beforeEach(() => {
        ensureCampaignsDir();
    });

    afterEach(() => {
        cleanupCampaign('test-campaign');
    });

    it('should return empty maps array when maps directory does not exist', async () => {
        createCampaignDir('test-campaign');

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/maps');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('maps');
        expect(res.body.maps).toEqual([]);
    });

    it('should return list of map files with basic properties', async () => {
        const mapsDir = createMapsDir('test-campaign');
        const mapData1 = { displayName: 'Map One', name: 'map-one', type: 'indoor', gridSize: 20 };
        const mapData2 = { displayName: 'Map Two', name: 'map-two', type: 'indoor', gridSize: 15 };
        fs.writeFileSync(path.join(mapsDir, 'map-one.json'), JSON.stringify(mapData1));
        fs.writeFileSync(path.join(mapsDir, 'map-two.json'), JSON.stringify(mapData2));

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/maps');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('maps');
        expect(Array.isArray(res.body.maps)).toBe(true);
        expect(res.body.maps.length).toBe(2);
    });

    it('should return maps sorted by filename', async () => {
        const mapsDir = createMapsDir('test-campaign');
        fs.writeFileSync(path.join(mapsDir, 'zebra-map.json'), JSON.stringify({ displayName: 'Zebra' }));
        fs.writeFileSync(path.join(mapsDir, 'alpha-map.json'), JSON.stringify({ displayName: 'Alpha' }));
        fs.writeFileSync(path.join(mapsDir, 'middle-map.json'), JSON.stringify({ displayName: 'Middle' }));

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/maps');

        expect(res.status).toBe(200);
        const names = res.body.maps.map(m => m.fileName);
        const sorted = [...names].sort();
        expect(names).toEqual(sorted);
    });

    it('should only include .json files', async () => {
        const mapsDir = createMapsDir('test-campaign');
        fs.writeFileSync(path.join(mapsDir, 'map.json'), JSON.stringify({ displayName: 'Valid' }));
        fs.writeFileSync(path.join(mapsDir, 'map.txt'), 'not json');
        fs.writeFileSync(path.join(mapsDir, 'map.png'), 'binary');

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/maps');

        expect(res.status).toBe(200);
        const names = res.body.maps.map(m => m.fileName);
        expect(names).toContain('map.json');
        expect(names).not.toContain('map.txt');
        expect(names).not.toContain('map.png');
    });

    it('should read type from map file content', async () => {
        const mapsDir = createMapsDir('test-campaign');
        const mapData = { displayName: 'Outdoor Map', type: 'outdoor', gridSize: 50 };
        fs.writeFileSync(path.join(mapsDir, 'outdoor.json'), JSON.stringify(mapData));

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/maps');

        expect(res.status).toBe(200);
        const map = res.body.maps.find(m => m.fileName === 'outdoor.json');
        expect(map).toBeDefined();
        expect(map.type).toBe('outdoor');
    });

    it('should default type to indoor when not specified', async () => {
        const mapsDir = createMapsDir('test-campaign');
        const mapData = { displayName: 'Indoor Map' };
        fs.writeFileSync(path.join(mapsDir, 'indoor.json'), JSON.stringify(mapData));

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/maps');

        expect(res.status).toBe(200);
        const map = res.body.maps.find(m => m.fileName === 'indoor.json');
        expect(map.type).toBe('indoor');
    });

    it('should use displayName from map file content', async () => {
        const mapsDir = createMapsDir('test-campaign');
        const mapData = { displayName: 'My Dungeon', name: 'my-dungeon', type: 'indoor' };
        fs.writeFileSync(path.join(mapsDir, 'my-dungeon.json'), JSON.stringify(mapData));

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/maps');

        expect(res.status).toBe(200);
        const map = res.body.maps.find(m => m.fileName === 'my-dungeon.json');
        expect(map.name).toBe('My Dungeon');
    });

    it('should fall back to filename (without .json) when displayName is not provided', async () => {
        const mapsDir = createMapsDir('test-campaign');
        const mapData = { name: 'my-cave', type: 'indoor' };
        fs.writeFileSync(path.join(mapsDir, 'my-cave.json'), JSON.stringify(mapData));

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/maps');

        expect(res.status).toBe(200);
        const map = res.body.maps.find(m => m.fileName === 'my-cave.json');
        expect(map.name).toBe('my-cave');
    });

    it('should mark the active map correctly', async () => {
        const mapsDir = createMapsDir('test-campaign');
        fs.writeFileSync(path.join(mapsDir, 'active-map.json'), JSON.stringify({ displayName: 'Active' }));
        fs.writeFileSync(path.join(mapsDir, 'inactive-map.json'), JSON.stringify({ displayName: 'Inactive' }));
        activeMaps.set('test-campaign', 'active-map');

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/maps');

        expect(res.status).toBe(200);
        const activeMap = res.body.maps.find(m => m.fileName === 'active-map.json');
        const inactiveMap = res.body.maps.find(m => m.fileName === 'inactive-map.json');
        expect(activeMap.isActive).toBe(true);
        expect(inactiveMap.isActive).toBe(false);
    });

    it('should return isActive false for all when no active map is set', async () => {
        const mapsDir = createMapsDir('test-campaign');
        fs.writeFileSync(path.join(mapsDir, 'map-one.json'), JSON.stringify({ displayName: 'One' }));
        fs.writeFileSync(path.join(mapsDir, 'map-two.json'), JSON.stringify({ displayName: 'Two' }));

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/maps');

        expect(res.status).toBe(200);
        expect(res.body.maps.every(m => m.isActive === false)).toBe(true);
    });

    it('should ignore malformed JSON files and use defaults', async () => {
        const mapsDir = createMapsDir('test-campaign');
        fs.writeFileSync(path.join(mapsDir, 'bad-map.json'), 'this is not valid json{{{');
        fs.writeFileSync(path.join(mapsDir, 'good-map.json'), JSON.stringify({ displayName: 'Good' }));

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/maps');

        expect(res.status).toBe(200);
        const badMap = res.body.maps.find(m => m.fileName === 'bad-map.json');
        expect(badMap.type).toBe('indoor');
        expect(badMap.name).toBe('bad-map');
    });

    it('should return 500 on filesystem error', async () => {
        createMapsDir('test-campaign');
        const app = createTestApp();

        const spy = vi.spyOn(fs, 'readdirSync').mockImplementation(() => {
            throw new Error('EACCES: permission denied');
        });

        const res = await request(app).get('/api/campaigns/test-campaign/maps');

        expect(res.status).toBe(500);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('Failed to list maps');

        spy.mockRestore();
    });
});

describe('maps - POST /api/campaigns/:campaign/maps', () => {
    beforeEach(() => {
        ensureCampaignsDir();
    });

    afterEach(() => {
        cleanupCampaign('test-campaign');
    });

    it('should require a map name', async () => {
        createCampaignDir('test-campaign');

        const app = createTestApp();
        const res = await request(app).post('/api/campaigns/test-campaign/maps').send({});

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('Map name is required');
    });

    it('should reject empty string name', async () => {
        createCampaignDir('test-campaign');

        const app = createTestApp();
        const res = await request(app).post('/api/campaigns/test-campaign/maps').send({ name: '' });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Map name is required');
    });

    it('should reject whitespace-only name', async () => {
        createCampaignDir('test-campaign');

        const app = createTestApp();
        const res = await request(app).post('/api/campaigns/test-campaign/maps').send({ name: '   ' });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Map name is required');
    });

    it('should create an indoor map with default values', async () => {
        const campaignDir = createCampaignDir('test-campaign');

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'Dungeon Level 1', gridSize: 10 });

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('message');
        expect(res.body).toHaveProperty('map');
        expect(res.body.map.name).toBe('Dungeon Level 1');
        expect(res.body.map.fileName).toBe('dungeon-level-1.json');

        const mapsDir = path.join(campaignDir, 'maps');
        expect(fs.existsSync(mapsDir)).toBe(true);
        const filePath = path.join(mapsDir, 'dungeon-level-1.json');
        expect(fs.existsSync(filePath)).toBe(true);

        const mapData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        expect(mapData.displayName).toBe('Dungeon Level 1');
        expect(mapData.name).toBe('dungeon-level-1');
        expect(mapData.type).toBe('indoor');
        expect(mapData.gridSize).toBe(10);
        expect(mapData.walls).toEqual([]);
        expect(mapData.placedItems).toEqual([]);
        expect(mapData.paintCells).toEqual([]);
        expect(mapData.items).toEqual([]);
        expect(mapData.players).toEqual([]);
        expect(mapData.fog).toEqual([]);
        expect(mapData.rooms).toEqual([]);
        expect(mapData.zoom).toBe(1);
        expect(mapData.panX).toBe(0);
        expect(mapData.panY).toBe(0);
    });

    it('should create an outdoor map with default values', async () => {
        const campaignDir = createCampaignDir('test-campaign');

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'Forest Clearing', type: 'outdoor', gridSize: 50, terrain: { grass: true }, pois: [{ label: 'Tree' }] });

        expect(res.status).toBe(201);
        expect(res.body.map.fileName).toBe('forest-clearing.json');

        const mapsDir = path.join(campaignDir, 'maps');
        const filePath = path.join(mapsDir, 'forest-clearing.json');
        const mapData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        expect(mapData.type).toBe('outdoor');
        expect(mapData.gridSize).toBe(50);
        expect(mapData.terrain).toEqual({ grass: true });
        expect(mapData.pois).toEqual([{ label: 'Tree' }]);
        expect(mapData.displayName).toBe('Forest Clearing');
        expect(mapData.name).toBe('forest-clearing');
    });

    it('should clamp gridSize between 5 and 100', async () => {
        const campaignDir = createCampaignDir('test-campaign');

        const app = createTestApp();

        const resLow = await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'Tiny Map', gridSize: 1 });
        expect(resLow.status).toBe(201);
        const mapsDirLow = path.join(campaignDir, 'maps');
        const mapDataLow = JSON.parse(fs.readFileSync(path.join(mapsDirLow, 'tiny-map.json'), 'utf-8'));
        expect(mapDataLow.gridSize).toBe(5);

        const resHigh = await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'Huge Map', gridSize: 999 });
        expect(resHigh.status).toBe(201);
        const mapsDirHigh = path.join(campaignDir, 'maps');
        const mapDataHigh = JSON.parse(fs.readFileSync(path.join(mapsDirHigh, 'huge-map.json'), 'utf-8'));
        expect(mapDataHigh.gridSize).toBe(100);
    });

    it('should use default gridSize of 20 when not provided', async () => {
        const campaignDir = createCampaignDir('test-campaign');

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'Default Size' });

        expect(res.status).toBe(201);
        const mapsDir = path.join(campaignDir, 'maps');
        const mapData = JSON.parse(fs.readFileSync(path.join(mapsDir, 'default-size.json'), 'utf-8'));
        expect(mapData.gridSize).toBe(20);
    });

    it('should reject duplicate map names (case-insensitive via sanitization)', async () => {
        createCampaignDir('test-campaign');

        const app = createTestApp();
        await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'Dungeon Level 1' });

        const res = await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'dungeon level 1' });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('A map with this name already exists');
    });

    it('should create maps directory if it does not exist', async () => {
        createCampaignDir('test-campaign');
        // Do NOT create the maps subdirectory

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'New Map' });

        expect(res.status).toBe(201);
        const mapsDir = path.join(testCampaignsDir, 'test-campaign', 'maps');
        expect(fs.existsSync(mapsDir)).toBe(true);
    });

    it('should sanitize special characters in map name', async () => {
        const campaignDir = createCampaignDir('test-campaign');

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'Dungeon #1 - Boss Room!!!' });

        expect(res.status).toBe(201);
        expect(res.body.map.fileName).toBe('dungeon-1---boss-room.json');

        const mapsDir = path.join(campaignDir, 'maps');
        expect(fs.existsSync(path.join(mapsDir, 'dungeon-1---boss-room.json'))).toBe(true);
    });

    it('should write valid JSON to file', async () => {
        const campaignDir = createCampaignDir('test-campaign');

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'Test Map', gridSize: 20, walls: [{ x1: 0, y1: 0, x2: 1, y2: 1 }] });

        expect(res.status).toBe(201);
        const mapsDir = path.join(campaignDir, 'maps');
        const filePath = path.join(mapsDir, 'test-map.json');
        const content = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(content);
        expect(parsed.walls).toEqual([{ x1: 0, y1: 0, x2: 1, y2: 1 }]);
    });

    it('should create an outdoor map with default values', async () => {
        const campaignDir = createCampaignDir('test-campaign');

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'Forest Clearing', type: 'outdoor', gridSize: 50, terrain: { grass: true }, pois: [{ label: 'Tree' }] });

        expect(res.status).toBe(201);
        expect(res.body.map.fileName).toBe('forest-clearing.json');

        const mapsDir = path.join(campaignDir, 'maps');
        const filePath = path.join(mapsDir, 'forest-clearing.json');
        const mapData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        expect(mapData.type).toBe('outdoor');
        expect(mapData.gridSize).toBe(50);
        expect(mapData.terrain).toEqual({ grass: true });
        expect(mapData.pois).toEqual([{ label: 'Tree' }]);
        expect(mapData.displayName).toBe('Forest Clearing');
        expect(mapData.name).toBe('forest-clearing');
    });

    it('should clamp gridSize between 5 and 100', async () => {
        const campaignDir = createCampaignDir('test-campaign');

        const app = createTestApp();

        const resLow = await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'Tiny Map', gridSize: 1 });
        expect(resLow.status).toBe(201);
        const mapsDirLow = path.join(campaignDir, 'maps');
        const mapDataLow = JSON.parse(fs.readFileSync(path.join(mapsDirLow, 'tiny-map.json'), 'utf-8'));
        expect(mapDataLow.gridSize).toBe(5);

        const resHigh = await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'Huge Map', gridSize: 999 });
        expect(resHigh.status).toBe(201);
        const mapsDirHigh = path.join(campaignDir, 'maps');
        const mapDataHigh = JSON.parse(fs.readFileSync(path.join(mapsDirHigh, 'huge-map.json'), 'utf-8'));
        expect(mapDataHigh.gridSize).toBe(100);
    });

    it('should use default gridSize of 20 when not provided', async () => {
        const campaignDir = createCampaignDir('test-campaign');

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'Default Size' });

        expect(res.status).toBe(201);
        const mapsDir = path.join(campaignDir, 'maps');
        const mapData = JSON.parse(fs.readFileSync(path.join(mapsDir, 'default-size.json'), 'utf-8'));
        expect(mapData.gridSize).toBe(20);
    });

    it('should reject duplicate map names (case-insensitive via sanitization)', async () => {
        createCampaignDir('test-campaign');

        const app = createTestApp();
        await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'Dungeon Level 1' });

        const res = await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'dungeon level 1' });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('A map with this name already exists');
    });

    it('should create maps directory if it does not exist', async () => {
        createCampaignDir('test-campaign');
        // Do NOT create the maps subdirectory

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'New Map' });

        expect(res.status).toBe(201);
        const mapsDir = path.join(testCampaignsDir, 'test-campaign', 'maps');
        expect(fs.existsSync(mapsDir)).toBe(true);
    });

    it('should sanitize special characters in map name', async () => {
        const campaignDir = createCampaignDir('test-campaign');

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'Dungeon #1 - Boss Room!!!' });

        expect(res.status).toBe(201);
        expect(res.body.map.fileName).toBe('dungeon-1---boss-room.json');

        const mapsDir = path.join(campaignDir, 'maps');
        expect(fs.existsSync(path.join(mapsDir, 'dungeon-1---boss-room.json'))).toBe(true);
    });

    it('should write valid JSON to file', async () => {
        const campaignDir = createCampaignDir('test-campaign');

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/maps')
            .send({ name: 'Test Map', gridSize: 20, walls: [{ x1: 0, y1: 0, x2: 1, y2: 1 }] });

        expect(res.status).toBe(201);
        const mapsDir = path.join(campaignDir, 'maps');
        const filePath = path.join(mapsDir, 'test-map.json');
        const content = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(content);
        expect(parsed.walls).toEqual([{ x1: 0, y1: 0, x2: 1, y2: 1 }]);
    });
});

describe('maps - GET /api/campaigns/:campaign/maps/:mapname', () => {
    beforeEach(() => {
        ensureCampaignsDir();
    });

    afterEach(() => {
        cleanupCampaign('test-campaign');
    });

    it('should return map data by name', async () => {
        const mapsDir = createMapsDir('test-campaign');
        const mapData = { displayName: 'Test Map', type: 'indoor', gridSize: 20, walls: [] };
        fs.writeFileSync(path.join(mapsDir, 'test-map.json'), JSON.stringify(mapData));

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/maps/test-map');

        expect(res.status).toBe(200);
        expect(res.body).toEqual(mapData);
    });

    it('should handle mapname with .json extension', async () => {
        const mapsDir = createMapsDir('test-campaign');
        const mapData = { displayName: 'Test Map', type: 'indoor' };
        fs.writeFileSync(path.join(mapsDir, 'test-map.json'), JSON.stringify(mapData));

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/maps/test-map.json');

        expect(res.status).toBe(200);
        expect(res.body).toEqual(mapData);
    });

    it('should return 404 when map does not exist', async () => {
        createMapsDir('test-campaign');

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/maps/nonexistent');

        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('Map not found');
    });

    it('should return 500 on filesystem error', async () => {
        const mapsDir = createMapsDir('test-campaign');
        const mapData = { displayName: 'Test Map', type: 'indoor' };
        fs.writeFileSync(path.join(mapsDir, 'test-map.json'), JSON.stringify(mapData));
        const app = createTestApp();

        const spy = vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
            throw new Error('EACCES: permission denied');
        });

        const res = await request(app).get('/api/campaigns/test-campaign/maps/test-map');

        expect(res.status).toBe(500);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('Failed to read map');

        spy.mockRestore();
    });
});

describe('maps - PUT /api/campaigns/:campaign/maps/:mapname', () => {
    beforeEach(() => {
        ensureCampaignsDir();
    });

    afterEach(() => {
        cleanupCampaign('test-campaign');
    });

    it('should save map data', async () => {
        const mapsDir = createMapsDir('test-campaign');
        const mapData = { displayName: 'Original', type: 'indoor' };
        fs.writeFileSync(path.join(mapsDir, 'test-map.json'), JSON.stringify(mapData));

        const updatedData = { displayName: 'Updated', type: 'outdoor', gridSize: 40 };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/maps/test-map')
            .send(updatedData);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('message');

        const filePath = path.join(mapsDir, 'test-map.json');
        const savedData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        expect(savedData).toEqual(updatedData);
    });

    it('should handle mapname without .json extension', async () => {
        const mapsDir = createMapsDir('test-campaign');
        const mapData = { displayName: 'Original', type: 'indoor' };
        fs.writeFileSync(path.join(mapsDir, 'test-map.json'), JSON.stringify(mapData));

        const updatedData = { displayName: 'Updated via NoExt' };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/maps/test-map')
            .send(updatedData);

        expect(res.status).toBe(200);

        const filePath = path.join(mapsDir, 'test-map.json');
        const savedData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        expect(savedData.displayName).toBe('Updated via NoExt');
    });

    it('should create maps directory if it does not exist', async () => {
        const campaignDir = createCampaignDir('test-campaign');
        // Do NOT create maps directory

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/maps/new-map')
            .send({ displayName: 'New Map' });

        expect(res.status).toBe(200);
        const mapsDir = path.join(campaignDir, 'maps');
        expect(fs.existsSync(mapsDir)).toBe(true);
        expect(fs.existsSync(path.join(mapsDir, 'new-map.json'))).toBe(true);
    });

    it('should return 500 on filesystem error', async () => {
        createMapsDir('test-campaign');
        const app = createTestApp();

        const spy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {
            throw new Error('EIO: input/output error');
        });

        const res = await request(app)
            .put('/api/campaigns/test-campaign/maps/test-map')
            .send({ displayName: 'Updated' });

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Failed to save map');

        spy.mockRestore();
    });
});

describe('maps - DELETE /api/campaigns/:campaign/maps/:mapname', () => {
    beforeEach(() => {
        ensureCampaignsDir();
    });

    afterEach(() => {
        cleanupCampaign('test-campaign');
    });

    it('should delete a map file', async () => {
        const mapsDir = createMapsDir('test-campaign');
        const mapData = { displayName: 'To Delete', type: 'indoor' };
        const filePath = path.join(mapsDir, 'to-delete.json');
        fs.writeFileSync(filePath, JSON.stringify(mapData));

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-campaign/maps/to-delete');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('message');
        expect(fs.existsSync(filePath)).toBe(false);
    });

    it('should handle mapname without .json extension', async () => {
        const mapsDir = createMapsDir('test-campaign');
        const mapData = { displayName: 'To Delete', type: 'indoor' };
        const filePath = path.join(mapsDir, 'to-delete.json');
        fs.writeFileSync(filePath, JSON.stringify(mapData));

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-campaign/maps/to-delete');

        expect(res.status).toBe(200);
        expect(fs.existsSync(filePath)).toBe(false);
    });

    it('should return 404 when map does not exist', async () => {
        createMapsDir('test-campaign');

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-campaign/maps/nonexistent');

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Map not found');
    });

    it('should clear active map from memory if deleted map was active', async () => {
        const mapsDir = createMapsDir('test-campaign');
        const mapData = { displayName: 'Active Map', type: 'indoor' };
        fs.writeFileSync(path.join(mapsDir, 'active-map.json'), JSON.stringify(mapData));
        activeMaps.set('test-campaign', 'active-map');

        expect(activeMaps.get('test-campaign')).toBe('active-map');

        const app = createTestApp();
        await request(app).delete('/api/campaigns/test-campaign/maps/active-map');

        expect(activeMaps.has('test-campaign')).toBe(false);
    });

    it('should not clear active map if deleted map was not active', async () => {
        const mapsDir = createMapsDir('test-campaign');
        fs.writeFileSync(path.join(mapsDir, 'inactive-map.json'), JSON.stringify({ displayName: 'Inactive' }));
        fs.writeFileSync(path.join(mapsDir, 'other-map.json'), JSON.stringify({ displayName: 'Other' }));
        activeMaps.set('test-campaign', 'other-map');

        const app = createTestApp();
        await request(app).delete('/api/campaigns/test-campaign/maps/inactive-map');

        expect(activeMaps.get('test-campaign')).toBe('other-map');
    });

    it('should return 500 on filesystem error', async () => {
        const mapsDir = createMapsDir('test-campaign');
        const mapData = { displayName: 'Test Map', type: 'indoor' };
        fs.writeFileSync(path.join(mapsDir, 'test-map.json'), JSON.stringify(mapData));
        const app = createTestApp();

        const spy = vi.spyOn(fs, 'unlinkSync').mockImplementation(() => {
            throw new Error('EACCES: permission denied');
        });

        const res = await request(app).delete('/api/campaigns/test-campaign/maps/test-map');

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Failed to delete map');

        spy.mockRestore();
    });
});

describe('maps - PUT /api/campaigns/:campaign/maps/:mapname/rename', () => {
    beforeEach(() => {
        ensureCampaignsDir();
    });

    afterEach(() => {
        cleanupCampaign('test-campaign');
    });

    it('should require a new name', async () => {
        createMapsDir('test-campaign');

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/maps/old-map/rename')
            .send({});

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('New map name is required');
    });

    it('should reject empty string new name', async () => {
        createMapsDir('test-campaign');

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/maps/old-map/rename')
            .send({ newName: '' });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('New map name is required');
    });

    it('should reject whitespace-only new name', async () => {
        createMapsDir('test-campaign');

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/maps/old-map/rename')
            .send({ newName: '   ' });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('New map name is required');
    });

    it('should rename a map file', async () => {
        const mapsDir = createMapsDir('test-campaign');
        const mapData = { displayName: 'Old Name', name: 'old-name', type: 'indoor' };
        const oldFilePath = path.join(mapsDir, 'old-name.json');
        fs.writeFileSync(oldFilePath, JSON.stringify(mapData));

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/maps/old-name/rename')
            .send({ newName: 'New Dungeon Name' });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('message');
        expect(res.body).toHaveProperty('map');
        expect(res.body.map.name).toBe('New Dungeon Name');
        expect(res.body.map.fileName).toBe('new-dungeon-name.json');

        expect(fs.existsSync(oldFilePath)).toBe(false);
        expect(fs.existsSync(path.join(mapsDir, 'new-dungeon-name.json'))).toBe(true);

        const newMapData = JSON.parse(fs.readFileSync(path.join(mapsDir, 'new-dungeon-name.json'), 'utf-8'));
        expect(newMapData.displayName).toBe('New Dungeon Name');
        expect(newMapData.name).toBe('new-dungeon-name');
        expect(newMapData.type).toBe('indoor');
    });

    it('should keep displayName and name in sync with new name', async () => {
        const mapsDir = createMapsDir('test-campaign');
        fs.writeFileSync(path.join(mapsDir, 'old.json'), JSON.stringify({ displayName: 'Old', name: 'old', type: 'indoor' }));

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/maps/old/rename')
            .send({ newName: 'Renamed Map' });

        expect(res.status).toBe(200);

        const newMapData = JSON.parse(fs.readFileSync(path.join(mapsDir, 'renamed-map.json'), 'utf-8'));
        expect(newMapData.displayName).toBe('Renamed Map');
        expect(newMapData.name).toBe('renamed-map');
    });

    it('should preserve other map data fields during rename', async () => {
        const mapsDir = createMapsDir('test-campaign');
        const mapData = {
            displayName: 'Old', name: 'old', type: 'indoor',
            gridSize: 20, walls: [{ x1: 0, y1: 0, x2: 5, y2: 5 }],
            description: 'A dark dungeon'
        };
        fs.writeFileSync(path.join(mapsDir, 'old.json'), JSON.stringify(mapData));

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/maps/old/rename')
            .send({ newName: 'Renamed' });

        expect(res.status).toBe(200);

        const newMapData = JSON.parse(fs.readFileSync(path.join(mapsDir, 'renamed.json'), 'utf-8'));
        expect(newMapData.gridSize).toBe(20);
        expect(newMapData.walls).toEqual([{ x1: 0, y1: 0, x2: 5, y2: 5 }]);
        expect(newMapData.description).toBe('A dark dungeon');
    });

    it('should return 404 when old map does not exist', async () => {
        createMapsDir('test-campaign');

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/maps/nonexistent/rename')
            .send({ newName: 'New Name' });

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Map not found');
    });

    it('should return 400 when new name already exists', async () => {
        const mapsDir = createMapsDir('test-campaign');
        fs.writeFileSync(path.join(mapsDir, 'old-map.json'), JSON.stringify({ displayName: 'Old' }));
        fs.writeFileSync(path.join(mapsDir, 'new-map.json'), JSON.stringify({ displayName: 'New' }));

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/maps/old-map/rename')
            .send({ newName: 'New Map' });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('A map with this name already exists');
    });

    it('should update active map reference when filename changes', async () => {
        const mapsDir = createMapsDir('test-campaign');
        fs.writeFileSync(path.join(mapsDir, 'old-name.json'), JSON.stringify({ displayName: 'Old' }));
        activeMaps.set('test-campaign', 'old-name');

        const app = createTestApp();
        await request(app)
            .put('/api/campaigns/test-campaign/maps/old-name/rename')
            .send({ newName: 'Renamed' });

        expect(activeMaps.get('test-campaign')).toBe('renamed');
    });

    it('should not update active map when filename does not change (only displayName)', async () => {
        const mapsDir = createMapsDir('test-campaign');
        // Same name but different displayName - filename stays the same since sanitizeMapName produces same result
        fs.writeFileSync(path.join(mapsDir, 'same-name.json'), JSON.stringify({ displayName: 'Old' }));
        activeMaps.set('test-campaign', 'same-name');

        const app = createTestApp();
        await request(app)
            .put('/api/campaigns/test-campaign/maps/same-name/rename')
            .send({ newName: 'Same Name' });

        expect(activeMaps.get('test-campaign')).toBe('same-name');
    });

    it('should sanitize special characters in new name', async () => {
        const mapsDir = createMapsDir('test-campaign');
        fs.writeFileSync(path.join(mapsDir, 'old.json'), JSON.stringify({ displayName: 'Old' }));

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/maps/old/rename')
            .send({ newName: 'New #1 - Best Map!!!' });

        expect(res.status).toBe(200);
        expect(res.body.map.fileName).toBe('new-1---best-map.json');
        expect(fs.existsSync(path.join(mapsDir, 'new-1---best-map.json'))).toBe(true);
    });

    it('should return 500 on filesystem error', async () => {
        const mapsDir = createMapsDir('test-campaign');
        fs.writeFileSync(path.join(mapsDir, 'old.json'), JSON.stringify({ displayName: 'Old' }));
        const app = createTestApp();

        const spy = vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
            throw new Error('EACCES: permission denied');
        });

        const res = await request(app)
            .put('/api/campaigns/test-campaign/maps/old/rename')
            .send({ newName: 'New' });

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Failed to rename map');

        spy.mockRestore();
    });

    it('should trim whitespace from new name', async () => {
        const mapsDir = createMapsDir('test-campaign');
        fs.writeFileSync(path.join(mapsDir, 'old.json'), JSON.stringify({ displayName: 'Old' }));

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/maps/old/rename')
            .send({ newName: '  Trimmed  ' });

        expect(res.status).toBe(200);
        const newMapData = JSON.parse(fs.readFileSync(path.join(mapsDir, 'trimmed.json'), 'utf-8'));
        expect(newMapData.displayName).toBe('Trimmed');
        expect(newMapData.name).toBe('trimmed');
    });
});

describe('maps - PUT /api/campaigns/:campaign/maps/:mapname/activate', () => {
    beforeEach(() => {
        ensureCampaignsDir();
    });

    afterEach(() => {
        cleanupCampaign('test-campaign');
    });

    it('should activate a map', async () => {
        const mapsDir = createMapsDir('test-campaign');
        fs.writeFileSync(path.join(mapsDir, 'target-map.json'), JSON.stringify({ displayName: 'Target' }));

        const app = createTestApp();
        const res = await request(app).put('/api/campaigns/test-campaign/maps/target-map/activate');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('message');
        expect(res.body).toHaveProperty('activeMap');
        expect(res.body.activeMap).toBe('target-map');
        expect(activeMaps.get('test-campaign')).toBe('target-map');
    });

    it('should handle mapname without .json extension', async () => {
        const mapsDir = createMapsDir('test-campaign');
        fs.writeFileSync(path.join(mapsDir, 'target-map.json'), JSON.stringify({ displayName: 'Target' }));

        const app = createTestApp();
        const res = await request(app).put('/api/campaigns/test-campaign/maps/target-map/activate');

        expect(res.status).toBe(200);
        expect(activeMaps.get('test-campaign')).toBe('target-map');
    });

    it('should replace previously active map', async () => {
        const mapsDir = createMapsDir('test-campaign');
        fs.writeFileSync(path.join(mapsDir, 'map-one.json'), JSON.stringify({ displayName: 'One' }));
        fs.writeFileSync(path.join(mapsDir, 'map-two.json'), JSON.stringify({ displayName: 'Two' }));

        activeMaps.set('test-campaign', 'map-one');

        const app = createTestApp();
        const res = await request(app).put('/api/campaigns/test-campaign/maps/map-two/activate');

        expect(res.status).toBe(200);
        expect(activeMaps.get('test-campaign')).toBe('map-two');
    });

    it('should return 404 when map does not exist', async () => {
        createMapsDir('test-campaign');

        const app = createTestApp();
        const res = await request(app).put('/api/campaigns/test-campaign/maps/nonexistent/activate');

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Map not found');
    });

    it('should return 500 on filesystem error', async () => {
        const mapsDir = createMapsDir('test-campaign');
        fs.writeFileSync(path.join(mapsDir, 'target-map.json'), JSON.stringify({ displayName: 'Target' }));
        const app = createTestApp();

        const spy = vi.spyOn(fs, 'existsSync').mockImplementation(() => {
            throw new Error('EACCES: permission denied');
        });

        const res = await request(app).put('/api/campaigns/test-campaign/maps/target-map/activate');

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Failed to activate map');

        spy.mockRestore();
    });
});

describe('maps - GET /api/campaigns/:campaign/active-map', () => {
    beforeEach(() => {
        ensureCampaignsDir();
    });

    afterEach(() => {
        cleanupCampaign('test-campaign');
    });

    it('should return the active map name', async () => {
        activeMaps.set('test-campaign', 'my-active-map');

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/active-map');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('activeMapName');
        expect(res.body.activeMapName).toBe('my-active-map');
    });

    it('should return null when no active map is set', async () => {
        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/active-map');

        expect(res.status).toBe(200);
        expect(res.body.activeMapName).toBeNull();
    });

    it('should return null for unknown campaign', async () => {
        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/unknown-campaign/active-map');

        expect(res.status).toBe(200);
        expect(res.body.activeMapName).toBeNull();
    });
});

describe('maps - PUT /api/campaigns/:campaign/maps/:mapname/description', () => {
    beforeEach(() => {
        ensureCampaignsDir();
    });

    afterEach(() => {
        cleanupCampaign('test-campaign');
    });

    it('should update map description', async () => {
        const mapsDir = createMapsDir('test-campaign');
        const mapData = { displayName: 'Test Map', description: 'Old description' };
        fs.writeFileSync(path.join(mapsDir, 'test-map.json'), JSON.stringify(mapData));

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/maps/test-map/description')
            .send({ description: 'New description text' });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('message');

        const savedData = JSON.parse(fs.readFileSync(path.join(mapsDir, 'test-map.json'), 'utf-8'));
        expect(savedData.description).toBe('New description text');
    });

    it('should set description to empty string when not provided', async () => {
        const mapsDir = createMapsDir('test-campaign');
        const mapData = { displayName: 'Test Map', description: 'Old description' };
        fs.writeFileSync(path.join(mapsDir, 'test-map.json'), JSON.stringify(mapData));

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/maps/test-map/description')
            .send({});

        expect(res.status).toBe(200);

        const savedData = JSON.parse(fs.readFileSync(path.join(mapsDir, 'test-map.json'), 'utf-8'));
        expect(savedData.description).toBe('');
    });

    it('should handle mapname without .json extension', async () => {
        const mapsDir = createMapsDir('test-campaign');
        fs.writeFileSync(path.join(mapsDir, 'test-map.json'), JSON.stringify({ displayName: 'Test' }));

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/maps/test-map/description')
            .send({ description: 'Updated' });

        expect(res.status).toBe(200);

        const savedData = JSON.parse(fs.readFileSync(path.join(mapsDir, 'test-map.json'), 'utf-8'));
        expect(savedData.description).toBe('Updated');
    });

    it('should return 404 when map does not exist', async () => {
        createMapsDir('test-campaign');

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/maps/nonexistent/description')
            .send({ description: 'Description' });

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Map not found');
    });

    it('should return 500 on filesystem error', async () => {
        const mapsDir = createMapsDir('test-campaign');
        const mapData = { displayName: 'Test Map', description: 'Old description' };
        fs.writeFileSync(path.join(mapsDir, 'test-map.json'), JSON.stringify(mapData));
        const app = createTestApp();

        const spy = vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
            throw new Error('EACCES: permission denied');
        });

        const res = await request(app)
            .put('/api/campaigns/test-campaign/maps/test-map/description')
            .send({ description: 'Description' });

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Failed to update map description');

        spy.mockRestore();
    });
});
