import request from 'supertest';
import express from 'express';
import fs from 'fs';
import path from 'path';
import npcs from './npcs.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(npcs);
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

function createNpcsFile(campaignName, npcsData) {
    const dataDir = path.join(testCampaignsDir, campaignName, 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    const filePath = path.join(dataDir, 'npcs.json');
    fs.writeFileSync(filePath, JSON.stringify(npcsData, null, 2));
}

function readNpcsFile(campaignName) {
    const filePath = path.join(testCampaignsDir, campaignName, 'data', 'npcs.json');
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

// ─── GET /api/campaigns/:campaign/npcs ───────────────────────────────────────

describe('npcs - GET /api/campaigns/:campaign/npcs', () => {
    afterEach(() => {
        removeCampaignDir('test-npcs-campaign');
    });

    it('should return an empty npcs list when no npcs.json exists', async () => {
        createCampaignDir('test-npcs-campaign');

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-npcs-campaign/npcs');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('npcs');
        expect(Array.isArray(res.body.npcs)).toBe(true);
        expect(res.body.npcs).toEqual([]);
    });

    it('should create npcs.json and return empty list when file does not exist', async () => {
        createCampaignDir('test-npcs-campaign');

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-npcs-campaign/npcs');

        expect(res.status).toBe(200);
        expect(res.body.npcs).toEqual([]);

        const fileData = readNpcsFile('test-npcs-campaign');
        expect(fileData).toEqual([]);
    });

    it('should return a list of npcs with full data', async () => {
        createCampaignDir('test-npcs-campaign');
        createNpcsFile('test-npcs-campaign', [
            { name: 'Guard Captain', type: 'Human Warrior', level: 5 },
            { name: 'Elder Thalia', type: 'Elf Sage', level: 10 },
        ]);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-npcs-campaign/npcs');

        expect(res.status).toBe(200);
        expect(res.body.npcs).toHaveLength(2);
        expect(res.body.npcs[0]).toEqual({ name: 'Guard Captain', type: 'Human Warrior', level: 5 });
        expect(res.body.npcs[1]).toEqual({ name: 'Elder Thalia', type: 'Elf Sage', level: 10 });
    });

    it('should handle npcs with complex nested data', async () => {
        createCampaignDir('test-npcs-campaign');
        const npcsData = [
            {
                name: 'Dragon Boss',
                type: 'Ancient Red Dragon',
                level: 20,
                stats: { hp: 500, ac: 22, str: 25, dex: 10, con: 20 },
                abilities: ['Fire Breath', 'Fly', 'Legendary Actions'],
                loot: { gold: 10000, items: ['Flame Tongue Sword'] },
                active: true,
            },
        ];
        createNpcsFile('test-npcs-campaign', npcsData);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-npcs-campaign/npcs');

        expect(res.status).toBe(200);
        expect(res.body.npcs).toHaveLength(1);
        expect(res.body.npcs[0].stats).toEqual({ hp: 500, ac: 22, str: 25, dex: 10, con: 20 });
        expect(res.body.npcs[0].abilities).toEqual(['Fire Breath', 'Fly', 'Legendary Actions']);
        expect(res.body.npcs[0].loot.items).toEqual(['Flame Tongue Sword']);
        expect(res.body.npcs[0].active).toBe(true);
    });

    it('should handle npcs.json containing non-array data and return empty array', async () => {
        createCampaignDir('test-npcs-campaign');
        const dataDir = path.join(testCampaignsDir, 'test-npcs-campaign', 'data');
        fs.mkdirSync(dataDir, { recursive: true });
        const filePath = path.join(dataDir, 'npcs.json');
        fs.writeFileSync(filePath, JSON.stringify({ not: 'an array' }, null, 2));

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-npcs-campaign/npcs');

        expect(res.status).toBe(200);
        expect(res.body.npcs).toEqual([]);
    });

    it('should handle empty npcs.json content (null) and return empty array', async () => {
        createCampaignDir('test-npcs-campaign');
        const dataDir = path.join(testCampaignsDir, 'test-npcs-campaign', 'data');
        fs.mkdirSync(dataDir, { recursive: true });
        const filePath = path.join(dataDir, 'npcs.json');
        fs.writeFileSync(filePath, 'null');

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-npcs-campaign/npcs');

        expect(res.status).toBe(200);
        expect(res.body.npcs).toEqual([]);
    });

    it('should return 500 on filesystem read error', async () => {
        createCampaignDir('test-npcs-campaign');
        createNpcsFile('test-npcs-campaign', []);

        const app = createTestApp();

        const spy = vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
            throw new Error('IO error');
        });

        const res = await request(app).get('/api/campaigns/test-npcs-campaign/npcs');

        expect(res.status).toBe(500);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('Failed to read NPCs');

        spy.mockRestore();
    });

    it('should handle npcs with special characters in name', async () => {
        createCampaignDir('test-npcs-campaign');
        createNpcsFile('test-npcs-campaign', [
            { name: "Guard's Captain", type: 'Human', level: 1 },
            { name: 'Elder O\'Brien', type: 'Elf', level: 3 },
            { name: 'Test & Example NPC', type: 'Human', level: 2 },
        ]);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-npcs-campaign/npcs');

        expect(res.status).toBe(200);
        expect(res.body.npcs).toHaveLength(3);
        expect(res.body.npcs[0].name).toBe("Guard's Captain");
        expect(res.body.npcs[1].name).toBe("Elder O'Brien");
        expect(res.body.npcs[2].name).toBe('Test & Example NPC');
    });
});

