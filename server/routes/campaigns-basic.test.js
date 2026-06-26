import request from 'supertest';
import express from 'express';
import fs from 'fs';
import path from 'path';
import campaignsBasic from './campaigns-basic.js';

// Create a test app with the routes
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(campaignsBasic);
    return app;
}

const testCampaignsDir = path.join(process.cwd(), 'public', 'campaigns');

function ensureCampaignsDir() {
    if (!fs.existsSync(testCampaignsDir)) {
        fs.mkdirSync(testCampaignsDir, { recursive: true });
    }
}

function createCampaignDir(name) {
    const campaignDir = path.join(testCampaignsDir, name);
    if (!fs.existsSync(campaignDir)) {
        fs.mkdirSync(campaignDir, { recursive: true });
    }
    return campaignDir;
}

function removeCampaignDir(name) {
    const campaignDir = path.join(testCampaignsDir, name);
    if (fs.existsSync(campaignDir)) {
        fs.rmSync(campaignDir, { recursive: true, force: true });
    }
}

function cleanupCampaign(name) {
    removeCampaignDir(name);
}

describe('campaignsBasic - GET /api/campaigns', () => {
    beforeEach(ensureCampaignsDir);
    afterEach(() => {
        cleanupCampaign('test-campaign-a');
        cleanupCampaign('test-campaign-b');
        cleanupCampaign('test-campaign-c');
    });

    it('should return a list of campaign folder names', async () => {
        createCampaignDir('test-campaign-a');
        createCampaignDir('test-campaign-b');

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('folders');
        expect(Array.isArray(res.body.folders)).toBe(true);
        expect(res.body.folders).toContain('test-campaign-a');
        expect(res.body.folders).toContain('test-campaign-b');
    });

    it('should return folders sorted alphabetically', async () => {
        createCampaignDir('test-campaign-c');
        createCampaignDir('test-campaign-a');
        createCampaignDir('test-campaign-b');

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns');

        expect(res.status).toBe(200);
        const folders = res.body.folders;
        const sorted = [...folders].sort();
        expect(folders).toEqual(sorted);
    });

    it('should only return directories, not files', async () => {
        createCampaignDir('test-campaign-a');
        // Create a file directly in the campaigns directory
        const filePath = path.join(testCampaignsDir, 'schema.json');
        fs.writeFileSync(filePath, '{}');

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns');

        expect(res.status).toBe(200);
        expect(res.body.folders).not.toContain('schema.json');
        expect(res.body.folders).toContain('test-campaign-a');

        // Cleanup
        fs.unlinkSync(filePath);
    });

    it('should return an empty folders array when no campaigns exist', async () => {
        const app = createTestApp();
        const res = await request(app).get('/api/campaigns');

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.folders)).toBe(true);
    });

    it('should return 500 when campaigns directory does not exist', async () => {
        const app = createTestApp();

        const originalReaddirSync = fs.readdirSync;
        fs.readdirSync = vi.fn(() => {
            throw new Error('ENOENT');
        });

        const res = await request(app).get('/api/campaigns');

        expect(res.status).toBe(500);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('Failed to read campaigns directory');

        fs.readdirSync = originalReaddirSync;
    });
});

describe('campaignsBasic - GET /api/campaigns/:campaign', () => {
    beforeEach(ensureCampaignsDir);
    afterEach(() => {
        cleanupCampaign('test-campaign');
    });

    it('should return json files in a campaign directory', async () => {
        const campaignDir = createCampaignDir('test-campaign');
        fs.writeFileSync(path.join(campaignDir, 'character1.json'), '{}');
        fs.writeFileSync(path.join(campaignDir, 'character2.json'), '{}');

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('files');
        expect(Array.isArray(res.body.files)).toBe(true);
        expect(res.body.files).toContain('character1.json');
        expect(res.body.files).toContain('character2.json');
    });

    it('should return files sorted alphabetically', async () => {
        const campaignDir = createCampaignDir('test-campaign');
        fs.writeFileSync(path.join(campaignDir, 'zebra.json'), '{}');
        fs.writeFileSync(path.join(campaignDir, 'alpha.json'), '{}');
        fs.writeFileSync(path.join(campaignDir, 'middle.json'), '{}');

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign');

        expect(res.status).toBe(200);
        const files = res.body.files;
        const sorted = [...files].sort();
        expect(files).toEqual(sorted);
    });

    it('should only return .json files, not other file types', async () => {
        const campaignDir = createCampaignDir('test-campaign');
        fs.writeFileSync(path.join(campaignDir, 'character.json'), '{}');
        fs.writeFileSync(path.join(campaignDir, 'character.txt'), 'content');
        fs.writeFileSync(path.join(campaignDir, 'data.csv'), 'a,b,c');

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign');

        expect(res.status).toBe(200);
        expect(res.body.files).toContain('character.json');
        expect(res.body.files).not.toContain('character.txt');
        expect(res.body.files).not.toContain('data.csv');
    });

    it('should return an empty files array when campaign has no json files', async () => {
        createCampaignDir('test-campaign');

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign');

        expect(res.status).toBe(200);
        expect(res.body.files).toEqual([]);
    });

    it('should return 404 when campaign directory does not exist', async () => {
        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/nonexistent-campaign');

        expect(res.status).toBe(500);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('Failed to read campaign directory');
    });

    it('should return 500 on filesystem error', async () => {
        createCampaignDir('test-campaign');
        const app = createTestApp();

        const originalReadDirSync = fs.readdirSync;
        fs.readdirSync = vi.fn(() => {
            throw new Error('Permission denied');
        });

        const res = await request(app).get('/api/campaigns/test-campaign');

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Failed to read campaign directory');

        fs.readdirSync = originalReadDirSync;
    });
});
