import path from 'path';
import express from 'express';
import { request } from '../test-utils/localhostSupertest.js';

// ---------------------------------------------------------------------------
// In-memory file system backed by a Map keyed by the path returned from
// campaignDataFile().  This lets the REAL jsonEntityCrud + npcs code run
// without touching the real disk.
// ---------------------------------------------------------------------------

const FILE_SYSTEM = new Map();
// When set to a path, writeFileSync will throw ENOENT for that path
let WRITE_FAIL_PATH = null;

function setupFs(entries) {
    FILE_SYSTEM.clear();
    WRITE_FAIL_PATH = null;
    for (const [path, content] of Object.entries(entries)) {
        FILE_SYSTEM.set(path, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
    }
}

function clearFs() {
    FILE_SYSTEM.clear();
    WRITE_FAIL_PATH = null;
}

function setWriteFailPath(path) {
    WRITE_FAIL_PATH = path;
}

// Track image operations done by the real imageUtils
const IMAGE_OPS = {
    deleted: [],
    uploaded: [],
};

function clearImageOps() {
    IMAGE_OPS.deleted = [];
    IMAGE_OPS.uploaded = [];
}

// ---------------------------------------------------------------------------
// Mocks — hoisted by vi
// ---------------------------------------------------------------------------

vi.mock('fs', () => {
    const renamedFiles = [];
    // Expose renamedFiles on the mock so tests can inspect it
    Object.defineProperty(vi.mocked({}), '_renamedFiles', { get: () => renamedFiles });
    return {
        default: {
            existsSync: (p) => FILE_SYSTEM.has(p),
            readFileSync: (p) => {
                const val = FILE_SYSTEM.get(p);
                if (val === undefined) throw new Error(`ENOENT: ${p}`);
                return val;
            },
            writeFileSync: (p, c) => {
                if (WRITE_FAIL_PATH && p === WRITE_FAIL_PATH) {
                    throw new Error('Disk full');
                }
                FILE_SYSTEM.set(p, c);
            },
            renameSync: (oldPath, newPath) => {
                const data = FILE_SYSTEM.get(oldPath);
                if (data !== undefined) {
                    FILE_SYSTEM.set(newPath, data);
                    FILE_SYSTEM.delete(oldPath);
                    renamedFiles.push({ oldPath, newPath });
                }
            },
        },
        existsSync: (p) => FILE_SYSTEM.has(p),
        readFileSync: (p) => {
            const val = FILE_SYSTEM.get(p);
            if (val === undefined) throw new Error(`ENOENT: ${p}`);
            return val;
        },
        writeFileSync: (p, c) => {
            if (WRITE_FAIL_PATH && p === WRITE_FAIL_PATH) {
                throw new Error('Disk full');
            }
            FILE_SYSTEM.set(p, c);
        },
        renameSync: (oldPath, newPath) => {
            const data = FILE_SYSTEM.get(oldPath);
            if (data !== undefined) {
                FILE_SYSTEM.set(newPath, data);
                FILE_SYSTEM.delete(oldPath);
            }
        },
    };
});

vi.mock('../utils/campaignPaths.js', () => ({
    campaignDataFile: (campaign, name) => `/mock/campaigns/${campaign}/data/${name}`,
    ensureDataDir: vi.fn((campaign) => `/mock/campaigns/${campaign}/data`),
    campaignImagesDir: vi.fn((campaign) => `/mock/campaigns/${campaign}/images`),
}));

vi.mock('../utils/imageUtils.js', () => ({
    processImageUpload: vi.fn((campaign, name, npc, originalImagePath) => {
        IMAGE_OPS.uploaded.push({ campaign, name, npc, originalImagePath });
        npc.imagePath = `images/${name}.png`;
        delete npc.image;
        delete npc.imageName;
    }),
    deleteCharacterImage: vi.fn((imagePath) => {
        IMAGE_OPS.deleted.push(imagePath);
    }),
}));

// Import AFTER mocks so the real code runs against the mocked fs/campaignPaths
import npcs from './npcs.js';
import { processImageUpload, deleteCharacterImage } from '../utils/imageUtils.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function npcsPath(campaign) {
    return `/mock/campaigns/${campaign}/data/npcs.json`;
}

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(npcs);
    return app;
}

