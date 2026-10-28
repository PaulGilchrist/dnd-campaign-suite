// Regression tests for bug-charsheet-stale-body-minimal-payload: POST create
// and PUT save/rename must REJECT character bodies missing sections the rules
// engine loads unconditionally (race/class objects with names, inventory
// .magicItems array). A stored file missing them crash-silents CharSheet
// .fetchData (rules throw → swallowed rejection → setPlayerStats never runs),
// leaving the PREVIOUS character's full body — with its live Edit/Delete
// buttons — on screen under the newly-selected name (wrong-entity mutation
// hazard). Both write lanes must 400 with a clear English error and stay
// fully disk-inert, while legitimate wizard-shaped characters (both rulesets)
// keep creating/saving normally.
import { request } from '../test-utils/localhostSupertest.js';
import express from 'express';
import campaignsCharacter from './campaigns-character.js';
import { publish, removeChangeDataKey } from '../utils/changeData.js';

vi.mock('fs', () => {
    const m = {
        existsSync: vi.fn(),
        readFileSync: vi.fn(),
        writeFileSync: vi.fn(),
        unlinkSync: vi.fn(),
        renameSync: vi.fn(),
    };
    globalThis._mockFs = m;
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
    return globalThis._mockFs;
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

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(campaignsCharacter);
    return app;
}

// Wizard-produced minimum: rules.js reads race.name/class.name and assigns
// inventory.magicItems for BOTH rulesets (rules-magicItems.js:8-11).
const valid5e = {
    name: 'Shape Guard Five',
    rules: '5e',
    level: 1,
    race: { name: 'Human' },
    class: { name: 'Fighter', subclass: { name: 'Champion' } },
    abilities: [{ name: 'Strength', score: 10 }],
    inventory: { magicItems: [], equipped: [] },
};

const valid2024 = {
    ...valid5e,
    name: 'Shape Guard Twenty',
    rules: '2024',
};

// POST 400 legs need the campaign dir to exist but the target file NOT to
// exist (otherwise the duplicate-name guard short-circuits first).
function mockFreshCampaignDir() {
    getMockFs().existsSync.mockImplementation((p) => !String(p).endsWith('.json'));
}

describe('campaignsCharacter — character shape guard (stale-body impostor bug)', () => {
    afterEach(() => {
        resetMockFs();
        vi.mocked(publish).mockClear();
        vi.mocked(removeChangeDataKey).mockClear();
        vi.restoreAllMocks();
    });

    describe('POST /api/campaigns/:campaign', () => {
        it('rejects the minimal payload (name+rules only) with 400 and writes nothing', async () => {
            mockFreshCampaignDir();

            const res = await request(createTestApp())
                .post('/api/campaigns/test-campaign')
                .send({ character: { name: 'QA Minimal Probe', rules: '2024' } });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('race');
            expect(res.body.error).toContain('class');
            expect(res.body.error).toContain('inventory.magicItems');
            expect(getMockFs().writeFileSync).not.toHaveBeenCalled();
            expect(publish).not.toHaveBeenCalled();
        });

        it('rejects a string class (engine reads class.name) naming class as missing', async () => {
            mockFreshCampaignDir();

            const res = await request(createTestApp())
                .post('/api/campaigns/test-campaign')
                .send({ character: { name: 'String Classer', rules: '5e', race: { name: 'Human' }, class: 'Fighter', inventory: { magicItems: [] } } });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('class');
            expect(res.body.error).not.toContain('race');
            expect(getMockFs().writeFileSync).not.toHaveBeenCalled();
        });

        it('rejects a character whose inventory lacks the magicItems array', async () => {
            mockFreshCampaignDir();

            const res = await request(createTestApp())
                .post('/api/campaigns/test-campaign')
                .send({ character: { name: 'No Magic Items', rules: '2024', race: { name: 'Human' }, class: { name: 'Fighter' }, inventory: { equipped: [] } } });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('inventory.magicItems');
            expect(getMockFs().writeFileSync).not.toHaveBeenCalled();
        });

        it('rejects a subclass-less/major-less class (rules-proficiencies bonusSource throw sites)', async () => {
            mockFreshCampaignDir();

            const res = await request(createTestApp())
                .post('/api/campaigns/test-campaign')
                .send({ character: { name: 'No Subclasser', rules: '2024', race: { name: 'Human' }, class: { name: 'Fighter', subclass: null }, inventory: { magicItems: [] } } });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('class.major or class.subclass');
            expect(getMockFs().writeFileSync).not.toHaveBeenCalled();
        });

        it('rejects an empty abilities array (computeInitiative dereferences Dexterity)', async () => {
            mockFreshCampaignDir();

            const res = await request(createTestApp())
                .post('/api/campaigns/test-campaign')
                .send({ character: { name: 'No Abilities', rules: '2024', race: { name: 'Human' }, class: { name: 'Fighter', subclass: { name: 'Champion' } }, abilities: [], inventory: { magicItems: [] } } });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('abilities');
            expect(getMockFs().writeFileSync).not.toHaveBeenCalled();
        });

        it('rejects a race object with a blank name', async () => {
            mockFreshCampaignDir();

            const res = await request(createTestApp())
                .post('/api/campaigns/test-campaign')
                .send({ character: { name: 'Blank Racer', rules: '5e', race: { name: '  ' }, class: { name: 'Fighter' }, inventory: { magicItems: [] } } });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('race');
            expect(getMockFs().writeFileSync).not.toHaveBeenCalled();
        });

        it('still creates a valid 5e character (201)', async () => {
            mockFreshCampaignDir();

            const res = await request(createTestApp())
                .post('/api/campaigns/test-campaign')
                .send({ character: valid5e });

            expect(res.status).toBe(201);
            expect(res.body.fileName).toBe('Shape_Guard_Five.json');
            expect(getMockFs().writeFileSync).toHaveBeenCalled();
        });

        it('still creates a valid 2024 character (201)', async () => {
            mockFreshCampaignDir();

            const res = await request(createTestApp())
                .post('/api/campaigns/test-campaign')
                .send({ character: valid2024 });

            expect(res.status).toBe(201);
            expect(res.body.fileName).toBe('Shape_Guard_Twenty.json');
        });

        it('keeps the duplicate-name 400 ahead of the shape guard', async () => {
            const mfs = getMockFs();
            mfs.existsSync.mockImplementation((p) =>
                String(p) === '/mock/campaigns/test-campaign' || String(p).endsWith('.json'));

            const res = await request(createTestApp())
                .post('/api/campaigns/test-campaign')
                .send({ character: { name: 'QA Minimal Probe', rules: '2024' } });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('A character with that name already exists');
        });
    });

    describe('PUT /api/campaigns/:campaign/:file (save/rename lane shares the hole)', () => {
        it('rejects a minimal body with 400 and leaves the source file in place', async () => {
            const mfs = getMockFs();
            mfs.existsSync.mockReturnValue(true);
            mfs.readFileSync.mockReturnValue(JSON.stringify({ name: 'QA Trim Probe', ...valid5e }));

            const res = await request(createTestApp())
                .put('/api/campaigns/test-campaign/QA_Trim_Probe.json')
                .send({ name: 'QA Trim Probe' });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('Character is missing required data');
            // disk-inert: no replace-write and (for rename bodies) no unlink
            expect(mfs.writeFileSync).not.toHaveBeenCalled();
            expect(mfs.unlinkSync).not.toHaveBeenCalled();
        });

        it('rejects a rename PUT with a sections-less body BEFORE unlinking the source (disk-inert)', async () => {
            const mfs = getMockFs();
            mfs.existsSync.mockReturnValue(true);
            mfs.readFileSync.mockReturnValue(JSON.stringify({ name: 'OldName', ...valid5e }));

            const res = await request(createTestApp())
                .put('/api/campaigns/test-campaign/NewName.json')
                .send({ name: 'NewName', originalFileName: 'OldName.json' });

            expect(res.status).toBe(400);
            expect(mfs.unlinkSync).not.toHaveBeenCalled();
            expect(mfs.writeFileSync).not.toHaveBeenCalled();
        });

        it('still saves a valid full character (200)', async () => {
            const mfs = getMockFs();
            mfs.existsSync.mockReturnValue(true);
            mfs.readFileSync.mockReturnValue(JSON.stringify(valid2024));

            const res = await request(createTestApp())
                .put('/api/campaigns/test-campaign/Shape_Guard_Twenty.json')
                .send({ ...valid2024, level: 2 });

            expect(res.status).toBe(200);
            expect(res.body.message).toBe('Character updated successfully');
        });

        it('keeps the 404 (file missing) ahead of the shape guard', async () => {
            const mfs = getMockFs();
            mfs.existsSync.mockReturnValue(false);

            const res = await request(createTestApp())
                .put('/api/campaigns/test-campaign/Ghost.json')
                .send({ name: 'Ghost' });

            expect(res.status).toBe(404);
            expect(res.body.error).toBe('Character file not found');
        });
    });
});
