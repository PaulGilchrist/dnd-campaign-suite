import express from 'express';
import { request } from '../test-utils/localhostSupertest.js';
import factions from './factions.js';

// ---------------------------------------------------------------------------
// Mock filesystem
// ---------------------------------------------------------------------------

const mockFsState = new Map();

vi.mock('fs', () => ({
    default: {
        existsSync: vi.fn((path) => mockFsState.has(path)),
        mkdirSync: vi.fn((path) => {
            mockFsState.set(path, true);
        }),
        rmSync: vi.fn((path) => {
            for (const key of [...mockFsState.keys()]) {
                if (key.startsWith(path)) mockFsState.delete(key);
            }
        }),
        writeFileSync: vi.fn((path, data) => {
            mockFsState.set(path, data);
        }),
        readFileSync: vi.fn((path) => mockFsState.get(path) || '{}'),
        unlinkSync: vi.fn((path) => {
            mockFsState.delete(path);
        }),
    },
    existsSync: vi.fn((path) => mockFsState.has(path)),
    mkdirSync: vi.fn((path) => {
        mockFsState.set(path, true);
    }),
    rmSync: vi.fn((path) => {
        for (const key of [...mockFsState.keys()]) {
            if (key.startsWith(path)) mockFsState.delete(key);
        }
    }),
    writeFileSync: vi.fn((path, data) => {
        mockFsState.set(path, data);
    }),
    readFileSync: vi.fn((path) => mockFsState.get(path) || '{}'),
    unlinkSync: vi.fn((path) => {
        mockFsState.delete(path);
    }),
}));