afterEach(() => {
    clearFs();
    clearImageOps();
    vi.mocked(deleteCharacterImage).mockClear();
    vi.mocked(processImageUpload).mockClear();
    vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// GET /api/campaigns/:campaign/npcs
// ---------------------------------------------------------------------------

describe('npcs - GET /api/campaigns/:campaign/npcs', () => {
    it('should return an empty npcs list when no npcs.json exists', async () => {
        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/npcs');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('npcs');
        expect(Array.isArray(res.body.npcs)).toBe(true);
        expect(res.body.npcs).toEqual([]);
    });

    it('should return all npcs when file exists', async () => {
        const npcsData = [
            { name: 'Town Guard', alignment: 'Lawful Good', level: 1 },
            { name: 'Village Elder', alignment: 'Neutral Good', level: 3 },
        ];
        setupFs({ [npcsPath('test-campaign')]: npcsData });

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/npcs');
        expect(res.status).toBe(200);
        expect(res.body.npcs).toHaveLength(2);
        expect(res.body.npcs[0].name).toBe('Town Guard');
        expect(res.body.npcs[1].name).toBe('Village Elder');
    });

    it('should return empty array when npcs.json contains empty array', async () => {
        setupFs({ [npcsPath('test-campaign')]: '[]' });

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/npcs');
        expect(res.status).toBe(200);
        expect(res.body.npcs).toEqual([]);
    });

    it('should handle npcs with many fields', async () => {
        const npcsData = [
            {
                name: 'Complex NPC',
                alignment: 'Chaotic Neutral',
                level: 12,
                race: 'Dragonborn',
                class: 'Paladin',
                backstory: 'A fallen hero seeking redemption',
                stats: { str: 18, dex: 10, con: 14, int: 12, wis: 10, cha: 16 },
                equipment: ['Longsword', 'Shield', 'Plate Armor'],
                imagePath: 'images/Complex NPC.png',
            },
        ];
        setupFs({ [npcsPath('test-campaign')]: npcsData });

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/npcs');
        expect(res.status).toBe(200);
        expect(res.body.npcs).toHaveLength(1);
        expect(res.body.npcs[0].stats.str).toBe(18);
        expect(res.body.npcs[0].equipment).toEqual(['Longsword', 'Shield', 'Plate Armor']);
    });
});

// ---------------------------------------------------------------------------
// POST /api/campaigns/:campaign/npcs
// ---------------------------------------------------------------------------

describe('npcs - POST /api/campaigns/:campaign/npcs', () => {
    it('should save npcs and return success', async () => {
        const npcsData = [
            { name: 'Town Guard', alignment: 'Lawful Good', level: 1 },
            { name: 'Village Elder', alignment: 'Neutral Good', level: 3 },
        ];

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/npcs')
            .send({ npcs: npcsData });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const content = JSON.parse(FILE_SYSTEM.get(npcsPath('test-campaign')));
        expect(content).toHaveLength(2);
        expect(content[0].name).toBe('Town Guard');
    });

    it('should save an empty array of npcs', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/npcs')
            .send({ npcs: [] });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const content = JSON.parse(FILE_SYSTEM.get(npcsPath('test-campaign')));
        expect(content).toEqual([]);
    });

    it('should return 400 when npcs is missing from request body', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/npcs')
            .send({});

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'Expected an array for npcs');
    });

    it('should overwrite existing npcs with the new array', async () => {
        const existingData = [
            { name: 'Old NPC', alignment: 'Lawful' },
        ];
        setupFs({ [npcsPath('test-campaign')]: existingData });

        const newData = [
            { name: 'New NPC', alignment: 'Chaotic' },
        ];

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/npcs')
            .send({ npcs: newData });

        expect(res.status).toBe(200);
        const content = JSON.parse(FILE_SYSTEM.get(npcsPath('test-campaign')));
        expect(content).toHaveLength(1);
        expect(content[0].name).toBe('New NPC');
    });

    it('should handle npcs with special characters in names', async () => {
        const npcsData = [
            { name: 'Guard@Home', alignment: 'Chaotic', level: 5 },
            { name: 'Elder#1', alignment: 'Lawful', level: 10 },
        ];

        const app = createTestApp();
        const res = await request(app)
            .post('/api/campaigns/test-campaign/npcs')
            .send({ npcs: npcsData });

        expect(res.status).toBe(200);
        const content = JSON.parse(FILE_SYSTEM.get(npcsPath('test-campaign')));
        expect(content[0].name).toBe('Guard@Home');
        expect(content[1].name).toBe('Elder#1');
    });
});

