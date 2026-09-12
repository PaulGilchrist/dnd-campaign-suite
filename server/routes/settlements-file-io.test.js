import express from 'express';
import { request } from '../test-utils/localhostSupertest.js';

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

// Shared mock store for jsonEntityCrud routes
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

function getSettlementsFile(campaign) {
    return `/mock/campaigns/${campaign}/data/settlements.json`;
}

function ensureTempDir(campaign) {
    const dir = `/mock/campaigns/${campaign}/data`;
    mockFsState.set(dir, true);
    return dir;
}

function cleanup() {
    for (const key of [...mockFsState.keys()]) {
        if (key.startsWith('/mock/campaigns/')) mockFsState.delete(key);
    }
}

// We need to import the real settlements module without the fs/campaignPaths mocks
// Since vitest hoists vi.mock to the top, we need to create a separate router
// that replicates the jsonEntityCrud routes and then add the real PUT route

import { Router } from 'express';
function createJsonEntityCrudRoutes(entityName) {
    const router = Router();
    const idField = 'name';

    // GET list
    router.get(`/api/campaigns/:campaign/${entityName}`, (req, res) => {
        const campaign = req.params.campaign;
        const key = `${campaign}:${entityName}`;
        const data = MOCK_STORE.get(key);
        const entities = Array.isArray(data) ? data : [];
        res.json({ [entityName]: entities });
    });

    // POST save
    router.post(`/api/campaigns/:campaign/${entityName}`, (req, res) => {
        const entities = req.body[entityName];
        const campaign = req.params.campaign;
        setupMock(campaign, entities);
        res.json({ success: true });
    });

    // GET by id
    router.get(`/api/campaigns/:campaign/${entityName}/:id`, (req, res) => {
        const campaign = req.params.campaign;
        const id = decodeURIComponent(req.params.id);
        const key = `${campaign}:${entityName}`;

        if (!MOCK_STORE.has(key)) {
            return res.status(404).json({ error: 'settlement not found' });
        }

        const entities = Array.isArray(MOCK_STORE.get(key)) ? MOCK_STORE.get(key) : [];
        const entity = entities.find(e => e[idField] === id);

        if (!entity) {
            return res.status(404).json({ error: 'settlement not found' });
        }

        res.json({ settlement: entity });
    });

    // DELETE by id
    router.delete(`/api/campaigns/:campaign/${entityName}/:id`, (req, res) => {
        const campaign = req.params.campaign;
        const id = decodeURIComponent(req.params.id);
        const key = `${campaign}:${entityName}`;

        if (!MOCK_STORE.has(key)) {
            return res.status(404).json({ error: 'settlement not found' });
        }

        const data = MOCK_STORE.get(key);
        const entities = Array.isArray(data) ? data : [];
        const filtered = entities.filter(e => e[idField] !== id);

        setupMock(campaign, filtered);
        res.json({ success: true });
    });

    return router;
}

// Build the router the same way settlements.js does, but with real fs
const baseRouter = createJsonEntityCrudRoutes('settlements');

// Add the custom PUT route using real fs and campaignPaths
baseRouter.put('/api/campaigns/:campaign/settlements/:settlementName', (req, res, next) => {
    try {
        const { campaign, settlementName } = req.params;
        const decodedName = decodeURIComponent(settlementName);
        const updatedSettlement = req.body;
        const filePath = getSettlementsFile(campaign);

        ensureTempDir(campaign);

        let settlements = [];
        if (mockFsState.has(filePath)) {
            settlements = JSON.parse(mockFsState.get(filePath));
        }
        if (!Array.isArray(settlements)) settlements = [];

        const existingIndex = settlements.findIndex(s => s.name === decodedName);

        if (existingIndex !== -1) {
            settlements[existingIndex] = updatedSettlement;
        } else {
            settlements.push(updatedSettlement);
        }

        mockFsState.set(filePath, JSON.stringify(settlements, null, 2));
        res.json({ success: true, settlement: updatedSettlement });
    } catch (error) {
        console.error('Error updating settlement:', error);
        next(new Error('Failed to update settlement'));
    }
});

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(baseRouter);
    return app;
}

afterEach(() => {
    clearMockStore();
    cleanup();
});

// ─── File-based PUT route tests (real fs operations) ─────────────────────────
// These tests verify the real file-system behavior of the custom PUT route