// ─── POST /api/campaigns/:campaign/npcs ──────────────────────────────────────

describe('npcs - POST /api/campaigns/:campaign/npcs', () => {
    afterEach(() => {
        removeCampaignDir('test-npcs-campaign');
    });

    it('should save npcs and return success', async () => {
        createCampaignDir('test-npcs-campaign');

        const npcsData = [
            { name: 'Guard Captain', type: 'Human Warrior', level: 5 },
            { name: 'Elder Thalia', type: 'Elf Sage', level: 10 },
        ];

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-npcs-campaign/npcs')
            .send({ npcs: npcsData });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const fileData = readNpcsFile('test-npcs-campaign');
        expect(fileData).toEqual(npcsData);
    });

    it('should save an empty npcs array', async () => {
        createCampaignDir('test-npcs-campaign');

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-npcs-campaign/npcs')
            .send({ npcs: [] });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const fileData = readNpcsFile('test-npcs-campaign');
        expect(fileData).toEqual([]);
    });

    it('should handle npcs with complex nested data', async () => {
        createCampaignDir('test-npcs-campaign');
        const npcsData = [
            {
                name: 'Dragon Boss',
                type: 'Ancient Red Dragon',
                level: 20,
                stats: { hp: 500, ac: 22, str: 25, dex: 10, con: 20 },
                abilities: ['Fire Breath', 'Fly', 'Legendary Actions'],
                loot: { gold: 10000, items: ['Flame Tongue Sword'] },
                active: true,
            },
        ];

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-npcs-campaign/npcs')
            .send({ npcs: npcsData });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const fileData = readNpcsFile('test-npcs-campaign');
        expect(fileData).toEqual(npcsData);
    });

    it('should create the data directory if it does not exist', async () => {
        createCampaignDir('test-npcs-campaign');

        const npcsData = [{ name: 'New NPC', type: 'Human', level: 1 }];

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-npcs-campaign/npcs')
            .send({ npcs: npcsData });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const fileData = readNpcsFile('test-npcs-campaign');
        expect(fileData).toEqual(npcsData);
    });

    it('should overwrite existing npcs file', async () => {
        createCampaignDir('test-npcs-campaign');
        createNpcsFile('test-npcs-campaign', [
            { name: 'Old NPC', type: 'Human', level: 1 },
        ]);

        const npcsData = [
            { name: 'New NPC 1', type: 'Elf', level: 5 },
            { name: 'New NPC 2', type: 'Dwarf', level: 3 },
        ];

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-npcs-campaign/npcs')
            .send({ npcs: npcsData });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const fileData = readNpcsFile('test-npcs-campaign');
        expect(fileData).toHaveLength(2);
        expect(fileData[0].name).toBe('New NPC 1');
        expect(fileData[1].name).toBe('New NPC 2');
    });

    it('should return 500 when npcs field is missing from body', async () => {
        createCampaignDir('test-npcs-campaign');

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-npcs-campaign/npcs')
            .send({});

        expect(res.status).toBe(500);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('Failed to save NPCs');
    });

    it('should return 500 on filesystem write error', async () => {
        createCampaignDir('test-npcs-campaign');

        const app = createTestApp();

        const spy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {
            throw new Error('Disk full');
        });

        const res = await request(app)
            .post('/api/campaigns/test-npcs-campaign/npcs')
            .send({ npcs: [{ name: 'Should Fail', type: 'Human', level: 1 }] });

        expect(res.status).toBe(500);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('Failed to save NPCs');

        spy.mockRestore();
    });

    it('should return 500 on filesystem mkdir error', async () => {
        createCampaignDir('test-npcs-campaign');

        const app = createTestApp();

        const spy = vi.spyOn(fs, 'mkdirSync').mockImplementation(() => {
            throw new Error('Permission denied');
        });

        const res = await request(app)
            .post('/api/campaigns/test-npcs-campaign/npcs')
            .send({ npcs: [{ name: 'Should Fail', type: 'Human', level: 1 }] });

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Failed to save NPCs');

        spy.mockRestore();
    });

    it('should handle npcs with image paths', async () => {
        createCampaignDir('test-npcs-campaign');
        const npcsData = [
            { name: 'Guard Captain', type: 'Human', level: 5, imagePath: 'campaigns/test-npcs-campaign/images/Guard Captain.jpg' },
        ];

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-npcs-campaign/npcs')
            .send({ npcs: npcsData });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const fileData = readNpcsFile('test-npcs-campaign');
        expect(fileData[0].imagePath).toBe('campaigns/test-npcs-campaign/images/Guard Captain.jpg');
    });
});

// ─── PUT /api/campaigns/:campaign/npcs/:npcName ─────────────────────────────

