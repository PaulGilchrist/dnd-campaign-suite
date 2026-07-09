import request from 'supertest';
import express from 'express';
import campaignsAdmin from './campaigns-admin.js';

// Create a test app with the routes
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(campaignsAdmin);
    return app;
}

// Mock filesystem state
const mockFsState = {
    exists: new Set(),
};

vi.mock('fs', () => ({
    default: {
        existsSync: vi.fn((path) => mockFsState.exists.has(path)),
        mkdirSync: vi.fn((path) => {
            mockFsState.exists.add(path);
        }),
        renameSync: vi.fn((oldPath, newPath) => {
            if (mockFsState.exists.has(oldPath)) {
                mockFsState.exists.delete(oldPath);
            }
            mockFsState.exists.add(newPath);
        }),
        rmSync: vi.fn((path) => {
            mockFsState.exists.delete(path);
        }),
        writeFileSync: vi.fn(),
        readdirSync: vi.fn(() => []),
        readFileSync: vi.fn(() => '{}'),
        statSync: vi.fn(),
    },
    existsSync: vi.fn((path) => mockFsState.exists.has(path)),
    mkdirSync: vi.fn((path) => {
        mockFsState.exists.add(path);
    }),
    renameSync: vi.fn((oldPath, newPath) => {
        if (mockFsState.exists.has(oldPath)) {
            mockFsState.exists.delete(oldPath);
        }
        mockFsState.exists.add(newPath);
    }),
    rmSync: vi.fn((path) => {
        mockFsState.exists.delete(path);
    }),
    writeFileSync: vi.fn(),
    readdirSync: vi.fn(() => []),
    readFileSync: vi.fn(() => '{}'),
    statSync: vi.fn(),
}));

vi.mock('../utils/campaignPaths.js', () => ({
    campaignDir: (name) => `/mock/campaigns/${name}`,
    campaignMapsDir: (name) => `/mock/campaigns/${name}/maps`,
    campaignImagesDir: (name) => `/mock/campaigns/${name}/images`,
    campaignDataDir: (name) => `/mock/campaigns/${name}/data`,
    campaignDataFile: (campaign, fileName) => `/mock/campaigns/${campaign}/data/${fileName}`,
}));

vi.mock('../utils/changeData.js', () => ({
    characterChangeData: new Map(),
    spellOverlayData: new Map(),
    activeMaps: new Map(),
    saveFile: vi.fn(),
    markDirty: vi.fn(),
}));

function ensureCampaign(name) {
    mockFsState.exists.add(`/mock/campaigns/${name}`);
}

function removeCampaign(name) {
    mockFsState.exists.delete(`/mock/campaigns/${name}`);
}

describe('campaignsAdmin - POST /api/campaigns', () => {
    afterEach(() => {
        removeCampaign('test-campaign');
        removeCampaign('test-campaign-existing');
        removeCampaign('campaign-with-spaces');
        removeCampaign('trimmed');
    });

    it('should return 400 when campaignName is missing', async () => {
        const app = createTestApp();
        const res = await request(app).post('/api/campaigns').send({});
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Campaign name is required');
    });

    it('should return 400 when campaignName is empty string', async () => {
        const app = createTestApp();
        const res = await request(app).post('/api/campaigns').send({ campaignName: '' });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Campaign name is required');
    });

    it('should return 400 when campaignName is whitespace only', async () => {
        const app = createTestApp();
        const res = await request(app).post('/api/campaigns').send({ campaignName: '   ' });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Campaign name is required');
    });

    it('should create a campaign directory with valid name', async () => {
        const app = createTestApp();
        const res = await request(app).post('/api/campaigns').send({ campaignName: 'test-campaign' });
        expect(res.status).toBe(201);
        expect(res.body.message).toBe('Campaign created successfully');
        expect(res.body.campaignName).toBe('test-campaign');
        expect(mockFsState.exists.has('/mock/campaigns/test-campaign')).toBe(true);
    });

    it('should create maps, images, and data subdirectories', async () => {
        const app = createTestApp();
        await request(app).post('/api/campaigns').send({ campaignName: 'test-campaign' });
        expect(mockFsState.exists.has('/mock/campaigns/test-campaign/maps')).toBe(true);
        expect(mockFsState.exists.has('/mock/campaigns/test-campaign/images')).toBe(true);
        expect(mockFsState.exists.has('/mock/campaigns/test-campaign/data')).toBe(true);
    });

    it('should trim whitespace from campaign name', async () => {
        const app = createTestApp();
        const res = await request(app).post('/api/campaigns').send({ campaignName: '  trimmed  ' });
        expect(res.status).toBe(201);
        expect(res.body.campaignName).toBe('trimmed');
        expect(mockFsState.exists.has('/mock/campaigns/trimmed')).toBe(true);
    });

    it('should return 400 when campaign already exists', async () => {
        const app = createTestApp();
        ensureCampaign('test-campaign-existing');
        const res = await request(app).post('/api/campaigns').send({ campaignName: 'test-campaign-existing' });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Campaign already exists');
    });

    it('should return 500 on filesystem error', async () => {
        const app = createTestApp();
        const fsMock = (await import('fs')).default;
        fsMock.mkdirSync = () => {
            throw new Error('Disk full');
        };
        const res = await request(app).post('/api/campaigns').send({ campaignName: 'test-campaign' });
        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Disk full');
    });
});

