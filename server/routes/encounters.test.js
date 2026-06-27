import request from 'supertest';
import express from 'express';
import encounters from './encounters.js';

// Use globalThis to work around vi.mock hoisting
// Note: _encounterStore is initialized lazily by vi.mock factory

function setupEncounters(campaign, data) {
    if (!globalThis._encounterStore) {
        globalThis._encounterStore = new Map();
    }
    if (data === null) {
        globalThis._encounterStore.delete(campaign);
    } else {
        globalThis._encounterStore.set(campaign, data || { encounters: [] });
    }
}

function clearEncounterStore() {
    if (globalThis._encounterStore) globalThis._encounterStore.clear();
}

// Mock encounterUtils
vi.mock('../utils/encounterUtils.js', () => ({
    readEncounters: vi.fn((campaign) => {
        if (!globalThis._encounterStore) globalThis._encounterStore = new Map();
        const data = globalThis._encounterStore.get(campaign);
        return data || { encounters: [] };
    }),
    writeEncounters: vi.fn((campaign, data) => {
        if (!globalThis._encounterStore) globalThis._encounterStore = new Map();
        globalThis._encounterStore.set(campaign, data);
    }),
}));

// Mock changeData
vi.mock('../utils/changeData.js', () => ({
    publish: vi.fn(),
}));

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(encounters);
    return app;
}

afterEach(() => {
    clearEncounterStore();
    vi.resetAllMocks();
    vi.restoreAllMocks();
});

// ─── GET /api/campaigns/:campaign/encounters ──────────────────────────────────

describe('encounters - GET /api/campaigns/:campaign/encounters', () => {
    it('should return an empty encounters list when no encounters exist', async () => {
        const { readEncounters } = await import('../utils/encounterUtils.js');
        readEncounters.mockReturnValue({ encounters: [] });

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-enc-campaign/encounters');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('encounters');
        expect(Array.isArray(res.body.encounters)).toBe(true);
        expect(res.body.encounters).toEqual([]);
    });

    it('should return a list of encounters with name, savedAt, and effectiveXP', async () => {
        setupEncounters('test-enc-campaign', {
            encounters: [
                { name: 'Goblin Ambush', savedAt: '2025-01-01T00:00:00.000Z', effectiveXP: 200, selectedMonsters: [] },
                { name: 'Dragon Fight', savedAt: '2025-01-02T00:00:00.000Z', effectiveXP: 4000, selectedMonsters: [] },
            ],
        });

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-enc-campaign/encounters');

        expect(res.status).toBe(200);
        expect(res.body.encounters).toHaveLength(2);
        expect(res.body.encounters[0]).toEqual({ name: 'Goblin Ambush', savedAt: '2025-01-01T00:00:00.000Z', effectiveXP: 200 });
        expect(res.body.encounters[1]).toEqual({ name: 'Dragon Fight', savedAt: '2025-01-02T00:00:00.000Z', effectiveXP: 4000 });
    });

    it('should return only name, savedAt, and effectiveXP, not full encounter data', async () => {
        setupEncounters('test-enc-campaign', {
            encounters: [
                {
                    name: 'Full Encounter',
                    savedAt: '2025-01-01T00:00:00.000Z',
                    effectiveXP: 100,
                    selectedMonsters: [{ index: 'goblin', name: 'Goblin', qty: 3 }],
                    initiativeBonus: 2,
                },
            ],
        });

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-enc-campaign/encounters');

        expect(res.status).toBe(200);
        expect(res.body.encounters[0]).toHaveProperty('name', 'Full Encounter');
        expect(res.body.encounters[0]).toHaveProperty('savedAt', '2025-01-01T00:00:00.000Z');
        expect(res.body.encounters[0]).toHaveProperty('effectiveXP', 100);
        expect(res.body.encounters[0]).not.toHaveProperty('selectedMonsters');
        expect(res.body.encounters[0]).not.toHaveProperty('initiativeBonus');
    });
});

// ─── POST /api/campaigns/:campaign/encounters ─────────────────────────────────

