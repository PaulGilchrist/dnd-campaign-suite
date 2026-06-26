import request from 'supertest';
import express from 'express';
import fs from 'fs';
import path from 'path';
import settlements from './settlements.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(settlements);
    return app;
}

const testCampaignsDir = path.join(process.cwd(), 'public', 'campaigns');

function createCampaignDir(name) {
    const campaignDir = path.join(testCampaignsDir, name);
    if (!fs.existsSync(campaignDir)) {
        fs.mkdirSync(campaignDir, { recursive: true });
    }
    return campaignDir;
}

function createSettlementsFile(campaignName, settlementsData) {
    const dataDir = path.join(testCampaignsDir, campaignName, 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    const filePath = path.join(dataDir, 'settlements.json');
    fs.writeFileSync(filePath, JSON.stringify(settlementsData, null, 2));
}

function readSettlementsFile(campaignName) {
    const filePath = path.join(testCampaignsDir, campaignName, 'data', 'settlements.json');
    if (!fs.existsSync(filePath)) {
        return null;
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function removeCampaignDir(name) {
    const campaignDir = path.join(testCampaignsDir, name);
    if (fs.existsSync(campaignDir)) {
        fs.rmSync(campaignDir, { recursive: true, force: true });
    }
}

// ─── GET /api/campaigns/:campaign/settlements ────────────────────────────────

describe('settlements - GET /api/campaigns/:campaign/settlements', () => {
    afterEach(() => {
        removeCampaignDir('test-settlements-campaign');
    });

    it('should return empty settlements list when no settlements.json exists', async () => {
        createCampaignDir('test-settlements-campaign');

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-settlements-campaign/settlements');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('settlements');
        expect(Array.isArray(res.body.settlements)).toBe(true);
        expect(res.body.settlements).toEqual([]);

        // Verify the file was created
        const fileData = readSettlementsFile('test-settlements-campaign');
        expect(fileData).toEqual([]);
    });

    it('should create settlements.json and return empty list when file does not exist', async () => {
        createCampaignDir('test-settlements-campaign');

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-settlements-campaign/settlements');

        expect(res.status).toBe(200);
        expect(res.body.settlements).toEqual([]);

        const fileData = readSettlementsFile('test-settlements-campaign');
        expect(fileData).toEqual([]);
    });

    it('should return a list of settlements with full data', async () => {
        createCampaignDir('test-settlements-campaign');
        createSettlementsFile('test-settlements-campaign', [
            { name: 'Whiterun', type: 'city', population: 2500, ruler: 'Jarl Balgruuf' },
            { name: 'Riverwood', type: 'village', population: 50, ruler: 'Hod and Gerdur' },
        ]);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-settlements-campaign/settlements');

        expect(res.status).toBe(200);
        expect(res.body.settlements).toHaveLength(2);
        expect(res.body.settlements[0]).toEqual({ name: 'Whiterun', type: 'city', population: 2500, ruler: 'Jarl Balgruuf' });
        expect(res.body.settlements[1]).toEqual({ name: 'Riverwood', type: 'village', population: 50, ruler: 'Hod and Gerdur' });
    });

    it('should handle settlements with complex nested data', async () => {
        createCampaignDir('test-settlements-campaign');
        const settlementsData = [
            {
                name: 'Winterhold',
                type: 'city',
                population: 1000,
                ruler: 'Tolfdir',
                districts: [
                    { name: 'College of Winterhold', description: 'Magic academy' },
                    { name: 'Marketplace', description: 'Main trading area' },
                ],
                defenses: { walls: true, guards: 15, wallHeight: 30 },
                economy: { gold: 5000, tradeRoutes: ['Riverwood', 'Helgen'] },
            },
        ];
        createSettlementsFile('test-settlements-campaign', settlementsData);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-settlements-campaign/settlements');

        expect(res.status).toBe(200);
        expect(res.body.settlements).toHaveLength(1);
        expect(res.body.settlements[0].districts).toHaveLength(2);
        expect(res.body.settlements[0].defenses.walls).toBe(true);
        expect(res.body.settlements[0].economy.tradeRoutes).toEqual(['Riverwood', 'Helgen']);
    });

    it('should handle settlements.json containing non-array data and return empty array', async () => {
        createCampaignDir('test-settlements-campaign');
        const dataDir = path.join(testCampaignsDir, 'test-settlements-campaign', 'data');
        fs.mkdirSync(dataDir, { recursive: true });
        const filePath = path.join(dataDir, 'settlements.json');
        fs.writeFileSync(filePath, JSON.stringify({ not: 'an array' }, null, 2));

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-settlements-campaign/settlements');

        expect(res.status).toBe(200);
        expect(res.body.settlements).toEqual([]);
    });

    it('should handle empty settlements.json content (null) and return empty array', async () => {
        createCampaignDir('test-settlements-campaign');
        const dataDir = path.join(testCampaignsDir, 'test-settlements-campaign', 'data');
        fs.mkdirSync(dataDir, { recursive: true });
        const filePath = path.join(dataDir, 'settlements.json');
        fs.writeFileSync(filePath, 'null');

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-settlements-campaign/settlements');

        expect(res.status).toBe(200);
        expect(res.body.settlements).toEqual([]);
    });

    it('should return 500 on filesystem read error', async () => {
        createCampaignDir('test-settlements-campaign');
        createSettlementsFile('test-settlements-campaign', []);

        const app = createTestApp();

        const spy = vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
            throw new Error('IO error');
        });

        const res = await request(app).get('/api/campaigns/test-settlements-campaign/settlements');

        expect(res.status).toBe(500);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('Failed to read settlements');

        spy.mockRestore();
    });
});

// ─── POST /api/campaigns/:campaign/settlements ───────────────────────────────

describe('settlements - POST /api/campaigns/:campaign/settlements', () => {
    afterEach(() => {
        removeCampaignDir('test-settlements-campaign');
    });

    it('should save settlements and return success', async () => {
        createCampaignDir('test-settlements-campaign');

        const settlementsData = [
            { name: 'Whiterun', type: 'city', population: 2500, ruler: 'Jarl Balgruuf' },
            { name: 'Riverwood', type: 'village', population: 50, ruler: 'Hod and Gerdur' },
        ];

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-settlements-campaign/settlements')
            .send({ settlements: settlementsData });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const fileData = readSettlementsFile('test-settlements-campaign');
        expect(fileData).toEqual(settlementsData);
    });

    it('should save an empty settlements array', async () => {
        createCampaignDir('test-settlements-campaign');

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-settlements-campaign/settlements')
            .send({ settlements: [] });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const fileData = readSettlementsFile('test-settlements-campaign');
        expect(fileData).toEqual([]);
    });

    it('should handle settlements with complex nested data', async () => {
        createCampaignDir('test-settlements-campaign');
        const settlementsData = [
            {
                name: 'Winterhold',
                type: 'city',
                population: 1000,
                ruler: 'Tolfdir',
                districts: [
                    { name: 'College of Winterhold', description: 'Magic academy' },
                    { name: 'Marketplace', description: 'Main trading area' },
                ],
                defenses: { walls: true, guards: 15, wallHeight: 30 },
                economy: { gold: 5000, tradeRoutes: ['Riverwood', 'Helgen'] },
            },
        ];

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-settlements-campaign/settlements')
            .send({ settlements: settlementsData });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const fileData = readSettlementsFile('test-settlements-campaign');
        expect(fileData).toEqual(settlementsData);
    });

    it('should create the data directory if it does not exist', async () => {
        createCampaignDir('test-settlements-campaign');

        const settlementsData = [{ name: 'Test Settlement', type: 'village' }];

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-settlements-campaign/settlements')
            .send({ settlements: settlementsData });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const fileData = readSettlementsFile('test-settlements-campaign');
        expect(fileData).toEqual(settlementsData);
    });

    it('should overwrite existing settlements file', async () => {
        createCampaignDir('test-settlements-campaign');
        createSettlementsFile('test-settlements-campaign', [
            { name: 'Old Settlement', type: 'city' },
        ]);

        const settlementsData = [
            { name: 'New Settlement 1', type: 'village' },
            { name: 'New Settlement 2', type: 'town' },
        ];

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-settlements-campaign/settlements')
            .send({ settlements: settlementsData });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const fileData = readSettlementsFile('test-settlements-campaign');
        expect(fileData).toHaveLength(2);
        expect(fileData[0].name).toBe('New Settlement 1');
        expect(fileData[1].name).toBe('New Settlement 2');
    });

    it('should return 500 when settlements field is missing from body', async () => {
        createCampaignDir('test-settlements-campaign');

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-settlements-campaign/settlements')
            .send({});

        expect(res.status).toBe(500);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('Failed to save settlements');
    });

    it('should return 500 on filesystem write error', async () => {
        createCampaignDir('test-settlements-campaign');

        const app = createTestApp();

        const spy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {
            throw new Error('Disk full');
        });

        const res = await request(app)
            .post('/api/campaigns/test-settlements-campaign/settlements')
            .send({ settlements: [{ name: 'Should Fail', type: 'village' }] });

        expect(res.status).toBe(500);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('Failed to save settlements');

        spy.mockRestore();
    });

    it('should return 500 on filesystem error during directory creation', async () => {
        createCampaignDir('test-settlements-campaign');

        const app = createTestApp();

        const spy = vi.spyOn(fs, 'mkdirSync').mockImplementation(() => {
            throw new Error('Permission denied');
        });

        const res = await request(app)
            .post('/api/campaigns/test-settlements-campaign/settlements')
            .send({ settlements: [{ name: 'Should Fail', type: 'village' }] });

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Failed to save settlements');

        spy.mockRestore();
    });
});

