import { Router } from 'express';
import express from 'express';
import request from 'supertest';

// Shared mock store keyed by "campaign:settlements"
const MOCK_STORE = new Map();

function setupMock(campaign, data) {
    const key = `${campaign}:settlements`;
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

    // GET list
    router.get('/api/campaigns/:campaign/settlements', (req, res) => {
        const campaign = req.params.campaign;
        const key = `${campaign}:settlements`;
        const data = MOCK_STORE.get(key);
        const entities = Array.isArray(data) ? data : [];
        res.json({ settlements: entities });
    });

    // POST save (overwrite entire array)
    router.post('/api/campaigns/:campaign/settlements', (req, res) => {
        const campaign = req.params.campaign;
        const entities = req.body.settlements;
        setupMock(campaign, entities);
        res.json({ success: true });
    });

    // GET by id (name field)
    router.get('/api/campaigns/:campaign/settlements/:id', (req, res) => {
        const campaign = req.params.campaign;
        const id = decodeURIComponent(req.params.id);
        const key = `${campaign}:settlements`;
        const data = MOCK_STORE.get(key);

        if (!MOCK_STORE.has(key)) {
            return res.status(404).json({ error: 'settlement not found' });
        }

        const entities = Array.isArray(data) ? data : [];
        const entity = entities.find(e => e.name === id);

        if (!entity) {
            return res.status(404).json({ error: 'settlement not found' });
        }

        res.json({ settlement: entity });
    });

    // DELETE by id
    router.delete('/api/campaigns/:campaign/settlements/:id', (req, res) => {
        const campaign = req.params.campaign;
        const id = decodeURIComponent(req.params.id);
        const key = `${campaign}:settlements`;

        if (!MOCK_STORE.has(key)) {
            return res.status(404).json({ error: 'settlement not found' });
        }

        const data = MOCK_STORE.get(key);
        const entities = Array.isArray(data) ? data : [];
        const filtered = entities.filter(e => e.name !== id);

        setupMock(campaign, filtered);
        res.json({ success: true });
    });

    // PUT upsert by name
    router.put('/api/campaigns/:campaign/settlements/:settlementName', (req, res) => {
        const campaign = req.params.campaign;
        const name = decodeURIComponent(req.params.settlementName);
        const updated = req.body;
        const key = `${campaign}:settlements`;

        let settlements = [];
        if (MOCK_STORE.has(key)) {
            settlements = MOCK_STORE.get(key);
        }
        if (!Array.isArray(settlements)) settlements = [];

        const existingIndex = settlements.findIndex(s => s.name === name);
        if (existingIndex !== -1) {
            settlements[existingIndex] = updated;
        } else {
            settlements.push(updated);
        }

        setupMock(campaign, settlements);
        res.json({ success: true, settlement: updated });
    });

    return router;
}

// Mock jsonEntityCrud
vi.mock('../utils/jsonEntityCrud.js', () => ({
    createJsonEntityRouter: () => createMockRouter(),
}));

vi.mock('fs', () => ({
    default: {
        existsSync: vi.fn(() => true),
        readFileSync: vi.fn(() => '[]'),
        writeFileSync: vi.fn(),
    },
    existsSync: vi.fn(() => true),
    readFileSync: vi.fn(() => '[]'),
    writeFileSync: vi.fn(),
}));

vi.mock('../utils/campaignPaths.js', () => ({
    campaignDataFile: vi.fn((campaign, name) => `/mock/campaigns/${campaign}/data/${name}`),
    ensureDataDir: vi.fn((campaign) => `/mock/campaigns/${campaign}/data`),
}));

import settlements from './settlements.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(settlements);
    return app;
}

afterEach(() => {
    clearMockStore();
    vi.restoreAllMocks();
});

// ─── GET /api/campaigns/:campaign/settlements ────────────────────────────────

describe('settlements - GET /api/campaigns/:campaign/settlements', () => {
    it('should return empty settlements list when no settlements.json exists', async () => {
        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/settlements');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('settlements');
        expect(Array.isArray(res.body.settlements)).toBe(true);
        expect(res.body.settlements).toEqual([]);
    });

    it('should return all settlements when file exists', async () => {
        const settlementsData = [
            { name: 'Riverwood', type: 'village', population: 100, description: 'A small village' },
            { name: 'Whiterun', type: 'city', population: 5000, description: 'A large city' },
        ];
        setupMock('test-campaign', settlementsData);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/settlements');

        expect(res.status).toBe(200);
        expect(res.body.settlements).toHaveLength(2);
        expect(res.body.settlements[0].name).toBe('Riverwood');
        expect(res.body.settlements[1].name).toBe('Whiterun');
    });

    it('should handle non-array and null data gracefully, returning empty array', async () => {
        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/settlements');

        expect(res.status).toBe(200);
        expect(res.body.settlements).toEqual([]);
    });
});

// ─── POST /api/campaigns/:campaign/settlements ───────────────────────────────

