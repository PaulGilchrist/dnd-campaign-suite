import request from 'supertest';
import express from 'express';
import fs from 'fs';
import path from 'path';
import factions from './factions.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(factions);
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

function createFactionsFile(campaignName, factionsData) {
    const dataDir = path.join(testCampaignsDir, campaignName, 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    const filePath = path.join(dataDir, 'factions.json');
    fs.writeFileSync(filePath, JSON.stringify(factionsData, null, 2));
}

function readFactionsFile(campaignName) {
    const filePath = path.join(testCampaignsDir, campaignName, 'data', 'factions.json');
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

// ─── GET /api/campaigns/:campaign/factions ───────────────────────────────────

describe('factions - GET /api/campaigns/:campaign/factions', () => {
    afterEach(() => {
        removeCampaignDir('test-factions-campaign');
    });

    it('should return an empty factions list when no factions.json exists', async () => {
        createCampaignDir('test-factions-campaign');

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-factions-campaign/factions');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('factions');
        expect(Array.isArray(res.body.factions)).toBe(true);
        expect(res.body.factions).toEqual([]);
    });

    it('should create factions.json and return empty list when file does not exist', async () => {
        createCampaignDir('test-factions-campaign');

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-factions-campaign/factions');

        expect(res.status).toBe(200);
        expect(res.body.factions).toEqual([]);

        const fileData = readFactionsFile('test-factions-campaign');
        expect(fileData).toEqual([]);
    });

    it('should return a list of factions with full data', async () => {
        createCampaignDir('test-factions-campaign');
        createFactionsFile('test-factions-campaign', [
            { id: 'faction-1', name: 'Order of the Gauntlet', description: 'Knights of justice', alignment: 'lawful good' },
            { id: 'faction-2', name: 'The Harpers', description: 'Secret society of good', alignment: 'neutral good' },
        ]);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-factions-campaign/factions');

        expect(res.status).toBe(200);
        expect(res.body.factions).toHaveLength(2);
        expect(res.body.factions[0]).toEqual({ id: 'faction-1', name: 'Order of the Gauntlet', description: 'Knights of justice', alignment: 'lawful good' });
        expect(res.body.factions[1]).toEqual({ id: 'faction-2', name: 'The Harpers', description: 'Secret society of good', alignment: 'neutral good' });
    });

    it('should handle factions with complex nested data', async () => {
        createCampaignDir('test-factions-campaign');
        const factionsData = [
            {
                id: 'faction-3',
                name: 'House Cannith',
                description: 'Dwarven artificers',
                alignment: 'any neutral',
                members: [
                    { name: 'Garthak', role: 'Leader' },
                    { name: 'Elara', role: 'Artificer' },
                ],
                territories: ['Thrane', 'Aundair'],
                active: true,
            },
        ];
        createFactionsFile('test-factions-campaign', factionsData);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-factions-campaign/factions');

        expect(res.status).toBe(200);
        expect(res.body.factions).toHaveLength(1);
        expect(res.body.factions[0].members).toHaveLength(2);
        expect(res.body.factions[0].territories).toEqual(['Thrane', 'Aundair']);
        expect(res.body.factions[0].active).toBe(true);
    });

    it('should handle invalid factions.json content (non-array) and return empty array', async () => {
        createCampaignDir('test-factions-campaign');
        const dataDir = path.join(testCampaignsDir, 'test-factions-campaign', 'data');
        fs.mkdirSync(dataDir, { recursive: true });
        const filePath = path.join(dataDir, 'factions.json');
        fs.writeFileSync(filePath, JSON.stringify({ not: 'an array' }, null, 2));

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-factions-campaign/factions');

        expect(res.status).toBe(200);
        expect(res.body.factions).toEqual([]);
    });

    it('should handle empty factions.json content (null) and return empty array', async () => {
        createCampaignDir('test-factions-campaign');
        const dataDir = path.join(testCampaignsDir, 'test-factions-campaign', 'data');
        fs.mkdirSync(dataDir, { recursive: true });
        const filePath = path.join(dataDir, 'factions.json');
        fs.writeFileSync(filePath, 'null');

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-factions-campaign/factions');

        expect(res.status).toBe(200);
        expect(res.body.factions).toEqual([]);
    });

    it('should return 500 on filesystem read error', async () => {
        createCampaignDir('test-factions-campaign');
        createFactionsFile('test-factions-campaign', []);

        const app = createTestApp();

        const spy = vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
            throw new Error('IO error');
        });

        const res = await request(app).get('/api/campaigns/test-factions-campaign/factions');

        expect(res.status).toBe(500);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('Failed to read Factions');

        spy.mockRestore();
    });
});

