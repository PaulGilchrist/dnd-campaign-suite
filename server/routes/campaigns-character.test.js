import request from 'supertest';
import express from 'express';
import fs from 'fs';
import path from 'path';
import campaignsCharacter from './campaigns-character.js';

// Create a test app with the routes
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(campaignsCharacter);
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

describe('campaignsCharacter - GET /api/campaigns/:campaign/:file', () => {
    beforeEach(ensureCampaignsDir);
    afterEach(() => {
        cleanupCampaign('test-campaign');
    });

    it('should return 404 for a non-existent character file', async () => {
        createCampaignDir('test-campaign');

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/nonexistent.json');

        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('Character file not found');
    });

    it('should return character data for an existing file', async () => {
        const campaignDir = createCampaignDir('test-campaign');
        const characterData = { name: 'Thorin', class: 'Fighter', level: 5 };
        fs.writeFileSync(
            path.join(campaignDir, 'Thorin.json'),
            JSON.stringify(characterData)
        );

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/Thorin.json');

        expect(res.status).toBe(200);
        expect(res.body).toEqual(characterData);
    });

    it('should skip route for "log" filename', async () => {
        createCampaignDir('test-campaign');

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/log');

        expect(res.status).toBe(404);
    });

    it('should skip route for non-.json files', async () => {
        createCampaignDir('test-campaign');

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/file.txt');

        expect(res.status).toBe(404);
    });

    it('should return 500 on filesystem read error', async () => {
        const campaignDir = createCampaignDir('test-campaign');
        const characterData = { name: 'Thorin' };
        const filePath = path.join(campaignDir, 'Thorin.json');
        fs.writeFileSync(filePath, JSON.stringify(characterData));

        const app = createTestApp();

        const originalReadFileSync = fs.readFileSync;
        fs.readFileSync = vi.fn(() => {
            throw new Error('EACCES');
        });

        const res = await request(app).get('/api/campaigns/test-campaign/Thorin.json');

        expect(res.status).toBe(500);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('Failed to read character file');

        fs.readFileSync = originalReadFileSync;
    });
});