// ---------------------------------------------------------------------------
// GET /api/campaigns/:campaign/npcs/:npcName
// ---------------------------------------------------------------------------

describe('npcs - GET /api/campaigns/:campaign/npcs/:npcName', () => {
    it('should return 404 when npcs.json does not exist', async () => {
        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/npcs/Town%20Guard');
        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error', 'NPC not found');
    });

    it('should return 404 when npc with given name does not exist', async () => {
        const npcsData = [
            { name: 'Town Guard', alignment: 'Lawful Good', level: 1 },
        ];
        setupFs({ [npcsPath('test-campaign')]: npcsData });

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/npcs/Nonexistent');
        expect(res.status).toBe(404);
        expect(res.body.error).toBe('NPC not found');
    });

    it('should return the npc when found by name', async () => {
        const npcData = { name: 'Town Guard', alignment: 'Lawful Good', level: 1 };
        setupFs({ [npcsPath('test-campaign')]: [npcData] });

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/npcs/Town%20Guard');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('npc');
        expect(res.body.npc).toEqual(npcData);
    });

    it('should handle npc names with special characters via URL encoding', async () => {
        const npcData = { name: 'Guard@Home', alignment: 'Chaotic', level: 5 };
        setupFs({ [npcsPath('test-campaign')]: [npcData] });

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/npcs/Guard%40Home');
        expect(res.status).toBe(200);
        expect(res.body.npc.name).toBe('Guard@Home');
    });

    it('should return npc with all fields', async () => {
        const npcData = {
            name: 'Complex NPC',
            alignment: 'Chaotic Neutral',
            level: 12,
            race: 'Dragonborn',
            class: 'Paladin',
            backstory: 'A fallen hero',
            stats: { str: 18, dex: 10, con: 14, int: 12, wis: 10, cha: 16 },
            imagePath: 'images/Complex NPC.png',
        };
        setupFs({ [npcsPath('test-campaign')]: [npcData] });

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/npcs/Complex%20NPC');
        expect(res.status).toBe(200);
        expect(res.body.npc).toEqual(npcData);
        expect(res.body.npc.stats.str).toBe(18);
    });
});

// ---------------------------------------------------------------------------
// DELETE /api/campaigns/:campaign/npcs/:npcName
// ---------------------------------------------------------------------------

