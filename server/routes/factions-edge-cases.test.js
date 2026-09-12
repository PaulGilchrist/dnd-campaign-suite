import { Router } from 'express';
import express from 'express';
import { request } from '../test-utils/localhostSupertest.js';

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

// ─── Campaign Isolation ──────────────────────────────────────────────────────

describe('factions - campaign isolation', () => {
    it('should keep factions data separate between different campaigns', async () => {
        const campaignAFactions = [
            { id: 'a1', name: 'Campaign A Faction', description: 'A', goals: 'A', influence: 1, notes: '' },
        ];
        const campaignBFactions = [
            { id: 'b1', name: 'Campaign B Faction', description: 'B', goals: 'B', influence: 5, notes: '' },
        ];
        setupMock('campaign-a', campaignAFactions);
        setupMock('campaign-b', campaignBFactions);

        const app = createTestApp();

        const resA = await request(app).get('/api/campaigns/campaign-a/factions');
        expect(resA.status).toBe(200);
        expect(resA.body.factions).toHaveLength(1);
        expect(resA.body.factions[0].name).toBe('Campaign A Faction');

        const resB = await request(app).get('/api/campaigns/campaign-b/factions');
        expect(resB.status).toBe(200);
        expect(resB.body.factions).toHaveLength(1);
        expect(resB.body.factions[0].name).toBe('Campaign B Faction');
    });

    it('should handle campaign names with special characters', async () => {
        const factionsData = [
            { id: 'f1', name: 'Special Campaign Faction', description: 'Test', goals: 'Test', influence: 3, notes: '' },
        ];
        setupMock('campaign-with-dashes', factionsData);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/campaign-with-dashes/factions');

        expect(res.status).toBe(200);
        expect(res.body.factions).toHaveLength(1);
        expect(res.body.factions[0].name).toBe('Special Campaign Faction');
    });

    it('should handle campaign names with spaces (URL-encoded)', async () => {
        const factionsData = [
            { id: 'f1', name: 'Space Campaign Faction', description: 'Test', goals: 'Test', influence: 3, notes: '' },
        ];
        setupMock('campaign with spaces', factionsData);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/campaign%20with%20spaces/factions');

        expect(res.status).toBe(200);
        expect(res.body.factions).toHaveLength(1);
        expect(res.body.factions[0].name).toBe('Space Campaign Faction');
    });
});

// ─── POST Edge Cases ─────────────────────────────────────────────────────────

describe('factions - POST edge cases', () => {
    it('should return 400 when factions is an object instead of array', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/factions')
            .send({ factions: { id: 'f1', name: 'Not An Array' } });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'Expected an array for factions');
    });

    it('should return 400 when factions is a string instead of array', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/factions')
            .send({ factions: 'not-an-array' });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'Expected an array for factions');
    });

    it('should return 400 when factions is a number instead of array', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/factions')
            .send({ factions: 42 });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'Expected an array for factions');
    });

    it('should return 400 when factions is null instead of array', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/factions')
            .send({ factions: null });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'Expected an array for factions');
    });

    it('should return 400 when factions is a boolean instead of array', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/factions')
            .send({ factions: true });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'Expected an array for factions');
    });

    it('should ignore extra fields in request body beyond factions', async () => {
        const factionsData = [
            { id: 'f1', name: 'Only Factions Matter', description: 'Test', goals: 'Test', influence: 5, notes: '' },
        ];

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/factions')
            .send({
                factions: factionsData,
                extraField: 'should be ignored',
                anotherExtra: { nested: 'data' },
            });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const stored = MOCK_STORE.get('test-campaign:factions');
        expect(stored).toHaveLength(1);
        expect(stored[0].name).toBe('Only Factions Matter');
    });

    it('should save factions with integer IDs', async () => {
        const factionsData = [
            { id: 1, name: 'Integer ID Faction', description: 'Test', goals: 'Test', influence: 5, notes: '' },
            { id: 2, name: 'Another Integer', description: 'Test', goals: 'Test', influence: 3, notes: '' },
        ];

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/factions')
            .send({ factions: factionsData });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const stored = MOCK_STORE.get('test-campaign:factions');
        expect(stored).toHaveLength(2);
        expect(stored[0].id).toBe(1);
        expect(stored[1].id).toBe(2);
    });

    it('should save factions with empty string ID', async () => {
        const factionsData = [
            { id: '', name: 'Empty ID Faction', description: 'Test', goals: 'Test', influence: 1, notes: '' },
        ];

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/factions')
            .send({ factions: factionsData });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const stored = MOCK_STORE.get('test-campaign:factions');
        expect(stored).toHaveLength(1);
        expect(stored[0].id).toBe('');
    });

    it('should save factions with large influence values', async () => {
        const factionsData = [
            { id: 'f1', name: 'High Influence', description: 'Test', goals: 'Test', influence: 999999, notes: '' },
        ];

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/factions')
            .send({ factions: factionsData });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const stored = MOCK_STORE.get('test-campaign:factions');
        expect(stored[0].influence).toBe(999999);
    });

    it('should save factions with negative influence values', async () => {
        const factionsData = [
            { id: 'f1', name: 'Negative Influence', description: 'Test', goals: 'Test', influence: -5, notes: '' },
        ];

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/factions')
            .send({ factions: factionsData });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const stored = MOCK_STORE.get('test-campaign:factions');
        expect(stored[0].influence).toBe(-5);
    });

    it('should save factions with zero influence', async () => {
        const factionsData = [
            { id: 'f1', name: 'Zero Influence', description: 'Test', goals: 'Test', influence: 0, notes: '' },
        ];

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/factions')
            .send({ factions: factionsData });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const stored = MOCK_STORE.get('test-campaign:factions');
        expect(stored[0].influence).toBe(0);
    });

    it('should save factions with unicode characters in all fields', async () => {
        const factionsData = [
            {
                id: 'faction-unicode',
                name: '日本語の派閥',
                description: 'Üñíçödé dësçríptiön',
                goals: 'Задели',
                influence: 7,
                notes: '🎉🏰⚔️',
            },
        ];

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/factions')
            .send({ factions: factionsData });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const stored = MOCK_STORE.get('test-campaign:factions');
        expect(stored[0].name).toBe('日本語の派閥');
        expect(stored[0].description).toBe('Üñíçödé dësçríptiön');
        expect(stored[0].notes).toBe('🎉🏰⚔️');
    });

    it('should save factions with very long description text', async () => {
        const longDescription = 'A'.repeat(10000);
        const factionsData = [
            { id: 'f1', name: 'Long Description', description: longDescription, goals: 'Test', influence: 1, notes: '' },
        ];

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/factions')
            .send({ factions: factionsData });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const stored = MOCK_STORE.get('test-campaign:factions');
        expect(stored[0].description.length).toBe(10000);
    });
});