describe('campaignsCharacter - PUT /api/campaigns/:campaign/:file', () => {
    beforeEach(ensureCampaignsDir);
    afterEach(() => {
        cleanupCampaign('test-campaign');
    });

    it('should skip route for "log" filename', async () => {
        createCampaignDir('test-campaign');

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/log')
            .send({ name: 'Updated' });

        expect(res.status).toBe(404);
    });

    it('should skip route for non-.json files', async () => {
        createCampaignDir('test-campaign');

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/file.txt')
            .send({ name: 'Updated' });

        expect(res.status).toBe(404);
    });

    it('should return 404 when file does not exist', async () => {
        createCampaignDir('test-campaign');

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/nonexistent.json')
            .send({ name: 'Updated' });

        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('Character file not found');
    });

    it('should update an existing character file', async () => {
        const campaignDir = createCampaignDir('test-campaign');
        const originalData = { name: 'Thorin', class: 'Fighter', level: 5 };
        fs.writeFileSync(
            path.join(campaignDir, 'Thorin.json'),
            JSON.stringify(originalData)
        );

        const updatedData = { name: 'Thorin', class: 'Fighter', level: 10 };
        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/Thorin.json')
            .send(updatedData);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('message');
        expect(res.body.message).toBe('Character updated successfully');

        // Verify file was updated on disk
        const savedData = JSON.parse(
            fs.readFileSync(path.join(campaignDir, 'Thorin.json'), 'utf-8')
        );
        expect(savedData).toEqual(updatedData);
    });

    it('should return 404 when renaming and original file does not exist', async () => {
        createCampaignDir('test-campaign');

        const renamedData = {
            name: 'NewName',
            class: 'Fighter',
            originalFileName: 'NonExistent.json'
        };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/NewName.json')
            .send(renamedData);

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Character file not found');
    });

    it('should rename a character file when originalFileName differs from file', async () => {
        const campaignDir = createCampaignDir('test-campaign');
        const originalData = { name: 'OldName', class: 'Fighter', level: 5 };
        const originalFilePath = path.join(campaignDir, 'OldName.json');
        fs.writeFileSync(originalFilePath, JSON.stringify(originalData));

        const renamedData = {
            name: 'NewName',
            class: 'Fighter',
            level: 5,
            originalFileName: 'OldName.json'
        };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/NewName.json')
            .send(renamedData);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('message');
        expect(res.body.message).toBe('Character updated successfully');

        // Verify old file was deleted
        expect(fs.existsSync(originalFilePath)).toBe(false);

        // Verify new file was created
        const newFilePath = path.join(campaignDir, 'NewName.json');
        expect(fs.existsSync(newFilePath)).toBe(true);

        const savedData = JSON.parse(
            fs.readFileSync(newFilePath, 'utf-8')
        );
        expect(savedData.name).toBe('NewName');
    });

    it('should delete the original character file during rename', async () => {
        const campaignDir = createCampaignDir('test-campaign');
        const originalData = { name: 'OldName', class: 'Fighter' };
        const originalFilePath = path.join(campaignDir, 'OldName.json');
        fs.writeFileSync(originalFilePath, JSON.stringify(originalData));

        const renamedData = {
            name: 'NewName',
            class: 'Fighter',
            originalFileName: 'OldName.json'
        };

        const app = createTestApp();
        await request(app)
            .put('/api/campaigns/test-campaign/NewName.json')
            .send(renamedData);

        expect(fs.existsSync(originalFilePath)).toBe(false);
    });

    it('should write updated data to the new filename after rename', async () => {
        const campaignDir = createCampaignDir('test-campaign');
        const originalData = { name: 'OldName', class: 'Fighter', level: 3 };
        const originalFilePath = path.join(campaignDir, 'OldName.json');
        fs.writeFileSync(originalFilePath, JSON.stringify(originalData));

        const renamedData = {
            name: 'NewName',
            class: 'Mage',
            level: 7,
            originalFileName: 'OldName.json'
        };

        const app = createTestApp();
        await request(app)
            .put('/api/campaigns/test-campaign/NewName.json')
            .send(renamedData);

        const newFilePath = path.join(campaignDir, 'NewName.json');
        const savedData = JSON.parse(
            fs.readFileSync(newFilePath, 'utf-8')
        );
        expect(savedData).toEqual(renamedData);
    });

    it('should return 500 on filesystem write error', async () => {
        const campaignDir = createCampaignDir('test-campaign');
        const originalData = { name: 'Thorin', class: 'Fighter' };
        fs.writeFileSync(
            path.join(campaignDir, 'Thorin.json'),
            JSON.stringify(originalData)
        );

        const app = createTestApp();

        const originalWriteFileSync = fs.writeFileSync;
        fs.writeFileSync = vi.fn(() => {
            throw new Error('EACCES');
        });

        const res = await request(app)
            .put('/api/campaigns/test-campaign/Thorin.json')
            .send({ name: 'Thorin', class: 'Fighter' });

        expect(res.status).toBe(500);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('Failed to update character');

        fs.writeFileSync = originalWriteFileSync;
    });

    it('should handle image deletion when imagePath is cleared', async () => {
        const campaignDir = createCampaignDir('test-campaign');
        const originalData = {
            name: 'Thorin',
            class: 'Fighter',
            imagePath: 'campaigns/test-campaign/images/thorin.png'
        };
        fs.writeFileSync(
            path.join(campaignDir, 'Thorin.json'),
            JSON.stringify(originalData)
        );

        const updatedData = {
            name: 'Thorin',
            class: 'Fighter',
            imagePath: ''
        };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/Thorin.json')
            .send(updatedData);

        expect(res.status).toBe(200);

        // Verify imagePath was cleared
        const savedData = JSON.parse(
            fs.readFileSync(path.join(campaignDir, 'Thorin.json'), 'utf-8')
        );
        expect(savedData.imagePath).toBe('');
    });

    it('should handle image upload when image and imageName are present', async () => {
        const campaignDir = createCampaignDir('test-campaign');
        const imagesDir = path.join(campaignDir, 'images');
        fs.mkdirSync(imagesDir, { recursive: true });

        const originalData = { name: 'Thorin', class: 'Fighter' };
        fs.writeFileSync(
            path.join(campaignDir, 'Thorin.json'),
            JSON.stringify(originalData)
        );

        const updatedData = {
            name: 'Thorin',
            class: 'Fighter',
            image: 'data:image/png;base64,iVBORw==',
            imageName: 'thorin.png'
        };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/Thorin.json')
            .send(updatedData);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('message');

        // Verify image file was created
        const imageFilePath = path.join(imagesDir, 'thorin.png');
        expect(fs.existsSync(imageFilePath)).toBe(true);

        // Verify imagePath was set
        const savedData = JSON.parse(
            fs.readFileSync(path.join(campaignDir, 'Thorin.json'), 'utf-8')
        );
        expect(savedData.imagePath).toBe('campaigns/test-campaign/images/Thorin.png');

        // Verify image and imageName fields were removed
        expect(savedData.image).toBeUndefined();
        expect(savedData.imageName).toBeUndefined();
    });
});