vi.mock('../utils/campaignPaths.js', () => ({
    campaignDataDir: (name) => `/mock/campaigns/${name}/data`,
    campaignDataFile: (campaign, fileName) => `/mock/campaigns/${campaign}/data/${fileName}`,
    ensureDataDir: (campaign) => `/mock/campaigns/${campaign}/data`,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dataFileFor(campaign) {
    return `/mock/campaigns/${campaign}/data/factions.json`;
}

function ensureCampaignDir(campaign) {
    const dir = `/mock/campaigns/${campaign}/data`;
    mockFsState.set(dir, true);
    return dir;
}

function writeFactions(campaign, factionsData) {
    const filePath = dataFileFor(campaign);
    ensureCampaignDir(campaign);
    mockFsState.set(filePath, JSON.stringify(factionsData, null, 2));
}

function removeFactionsFile(campaign) {
    const filePath = dataFileFor(campaign);
    mockFsState.delete(filePath);
}

function removeCampaignDir(campaign) {
    const campaignDir = `/mock/campaigns/${campaign}`;
    for (const key of [...mockFsState.keys()]) {
        if (key.startsWith(campaignDir)) mockFsState.delete(key);
    }
}

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(factions);
    return app;
}

const campaign = 'test-factions';

beforeEach(() => {
    ensureCampaignDir(campaign);
});

afterEach(() => {
    removeFactionsFile(campaign);
    removeCampaignDir(campaign);
});

// ─── GET /api/campaigns/:campaign/factions ──────────────────────────────────

describe('factions - GET list (real router)', () => {
    it('should create the file and return empty array when it does not exist', async () => {
        const app = createTestApp();
        const res = await request(app).get(`/api/campaigns/${campaign}/factions`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('factions');
        expect(Array.isArray(res.body.factions)).toBe(true);
        expect(res.body.factions).toEqual([]);
        expect(mockFsState.has(dataFileFor(campaign))).toBe(true);
    });

    it('should return all factions when file exists', async () => {
        const factionsData = [
            { id: 'f1', name: 'The Survivors of Ironhaven', description: 'The remaining townsfolk', goals: 'Survive the immediate threat', influence: 6, notes: 'Led by Mayor Brunnilda' },
            { id: 'f2', name: 'The Ironfist Undead', description: 'Thorgar Ironfist undead army', goals: 'Purge the surface world', influence: 8, notes: 'Growing in number' },
        ];
        writeFactions(campaign, factionsData);

        const app = createTestApp();
        const res = await request(app).get(`/api/campaigns/${campaign}/factions`);

        expect(res.status).toBe(200);
        expect(res.body.factions).toHaveLength(2);
        expect(res.body.factions[0].id).toBe('f1');
        expect(res.body.factions[0].name).toBe('The Survivors of Ironhaven');
    });

    it('should return factions with all expected fields', async () => {
        const factionData = { id: 'f3', name: 'The Deep Dwellers', description: 'Two duergar hiding in deepest levels', goals: 'Survive Thorgar expanding undead army', influence: 3, notes: 'Found in the deepest levels of the Ancient Tomb' };
        writeFactions(campaign, [factionData]);

        const app = createTestApp();
        const res = await request(app).get(`/api/campaigns/${campaign}/factions`);

        expect(res.status).toBe(200);
        expect(res.body.factions).toHaveLength(1);
        expect(res.body.factions[0]).toEqual(factionData);
    });

    it('should return empty array when file contains non-array data', async () => {
        const filePath = dataFileFor(campaign);
        ensureCampaignDir(campaign);
        mockFsState.set(filePath, JSON.stringify({ not: 'an array' }));

        const app = createTestApp();
        const res = await request(app).get(`/api/campaigns/${campaign}/factions`);

        expect(res.status).toBe(200);
        expect(res.body.factions).toEqual([]);
    });

    it('should return empty array when file contains null', async () => {
        const filePath = dataFileFor(campaign);
        ensureCampaignDir(campaign);
        mockFsState.set(filePath, JSON.stringify(null));

        const app = createTestApp();
        const res = await request(app).get(`/api/campaigns/${campaign}/factions`);

        expect(res.status).toBe(200);
        expect(res.body.factions).toEqual([]);
    });

    it('should return the correct response wrapper key', async () => {
        writeFactions(campaign, [{ id: 'f1', name: 'Test' }]);

        const app = createTestApp();
        const res = await request(app).get(`/api/campaigns/${campaign}/factions`);

        expect(Object.keys(res.body)).toEqual(['factions']);
    });
});

// ─── POST /api/campaigns/:campaign/factions ─────────────────────────────────

describe('factions - POST (real router)', () => {
    it('should save factions and return success', async () => {
        const factionsData = [
            { id: 'f1', name: 'The Survivors of Ironhaven', description: 'The remaining townsfolk', goals: 'Survive', influence: 6, notes: 'Led by Mayor Brunnilda' },
            { id: 'f2', name: 'The Ironfist Undead', description: 'Thorgar Ironfist undead army', goals: 'Purge the surface world', influence: 8, notes: 'Growing in number' },
        ];

        const app = createTestApp();
        const res = await request(app)
            .post(`/api/campaigns/${campaign}/factions`)
            .send({ factions: factionsData });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const stored = JSON.parse(mockFsState.get(dataFileFor(campaign)));
        expect(stored).toHaveLength(2);
        expect(stored[0].name).toBe('The Survivors of Ironhaven');
    });

    it('should save an empty array of factions', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post(`/api/campaigns/${campaign}/factions`)
            .send({ factions: [] });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const stored = JSON.parse(mockFsState.get(dataFileFor(campaign)));
        expect(stored).toEqual([]);
    });

    it('should overwrite existing factions with the new array', async () => {
        const existingData = [{ id: 'old-1', name: 'Old Faction', description: 'Old', goals: 'Old', influence: 1, notes: '' }];
        writeFactions(campaign, existingData);

        const newFactionsData = [{ id: 'new-1', name: 'New Faction', description: 'New', goals: 'New', influence: 5, notes: '' }];

        const app = createTestApp();
        const res = await request(app)
            .post(`/api/campaigns/${campaign}/factions`)
            .send({ factions: newFactionsData });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const stored = JSON.parse(mockFsState.get(dataFileFor(campaign)));
        expect(stored).toHaveLength(1);
        expect(stored[0].name).toBe('New Faction');
    });

    it('should return 400 when factions is missing from request body', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post(`/api/campaigns/${campaign}/factions`)
            .send({});

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'Expected an array for factions');
    });

    it('should return 400 when factions is an object instead of array', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post(`/api/campaigns/${campaign}/factions`)
            .send({ factions: { id: 'f1', name: 'Not An Array' } });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'Expected an array for factions');
    });

    it('should return 400 when factions is null instead of array', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post(`/api/campaigns/${campaign}/factions`)
            .send({ factions: null });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'Expected an array for factions');
    });
});

// ─── GET /api/campaigns/:campaign/factions/:id ──────────────────────────────