// ─── POST /api/campaigns/:campaign/factions ──────────────────────────────────

describe('factions - POST /api/campaigns/:campaign/factions', () => {
    afterEach(() => {
        removeCampaignDir('test-factions-campaign');
    });

    it('should save factions and return success', async () => {
        createCampaignDir('test-factions-campaign');

        const factionsData = [
            { id: 'faction-1', name: 'Order of the Gauntlet', description: 'Knights of justice', alignment: 'lawful good' },
            { id: 'faction-2', name: 'The Harpers', description: 'Secret society of good', alignment: 'neutral good' },
        ];

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-factions-campaign/factions')
            .send({ factions: factionsData });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const fileData = readFactionsFile('test-factions-campaign');
        expect(fileData).toEqual(factionsData);
    });

    it('should save an empty factions array', async () => {
        createCampaignDir('test-factions-campaign');

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-factions-campaign/factions')
            .send({ factions: [] });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const fileData = readFactionsFile('test-factions-campaign');
        expect(fileData).toEqual([]);
    });

    it('should handle factions with complex nested data', async () => {
        createCampaignDir('test-factions-campaign');
        const factionsData = [
            {
                id: 'faction-3',
                name: 'House Cannith',
                description: 'Dwarven artificers',
                alignment: 'any neutral',
                members: [
                    { name: 'Garthak', role: 'Leader' },
                    { name: 'Elara', role: 'Artificer' },
                ],
                territories: ['Thrane', 'Aundair'],
                active: true,
            },
        ];

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-factions-campaign/factions')
            .send({ factions: factionsData });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const fileData = readFactionsFile('test-factions-campaign');
        expect(fileData).toEqual(factionsData);
    });

    it('should create the data directory if it does not exist', async () => {
        createCampaignDir('test-factions-campaign');

        const factionsData = [{ id: 'faction-1', name: 'Test Faction' }];

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-factions-campaign/factions')
            .send({ factions: factionsData });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const fileData = readFactionsFile('test-factions-campaign');
        expect(fileData).toEqual(factionsData);
    });

    it('should overwrite existing factions file', async () => {
        createCampaignDir('test-factions-campaign');
        createFactionsFile('test-factions-campaign', [
            { id: 'old-1', name: 'Old Faction' },
        ]);

        const factionsData = [
            { id: 'new-1', name: 'New Faction 1' },
            { id: 'new-2', name: 'New Faction 2' },
        ];

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-factions-campaign/factions')
            .send({ factions: factionsData });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const fileData = readFactionsFile('test-factions-campaign');
        expect(fileData).toHaveLength(2);
        expect(fileData[0].name).toBe('New Faction 1');
        expect(fileData[1].name).toBe('New Faction 2');
    });

    it('should return 500 when factions field is missing from body', async () => {
        createCampaignDir('test-factions-campaign');

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-factions-campaign/factions')
            .send({});

        expect(res.status).toBe(500);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('Failed to save Factions');
    });

    it('should return 500 on filesystem write error', async () => {
        createCampaignDir('test-factions-campaign');

        const app = createTestApp();

        const spy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {
            throw new Error('Disk full');
        });

        const res = await request(app)
            .post('/api/campaigns/test-factions-campaign/factions')
            .send({ factions: [{ id: 'faction-1', name: 'Should Fail' }] });

        expect(res.status).toBe(500);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('Failed to save Factions');

        spy.mockRestore();
    });
});

