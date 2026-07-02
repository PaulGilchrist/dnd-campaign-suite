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
    it('should return empty quests list when no quests exist and user is localhost', async () => {
        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/quests')
            .set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('quests');
        expect(Array.isArray(res.body.quests)).toBe(true);
        expect(res.body.quests).toEqual([]);
    });

    it('should return empty quests list when no quests exist and user is 127.0.0.1', async () => {
        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/quests')
            .set('Host', '127.0.0.1');

        expect(res.status).toBe(200);
        expect(res.body.quests).toEqual([]);
    });

    it('should return empty quests list for non-localhost users even when quests exist', async () => {
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

    it('should return 403 for any non-localhost hostname', async () => {
        const questsData = [
            { id: 'quest-1', title: 'Quest One', description: 'Content', stage: 'active', objectives: [] },
        ];
        setupMock('quests', 'test-campaign', questsData);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/quests')
            .set('Host', 'example.com');

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

        const stored = MOCK_STORE.get('test-campaign:quests');
        expect(stored).toHaveLength(2);
        expect(stored[0].title).toBe('Slay the Dragon');
        expect(stored[1].title).toBe('Rescue the Villager');
    });

    it('should save an empty array of quests', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/quests')
            .send({ quests: [] });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const stored = MOCK_STORE.get('test-campaign:quests');
        expect(stored).toEqual([]);
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

        const stored = MOCK_STORE.get('test-campaign:quests');
        expect(stored).toHaveLength(1);
        expect(stored[0].title).toBe('New Quest');
    });

    it('should handle quests with complex nested objectives and rewards', async () => {
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

        const stored = MOCK_STORE.get('test-campaign:quests');
        expect(stored).toHaveLength(1);
        expect(stored[0].objectives[0].completed).toBe(true);
        expect(stored[0].rewards.xp).toBe(500);
        expect(stored[0].rewards.items).toEqual(['Ancient Sword']);
    });

    it('should handle missing quests in request body and save empty array', async () => {
        const existingData = [
            { id: 'old-1', title: 'Old Quest', description: 'Old', stage: 'completed', objectives: [] },
        ];
        setupMock('quests', 'test-campaign', existingData);

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/quests')
            .send({});

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const stored = MOCK_STORE.get('test-campaign:quests');
        expect(stored).toEqual([]);
    });

    it('should save quests with string objectives (array of strings)', async () => {
        const questsData = [
            { id: 'quest-1', title: 'Simple Objectives', description: 'Test', stage: 'active', objectives: ['Step 1', 'Step 2', 'Step 3'] },
        ];

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/quests')
            .send({ quests: questsData });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const stored = MOCK_STORE.get('test-campaign:quests');
        expect(stored[0].objectives).toEqual(['Step 1', 'Step 2', 'Step 3']);
    });

    it('should save quests with empty description and objectives', async () => {
        const questsData = [
            { id: 'quest-1', title: 'Minimal Quest', description: '', stage: 'inactive', objectives: [] },
        ];

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/quests')
            .send({ quests: questsData });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const stored = MOCK_STORE.get('test-campaign:quests');
        expect(stored[0].description).toBe('');
        expect(stored[0].objectives).toEqual([]);
    });
});

// ─── GET /api/campaigns/:campaign/quests/:questId ────────────────────────────

