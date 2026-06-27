import request from 'supertest';
import express from 'express';
import factions from './factions.js';

// Use globalThis to work around vi.mock hoisting
// Note: _factionStore is initialized lazily by vi.mock factory

function setupFactions(campaign, data) {
    if (!globalThis._factionStore) globalThis._factionStore = new Map();
    if (data === null) {
        globalThis._factionStore.delete(campaign);
    } else {
        globalThis._factionStore.set(campaign, data || []);
    }
}

function clearFactionStore() {
    if (globalThis._factionStore) globalThis._factionStore.clear();
}

// Mock jsonEntityCrud
vi.mock('../utils/jsonEntityCrud.js', () => {
    const { Router } = require('express');
    const createRouter = vi.fn((entityName, options) => {
        const router = Router();
        const { itemWrapper, onDelete } = options;
        const singularize = (name) => {
            if (name === 'npcs') return 'npc';
            if (name.endsWith('ies')) return name.slice(0, -3) + 'y';
            if (name.endsWith('s')) return name.slice(0, -1);
            return name;
        };

        // GET list
        router.get(`/api/campaigns/:campaign/${entityName}`, (_req, res) => {
            if (!globalThis._factionStore) globalThis._factionStore = new Map();
            const campaign = _req.params.campaign;
            const data = globalThis._factionStore.get(campaign) || [];
            res.json({ [entityName]: data });
        });

        // POST - replaces entire array
        router.post(`/api/campaigns/:campaign/${entityName}`, (req, res) => {
            if (!globalThis._factionStore) globalThis._factionStore = new Map();
            const campaign = req.params.campaign;
            const entities = req.body[entityName];
            globalThis._factionStore.set(campaign, entities || []);
            res.json({ success: true });
        });

        // GET by id
        router.get(`/api/campaigns/:campaign/${entityName}/:name`, (req, res) => {
            if (!globalThis._factionStore) globalThis._factionStore = new Map();
            const campaign = req.params.campaign;
            const name = req.params.name;
            const data = globalThis._factionStore.get(campaign) || [];
            const item = data.find(f => f.name === name);
            if (!item) {
                return res.status(404).json({ error: 'Faction not found' });
            }
            const wrapper = itemWrapper || singularize(entityName);
            res.json({ [wrapper]: item });
        });

        // PUT
        router.put(`/api/campaigns/:campaign/${entityName}/:name`, (req, res) => {
            if (!globalThis._factionStore) globalThis._factionStore = new Map();
            const campaign = req.params.campaign;
            const name = req.params.name;
            const data = globalThis._factionStore.get(campaign) || [];
            const idx = data.findIndex(f => f.name === name);
            if (idx === -1) {
                return res.status(404).json({ error: 'Faction not found' });
            }
            Object.assign(data[idx], req.body);
            res.json({ success: true, faction: data[idx] });
        });

        // DELETE
        router.delete(`/api/campaigns/:campaign/${entityName}/:name`, (req, res) => {
            if (!globalThis._factionStore) globalThis._factionStore = new Map();
            const campaign = req.params.campaign;
            const name = req.params.name;
            const data = globalThis._factionStore.get(campaign) || [];
            const idx = data.findIndex(f => f.name === name);
            if (idx === -1) {
                return res.status(404).json({ error: 'Faction not found' });
            }
            if (onDelete) onDelete(data[idx]);
            data.splice(idx, 1);
            globalThis._factionStore.set(campaign, data);
            res.json({ success: true });
        });

        return router;
    });
    return { createJsonEntityRouter: createRouter };
});

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(factions);
    return app;
}

afterEach(() => {
    clearFactionStore();
    vi.restoreAllMocks();
});

// ─── GET /api/campaigns/:campaign/factions ───────────────────────────────────

describe('factions - GET /api/campaigns/:campaign/factions', () => {
    it('should return an empty factions list when no factions exist', async () => {
        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-faction-campaign/factions');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('factions');
        expect(Array.isArray(res.body.factions)).toBe(true);
        expect(res.body.factions).toEqual([]);
    });

    it('should return a list of factions with name, alignment, and leaderName', async () => {
        setupFactions('test-faction-campaign', [
            { name: 'Thieves Guild', alignment: 'Chaotic Evil', leaderName: 'Vex' },
            { name: 'City Watch', alignment: 'Lawful Good', leaderName: 'Captain Iron' },
        ]);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-faction-campaign/factions');

        expect(res.status).toBe(200);
        expect(res.body.factions).toHaveLength(2);
        expect(res.body.factions[0]).toEqual({ name: 'Thieves Guild', alignment: 'Chaotic Evil', leaderName: 'Vex' });
        expect(res.body.factions[1]).toEqual({ name: 'City Watch', alignment: 'Lawful Good', leaderName: 'Captain Iron' });
    });
});