describe('encounters - POST /api/campaigns/:campaign/encounters', () => {
    it('should return 400 when name is missing', async () => {
        setupEncounters('test-enc-campaign', { encounters: [] });

        const app = createTestApp();
        const res = await request(app).post('/api/campaigns/test-enc-campaign/encounters').send({});

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('Encounter name is required');
    });

    it('should return 400 when name is empty string', async () => {
        setupEncounters('test-enc-campaign', { encounters: [] });

        const app = createTestApp();
        const res = await request(app).post('/api/campaigns/test-enc-campaign/encounters').send({ name: '' });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Encounter name is required');
    });

    it('should return 400 when name is whitespace only', async () => {
        setupEncounters('test-enc-campaign', { encounters: [] });

        const app = createTestApp();
        const res = await request(app).post('/api/campaigns/test-enc-campaign/encounters').send({ name: '   ' });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Encounter name is required');
    });

    it('should return 400 when an encounter with the same name already exists', async () => {
        setupEncounters('test-enc-campaign', {
            encounters: [
                { name: 'Goblin Ambush', savedAt: '2025-01-01T00:00:00.000Z', effectiveXP: 200 },
            ],
        });

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-enc-campaign/encounters')
            .send({ name: 'Goblin Ambush', data: {} });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('An encounter with this name already exists');
    });

    it('should create a new encounter with trimmed name and current timestamp', async () => {
        setupEncounters('test-enc-campaign', { encounters: [] });

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-enc-campaign/encounters')
            .send({ name: '  New Encounter  ', data: { selectedMonsters: [] } });

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('message', 'Encounter saved successfully');
        expect(res.body).toHaveProperty('encounter', { name: 'New Encounter' });

        const stored = globalThis._encounterStore.get('test-enc-campaign');
        expect(stored.encounters).toHaveLength(1);
        expect(stored.encounters[0].name).toBe('New Encounter');
        expect(stored.encounters[0]).toHaveProperty('savedAt');
        expect(stored.encounters[0].selectedMonsters).toEqual([]);
    });

    it('should preserve selectedMonsters with index, name, and qty fields', async () => {
        setupEncounters('test-enc-campaign', { encounters: [] });

        const monsters = [
            { index: 'goblin', name: 'Goblin', qty: 3, extraField: 'should-be-stripped' },
            { index: 'kobold', name: 'Kobold', qty: 5 },
        ];

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-enc-campaign/encounters')
            .send({ name: 'Monster Wave', data: { selectedMonsters: monsters } });

        expect(res.status).toBe(201);

        const stored = globalThis._encounterStore.get('test-enc-campaign');
        expect(stored.encounters[0].selectedMonsters).toEqual([
            { index: 'goblin', name: 'Goblin', qty: 3 },
            { index: 'kobold', name: 'Kobold', qty: 5 },
        ]);
    });

    it('should handle encounter creation with no data field', async () => {
        setupEncounters('test-enc-campaign', { encounters: [] });

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-enc-campaign/encounters')
            .send({ name: 'Standalone Encounter' });

        expect(res.status).toBe(201);

        const stored = globalThis._encounterStore.get('test-enc-campaign');
        expect(stored.encounters).toHaveLength(1);
        expect(stored.encounters[0].name).toBe('Standalone Encounter');
    });

    it('should handle encounter creation with null encounterData', async () => {
        setupEncounters('test-enc-campaign', { encounters: [] });

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-enc-campaign/encounters')
            .send({ name: 'Null Data Encounter', data: null });

        expect(res.status).toBe(201);

        const stored = globalThis._encounterStore.get('test-enc-campaign');
        expect(stored.encounters).toHaveLength(1);
        expect(stored.encounters[0].name).toBe('Null Data Encounter');
    });

    it('should create multiple encounters successfully', async () => {
        setupEncounters('test-enc-campaign', { encounters: [] });

        const app = createTestApp();
        await request(app)
            .post('/api/campaigns/test-enc-campaign/encounters')
            .send({ name: 'Encounter One', data: {} });
        await request(app)
            .post('/api/campaigns/test-enc-campaign/encounters')
            .send({ name: 'Encounter Two', data: {} });
        await request(app)
            .post('/api/campaigns/test-enc-campaign/encounters')
            .send({ name: 'Encounter Three', data: {} });

        const stored = globalThis._encounterStore.get('test-enc-campaign');
        expect(stored.encounters).toHaveLength(3);
        expect(stored.encounters.map(e => e.name)).toEqual(['Encounter One', 'Encounter Two', 'Encounter Three']);
    });

    it('should return 500 on filesystem error', async () => {
        setupEncounters('test-enc-campaign', { encounters: [] });
        const { writeEncounters } = await import('../utils/encounterUtils.js');
        writeEncounters.mockImplementation(() => {
            throw new Error('Disk full');
        });

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-enc-campaign/encounters')
            .send({ name: 'Should Fail', data: {} });

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Disk full');
    });
});