describe('settlements - POST /api/campaigns/:campaign/settlements', () => {
    it('should save settlements and return success', async () => {
        const settlementsData = [
            { name: 'Riverwood', type: 'village', population: 100, description: 'A small village' },
        ];

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/settlements')
            .send({ settlements: settlementsData });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
    });

    it('should save an empty array of settlements', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/settlements')
            .send({ settlements: [] });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
    });

    it('should overwrite existing settlements with the new array', async () => {
        const existingData = [
            { name: 'Old Town', type: 'town', population: 50, description: 'Old' },
        ];
        setupMock('test-campaign', existingData);

        const newSettlementsData = [{ name: 'New Town', type: 'town', population: 75, description: 'New' }];

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/settlements')
            .send({ settlements: newSettlementsData });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
    });

    it('should handle settlements with complex nested data', async () => {
        const settlementsData = [
            {
                name: 'Whiterun',
                type: 'city',
                population: 5000,
                description: 'A large city',
                leaders: [{ name: 'Jarl Balgruuf', role: 'ruler' }],
                districts: ['The Cloud District', 'The Downpour'],
            },
        ];

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/settlements')
            .send({ settlements: settlementsData });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
    });

    it('should handle settlements with missing optional fields', async () => {
        const settlementsData = [
            { name: 'Minimal Settlement' },
            { name: 'Partial Settlement', type: 'village' },
        ];

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/settlements')
            .send({ settlements: settlementsData });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
    });
});

// ─── GET /api/campaigns/:campaign/settlements/:settlementName ────────────────

describe('settlements - GET /api/campaigns/:campaign/settlements/:settlementName', () => {
    it('should return 404 when settlements.json does not exist', async () => {
        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/settlements/riverwood');

        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('settlement not found');
    });

    it('should return 404 when settlement with given name does not exist', async () => {
        const settlementsData = [
            { name: 'Riverwood', type: 'village', population: 100, description: 'A small village' },
        ];
        setupMock('test-campaign', settlementsData);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/settlements/nonexistent');

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('settlement not found');
    });

    it('should return the settlement when found', async () => {
        const settlementData = {
            name: 'Whiterun',
            type: 'city',
            population: 5000,
            description: 'A large city',
        };
        setupMock('test-campaign', [settlementData]);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/settlements/Whiterun');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('settlement');
        expect(res.body.settlement).toEqual(settlementData);
    });

    it('should return settlement from middle of array', async () => {
        const settlementsData = [
            { name: 'Riverwood', type: 'village', population: 100, description: 'First' },
            { name: 'Whiterun', type: 'city', population: 5000, description: 'Middle' },
            { name: 'Solitude', type: 'city', population: 3000, description: 'Last' },
        ];
        setupMock('test-campaign', settlementsData);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/settlements/Whiterun');

        expect(res.status).toBe(200);
        expect(res.body.settlement.name).toBe('Whiterun');
        expect(res.body.settlement.population).toBe(5000);
    });

    it('should return 404 when settlement name contains URL-encoded characters and does not match', async () => {
        const settlementsData = [
            { name: 'Riverwood', type: 'village', population: 100, description: 'A small village' },
        ];
        setupMock('test-campaign', settlementsData);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/settlements/%20nonexistent%20');

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('settlement not found');
    });

    it('should use strict equality for name matching (case-sensitive)', async () => {
        const settlementsData = [
            { name: 'Whiterun', type: 'city', population: 5000, description: 'A large city' },
        ];
        setupMock('test-campaign', settlementsData);

        const app = createTestApp();
        const res = await request(app)
            .get('/api/campaigns/test-campaign/settlements/whiterun');

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('settlement not found');
    });
});

// ─── DELETE /api/campaigns/:campaign/settlements/:settlementName ─────────────

