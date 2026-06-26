import request from 'supertest';
import express from 'express';
import fs from 'fs';
import path from 'path';
import campaignsAdmin from './campaigns-admin.js';

// Create a test app with the routes
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(campaignsAdmin);
    return app;
}

// Test file system helpers
const testCampaignsDir = path.join(process.cwd(), 'public', 'campaigns');

function cleanupCampaign(name) {
    const campaignDir = path.join(testCampaignsDir, name);
    if (fs.existsSync(campaignDir)) {
        fs.rmSync(campaignDir, { recursive: true, force: true });
    }
}

function ensureCampaignsDir() {
    if (!fs.existsSync(testCampaignsDir)) {
        fs.mkdirSync(testCampaignsDir, { recursive: true });
    }
}

describe('campaignsAdmin - POST /api/campaigns', () => {
    beforeEach(ensureCampaignsDir);
    afterEach(() => {
        cleanupCampaign('test-campaign');
        cleanupCampaign('test-campaign-existing');
        cleanupCampaign('campaign-with-spaces');
        cleanupCampaign('trimmed');
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
        expect(fs.existsSync(path.join(testCampaignsDir, 'test-campaign'))).toBe(true);
    });

    it('should create maps, images, and data subdirectories', async () => {
        const app = createTestApp();
        await request(app).post('/api/campaigns').send({ campaignName: 'test-campaign' });
        expect(fs.existsSync(path.join(testCampaignsDir, 'test-campaign', 'maps'))).toBe(true);
        expect(fs.existsSync(path.join(testCampaignsDir, 'test-campaign', 'images'))).toBe(true);
        expect(fs.existsSync(path.join(testCampaignsDir, 'test-campaign', 'data'))).toBe(true);
    });

    it('should trim whitespace from campaign name', async () => {
        const app = createTestApp();
        const res = await request(app).post('/api/campaigns').send({ campaignName: '  trimmed  ' });
        expect(res.status).toBe(201);
        expect(res.body.campaignName).toBe('trimmed');
        expect(fs.existsSync(path.join(testCampaignsDir, 'trimmed'))).toBe(true);
    });

    it('should return 400 when campaign already exists', async () => {
        const app = createTestApp();
        await request(app).post('/api/campaigns').send({ campaignName: 'test-campaign-existing' });
        const res = await request(app).post('/api/campaigns').send({ campaignName: 'test-campaign-existing' });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Campaign already exists');
    });

    it('should return 500 on filesystem error', async () => {
        const app = createTestApp();
        // Mock fs.mkdirSync to throw
        const originalMkdirSync = fs.mkdirSync;
        fs.mkdirSync = vi.fn(() => {
            throw new Error('Disk full');
        });
        const res = await request(app).post('/api/campaigns').send({ campaignName: 'test-campaign' });
        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Failed to create campaign');
        fs.mkdirSync = originalMkdirSync;
    });
});

describe('campaignsAdmin - PUT /api/campaigns/:campaign', () => {
    beforeEach(ensureCampaignsDir);
    afterEach(() => {
        cleanupCampaign('old-campaign');
        cleanupCampaign('new-campaign');
        cleanupCampaign('rename-test');
        cleanupCampaign('existing-name');
        cleanupCampaign('new-name');
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
        fs.mkdirSync(path.join(testCampaignsDir, 'old-campaign'), { recursive: true });
        fs.mkdirSync(path.join(testCampaignsDir, 'existing-name'), { recursive: true });
        const res = await request(app).put('/api/campaigns/old-campaign').send({ newName: 'existing-name' });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Campaign already exists');
    });

    it('should rename the campaign directory', async () => {
        const app = createTestApp();
        fs.mkdirSync(path.join(testCampaignsDir, 'old-campaign'), { recursive: true });
        const res = await request(app).put('/api/campaigns/old-campaign').send({ newName: 'new-campaign' });
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Campaign renamed successfully');
        expect(res.body.campaignName).toBe('new-campaign');
        expect(fs.existsSync(path.join(testCampaignsDir, 'old-campaign'))).toBe(false);
        expect(fs.existsSync(path.join(testCampaignsDir, 'new-campaign'))).toBe(true);
    });

    it('should trim whitespace from new name', async () => {
        const app = createTestApp();
        fs.mkdirSync(path.join(testCampaignsDir, 'rename-test'), { recursive: true });
        const res = await request(app).put('/api/campaigns/rename-test').send({ newName: '  new-name  ' });
        expect(res.status).toBe(200);
        expect(res.body.campaignName).toBe('new-name');
        expect(fs.existsSync(path.join(testCampaignsDir, 'new-name'))).toBe(true);
    });

    it('should return 500 on filesystem error', async () => {
        const app = createTestApp();
        fs.mkdirSync(path.join(testCampaignsDir, 'old-campaign'), { recursive: true });
        const originalRenameSync = fs.renameSync;
        fs.renameSync = vi.fn(() => {
            throw new Error('Permission denied');
        });
        const res = await request(app).put('/api/campaigns/old-campaign').send({ newName: 'new-campaign' });
        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Failed to rename campaign');
        fs.renameSync = originalRenameSync;
    });
});

describe('campaignsAdmin - DELETE /api/campaigns/:campaign', () => {
    beforeEach(ensureCampaignsDir);
    afterEach(() => {
        cleanupCampaign('delete-test');
    });

    it('should return 404 when campaign does not exist', async () => {
        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/nonexistent');
        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Campaign not found');
    });

    it('should delete the campaign directory and all contents', async () => {
        const app = createTestApp();
        const campaignDir = path.join(testCampaignsDir, 'delete-test');
        fs.mkdirSync(path.join(campaignDir, 'maps'), { recursive: true });
        fs.mkdirSync(path.join(campaignDir, 'images'), { recursive: true });
        fs.writeFileSync(path.join(campaignDir, 'test-file.txt'), 'content');
        fs.writeFileSync(path.join(campaignDir, 'maps', 'map1.json'), '{}');

        const res = await request(app).delete('/api/campaigns/delete-test');
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Campaign deleted successfully');
        expect(fs.existsSync(campaignDir)).toBe(false);
    });

    it('should return 500 on filesystem error', async () => {
        const app = createTestApp();
        fs.mkdirSync(path.join(testCampaignsDir, 'delete-test'), { recursive: true });
        const originalRmSync = fs.rmSync;
        fs.rmSync = vi.fn(() => {
            throw new Error('Permission denied');
        });
        const res = await request(app).delete('/api/campaigns/delete-test');
        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Failed to delete campaign');
        fs.rmSync = originalRmSync;
    });
});