// ─── GET /api/campaigns/:campaign/encounters/:encountername ───────────────────

describe('encounters - GET /api/campaigns/:campaign/encounters/:encountername', () => {
    it('should return 404 when encounter does not exist', async () => {
        setupEncounters('test-enc-campaign', { encounters: [] });

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-enc-campaign/encounters/Nonexistent');

        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('Encounter not found');
    });

    it('should return full encounter data when found', async () => {
        const encounterData = {
            name: 'Dragon Fight',
            savedAt: '2025-01-02T00:00:00.000Z',
            effectiveXP: 4000,
            selectedMonsters: [{ index: 'red-dragon', name: 'Red Dragon', qty: 1 }],
            initiativeBonus: 3,
            terrainType: 'cave',
        };
        setupEncounters('test-enc-campaign', { encounters: [encounterData] });

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-enc-campaign/encounters/Dragon Fight');

        expect(res.status).toBe(200);
        expect(res.body).toEqual(encounterData);
    });

    it('should return full encounter data including all fields', async () => {
        const encounterData = {
            name: 'Full Encounter',
            savedAt: '2025-06-15T12:00:00.000Z',
            effectiveXP: 500,
            selectedMonsters: [
                { index: 'goblin', name: 'Goblin', qty: 4 },
                { index: 'owlbear', name: 'Owlbear', qty: 1 },
            ],
            initiativeBonus: 1,
            terrainType: 'forest',
            environment: 'outdoors',
        };
        setupEncounters('test-enc-campaign', { encounters: [encounterData] });

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-enc-campaign/encounters/Full Encounter');

        expect(res.status).toBe(200);
        expect(res.body.name).toBe('Full Encounter');
        expect(res.body.savedAt).toBe('2025-06-15T12:00:00.000Z');
        expect(res.body.effectiveXP).toBe(500);
        expect(res.body.selectedMonsters).toHaveLength(2);
        expect(res.body.initiativeBonus).toBe(1);
        expect(res.body.terrainType).toBe('forest');
        expect(res.body.environment).toBe('outdoors');
    });

    it('should return 404 when readEncounters returns empty due to read error', async () => {
        const { readEncounters } = await import('../utils/encounterUtils.js');
        readEncounters.mockReturnValue({ encounters: [] });

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-enc-campaign/encounters/Any');

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Encounter not found');
    });
});

// ─── PUT /api/campaigns/:campaign/encounters/:encountername ──────────────────

describe('encounters - PUT /api/campaigns/:campaign/encounters/:encountername', () => {
    it('should return 404 when encounter does not exist', async () => {
        setupEncounters('test-enc-campaign', { encounters: [] });

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-enc-campaign/encounters/Nonexistent')
            .send({ selectedMonsters: [] });

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Encounter not found');
    });

    it('should update an existing encounter and preserve savedAt', async () => {
        const originalSavedAt = '2025-01-01T00:00:00.000Z';
        setupEncounters('test-enc-campaign', {
            encounters: [
                { name: 'Old Encounter', savedAt: originalSavedAt, effectiveXP: 100, selectedMonsters: [] },
            ],
        });

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-enc-campaign/encounters/Old Encounter')
            .send({ effectiveXP: 500, selectedMonsters: [{ index: 'goblin', name: 'Goblin', qty: 5 }] });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('message', 'Encounter updated successfully');

        const stored = globalThis._encounterStore.get('test-enc-campaign');
        expect(stored.encounters[0].name).toBe('Old Encounter');
        expect(stored.encounters[0].savedAt).toBe(originalSavedAt);
        expect(stored.encounters[0].effectiveXP).toBe(500);
        expect(stored.encounters[0].selectedMonsters).toEqual([{ index: 'goblin', name: 'Goblin', qty: 5 }]);
    });

    it('should overwrite encounter data with provided fields', async () => {
        setupEncounters('test-enc-campaign', {
            encounters: [
                { name: 'Update Test', savedAt: '2025-01-01T00:00:00.000Z', effectiveXP: 100, selectedMonsters: [] },
            ],
        });

        const app = createTestApp();
        const updateData = {
            effectiveXP: 999,
            selectedMonsters: [
                { index: 'troll', name: 'Troll', qty: 2 },
                { index: 'ogre', name: 'Ogre', qty: 1 },
            ],
            terrainType: 'mountain',
        };

        const res = await request(app)
            .put('/api/campaigns/test-enc-campaign/encounters/Update Test')
            .send(updateData);

        expect(res.status).toBe(200);

        const stored = globalThis._encounterStore.get('test-enc-campaign');
        expect(stored.encounters[0].effectiveXP).toBe(999);
        expect(stored.encounters[0].selectedMonsters).toHaveLength(2);
        expect(stored.encounters[0].terrainType).toBe('mountain');
    });

    it('should return 500 on filesystem error', async () => {
        setupEncounters('test-enc-campaign', {
            encounters: [
                { name: 'Fail Update', savedAt: '2025-01-01T00:00:00.000Z', effectiveXP: 100, selectedMonsters: [] },
            ],
        });
        const { writeEncounters } = await import('../utils/encounterUtils.js');
        writeEncounters.mockImplementation(() => {
            throw new Error('Disk full');
        });

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-enc-campaign/encounters/Fail Update')
            .send({ effectiveXP: 200 });

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Disk full');
    });
});