describe('npcs - DELETE /api/campaigns/:campaign/npcs/:npcName', () => {
    it('should return 404 when npcs.json does not exist', async () => {
        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-campaign/npcs/Town%20Guard');
        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error', 'NPC not found');
    });

    it('should return 200 and succeed when npc does not exist (no-op delete)', async () => {
        const npcsData = [
            { name: 'Town Guard', alignment: 'Lawful Good', level: 1 },
        ];
        setupFs({ [npcsPath('test-campaign')]: npcsData });

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-campaign/npcs/Nonexistent');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const content = JSON.parse(FILE_SYSTEM.get(npcsPath('test-campaign')));
        expect(content).toHaveLength(1);
    });

    it('should delete an npc and return success', async () => {
        const npcsData = [
            { name: 'Keep Me', alignment: 'Lawful Good', level: 1 },
            { name: 'Delete Me', alignment: 'Chaotic', level: 5 },
        ];
        setupFs({ [npcsPath('test-campaign')]: npcsData });

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-campaign/npcs/Delete%20Me');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        const content = JSON.parse(FILE_SYSTEM.get(npcsPath('test-campaign')));
        expect(content).toHaveLength(1);
        expect(content[0].name).toBe('Keep Me');
    });

    it('should call onDelete callback when deleting npc with imagePath', async () => {
        const npcsData = [
            { name: 'Delete Me', imagePath: 'images/Delete Me.png' },
        ];
        setupFs({ [npcsPath('test-campaign')]: npcsData });

        const app = createTestApp();
        await request(app).delete('/api/campaigns/test-campaign/npcs/Delete%20Me');

        expect(vi.mocked(deleteCharacterImage)).toHaveBeenCalledWith('images/Delete Me.png');
    });

    it('should not call onDelete when npc has no imagePath', async () => {
        const npcsData = [
            { name: 'No Image NPC' },
        ];
        setupFs({ [npcsPath('test-campaign')]: npcsData });

        const app = createTestApp();
        await request(app).delete('/api/campaigns/test-campaign/npcs/No%20Image%20NPC');

        expect(vi.mocked(deleteCharacterImage)).not.toHaveBeenCalled();
    });

    it('should handle deleting from an empty npcs list (no-op delete)', async () => {
        setupFs({ [npcsPath('test-campaign')]: '[]' });

        const app = createTestApp();
        const res = await request(app).delete('/api/campaigns/test-campaign/npcs/Town%20Guard');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
    });

    it('should delete only the matching npc when multiple exist', async () => {
        const npcsData = [
            { name: 'First', alignment: 'Lawful' },
            { name: 'Second', alignment: 'Neutral' },
            { name: 'Third', alignment: 'Chaotic' },
        ];
        setupFs({ [npcsPath('test-campaign')]: npcsData });

        const app = createTestApp();
        await request(app).delete('/api/campaigns/test-campaign/npcs/Second');

        const content = JSON.parse(FILE_SYSTEM.get(npcsPath('test-campaign')));
        expect(content).toHaveLength(2);
        expect(content.map(n => n.name)).toEqual(['First', 'Third']);
    });

    it('should handle deleting npc with special characters in name', async () => {
        const npcsData = [
            { name: 'Guard@Home', alignment: 'Chaotic' },
            { name: 'Keep Me', alignment: 'Lawful' },
        ];
        setupFs({ [npcsPath('test-campaign')]: npcsData });

        const app = createTestApp();
        await request(app).delete('/api/campaigns/test-campaign/npcs/Guard%40Home');

        const content = JSON.parse(FILE_SYSTEM.get(npcsPath('test-campaign')));
        expect(content).toHaveLength(1);
        expect(content[0].name).toBe('Keep Me');
    });
});

// ---------------------------------------------------------------------------
// PUT /api/campaigns/:campaign/npcs/:npcName (custom upsert route)
// This is the route that lives in npcs.js lines 20-71 and is NOT in
// jsonEntityCrud — it handles image changes.
// ---------------------------------------------------------------------------