describe('factions - GET by id (real router)', () => {
    it('should return 404 when factions.json does not exist', async () => {
        const app = createTestApp();
        const res = await request(app).get(`/api/campaigns/${campaign}/factions/f1`);

        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error', 'Faction not found');
    });

    it('should return 404 when faction with given id does not exist', async () => {
        writeFactions(campaign, [{ id: 'f1', name: 'The Survivors of Ironhaven', description: 'The remaining townsfolk', goals: 'Survive', influence: 6, notes: '' }]);

        const app = createTestApp();
        const res = await request(app).get(`/api/campaigns/${campaign}/factions/nonexistent`);

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Faction not found');
    });

    it('should return the faction when found by id', async () => {
        const factionData = { id: 'f1', name: 'The Survivors of Ironhaven', description: 'The remaining townsfolk of Ironhaven', goals: 'Survive the immediate threat', influence: 6, notes: 'Led by Mayor Brunnilda Stonebeard' };
        writeFactions(campaign, [factionData]);

        const app = createTestApp();
        const res = await request(app).get(`/api/campaigns/${campaign}/factions/f1`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('faction');
        expect(res.body.faction).toEqual(factionData);
    });

    it('should return the correct item wrapper key', async () => {
        writeFactions(campaign, [{ id: 'f1', name: 'Test' }]);

        const app = createTestApp();
        const res = await request(app).get(`/api/campaigns/${campaign}/factions/f1`);

        expect(Object.keys(res.body)).toEqual(['faction']);
    });

    it('should handle URL-encoded ids', async () => {
        writeFactions(campaign, [{ id: 'f/1', name: 'Encoded ID Faction' }]);

        const app = createTestApp();
        const res = await request(app).get(`/api/campaigns/${campaign}/factions/f%2F1`);

        expect(res.status).toBe(200);
        expect(res.body.faction.name).toBe('Encoded ID Faction');
    });

    it('should return empty array when file contains non-array data', async () => {
        const filePath = dataFileFor(campaign);
        ensureCampaignDir(campaign);
        mockFsState.set(filePath, JSON.stringify({ not: 'an array' }));

        const app = createTestApp();
        const res = await request(app).get(`/api/campaigns/${campaign}/factions/any-id`);

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Faction not found');
    });
});

// ─── DELETE /api/campaigns/:campaign/factions/:id ───────────────────────────

describe('factions - DELETE (real router)', () => {
    it('should return 404 when factions.json does not exist', async () => {
        const app = createTestApp();
        const res = await request(app).delete(`/api/campaigns/${campaign}/factions/f1`);

        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error', 'Faction not found');
    });

    it('should delete a faction and return success', async () => {
        const factionsData = [
            { id: 'f1', name: 'Keep Me', description: 'Keep', goals: 'Keep', influence: 1, notes: '' },
            { id: 'f2', name: 'Delete Me', description: 'Delete', goals: 'Delete', influence: 5, notes: '' },
        ];
        writeFactions(campaign, factionsData);

        const app = createTestApp();
        const res = await request(app).delete(`/api/campaigns/${campaign}/factions/f2`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const stored = JSON.parse(mockFsState.get(dataFileFor(campaign)));
        expect(stored).toHaveLength(1);
        expect(stored[0].name).toBe('Keep Me');
    });

    it('should return success when deleting non-existent faction (no-op)', async () => {
        const factionsData = [{ id: 'f1', name: 'Keep Me', description: 'Keep', goals: 'Keep', influence: 1, notes: '' }];
        writeFactions(campaign, factionsData);

        const app = createTestApp();
        const res = await request(app).delete(`/api/campaigns/${campaign}/factions/nonexistent`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const stored = JSON.parse(mockFsState.get(dataFileFor(campaign)));
        expect(stored).toHaveLength(1);
    });

    it('should remove only the matching faction', async () => {
        const factionsData = [
            { id: 'f1', name: 'First', description: 'First', goals: 'First', influence: 1, notes: '' },
            { id: 'f2', name: 'Second', description: 'Second', goals: 'Second', influence: 5, notes: '' },
            { id: 'f3', name: 'Third', description: 'Third', goals: 'Third', influence: 10, notes: '' },
        ];
        writeFactions(campaign, factionsData);

        const app = createTestApp();
        const res = await request(app).delete(`/api/campaigns/${campaign}/factions/f2`);

        expect(res.status).toBe(200);

        const stored = JSON.parse(mockFsState.get(dataFileFor(campaign)));
        expect(stored).toHaveLength(2);
        expect(stored.map(f => f.name)).toEqual(['First', 'Third']);
    });

    it('should handle deleting the only faction', async () => {
        const factionsData = [{ id: 'f1', name: 'Only Faction', description: 'Only', goals: 'Only', influence: 5, notes: '' }];
        writeFactions(campaign, factionsData);

        const app = createTestApp();
        const res = await request(app).delete(`/api/campaigns/${campaign}/factions/f1`);

        expect(res.status).toBe(200);

        const stored = JSON.parse(mockFsState.get(dataFileFor(campaign)));
        expect(stored).toHaveLength(0);
    });

    it('should handle deleting from empty array', async () => {
        writeFactions(campaign, []);

        const app = createTestApp();
        const res = await request(app).delete(`/api/campaigns/${campaign}/factions/f1`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
    });
});
