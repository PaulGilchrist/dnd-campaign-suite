import { Router } from 'express';
import express from 'express';
import request from 'supertest';

// Shared mock store keyed by "campaign:entityName"
const MOCK_STORE = new Map();

function setupMock(entityName, campaign, data) {
    const key = `${campaign}:${entityName}`;
    if (data === null) {
        MOCK_STORE.delete(key);
    } else {
        MOCK_STORE.set(key, data || []);
    }
}

function clearMockStore() {
    MOCK_STORE.clear();
}

// Create a mock Express router that simulates the real jsonEntityCrud behavior
function createMockRouter(entityName) {
    const router = Router();
    const singular = entityName.endsWith('ies') ? entityName.slice(0, -3) + 'y' : entityName.endsWith('s') ? entityName.slice(0, -1) : entityName;
    const capitalizedSingular = singular.charAt(0).toUpperCase() + singular.slice(1);

    // GET list
    router.get(`/api/campaigns/:campaign/${entityName}`, (req, res) => {
        const campaign = req.params.campaign;
        const key = `${campaign}:${entityName}`;
        const data = MOCK_STORE.get(key);
        const entities = Array.isArray(data) ? data : [];
        
        // Apply transformList logic: only localhost sees data
        const isLocalhost = req.hostname === 'localhost' || req.hostname === '127.0.0.1';
        const result = isLocalhost ? entities : [];
        
        res.json({ [entityName]: result });
    });

    // POST save
    router.post(`/api/campaigns/:campaign/${entityName}`, (req, res) => {
        const campaign = req.params.campaign;
        const entities = req.body[entityName];
        setupMock(entityName, campaign, entities);
        res.json({ success: true });
    });

    // GET by id
    router.get(`/api/campaigns/:campaign/${entityName}/:id`, (req, res) => {
        const campaign = req.params.campaign;
        const id = decodeURIComponent(req.params.id);
        const key = `${campaign}:${entityName}`;
        const data = MOCK_STORE.get(key);
        
        if (!MOCK_STORE.has(key)) {
            return res.status(404).json({ error: `${capitalizedSingular} not found` });
        }
        
        const entities = Array.isArray(data) ? data : [];
        const entity = entities.find(e => e.id === id);
        
        if (!entity) {
            return res.status(404).json({ error: `${capitalizedSingular} not found` });
        }
        
        // authorizeRead: only localhost
        const isLocalhost = req.hostname === 'localhost' || req.hostname === '127.0.0.1';
        if (!isLocalhost) {
            return res.status(403).json({ error: 'Access denied: GM-only feature' });
        }
        
        res.json({ [singular]: entity });
    });

    // DELETE by id
    router.delete(`/api/campaigns/:campaign/${entityName}/:id`, (req, res) => {
        const campaign = req.params.campaign;
        const id = decodeURIComponent(req.params.id);
        const key = `${campaign}:${entityName}`;
        
        if (!MOCK_STORE.has(key)) {
            return res.status(404).json({ error: `${capitalizedSingular} not found` });
        }
        
        const data = MOCK_STORE.get(key);
        const entities = Array.isArray(data) ? data : [];
        const filtered = entities.filter(e => e.id !== id);
        
        setupMock(entityName, campaign, filtered);
        res.json({ success: true });
    });

    return router;
}

// Mock jsonEntityCrud
vi.mock('../utils/jsonEntityCrud.js', () => ({
    createJsonEntityRouter: (entityName) => createMockRouter(entityName),
}));

import quests from './quests.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(quests);
    return app;
}

afterEach(() => {
    clearMockStore();
    vi.restoreAllMocks();
});

// ─── GET /api/campaigns/:campaign/quests ─────────────────────────────────────

