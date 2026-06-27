import request from 'supertest';
import express from 'express';
import campaignsCharacter from './campaigns-character.js';

// vi.mock factory creates mock fs inline — no helper needed

vi.mock('fs', () => {
    // Reuse the same mockFs reference
    const m = {
        existsSync: vi.fn(),
        readFileSync: vi.fn(),
        writeFileSync: vi.fn(),
        unlinkSync: vi.fn(),
        renameSync: vi.fn(),
    };
    // Store on a module-level variable that tests can access
    globalThis._mockFs = m;
    return {
        default: m,
        ...m,
    };
});

// Mock campaignPaths
vi.mock('../utils/campaignPaths.js', () => ({
    campaignDir: vi.fn((campaign) => `/mock/campaigns/${campaign}`),
    campaignImagesDir: vi.fn((campaign) => `/mock/campaigns/${campaign}/images`),
}));

// Mock imageUtils
vi.mock('../utils/imageUtils.js', () => ({
    processImageUpload: vi.fn(),
    deleteCharacterImage: vi.fn(),
}));

// Mock changeData
vi.mock('../utils/changeData.js', () => ({
    publish: vi.fn(),
    removeChangeDataKey: vi.fn(),
}));

// Get the mock fs that the route module actually uses
function getMockFs() {
    return globalThis._mockFs;
}

function resetMockFs() {
    const mfs = getMockFs();
    if (mfs) {
        mfs.existsSync.mockReset();
        mfs.readFileSync.mockReset();
        mfs.writeFileSync.mockReset();
        mfs.unlinkSync.mockReset();
        mfs.renameSync.mockReset();
    }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(campaignsCharacter);
    return app;
}

// ─── GET /api/campaigns/:campaign/:file ───────────────────────────────────────

describe('campaignsCharacter - GET /api/campaigns/:campaign/:file', () => {
    afterEach(() => {
        resetMockFs();
        vi.restoreAllMocks();
    });

    it('should return 404 for a non-existent character file', async () => {
        const mfs = getMockFs();
        mfs.existsSync.mockReturnValue(false);

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/nonexistent.json');

        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('Character file not found');
    });

    it('should return character data for an existing file', async () => {
        const mfs = getMockFs();
        mfs.existsSync.mockReturnValue(true);
        mfs.readFileSync.mockReturnValue(JSON.stringify({ name: 'Thorin', class: 'Fighter', level: 5 }));

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/Thorin.json');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ name: 'Thorin', class: 'Fighter', level: 5 });
    });

    it('should skip route for "log" filename', async () => {
        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/log');

        expect(res.status).toBe(404);
    });

    it('should skip route for non-.json files', async () => {
        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/file.txt');

        expect(res.status).toBe(404);
    });

    it('should return 500 on filesystem read error', async () => {
        const mfs = getMockFs();
        mfs.existsSync.mockReturnValue(true);
        mfs.readFileSync.mockImplementation(() => {
            throw new Error('EACCES');
        });

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/Thorin.json');

        expect(res.status).toBe(500);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('EACCES');
    });
});

// ─── PUT /api/campaigns/:campaign/:file ──────────────────────────────────────

describe('campaignsCharacter - PUT /api/campaigns/:campaign/:file', () => {
    afterEach(() => {
        resetMockFs();
        vi.restoreAllMocks();
    });

    it('should skip route for "log" filename', async () => {
        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/log')
            .send({ name: 'Updated' });

        expect(res.status).toBe(404);
    });

    it('should skip route for non-.json files', async () => {
        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/file.txt')
            .send({ name: 'Updated' });

        expect(res.status).toBe(404);
    });

    it('should return 404 when file does not exist', async () => {
        const mfs = getMockFs();
        mfs.existsSync.mockReturnValue(false);

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/nonexistent.json')
            .send({ name: 'Updated' });

        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('Character file not found');
    });

    it('should update an existing character file', async () => {
        const mfs = getMockFs();
        mfs.existsSync.mockReturnValue(true);
        mfs.readFileSync.mockReturnValue(JSON.stringify({ name: 'Thorin', class: 'Fighter', level: 5 }));

        const updatedData = { name: 'Thorin', class: 'Fighter', level: 10 };
        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/Thorin.json')
            .send(updatedData);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('message');
        expect(res.body.message).toBe('Character updated successfully');
    });

    it('should return 404 when renaming and original file does not exist', async () => {
        const mfs = getMockFs();
        mfs.existsSync.mockReturnValue(false);

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
        const mfs = getMockFs();
        mfs.existsSync.mockReturnValue(true);
        mfs.readFileSync.mockReturnValue(JSON.stringify({ name: 'OldName', class: 'Fighter', level: 5 }));

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
    });

    it('should write updated data to the new filename after rename', async () => {
        const mfs = getMockFs();
        mfs.existsSync.mockReturnValue(true);
        mfs.readFileSync.mockReturnValue(JSON.stringify({ name: 'OldName', class: 'Fighter', level: 3 }));

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

        expect(mfs.writeFileSync).toHaveBeenCalled();
    });

    it('should return 500 on filesystem write error', async () => {
        const mfs = getMockFs();
        mfs.existsSync.mockReturnValue(true);
        mfs.readFileSync.mockReturnValue(JSON.stringify({ name: 'Thorin', class: 'Fighter' }));
        mfs.writeFileSync.mockImplementation(() => {
            throw new Error('EACCES');
        });

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/Thorin.json')
            .send({ name: 'Thorin', class: 'Fighter' });

        expect(res.status).toBe(500);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('EACCES');
    });

    it('should handle image deletion when imagePath is cleared', async () => {
        const mfs = getMockFs();
        mfs.existsSync.mockReturnValue(true);
        mfs.readFileSync.mockReturnValue(JSON.stringify({
            name: 'Thorin',
            class: 'Fighter',
            imagePath: 'campaigns/test-campaign/images/thorin.png'
        }));

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
    });

    it('should handle image upload when image and imageName are present', async () => {
        const mfs = getMockFs();
        mfs.existsSync.mockReturnValue(true);
        mfs.readFileSync.mockReturnValue(JSON.stringify({ name: 'Thorin', class: 'Fighter' }));

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
    });
});