// ─── POST /api/campaigns/:campaign/factions ──────────────────────────────────

describe('factions - POST /api/campaigns/:campaign/factions', () => {
    it('should replace the entire factions array', async () => {
        setupFactions('test-faction-campaign', [
            { name: 'Old Faction', alignment: 'Neutral', leaderName: 'Old Leader' },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-faction-campaign/factions')
            .send({
                factions: [
                    { name: 'New Faction 1', alignment: 'Good' },
                    { name: 'New Faction 2', alignment: 'Evil' },
                ],
            });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const stored = globalThis._factionStore.get('test-faction-campaign');
        expect(stored).toHaveLength(2);
        expect(stored[0].name).toBe('New Faction 1');
        expect(stored[1].name).toBe('New Faction 2');
    });

    it('should handle empty factions array', async () => {
        setupFactions('test-faction-campaign', [
            { name: 'Old Faction', alignment: 'Neutral', leaderName: 'Old Leader' },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-faction-campaign/factions')
            .send({ factions: [] });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const stored = globalThis._factionStore.get('test-faction-campaign');
        expect(stored).toEqual([]);
    });
});

// ─── GET /api/campaigns/:campaign/factions/:factionname ──────────────────────

describe('factions - GET /api/campaigns/:campaign/factions/:factionname', () => {
    it('should return 404 when faction does not exist', async () => {
        setupFactions('test-faction-campaign', []);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-faction-campaign/factions/Nonexistent');

        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error', 'Faction not found');
    });

    it('should return full faction data when found', async () => {
        const factionData = {
            name: 'Knightly Order',
            alignment: 'Lawful Good',
            leaderName: 'Sir Aldric',
            goals: ['Protect the realm'],
            reputation: 80,
            members: 15,
        };
        setupFactions('test-faction-campaign', [factionData]);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-faction-campaign/factions/Knightly Order');

        expect(res.status).toBe(200);
        expect(res.body.faction).toEqual(factionData);
    });

    it('should return 404 when faction store is empty', async () => {
        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-faction-campaign/factions/Any');

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Faction not found');
    });
});

// ─── PUT /api/campaigns/:campaign/factions/:factionname ──────────────────────

describe('factions - PUT /api/campaigns/:campaign/factions/:factionname', () => {
    it('should return 404 when faction does not exist', async () => {
        setupFactions('test-faction-campaign', []);

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-faction-campaign/factions/Nonexistent')
            .send({ alignment: 'Chaotic Evil' });

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Faction not found');
    });

    it('should update an existing faction', async () => {
        setupFactions('test-faction-campaign', [
            { name: 'Old Faction', alignment: 'Neutral', leaderName: 'Old Leader' },
        ]);

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-faction-campaign/factions/Old Faction')
            .send({ alignment: 'Chaotic Evil', leaderName: 'New Leader' });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const stored = globalThis._factionStore.get('test-faction-campaign');
        expect(stored[0].alignment).toBe('Chaotic Evil');
        expect(stored[0].leaderName).toBe('New Leader');
        expect(stored[0].name).toBe('Old Faction');
    });
});

// ─── DELETE /api/campaigns/:campaign/factions/:factionname ───────────────────

describe('factions - DELETE /api/campaigns/:campaign/factions/:factionname', () => {
    it('should return 404 when faction does not exist', async () => {
        setupFactions('test-faction-campaign', []);

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-faction-campaign/factions/Nonexistent');

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Faction not found');
    });

    it('should delete a faction and return success', async () => {
        setupFactions('test-faction-campaign', [
            { name: 'Delete Me', alignment: 'Neutral', leaderName: 'Leader' },
            { name: 'Keep Me', alignment: 'Good', leaderName: 'Good Leader' },
        ]);

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-faction-campaign/factions/Delete Me');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const stored = globalThis._factionStore.get('test-faction-campaign');
        expect(stored).toHaveLength(1);
        expect(stored[0].name).toBe('Keep Me');
    });
});