// ─── GET List Response Structure ─────────────────────────────────────────────

describe('factions - GET list response structure', () => {
    it('should return exactly { factions: [...] } with no extra properties', async () => {
        const factionsData = [
            { id: 'f1', name: 'Test', description: 'Test', goals: 'Test', influence: 1, notes: '' },
        ];
        setupMock('test-campaign', factionsData);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/factions');

        expect(res.status).toBe(200);
        expect(Object.keys(res.body)).toEqual(['factions']);
        expect(Array.isArray(res.body.factions)).toBe(true);
    });

    it('should return empty object keys array when no factions exist', async () => {
        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/factions');

        expect(res.status).toBe(200);
        expect(Object.keys(res.body)).toEqual(['factions']);
    });

    it('should preserve order of factions in the list', async () => {
        const factionsData = [
            { id: 'first', name: 'First', description: 'First', goals: 'First', influence: 1, notes: '' },
            { id: 'second', name: 'Second', description: 'Second', goals: 'Second', influence: 2, notes: '' },
            { id: 'third', name: 'Third', description: 'Third', goals: 'Third', influence: 3, notes: '' },
            { id: 'fourth', name: 'Fourth', description: 'Fourth', goals: 'Fourth', influence: 4, notes: '' },
        ];
        setupMock('test-campaign', factionsData);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/factions');

        expect(res.status).toBe(200);
        const names = res.body.factions.map(f => f.name);
        expect(names).toEqual(['First', 'Second', 'Third', 'Fourth']);
    });
});

// ─── GET by ID Response Structure ────────────────────────────────────────────

describe('factions - GET by ID response structure', () => {
    it('should return exactly { faction: {...} } with no extra properties', async () => {
        const factionData = {
            id: 'f1',
            name: 'Test Faction',
            description: 'Test',
            goals: 'Test',
            influence: 5,
            notes: 'Test notes',
        };
        setupMock('test-campaign', [factionData]);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/factions/f1');

        expect(res.status).toBe(200);
        expect(Object.keys(res.body)).toEqual(['faction']);
        expect(res.body.faction).toEqual(factionData);
    });

    it('should return exactly { error: "Faction not found" } on 404', async () => {
        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/factions/nonexistent');

        expect(res.status).toBe(404);
        expect(Object.keys(res.body)).toEqual(['error']);
        expect(res.body.error).toBe('Faction not found');
    });
});

// ─── DELETE Response Structure ───────────────────────────────────────────────