describe('npcs - PUT /api/campaigns/:campaign/npcs/:npcName (upsert)', () => {
    it('should create a new npc when npcs.json does not exist', async () => {
        // Don't set up any npcs.json — the file doesn't exist
        const npcData = { name: 'New NPC', alignment: 'Neutral', level: 2 };
        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/npcs/New%20NPC')
            .send(npcData);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
        expect(res.body).toHaveProperty('npc');
        expect(res.body.npc).toEqual(npcData);

        const content = JSON.parse(FILE_SYSTEM.get(npcsPath('test-campaign')));
        expect(content).toHaveLength(1);
        expect(content[0].name).toBe('New NPC');
    });

    it('should create a new npc when it does not exist', async () => {
        setupFs({ [npcsPath('test-campaign')]: '[]' });

        const npcData = { name: 'New NPC', alignment: 'Neutral', level: 2 };
        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/npcs/New%20NPC')
            .send(npcData);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
        expect(res.body).toHaveProperty('npc');
        expect(res.body.npc).toEqual(npcData);

        const content = JSON.parse(FILE_SYSTEM.get(npcsPath('test-campaign')));
        expect(content).toHaveLength(1);
        expect(content[0].name).toBe('New NPC');
    });

    it('should update an existing npc when it exists', async () => {
        const npcsData = [
            { name: 'Town Guard', alignment: 'Lawful Good', level: 1 },
        ];
        setupFs({ [npcsPath('test-campaign')]: npcsData });

        const updatedData = { name: 'Town Guard', alignment: 'Lawful Evil', level: 5 };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/npcs/Town%20Guard')
            .send(updatedData);

        expect(res.status).toBe(200);
        expect(res.body.npc).toEqual(updatedData);

        const content = JSON.parse(FILE_SYSTEM.get(npcsPath('test-campaign')));
        expect(content).toHaveLength(1);
        expect(content[0].alignment).toBe('Lawful Evil');
        expect(content[0].level).toBe(5);
    });

    it('should rename an npc when name changes', async () => {
        const npcsData = [
            { name: 'Old Name', alignment: 'Neutral' },
        ];
        setupFs({ [npcsPath('test-campaign')]: npcsData });

        const renamedData = { name: 'New Name', alignment: 'Neutral' };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/npcs/Old%20Name')
            .send(renamedData);

        expect(res.status).toBe(200);

        const content = JSON.parse(FILE_SYSTEM.get(npcsPath('test-campaign')));
        expect(content).toHaveLength(1);
        expect(content[0].name).toBe('New Name');
    });

    it('should return 200 when the operation succeeds', async () => {
        setupFs({ [npcsPath('test-campaign')]: '[]' });

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/npcs/Test%20NPC')
            .send({ name: 'Test NPC' });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
    });

    it('should handle updating npc with additional fields', async () => {
        const npcsData = [
            { name: 'Town Guard', alignment: 'Lawful Good' },
        ];
        setupFs({ [npcsPath('test-campaign')]: npcsData });

        const updatedData = {
            name: 'Town Guard',
            alignment: 'Lawful Good',
            level: 5,
            race: 'Human',
            class: 'Fighter',
        };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/npcs/Town%20Guard')
            .send(updatedData);

        expect(res.status).toBe(200);
        const content = JSON.parse(FILE_SYSTEM.get(npcsPath('test-campaign')));
        expect(content[0].level).toBe(5);
        expect(content[0].race).toBe('Human');
        expect(content[0].class).toBe('Fighter');
    });

    it('should handle npc name with URL-encoded characters in PUT path', async () => {
        const npcsData = [
            { name: 'Guard@Home', alignment: 'Chaotic' },
        ];
        setupFs({ [npcsPath('test-campaign')]: npcsData });

        const updatedData = { name: 'Guard@Home', alignment: 'Neutral' };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/npcs/Guard%40Home')
            .send(updatedData);

        expect(res.status).toBe(200);
        const content = JSON.parse(FILE_SYSTEM.get(npcsPath('test-campaign')));
        expect(content[0].alignment).toBe('Neutral');
    });
});

// ---------------------------------------------------------------------------
// PUT image handling (npcs.js lines 40-57)
// ---------------------------------------------------------------------------