describe('npcs - PUT /api/campaigns/:campaign/npcs/:npcName', () => {
    afterEach(() => {
        removeCampaignDir('test-npcs-campaign');
    });

    it('should create npcs.json and add NPC when file does not exist', async () => {
        createCampaignDir('test-npcs-campaign');

        const npcData = { name: 'New NPC', type: 'Human', level: 1 };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-npcs-campaign/npcs/New%20NPC')
            .send(npcData);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
        expect(res.body).toHaveProperty('npc');
        expect(res.body.npc).toEqual(npcData);

        const fileData = readNpcsFile('test-npcs-campaign');
        expect(fileData).toEqual([npcData]);
    });

    it('should update an existing NPC by name', async () => {
        createCampaignDir('test-npcs-campaign');
        createNpcsFile('test-npcs-campaign', [
            { name: 'Guard Captain', type: 'Human Warrior', level: 5 },
            { name: 'Elder Thalia', type: 'Elf Sage', level: 10 },
        ]);

        const updatedData = { name: 'Guard Captain', type: 'Human Commander', level: 8 };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-npcs-campaign/npcs/Guard%20Captain')
            .send(updatedData);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const fileData = readNpcsFile('test-npcs-campaign');
        expect(fileData).toHaveLength(2);
        expect(fileData[0].type).toBe('Human Commander');
        expect(fileData[0].level).toBe(8);
        expect(fileData[1].name).toBe('Elder Thalia');
    });

    it('should add a new NPC when name does not exist', async () => {
        createCampaignDir('test-npcs-campaign');
        createNpcsFile('test-npcs-campaign', [
            { name: 'Guard Captain', type: 'Human Warrior', level: 5 },
        ]);

        const npcData = { name: 'New NPC', type: 'Elf Rogue', level: 3 };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-npcs-campaign/npcs/New%20NPC')
            .send(npcData);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const fileData = readNpcsFile('test-npcs-campaign');
        expect(fileData).toHaveLength(2);
        expect(fileData[1].name).toBe('New NPC');
    });

    it('should handle NPC names with special characters', async () => {
        createCampaignDir('test-npcs-campaign');
        createNpcsFile('test-npcs-campaign', [
            { name: "Guard's Captain", type: 'Human', level: 5 },
        ]);

        const updatedData = { name: "Guard's Captain", type: 'Human Commander', level: 8 };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-npcs-campaign/npcs/Guard%27s%20Captain')
            .send(updatedData);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const fileData = readNpcsFile('test-npcs-campaign');
        expect(fileData[0].type).toBe('Human Commander');
        expect(fileData[0].level).toBe(8);
    });

    it('should handle npcs.json containing non-array data', async () => {
        createCampaignDir('test-npcs-campaign');
        const dataDir = path.join(testCampaignsDir, 'test-npcs-campaign', 'data');
        fs.mkdirSync(dataDir, { recursive: true });
        const filePath = path.join(dataDir, 'npcs.json');
        fs.writeFileSync(filePath, JSON.stringify({ not: 'an array' }, null, 2));

        const npcData = { name: 'New NPC', type: 'Human', level: 1 };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-npcs-campaign/npcs/New%20NPC')
            .send(npcData);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const fileData = readNpcsFile('test-npcs-campaign');
        expect(fileData).toHaveLength(1);
        expect(fileData[0].name).toBe('New NPC');
    });

    it('should return 500 on filesystem error', async () => {
        createCampaignDir('test-npcs-campaign');
        createNpcsFile('test-npcs-campaign', [
            { name: 'Guard Captain', type: 'Human', level: 5 },
        ]);

        const app = createTestApp();

        const spy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {
            throw new Error('Disk full');
        });

        const res = await request(app)
            .put('/api/campaigns/test-npcs-campaign/npcs/Guard%20Captain')
            .send({ name: 'Guard Captain', type: 'Human Commander', level: 8 });

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Failed to update NPC');

        spy.mockRestore();
    });

    it('should handle updating NPC with complex nested data', async () => {
        createCampaignDir('test-npcs-campaign');
        createNpcsFile('test-npcs-campaign', [
            {
                name: 'Dragon Boss',
                type: 'Ancient Red Dragon',
                level: 20,
                stats: { hp: 500, ac: 22 },
                abilities: ['Fire Breath'],
            },
        ]);

        const updatedData = {
            name: 'Dragon Boss',
            type: 'Ancient Red Dragon (Variant)',
            level: 21,
            stats: { hp: 600, ac: 23 },
            abilities: ['Fire Breath', 'Ice Breath'],
        };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-npcs-campaign/npcs/Dragon%20Boss')
            .send(updatedData);

        expect(res.status).toBe(200);

        const fileData = readNpcsFile('test-npcs-campaign');
        expect(fileData[0].type).toBe('Ancient Red Dragon (Variant)');
        expect(fileData[0].level).toBe(21);
        expect(fileData[0].stats.hp).toBe(600);
        expect(fileData[0].abilities).toEqual(['Fire Breath', 'Ice Breath']);
    });

    it('should handle updating NPC with empty name fields', async () => {
        createCampaignDir('test-npcs-campaign');
        createNpcsFile('test-npcs-campaign', [
            { name: 'Guard Captain', type: 'Human', level: 5 },
        ]);

        const updatedData = { name: 'Guard Captain', type: '', level: 0 };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-npcs-campaign/npcs/Guard%20Captain')
            .send(updatedData);

        expect(res.status).toBe(200);

        const fileData = readNpcsFile('test-npcs-campaign');
        expect(fileData[0].type).toBe('');
        expect(fileData[0].level).toBe(0);
    });
});

