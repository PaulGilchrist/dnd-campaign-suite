import { request } from '../test-utils/localhostSupertest.js';
import express from 'express';
import campaignsCharacter from './campaigns-character.js';
import { publish } from '../utils/changeData.js';

// vi.mock factory creates mock fs inline
vi.mock('fs', () => {
    const m = {
        existsSync: vi.fn(),
        readFileSync: vi.fn(),
        writeFileSync: vi.fn(),
        unlinkSync: vi.fn(),
        renameSync: vi.fn(),
    };
    globalThis._mockFsPatch = m;
    return {
        default: m,
        ...m,
    };
});

vi.mock('../utils/campaignPaths.js', () => ({
    campaignDir: vi.fn((campaign) => `/mock/campaigns/${campaign}`),
    campaignImagesDir: vi.fn((campaign) => `/mock/campaigns/${campaign}/images`),
}));

vi.mock('../utils/imageUtils.js', () => ({
    processImageUpload: vi.fn(),
    deleteCharacterImage: vi.fn(),
}));

vi.mock('../utils/changeData.js', () => ({
    publish: vi.fn(),
    removeChangeDataKey: vi.fn(),
}));

function getMockFs() {
    return globalThis._mockFsPatch;
}

function resetMockFs() {
    const mfs = getMockFs();
    if (mfs) {
        mfs.existsSync.mockReset().mockReturnValue(true);
        mfs.readFileSync.mockReset();
        mfs.writeFileSync.mockReset();
        mfs.unlinkSync.mockReset();
        mfs.renameSync.mockReset();
    }
}

function resetModuleMocks() {
    vi.mocked(publish).mockClear();
}

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(campaignsCharacter);
    return app;
}

// ─── PATCH /api/campaigns/:campaign/:file ──────────────────────────────────────

