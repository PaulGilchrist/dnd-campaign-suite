import express from 'express';
import { request } from '../test-utils/localhostSupertest.js';

// Mock fs before importing settlements
// Stores raw strings (for invalid JSON testing) or parsed data
const mockFsData = new Map();
// Track whether values are raw strings
const mockFsRawStrings = new Set();

vi.mock('fs', () => ({
    default: {
        existsSync: vi.fn((path) => mockFsData.has(path)),
        readFileSync: vi.fn((path) => {
            if (!mockFsData.has(path)) {
                throw new Error(`ENOENT: no such file or directory, open '${path}'`);
            }
            if (mockFsRawStrings.has(path)) {
                return mockFsData.get(path);
            }
            return JSON.stringify(mockFsData.get(path));
        }),
        writeFileSync: vi.fn((path, data) => {
            mockFsData.set(path, JSON.parse(data));
            mockFsRawStrings.delete(path);
        }),
    },
    existsSync: vi.fn((path) => mockFsData.has(path)),
    readFileSync: vi.fn((path) => {
        if (!mockFsData.has(path)) {
            throw new Error(`ENOENT: no such file or directory, open '${path}'`);
        }
        if (mockFsRawStrings.has(path)) {
            return mockFsData.get(path);
        }
        return JSON.stringify(mockFsData.get(path));
    }),
    writeFileSync: vi.fn((path, data) => {
        mockFsData.set(path, JSON.parse(data));
        mockFsRawStrings.delete(path);
    }),
}));

vi.mock('../utils/campaignPaths.js', () => ({
    campaignDataFile: vi.fn((campaign, name) => `/mock/campaigns/${campaign}/data/${name}`),
    ensureDataDir: vi.fn((campaign) => `/mock/campaigns/${campaign}/data`),
}));

// Mock asyncHandler to properly catch errors and return 500 responses
vi.mock('../utils/asyncHandler.js', () => ({
    default: (fn) => (req, res, next) => {
        try {
            const result = fn(req, res, next);
            if (result && typeof result.catch === 'function') result.catch(next);
        } catch (error) {
            console.error(`Error in ${req.method} ${req.originalUrl}:`, error);
            res.status(500).json({ error: error.message || 'Internal server error' });
        }
    },
}));

import settlements from './settlements.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(settlements);
    return app;
}

function getFilePath(campaign) {
    return `/mock/campaigns/${campaign}/data/settlements.json`;
}

function clearMockFs() {
    mockFsData.clear();
    mockFsRawStrings.clear();
}

afterEach(() => {
    clearMockFs();
    vi.restoreAllMocks();
});

// ─── Real PUT /api/campaigns/:campaign/settlements/:settlementName ────────────
// These tests exercise the actual settlements.js PUT route with real fs mocks