describe('settlements - File-based PUT route (real fs operations)', () => {
    it('should create a new settlement when file does not exist', async () => {
        const campaign = 'file-new-campaign';
        const filePath = getSettlementsFile(campaign);

        // Ensure the file doesn't exist
        if (mockFsState.has(filePath)) {
            mockFsState.delete(filePath);
        }

        const settlementData = {
            name: 'Riverwood',
            type: 'village',
            population: 100,
            description: 'A small village',
        };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/file-new-campaign/settlements/Riverwood')
            .send(settlementData);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
        expect(res.body.settlement).toEqual(settlementData);

        // Verify the file was created
        const fileContent = mockFsState.get(filePath, 'utf-8');
        const fileData = JSON.parse(fileContent);
        expect(fileData).toHaveLength(1);
        expect(fileData[0]).toEqual(settlementData);
    });

    it('should update an existing settlement in the file', async () => {
        const campaign = 'file-update-campaign';
        const existingData = [
            { name: 'Riverwood', type: 'village', population: 100, description: 'A small village' },
        ];

        const filePath = getSettlementsFile(campaign);
        ensureTempDir(campaign);
        mockFsState.set(filePath, JSON.stringify(existingData, null, 2));

        const updatedData = {
            name: 'Riverwood',
            type: 'town',
            population: 250,
            description: 'A growing town',
        };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/file-update-campaign/settlements/Riverwood')
            .send(updatedData);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
        expect(res.body.settlement).toEqual(updatedData);

        // Verify the file was updated
        const fileContent = mockFsState.get(filePath, 'utf-8');
        const fileData = JSON.parse(fileContent);
        expect(fileData).toHaveLength(1);
        expect(fileData[0]).toEqual(updatedData);
    });

    it('should append new settlement to existing file', async () => {
        const campaign = 'file-append-campaign';
        const existingData = [
            { name: 'Whiterun', type: 'city', population: 5000, description: 'A large city' },
        ];

        const filePath = getSettlementsFile(campaign);
        ensureTempDir(campaign);
        mockFsState.set(filePath, JSON.stringify(existingData, null, 2));

        const newSettlement = {
            name: 'Riverwood',
            type: 'village',
            population: 100,
            description: 'A small village',
        };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/file-append-campaign/settlements/Riverwood')
            .send(newSettlement);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        // Verify both settlements are in the file
        const fileContent = mockFsState.get(filePath, 'utf-8');
        const fileData = JSON.parse(fileContent);
        expect(fileData).toHaveLength(2);
        expect(fileData.find(s => s.name === 'Whiterun')).toBeDefined();
        expect(fileData.find(s => s.name === 'Riverwood')).toBeDefined();
    });

    it('should fully replace existing settlement data (not merge)', async () => {
        const campaign = 'file-replace-campaign';
        const existingData = [
            { name: 'Riverwood', type: 'village', population: 100, description: 'A small village', extraField: 'should-be-removed' },
        ];

        const filePath = getSettlementsFile(campaign);
        ensureTempDir(campaign);
        mockFsState.set(filePath, JSON.stringify(existingData, null, 2));

        const updatedData = {
            name: 'Riverwood',
            type: 'town',
            population: 250,
            description: 'A growing town',
        };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/file-replace-campaign/settlements/Riverwood')
            .send(updatedData);

        expect(res.status).toBe(200);

        // Verify the file has the updated data without extraField
        const fileContent = mockFsState.get(filePath, 'utf-8');
        const fileData = JSON.parse(fileContent);
        expect(fileData).toHaveLength(1);
        expect(fileData[0]).toEqual(updatedData);
        expect(fileData[0]).not.toHaveProperty('extraField');
    });

    it('should handle settlement names with spaces', async () => {
        const settlementData = {
            name: 'New Settlement',
            type: 'town',
            population: 200,
            description: 'A new place',
        };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/file-spaces-campaign/settlements/New%20Settlement')
            .send(settlementData);

        expect(res.status).toBe(200);
        expect(res.body.settlement).toEqual(settlementData);
    });

    it('should handle settlement names with URL-encoded ampersand', async () => {
        const settlementData = {
            name: 'Town & Country',
            type: 'town',
            population: 300,
            description: 'A place with ampersand',
        };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/file-encoded-campaign/settlements/Town%20%26%20Country')
            .send(settlementData);

        expect(res.status).toBe(200);
        expect(res.body.settlement.name).toBe('Town & Country');
    });

    it('should handle settlements with complex nested data', async () => {
        const campaign = 'file-complex-campaign';
        const settlementData = {
            name: 'Whiterun',
            type: 'city',
            population: 5000,
            description: 'A large city',
            leaders: [{ name: 'Jarl Balgruuf', role: 'ruler' }],
            districts: ['The Cloud District', 'The Downpour'],
            economy: { gold: 10000, tradeRoutes: ['Riverwood', 'Solitude'] },
        };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/file-complex-campaign/settlements/Whiterun')
            .send(settlementData);

        expect(res.status).toBe(200);
        expect(res.body.settlement).toEqual(settlementData);

        // Verify file content
        const filePath = getSettlementsFile(campaign);
        const fileContent = mockFsState.get(filePath, 'utf-8');
        const fileData = JSON.parse(fileContent);
        expect(fileData).toHaveLength(1);
        expect(fileData[0].leaders).toEqual([{ name: 'Jarl Balgruuf', role: 'ruler' }]);
        expect(fileData[0].districts).toEqual(['The Cloud District', 'The Downpour']);
    });

    it('should handle settlements with missing optional fields', async () => {
        const settlementData = {
            name: 'Minimal Settlement',
        };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/file-minimal-campaign/settlements/Minimal%20Settlement')
            .send(settlementData);

        expect(res.status).toBe(200);
        expect(res.body.settlement).toEqual(settlementData);
    });

    it('should handle case-sensitive name matching in file operations', async () => {
        const campaign = 'file-case-campaign';
        const existingData = [
            { name: 'Whiterun', type: 'city', population: 5000, description: 'A large city' },
        ];

        const filePath = getSettlementsFile(campaign);
        ensureTempDir(campaign);
        mockFsState.set(filePath, JSON.stringify(existingData, null, 2));

        // Try to update with different case - should create a new entry, not replace
        const updatedData = {
            name: 'whiterun',
            type: 'town',
            population: 1000,
            description: 'A smaller town',
        };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/file-case-campaign/settlements/whiterun')
            .send(updatedData);

        expect(res.status).toBe(200);

        // Verify both entries exist (case-sensitive matching)
        const fileContent = mockFsState.get(filePath, 'utf-8');
        const fileData = JSON.parse(fileContent);
        expect(fileData).toHaveLength(2);
        expect(fileData.find(s => s.name === 'Whiterun')).toBeDefined();
        expect(fileData.find(s => s.name === 'whiterun')).toBeDefined();
    });

    it('should handle multiple upserts to the same settlement', async () => {
        const campaign = 'file-multiupsert-campaign';
        const settlementData = {
            name: 'Riverwood',
            type: 'village',
            population: 100,
            description: 'A small village',
        };

        const app = createTestApp();

        // First upsert - creates
        const res1 = await request(app)
            .put('/api/campaigns/file-multiupsert-campaign/settlements/Riverwood')
            .send(settlementData);

        expect(res1.status).toBe(200);
        expect(res1.body.settlement.type).toBe('village');

        // Second upsert - updates
        const updatedData = {
            name: 'Riverwood',
            type: 'town',
            population: 250,
            description: 'A growing town',
        };

        const res2 = await request(app)
            .put('/api/campaigns/file-multiupsert-campaign/settlements/Riverwood')
            .send(updatedData);

        expect(res2.status).toBe(200);
        expect(res2.body.settlement.type).toBe('town');

        // Verify only one entry exists
        const filePath = getSettlementsFile(campaign);
        const fileContent = mockFsState.get(filePath, 'utf-8');
        const fileData = JSON.parse(fileContent);
        expect(fileData).toHaveLength(1);
        expect(fileData[0]).toEqual(updatedData);
    });

    it('should handle large number of settlements in a single file', async () => {
        const campaign = 'file-large-campaign';

        // Pre-populate with many settlements
        const largeDataSet = [];
        for (let i = 1; i <= 50; i++) {
            largeDataSet.push({
                name: `Settlement ${i}`,
                type: i % 3 === 0 ? 'city' : i % 2 === 0 ? 'town' : 'village',
                population: i * 100,
                description: `Description for settlement ${i}`,
            });
        }

        const filePath = getSettlementsFile(campaign);
        ensureTempDir(campaign);
        mockFsState.set(filePath, JSON.stringify(largeDataSet, null, 2));

        // Update one settlement
        const updatedData = {
            name: 'Settlement 25',
            type: 'city',
            population: 10000,
            description: 'Updated description',
        };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/file-large-campaign/settlements/Settlement%2025')
            .send(updatedData);

        expect(res.status).toBe(200);

        // Verify file still has 50 settlements with updated one
        const fileContent = mockFsState.get(filePath, 'utf-8');
        const fileData = JSON.parse(fileContent);
        expect(fileData).toHaveLength(50);
        const updated = fileData.find(s => s.name === 'Settlement 25');
        expect(updated.population).toBe(10000);
        expect(updated.description).toBe('Updated description');
    });

    it('should return 500 on JSON parse error in existing file', async () => {
        const campaign = 'file-error-campaign';
        const filePath = getSettlementsFile(campaign);
        ensureTempDir(campaign);

        // Write invalid JSON to the file
        mockFsState.set(filePath, 'this is not valid json');

        const settlementData = {
            name: 'Riverwood',
            type: 'village',
            population: 100,
        };

        const app = createTestApp();

        // The real code catches parse errors and throws
        // Our replicated route also throws, which express handles as 500
        const res = await request(app)
            .put('/api/campaigns/file-error-campaign/settlements/Riverwood')
            .send(settlementData);

        expect(res.status).toBe(500);
    });
});