// ─── PUT /api/campaigns/:campaign/settlements/:settlementName ────────────────

describe('settlements - PUT /api/campaigns/:campaign/settlements/:settlementName', () => {
    afterEach(() => {
        removeCampaignDir('test-settlements-campaign');
    });

    it('should create a new settlement when it does not exist', async () => {
        createCampaignDir('test-settlements-campaign');
        createSettlementsFile('test-settlements-campaign', [
            { name: 'Existing Settlement', type: 'city' },
        ]);

        const updatedSettlement = { name: 'New Settlement', type: 'village', population: 100 };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-settlements-campaign/settlements/New%20Settlement')
            .send(updatedSettlement);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
        expect(res.body).toHaveProperty('settlement');
        expect(res.body.settlement).toEqual(updatedSettlement);

        const fileData = readSettlementsFile('test-settlements-campaign');
        expect(fileData).toHaveLength(2);
        expect(fileData.find(s => s.name === 'New Settlement')).toEqual(updatedSettlement);
    });

    it('should update an existing settlement when name matches', async () => {
        createCampaignDir('test-settlements-campaign');
        createSettlementsFile('test-settlements-campaign', [
            { name: 'Whiterun', type: 'city', population: 2500, ruler: 'Jarl Balgruuf' },
        ]);

        const updatedSettlement = { name: 'Whiterun', type: 'city', population: 3000, ruler: 'Jarl Balgruuf Updated' };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-settlements-campaign/settlements/Whiterun')
            .send(updatedSettlement);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
        expect(res.body.settlement).toEqual(updatedSettlement);

        const fileData = readSettlementsFile('test-settlements-campaign');
        expect(fileData).toHaveLength(1);
        expect(fileData[0]).toEqual(updatedSettlement);
    });

    it('should handle settlement names with special characters via URL encoding', async () => {
        createCampaignDir('test-settlements-campaign');
        createSettlementsFile('test-settlements-campaign', [
            { name: 'Settlement-A', type: 'town' },
        ]);

        const updatedSettlement = { name: 'Settlement-B', type: 'city', population: 5000 };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-settlements-campaign/settlements/Settlement-B')
            .send(updatedSettlement);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const fileData = readSettlementsFile('test-settlements-campaign');
        expect(fileData).toHaveLength(2);
        expect(fileData.find(s => s.name === 'Settlement-B')).toEqual(updatedSettlement);
    });

    it('should replace the settlement in its original position when updating', async () => {
        createCampaignDir('test-settlements-campaign');
        createSettlementsFile('test-settlements-campaign', [
            { name: 'First', type: 'village' },
            { name: 'Second', type: 'town' },
            { name: 'Third', type: 'city' },
        ]);

        const updatedSettlement = { name: 'Second', type: 'city', population: 10000 };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-settlements-campaign/settlements/Second')
            .send(updatedSettlement);

        expect(res.status).toBe(200);

        const fileData = readSettlementsFile('test-settlements-campaign');
        expect(fileData).toHaveLength(3);
        expect(fileData[1]).toEqual(updatedSettlement);
    });

    it('should append to the end when creating a new settlement', async () => {
        createCampaignDir('test-settlements-campaign');
        createSettlementsFile('test-settlements-campaign', [
            { name: 'First', type: 'village' },
            { name: 'Second', type: 'town' },
        ]);

        const newSettlement = { name: 'Third', type: 'city' };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-settlements-campaign/settlements/Third')
            .send(newSettlement);

        expect(res.status).toBe(200);

        const fileData = readSettlementsFile('test-settlements-campaign');
        expect(fileData).toHaveLength(3);
        expect(fileData[2]).toEqual(newSettlement);
    });

    it('should handle complex nested settlement data', async () => {
        createCampaignDir('test-settlements-campaign');

        const settlementData = {
            name: 'Winterhold',
            type: 'city',
            population: 1000,
            ruler: 'Tolfdir',
            districts: [
                { name: 'College of Winterhold', description: 'Magic academy' },
                { name: 'Marketplace', description: 'Main trading area' },
            ],
            defenses: { walls: true, guards: 15, wallHeight: 30 },
            economy: { gold: 5000, tradeRoutes: ['Riverwood', 'Helgen'] },
        };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-settlements-campaign/settlements/Winterhold')
            .send(settlementData);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const fileData = readSettlementsFile('test-settlements-campaign');
        expect(fileData).toHaveLength(1);
        expect(fileData[0].districts).toHaveLength(2);
        expect(fileData[0].defenses.walls).toBe(true);
        expect(fileData[0].economy.tradeRoutes).toEqual(['Riverwood', 'Helgen']);
    });

    it('should handle settlements.json containing non-array data and convert to array', async () => {
        createCampaignDir('test-settlements-campaign');
        const dataDir = path.join(testCampaignsDir, 'test-settlements-campaign', 'data');
        fs.mkdirSync(dataDir, { recursive: true });
        const filePath = path.join(dataDir, 'settlements.json');
        fs.writeFileSync(filePath, JSON.stringify({ not: 'an array' }, null, 2));

        const newSettlement = { name: 'New Settlement', type: 'village' };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-settlements-campaign/settlements/New%20Settlement')
            .send(newSettlement);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const fileData = readSettlementsFile('test-settlements-campaign');
        expect(fileData).toHaveLength(1);
        expect(fileData[0]).toEqual(newSettlement);
    });

    it('should create data directory if it does not exist during PUT', async () => {
        createCampaignDir('test-settlements-campaign');
        // Do not create the data directory or settlements.json

        const newSettlement = { name: 'New Settlement', type: 'village' };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-settlements-campaign/settlements/New%20Settlement')
            .send(newSettlement);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const fileData = readSettlementsFile('test-settlements-campaign');
        expect(fileData).toEqual([newSettlement]);
    });

    it('should return 500 on filesystem write error', async () => {
        createCampaignDir('test-settlements-campaign');
        createSettlementsFile('test-settlements-campaign', []);

        const app = createTestApp();

        const spy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {
            throw new Error('Disk full');
        });

        const res = await request(app)
            .put('/api/campaigns/test-settlements-campaign/settlements/New%20Settlement')
            .send({ name: 'New Settlement', type: 'village' });

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Failed to update settlement');

        spy.mockRestore();
    });

    it('should return 500 on filesystem read error', async () => {
        createCampaignDir('test-settlements-campaign');
        createSettlementsFile('test-settlements-campaign', []);

        const app = createTestApp();

        const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
        const readSpy = vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
            throw new Error('IO error');
        });

        const res = await request(app)
            .put('/api/campaigns/test-settlements-campaign/settlements/New%20Settlement')
            .send({ name: 'New Settlement', type: 'village' });

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Failed to update settlement');

        existsSpy.mockRestore();
        readSpy.mockRestore();
    });

    it('should return 500 on filesystem error during directory creation', async () => {
        createCampaignDir('test-settlements-campaign');

        const app = createTestApp();

        const spy = vi.spyOn(fs, 'mkdirSync').mockImplementation(() => {
            throw new Error('Permission denied');
        });

        const res = await request(app)
            .put('/api/campaigns/test-settlements-campaign/settlements/New%20Settlement')
            .send({ name: 'New Settlement', type: 'village' });

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Failed to update settlement');

        spy.mockRestore();
    });
});