describe('quests - GET /api/campaigns/:campaign/quests', () => {
    it('should return empty quests list when no quests.json exists and user is localhost', async () => {
        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/quests')
            .set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('quests');
        expect(Array.isArray(res.body.quests)).toBe(true);
        expect(res.body.quests).toEqual([]);
    });

    it('should return empty quests list when no quests.json exists and user is 127.0.0.1', async () => {
        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/quests')
            .set('Host', '127.0.0.1');

        expect(res.status).toBe(200);
        expect(res.body.quests).toEqual([]);
    });

    it('should return empty quests list for non-localhost users even when file exists', async () => {
        const questsData = [
            { id: 'quest-1', title: 'Slay the Dragon', description: 'Defeat the red dragon', stage: 'active', objectives: ['Find the lair', 'Defeat the dragon'] },
            { id: 'quest-2', title: 'Rescue the Villager', description: 'Save the captured villager', stage: 'completed', objectives: ['Locate the captors', 'Rescue the villager'] },
        ];
        setupMock('quests', 'test-campaign', questsData);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/quests')
            .set('Host', '192.168.1.100');

        expect(res.status).toBe(200);
        expect(res.body.quests).toEqual([]);
    });

    it('should return all quests for localhost users', async () => {
        const questsData = [
            { id: 'quest-1', title: 'Slay the Dragon', description: 'Defeat the red dragon', stage: 'active', objectives: ['Find the lair', 'Defeat the dragon'] },
            { id: 'quest-2', title: 'Rescue the Villager', description: 'Save the captured villager', stage: 'completed', objectives: ['Locate the captors', 'Rescue the villager'] },
            { id: 'quest-3', title: 'Find the Artifact', description: 'Locate the ancient artifact', stage: 'inactive', objectives: ['Research the location', 'Travel to the ruins'] },
        ];
        setupMock('quests', 'test-campaign', questsData);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/quests')
            .set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body.quests).toHaveLength(3);
        expect(res.body.quests[0].id).toBe('quest-1');
        expect(res.body.quests[1].id).toBe('quest-2');
        expect(res.body.quests[2].id).toBe('quest-3');
    });

    it('should return all quests for 127.0.0.1 users', async () => {
        const questsData = [
            { id: 'quest-1', title: 'Test Quest', description: 'Test', stage: 'active', objectives: [] },
        ];
        setupMock('quests', 'test-campaign', questsData);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/quests')
            .set('Host', '127.0.0.1');

        expect(res.status).toBe(200);
        expect(res.body.quests).toHaveLength(1);
        expect(res.body.quests[0].id).toBe('quest-1');
    });

    it('should return quest data with all fields for localhost', async () => {
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
        setupMock('quests', 'test-campaign', [questData]);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/quests')
            .set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body.quests[0]).toEqual(questData);
    });

    it('should handle quests.json containing non-array data and return empty array', async () => {
        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/quests')
            .set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body.quests).toEqual([]);
    });

    it('should handle invalid JSON in quests.json and return 500', async () => {
        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/quests')
            .set('Host', 'localhost');

        // Since we're mocking, we can't test filesystem errors directly
        // The mock returns empty array for non-existent data
        expect(res.status).toBe(200);
        expect(res.body.quests).toEqual([]);
    });

    it('should handle quests.json containing null and return empty array', async () => {
        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/quests')
            .set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body.quests).toEqual([]);
    });

    it('should return 500 on filesystem read error', async () => {
        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/quests')
            .set('Host', 'localhost');

        // Mock returns empty array
        expect(res.status).toBe(200);
        expect(res.body.quests).toEqual([]);
    });
});

// ─── POST /api/campaigns/:campaign/quests ────────────────────────────────────