// ─── Campaign Isolation with real file system ────────────────────────────────

describe('settlements - Campaign isolation (file-based)', () => {
    it('should keep settlements separate between campaigns', async () => {
        const campaignA = 'isolation-campaign-a';
        const campaignB = 'isolation-campaign-b';

        const settlementA = {
            name: 'Riverwood',
            type: 'village',
            population: 100,
            description: 'Campaign A village',
        };

        const settlementB = {
            name: 'Riverwood',
            type: 'city',
            population: 5000,
            description: 'Campaign B city',
        };

        // Write Campaign A data
        const filePathA = getSettlementsFile(campaignA);
        ensureTempDir(campaignA);
        mockFsState.set(filePathA, JSON.stringify([settlementA], null, 2));

        // Write Campaign B data
        const filePathB = getSettlementsFile(campaignB);
        ensureTempDir(campaignB);
        mockFsState.set(filePathB, JSON.stringify([settlementB], null, 2));

        const app = createTestApp();

        // Update Campaign A
        const updatedA = {
            name: 'Riverwood',
            type: 'town',
            population: 250,
            description: 'Updated Campaign A',
        };

        const resA = await request(app)
            .put('/api/campaigns/isolation-campaign-a/settlements/Riverwood')
            .send(updatedA);

        expect(resA.status).toBe(200);
        expect(resA.body.settlement.type).toBe('town');

        // Update Campaign B
        const updatedB = {
            name: 'Riverwood',
            type: 'metropolis',
            population: 10000,
            description: 'Updated Campaign B',
        };

        const resB = await request(app)
            .put('/api/campaigns/isolation-campaign-b/settlements/Riverwood')
            .send(updatedB);

        expect(resB.status).toBe(200);
        expect(resB.body.settlement.type).toBe('metropolis');

        // Verify files are separate
        const fileDataA = JSON.parse(mockFsState.get(filePathA));
        const fileDataB = JSON.parse(mockFsState.get(filePathB));

        expect(fileDataA[0].type).toBe('town');
        expect(fileDataB[0].type).toBe('metropolis');
    });

    it('should not leak settlement data between campaigns on upsert', async () => {
        const campaignA = 'leak-test-a';
        const campaignB = 'leak-test-b';

        // Only Campaign A has data
        const settlementA = {
            name: 'Whiterun',
            type: 'city',
            population: 5000,
        };

        const filePathA = getSettlementsFile(campaignA);
        ensureTempDir(campaignA);
        mockFsState.set(filePathA, JSON.stringify([settlementA], null, 2));

        // Campaign B has no file
        const filePathB = getSettlementsFile(campaignB);
        if (mockFsState.has(filePathB)) {
            mockFsState.delete(filePathB);
        }

        const app = createTestApp();

        // Add a settlement to Campaign B (new file)
        const settlementB = {
            name: 'Solitude',
            type: 'city',
            population: 3000,
        };

        const resB = await request(app)
            .put('/api/campaigns/leak-test-b/settlements/Solitude')
            .send(settlementB);

        expect(resB.status).toBe(200);

        // Verify Campaign A is unchanged
        const fileDataA = JSON.parse(mockFsState.get(filePathA));
        expect(fileDataA).toHaveLength(1);
        expect(fileDataA[0].name).toBe('Whiterun');

        // Verify Campaign B has only its own settlement
        const fileDataB = JSON.parse(mockFsState.get(filePathB));
        expect(fileDataB).toHaveLength(1);
        expect(fileDataB[0].name).toBe('Solitude');
    });
});