// ─── GET /api/campaigns/:campaign/settlements/:settlementName ────────────────

describe('settlements - GET /api/campaigns/:campaign/settlements/:settlementName', () => {
    afterEach(() => {
        removeCampaignDir('test-settlements-campaign');
    });

    it('should return 404 when settlements.json does not exist', async () => {
        createCampaignDir('test-settlements-campaign');

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-settlements-campaign/settlements/Whiterun');

        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('Settlement not found');
    });

    it('should return 404 when settlement with given name does not exist', async () => {
        createCampaignDir('test-settlements-campaign');
        createSettlementsFile('test-settlements-campaign', [
            { name: 'Whiterun', type: 'city', population: 2500 },
        ]);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-settlements-campaign/settlements/Riverwood');

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Settlement not found');
    });

    it('should return the settlement when found', async () => {
        createCampaignDir('test-settlements-campaign');
        const settlementData = {
            name: 'Whiterun',
            type: 'city',
            population: 2500,
            ruler: 'Jarl Balgruuf',
        };
        createSettlementsFile('test-settlements-campaign', [settlementData]);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-settlements-campaign/settlements/Whiterun');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('settlement');
        expect(res.body.settlement).toEqual(settlementData);
    });

    it('should return the first settlement when searching for the first one', async () => {
        createCampaignDir('test-settlements-campaign');
        createSettlementsFile('test-settlements-campaign', [
            { name: 'Whiterun', type: 'city', population: 2500 },
            { name: 'Riverwood', type: 'village', population: 50 },
        ]);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-settlements-campaign/settlements/Whiterun');

        expect(res.status).toBe(200);
        expect(res.body.settlement.name).toBe('Whiterun');
        expect(res.body.settlement.type).toBe('city');
    });

    it('should return the last settlement when searching for the last one', async () => {
        createCampaignDir('test-settlements-campaign');
        createSettlementsFile('test-settlements-campaign', [
            { name: 'Whiterun', type: 'city', population: 2500 },
            { name: 'Riverwood', type: 'village', population: 50 },
        ]);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-settlements-campaign/settlements/Riverwood');

        expect(res.status).toBe(200);
        expect(res.body.settlement.name).toBe('Riverwood');
        expect(res.body.settlement.type).toBe('village');
    });

    it('should return settlement from middle of array', async () => {
        createCampaignDir('test-settlements-campaign');
        createSettlementsFile('test-settlements-campaign', [
            { name: 'First', type: 'village' },
            { name: 'Middle', type: 'town', population: 500 },
            { name: 'Last', type: 'city' },
        ]);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-settlements-campaign/settlements/Middle');

        expect(res.status).toBe(200);
        expect(res.body.settlement.name).toBe('Middle');
        expect(res.body.settlement.population).toBe(500);
    });

    it('should return 404 when settlements.json contains non-array data', async () => {
        createCampaignDir('test-settlements-campaign');
        const dataDir = path.join(testCampaignsDir, 'test-settlements-campaign', 'data');
        fs.mkdirSync(dataDir, { recursive: true });
        const filePath = path.join(dataDir, 'settlements.json');
        fs.writeFileSync(filePath, JSON.stringify({ not: 'an array' }, null, 2));

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-settlements-campaign/settlements/any-name');

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Settlement not found');
    });

    it('should handle settlement with complex nested data', async () => {
        createCampaignDir('test-settlements-campaign');
        const settlementData = {
            name: 'Winterhold',
            type: 'city',
            population: 1000,
            ruler: 'Tolfdir',
            districts: [
                { name: 'College of Winterhold', description: 'Magic academy' },
                { name: 'Marketplace', description: 'Main trading area' },
            ],
            defenses: { walls: true, guards: 15, wallHeight: 30 },
            economy: { gold: 5000, tradeRoutes: ['Riverwood', 'Helgen'] },
        };
        createSettlementsFile('test-settlements-campaign', [settlementData]);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-settlements-campaign/settlements/Winterhold');

        expect(res.status).toBe(200);
        expect(res.body.settlement.name).toBe('Winterhold');
        expect(res.body.settlement.districts).toHaveLength(2);
        expect(res.body.settlement.defenses.walls).toBe(true);
        expect(res.body.settlement.economy.tradeRoutes).toEqual(['Riverwood', 'Helgen']);
    });

    it('should return 500 on filesystem read error', async () => {
        createCampaignDir('test-settlements-campaign');
        createSettlementsFile('test-settlements-campaign', []);

        const app = createTestApp();

        const spy = vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
            throw new Error('IO error');
        });

        const res = await request(app).get('/api/campaigns/test-settlements-campaign/settlements/any-name');

        expect(res.status).toBe(500);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('Failed to read settlement');

        spy.mockRestore();
    });

    it('should return 404 when existsSync returns false', async () => {
        createCampaignDir('test-settlements-campaign');

        const app = createTestApp();

        const spy = vi.spyOn(fs, 'existsSync').mockReturnValue(false);

        const res = await request(app).get('/api/campaigns/test-settlements-campaign/settlements/any-name');

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Settlement not found');

        spy.mockRestore();
    });
});