// ─── DELETE /api/campaigns/:campaign/:file ───────────────────────────────────

describe('campaignsCharacter - DELETE /api/campaigns/:campaign/:file', () => {
    afterEach(() => {
        resetMockFs();
        vi.restoreAllMocks();
    });

    it('should skip route for "log" filename', async () => {
        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-campaign/log');

        expect(res.status).toBe(404);
    });

    it('should skip route for non-.json files', async () => {
        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-campaign/file.txt');

        expect(res.status).toBe(404);
    });

    it('should return 404 for a non-existent character file', async () => {
        const mfs = getMockFs();
        mfs.existsSync.mockReturnValue(false);

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-campaign/nonexistent.json');

        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('Character file not found');
    });

    it('should delete a character file', async () => {
        const mfs = getMockFs();
        mfs.existsSync.mockReturnValue(true);
        mfs.readFileSync.mockReturnValue(JSON.stringify({ name: 'Thorin', class: 'Fighter' }));

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-campaign/Thorin.json');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('message');
        expect(res.body.message).toBe('Character deleted successfully');
    });

    it('should delete the associated image file when imagePath exists', async () => {
        const mfs = getMockFs();
        mfs.existsSync.mockReturnValue(true);
        mfs.readFileSync.mockReturnValue(JSON.stringify({
            name: 'Thorin',
            class: 'Fighter',
            imagePath: 'campaigns/test-campaign/images/thorin.png'
        }));

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-campaign/Thorin.json');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('message');
    });

    it('should not fail when deleting character without an image', async () => {
        const mfs = getMockFs();
        mfs.existsSync.mockReturnValue(true);
        mfs.readFileSync.mockReturnValue(JSON.stringify({ name: 'Thorin', class: 'Fighter' }));

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-campaign/Thorin.json');

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Character deleted successfully');
    });

    it('should return 500 on filesystem delete error', async () => {
        const mfs = getMockFs();
        mfs.existsSync.mockReturnValue(true);
        mfs.readFileSync.mockReturnValue(JSON.stringify({ name: 'Thorin', class: 'Fighter' }));
        mfs.unlinkSync.mockImplementation(() => {
            throw new Error('EACCES');
        });

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-campaign/Thorin.json');

        expect(res.status).toBe(500);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('EACCES');
    });
});

// ─── POST /api/campaigns/:campaign ───────────────────────────────────────────

describe('campaignsCharacter - POST /api/campaigns/:campaign', () => {
    afterEach(() => {
        resetMockFs();
        vi.restoreAllMocks();
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
        const mfs = getMockFs();
        mfs.existsSync.mockReturnValue(false);

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/nonexistent-campaign')
            .send({ character: { name: 'Thorin' } });

        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('Campaign not found');
    });

    it('should create a new character file with sanitized filename', async () => {
        const mfs = getMockFs();
        mfs.existsSync.mockReturnValue(true);

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
    });

    it('should sanitize special characters in character name for filename', async () => {
        const mfs = getMockFs();
        mfs.existsSync.mockReturnValue(true);

        const characterData = { name: 'Thorin Oakenshield!', class: 'Fighter' };

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign')
            .send({ character: characterData });

        expect(res.status).toBe(201);
        expect(res.body.fileName).toBe('Thorin_Oakenshield_.json');
    });

    it('should handle image upload during character creation', async () => {
        const mfs = getMockFs();
        mfs.existsSync.mockReturnValue(true);

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
    });

    it('should return 500 on filesystem write error', async () => {
        const mfs = getMockFs();
        mfs.existsSync.mockReturnValue(true);
        mfs.writeFileSync.mockImplementation(() => {
            throw new Error('EACCES');
        });

        const characterData = { name: 'Thorin', class: 'Fighter' };

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign')
            .send({ character: characterData });

        expect(res.status).toBe(500);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('EACCES');
    });
});