describe('campaignsCharacter - DELETE /api/campaigns/:campaign/:file', () => {
    beforeEach(ensureCampaignsDir);
    afterEach(() => {
        cleanupCampaign('test-campaign');
    });

    it('should skip route for "log" filename', async () => {
        createCampaignDir('test-campaign');

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-campaign/log');

        expect(res.status).toBe(404);
    });

    it('should skip route for non-.json files', async () => {
        createCampaignDir('test-campaign');

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-campaign/file.txt');

        expect(res.status).toBe(404);
    });

    it('should return 404 for a non-existent character file', async () => {
        createCampaignDir('test-campaign');

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-campaign/nonexistent.json');

        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('Character file not found');
    });

    it('should delete a character file', async () => {
        const campaignDir = createCampaignDir('test-campaign');
        const characterData = { name: 'Thorin', class: 'Fighter' };
        const filePath = path.join(campaignDir, 'Thorin.json');
        fs.writeFileSync(filePath, JSON.stringify(characterData));

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-campaign/Thorin.json');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('message');
        expect(res.body.message).toBe('Character deleted successfully');

        // Verify the file was deleted
        expect(fs.existsSync(filePath)).toBe(false);
    });

    it('should delete the associated image file when imagePath exists', async () => {
        const campaignDir = createCampaignDir('test-campaign');
        const imagesDir = path.join(campaignDir, 'images');
        fs.mkdirSync(imagesDir, { recursive: true });

        const characterData = {
            name: 'Thorin',
            class: 'Fighter',
            imagePath: 'campaigns/test-campaign/images/thorin.png'
        };
        const filePath = path.join(campaignDir, 'Thorin.json');
        fs.writeFileSync(filePath, JSON.stringify(characterData));

        // Create the image file
        const imageFilePath = path.join(imagesDir, 'thorin.png');
        fs.writeFileSync(imageFilePath, 'fake image data');

        const app = createTestApp();
        await request(app).delete('/api/campaigns/test-campaign/Thorin.json');

        // Verify both the character file and image were deleted
        expect(fs.existsSync(filePath)).toBe(false);
        expect(fs.existsSync(imageFilePath)).toBe(false);
    });

    it('should not fail when deleting character without an image', async () => {
        const campaignDir = createCampaignDir('test-campaign');
        const characterData = { name: 'Thorin', class: 'Fighter' };
        const filePath = path.join(campaignDir, 'Thorin.json');
        fs.writeFileSync(filePath, JSON.stringify(characterData));

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-campaign/Thorin.json');

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Character deleted successfully');
    });

    it('should return 500 on filesystem delete error', async () => {
        const campaignDir = createCampaignDir('test-campaign');
        const characterData = { name: 'Thorin', class: 'Fighter' };
        const filePath = path.join(campaignDir, 'Thorin.json');
        fs.writeFileSync(filePath, JSON.stringify(characterData));

        const app = createTestApp();

        const originalUnlinkSync = fs.unlinkSync;
        fs.unlinkSync = vi.fn(() => {
            throw new Error('EACCES');
        });

        const res = await request(app).delete('/api/campaigns/test-campaign/Thorin.json');

        expect(res.status).toBe(500);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('Failed to delete character');

        fs.unlinkSync = originalUnlinkSync;
    });
});

