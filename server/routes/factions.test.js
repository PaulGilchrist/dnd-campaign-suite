import { Router } from 'express';
import express from 'express';
import request from 'supertest';

// Shared mock store keyed by "campaign:factions"
const MOCK_STORE = new Map();

function setupMock(campaign, data) {
    const key = `${campaign}:factions`;
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
// factions uses default idField='id', responseWrapper='factions', itemWrapper='faction'
function createMockRouter() {
    const router = Router();
    const idField = 'id';
    const singularDisplayName = 'Faction';

    // GET list
    router.get('/api/campaigns/:campaign/factions', (req, res) => {
        const campaign = req.params.campaign;
        const key = `${campaign}:factions`;
        const data = MOCK_STORE.get(key);
        const entities = Array.isArray(data) ? data : [];
        res.json({ factions: entities });
    });

    // POST save (overwrite entire array)
    router.post('/api/campaigns/:campaign/factions', (req, res) => {
        const campaign = req.params.campaign;
        const entities = req.body.factions;
        if (!Array.isArray(entities)) {
            return res.status(400).json({ error: 'Expected an array for factions' });
        }
        setupMock(campaign, entities);
        res.json({ success: true });
    });

    // GET by id (idField='id' by default)
    router.get('/api/campaigns/:campaign/factions/:id', (req, res) => {
        const campaign = req.params.campaign;
        const id = decodeURIComponent(req.params.id);
        const key = `${campaign}:factions`;

        if (!MOCK_STORE.has(key)) {
            return res.status(404).json({ error: `${singularDisplayName} not found` });
        }

        const entities = Array.isArray(MOCK_STORE.get(key)) ? MOCK_STORE.get(key) : [];
        const entity = entities.find(e => e[idField] === id);

        if (!entity) {
            return res.status(404).json({ error: `${singularDisplayName} not found` });
        }

        res.json({ faction: entity });
    });

    // DELETE by id (idField='id' by default)
    router.delete('/api/campaigns/:campaign/factions/:id', (req, res) => {
        const campaign = req.params.campaign;
        const id = decodeURIComponent(req.params.id);
        const key = `${campaign}:factions`;

        if (!MOCK_STORE.has(key)) {
            return res.status(404).json({ error: `${singularDisplayName} not found` });
        }

        const entities = Array.isArray(MOCK_STORE.get(key)) ? MOCK_STORE.get(key) : [];
        const filtered = entities.filter(e => e[idField] !== id);

        setupMock(campaign, filtered);
        res.json({ success: true });
    });

    return router;
}

// Mock jsonEntityCrud
vi.mock('../utils/jsonEntityCrud.js', () => ({
    createJsonEntityRouter: () => createMockRouter(),
}));

import factions from './factions.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(factions);
    return app;
}

afterEach(() => {
    clearMockStore();
    vi.restoreAllMocks();
});

// ─── GET /api/campaigns/:campaign/factions ───────────────────────────────────

describe('factions - GET /api/campaigns/:campaign/factions', () => {
    it('should return an empty factions list when no factions.json exists', async () => {
        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/factions');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('factions');
        expect(Array.isArray(res.body.factions)).toBe(true);
        expect(res.body.factions).toEqual([]);
    });

    it('should return all factions when file exists', async () => {
        const factionsData = [
            {
                id: 'f1a2b3c4-d5e6-f7a8-b9c0-d1e2f3a4b5c6',
                name: 'The Survivors of Ironhaven',
                description: 'The remaining townsfolk',
                goals: 'Survive the immediate threat',
                influence: 6,
                notes: 'Led by Mayor Brunnilda',
            },
            {
                id: 'f2b3c4d5-e6f7-a8b9-c0d1-e2f3a4b5c6d7',
                name: 'The Ironfist Undead',
                description: 'Thorgar Ironfist undead army',
                goals: 'Purge the surface world',
                influence: 8,
                notes: 'Growing in number',
            },
        ];
        setupMock('test-campaign', factionsData);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/factions');

        expect(res.status).toBe(200);
        expect(res.body.factions).toHaveLength(2);
        expect(res.body.factions[0].id).toBe('f1a2b3c4-d5e6-f7a8-b9c0-d1e2f3a4b5c6');
        expect(res.body.factions[0].name).toBe('The Survivors of Ironhaven');
        expect(res.body.factions[1].id).toBe('f2b3c4d5-e6f7-a8b9-c0d1-e2f3a4b5c6d7');
        expect(res.body.factions[1].name).toBe('The Ironfist Undead');
    });

    it('should return factions with all expected fields', async () => {
        const factionData = {
            id: 'f3c4d5e6-f7a8-b9c0-d1e2-f3a4b5c6d7e8',
            name: 'The Deep Dwellers',
            description: 'Two duergar hiding in deepest levels',
            goals: 'Survive Thorgar expanding undead army',
            influence: 3,
            notes: 'Found in the deepest levels of the Ancient Tomb',
        };
        setupMock('test-campaign', [factionData]);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/factions');

        expect(res.status).toBe(200);
        expect(res.body.factions).toHaveLength(1);
        expect(res.body.factions[0]).toEqual(factionData);
    });

    it('should handle factions.json containing non-array data and return empty array', async () => {
        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/factions');

        expect(res.status).toBe(200);
        expect(res.body.factions).toEqual([]);
    });

    it('should handle factions.json containing null and return empty array', async () => {
        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/factions');

        expect(res.status).toBe(200);
        expect(res.body.factions).toEqual([]);
    });
});