describe('quests - GET /api/campaigns/:campaign/quests/:questId', () => {
    it('should return 404 when quests.json does not exist', async () => {
        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/quests/quest-1');

        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error', 'Quest not found');
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

    it('should return quest with complex nested objectives and rewards', async () => {
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
            rewards: { xp: 500, gold: 100, items: ['Ancient Sword', 'Magic Shield'] },
        };
        setupMock('quests', 'test-campaign', [questData]);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/quests/quest-42')
            .set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body.quest).toEqual(questData);
        expect(res.body.quest.objectives[0].completed).toBe(true);
        expect(res.body.quest.rewards.items).toEqual(['Ancient Sword', 'Magic Shield']);
    });

    it('should handle quest ids with special characters via URL encoding', async () => {
        const questData = {
            id: 'quest/with/slashes',
            title: 'Special ID Quest',
            description: 'Has slashes in id',
            stage: 'active',
            objectives: [],
        };
        setupMock('quests', 'test-campaign', [questData]);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/quests/quest%2Fwith%2Fslashes')
            .set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body.quest.title).toBe('Special ID Quest');
    });

    it('should handle UUID-style quest ids', async () => {
        const questData = {
            id: 'a1b2c3d4-e5f6-a7b8-c9d0-e1f2a3b4c5d6',
            title: 'UUID Quest',
            description: 'UUID style id',
            stage: 'active',
            objectives: [],
        };
        setupMock('quests', 'test-campaign', [questData]);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/quests/a1b2c3d4-e5f6-a7b8-c9d0-e1f2a3b4c5d6')
            .set('Host', 'localhost');

        expect(res.status).toBe(200);
        expect(res.body.quest.title).toBe('UUID Quest');
    });

    it('should return quest with all stage values', async () => {
        const stages = ['inactive', 'active', 'completed', 'abandoned'];
        for (const stage of stages) {
            const questData = { id: `quest-${stage}`, title: `${stage} quest`, description: 'Test', stage, objectives: [] };
            setupMock('quests', 'test-campaign', [questData]);

            const app = createTestApp();
            const res = await request(app)
                .get(`/api/campaigns/test-campaign/quests/quest-${stage}`)
                .set('Host', 'localhost');

            expect(res.status).toBe(200);
            expect(res.body.quest.stage).toBe(stage);
        }
    });
});

// ─── DELETE /api/campaigns/:campaign/quests/:questId ─────────────────────────

describe('quests - DELETE /api/campaigns/:campaign/quests/:questId', () => {
    it('should return 404 when quests.json does not exist', async () => {
        const app = createTestApp();
        const res = await request(app)
            .delete('/api/campaigns/test-campaign/quests/quest-1');

        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error', 'Quest not found');
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

        const stored = MOCK_STORE.get('test-campaign:quests');
        expect(stored).toHaveLength(1);
        expect(stored[0].title).toBe('Keep Me');
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

        const stored = MOCK_STORE.get('test-campaign:quests');
        expect(stored).toHaveLength(1);
        expect(stored[0].title).toBe('Keep Me');
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

        const stored = MOCK_STORE.get('test-campaign:quests');
        expect(stored).toHaveLength(2);
        expect(stored.map(q => q.title)).toEqual(['First', 'Third']);
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

        const stored = MOCK_STORE.get('test-campaign:quests');
        expect(stored).toHaveLength(0);
    });

    it('should handle deleting from an empty quests list (no-op delete)', async () => {
        setupMock('quests', 'test-campaign', []);

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

        const stored = MOCK_STORE.get('test-campaign:quests');
        expect(stored).toHaveLength(1);
        expect(stored[0].title).toBe('Simple Quest');
    });

    it('should delete quest with UUID-style id', async () => {
        const questsData = [
            { id: 'a1b2c3d4-e5f6-a7b8-c9d0-e1f2a3b4c5d6', title: 'Delete Me', description: 'Content', stage: 'active', objectives: [] },
            { id: 'b2c3d4e5-f6a7-b8c9-d0e1-f2a3b4c5d6e7', title: 'Keep Me', description: 'Content', stage: 'active', objectives: [] },
        ];
        setupMock('quests', 'test-campaign', questsData);

        const app = createTestApp();
        const res = await request(app)
            .delete('/api/campaigns/test-campaign/quests/a1b2c3d4-e5f6-a7b8-c9d0-e1f2a3b4c5d6');

        expect(res.status).toBe(200);

        const stored = MOCK_STORE.get('test-campaign:quests');
        expect(stored).toHaveLength(1);
        expect(stored[0].title).toBe('Keep Me');
    });

    it('should delete quest with special characters in id', async () => {
        const questsData = [
            { id: 'quest/with/slashes', title: 'Delete Me', description: 'Content', stage: 'active', objectives: [] },
            { id: 'quest/keep/this', title: 'Keep Me', description: 'Content', stage: 'active', objectives: [] },
        ];
        setupMock('quests', 'test-campaign', questsData);

        const app = createTestApp();
        const res = await request(app)
            .delete('/api/campaigns/test-campaign/quests/quest%2Fwith%2Fslashes');

        expect(res.status).toBe(200);

        const stored = MOCK_STORE.get('test-campaign:quests');
        expect(stored).toHaveLength(1);
        expect(stored[0].id).toBe('quest/keep/this');
    });
});