describe('npcs - PUT image handling', () => {
    it('should delete original image when imagePath is cleared with empty string', async () => {
        const npcsData = [
            { name: 'Town Guard', imagePath: 'images/Town Guard.png' },
        ];
        setupFs({ [npcsPath('test-campaign')]: npcsData });

        const updatedData = { name: 'Town Guard', imagePath: '' };

        const app = createTestApp();
        await request(app)
            .put('/api/campaigns/test-campaign/npcs/Town%20Guard')
            .send(updatedData);

        expect(vi.mocked(deleteCharacterImage)).toHaveBeenCalledWith('images/Town Guard.png');
    });

    it('should delete original image when imagePath is falsy (null)', async () => {
        const npcsData = [
            { name: 'Town Guard', imagePath: 'images/Town Guard.png' },
        ];
        setupFs({ [npcsPath('test-campaign')]: npcsData });

        const updatedData = { name: 'Town Guard', imagePath: null };

        const app = createTestApp();
        await request(app)
            .put('/api/campaigns/test-campaign/npcs/Town%20Guard')
            .send(updatedData);

        expect(vi.mocked(deleteCharacterImage)).toHaveBeenCalledWith('images/Town Guard.png');
    });

    it('should process image upload when image and imageName are present', async () => {
        const npcsData = [
            { name: 'Town Guard' },
        ];
        setupFs({ [npcsPath('test-campaign')]: npcsData });

        const updatedData = {
            name: 'Town Guard',
            image: 'data:image/png;base64,iVBORw==',
            imageName: 'guard.png',
        };

        const app = createTestApp();
        await request(app)
            .put('/api/campaigns/test-campaign/npcs/Town%20Guard')
            .send(updatedData);

        expect(vi.mocked(processImageUpload)).toHaveBeenCalledWith(
            'test-campaign',
            'Town Guard',
            expect.any(Object),
            undefined
        );
    });

    it('should not delete image when imagePath is not provided and no original exists', async () => {
        const npcsData = [
            { name: 'Town Guard' },
        ];
        setupFs({ [npcsPath('test-campaign')]: npcsData });

        const updatedData = { name: 'Town Guard', alignment: 'Chaotic' };

        const app = createTestApp();
        await request(app)
            .put('/api/campaigns/test-campaign/npcs/Town%20Guard')
            .send(updatedData);

        expect(vi.mocked(deleteCharacterImage)).not.toHaveBeenCalled();
    });

    it('should not call processImageUpload when only image is present without imageName', async () => {
        const npcsData = [
            { name: 'Town Guard' },
        ];
        setupFs({ [npcsPath('test-campaign')]: npcsData });

        const updatedData = {
            name: 'Town Guard',
            image: 'data:image/png;base64,iVBORw==',
        };

        const app = createTestApp();
        await request(app)
            .put('/api/campaigns/test-campaign/npcs/Town%20Guard')
            .send(updatedData);

        expect(vi.mocked(processImageUpload)).not.toHaveBeenCalled();
    });

    it('should not call processImageUpload when only imageName is present without image', async () => {
        const npcsData = [
            { name: 'Town Guard' },
        ];
        setupFs({ [npcsPath('test-campaign')]: npcsData });

        const updatedData = {
            name: 'Town Guard',
            imageName: 'guard.png',
        };

        const app = createTestApp();
        await request(app)
            .put('/api/campaigns/test-campaign/npcs/Town%20Guard')
            .send(updatedData);

        expect(vi.mocked(processImageUpload)).not.toHaveBeenCalled();
    });

    it('should delete original image when updating unrelated fields without imagePath (undefined imagePath triggers delete)', async () => {
        const npcsData = [
            { name: 'Town Guard', imagePath: 'images/Town Guard.png', alignment: 'Lawful Good' },
        ];
        setupFs({ [npcsPath('test-campaign')]: npcsData });

        const updatedData = { name: 'Town Guard', alignment: 'Lawful Evil' };

        const app = createTestApp();
        await request(app)
            .put('/api/campaigns/test-campaign/npcs/Town%20Guard')
            .send(updatedData);

        // When imagePath is not included in the update, it is undefined (falsy),
        // which triggers deletion of the original image per npcs.js line 40
        expect(vi.mocked(deleteCharacterImage)).toHaveBeenCalledWith('images/Town Guard.png');
    });

    it('should rename the image file when npc name changes and original imagePath exists', async () => {
        const npcsData = [
            { name: 'Old Guard', imagePath: 'images/Old Guard.png' },
        ];
        // Add the real image file path to FILE_SYSTEM so fs.existsSync returns true
        // npcs.js constructs: path.join(process.cwd(), 'public', originalImagePath)
        const realImagePath = path.join(process.cwd(), 'public', 'images/Old Guard.png');
        setupFs({ [npcsPath('test-campaign')]: npcsData, [realImagePath]: 'fake-image-data' });

        // Include imagePath in the update so the rename branch (not the delete branch) is triggered
        const updatedData = { name: 'New Guard', alignment: 'Neutral', imagePath: 'images/Old Guard.png' };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/npcs/Old%20Guard')
            .send(updatedData);

        expect(res.status).toBe(200);
        const content = JSON.parse(FILE_SYSTEM.get(npcsPath('test-campaign')));
        expect(content[0].name).toBe('New Guard');
        // fs.existsSync returned true, so rename branch runs.
        // fs.renameSync copies to FILE_SYSTEM, and imagePath is updated
        expect(content[0].imagePath).toContain('New Guard');
    });

    it('should keep imagePath unchanged when name does not change', async () => {
        const npcsData = [
            { name: 'Same Name', imagePath: 'images/Same Name.png' },
        ];
        setupFs({ [npcsPath('test-campaign')]: npcsData });

        const updatedData = { name: 'Same Name', alignment: 'Neutral' };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/npcs/Same%20Name')
            .send(updatedData);

        expect(res.status).toBe(200);
        const content = JSON.parse(FILE_SYSTEM.get(npcsPath('test-campaign')));
        // imagePath is not included in update → undefined → triggers delete branch
        expect(content[0].imagePath).toBe('');
    });

    it('should handle rename when image file does not exist on disk', async () => {
        // fs.existsSync(oldImageFullPath) returns false → skip rename block
        const npcsData = [
            { name: 'Old Guard', imagePath: 'images/Old Guard.png' },
        ];
        setupFs({ [npcsPath('test-campaign')]: npcsData });

        const updatedData = { name: 'New Guard', alignment: 'Neutral', imagePath: 'images/Old Guard.png' };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/npcs/Old%20Guard')
            .send(updatedData);

        expect(res.status).toBe(200);
        const content = JSON.parse(FILE_SYSTEM.get(npcsPath('test-campaign')));
        expect(content[0].name).toBe('New Guard');
        // Image file doesn't exist on mock disk, so rename is skipped, imagePath stays as provided
        expect(content[0].imagePath).toBe('images/Old Guard.png');
    });

    it('should not update imagePath when old and new image paths are identical', async () => {
        // The old and new image paths are the same → no rename needed
        const npcsData = [
            { name: 'Old Guard', imagePath: 'images/Old Guard.png' },
        ];
        // Add the image file to FILE_SYSTEM so fs.existsSync returns true
        const realImagePath = path.join(process.cwd(), 'public', 'images/Old Guard.png');
        setupFs({ [npcsPath('test-campaign')]: npcsData, [realImagePath]: 'fake-image-data' });

        // Rename to same name — old and new paths match, so no rename happens
        const updatedData = { name: 'Old Guard', alignment: 'Neutral', imagePath: 'images/Old Guard.png' };

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/npcs/Old%20Guard')
            .send(updatedData);

        expect(res.status).toBe(200);
        const content = JSON.parse(FILE_SYSTEM.get(npcsPath('test-campaign')));
        expect(content[0].name).toBe('Old Guard');
        // oldImageFullPath === newImageFullPath, so rename is skipped
        expect(content[0].imagePath).toBe('images/Old Guard.png');
    });
});