describe('campaignsCharacter - POST /api/campaigns/:campaign', () => {
    beforeEach(ensureCampaignsDir);
    afterEach(() => {
        cleanupCampaign('test-campaign');
    });

    it('should return 400 when character is missing but campaign param exists', async () => {
        const app = createTestApp();
        const res = await request(app).post('/api/campaigns/test-campaign-missing').send({});

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('Campaign and character data are required');
    });

    it('should return 400 when character is missing', async () => {
        const app = createTestApp();
        const res = await request(app).post('/api/campaigns/test-campaign').send({});

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('Campaign and character data are required');
    });

    it('should return 404 when campaign directory does not exist', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/nonexistent-campaign')
            .send({ character: { name: 'Thorin' } });

        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('Campaign not found');
    });

    it('should create a new character file with sanitized filename', async () => {
        createCampaignDir('test-campaign');

        const characterData = { name: 'Thorin', class: 'Fighter', level: 5 };

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign')
            .send({ character: characterData });

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('message');
        expect(res.body.message).toBe('Character created successfully');
        expect(res.body).toHaveProperty('fileName');
        expect(res.body.fileName).toBe('Thorin.json');

        // Verify the file was created
        const campaignDir = path.join(testCampaignsDir, 'test-campaign');
        const filePath = path.join(campaignDir, 'Thorin.json');
        expect(fs.existsSync(filePath)).toBe(true);

        const savedData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        expect(savedData.name).toBe('Thorin');
        expect(savedData._fileName).toBe('Thorin.json');
    });

    it('should sanitize special characters in character name for filename', async () => {
        createCampaignDir('test-campaign');

        const characterData = { name: 'Thorin Oakenshield!', class: 'Fighter' };

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign')
            .send({ character: characterData });

        expect(res.status).toBe(201);
        expect(res.body.fileName).toBe('Thorin_Oakenshield_.json');

        const campaignDir = path.join(testCampaignsDir, 'test-campaign');
        const filePath = path.join(campaignDir, 'Thorin_Oakenshield_.json');
        expect(fs.existsSync(filePath)).toBe(true);
    });

    it('should handle image upload during character creation', async () => {
        createCampaignDir('test-campaign');
        const imagesDir = path.join(testCampaignsDir, 'test-campaign', 'images');
        fs.mkdirSync(imagesDir, { recursive: true });

        const characterData = {
            name: 'Thorin',
            class: 'Fighter',
            image: 'data:image/png;base64,iVBORw==',
            imageName: 'thorin.png'
        };

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign')
            .send({ character: characterData });

        expect(res.status).toBe(201);

        // Verify image file was created
        const imageFilePath = path.join(imagesDir, 'thorin.png');
        expect(fs.existsSync(imageFilePath)).toBe(true);

        // Verify imagePath was set in the character data
        const campaignDir = path.join(testCampaignsDir, 'test-campaign');
        const filePath = path.join(campaignDir, 'Thorin.json');
        const savedData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        expect(savedData.imagePath).toBe('campaigns/test-campaign/images/Thorin.png');

        // Verify image and imageName fields were removed
        expect(savedData.image).toBeUndefined();
        expect(savedData.imageName).toBeUndefined();
    });

    it('should return 500 on filesystem write error', async () => {
        createCampaignDir('test-campaign');

        const characterData = { name: 'Thorin', class: 'Fighter' };

        const app = createTestApp();

        const originalWriteFileSync = fs.writeFileSync;
        fs.writeFileSync = vi.fn(() => {
            throw new Error('EACCES');
        });

        const res = await request(app)
            .post('/api/campaigns/test-campaign')
            .send({ character: characterData });

        expect(res.status).toBe(500);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('Failed to create character');

        fs.writeFileSync = originalWriteFileSync;
    });
});