describe('campaignsCharacter - PATCH /api/campaigns/:campaign/:file', () => {
    afterEach(() => {
        resetMockFs();
        resetModuleMocks();
        vi.restoreAllMocks();
    });

    it('should skip route for "log" filename', async () => {
        const app = createTestApp();
        const res = await request(app)
            .patch('/api/campaigns/test-campaign/log')
            .send({ hp: 10 });

        expect(res.status).toBe(404);
    });

    it('should skip route for non-.json files', async () => {
        const app = createTestApp();
        const res = await request(app)
            .patch('/api/campaigns/test-campaign/file.txt')
            .send({ hp: 10 });

        expect(res.status).toBe(404);
    });

    it('should fall through (404) when URL params are incomplete', async () => {
        const app = createTestApp();
        const res = await request(app)
            .patch('/api/campaigns/')
            .send({ hp: 10 });

        expect(res.status).toBe(404);
    });

    it('should fall through (404) when file param is empty', async () => {
        const app = createTestApp();
        const res = await request(app)
            .patch('/api/campaigns/test-campaign/')
            .send({ hp: 10 });

        expect(res.status).toBe(404);
    });

    it('should return 400 when patch data is missing', async () => {
        const app = createTestApp();
        const res = await request(app)
            .patch('/api/campaigns/test-campaign/Thorin.json');

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('Campaign, file, and patch data are required');
    });

    it('should return 400 when patch is not an object', async () => {
        const app = createTestApp();
        const res = await request(app)
            .patch('/api/campaigns/test-campaign/Thorin.json')
            .send('not an object');

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('Campaign, file, and patch data are required');
    });

    it('should return 400 when patch is null', async () => {
        const app = createTestApp();
        const res = await request(app)
            .patch('/api/campaigns/test-campaign/Thorin.json')
            .send(null);

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('Campaign, file, and patch data are required');
    });

    it('should convert array to object with numeric keys due to deepMerge behavior', async () => {
        const mfs = getMockFs();
        mfs.existsSync.mockReturnValue(true);
        mfs.readFileSync.mockReturnValue(JSON.stringify({ name: 'Thorin', class: 'Fighter' }));

        const app = createTestApp();
        const res = await request(app)
            .patch('/api/campaigns/test-campaign/Thorin.json')
            .send([1, 2, 3]);

        expect(res.status).toBe(200);
        expect(res.body.character['0']).toBe(1);
        expect(res.body.character['1']).toBe(2);
        expect(res.body.character['2']).toBe(3);
    });

    it('should return 404 for a non-existent character file', async () => {
        const mfs = getMockFs();
        mfs.existsSync.mockReturnValue(false);

        const app = createTestApp();
        const res = await request(app)
            .patch('/api/campaigns/test-campaign/nonexistent.json')
            .send({ hp: 10 });

        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('Character file not found');
    });

    it('should merge a simple patch into existing character data', async () => {
        const mfs = getMockFs();
        mfs.existsSync.mockReturnValue(true);
        mfs.readFileSync.mockReturnValue(JSON.stringify({
            name: 'Thorin',
            class: 'Fighter',
            level: 5,
            hp: { current: 20, max: 20 }
        }));

        const app = createTestApp();
        const res = await request(app)
            .patch('/api/campaigns/test-campaign/Thorin.json')
            .send({ hp: { current: 15 } });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('message');
        expect(res.body.message).toBe('Character updated successfully');
        expect(res.body).toHaveProperty('character');
        expect(res.body.character.hp.current).toBe(15);
        expect(res.body.character.hp.max).toBe(20);
        expect(res.body.character.name).toBe('Thorin');
        expect(res.body.character.level).toBe(5);
    });

    it('should deep merge nested objects', async () => {
        const mfs = getMockFs();
        mfs.existsSync.mockReturnValue(true);
        mfs.readFileSync.mockReturnValue(JSON.stringify({
            name: 'Thorin',
            stats: { str: 16, dex: 14, con: 13 },
            equipment: { weapons: ['longsword'], armor: 'chain mail' }
        }));

        const app = createTestApp();
        const res = await request(app)
            .patch('/api/campaigns/test-campaign/Thorin.json')
            .send({
                stats: { str: 18, intelligence: 10 },
                equipment: { weapons: ['longsword', 'shield'] }
            });

        expect(res.status).toBe(200);
        expect(res.body.character.stats.str).toBe(18);
        expect(res.body.character.stats.dex).toBe(14);
        expect(res.body.character.stats.con).toBe(13);
        expect(res.body.character.stats.intelligence).toBe(10);
        expect(res.body.character.equipment.weapons).toEqual(['longsword', 'shield']);
        expect(res.body.character.equipment.armor).toBe('chain mail');
    });

    it('should replace arrays entirely (not deep merge)', async () => {
        const mfs = getMockFs();
        mfs.existsSync.mockReturnValue(true);
        mfs.readFileSync.mockReturnValue(JSON.stringify({
            name: 'Thorin',
            conditions: ['poisoned', 'blinded'],
            inventory: ['potion', 'scroll']
        }));

        const app = createTestApp();
        const res = await request(app)
            .patch('/api/campaigns/test-campaign/Thorin.json')
            .send({ conditions: ['exhaustion'] });

        expect(res.status).toBe(200);
        expect(res.body.character.conditions).toEqual(['exhaustion']);
        expect(res.body.character.inventory).toEqual(['potion', 'scroll']);
    });

    it('should overwrite primitive values', async () => {
        const mfs = getMockFs();
        mfs.existsSync.mockReturnValue(true);
        mfs.readFileSync.mockReturnValue(JSON.stringify({
            name: 'Thorin',
            class: 'Fighter',
            level: 5
        }));

        const app = createTestApp();
        const res = await request(app)
            .patch('/api/campaigns/test-campaign/Thorin.json')
            .send({ level: 10, class: 'Barbarian' });

        expect(res.status).toBe(200);
        expect(res.body.character.level).toBe(10);
        expect(res.body.character.class).toBe('Barbarian');
        expect(res.body.character.name).toBe('Thorin');
    });

    it('should set null values', async () => {
        const mfs = getMockFs();
        mfs.existsSync.mockReturnValue(true);
        mfs.readFileSync.mockReturnValue(JSON.stringify({
            name: 'Thorin',
            specialAbility: 'rage'
        }));

        const app = createTestApp();
        const res = await request(app)
            .patch('/api/campaigns/test-campaign/Thorin.json')
            .send({ specialAbility: null });

        expect(res.status).toBe(200);
        expect(res.body.character.specialAbility).toBeNull();
        expect(res.body.character.name).toBe('Thorin');
    });

    it('should set empty string values', async () => {
        const mfs = getMockFs();
        mfs.existsSync.mockReturnValue(true);
        mfs.readFileSync.mockReturnValue(JSON.stringify({
            name: 'Thorin',
            backstory: 'Once a mighty warrior...'
        }));

        const app = createTestApp();
        const res = await request(app)
            .patch('/api/campaigns/test-campaign/Thorin.json')
            .send({ backstory: '' });

        expect(res.status).toBe(200);
        expect(res.body.character.backstory).toBe('');
    });

    it('should call publish with correct key after patch', async () => {
        const mfs = getMockFs();
        mfs.existsSync.mockReturnValue(true);
        mfs.readFileSync.mockReturnValue(JSON.stringify({ name: 'Thorin', class: 'Fighter' }));

        const app = createTestApp();
        await request(app)
            .patch('/api/campaigns/test-campaign/Thorin.json')
            .send({ level: 6 });

        expect(publish).toHaveBeenCalledWith('character-test-campaign-Thorin.json', expect.any(Object), 'test-campaign');
    });

    it('should write updated data to the file', async () => {
        const mfs = getMockFs();
        mfs.existsSync.mockReturnValue(true);
        mfs.readFileSync.mockReturnValue(JSON.stringify({ name: 'Thorin', class: 'Fighter', level: 5 }));

        const app = createTestApp();
        await request(app)
            .patch('/api/campaigns/test-campaign/Thorin.json')
            .send({ level: 10 });

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
            .patch('/api/campaigns/test-campaign/Thorin.json')
            .send({ level: 10 });

        expect(res.status).toBe(500);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBe('EACCES');
    });

    it('should handle deeply nested object merging (3 levels)', async () => {
        const mfs = getMockFs();
        mfs.existsSync.mockReturnValue(true);
        mfs.readFileSync.mockReturnValue(JSON.stringify({
            name: 'Thorin',
            features: {
                classFeatures: {
                    fightingStyle: 'defense',
                    secondWind: { used: 0, max: 1 }
                }
            }
        }));

        const app = createTestApp();
        const res = await request(app)
            .patch('/api/campaigns/test-campaign/Thorin.json')
            .send({
                features: {
                    classFeatures: {
                        secondWind: { used: 1 }
                    }
                }
            });

        expect(res.status).toBe(200);
        expect(res.body.character.features.classFeatures.fightingStyle).toBe('defense');
        expect(res.body.character.features.classFeatures.secondWind.used).toBe(1);
        expect(res.body.character.features.classFeatures.secondWind.max).toBe(1);
    });

    it('should handle patch with mixed nested and flat values', async () => {
        const mfs = getMockFs();
        mfs.existsSync.mockReturnValue(true);
        mfs.readFileSync.mockReturnValue(JSON.stringify({
            name: 'Thorin',
            level: 5,
            hp: { current: 20, max: 20, temporary: 0 },
            conditions: []
        }));

        const app = createTestApp();
        const res = await request(app)
            .patch('/api/campaigns/test-campaign/Thorin.json')
            .send({
                level: 6,
                hp: { current: 15 },
                conditions: ['fatigued']
            });

        expect(res.status).toBe(200);
        expect(res.body.character.level).toBe(6);
        expect(res.body.character.hp.current).toBe(15);
        expect(res.body.character.hp.max).toBe(20);
        expect(res.body.character.hp.temporary).toBe(0);
        expect(res.body.character.conditions).toEqual(['fatigued']);
    });

    it('should handle boolean values in patch', async () => {
        const mfs = getMockFs();
        mfs.existsSync.mockReturnValue(true);
        mfs.readFileSync.mockReturnValue(JSON.stringify({
            name: 'Thorin',
            isActive: true,
            flagged: false
        }));

        const app = createTestApp();
        const res = await request(app)
            .patch('/api/campaigns/test-campaign/Thorin.json')
            .send({ isActive: false, flagged: true });

        expect(res.status).toBe(200);
        expect(res.body.character.isActive).toBe(false);
        expect(res.body.character.flagged).toBe(true);
    });

    it('should handle zero values in patch', async () => {
        const mfs = getMockFs();
        mfs.existsSync.mockReturnValue(true);
        mfs.readFileSync.mockReturnValue(JSON.stringify({
            name: 'Thorin',
            spellSlots: { level1: 4, level2: 3 }
        }));

        const app = createTestApp();
        const res = await request(app)
            .patch('/api/campaigns/test-campaign/Thorin.json')
            .send({ spellSlots: { level1: 0 } });

        expect(res.status).toBe(200);
        expect(res.body.character.spellSlots.level1).toBe(0);
    });
});
