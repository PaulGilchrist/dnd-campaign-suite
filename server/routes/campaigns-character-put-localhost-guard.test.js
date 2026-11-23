// Regression for bug-visitor-edit-wizard-unguarded-character-file-put: the
// character-file PUT lane (the wizard's full-file save/rename) answered
// 200 "Character updated successfully" to any network client while its
// create-POST and DELETE siblings carried refuseUnlessGm — one LAN curl could
// silently REPLACE any player character's canonical file (stat block, HP,
// inventory, features). The earlier owner adjudication kept PUT open on the
// premise that player clients write their own file through it; a caller audit
// (2026-11-23) shows the sole client caller is campaignService.updateCharacter
// ← useCharacterWizard edit save (a GM authoring lane) — player runtime state
// rides the change-data wildcard (non-`.json` keys) and the partial-merge
// PATCH lane (materialComponents). These cases pin: foreign-Host PUT 403 +
// disk-inert + no broadcast, 403-before-404 existence-blindness, the
// fall-through-first ordering (non-`.json` keys stay origin-neutral for the
// change-data router), the GM localhost PUT lane unchanged, and the player
// PATCH lane deliberately OPEN. Mirrors
// campaigns-character-delete-localhost-guard.test.js conventions.
import express from 'express';
import { request } from '../test-utils/localhostSupertest.js';

const FILE_SYSTEM = new Map();

function setupFs(entries) {
    FILE_SYSTEM.clear();
    FILE_SYSTEM.set('/mock/campaigns/test-campaign', '');
    for (const [p, content] of Object.entries(entries)) {
        FILE_SYSTEM.set(p, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
    }
}

vi.mock('fs', () => ({
    default: {
        existsSync: (p) => FILE_SYSTEM.has(p),
        readFileSync: (p) => {
            const val = FILE_SYSTEM.get(p);
            if (val === undefined) throw new Error(`ENOENT: ${p}`);
            return val;
        },
        writeFileSync: (p, c) => FILE_SYSTEM.set(p, c),
        unlinkSync: (p) => { FILE_SYSTEM.delete(p); },
        renameSync: (oldPath, newPath) => {
            const data = FILE_SYSTEM.get(oldPath);
            if (data !== undefined) {
                FILE_SYSTEM.set(newPath, data);
                FILE_SYSTEM.delete(oldPath);
            }
        },
    },
    existsSync: (p) => FILE_SYSTEM.has(p),
    readFileSync: (p) => {
        const val = FILE_SYSTEM.get(p);
        if (val === undefined) throw new Error(`ENOENT: ${p}`);
        return val;
    },
    writeFileSync: (p, c) => FILE_SYSTEM.set(p, c),
    unlinkSync: (p) => { FILE_SYSTEM.delete(p); },
    renameSync: (oldPath, newPath) => {
        const data = FILE_SYSTEM.get(oldPath);
        if (data !== undefined) {
            FILE_SYSTEM.set(newPath, data);
            FILE_SYSTEM.delete(oldPath);
        }
    },
}));

vi.mock('../utils/campaignPaths.js', () => ({
    campaignDir: vi.fn((campaign) => `/mock/campaigns/${campaign}`),
    campaignImagesDir: vi.fn((campaign) => `/mock/campaigns/${campaign}/images`),
}));

vi.mock('../utils/imageUtils.js', () => ({
    processImageUpload: vi.fn(),
    deleteCharacterImage: vi.fn(),
}));

let publishedEvents = [];
vi.mock('../utils/changeData.js', () => ({
    warnIfNewTopLevelKey: vi.fn(),
    publish: vi.fn((key, data) => { publishedEvents.push({ key, data }); }),
    removeChangeDataKey: vi.fn(),
}));

import campaignsCharacter from './campaigns-character.js';

const FOREIGN_HOSTS = ['192.168.0.239', '100.92.171.80', 'example.test'];
const CHAR_FILE = '/mock/campaigns/test-campaign/Victim.json';

// Wizard-shaped full-file body (passes the section-shape guard, same fixture
// recipe as campaigns-character-shape-guard.test.js).
const standardAbilities = () => (
    ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma']
        .map((name) => ({ name, baseScore: 10, featIncrease: 0, backgroundIncrease: 0, miscIncrease: 0 }))
);

const validBody = (overrides = {}) => ({
    name: 'Victim',
    rules: '5e',
    level: 5,
    race: { name: 'Human' },
    class: { name: 'Fighter', subclass: { name: 'Champion' } },
    abilities: standardAbilities(),
    inventory: { magicItems: [], equipped: [] },
    ...overrides,
});

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(campaignsCharacter);
    return app;
}