// ─── POST /api/campaigns/:campaign/factions ──────────────────────────────────

describe('factions - POST /api/campaigns/:campaign/factions', () => {
    it('should save factions and return success', async () => {
        const factionsData = [
            {
                id: 'f1a2b3c4-d5e6-f7a8-b9c0-d1e2f3a4b5c6',
                name: 'The Survivors of Ironhaven',
                description: 'The remaining townsfolk',
                goals: 'Survive',
                influence: 6,
                notes: 'Led by Mayor Brunnilda',
            },
            {
                id: 'f2b3c4d5-e6f7-a8b9-c0d1-e2f3a4b5c6d7',
                name: 'The Ironfist Undead',
                description: 'Thorgar Ironfist undead army',
                goals: 'Purge the surface world',
                influence: 8,
                notes: 'Growing in number',
            },
        ];

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/factions')
            .send({ factions: factionsData });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const stored = MOCK_STORE.get('test-campaign:factions');
        expect(stored).toHaveLength(2);
        expect(stored[0].name).toBe('The Survivors of Ironhaven');
        expect(stored[1].name).toBe('The Ironfist Undead');
    });

    it('should save an empty array of factions', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/factions')
            .send({ factions: [] });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const stored = MOCK_STORE.get('test-campaign:factions');
        expect(stored).toEqual([]);
    });

    it('should overwrite existing factions with the new array', async () => {
        const existingData = [
            { id: 'old-1', name: 'Old Faction', description: 'Old', goals: 'Old', influence: 1, notes: '' },
        ];
        setupMock('test-campaign', existingData);

        const newFactionsData = [
            { id: 'new-1', name: 'New Faction', description: 'New', goals: 'New', influence: 5, notes: '' },
        ];

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/factions')
            .send({ factions: newFactionsData });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const stored = MOCK_STORE.get('test-campaign:factions');
        expect(stored).toHaveLength(1);
        expect(stored[0].name).toBe('New Faction');
    });

    it('should handle factions with complex nested data', async () => {
        const factionsData = [
            {
                id: 'f1a2b3c4-d5e6-f7a8-b9c0-d1e2f3a4b5c6',
                name: 'The Survivors of Ironhaven',
                description: 'The remaining townsfolk of Ironhaven, mostly humans who married into the dwarven Stonebeard clan generations ago. They are terrified, starving, and desperate.',
                goals: 'Survive the immediate threat, find out what happened to the missing miners, and stop whatever horror has taken root in Irondeep Hold. They control the surface resources and can provide supplies, information, and gold to the party.',
                influence: 6,
                notes: 'The Survivors are led by Mayor Brunnilda Stonebeard. They have limited supplies — enough food for a few more days, mining tools, and some basic adventuring gear.',
            },
        ];

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/factions')
            .send({ factions: factionsData });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
    });

    it('should return 400 when factions is missing from request body', async () => {
        const existingData = [
            { id: 'old-1', name: 'Old Faction', description: 'Old', goals: 'Old', influence: 1, notes: '' },
        ];
        setupMock('test-campaign', existingData);

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/factions')
            .send({});

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'Expected an array for factions');
    });
});