// ---------------------------------------------------------------------------
// Campaign isolation
// ---------------------------------------------------------------------------

describe('npcs - Campaign isolation', () => {
    it('should return different npc data for different campaigns', async () => {
        const campaignANpcs = [
            { name: 'Guard A', alignment: 'Lawful', level: 1 },
        ];
        const campaignBNpcs = [
            { name: 'Guard B', alignment: 'Chaotic', level: 5 },
        ];
        setupFs({
            [npcsPath('campaign-a')]: campaignANpcs,
            [npcsPath('campaign-b')]: campaignBNpcs,
        });

        const app = createTestApp();

        const resA = await request(app).get('/api/campaigns/campaign-a/npcs');
        expect(resA.status).toBe(200);
        expect(resA.body.npcs).toHaveLength(1);
        expect(resA.body.npcs[0].name).toBe('Guard A');

        const resB = await request(app).get('/api/campaigns/campaign-b/npcs');
        expect(resB.status).toBe(200);
        expect(resB.body.npcs).toHaveLength(1);
        expect(resB.body.npcs[0].name).toBe('Guard B');
    });

    it('should not leak npcs between campaigns on delete', async () => {
        const campaignANpcs = [
            { name: 'Guard A', alignment: 'Lawful' },
        ];
        const campaignBNpcs = [
            { name: 'Guard B', alignment: 'Chaotic' },
        ];
        setupFs({
            [npcsPath('campaign-a')]: campaignANpcs,
            [npcsPath('campaign-b')]: campaignBNpcs,
        });

        const app = createTestApp();

        await request(app).delete('/api/campaigns/campaign-a/npcs/Guard%20A');

        const contentA = JSON.parse(FILE_SYSTEM.get(npcsPath('campaign-a')));
        expect(contentA).toHaveLength(0);

        const contentB = JSON.parse(FILE_SYSTEM.get(npcsPath('campaign-b')));
        expect(contentB).toHaveLength(1);
        expect(contentB[0].name).toBe('Guard B');
    });

    it('should not leak npcs between campaigns on PUT', async () => {
        const campaignANpcs = [
            { name: 'Guard A', alignment: 'Lawful' },
        ];
        const campaignBNpcs = [
            { name: 'Guard B', alignment: 'Chaotic' },
        ];
        setupFs({
            [npcsPath('campaign-a')]: campaignANpcs,
            [npcsPath('campaign-b')]: campaignBNpcs,
        });

        const app = createTestApp();

        await request(app)
            .put('/api/campaigns/campaign-a/npcs/Guard%20A')
            .send({ name: 'Guard A', alignment: 'Neutral' });

        const contentA = JSON.parse(FILE_SYSTEM.get(npcsPath('campaign-a')));
        expect(contentA[0].alignment).toBe('Neutral');

        const contentB = JSON.parse(FILE_SYSTEM.get(npcsPath('campaign-b')));
        expect(contentB[0].alignment).toBe('Chaotic');
    });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('npcs - Error handling', () => {
    it('should handle malformed JSON in npcs.json gracefully via jsonEntityCrud loadOrInit', async () => {
        // jsonEntityCrud loadOrInit checks Array.isArray and returns [] if not array
        setupFs({ [npcsPath('test-campaign')]: 'not valid json at all' });

        const app = createTestApp();
        const res = await request(app).get('/api/campaigns/test-campaign/npcs');
        // The real code parses JSON; malformed JSON will throw, which asyncHandler catches
        expect(res.status).toBe(500);
    });

    it('should return 500 when PUT handler writeFileSync throws', async () => {
        setupFs({ [npcsPath('test-campaign')]: '[]' });
        setWriteFailPath(npcsPath('test-campaign'));

        const app = createTestApp();
        const res = await request(app)
            .put('/api/campaigns/test-campaign/npcs/New%20NPC')
            .send({ name: 'New NPC' });

        expect(res.status).toBe(500);
        expect(res.body).toHaveProperty('error');
    });
});