// ─── PUT /api/campaigns/:campaign/npcs/:npcName - Image handling ─────────────

describe('npcs - PUT image handling', () => {
    afterEach(() => {
        removeCampaignDir('test-npcs-campaign');
    });

    it('should delete the original image when imagePath is cleared', async () => {
        createCampaignDir('test-npcs-campaign');
        const imagesDir = path.join(process.cwd(), 'public', 'campaigns', 'test-npcs-campaign', 'images');
        fs.mkdirSync(imagesDir, { recursive: true });
        const imagePath = path.join(imagesDir, 'Guard Captain.jpg');
        fs.writeFileSync(imagePath, 'fake image data');

        createNpcsFile('test-npcs-campaign', [
            { name: 'Guard Captain', type: 'Human', level: 5, imagePath: 'campaigns/test-npcs-campaign/images/Guard Captain.jpg' },
        ]);

        const updatedData = { name: 'Guard Captain', type: 'Human', level: 6, imagePath: '' };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-npcs-campaign/npcs/Guard%20Captain')
            .send(updatedData);

        expect(res.status).toBe(200);
        expect(res.body.npc.imagePath).toBe('');

        // Verify the original image file was deleted
        expect(fs.existsSync(imagePath)).toBe(false);
    });

    it('should rename image file when NPC name changes and imagePath is preserved in body', async () => {
        createCampaignDir('test-npcs-campaign');
        const imagesDir = path.join(process.cwd(), 'public', 'campaigns', 'test-npcs-campaign', 'images');
        fs.mkdirSync(imagesDir, { recursive: true });
        const oldImagePath = path.join(imagesDir, 'Guard Captain.jpg');
        fs.writeFileSync(oldImagePath, 'fake image data');

        createNpcsFile('test-npcs-campaign', [
            { name: 'Guard Captain', type: 'Human', level: 5, imagePath: 'campaigns/test-npcs-campaign/images/Guard Captain.jpg' },
        ]);

        const updatedData = { name: 'New Captain', type: 'Human', level: 6, imagePath: 'campaigns/test-npcs-campaign/images/Guard Captain.jpg' };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-npcs-campaign/npcs/Guard%20Captain')
            .send(updatedData);

        expect(res.status).toBe(200);

        // Verify the image file was renamed
        const newImagePath = path.join(imagesDir, 'New Captain.jpg');
        expect(fs.existsSync(newImagePath)).toBe(true);
        expect(fs.existsSync(oldImagePath)).toBe(false);

        // Verify the npc record has the updated imagePath
        const fileData = readNpcsFile('test-npcs-campaign');
        expect(fileData[0].name).toBe('New Captain');
        expect(fileData[0].imagePath).toBe('campaigns/test-npcs-campaign/images/New Captain.jpg');
    });

    it('should handle image rename when npc name changes with special characters and imagePath preserved', async () => {
        createCampaignDir('test-npcs-campaign');
        const imagesDir = path.join(process.cwd(), 'public', 'campaigns', 'test-npcs-campaign', 'images');
        fs.mkdirSync(imagesDir, { recursive: true });
        const oldImagePath = path.join(imagesDir, "Guard's Captain.jpg");
        fs.writeFileSync(oldImagePath, 'fake image data');

        createNpcsFile('test-npcs-campaign', [
            { name: "Guard's Captain", type: 'Human', level: 5, imagePath: "campaigns/test-npcs-campaign/images/Guard's Captain.jpg" },
        ]);

        const updatedData = { name: "New Guard's Captain", type: 'Human', level: 6, imagePath: "campaigns/test-npcs-campaign/images/Guard's Captain.jpg" };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-npcs-campaign/npcs/Guard%27s%20Captain')
            .send(updatedData);

        expect(res.status).toBe(200);

        const newImagePath = path.join(imagesDir, "New Guard's Captain.jpg");
        expect(fs.existsSync(newImagePath)).toBe(true);
        expect(fs.existsSync(oldImagePath)).toBe(false);

        const fileData = readNpcsFile('test-npcs-campaign');
        expect(fileData[0].imagePath).toBe("campaigns/test-npcs-campaign/images/New Guard's Captain.jpg");
    });

    it('should not rename image file if old and new paths are the same and imagePath is preserved', async () => {
        createCampaignDir('test-npcs-campaign');
        const imagesDir = path.join(process.cwd(), 'public', 'campaigns', 'test-npcs-campaign', 'images');
        fs.mkdirSync(imagesDir, { recursive: true });
        const imagePath = path.join(imagesDir, 'Guard Captain.jpg');
        fs.writeFileSync(imagePath, 'fake image data');

        createNpcsFile('test-npcs-campaign', [
            { name: 'Guard Captain', type: 'Human', level: 5, imagePath: 'campaigns/test-npcs-campaign/images/Guard Captain.jpg' },
        ]);

        const updatedData = { name: 'Guard Captain', type: 'Human Commander', level: 6, imagePath: 'campaigns/test-npcs-campaign/images/Guard Captain.jpg' };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-npcs-campaign/npcs/Guard%20Captain')
            .send(updatedData);

        expect(res.status).toBe(200);

        // The image file should still exist unchanged
        expect(fs.existsSync(imagePath)).toBe(true);

        const fileData = readNpcsFile('test-npcs-campaign');
        // imagePath should remain unchanged since name didn't change
        expect(fileData[0].imagePath).toBe('campaigns/test-npcs-campaign/images/Guard Captain.jpg');
    });

    it('should not attempt to rename when NPC has no imagePath', async () => {
        createCampaignDir('test-npcs-campaign');

        createNpcsFile('test-npcs-campaign', [
            { name: 'Guard Captain', type: 'Human', level: 5 },
        ]);

        const updatedData = { name: 'New Captain', type: 'Human', level: 6 };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-npcs-campaign/npcs/Guard%20Captain')
            .send(updatedData);

        expect(res.status).toBe(200);

        const fileData = readNpcsFile('test-npcs-campaign');
        expect(fileData[0].name).toBe('New Captain');
        expect(fileData[0].imagePath).toBeUndefined();
    });

    it('should not attempt to rename when npcName param matches body name and imagePath is preserved', async () => {
        createCampaignDir('test-npcs-campaign');
        const imagesDir = path.join(process.cwd(), 'public', 'campaigns', 'test-npcs-campaign', 'images');
        fs.mkdirSync(imagesDir, { recursive: true });
        const imagePath = path.join(imagesDir, 'Old Name.jpg');
        fs.writeFileSync(imagePath, 'fake image data');

        createNpcsFile('test-npcs-campaign', [
            { name: 'Old Name', type: 'Human', level: 5, imagePath: 'campaigns/test-npcs-campaign/images/Old Name.jpg' },
        ]);

        // Update with a different name in body but matching the URL param
        const updatedData = { name: 'Old Name', type: 'Human Commander', level: 6, imagePath: 'campaigns/test-npcs-campaign/images/Old Name.jpg' };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-npcs-campaign/npcs/Old%20Name')
            .send(updatedData);

        expect(res.status).toBe(200);

        // Image should not be renamed since name in body matches URL param
        expect(fs.existsSync(imagePath)).toBe(true);

        const fileData = readNpcsFile('test-npcs-campaign');
        expect(fileData[0].imagePath).toBe('campaigns/test-npcs-campaign/images/Old Name.jpg');
    });

    it('should process new image upload when image and imageName fields are provided', async () => {
        createCampaignDir('test-npcs-campaign');

        createNpcsFile('test-npcs-campaign', [
            { name: 'Guard Captain', type: 'Human', level: 5 },
        ]);

        const updatedData = {
            name: 'Guard Captain',
            type: 'Human Commander',
            level: 6,
            image: 'data:image/png;base64,iVBORw0KGgo',
            imageName: 'guard.png',
        };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-npcs-campaign/npcs/Guard%20Captain')
            .send(updatedData);

        expect(res.status).toBe(200);

        const fileData = readNpcsFile('test-npcs-campaign');
        expect(fileData[0].imagePath).toBe('campaigns/test-npcs-campaign/images/Guard Captain.png');
        expect(fileData[0].image).toBeUndefined();
        expect(fileData[0].imageName).toBeUndefined();

        // Verify the image file was created
        const imagesDir = path.join(process.cwd(), 'public', 'campaigns', 'test-npcs-campaign', 'images');
        const imagePath = path.join(imagesDir, 'Guard Captain.png');
        expect(fs.existsSync(imagePath)).toBe(true);
    });

    it('should delete existing image when uploading a new one', async () => {
        createCampaignDir('test-npcs-campaign');
        const imagesDir = path.join(process.cwd(), 'public', 'campaigns', 'test-npcs-campaign', 'images');
        fs.mkdirSync(imagesDir, { recursive: true });
        const oldImagePath = path.join(imagesDir, 'Guard Captain.jpg');
        fs.writeFileSync(oldImagePath, 'old image');

        createNpcsFile('test-npcs-campaign', [
            { name: 'Guard Captain', type: 'Human', level: 5, imagePath: 'campaigns/test-npcs-campaign/images/Guard Captain.jpg' },
        ]);

        const updatedData = {
            name: 'Guard Captain',
            type: 'Human Commander',
            level: 6,
            imagePath: 'campaigns/test-npcs-campaign/images/Guard Captain.jpg',
            image: 'data:image/png;base64,newimage',
            imageName: 'guard.png',
        };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-npcs-campaign/npcs/Guard%20Captain')
            .send(updatedData);

        expect(res.status).toBe(200);

        // Old image should be deleted by processImageUpload
        expect(fs.existsSync(oldImagePath)).toBe(false);

        // New image should exist
        const newImagePath = path.join(imagesDir, 'Guard Captain.png');
        expect(fs.existsSync(newImagePath)).toBe(true);
    });

    it('should handle image upload with default .png extension when none provided', async () => {
        createCampaignDir('test-npcs-campaign');

        createNpcsFile('test-npcs-campaign', [
            { name: 'Guard Captain', type: 'Human', level: 5 },
        ]);

        const updatedData = {
            name: 'Guard Captain',
            type: 'Human Commander',
            level: 6,
            image: 'data:image/png;base64,test',
            imageName: 'guard',
        };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-npcs-campaign/npcs/Guard%20Captain')
            .send(updatedData);

        expect(res.status).toBe(200);

        const fileData = readNpcsFile('test-npcs-campaign');
        expect(fileData[0].imagePath).toBe('campaigns/test-npcs-campaign/images/Guard Captain.png');
    });

    it('should handle image upload with .jpg extension', async () => {
        createCampaignDir('test-npcs-campaign');

        createNpcsFile('test-npcs-campaign', [
            { name: 'Guard Captain', type: 'Human', level: 5 },
        ]);

        const updatedData = {
            name: 'Guard Captain',
            type: 'Human Commander',
            level: 6,
            image: 'data:image/jpeg;base64,test',
            imageName: 'guard.jpg',
        };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-npcs-campaign/npcs/Guard%20Captain')
            .send(updatedData);

        expect(res.status).toBe(200);

        const fileData = readNpcsFile('test-npcs-campaign');
        expect(fileData[0].imagePath).toBe('campaigns/test-npcs-campaign/images/Guard Captain.jpg');
    });

    it('should handle adding image to existing NPC with existing image - delete old and create new', async () => {
        createCampaignDir('test-npcs-campaign');
        const imagesDir = path.join(process.cwd(), 'public', 'campaigns', 'test-npcs-campaign', 'images');
        fs.mkdirSync(imagesDir, { recursive: true });
        const oldImagePath = path.join(imagesDir, 'Guard Captain.jpg');
        fs.writeFileSync(oldImagePath, 'old image');

        createNpcsFile('test-npcs-campaign', [
            { name: 'Guard Captain', type: 'Human', level: 5, imagePath: 'campaigns/test-npcs-campaign/images/Guard Captain.jpg' },
        ]);

        const updatedData = {
            name: 'Guard Captain',
            type: 'Human Commander',
            level: 6,
            imagePath: 'campaigns/test-npcs-campaign/images/Guard Captain.jpg',
            image: 'data:image/png;base64,newimage',
            imageName: 'guard.png',
        };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-npcs-campaign/npcs/Guard%20Captain')
            .send(updatedData);

        expect(res.status).toBe(200);

        expect(fs.existsSync(oldImagePath)).toBe(false);

        const newImagePath = path.join(imagesDir, 'Guard Captain.png');
        expect(fs.existsSync(newImagePath)).toBe(true);

        const fileData = readNpcsFile('test-npcs-campaign');
        expect(fileData[0].imagePath).toBe('campaigns/test-npcs-campaign/images/Guard Captain.png');
    });
});