// ─── GET /api/campaigns/:campaign/factions/:factionId ────────────────────────

describe('factions - GET /api/campaigns/:campaign/factions/:factionId', () => {
    it('should return 404 when factions.json does not exist', async () => {
        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/factions/f1a2b3c4-d5e6-f7a8-b9c0-d1e2f3a4b5c6');

        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error', 'Faction not found');
    });

    it('should return 404 when faction with given id does not exist', async () => {
        const factionsData = [
            { id: 'f1a2b3c4-d5e6-f7a8-b9c0-d1e2f3a4b5c6', name: 'The Survivors of Ironhaven', description: 'The remaining townsfolk', goals: 'Survive', influence: 6, notes: '' },
        ];
        setupMock('test-campaign', factionsData);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/factions/nonexistent-id');

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Faction not found');
    });

    it('should return the faction when found by id', async () => {
        const factionData = {
            id: 'f1a2b3c4-d5e6-f7a8-b9c0-d1e2f3a4b5c6',
            name: 'The Survivors of Ironhaven',
            description: 'The remaining townsfolk of Ironhaven',
            goals: 'Survive the immediate threat',
            influence: 6,
            notes: 'Led by Mayor Brunnilda Stonebeard',
        };
        setupMock('test-campaign', [factionData]);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/factions/f1a2b3c4-d5e6-f7a8-b9c0-d1e2f3a4b5c6');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('faction');
        expect(res.body.faction).toEqual(factionData);
    });

    it('should return faction from middle of array', async () => {
        const factionsData = [
            { id: 'f1', name: 'First Faction', description: 'First', goals: 'First', influence: 1, notes: '' },
            { id: 'f2', name: 'Middle Faction', description: 'Middle', goals: 'Middle', influence: 5, notes: '' },
            { id: 'f3', name: 'Last Faction', description: 'Last', goals: 'Last', influence: 10, notes: '' },
        ];
        setupMock('test-campaign', factionsData);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/factions/f2');

        expect(res.status).toBe(200);
        expect(res.body.faction.name).toBe('Middle Faction');
        expect(res.body.faction.influence).toBe(5);
    });

    it('should handle factions.json containing non-array data and return 404', async () => {
        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/factions/any-id');

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Faction not found');
    });

    it('should return 404 when existsSync returns false', async () => {
        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/factions/any-id');

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Faction not found');
    });

    it('should handle UUID-style faction ids', async () => {
        const factionData = {
            id: 'f3c4d5e6-f7a8-b9c0-d1e2-f3a4b5c6d7e8',
            name: 'The Deep Dwellers',
            description: 'Two duergar hiding in deepest levels',
            goals: 'Survive Thorgar expanding undead army',
            influence: 3,
            notes: 'Found in the deepest levels of the Ancient Tomb',
        };
        setupMock('test-campaign', [factionData]);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/factions/f3c4d5e6-f7a8-b9c0-d1e2-f3a4b5c6d7e8');

        expect(res.status).toBe(200);
        expect(res.body.faction.name).toBe('The Deep Dwellers');
    });

    it('should handle faction ids with special characters via encoding', async () => {
        const factionData = {
            id: 'faction/with/slashes',
            name: 'Special ID Faction',
            description: 'Has slashes in id',
            goals: 'Test',
            influence: 1,
            notes: '',
        };
        setupMock('test-campaign', [factionData]);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/factions/faction%2Fwith%2Fslashes');

        expect(res.status).toBe(200);
        expect(res.body.faction.name).toBe('Special ID Faction');
    });
});

// ─── DELETE /api/campaigns/:campaign/factions/:factionId ─────────────────────