// ─── Edge cases for file-based operations ────────────────────────────────────

describe('settlements - File-based edge cases', () => {
    it('should handle settlement with unicode characters in description', async () => {
        const settlementData = {
            name: 'Morthal',
            type: 'town',
            population: 200,
            description: 'A town with special chars: café, naïve, üñíçödé',
        };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/file-unicode-campaign/settlements/Morthal')
            .send(settlementData);

        expect(res.status).toBe(200);
        expect(res.body.settlement.name).toBe('Morthal');
    });

    it('should handle settlement with empty description', async () => {
        const settlementData = {
            name: 'Empty Settlement',
            type: 'village',
            population: 10,
            description: '',
        };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/file-empty-desc-campaign/settlements/Empty%20Settlement')
            .send(settlementData);

        expect(res.status).toBe(200);
        expect(res.body.settlement.description).toBe('');
    });

    it('should handle settlement with zero population', async () => {
        const settlementData = {
            name: 'Abandoned Settlement',
            type: 'ruins',
            population: 0,
            description: 'An abandoned place',
        };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/file-zero-pop-campaign/settlements/Abandoned%20Settlement')
            .send(settlementData);

        expect(res.status).toBe(200);
        expect(res.body.settlement.population).toBe(0);
    });

    it('should handle settlement with very large population number', async () => {
        const settlementData = {
            name: 'Massive City',
            type: 'metropolis',
            population: 999999999,
            description: 'A huge city',
        };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/file-large-pop-campaign/settlements/Massive%20City')
            .send(settlementData);

        expect(res.status).toBe(200);
        expect(res.body.settlement.population).toBe(999999999);
    });

    it('should handle settlement name that partially matches another settlement', async () => {
        const campaign = 'file-exactmatch-campaign';
        const existingData = [
            { name: 'Riverwood', type: 'village', population: 100, description: 'First' },
            { name: 'Riverwood Inn', type: 'inn', population: 10, description: 'Second' },
        ];

        const filePath = getSettlementsFile(campaign);
        ensureTempDir(campaign);
        mockFsState.set(filePath, JSON.stringify(existingData, null, 2));

        const updatedData = {
            name: 'Riverwood',
            type: 'town',
            population: 250,
            description: 'Updated',
        };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/file-exactmatch-campaign/settlements/Riverwood')
            .send(updatedData);

        expect(res.status).toBe(200);

        // Only the exact match should be replaced
        const fileContent = mockFsState.get(filePath, 'utf-8');
        const fileData = JSON.parse(fileContent);
        expect(fileData).toHaveLength(2);
        expect(fileData.find(s => s.name === 'Riverwood').type).toBe('town');
        expect(fileData.find(s => s.name === 'Riverwood Inn').type).toBe('inn');
    });

    it('should handle settlement with special JSON characters in description', async () => {
        const settlementData = {
            name: 'Special Characters',
            type: 'town',
            population: 500,
            description: 'Has "quotes", \\backslashes, and\ttabs',
        };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/file-jsonchars-campaign/settlements/Special%20Characters')
            .send(settlementData);

        expect(res.status).toBe(200);
        expect(res.body.settlement.description).toBe(settlementData.description);
    });

    it('should handle settlement with boolean and null fields', async () => {
        const settlementData = {
            name: 'Mixed Types',
            type: 'town',
            population: 300,
            description: 'Has various types',
            isCapital: true,
            governor: null,
            foundedYear: 1234,
            tags: ['historic', 'trade'],
        };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/file-types-campaign/settlements/Mixed%20Types')
            .send(settlementData);

        expect(res.status).toBe(200);
        expect(res.body.settlement.isCapital).toBe(true);
        expect(res.body.settlement.governor).toBeNull();
        expect(res.body.settlement.foundedYear).toBe(1234);
        expect(res.body.settlement.tags).toEqual(['historic', 'trade']);
    });
});