describe('campaignsAdmin - PUT /api/campaigns/:campaign', () => {
    afterEach(() => {
        removeCampaign('old-campaign');
        removeCampaign('new-campaign');
        removeCampaign('rename-test');
        removeCampaign('existing-name');
        removeCampaign('new-name');
    });

    it('should return 400 when newName is missing', async () => {
        const app = createTestApp();
        const res = await request(app).put('/api/campaigns/old-campaign').send({});
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('New campaign name is required');
    });

    it('should return 400 when newName is empty string', async () => {
        const app = createTestApp();
        const res = await request(app).put('/api/campaigns/old-campaign').send({ newName: '' });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('New campaign name is required');
    });

    it('should return 400 when newName is whitespace only', async () => {
        const app = createTestApp();
        const res = await request(app).put('/api/campaigns/old-campaign').send({ newName: '   ' });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('New campaign name is required');
    });

    it('should return 404 when campaign does not exist', async () => {
        const app = createTestApp();
        const res = await request(app).put('/api/campaigns/nonexistent').send({ newName: 'new-campaign' });
        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Campaign not found');
    });

    it('should return 400 when new name already exists', async () => {
        const app = createTestApp();
        ensureCampaign('old-campaign');
        ensureCampaign('existing-name');
        const res = await request(app).put('/api/campaigns/old-campaign').send({ newName: 'existing-name' });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Campaign already exists');
    });

    it('should rename the campaign directory', async () => {
        const app = createTestApp();
        ensureCampaign('old-campaign');
        const res = await request(app).put('/api/campaigns/old-campaign').send({ newName: 'new-campaign' });
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Campaign renamed successfully');
        expect(res.body.campaignName).toBe('new-campaign');
        expect(mockFsState.exists.has('/mock/campaigns/old-campaign')).toBe(false);
        expect(mockFsState.exists.has('/mock/campaigns/new-campaign')).toBe(true);
    });

    it('should trim whitespace from new name', async () => {
        const app = createTestApp();
        ensureCampaign('rename-test');
        const res = await request(app).put('/api/campaigns/rename-test').send({ newName: '  new-name  ' });
        expect(res.status).toBe(200);
        expect(res.body.campaignName).toBe('new-name');
        expect(mockFsState.exists.has('/mock/campaigns/new-name')).toBe(true);
    });

    it('should return 500 on filesystem error', async () => {
        const app = createTestApp();
        ensureCampaign('old-campaign');
        const fsMock = (await import('fs')).default;
        fsMock.renameSync = () => {
            throw new Error('Permission denied');
        };
        const res = await request(app).put('/api/campaigns/old-campaign').send({ newName: 'new-campaign' });
        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Permission denied');
    });
});

describe('campaignsAdmin - DELETE /api/campaigns/:campaign', () => {
    afterEach(() => {
        removeCampaign('delete-test');
    });

    it('should return 404 when campaign does not exist', async () => {
        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/nonexistent');
        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Campaign not found');
    });

    it('should delete the campaign directory and all contents', async () => {
        const app = createTestApp();
        ensureCampaign('delete-test');
        const res = await request(app).delete('/api/campaigns/delete-test');
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Campaign deleted successfully');
        expect(mockFsState.exists.has('/mock/campaigns/delete-test')).toBe(false);
    });

    it('should return 500 on filesystem error', async () => {
        const app = createTestApp();
        ensureCampaign('delete-test');
        const fsMock = (await import('fs')).default;
        fsMock.rmSync = () => {
            throw new Error('Permission denied');
        };
        const res = await request(app).delete('/api/campaigns/delete-test');
        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Permission denied');
    });
});
