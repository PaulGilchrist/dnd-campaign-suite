import request from 'supertest';
import express from 'express';
import fs from 'fs';
import path from 'path';
import quests from './quests.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(quests);
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

function createQuestsFile(campaignName, questsData) {
    const dataDir = path.join(testCampaignsDir, campaignName, 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    const filePath = path.join(dataDir, 'quests.json');
    fs.writeFileSync(filePath, JSON.stringify(questsData, null, 2));
}

function readQuestsFile(campaignName) {
    const filePath = path.join(testCampaignsDir, campaignName, 'data', 'quests.json');
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

// ─── GET /api/campaigns/:campaign/quests ─────────────────────────────────────

describe('quests - GET /api/campaigns/:campaign/quests', () => {
    afterEach(() => {
        removeCampaignDir('test-quests-campaign');
    });

    it('should return empty quests list when no quests.json exists and user is localhost', async () => {
        createCampaignDir('test-quests-campaign');

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-quests-campaign/quests')
            .set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('quests');
        expect(Array.isArray(res.body.quests)).toBe(true);
        expect(res.body.quests).toEqual([]);

        // Verify the file was created
        const fileData = readQuestsFile('test-quests-campaign');
        expect(fileData).toEqual([]);
    });

    it('should return empty quests list when no quests.json exists and user is 127.0.0.1', async () => {
        createCampaignDir('test-quests-campaign');

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-quests-campaign/quests')
            .set('Host', '127.0.0.1');

        expect(res.status).toBe(200);
        expect(res.body.quests).toEqual([]);
    });

    it('should return empty quests list for non-localhost users even when file exists', async () => {
        createCampaignDir('test-quests-campaign');
        createQuestsFile('test-quests-campaign', [
            { id: 'quest-1', title: 'Slay the Dragon', description: 'Defeat the red dragon', stage: 'active', objectives: ['Find the lair', 'Defeat the dragon'] },
            { id: 'quest-2', title: 'Rescue the Villager', description: 'Save the captured villager', stage: 'completed', objectives: ['Locate the captors', 'Rescue the villager'] },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-quests-campaign/quests')
            .set('Host', '192.168.1.100');

        expect(res.status).toBe(200);
        expect(res.body.quests).toEqual([]);
    });

    it('should return all quests for localhost users', async () => {
        createCampaignDir('test-quests-campaign');
        createQuestsFile('test-quests-campaign', [
            { id: 'quest-1', title: 'Slay the Dragon', description: 'Defeat the red dragon', stage: 'active', objectives: ['Find the lair', 'Defeat the dragon'] },
            { id: 'quest-2', title: 'Rescue the Villager', description: 'Save the captured villager', stage: 'completed', objectives: ['Locate the captors', 'Rescue the villager'] },
            { id: 'quest-3', title: 'Find the Artifact', description: 'Locate the ancient artifact', stage: 'inactive', objectives: ['Research the location', 'Travel to the ruins'] },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-quests-campaign/quests')
            .set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body.quests).toHaveLength(3);
        expect(res.body.quests[0].id).toBe('quest-1');
        expect(res.body.quests[1].id).toBe('quest-2');
        expect(res.body.quests[2].id).toBe('quest-3');
    });

    it('should return all quests for 127.0.0.1 users', async () => {
        createCampaignDir('test-quests-campaign');
        createQuestsFile('test-quests-campaign', [
            { id: 'quest-1', title: 'Test Quest', description: 'Test', stage: 'active', objectives: [] },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-quests-campaign/quests')
            .set('Host', '127.0.0.1');

        expect(res.status).toBe(200);
        expect(res.body.quests).toHaveLength(1);
        expect(res.body.quests[0].id).toBe('quest-1');
    });

    it('should return quest data with all fields for localhost', async () => {
        createCampaignDir('test-quests-campaign');
        const questData = {
            id: 'quest-42',
            title: 'The Lost Kingdom',
            description: 'Find the lost kingdom of old',
            stage: 'active',
            objectives: [
                { description: 'Speak to the elder', completed: true },
                { description: 'Enter the cave', completed: false },
                { description: 'Defeat the guardian', completed: false },
            ],
            rewards: { xp: 500, gold: 100, items: ['Ancient Sword'] },
        };
        createQuestsFile('test-quests-campaign', [questData]);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-quests-campaign/quests')
            .set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body.quests[0]).toEqual(questData);
    });

    it('should handle quests.json containing non-array data and return empty array', async () => {
        createCampaignDir('test-quests-campaign');
        const dataDir = path.join(testCampaignsDir, 'test-quests-campaign', 'data');
        fs.mkdirSync(dataDir, { recursive: true });
        const filePath = path.join(dataDir, 'quests.json');
        fs.writeFileSync(filePath, JSON.stringify({ not: 'an array' }, null, 2));

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-quests-campaign/quests')
            .set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body.quests).toEqual([]);
    });

    it('should handle invalid JSON in quests.json and return 500', async () => {
        createCampaignDir('test-quests-campaign');
        const dataDir = path.join(testCampaignsDir, 'test-quests-campaign', 'data');
        fs.mkdirSync(dataDir, { recursive: true });
        const filePath = path.join(dataDir, 'quests.json');
        fs.writeFileSync(filePath, 'not valid json{{{');

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-quests-campaign/quests')
            .set('Host', 'localhost');

        expect(res.status).toBe(500);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('Failed to read quests');
    });

    it('should handle quests.json containing null and return empty array', async () => {
        createCampaignDir('test-quests-campaign');
        const dataDir = path.join(testCampaignsDir, 'test-quests-campaign', 'data');
        fs.mkdirSync(dataDir, { recursive: true });
        const filePath = path.join(dataDir, 'quests.json');
        fs.writeFileSync(filePath, 'null');

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-quests-campaign/quests')
            .set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body.quests).toEqual([]);
    });

    it('should return 500 on filesystem read error', async () => {
        createCampaignDir('test-quests-campaign');
        createQuestsFile('test-quests-campaign', []);

        const app = createTestApp();

        const spy = vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
            throw new Error('IO error');
        });

        const res = await request(app)
            .get('/api/campaigns/test-quests-campaign/quests')
            .set('Host', 'localhost');

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Failed to read quests');

        spy.mockRestore();
    });
});

// ─── POST /api/campaigns/:campaign/quests ────────────────────────────────────

describe('quests - POST /api/campaigns/:campaign/quests', () => {
    afterEach(() => {
        removeCampaignDir('test-quests-campaign');
    });

    it('should save quests and return success', async () => {
        createCampaignDir('test-quests-campaign');

        const questsData = [
            { id: 'quest-1', title: 'Slay the Dragon', description: 'Defeat the red dragon', stage: 'active', objectives: ['Find the lair', 'Defeat the dragon'] },
            { id: 'quest-2', title: 'Rescue the Villager', description: 'Save the captured villager', stage: 'completed', objectives: ['Locate the captors', 'Rescue the villager'] },
        ];

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-quests-campaign/quests')
            .send({ quests: questsData });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const fileData = readQuestsFile('test-quests-campaign');
        expect(fileData).toEqual(questsData);
    });

    it('should create the data directory if it does not exist', async () => {
        createCampaignDir('test-quests-campaign');

        const questsData = [{ id: 'quest-1', title: 'Test Quest', description: 'Test', stage: 'active', objectives: [] }];

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-quests-campaign/quests')
            .send({ quests: questsData });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
        expect(fs.existsSync(path.join(testCampaignsDir, 'test-quests-campaign', 'data'))).toBe(true);
    });

    it('should save an empty array of quests', async () => {
        createCampaignDir('test-quests-campaign');

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-quests-campaign/quests')
            .send({ quests: [] });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const fileData = readQuestsFile('test-quests-campaign');
        expect(fileData).toEqual([]);
    });

    it('should overwrite existing quests with the new array', async () => {
        createCampaignDir('test-quests-campaign');
        createQuestsFile('test-quests-campaign', [
            { id: 'old-1', title: 'Old Quest', description: 'Old', stage: 'completed', objectives: [] },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-quests-campaign/quests')
            .send({ quests: [{ id: 'new-1', title: 'New Quest', description: 'New', stage: 'active', objectives: ['Step 1'] }] });

        expect(res.status).toBe(200);

        const fileData = readQuestsFile('test-quests-campaign');
        expect(fileData).toHaveLength(1);
        expect(fileData[0].id).toBe('new-1');
        expect(fileData[0].title).toBe('New Quest');
    });

    it('should handle quests with complex nested data', async () => {
        createCampaignDir('test-quests-campaign');

        const questsData = [
            {
                id: 'quest-1',
                title: 'The Lost Kingdom',
                description: 'Find the lost kingdom of old',
                stage: 'active',
                objectives: [
                    { description: 'Speak to the elder', completed: true },
                    { description: 'Enter the cave', completed: false },
                ],
                rewards: { xp: 500, gold: 100, items: ['Ancient Sword'] },
            },
        ];

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-quests-campaign/quests')
            .send({ quests: questsData });

        expect(res.status).toBe(200);

        const fileData = readQuestsFile('test-quests-campaign');
        expect(fileData[0].objectives).toHaveLength(2);
        expect(fileData[0].objectives[0].completed).toBe(true);
        expect(fileData[0].rewards.xp).toBe(500);
        expect(fileData[0].rewards.items).toEqual(['Ancient Sword']);
    });

    it('should return 500 on filesystem write error', async () => {
        createCampaignDir('test-quests-campaign');

        const app = createTestApp();

        const spy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {
            throw new Error('Disk full');
        });

        const res = await request(app)
            .post('/api/campaigns/test-quests-campaign/quests')
            .send({ quests: [{ id: 'x', title: 'y', description: 'z', stage: 'active', objectives: [] }] });

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Failed to save quests');

        spy.mockRestore();
    });

    it('should return 500 on filesystem error during directory creation', async () => {
        createCampaignDir('test-quests-campaign');

        const app = createTestApp();

        const spy = vi.spyOn(fs, 'mkdirSync').mockImplementation(() => {
            throw new Error('Permission denied');
        });

        const res = await request(app)
            .post('/api/campaigns/test-quests-campaign/quests')
            .send({ quests: [{ id: 'x', title: 'y', description: 'z', stage: 'active', objectives: [] }] });

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Failed to save quests');

        spy.mockRestore();
    });
});

// ─── GET /api/campaigns/:campaign/quests/:questId ────────────────────────────

describe('quests - GET /api/campaigns/:campaign/quests/:questId', () => {
    afterEach(() => {
        removeCampaignDir('test-quests-campaign');
    });

    it('should return 404 when quests.json does not exist', async () => {
        createCampaignDir('test-quests-campaign');

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-quests-campaign/quests/quest-1');

        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('Quest not found');
    });

    it('should return 404 when quest with given id does not exist', async () => {
        createCampaignDir('test-quests-campaign');
        createQuestsFile('test-quests-campaign', [
            { id: 'quest-1', title: 'Quest One', description: 'Content', stage: 'active', objectives: [] },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-quests-campaign/quests/nonexistent');

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Quest not found');
    });

    it('should return the quest when found by localhost user', async () => {
        createCampaignDir('test-quests-campaign');
        const questData = {
            id: 'quest-42',
            title: 'The Lost Kingdom',
            description: 'Find the lost kingdom',
            stage: 'active',
            objectives: ['Speak to the elder', 'Enter the cave'],
        };
        createQuestsFile('test-quests-campaign', [questData]);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-quests-campaign/quests/quest-42')
            .set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('quest');
        expect(res.body.quest).toEqual(questData);
    });

    it('should return the quest when found by 127.0.0.1 user', async () => {
        createCampaignDir('test-quests-campaign');
        const questData = {
            id: 'quest-42',
            title: 'The Lost Kingdom',
            description: 'Find the lost kingdom',
            stage: 'active',
            objectives: [],
        };
        createQuestsFile('test-quests-campaign', [questData]);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-quests-campaign/quests/quest-42')
            .set('Host', '127.0.0.1');

        expect(res.status).toBe(200);
        expect(res.body.quest).toEqual(questData);
    });

    it('should return 403 for non-localhost users', async () => {
        createCampaignDir('test-quests-campaign');
        const questData = {
            id: 'quest-1',
            title: 'Secret Quest',
            description: 'Top secret',
            stage: 'active',
            objectives: [],
        };
        createQuestsFile('test-quests-campaign', [questData]);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-quests-campaign/quests/quest-1')
            .set('Host', '192.168.1.100');

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Access denied: GM-only feature');
    });

    it('should return 403 for any non-localhost hostname', async () => {
        createCampaignDir('test-quests-campaign');
        createQuestsFile('test-quests-campaign', [
            { id: 'quest-1', title: 'Quest One', description: 'Content', stage: 'active', objectives: [] },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-quests-campaign/quests/quest-1')
            .set('Host', 'example.com');

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Access denied: GM-only feature');
    });

    it('should return quest from middle of array', async () => {
        createCampaignDir('test-quests-campaign');
        const questsData = [
            { id: 'quest-1', title: 'First', description: 'First quest', stage: 'active', objectives: [] },
            { id: 'quest-2', title: 'Middle', description: 'Middle quest', stage: 'active', objectives: ['Step 1'] },
            { id: 'quest-3', title: 'Last', description: 'Last quest', stage: 'completed', objectives: [] },
        ];
        createQuestsFile('test-quests-campaign', questsData);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-quests-campaign/quests/quest-2')
            .set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body.quest.title).toBe('Middle');
        expect(res.body.quest.objectives).toEqual(['Step 1']);
    });

    it('should handle quests.json containing non-array data and return 404', async () => {
        createCampaignDir('test-quests-campaign');
        createQuestsFile('test-quests-campaign', { not: 'an array' });

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-quests-campaign/quests/any-id')
            .set('Host', 'localhost');

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Quest not found');
    });

    it('should return 500 on filesystem read error', async () => {
        createCampaignDir('test-quests-campaign');
        createQuestsFile('test-quests-campaign', []);

        const app = createTestApp();

        const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
        const readSpy = vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
            throw new Error('IO error');
        });

        const res = await request(app)
            .get('/api/campaigns/test-quests-campaign/quests/any-id')
            .set('Host', 'localhost');

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Failed to read quest');

        existsSpy.mockRestore();
        readSpy.mockRestore();
    });

    it('should return 404 when existsSync returns false', async () => {
        createCampaignDir('test-quests-campaign');

        const app = createTestApp();

        const spy = vi.spyOn(fs, 'existsSync').mockReturnValue(false);

        const res = await request(app)
            .get('/api/campaigns/test-quests-campaign/quests/any-id')
            .set('Host', 'localhost');

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Quest not found');

        spy.mockRestore();
    });
});

// ─── DELETE /api/campaigns/:campaign/quests/:questId ─────────────────────────

describe('quests - DELETE /api/campaigns/:campaign/quests/:questId', () => {
    afterEach(() => {
        removeCampaignDir('test-quests-campaign');
    });

    it('should return 404 when quests.json does not exist', async () => {
        createCampaignDir('test-quests-campaign');

        const app = createTestApp();
        const res = await request(app)
            .delete('/api/campaigns/test-quests-campaign/quests/quest-1');

        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('Quest not found');
    });

    it('should return 200 and succeed when quest does not exist (no-op delete)', async () => {
        createCampaignDir('test-quests-campaign');
        createQuestsFile('test-quests-campaign', [
            { id: 'quest-1', title: 'Keep Me', description: 'Content', stage: 'active', objectives: [] },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .delete('/api/campaigns/test-quests-campaign/quests/nonexistent');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const fileData = readQuestsFile('test-quests-campaign');
        expect(fileData).toHaveLength(1);
    });

    it('should delete a quest and return success', async () => {
        createCampaignDir('test-quests-campaign');
        createQuestsFile('test-quests-campaign', [
            { id: 'quest-1', title: 'Keep Me', description: 'Content', stage: 'active', objectives: [] },
            { id: 'quest-2', title: 'Delete Me', description: 'Content', stage: 'active', objectives: [] },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .delete('/api/campaigns/test-quests-campaign/quests/quest-2');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const fileData = readQuestsFile('test-quests-campaign');
        expect(fileData).toHaveLength(1);
        expect(fileData[0].id).toBe('quest-1');
    });

    it('should remove only the specified quest when multiple exist', async () => {
        createCampaignDir('test-quests-campaign');
        createQuestsFile('test-quests-campaign', [
            { id: 'quest-1', title: 'First', description: 'Content', stage: 'active', objectives: [] },
            { id: 'quest-2', title: 'Second', description: 'Content', stage: 'active', objectives: [] },
            { id: 'quest-3', title: 'Third', description: 'Content', stage: 'completed', objectives: [] },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .delete('/api/campaigns/test-quests-campaign/quests/quest-2');

        expect(res.status).toBe(200);

        const fileData = readQuestsFile('test-quests-campaign');
        expect(fileData).toHaveLength(2);
        expect(fileData.map(q => q.id)).toEqual(['quest-1', 'quest-3']);
    });

    it('should handle deleting the only quest', async () => {
        createCampaignDir('test-quests-campaign');
        createQuestsFile('test-quests-campaign', [
            { id: 'quest-1', title: 'Only Quest', description: 'Content', stage: 'active', objectives: [] },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .delete('/api/campaigns/test-quests-campaign/quests/quest-1');

        expect(res.status).toBe(200);

        const fileData = readQuestsFile('test-quests-campaign');
        expect(fileData).toEqual([]);
    });

    it('should handle deleting from an empty quests list (no-op delete)', async () => {
        createCampaignDir('test-quests-campaign');
        createQuestsFile('test-quests-campaign', []);

        const app = createTestApp();
        const res = await request(app)
            .delete('/api/campaigns/test-quests-campaign/quests/quest-1');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const fileData = readQuestsFile('test-quests-campaign');
        expect(fileData).toEqual([]);
    });

    it('should handle quests.json containing non-array data', async () => {
        createCampaignDir('test-quests-campaign');
        createQuestsFile('test-quests-campaign', { not: 'an array' });

        const app = createTestApp();
        const res = await request(app)
            .delete('/api/campaigns/test-quests-campaign/quests/any-id');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const fileData = readQuestsFile('test-quests-campaign');
        expect(fileData).toEqual([]);
    });

    it('should return 500 on filesystem write error', async () => {
        createCampaignDir('test-quests-campaign');
        createQuestsFile('test-quests-campaign', [
            { id: 'quest-1', title: 'Quest', description: 'Content', stage: 'active', objectives: [] },
        ]);

        const app = createTestApp();

        const spy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {
            throw new Error('Disk full');
        });

        const res = await request(app)
            .delete('/api/campaigns/test-quests-campaign/quests/quest-1');

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Failed to delete quest');

        spy.mockRestore();
    });

    it('should return 500 on filesystem read error', async () => {
        createCampaignDir('test-quests-campaign');
        createQuestsFile('test-quests-campaign', [
            { id: 'quest-1', title: 'Quest', description: 'Content', stage: 'active', objectives: [] },
        ]);

        const app = createTestApp();

        const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
        const readSpy = vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
            throw new Error('IO error');
        });

        const res = await request(app)
            .delete('/api/campaigns/test-quests-campaign/quests/quest-1');

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Failed to delete quest');

        existsSpy.mockRestore();
        readSpy.mockRestore();
    });

    it('should delete quest with complex nested data', async () => {
        createCampaignDir('test-quests-campaign');
        const questsData = [
            {
                id: 'quest-1',
                title: 'The Lost Kingdom',
                description: 'Find the lost kingdom',
                stage: 'active',
                objectives: [
                    { description: 'Speak to the elder', completed: true },
                    { description: 'Enter the cave', completed: false },
                ],
                rewards: { xp: 500, gold: 100, items: ['Ancient Sword'] },
            },
            {
                id: 'quest-2',
                title: 'Simple Quest',
                description: 'Simple',
                stage: 'completed',
                objectives: [],
            },
        ];
        createQuestsFile('test-quests-campaign', questsData);

        const app = createTestApp();
        const res = await request(app)
            .delete('/api/campaigns/test-quests-campaign/quests/quest-1');

        expect(res.status).toBe(200);

        const fileData = readQuestsFile('test-quests-campaign');
        expect(fileData).toHaveLength(1);
        expect(fileData[0].id).toBe('quest-2');
        expect(fileData[0].title).toBe('Simple Quest');
    });

    it('should return 404 when existsSync returns false', async () => {
        createCampaignDir('test-quests-campaign');

        const app = createTestApp();

        const spy = vi.spyOn(fs, 'existsSync').mockReturnValue(false);

        const res = await request(app)
            .delete('/api/campaigns/test-quests-campaign/quests/any-id');

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Quest not found');

        spy.mockRestore();
    });
});