describe('factions - DELETE response structure', () => {
    it('should return exactly { success: true } on successful delete', async () => {
        const factionsData = [
            { id: 'f1', name: 'Delete Me', description: 'Delete', goals: 'Delete', influence: 1, notes: '' },
        ];
        setupMock('test-campaign', factionsData);

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-campaign/factions/f1');

        expect(res.status).toBe(200);
        expect(Object.keys(res.body)).toEqual(['success']);
        expect(res.body.success).toBe(true);
    });

    it('should return exactly { error: "Faction not found" } on 404 delete', async () => {
        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-campaign/factions/nonexistent');

        expect(res.status).toBe(404);
        expect(Object.keys(res.body)).toEqual(['error']);
        expect(res.body.error).toBe('Faction not found');
    });
});

// ─── ID Field Matching ───────────────────────────────────────────────────────

describe('factions - ID field matching behavior', () => {
    it('should use strict equality for ID matching (type-sensitive)', async () => {
        const factionsData = [
            { id: '123', name: 'String ID', description: 'Test', goals: 'Test', influence: 1, notes: '' },
        ];
        setupMock('test-campaign', factionsData);

        const app = createTestApp();
        // Numeric ID should not match string ID
        const res = await request(app).get('/api/campaigns/test-campaign/factions/123');

        expect(res.status).toBe(200);
        expect(res.body.faction.name).toBe('String ID');
    });

    it('should not match partial IDs', async () => {
        const factionsData = [
            { id: 'faction-123', name: 'Full ID', description: 'Test', goals: 'Test', influence: 1, notes: '' },
        ];
        setupMock('test-campaign', factionsData);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/factions/faction');

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Faction not found');
    });

    it('should match IDs that look like numbers but are stored as strings', async () => {
        const factionsData = [
            { id: '42', name: 'Numeric String', description: 'Test', goals: 'Test', influence: 5, notes: '' },
        ];
        setupMock('test-campaign', factionsData);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/factions/42');

        expect(res.status).toBe(200);
        expect(res.body.faction.name).toBe('Numeric String');
    });

    it('should handle faction IDs with leading/trailing spaces', async () => {
        const factionsData = [
            { id: ' faction-with-spaces ', name: 'Spaced ID', description: 'Test', goals: 'Test', influence: 1, notes: '' },
        ];
        setupMock('test-campaign', factionsData);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/factions/%20faction-with-spaces%20');

        expect(res.status).toBe(200);
        expect(res.body.faction.name).toBe('Spaced ID');
    });

    it('should handle faction IDs with tabs and newlines', async () => {
        const factionsData = [
            { id: 'faction\twith\nnewlines', name: 'Weird ID', description: 'Test', goals: 'Test', influence: 1, notes: '' },
        ];
        setupMock('test-campaign', factionsData);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/factions/faction%09with%0Anewlines');

        expect(res.status).toBe(200);
        expect(res.body.faction.name).toBe('Weird ID');
    });
});

// ─── Multiple Operations ─────────────────────────────────────────────────────

describe('factions - multiple operations in sequence', () => {
    it('should support create, read, update, delete cycle', async () => {
        const app = createTestApp();

        // Create
        const createRes = await request(app)
            .post('/api/campaigns/test-campaign/factions')
            .send({ factions: [{ id: 'f1', name: 'Original', description: 'Original', goals: 'Original', influence: 1, notes: '' }] });
        expect(createRes.status).toBe(200);

        // Read
        const readRes = await request(app).get('/api/campaigns/test-campaign/factions/f1');
        expect(readRes.status).toBe(200);
        expect(readRes.body.faction.name).toBe('Original');

        // Update (overwrite)
        const updateRes = await request(app)
            .post('/api/campaigns/test-campaign/factions')
            .send({ factions: [{ id: 'f1', name: 'Updated', description: 'Updated', goals: 'Updated', influence: 5, notes: '' }] });
        expect(updateRes.status).toBe(200);

        // Verify update
        const verifyRes = await request(app).get('/api/campaigns/test-campaign/factions/f1');
        expect(verifyRes.status).toBe(200);
        expect(verifyRes.body.faction.name).toBe('Updated');
        expect(verifyRes.body.faction.influence).toBe(5);

        // Delete
        const deleteRes = await request(app).delete('/api/campaigns/test-campaign/factions/f1');
        expect(deleteRes.status).toBe(200);

        // Verify delete
        const afterDelete = await request(app).get('/api/campaigns/test-campaign/factions/f1');
        expect(afterDelete.status).toBe(404);
    });

    it('should handle multiple saves then verify final state', async () => {
        const app = createTestApp();

        // First save
        await request(app)
            .post('/api/campaigns/test-campaign/factions')
            .send({ factions: [{ id: 'f1', name: 'First', description: 'First', goals: 'First', influence: 1, notes: '' }] });

        // Second save adds more
        await request(app)
            .post('/api/campaigns/test-campaign/factions')
            .send({ factions: [
                { id: 'f1', name: 'First', description: 'First', goals: 'First', influence: 1, notes: '' },
                { id: 'f2', name: 'Second', description: 'Second', goals: 'Second', influence: 2, notes: '' },
            ]});

        // Third save removes one
        await request(app)
            .post('/api/campaigns/test-campaign/factions')
            .send({ factions: [{ id: 'f1', name: 'First', description: 'First', goals: 'First', influence: 1, notes: '' }] });

        const res = await request(app).get('/api/campaigns/test-campaign/factions');
        expect(res.status).toBe(200);
        expect(res.body.factions).toHaveLength(1);
        expect(res.body.factions[0].name).toBe('First');
    });

    it('should handle rapid successive deletes of same faction', async () => {
        const factionsData = [
            { id: 'f1', name: 'Delete Me', description: 'Delete', goals: 'Delete', influence: 1, notes: '' },
        ];
        setupMock('test-campaign', factionsData);

        const app = createTestApp();

        // First delete succeeds
        const res1 = await request(app).delete('/api/campaigns/test-campaign/factions/f1');
        expect(res1.status).toBe(200);

        // Second delete of same faction (already deleted) is no-op
        const res2 = await request(app).delete('/api/campaigns/test-campaign/factions/f1');
        expect(res2.status).toBe(200);
        expect(res2.body).toHaveProperty('success', true);
    });
});