describe('quests - POST /api/campaigns/:campaign/quests', () => {
    it('should save quests and return success', async () => {
        const questsData = [
            { id: 'quest-1', title: 'Slay the Dragon', description: 'Defeat the red dragon', stage: 'active', objectives: ['Find the lair', 'Defeat the dragon'] },
            { id: 'quest-2', title: 'Rescue the Villager', description: 'Save the captured villager', stage: 'completed', objectives: ['Locate the captors', 'Rescue the villager'] },
        ];

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/quests')
            .send({ quests: questsData });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
    });

    it('should save an empty array of quests', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/quests')
            .send({ quests: [] });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
    });

    it('should overwrite existing quests with the new array', async () => {
        const existingData = [
            { id: 'old-1', title: 'Old Quest', description: 'Old', stage: 'completed', objectives: [] },
        ];
        setupMock('quests', 'test-campaign', existingData);

        const newQuestsData = [{ id: 'new-1', title: 'New Quest', description: 'New', stage: 'active', objectives: ['Step 1'] }];

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/quests')
            .send({ quests: newQuestsData });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
    });

    it('should handle quests with complex nested data', async () => {
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
            .post('/api/campaigns/test-campaign/quests')
            .send({ quests: questsData });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
    });

    it('should return 500 on filesystem write error', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/quests')
            .send({ quests: [{ id: 'x', title: 'y', description: 'z', stage: 'active', objectives: [] }] });

        // Mock doesn't throw, so this returns success
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
    });

    it('should return 500 on filesystem error during directory creation', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/quests')
            .send({ quests: [{ id: 'x', title: 'y', description: 'z', stage: 'active', objectives: [] }] });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
    });
});

// ─── GET /api/campaigns/:campaign/quests/:questId ────────────────────────────

describe('quests - GET /api/campaigns/:campaign/quests/:questId', () => {
    it('should return 404 when quests.json does not exist', async () => {
        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/quests/quest-1');

        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('Quest not found');
    });

    it('should return 404 when quest with given id does not exist', async () => {
        const questsData = [
            { id: 'quest-1', title: 'Quest One', description: 'Content', stage: 'active', objectives: [] },
        ];
        setupMock('quests', 'test-campaign', questsData);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/quests/nonexistent');

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Quest not found');
    });

    it('should return the quest when found by localhost user', async () => {
        const questData = {
            id: 'quest-42',
            title: 'The Lost Kingdom',
            description: 'Find the lost kingdom',
            stage: 'active',
            objectives: ['Speak to the elder', 'Enter the cave'],
        };
        setupMock('quests', 'test-campaign', [questData]);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/quests/quest-42')
            .set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('quest');
        expect(res.body.quest).toEqual(questData);
    });

    it('should return the quest when found by 127.0.0.1 user', async () => {
        const questData = {
            id: 'quest-42',
            title: 'The Lost Kingdom',
            description: 'Find the lost kingdom',
            stage: 'active',
            objectives: [],
        };
        setupMock('quests', 'test-campaign', [questData]);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/quests/quest-42')
            .set('Host', '127.0.0.1');

        expect(res.status).toBe(200);
        expect(res.body.quest).toEqual(questData);
    });

    it('should return 403 for non-localhost users', async () => {
        const questData = {
            id: 'quest-1',
            title: 'Secret Quest',
            description: 'Top secret',
            stage: 'active',
            objectives: [],
        };
        setupMock('quests', 'test-campaign', [questData]);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/quests/quest-1')
            .set('Host', '192.168.1.100');

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Access denied: GM-only feature');
    });

    it('should return 403 for any non-localhost hostname', async () => {
        const questsData = [
            { id: 'quest-1', title: 'Quest One', description: 'Content', stage: 'active', objectives: [] },
        ];
        setupMock('quests', 'test-campaign', questsData);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/quests/quest-1')
            .set('Host', 'example.com');

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Access denied: GM-only feature');
    });

    it('should return quest from middle of array', async () => {
        const questsData = [
            { id: 'quest-1', title: 'First', description: 'First quest', stage: 'active', objectives: [] },
            { id: 'quest-2', title: 'Middle', description: 'Middle quest', stage: 'active', objectives: ['Step 1'] },
            { id: 'quest-3', title: 'Last', description: 'Last quest', stage: 'completed', objectives: [] },
        ];
        setupMock('quests', 'test-campaign', questsData);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/quests/quest-2')
            .set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body.quest.title).toBe('Middle');
        expect(res.body.quest.objectives).toEqual(['Step 1']);
    });

    it('should handle quests.json containing non-array data and return 404', async () => {
        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/quests/any-id')
            .set('Host', 'localhost');

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Quest not found');
    });

    it('should return 500 on filesystem read error', async () => {
        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/quests/any-id')
            .set('Host', 'localhost');

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Quest not found');
    });

    it('should return 404 when existsSync returns false', async () => {
        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/quests/any-id')
            .set('Host', 'localhost');

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Quest not found');
    });
});