// ─── DELETE /api/campaigns/:campaign/settlements/:settlementName ─────────────

describe('settlements - DELETE /api/campaigns/:campaign/settlements/:settlementName', () => {
    afterEach(() => {
        removeCampaignDir('test-settlements-campaign');
    });

    it('should return 404 when settlements.json does not exist', async () => {
        createCampaignDir('test-settlements-campaign');

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-settlements-campaign/settlements/Whiterun');

        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('Settlement not found');
    });

    it('should return 200 and succeed when settlement does not exist (no-op delete)', async () => {
        createCampaignDir('test-settlements-campaign');
        createSettlementsFile('test-settlements-campaign', [
            { name: 'Whiterun', type: 'city', population: 2500 },
        ]);

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-settlements-campaign/settlements/Riverwood');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        // File should be unchanged since no matching settlement was removed
        const fileData = readSettlementsFile('test-settlements-campaign');
        expect(fileData).toHaveLength(1);
    });

    it('should delete a settlement and return success', async () => {
        createCampaignDir('test-settlements-campaign');
        createSettlementsFile('test-settlements-campaign', [
            { name: 'Whiterun', type: 'city', population: 2500 },
            { name: 'Riverwood', type: 'village', population: 50 },
        ]);

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-settlements-campaign/settlements/Riverwood');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const fileData = readSettlementsFile('test-settlements-campaign');
        expect(fileData).toHaveLength(1);
        expect(fileData[0].name).toBe('Whiterun');
    });

    it('should remove only the specified settlement when multiple exist', async () => {
        createCampaignDir('test-settlements-campaign');
        createSettlementsFile('test-settlements-campaign', [
            { name: 'First', type: 'village' },
            { name: 'Second', type: 'town' },
            { name: 'Third', type: 'city' },
        ]);

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-settlements-campaign/settlements/Second');

        expect(res.status).toBe(200);

        const fileData = readSettlementsFile('test-settlements-campaign');
        expect(fileData).toHaveLength(2);
        expect(fileData.map(s => s.name)).toEqual(['First', 'Third']);
    });

    it('should handle deleting the only settlement', async () => {
        createCampaignDir('test-settlements-campaign');
        createSettlementsFile('test-settlements-campaign', [
            { name: 'Only Settlement', type: 'village' },
        ]);

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-settlements-campaign/settlements/Only%20Settlement');

        expect(res.status).toBe(200);

        const fileData = readSettlementsFile('test-settlements-campaign');
        expect(fileData).toEqual([]);
    });

    it('should handle deleting from an empty settlements list (no-op delete)', async () => {
        createCampaignDir('test-settlements-campaign');
        createSettlementsFile('test-settlements-campaign', []);

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-settlements-campaign/settlements/any-name');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const fileData = readSettlementsFile('test-settlements-campaign');
        expect(fileData).toEqual([]);
    });

    it('should handle settlements.json containing non-array data', async () => {
        createCampaignDir('test-settlements-campaign');
        createSettlementsFile('test-settlements-campaign', { not: 'an array' });

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-settlements-campaign/settlements/any-name');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const fileData = readSettlementsFile('test-settlements-campaign');
        expect(fileData).toEqual([]);
    });

    it('should return 500 on filesystem write error', async () => {
        createCampaignDir('test-settlements-campaign');
        createSettlementsFile('test-settlements-campaign', [
            { name: 'Whiterun', type: 'city', population: 2500 },
        ]);

        const app = createTestApp();

        const spy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {
            throw new Error('Disk full');
        });

        const res = await request(app).delete('/api/campaigns/test-settlements-campaign/settlements/Whiterun');

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Failed to delete settlement');

        spy.mockRestore();
    });

    it('should return 500 on filesystem read error', async () => {
        createCampaignDir('test-settlements-campaign');
        createSettlementsFile('test-settlements-campaign', [
            { name: 'Whiterun', type: 'city', population: 2500 },
        ]);

        const app = createTestApp();

        const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
        const readSpy = vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
            throw new Error('IO error');
        });

        const res = await request(app).delete('/api/campaigns/test-settlements-campaign/settlements/Whiterun');

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Failed to delete settlement');

        existsSpy.mockRestore();
        readSpy.mockRestore();
    });

    it('should delete settlement with complex nested data', async () => {
        createCampaignDir('test-settlements-campaign');
        const settlementsData = [
            {
                name: 'Winterhold',
                type: 'city',
                population: 1000,
                ruler: 'Tolfdir',
                districts: [
                    { name: 'College of Winterhold', description: 'Magic academy' },
                    { name: 'Marketplace', description: 'Main trading area' },
                ],
                defenses: { walls: true, guards: 15, wallHeight: 30 },
            },
            {
                name: 'Riverwood',
                type: 'village',
                population: 50,
            },
        ];
        createSettlementsFile('test-settlements-campaign', settlementsData);

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-settlements-campaign/settlements/Winterhold');

        expect(res.status).toBe(200);

        const fileData = readSettlementsFile('test-settlements-campaign');
        expect(fileData).toHaveLength(1);
        expect(fileData[0].name).toBe('Riverwood');
        expect(fileData[0].type).toBe('village');
    });

    it('should return 404 when existsSync returns false', async () => {
        createCampaignDir('test-settlements-campaign');

        const app = createTestApp();

        const spy = vi.spyOn(fs, 'existsSync').mockReturnValue(false);

        const res = await request(app).delete('/api/campaigns/test-settlements-campaign/settlements/any-name');

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Settlement not found');

        spy.mockRestore();
    });
});