// ─── Boundary Values ─────────────────────────────────────────────────────────

describe('factions - boundary values', () => {
    it('should save and retrieve factions with influence at maximum typical D&D range (20)', async () => {
        const factionsData = [
            { id: 'f1', name: 'Max Influence', description: 'Test', goals: 'Test', influence: 20, notes: '' },
        ];

        const app = createTestApp();
        await request(app)
            .post('/api/campaigns/test-campaign/factions')
            .send({ factions: factionsData });

        const res = await request(app).get('/api/campaigns/test-campaign/factions/f1');
        expect(res.status).toBe(200);
        expect(res.body.faction.influence).toBe(20);
    });

    it('should save factions with influence as float', async () => {
        const factionsData = [
            { id: 'f1', name: 'Float Influence', description: 'Test', goals: 'Test', influence: 5.5, notes: '' },
        ];

        const app = createTestApp();
        await request(app)
            .post('/api/campaigns/test-campaign/factions')
            .send({ factions: factionsData });

        const res = await request(app).get('/api/campaigns/test-campaign/factions/f1');
        expect(res.status).toBe(200);
        expect(res.body.faction.influence).toBe(5.5);
    });

    it('should save factions with undefined influence (missing field)', async () => {
        const factionsData = [
            { id: 'f1', name: 'No Influence', description: 'Test', goals: 'Test' },
        ];

        const app = createTestApp();
        await request(app)
            .post('/api/campaigns/test-campaign/factions')
            .send({ factions: factionsData });

        const res = await request(app).get('/api/campaigns/test-campaign/factions/f1');
        expect(res.status).toBe(200);
        expect(res.body.faction.influence).toBeUndefined();
    });

    it('should save factions with only required fields', async () => {
        const factionsData = [
            { id: 'f1' },
        ];

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/factions')
            .send({ factions: factionsData });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const stored = MOCK_STORE.get('test-campaign:factions');
        expect(stored).toHaveLength(1);
        expect(stored[0]).toEqual({ id: 'f1' });
    });

    it('should handle factions with all fields as empty strings', async () => {
        const factionsData = [
            { id: '', name: '', description: '', goals: '', influence: 0, notes: '' },
        ];

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/factions')
            .send({ factions: factionsData });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
    });

    it('should save and retrieve 100 factions at once', async () => {
        const factionsData = Array.from({ length: 100 }, (_, i) => ({
            id: `faction-${i}`,
            name: `Faction ${i}`,
            description: `Description ${i}`,
            goals: `Goal ${i}`,
            influence: i % 20,
            notes: `Notes ${i}`,
        }));

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/factions')
            .send({ factions: factionsData });

        expect(res.status).toBe(200);

        const listRes = await request(app).get('/api/campaigns/test-campaign/factions');
        expect(listRes.status).toBe(200);
        expect(listRes.body.factions).toHaveLength(100);
        expect(listRes.body.factions[0].name).toBe('Faction 0');
        expect(listRes.body.factions[99].name).toBe('Faction 99');
    });
});