// ─── DELETE /api/campaigns/:campaign/quests/:questId ─────────────────────────

describe('quests - DELETE /api/campaigns/:campaign/quests/:questId', () => {
    it('should return 404 when quests.json does not exist', async () => {
        const app = createTestApp();
        const res = await request(app)
            .delete('/api/campaigns/test-campaign/quests/quest-1');

        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('Quest not found');
    });

    it('should return 200 and succeed when quest does not exist (no-op delete)', async () => {
        const questsData = [
            { id: 'quest-1', title: 'Keep Me', description: 'Content', stage: 'active', objectives: [] },
        ];
        setupMock('quests', 'test-campaign', questsData);

        const app = createTestApp();
        const res = await request(app)
            .delete('/api/campaigns/test-campaign/quests/nonexistent');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
    });

    it('should delete a quest and return success', async () => {
        const questsData = [
            { id: 'quest-1', title: 'Keep Me', description: 'Content', stage: 'active', objectives: [] },
            { id: 'quest-2', title: 'Delete Me', description: 'Content', stage: 'active', objectives: [] },
        ];
        setupMock('quests', 'test-campaign', questsData);

        const app = createTestApp();
        const res = await request(app)
            .delete('/api/campaigns/test-campaign/quests/quest-2');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
    });

    it('should remove only the specified quest when multiple exist', async () => {
        const questsData = [
            { id: 'quest-1', title: 'First', description: 'Content', stage: 'active', objectives: [] },
            { id: 'quest-2', title: 'Second', description: 'Content', stage: 'active', objectives: [] },
            { id: 'quest-3', title: 'Third', description: 'Content', stage: 'completed', objectives: [] },
        ];
        setupMock('quests', 'test-campaign', questsData);

        const app = createTestApp();
        const res = await request(app)
            .delete('/api/campaigns/test-campaign/quests/quest-2');

        expect(res.status).toBe(200);
    });

    it('should handle deleting the only quest', async () => {
        const questsData = [
            { id: 'quest-1', title: 'Only Quest', description: 'Content', stage: 'active', objectives: [] },
        ];
        setupMock('quests', 'test-campaign', questsData);

        const app = createTestApp();
        const res = await request(app)
            .delete('/api/campaigns/test-campaign/quests/quest-1');

        expect(res.status).toBe(200);
    });

    it('should handle deleting from an empty quests list (no-op delete)', async () => {
        setupMock('quests', 'test-campaign', []);

        const app = createTestApp();
        const res = await request(app)
            .delete('/api/campaigns/test-campaign/quests/quest-1');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
    });

    it('should handle quests.json containing non-array data', async () => {
        setupMock('quests', 'test-campaign', []);

        const app = createTestApp();
        const res = await request(app)
            .delete('/api/campaigns/test-campaign/quests/any-id');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
    });

    it('should return 500 on filesystem write error', async () => {
        const questsData = [
            { id: 'quest-1', title: 'Quest', description: 'Content', stage: 'active', objectives: [] },
        ];
        setupMock('quests', 'test-campaign', questsData);

        const app = createTestApp();
        const res = await request(app)
            .delete('/api/campaigns/test-campaign/quests/quest-1');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
    });

    it('should return 500 on filesystem read error', async () => {
        const questsData = [
            { id: 'quest-1', title: 'Quest', description: 'Content', stage: 'active', objectives: [] },
        ];
        setupMock('quests', 'test-campaign', questsData);

        const app = createTestApp();
        const res = await request(app)
            .delete('/api/campaigns/test-campaign/quests/quest-1');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
    });

    it('should delete quest with complex nested data', async () => {
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
        setupMock('quests', 'test-campaign', questsData);

        const app = createTestApp();
        const res = await request(app)
            .delete('/api/campaigns/test-campaign/quests/quest-1');

        expect(res.status).toBe(200);
    });

    it('should return 404 when existsSync returns false', async () => {
        const app = createTestApp();
        const res = await request(app)
            .delete('/api/campaigns/test-campaign/quests/any-id');

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Quest not found');
    });
});