// ─── GET /api/campaigns/:campaign/factions/:factionId ────────────────────────

describe('factions - GET /api/campaigns/:campaign/factions/:factionId', () => {
    afterEach(() => {
        removeCampaignDir('test-factions-campaign');
    });

    it('should return 404 when factions.json does not exist', async () => {
        createCampaignDir('test-factions-campaign');

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-factions-campaign/factions/faction-1');

        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('Faction not found');
    });

    it('should return 404 when faction id does not exist', async () => {
        createCampaignDir('test-factions-campaign');
        createFactionsFile('test-factions-campaign', [
            { id: 'faction-1', name: 'Order of the Gauntlet' },
            { id: 'faction-2', name: 'The Harpers' },
        ]);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-factions-campaign/factions/nonexistent');

        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('Faction not found');
    });

    it('should return the faction when found', async () => {
        createCampaignDir('test-factions-campaign');
        createFactionsFile('test-factions-campaign', [
            { id: 'faction-1', name: 'Order of the Gauntlet', description: 'Knights of justice', alignment: 'lawful good' },
            { id: 'faction-2', name: 'The Harpers', description: 'Secret society of good', alignment: 'neutral good' },
        ]);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-factions-campaign/factions/faction-2');

        expect(res.status).toBe(200);
        expect(res.body.faction).toEqual({ id: 'faction-2', name: 'The Harpers', description: 'Secret society of good', alignment: 'neutral good' });
    });

    it('should return the first faction when searching for the first one', async () => {
        createCampaignDir('test-factions-campaign');
        createFactionsFile('test-factions-campaign', [
            { id: 'faction-1', name: 'Order of the Gauntlet', description: 'Knights of justice', alignment: 'lawful good' },
            { id: 'faction-2', name: 'The Harpers', description: 'Secret society of good', alignment: 'neutral good' },
        ]);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-factions-campaign/factions/faction-1');

        expect(res.status).toBe(200);
        expect(res.body.faction.id).toBe('faction-1');
        expect(res.body.faction.name).toBe('Order of the Gauntlet');
    });

    it('should return 404 when factions.json contains non-array data', async () => {
        createCampaignDir('test-factions-campaign');
        const dataDir = path.join(testCampaignsDir, 'test-factions-campaign', 'data');
        fs.mkdirSync(dataDir, { recursive: true });
        const filePath = path.join(dataDir, 'factions.json');
        fs.writeFileSync(filePath, JSON.stringify({ not: 'an array' }, null, 2));

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-factions-campaign/factions/faction-1');

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Faction not found');
    });

    it('should return 500 on filesystem read error', async () => {
        createCampaignDir('test-factions-campaign');
        createFactionsFile('test-factions-campaign', []);

        const app = createTestApp();

        const spy = vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
            throw new Error('IO error');
        });

        const res = await request(app).get('/api/campaigns/test-factions-campaign/factions/faction-1');

        expect(res.status).toBe(500);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('Failed to read Faction');

        spy.mockRestore();
    });

    it('should handle faction with complex nested data', async () => {
        createCampaignDir('test-factions-campaign');
        const factionsData = [
            {
                id: 'faction-3',
                name: 'House Cannith',
                description: 'Dwarven artificers',
                alignment: 'any neutral',
                members: [
                    { name: 'Garthak', role: 'Leader' },
                    { name: 'Elara', role: 'Artificer' },
                ],
                territories: ['Thrane', 'Aundair'],
                active: true,
            },
        ];
        createFactionsFile('test-factions-campaign', factionsData);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-factions-campaign/factions/faction-3');

        expect(res.status).toBe(200);
        expect(res.body.faction.id).toBe('faction-3');
        expect(res.body.faction.members).toHaveLength(2);
        expect(res.body.faction.territories).toEqual(['Thrane', 'Aundair']);
        expect(res.body.faction.active).toBe(true);
    });
});

// ─── DELETE /api/campaigns/:campaign/factions/:factionId ─────────────────────