// ─── GET /api/campaigns/:campaign/npcs/:npcName ──────────────────────────────

describe('npcs - GET /api/campaigns/:campaign/npcs/:npcName', () => {
    afterEach(() => {
        removeCampaignDir('test-npcs-campaign');
    });

    it('should return 404 when npcs.json does not exist', async () => {
        createCampaignDir('test-npcs-campaign');

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-npcs-campaign/npcs/SomeNPC');

        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('NPC not found');
    });

    it('should return 404 when NPC name does not exist', async () => {
        createCampaignDir('test-npcs-campaign');
        createNpcsFile('test-npcs-campaign', [
            { name: 'Guard Captain', type: 'Human', level: 5 },
            { name: 'Elder Thalia', type: 'Elf', level: 10 },
        ]);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-npcs-campaign/npcs/Nonexistent');

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('NPC not found');
    });

    it('should return the NPC when found', async () => {
        createCampaignDir('test-npcs-campaign');
        const npcData = {
            name: 'Guard Captain',
            type: 'Human Warrior',
            level: 5,
            stats: { hp: 45, ac: 16 },
        };
        createNpcsFile('test-npcs-campaign', [npcData]);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-npcs-campaign/npcs/Guard%20Captain');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('npc');
        expect(res.body.npc).toEqual(npcData);
    });

    it('should return the first NPC when searching for the first one', async () => {
        createCampaignDir('test-npcs-campaign');
        createNpcsFile('test-npcs-campaign', [
            { name: 'Guard Captain', type: 'Human', level: 5 },
            { name: 'Elder Thalia', type: 'Elf', level: 10 },
        ]);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-npcs-campaign/npcs/Guard%20Captain');

        expect(res.status).toBe(200);
        expect(res.body.npc.name).toBe('Guard Captain');
        expect(res.body.npc.type).toBe('Human');
    });

    it('should return 404 when npcs.json contains non-array data', async () => {
        createCampaignDir('test-npcs-campaign');
        const dataDir = path.join(testCampaignsDir, 'test-npcs-campaign', 'data');
        fs.mkdirSync(dataDir, { recursive: true });
        const filePath = path.join(dataDir, 'npcs.json');
        fs.writeFileSync(filePath, JSON.stringify({ not: 'an array' }, null, 2));

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-npcs-campaign/npcs/SomeNPC');

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('NPC not found');
    });

    it('should return 500 on filesystem read error', async () => {
        createCampaignDir('test-npcs-campaign');
        createNpcsFile('test-npcs-campaign', []);

        const app = createTestApp();

        const spy = vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
            throw new Error('IO error');
        });

        const res = await request(app).get('/api/campaigns/test-npcs-campaign/npcs/SomeNPC');

        expect(res.status).toBe(500);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('Failed to read NPC');

        spy.mockRestore();
    });

    it('should handle NPC names with special characters in URL', async () => {
        createCampaignDir('test-npcs-campaign');
        createNpcsFile('test-npcs-campaign', [
            { name: "Guard's Captain", type: 'Human', level: 5 },
        ]);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-npcs-campaign/npcs/Guard%27s%20Captain');

        expect(res.status).toBe(200);
        expect(res.body.npc.name).toBe("Guard's Captain");
    });

    it('should return NPC with image path', async () => {
        createCampaignDir('test-npcs-campaign');
        createNpcsFile('test-npcs-campaign', [
            { name: 'Guard Captain', type: 'Human', level: 5, imagePath: 'campaigns/test-npcs-campaign/images/Guard Captain.jpg' },
        ]);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-npcs-campaign/npcs/Guard%20Captain');

        expect(res.status).toBe(200);
        expect(res.body.npc.imagePath).toBe('campaigns/test-npcs-campaign/images/Guard Captain.jpg');
    });

    it('should return NPC with complex nested data', async () => {
        createCampaignDir('test-npcs-campaign');
        const npcData = {
            name: 'Dragon Boss',
            type: 'Ancient Red Dragon',
            level: 20,
            stats: { hp: 500, ac: 22, str: 25 },
            abilities: ['Fire Breath', 'Fly', 'Legendary Actions'],
            loot: { gold: 10000, items: ['Flame Tongue Sword'] },
            active: true,
        };
        createNpcsFile('test-npcs-campaign', [npcData]);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-npcs-campaign/npcs/Dragon%20Boss');

        expect(res.status).toBe(200);
        expect(res.body.npc.stats).toEqual({ hp: 500, ac: 22, str: 25 });
        expect(res.body.npc.abilities).toEqual(['Fire Breath', 'Fly', 'Legendary Actions']);
        expect(res.body.npc.loot.items).toEqual(['Flame Tongue Sword']);
    });
});