// ─── DELETE /api/campaigns/:campaign/encounters/:encountername ───────────────

describe('encounters - DELETE /api/campaigns/:campaign/encounters/:encountername', () => {
    it('should return 404 when encounter does not exist', async () => {
        setupEncounters('test-enc-campaign', { encounters: [] });

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-enc-campaign/encounters/Nonexistent');

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Encounter not found');
    });

    it('should delete an encounter and return success', async () => {
        setupEncounters('test-enc-campaign', {
            encounters: [
                { name: 'Delete Me', savedAt: '2025-01-01T00:00:00.000Z', effectiveXP: 100, selectedMonsters: [] },
                { name: 'Keep Me', savedAt: '2025-01-02T00:00:00.000Z', effectiveXP: 200, selectedMonsters: [] },
            ],
        });

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-enc-campaign/encounters/Delete Me');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('message', 'Encounter deleted successfully');

        const stored = globalThis._encounterStore.get('test-enc-campaign');
        expect(stored.encounters).toHaveLength(1);
        expect(stored.encounters[0].name).toBe('Keep Me');
    });

    it('should remove only the specified encounter when multiple exist', async () => {
        setupEncounters('test-enc-campaign', {
            encounters: [
                { name: 'First', savedAt: '2025-01-01T00:00:00.000Z', effectiveXP: 100, selectedMonsters: [] },
                { name: 'Second', savedAt: '2025-01-02T00:00:00.000Z', effectiveXP: 200, selectedMonsters: [] },
                { name: 'Third', savedAt: '2025-01-03T00:00:00.000Z', effectiveXP: 300, selectedMonsters: [] },
            ],
        });

        const app = createTestApp();
        await request(app).delete('/api/campaigns/test-enc-campaign/encounters/Second');

        const stored = globalThis._encounterStore.get('test-enc-campaign');
        expect(stored.encounters).toHaveLength(2);
        expect(stored.encounters.map(e => e.name)).toEqual(['First', 'Third']);
    });

    it('should return 500 on filesystem error', async () => {
        setupEncounters('test-enc-campaign', {
            encounters: [
                { name: 'Fail Delete', savedAt: '2025-01-01T00:00:00.000Z', effectiveXP: 100, selectedMonsters: [] },
            ],
        });
        const { writeEncounters } = await import('../utils/encounterUtils.js');
        writeEncounters.mockImplementation(() => {
            throw new Error('Disk full');
        });

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-enc-campaign/encounters/Fail Delete');

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Disk full');
    });
});

// ─── PUT /api/campaigns/:campaign/encounters/:encountername/rename ───────────