describe('settlements - DELETE /api/campaigns/:campaign/settlements/:settlementName', () => {
    it('should return 404 when settlements.json does not exist', async () => {
        const app = createTestApp();
        const res = await request(app)
            .delete('/api/campaigns/test-campaign/settlements/riverwood');

        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('settlement not found');
    });

    it('should return 200 and succeed when settlement does not exist (no-op delete)', async () => {
        const settlementsData = [
            { name: 'Riverwood', type: 'village', population: 100, description: 'Keep Me' },
        ];
        setupMock('test-campaign', settlementsData);

        const app = createTestApp();
        const res = await request(app)
            .delete('/api/campaigns/test-campaign/settlements/nonexistent');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
    });

    it('should delete a settlement and return success', async () => {
        const settlementsData = [
            { name: 'Riverwood', type: 'village', population: 100, description: 'Keep Me' },
            { name: 'Whiterun', type: 'city', population: 5000, description: 'Delete Me' },
        ];
        setupMock('test-campaign', settlementsData);

        const app = createTestApp();
        const res = await request(app)
            .delete('/api/campaigns/test-campaign/settlements/Whiterun');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
    });

    it('should remove only the specified settlement when multiple exist', async () => {
        const settlementsData = [
            { name: 'Riverwood', type: 'village', population: 100, description: 'First' },
            { name: 'Whiterun', type: 'city', population: 5000, description: 'Second' },
            { name: 'Solitude', type: 'city', population: 3000, description: 'Third' },
        ];
        setupMock('test-campaign', settlementsData);

        const app = createTestApp();
        const res = await request(app)
            .delete('/api/campaigns/test-campaign/settlements/Whiterun');

        expect(res.status).toBe(200);
    });

    it('should handle deleting the only settlement', async () => {
        const settlementsData = [
            { name: 'Riverwood', type: 'village', population: 100, description: 'Only Settlement' },
        ];
        setupMock('test-campaign', settlementsData);

        const app = createTestApp();
        const res = await request(app)
            .delete('/api/campaigns/test-campaign/settlements/Riverwood');

        expect(res.status).toBe(200);
    });

    it('should handle deleting from an empty settlements list (no-op delete)', async () => {
        setupMock('test-campaign', []);

        const app = createTestApp();
        const res = await request(app)
            .delete('/api/campaigns/test-campaign/settlements/riverwood');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
    });

    it('should delete settlement with complex nested data and leave other settlements intact', async () => {
        const settlementsData = [
            {
                name: 'Whiterun',
                type: 'city',
                population: 5000,
                description: 'A large city',
                leaders: [{ name: 'Jarl Balgruuf', role: 'ruler' }],
                districts: ['The Cloud District', 'The Downpour'],
            },
            {
                name: 'Riverwood',
                type: 'village',
                population: 100,
                description: 'A small village',
            },
        ];
        setupMock('test-campaign', settlementsData);

        const app = createTestApp();
        const res = await request(app)
            .delete('/api/campaigns/test-campaign/settlements/Whiterun');

        expect(res.status).toBe(200);

        const stored = MOCK_STORE.get('test-campaign:settlements');
        expect(stored).toHaveLength(1);
        expect(stored[0].name).toBe('Riverwood');
    });

    it('should use strict equality for name matching (case-sensitive delete)', async () => {
        const settlementsData = [
            { name: 'Whiterun', type: 'city', population: 5000, description: 'A large city' },
        ];
        setupMock('test-campaign', settlementsData);

        const app = createTestApp();
        const res = await request(app)
            .delete('/api/campaigns/test-campaign/settlements/whiterun');

        expect(res.status).toBe(200);

        const stored = MOCK_STORE.get('test-campaign:settlements');
        expect(stored).toHaveLength(1);
        expect(stored[0].name).toBe('Whiterun');
    });
});

// ─── PUT /api/campaigns/:campaign/settlements/:settlementName ────────────────

describe('settlements - PUT /api/campaigns/:campaign/settlements/:settlementName', () => {
    it('should create a new settlement when it does not exist', async () => {
        const settlementData = {
            name: 'Riverwood',
            type: 'village',
            population: 100,
            description: 'A small village',
        };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/settlements/Riverwood')
            .send(settlementData);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
        expect(res.body.settlement).toEqual(settlementData);
    });

    it('should update an existing settlement when it does exist', async () => {
        const existingData = [
            { name: 'Riverwood', type: 'village', population: 100, description: 'A small village' },
        ];
        setupMock('test-campaign', existingData);

        const updatedData = {
            name: 'Riverwood',
            type: 'town',
            population: 250,
            description: 'A growing town',
        };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/settlements/Riverwood')
            .send(updatedData);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
        expect(res.body.settlement).toEqual(updatedData);
    });

    it('should return success with updated settlement data', async () => {
        const settlementData = {
            name: 'Whiterun',
            type: 'city',
            population: 5000,
            description: 'A large city',
        };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/settlements/Whiterun')
            .send(settlementData);

        expect(res.status).toBe(200);
        expect(res.body.settlement.name).toBe('Whiterun');
        expect(res.body.settlement.type).toBe('city');
    });

    it('should handle settlements with complex nested data', async () => {
        const settlementData = {
            name: 'Whiterun',
            type: 'city',
            population: 5000,
            description: 'A large city',
            leaders: [{ name: 'Jarl Balgruuf', role: 'ruler' }],
            districts: ['The Cloud District', 'The Downpour'],
        };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/settlements/Whiterun')
            .send(settlementData);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
    });

    it('should fully replace existing settlement (not merge)', async () => {
        const existingData = [
            { name: 'Riverwood', type: 'village', population: 100, description: 'A small village', extraField: 'should-be-removed' },
        ];
        setupMock('test-campaign', existingData);

        const updatedData = {
            name: 'Riverwood',
            type: 'town',
            population: 250,
            description: 'A growing town',
        };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/settlements/Riverwood')
            .send(updatedData);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const stored = MOCK_STORE.get('test-campaign:settlements');
        expect(stored).toHaveLength(1);
        expect(stored[0]).toEqual(updatedData);
        expect(stored[0]).not.toHaveProperty('extraField');
    });

    it('should handle settlement name with URL-encoded characters in PUT', async () => {
        const settlementData = {
            name: 'New Settlement',
            type: 'town',
            population: 200,
            description: 'A new place',
        };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/settlements/New%20Settlement')
            .send(settlementData);

        expect(res.status).toBe(200);
        expect(res.body.settlement).toEqual(settlementData);
    });
});