describe('factions - DELETE /api/campaigns/:campaign/factions/:factionId', () => {
    afterEach(() => {
        removeCampaignDir('test-factions-campaign');
    });

    it('should return 404 when factions.json does not exist', async () => {
        createCampaignDir('test-factions-campaign');

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-factions-campaign/factions/faction-1');

        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('Faction not found');
    });

    it('should return 200 even when faction does not exist (no-op delete)', async () => {
        createCampaignDir('test-factions-campaign');
        createFactionsFile('test-factions-campaign', [
            { id: 'faction-1', name: 'Order of the Gauntlet' },
            { id: 'faction-2', name: 'The Harpers' },
        ]);

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-factions-campaign/factions/nonexistent');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
    });

    it('should delete a faction and return success', async () => {
        createCampaignDir('test-factions-campaign');
        createFactionsFile('test-factions-campaign', [
            { id: 'faction-1', name: 'Order of the Gauntlet' },
            { id: 'faction-2', name: 'The Harpers' },
        ]);

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-factions-campaign/factions/faction-1');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const fileData = readFactionsFile('test-factions-campaign');
        expect(fileData).toHaveLength(1);
        expect(fileData[0].id).toBe('faction-2');
        expect(fileData[0].name).toBe('The Harpers');
    });

    it('should remove only the specified faction when multiple exist', async () => {
        createCampaignDir('test-factions-campaign');
        createFactionsFile('test-factions-campaign', [
            { id: 'faction-1', name: 'First Faction' },
            { id: 'faction-2', name: 'Second Faction' },
            { id: 'faction-3', name: 'Third Faction' },
        ]);

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-factions-campaign/factions/faction-2');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const fileData = readFactionsFile('test-factions-campaign');
        expect(fileData).toHaveLength(2);
        expect(fileData.map(f => f.id)).toEqual(['faction-1', 'faction-3']);
    });

    it('should handle deleting the last faction', async () => {
        createCampaignDir('test-factions-campaign');
        createFactionsFile('test-factions-campaign', [
            { id: 'faction-1', name: 'Only Faction' },
        ]);

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-factions-campaign/factions/faction-1');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const fileData = readFactionsFile('test-factions-campaign');
        expect(fileData).toEqual([]);
    });

    it('should return 200 when deleting from empty factions list (no-op delete)', async () => {
        createCampaignDir('test-factions-campaign');
        createFactionsFile('test-factions-campaign', []);

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-factions-campaign/factions/faction-1');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
    });

    it('should return 500 on filesystem read error', async () => {
        createCampaignDir('test-factions-campaign');
        createFactionsFile('test-factions-campaign', []);

        const app = createTestApp();

        const spy = vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
            throw new Error('IO error');
        });

        const res = await request(app).delete('/api/campaigns/test-factions-campaign/factions/faction-1');

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Failed to delete Faction');

        spy.mockRestore();
    });

    it('should return 500 on filesystem write error', async () => {
        createCampaignDir('test-factions-campaign');
        createFactionsFile('test-factions-campaign', [
            { id: 'faction-1', name: 'Order of the Gauntlet' },
        ]);

        const app = createTestApp();

        const spy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {
            throw new Error('Disk full');
        });

        const res = await request(app).delete('/api/campaigns/test-factions-campaign/factions/faction-1');

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Failed to delete Faction');

        spy.mockRestore();
    });

    it('should handle factions with complex nested data', async () => {
        createCampaignDir('test-factions-campaign');
        const factionsData = [
            {
                id: 'faction-1',
                name: 'House Cannith',
                description: 'Dwarven artificers',
                members: [{ name: 'Garthak', role: 'Leader' }],
                territories: ['Thrane'],
                active: true,
            },
            {
                id: 'faction-2',
                name: 'The Harpers',
                description: 'Secret society of good',
            },
        ];
        createFactionsFile('test-factions-campaign', factionsData);

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-factions-campaign/factions/faction-1');

        expect(res.status).toBe(200);

        const fileData = readFactionsFile('test-factions-campaign');
        expect(fileData).toHaveLength(1);
        expect(fileData[0].id).toBe('faction-2');
    });
});