beforeEach(() => {
    FILE_SYSTEM.clear();
    publishedEvents = [];
});

describe('campaignsCharacter — PUT localhost authority gate', () => {
    it.each(FOREIGN_HOSTS)(
        'PUT a full replacement body over an EXISTING character from %s ⇒ 403, file bytes untouched, no broadcast',
        async (host) => {
            setupFs({ [CHAR_FILE]: validBody({ level: 20 }) });
            const before = FILE_SYSTEM.get(CHAR_FILE);

            const res = await request(createTestApp())
                .put('/api/campaigns/test-campaign/Victim.json')
                .set('Host', host)
                .send(validBody({ level: 1 }));

            expect(res.status).toBe(403);
            expect(res.body.error).toMatch(/GM-only/i);
            expect(FILE_SYSTEM.get(CHAR_FILE)).toBe(before);
            expect(publishedEvents).toHaveLength(0);
        }
    );

    it('answers 403 BEFORE the existence check for a missing file (existence-blind)', async () => {
        // Pre-fix signature was 404 "Character file not found" — proof the
        // route BODY ran for a network client. A gated route never reveals
        // whether the file exists (and update-only stays update-only).
        setupFs({});

        const res = await request(createTestApp())
            .put('/api/campaigns/test-campaign/__NoSuch_Char__.json')
            .set('Host', '192.168.0.239')
            .send(validBody({ name: 'NoSuch Char' }));

        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/GM-only/i);
    });

    it('gate sits AFTER the non-`.json` fall-through: a foreign Host PUT of a change-data key is NOT 403', async () => {
        // bug-visitor-oa-resolution ordering law: the fall-through to the
        // change-data router must run BEFORE the GM gate so shared runtime
        // writes are never captured. Router-alone ⇒ no fall-through handler ⇒
        // supertest 404; the pin is that the answer is NOT the GM 403.
        setupFs({});

        const res = await request(createTestApp())
            .put('/api/campaigns/test-campaign/someRuntimeKey')
            .set('Host', '192.168.0.239')
            .send({ value: 1 });

        expect(res.status).not.toBe(403);
    });

    it('localhost GM wizard save still succeeds (200 + write + broadcast) — edit lane unchanged', async () => {
        setupFs({ [CHAR_FILE]: validBody({ level: 20 }) });

        const res = await request(createTestApp())
            .put('/api/campaigns/test-campaign/Victim.json')
            .set('Host', 'localhost')
            .send(validBody({ level: 21 }));

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Character updated successfully');
        expect(JSON.parse(FILE_SYSTEM.get(CHAR_FILE))).toMatchObject({ level: 21 });
        expect(publishedEvents.find((e) => e.key === 'character-test-campaign-Victim.json')).toBeTruthy();
    });

    it('127.0.0.1 PUT still succeeds for the loopback GM host', async () => {
        setupFs({ [CHAR_FILE]: validBody() });

        const res = await request(createTestApp())
            .put('/api/campaigns/test-campaign/Victim.json')
            .set('Host', '127.0.0.1')
            .send(validBody({ level: 6 }));

        expect(res.status).toBe(200);
        expect(JSON.parse(FILE_SYSTEM.get(CHAR_FILE))).toMatchObject({ level: 6 });
    });

    it('localhost PUT of a genuinely missing file still 404s (behavior below the gate unchanged)', async () => {
        setupFs({});

        const res = await request(createTestApp())
            .put('/api/campaigns/test-campaign/Ghost.json')
            .set('Host', 'localhost')
            .send(validBody({ name: 'Ghost' }));

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Character file not found');
    });

    it('player PATCH lane stays OPEN to network clients by design (materialComponents writes its own file)', async () => {
        // Scope pin: only the full-file PUT wizard lane gained the gate. The
        // partial-merge PATCH lane is a live LAN-player gameplay write (spell
        // material-component consumption) and MUST keep answering 200 —
        // refusing it would break player casting (see PATCH handler comment).
        setupFs({ [CHAR_FILE]: validBody() });

        const res = await request(createTestApp())
            .patch('/api/campaigns/test-campaign/Victim.json')
            .set('Host', '192.168.0.239')
            .send({ inventory: { magicItems: [], equipped: ['Shield'] } });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Character updated successfully');
        expect(JSON.parse(FILE_SYSTEM.get(CHAR_FILE))).toMatchObject({
            inventory: { equipped: ['Shield'] },
        });
    });

    it('player read lane unchanged: non-localhost GET of a character file still 200', async () => {
        setupFs({ [CHAR_FILE]: validBody() });

        const res = await request(createTestApp())
            .get('/api/campaigns/test-campaign/Victim.json')
            .set('Host', '192.168.0.239');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('name', 'Victim');
    });
});