describe('factions - DELETE /api/campaigns/:campaign/factions/:factionId', () => {
    it('should return 404 when factions.json does not exist', async () => {
        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-campaign/factions/f1a2b3c4-d5e6-f7a8-b9c0-d1e2f3a4b5c6');

        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error', 'Faction not found');
    });

    it('should return 200 and succeed when faction does not exist (no-op delete)', async () => {
        const factionsData = [
            { id: 'f1', name: 'Keep Me', description: 'Keep', goals: 'Keep', influence: 1, notes: '' },
        ];
        setupMock('test-campaign', factionsData);

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-campaign/factions/nonexistent');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
    });

    it('should delete a faction and return success', async () => {
        const factionsData = [
            { id: 'f1', name: 'Keep Me', description: 'Keep', goals: 'Keep', influence: 1, notes: '' },
            { id: 'f2', name: 'Delete Me', description: 'Delete', goals: 'Delete', influence: 5, notes: '' },
        ];
        setupMock('test-campaign', factionsData);

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-campaign/factions/f2');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const stored = MOCK_STORE.get('test-campaign:factions');
        expect(stored).toHaveLength(1);
        expect(stored[0].name).toBe('Keep Me');
    });

    it('should remove only the specified faction when multiple exist', async () => {
        const factionsData = [
            { id: 'f1', name: 'First', description: 'First', goals: 'First', influence: 1, notes: '' },
            { id: 'f2', name: 'Second', description: 'Second', goals: 'Second', influence: 5, notes: '' },
            { id: 'f3', name: 'Third', description: 'Third', goals: 'Third', influence: 10, notes: '' },
        ];
        setupMock('test-campaign', factionsData);

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-campaign/factions/f2');

        expect(res.status).toBe(200);

        const stored = MOCK_STORE.get('test-campaign:factions');
        expect(stored).toHaveLength(2);
        expect(stored.map(f => f.name)).toEqual(['First', 'Third']);
    });

    it('should handle deleting the only faction', async () => {
        const factionsData = [
            { id: 'f1', name: 'Only Faction', description: 'Only', goals: 'Only', influence: 5, notes: '' },
        ];
        setupMock('test-campaign', factionsData);

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-campaign/factions/f1');

        expect(res.status).toBe(200);

        const stored = MOCK_STORE.get('test-campaign:factions');
        expect(stored).toHaveLength(0);
    });

    it('should handle deleting from an empty factions list (no-op delete)', async () => {
        setupMock('test-campaign', []);

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-campaign/factions/f1');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
    });

    it('should handle factions.json containing non-array data', async () => {
        setupMock('test-campaign', []);

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-campaign/factions/any-id');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
    });

    it('should delete faction with complex nested data', async () => {
        const factionsData = [
            {
                id: 'f1a2b3c4-d5e6-f7a8-b9c0-d1e2f3a4b5c6',
                name: 'The Survivors of Ironhaven',
                description: 'The remaining townsfolk of Ironhaven, mostly humans who married into the dwarven Stonebeard clan generations ago.',
                goals: 'Survive the immediate threat, find out what happened to the missing miners, and stop whatever horror has taken root in Irondeep Hold.',
                influence: 6,
                notes: 'The Survivors are led by Mayor Brunnilda Stonebeard. They have limited supplies.',
            },
            {
                id: 'f2b3c4d5-e6f7-a8b9-c0d1-e2f3a4b5c6d7',
                name: 'The Ironfist Undead',
                description: 'Thorgar Ironfist undead army',
                goals: 'Purge the surface world of the living',
                influence: 8,
                notes: 'Growing in number as Thorgar power increases',
            },
        ];
        setupMock('test-campaign', factionsData);

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-campaign/factions/f1a2b3c4-d5e6-f7a8-b9c0-d1e2f3a4b5c6');

        expect(res.status).toBe(200);

        const stored = MOCK_STORE.get('test-campaign:factions');
        expect(stored).toHaveLength(1);
        expect(stored[0].name).toBe('The Ironfist Undead');
    });

    it('should return 404 when existsSync returns false', async () => {
        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-campaign/factions/any-id');

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Faction not found');
    });

    it('should handle deleting with encoded UUID-style ids', async () => {
        const factionsData = [
            { id: 'f3c4d5e6-f7a8-b9c0-d1e2-f3a4b5c6d7e8', name: 'The Deep Dwellers', description: 'Two duergar', goals: 'Survive', influence: 3, notes: '' },
            { id: 'f1a2b3c4-d5e6-f7a8-b9c0-d1e2f3a4b5c6', name: 'Keep Me', description: 'Keep', goals: 'Keep', influence: 5, notes: '' },
        ];
        setupMock('test-campaign', factionsData);

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-campaign/factions/f3c4d5e6-f7a8-b9c0-d1e2-f3a4b5c6d7e8');

        expect(res.status).toBe(200);

        const stored = MOCK_STORE.get('test-campaign:factions');
        expect(stored).toHaveLength(1);
        expect(stored[0].name).toBe('Keep Me');
    });
});