// ─── DELETE /api/campaigns/:campaign/npcs/:npcName ───────────────────────────

describe('npcs - DELETE /api/campaigns/:campaign/npcs/:npcName', () => {
    afterEach(() => {
        removeCampaignDir('test-npcs-campaign');
    });

    it('should return 404 when npcs.json does not exist', async () => {
        createCampaignDir('test-npcs-campaign');

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-npcs-campaign/npcs/SomeNPC');

        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('NPC not found');
    });

    it('should return 200 and succeed when NPC does not exist (no-op delete)', async () => {
        createCampaignDir('test-npcs-campaign');
        createNpcsFile('test-npcs-campaign', [
            { name: 'Guard Captain', type: 'Human', level: 5 },
            { name: 'Elder Thalia', type: 'Elf', level: 10 },
        ]);

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-npcs-campaign/npcs/Nonexistent');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const fileData = readNpcsFile('test-npcs-campaign');
        expect(fileData).toHaveLength(2);
    });

    it('should delete an NPC and return success', async () => {
        createCampaignDir('test-npcs-campaign');
        createNpcsFile('test-npcs-campaign', [
            { name: 'Guard Captain', type: 'Human', level: 5 },
            { name: 'Elder Thalia', type: 'Elf', level: 10 },
        ]);

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-npcs-campaign/npcs/Guard%20Captain');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const fileData = readNpcsFile('test-npcs-campaign');
        expect(fileData).toHaveLength(1);
        expect(fileData[0].name).toBe('Elder Thalia');
    });

    it('should remove only the specified NPC when multiple exist', async () => {
        createCampaignDir('test-npcs-campaign');
        createNpcsFile('test-npcs-campaign', [
            { name: 'Guard Captain', type: 'Human', level: 5 },
            { name: 'Elder Thalia', type: 'Elf', level: 10 },
            { name: 'Merchant Joe', type: 'Human', level: 2 },
        ]);

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-npcs-campaign/npcs/Elder%20Thalia');

        expect(res.status).toBe(200);

        const fileData = readNpcsFile('test-npcs-campaign');
        expect(fileData).toHaveLength(2);
        expect(fileData.map(n => n.name)).toEqual(['Guard Captain', 'Merchant Joe']);
    });

    it('should handle deleting the last NPC', async () => {
        createCampaignDir('test-npcs-campaign');
        createNpcsFile('test-npcs-campaign', [
            { name: 'Only NPC', type: 'Human', level: 1 },
        ]);

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-npcs-campaign/npcs/Only%20NPC');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const fileData = readNpcsFile('test-npcs-campaign');
        expect(fileData).toEqual([]);
    });

    it('should return 200 when deleting from empty npcs list (no-op delete)', async () => {
        createCampaignDir('test-npcs-campaign');
        createNpcsFile('test-npcs-campaign', []);

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-npcs-campaign/npcs/SomeNPC');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
    });

    it('should return 500 on filesystem read error', async () => {
        createCampaignDir('test-npcs-campaign');
        createNpcsFile('test-npcs-campaign', []);

        const app = createTestApp();

        const spy = vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
            throw new Error('IO error');
        });

        const res = await request(app).delete('/api/campaigns/test-npcs-campaign/npcs/SomeNPC');

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Failed to delete NPC');

        spy.mockRestore();
    });

    it('should return 500 on filesystem write error', async () => {
        createCampaignDir('test-npcs-campaign');
        createNpcsFile('test-npcs-campaign', [
            { name: 'Guard Captain', type: 'Human', level: 5 },
        ]);

        const app = createTestApp();

        const spy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {
            throw new Error('Disk full');
        });

        const res = await request(app).delete('/api/campaigns/test-npcs-campaign/npcs/Guard%20Captain');

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Failed to delete NPC');

        spy.mockRestore();
    });

    it('should handle npcs.json containing non-array data', async () => {
        createCampaignDir('test-npcs-campaign');
        const dataDir = path.join(testCampaignsDir, 'test-npcs-campaign', 'data');
        fs.mkdirSync(dataDir, { recursive: true });
        const filePath = path.join(dataDir, 'npcs.json');
        fs.writeFileSync(filePath, JSON.stringify({ not: 'an array' }, null, 2));

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-npcs-campaign/npcs/SomeNPC');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const fileData = readNpcsFile('test-npcs-campaign');
        expect(fileData).toEqual([]);
    });

    it('should handle NPC names with special characters', async () => {
        createCampaignDir('test-npcs-campaign');
        createNpcsFile('test-npcs-campaign', [
            { name: "Guard's Captain", type: 'Human', level: 5 },
            { name: 'Elder Thalia', type: 'Elf', level: 10 },
        ]);

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-npcs-campaign/npcs/Guard%27s%20Captain');

        expect(res.status).toBe(200);

        const fileData = readNpcsFile('test-npcs-campaign');
        expect(fileData).toHaveLength(1);
        expect(fileData[0].name).toBe('Elder Thalia');
    });

    it('should delete associated image file when NPC has imagePath', async () => {
        createCampaignDir('test-npcs-campaign');
        const imagesDir = path.join(process.cwd(), 'public', 'campaigns', 'test-npcs-campaign', 'images');
        fs.mkdirSync(imagesDir, { recursive: true });
        const imagePath = path.join(imagesDir, 'Guard Captain.jpg');
        fs.writeFileSync(imagePath, 'fake image data');

        createNpcsFile('test-npcs-campaign', [
            { name: 'Guard Captain', type: 'Human', level: 5, imagePath: 'campaigns/test-npcs-campaign/images/Guard Captain.jpg' },
            { name: 'Elder Thalia', type: 'Elf', level: 10 },
        ]);

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-npcs-campaign/npcs/Guard%20Captain');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        // Verify the image file was deleted
        expect(fs.existsSync(imagePath)).toBe(false);

        const fileData = readNpcsFile('test-npcs-campaign');
        expect(fileData).toHaveLength(1);
        expect(fileData[0].name).toBe('Elder Thalia');
    });

    it('should handle deleting NPC with image when image file does not exist on disk', async () => {
        createCampaignDir('test-npcs-campaign');

        createNpcsFile('test-npcs-campaign', [
            { name: 'Guard Captain', type: 'Human', level: 5, imagePath: 'campaigns/test-npcs-campaign/images/Guard Captain.jpg' },
        ]);

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-npcs-campaign/npcs/Guard%20Captain');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const fileData = readNpcsFile('test-npcs-campaign');
        expect(fileData).toEqual([]);
    });

    it('should handle deleting NPC without imagePath', async () => {
        createCampaignDir('test-npcs-campaign');
        createNpcsFile('test-npcs-campaign', [
            { name: 'Guard Captain', type: 'Human', level: 5 },
            { name: 'Elder Thalia', type: 'Elf', level: 10, imagePath: 'campaigns/test-npcs-campaign/images/Elder Thalia.png' },
        ]);

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-npcs-campaign/npcs/Guard%20Captain');

        expect(res.status).toBe(200);

        const fileData = readNpcsFile('test-npcs-campaign');
        expect(fileData).toHaveLength(1);
        expect(fileData[0].name).toBe('Elder Thalia');
    });

    it('should handle deleting NPC with complex nested data', async () => {
        createCampaignDir('test-npcs-campaign');
        createNpcsFile('test-npcs-campaign', [
            {
                name: 'Dragon Boss',
                type: 'Ancient Red Dragon',
                level: 20,
                stats: { hp: 500, ac: 22 },
                abilities: ['Fire Breath', 'Fly'],
            },
            { name: 'Elder Thalia', type: 'Elf', level: 10 },
        ]);

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-npcs-campaign/npcs/Dragon%20Boss');

        expect(res.status).toBe(200);

        const fileData = readNpcsFile('test-npcs-campaign');
        expect(fileData).toHaveLength(1);
        expect(fileData[0].name).toBe('Elder Thalia');
    });
});