describe('encounters - PUT /api/campaigns/:campaign/encounters/:encountername/rename', () => {
    it('should return 404 when encounter does not exist', async () => {
        setupEncounters('test-enc-campaign', { encounters: [] });

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-enc-campaign/encounters/Nonexistent/rename')
            .send({ newName: 'New Name' });

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Encounter not found');
    });

    it('should return 400 when newName is missing', async () => {
        setupEncounters('test-enc-campaign', {
            encounters: [
                { name: 'Old Name', savedAt: '2025-01-01T00:00:00.000Z', effectiveXP: 100, selectedMonsters: [] },
            ],
        });

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-enc-campaign/encounters/Old Name/rename')
            .send({});

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('New encounter name is required');
    });

    it('should return 400 when newName is empty string', async () => {
        setupEncounters('test-enc-campaign', {
            encounters: [
                { name: 'Old Name', savedAt: '2025-01-01T00:00:00.000Z', effectiveXP: 100, selectedMonsters: [] },
            ],
        });

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-enc-campaign/encounters/Old Name/rename')
            .send({ newName: '' });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('New encounter name is required');
    });

    it('should return 400 when newName is whitespace only', async () => {
        setupEncounters('test-enc-campaign', {
            encounters: [
                { name: 'Old Name', savedAt: '2025-01-01T00:00:00.000Z', effectiveXP: 100, selectedMonsters: [] },
            ],
        });

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-enc-campaign/encounters/Old Name/rename')
            .send({ newName: '   ' });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('New encounter name is required');
    });

    it('should return 400 when newName conflicts with another encounter', async () => {
        setupEncounters('test-enc-campaign', {
            encounters: [
                { name: 'Encounter A', savedAt: '2025-01-01T00:00:00.000Z', effectiveXP: 100, selectedMonsters: [] },
                { name: 'Encounter B', savedAt: '2025-01-02T00:00:00.000Z', effectiveXP: 200, selectedMonsters: [] },
            ],
        });

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-enc-campaign/encounters/Encounter A/rename')
            .send({ newName: 'Encounter B' });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('An encounter with this name already exists');
    });

    it('should rename an encounter successfully', async () => {
        setupEncounters('test-enc-campaign', {
            encounters: [
                { name: 'Old Name', savedAt: '2025-01-01T00:00:00.000Z', effectiveXP: 100, selectedMonsters: [] },
            ],
        });

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-enc-campaign/encounters/Old Name/rename')
            .send({ newName: 'New Name' });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('message', 'Encounter renamed successfully');
        expect(res.body).toHaveProperty('encounter', { name: 'New Name' });

        const stored = globalThis._encounterStore.get('test-enc-campaign');
        expect(stored.encounters[0].name).toBe('New Name');
        expect(stored.encounters[0].savedAt).toBe('2025-01-01T00:00:00.000Z');
        expect(stored.encounters[0].effectiveXP).toBe(100);
    });

    it('should trim whitespace from the new name', async () => {
        setupEncounters('test-enc-campaign', {
            encounters: [
                { name: 'Old Name', savedAt: '2025-01-01T00:00:00.000Z', effectiveXP: 100, selectedMonsters: [] },
            ],
        });

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-enc-campaign/encounters/Old Name/rename')
            .send({ newName: '  Trimmed Name  ' });

        expect(res.status).toBe(200);

        const stored = globalThis._encounterStore.get('test-enc-campaign');
        expect(stored.encounters[0].name).toBe('Trimmed Name');
    });

    it('should allow renaming to a different name even with similar names', async () => {
        setupEncounters('test-enc-campaign', {
            encounters: [
                { name: 'Goblin Ambush', savedAt: '2025-01-01T00:00:00.000Z', effectiveXP: 100, selectedMonsters: [] },
                { name: 'Goblin Ambush 2', savedAt: '2025-01-02T00:00:00.000Z', effectiveXP: 200, selectedMonsters: [] },
            ],
        });

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-enc-campaign/encounters/Goblin Ambush/rename')
            .send({ newName: 'Goblin Ambush Revised' });

        expect(res.status).toBe(200);

        const stored = globalThis._encounterStore.get('test-enc-campaign');
        expect(stored.encounters[0].name).toBe('Goblin Ambush Revised');
        expect(stored.encounters[1].name).toBe('Goblin Ambush 2');
    });

    it('should return 500 on filesystem error', async () => {
        setupEncounters('test-enc-campaign', {
            encounters: [
                { name: 'Rename Me', savedAt: '2025-01-01T00:00:00.000Z', effectiveXP: 100, selectedMonsters: [] },
            ],
        });
        const { writeEncounters } = await import('../utils/encounterUtils.js');
        writeEncounters.mockImplementation(() => {
            throw new Error('Disk full');
        });

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-enc-campaign/encounters/Rename Me/rename')
            .send({ newName: 'Renamed' });

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Disk full');
    });
});