describe('settlements - Real PUT route (settlements.js lines 13-42)', () => {
    it('should create a new settlement when file does not exist', async () => {
        const campaign = 'real-fs-new';
        const settlementData = {
            name: 'Riverwood',
            type: 'village',
            population: 100,
            description: 'A small village',
        };

        const app = createTestApp();
        const res = await request(app)
            .put(`/api/campaigns/${campaign}/settlements/Riverwood`)
            .send(settlementData);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
        expect(res.body.settlement).toEqual(settlementData);

        // Verify file was written
        const filePath = getFilePath(campaign);
        expect(mockFsData.has(filePath)).toBe(true);
        const fileData = mockFsData.get(filePath);
        expect(fileData).toHaveLength(1);
        expect(fileData[0]).toEqual(settlementData);
    });

    it('should update an existing settlement when it exists', async () => {
        const campaign = 'real-fs-update';
        const existingData = [
            { name: 'Riverwood', type: 'village', population: 100, description: 'A small village' },
        ];
        const filePath = getFilePath(campaign);
        mockFsData.set(filePath, existingData);

        const updatedData = {
            name: 'Riverwood',
            type: 'town',
            population: 250,
            description: 'A growing town',
        };

        const app = createTestApp();
        const res = await request(app)
            .put(`/api/campaigns/${campaign}/settlements/Riverwood`)
            .send(updatedData);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
        expect(res.body.settlement).toEqual(updatedData);

        const fileData = mockFsData.get(filePath);
        expect(fileData).toHaveLength(1);
        expect(fileData[0]).toEqual(updatedData);
    });

    it('should append a new settlement to an existing file', async () => {
        const campaign = 'real-fs-append';
        const existingData = [
            { name: 'Whiterun', type: 'city', population: 5000, description: 'A large city' },
        ];
        const filePath = getFilePath(campaign);
        mockFsData.set(filePath, existingData);

        const newSettlement = {
            name: 'Riverwood',
            type: 'village',
            population: 100,
            description: 'A small village',
        };

        const app = createTestApp();
        const res = await request(app)
            .put(`/api/campaigns/${campaign}/settlements/Riverwood`)
            .send(newSettlement);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const fileData = mockFsData.get(filePath);
        expect(fileData).toHaveLength(2);
        expect(fileData.find(s => s.name === 'Whiterun')).toBeDefined();
        expect(fileData.find(s => s.name === 'Riverwood')).toBeDefined();
    });

    it('should fully replace existing settlement data (not merge)', async () => {
        const campaign = 'real-fs-replace';
        const existingData = [
            { name: 'Riverwood', type: 'village', population: 100, description: 'A small village', extraField: 'should-be-removed' },
        ];
        const filePath = getFilePath(campaign);
        mockFsData.set(filePath, existingData);

        const updatedData = {
            name: 'Riverwood',
            type: 'town',
            population: 250,
            description: 'A growing town',
        };

        const app = createTestApp();
        const res = await request(app)
            .put(`/api/campaigns/${campaign}/settlements/Riverwood`)
            .send(updatedData);

        expect(res.status).toBe(200);

        const fileData = mockFsData.get(filePath);
        expect(fileData).toHaveLength(1);
        expect(fileData[0]).toEqual(updatedData);
        expect(fileData[0]).not.toHaveProperty('extraField');
    });

    it('should handle settlement names with URL-encoded spaces', async () => {
        const campaign = 'real-fs-spaces';
        const settlementData = {
            name: 'New Settlement',
            type: 'town',
            population: 200,
            description: 'A new place',
        };

        const app = createTestApp();
        const res = await request(app)
            .put(`/api/campaigns/${campaign}/settlements/New%20Settlement`)
            .send(settlementData);

        expect(res.status).toBe(200);
        expect(res.body.settlement).toEqual(settlementData);
    });

    it('should handle settlement names with URL-encoded ampersand', async () => {
        const campaign = 'real-fs-ampersand';
        const settlementData = {
            name: 'Town & Country',
            type: 'town',
            population: 300,
            description: 'A place with ampersand',
        };

        const app = createTestApp();
        const res = await request(app)
            .put(`/api/campaigns/${campaign}/settlements/Town%20%26%20Country`)
            .send(settlementData);

        expect(res.status).toBe(200);
        expect(res.body.settlement.name).toBe('Town & Country');
    });

    it('should handle case-sensitive name matching', async () => {
        const campaign = 'real-fs-case';
        const existingData = [
            { name: 'Whiterun', type: 'city', population: 5000, description: 'A large city' },
        ];
        const filePath = getFilePath(campaign);
        mockFsData.set(filePath, existingData);

        const updatedData = {
            name: 'whiterun',
            type: 'town',
            population: 1000,
            description: 'A smaller town',
        };

        const app = createTestApp();
        const res = await request(app)
            .put(`/api/campaigns/${campaign}/settlements/whiterun`)
            .send(updatedData);

        expect(res.status).toBe(200);

        const fileData = mockFsData.get(filePath);
        expect(fileData).toHaveLength(2);
        expect(fileData.find(s => s.name === 'Whiterun')).toBeDefined();
        expect(fileData.find(s => s.name === 'whiterun')).toBeDefined();
    });

    it('should handle settlements with complex nested data', async () => {
        const campaign = 'real-fs-complex';
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
            .put(`/api/campaigns/${campaign}/settlements/Whiterun`)
            .send(settlementData);

        expect(res.status).toBe(200);
        expect(res.body.settlement).toEqual(settlementData);

        const filePath = getFilePath(campaign);
        const fileData = mockFsData.get(filePath);
        expect(fileData).toHaveLength(1);
        expect(fileData[0].leaders).toEqual([{ name: 'Jarl Balgruuf', role: 'ruler' }]);
        expect(fileData[0].districts).toEqual(['The Cloud District', 'The Downpour']);
    });

    it('should handle settlements with missing optional fields', async () => {
        const campaign = 'real-fs-minimal';
        const settlementData = {
            name: 'Minimal Settlement',
        };

        const app = createTestApp();
        const res = await request(app)
            .put(`/api/campaigns/${campaign}/settlements/Minimal%20Settlement`)
            .send(settlementData);

        expect(res.status).toBe(200);
        expect(res.body.settlement).toEqual(settlementData);
    });

    it('should handle multiple upserts to the same settlement', async () => {
        const campaign = 'real-fs-multiupsert';
        const settlementData = {
            name: 'Riverwood',
            type: 'village',
            population: 100,
            description: 'A small village',
        };

        const app = createTestApp();

        // First upsert - creates
        const res1 = await request(app)
            .put(`/api/campaigns/${campaign}/settlements/Riverwood`)
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
            .put(`/api/campaigns/${campaign}/settlements/Riverwood`)
            .send(updatedData);

        expect(res2.status).toBe(200);
        expect(res2.body.settlement.type).toBe('town');

        // Verify only one entry exists
        const filePath = getFilePath(campaign);
        const fileData = mockFsData.get(filePath);
        expect(fileData).toHaveLength(1);
        expect(fileData[0]).toEqual(updatedData);
    });

    it('should handle settlements with boolean and null fields', async () => {
        const campaign = 'real-fs-types';
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
            .put(`/api/campaigns/${campaign}/settlements/Mixed%20Types`)
            .send(settlementData);

        expect(res.status).toBe(200);
        expect(res.body.settlement.isCapital).toBe(true);
        expect(res.body.settlement.governor).toBeNull();
        expect(res.body.settlement.foundedYear).toBe(1234);
        expect(res.body.settlement.tags).toEqual(['historic', 'trade']);
    });

    it('should handle settlement name that partially matches another settlement', async () => {
        const campaign = 'real-fs-exactmatch';
        const existingData = [
            { name: 'Riverwood', type: 'village', population: 100, description: 'First' },
            { name: 'Riverwood Inn', type: 'inn', population: 10, description: 'Second' },
        ];
        const filePath = getFilePath(campaign);
        mockFsData.set(filePath, existingData);

        const updatedData = {
            name: 'Riverwood',
            type: 'town',
            population: 250,
            description: 'Updated',
        };

        const app = createTestApp();
        const res = await request(app)
            .put(`/api/campaigns/${campaign}/settlements/Riverwood`)
            .send(updatedData);

        expect(res.status).toBe(200);

        const fileData = mockFsData.get(filePath);
        expect(fileData).toHaveLength(2);
        expect(fileData.find(s => s.name === 'Riverwood').type).toBe('town');
        expect(fileData.find(s => s.name === 'Riverwood Inn').type).toBe('inn');
    });

    it('should handle campaign isolation - separate files per campaign', async () => {
        const campaignA = 'real-fs-isolation-a';
        const campaignB = 'real-fs-isolation-b';

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

        const filePathA = getFilePath(campaignA);
        const filePathB = getFilePath(campaignB);
        mockFsData.set(filePathA, [settlementA]);
        mockFsData.set(filePathB, [settlementB]);

        const app = createTestApp();

        // Update Campaign A
        const updatedA = {
            name: 'Riverwood',
            type: 'town',
            population: 250,
            description: 'Updated Campaign A',
        };

        const resA = await request(app)
            .put(`/api/campaigns/${campaignA}/settlements/Riverwood`)
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
            .put(`/api/campaigns/${campaignB}/settlements/Riverwood`)
            .send(updatedB);

        expect(resB.status).toBe(200);
        expect(resB.body.settlement.type).toBe('metropolis');

        // Verify files are separate
        const fileDataA = mockFsData.get(filePathA);
        const fileDataB = mockFsData.get(filePathB);

        expect(fileDataA[0].type).toBe('town');
        expect(fileDataB[0].type).toBe('metropolis');
    });

    it('should return 500 when file contains invalid JSON', async () => {
        const campaign = 'real-fs-invalid-json';
        const filePath = getFilePath(campaign);
        // Store raw string (invalid JSON) so readFileSync returns it as-is
        mockFsData.set(filePath, 'this is not valid json');
        mockFsRawStrings.add(filePath);

        const settlementData = {
            name: 'Riverwood',
            type: 'village',
            population: 100,
        };

        const app = createTestApp();
        const res = await request(app)
            .put(`/api/campaigns/${campaign}/settlements/Riverwood`)
            .send(settlementData);

        expect(res.status).toBe(500);
        expect(res.body).toHaveProperty('error');
    });

    it('should handle empty array in existing file', async () => {
        const campaign = 'real-fs-empty-array';
        const filePath = getFilePath(campaign);
        mockFsData.set(filePath, []);

        const settlementData = {
            name: 'Riverwood',
            type: 'village',
            population: 100,
            description: 'A small village',
        };

        const app = createTestApp();
        const res = await request(app)
            .put(`/api/campaigns/${campaign}/settlements/Riverwood`)
            .send(settlementData);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const fileData = mockFsData.get(filePath);
        expect(fileData).toHaveLength(1);
        expect(fileData[0]).toEqual(settlementData);
    });

    it('should handle non-array data in file by treating it as empty array', async () => {
        const campaign = 'real-fs-non-array';
        const filePath = getFilePath(campaign);
        // Simulate a corrupted file with non-array data
        mockFsData.set(filePath, { name: 'corrupted' });

        const settlementData = {
            name: 'Riverwood',
            type: 'village',
            population: 100,
            description: 'A small village',
        };

        const app = createTestApp();
        const res = await request(app)
            .put(`/api/campaigns/${campaign}/settlements/Riverwood`)
            .send(settlementData);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const fileData = mockFsData.get(filePath);
        expect(fileData).toHaveLength(1);
        expect(fileData[0]).toEqual(settlementData);
    });
});
