// Schema gate on POST /api/campaigns/:campaign/log (owner ruling 2026-11-20,
// backlog 2026-11-20 YY): the lane stays visitor-writable (shared-table
// doctrine, like /spell-overlay) but is no longer schema-free. Forged shapes
// — missing/non-allowlisted type, or no non-empty readable text — 400 with
// plain-English copy and ZERO side effects (no row appended, no log-<c>
// publish). Legitimate allowlisted rows pass byte-identically, extra unknown
// fields included. Conventions mirror log.test.js.
import express from 'express';
import { request } from '../test-utils/localhostSupertest.js';
import logRouter, { logCache, ALLOWED_LOG_TYPES } from './log.js';
import { stampAuditText } from '../../src/services/ui/logService.js';
// Real client registries the allowlist must cover (jsdom vitest env resolves
// these plain .js modules; their JSX component imports are side-effect-free).
import { ENTRY_COMPONENTS } from '../../src/components/log/entryComponents.js';
import { AUDIT_TYPES } from '../../src/components/campaign-admin/auditTypes.js';

const mockFsState = { exists: new Set(), files: new Map() };

vi.mock('fs', () => ({
    default: {
        existsSync: vi.fn((p) => mockFsState.exists.has(p)),
        readFileSync: vi.fn((p) => {
            if (mockFsState.files.has(p)) return mockFsState.files.get(p);
            throw new Error('ENOENT');
        }),
        writeFileSync: vi.fn((p, data) => {
            mockFsState.files.set(p, data);
        }),
    },
    existsSync: vi.fn((p) => mockFsState.exists.has(p)),
    readFileSync: vi.fn((p) => {
        if (mockFsState.files.has(p)) return mockFsState.files.get(p);
        throw new Error('ENOENT');
    }),
    writeFileSync: vi.fn((p, data) => {
        mockFsState.files.set(p, data);
    }),
}));

vi.mock('../utils/campaignPaths.js', () => ({
    campaignDataFile: (campaign, fileName) => `/mock/campaigns/${campaign}/data/${fileName}`,
    campaignDir: (campaign) => `/mock/campaigns/${campaign}`,
    ensureDataDir: vi.fn((name) => {
        mockFsState.exists.add(`/mock/campaigns/${name}/data`);
        return `/mock/campaigns/${name}/data`;
    }),
}));

// characterChangeData: real Map shared with the SUT for addEntry's
// active-session stamp (empty ⇒ rows stamp session: null).
vi.mock('../utils/changeData.js', () => ({
    warnIfNewTopLevelKey: vi.fn(),
    publish: vi.fn(),
    characterChangeData: new Map(),
}));

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(logRouter);
    return app;
}

const LOG_PATH = '/api/campaigns/test-campaign/log';

beforeEach(() => {
    logCache.set('test-campaign', []);
    mockFsState.exists.add('/mock/campaigns/test-campaign');
    mockFsState.exists.add('/mock/campaigns/test-campaign/data');
});

afterEach(() => {
    logCache.clear();
    mockFsState.files.clear();
    mockFsState.exists.clear();
    vi.clearAllMocks();
});

describe('POST /api/campaigns/:campaign/log — schema gate', () => {
    // ── type membership ──────────────────────────────────────────────────────

    it('400s a body missing "type" with plain-English copy, zero side effects', async () => {
        const { publish } = await import('../utils/changeData.js');
        const app = createTestApp();
        const res = await request(app).post(LOG_PATH).send({ message: 'no type here' });

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'Log entry requires a "type" string' });
        expect(logCache.get('test-campaign')).toHaveLength(0);
        expect(publish).not.toHaveBeenCalled();
    });

    it('400s a JSON object that is not log-shaped at all', async () => {
        const { publish } = await import('../utils/changeData.js');
        const app = createTestApp();
        const res = await request(app).post(LOG_PATH).send({ 'not even': 'json-shaped' });

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'Log entry requires a "type" string' });
        expect(logCache.get('test-campaign')).toHaveLength(0);
        expect(publish).not.toHaveBeenCalled();
    });

    it('400s a type NOT in the allowlist and names it in the copy', async () => {
        const { publish } = await import('../utils/changeData.js');
        const app = createTestApp();
        const res = await request(app)
            .post(LOG_PATH)
            .send({ type: 'totally_fake_type', message: 'x' });

        expect(res.status).toBe(400);
        expect(res.body).toEqual({
            error: 'Unknown log entry type: "totally_fake_type" is not a type the app writes to the campaign log',
        });
        expect(logCache.get('test-campaign')).toHaveLength(0);
        expect(publish).not.toHaveBeenCalled();
    });

    it('400s a non-string type (number)', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post(LOG_PATH)
            .send({ type: 42, message: 'numeric type' });

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'Log entry requires a "type" string' });
    });

    it('400s a whitespace-only type', async () => {
        const app = createTestApp();
        const res = await request(app)
            .post(LOG_PATH)
            .send({ type: '   ', message: 'blank type' });

        expect(res.status).toBe(400);
    });

    it('400s non-object bodies (array, JSON "null", JSON string primitive)', async () => {
        const app = createTestApp();

        const arr = await request(app).post(LOG_PATH).send([1, 2, 3]);
        expect(arr.status).toBe(400);
        expect(arr.body.error).toContain('must be a JSON object');

        // JSON primitives never reach the route: express.json() strict mode
        // rejects them with its own entity.parse.failed 400 — still a 400
        // with zero side effects, just different copy.
        const nul = await request(app)
            .post(LOG_PATH)
            .set('Content-Type', 'application/json')
            .send('null');
        expect(nul.status).toBe(400);

        const str = await request(app)
            .post(LOG_PATH)
            .set('Content-Type', 'application/json')
            .send('"just a string"');
        expect(str.status).toBe(400);

        expect(logCache.get('test-campaign')).toHaveLength(0);
    });

    // ── readable-text requirement ────────────────────────────────────────────

    it.each([
        ['missing any readable text field', { type: 'hp_change', threshold: 'dead' }],
        ['empty message and no other text', { type: 'note', message: '' }],
        ['whitespace-only message', { type: 'note', message: '   \t ' }],
        ['non-string message', { type: 'note', message: 123 }],
    ])('400s a valid type with %s, zero side effects', async (_label, body) => {
        const { publish } = await import('../utils/changeData.js');
        const app = createTestApp();
        const res = await request(app).post(LOG_PATH).send(body);

        expect(res.status).toBe(400);
        expect(res.body).toEqual({
            error: 'Log entry requires non-empty human-readable text (a "message" or "description" field)',
        });
        expect(logCache.get('test-campaign')).toHaveLength(0);
        expect(publish).not.toHaveBeenCalled();
    });

    it('blocks the forged death-cue row {type:hp_change, threshold:dead} table-wide', async () => {
        // The exact attack from the backlog bullet: a visitor-crafted hp_change
        // row with threshold 'dead' used to land 200 and feed cueForLogEntry.
        const { publish } = await import('../utils/changeData.js');
        const app = createTestApp();
        const res = await request(app)
            .post(LOG_PATH)
            .send({ type: 'hp_change', threshold: 'dead', isPlayer: true });

        expect(res.status).toBe(400);
        expect(publish).not.toHaveBeenCalled();
    });

    // ── legitimate producer shapes stay byte-compatible ──────────────────────

    it.each([
        ['message', { type: 'roll', message: 'Attack roll', total: 17 }],
        ['description', { type: 'write_rejected', description: 'Server rejected write' }],
        ['noteText', { type: 'note', noteText: 'GM note', characterName: 'GM' }],
        ['summary', { type: 'info', summary: 'Summary-only row' }],
        ['text', { type: 'info', text: "Maze blocked the attack" }],
    ])('200s an allowlisted type carrying %s (existing producer lane)', async (_field, body) => {
        const { publish } = await import('../utils/changeData.js');
        const app = createTestApp();
        const res = await request(app).post(LOG_PATH).send(body);

        expect(res.status).toBe(200);
        expect(typeof res.body.id).toBe('string');
        expect(typeof res.body.timestamp).toBe('number');
        expect(res.body).toMatchObject(body);
        expect(logCache.get('test-campaign')).toHaveLength(1);
        expect(publish).toHaveBeenCalledWith(
            'log-test-campaign',
            expect.objectContaining(body),
            'test-campaign'
        );
    });

    it('200s a legit row with extra unknown fields — passthrough, stamped, broadcast', async () => {
        const { publish } = await import('../utils/changeData.js');
        const app = createTestApp();
        const res = await request(app)
            .post(LOG_PATH)
            .send({ type: 'hp_change', message: 'Goblin takes 7 damage', threshold: 'bloodied', extra: { any: 'shape' } });

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({
            type: 'hp_change',
            message: 'Goblin takes 7 damage',
            threshold: 'bloodied',
            extra: { any: 'shape' },
        });
        expect(publish).toHaveBeenCalledWith('log-test-campaign', res.body, 'test-campaign');
    });

    it('rejects before addEntry: no disk write is scheduled for a forged row', async () => {
        const fsMock = await import('fs');
        const app = createTestApp();
        await request(app).post(LOG_PATH).send({ type: 'totally_fake_type', message: 'x' });

        // The 1s debounce flush only persists cache contents — the cache never
        // gained the forged row, so nothing about it can reach the file.
        await new Promise((r) => setTimeout(r, 1100));
        const written = mockFsState.files.get('/mock/campaigns/test-campaign/data/campaign-log.json');
        expect(written === undefined || written.includes('totally_fake_type')).toBe(false);
        expect(fsMock.default.writeFileSync).not.toHaveBeenCalledWith(
            '/mock/campaigns/test-campaign/data/campaign-log.json',
            expect.stringContaining('totally_fake_type')
        );
    });

    // ── allowlist derivation pins (backlog 2026-11-20 ZZ) ────────────────────
    // These derive from the REAL client registries (not hand-copied arrays):
    // a new key in ENTRY_COMPONENTS or entry in AUDIT_TYPES without a matching
    // ALLOWED_LOG_TYPES member turns one of these RED instead of silently
    // 400-ing the new producer at this gate. deriveAuditText's structured
    // types (roll/hp_change/death_save/encounter/condition) are all
    // ENTRY_COMPONENTS keys, so the first pin covers the stamping lane too.

    it('allowlist covers every render-dispatch type (entryComponents.js ENTRY_COMPONENTS)', () => {
        const missing = Object.keys(ENTRY_COMPONENTS)
            .filter((type) => !ALLOWED_LOG_TYPES.has(type));
        expect(missing).toEqual([]);
    });

    it('allowlist covers every audit-ledger type (auditTypes.js AUDIT_TYPES)', () => {
        const missing = AUDIT_TYPES
            .filter((type) => !ALLOWED_LOG_TYPES.has(type));
        expect(missing).toEqual([]);
    });

    it('both registries are non-empty (a vacuous pin is drift too)', () => {
        expect(Object.keys(ENTRY_COMPONENTS).length).toBeGreaterThan(0);
        expect(AUDIT_TYPES.length).toBeGreaterThan(0);
    });

    // Server-lane producers have no client registry to derive from — these
    // hand-listed types stay pinned so a Set edit can't drop them unnoticed.
    it('allowlist covers the server-lane audit types', () => {
        for (const type of ['write_rejected', 'inventory_transfer', 'ai_authoring',
            'ai_draft_approved', 'ai_draft_rejected', 'adventure_regenerated']) {
            expect(ALLOWED_LOG_TYPES.has(type)).toBe(true);
        }
    });
});

// ── REAL producer-body replay (bug-log-schema-gate-rejects-app-own-combat-rows) ──
// The gate's launch regression: its accept fixtures were hand-written WITH a
// `message`, so the textless shapes the app's own combat producers actually POST
// were never replayed and every real attack row silently 400'd. These bodies are
// byte-exact captures from a live 2026-11-20 fetch spy (Goblin Scimitar chip
// commit + quick-spawn in test-campaign) plus the traced death_save/condition
// producer literals. The client lane (src/services/ui/logService.js
// stampAuditText) stamps a derived audit message onto textless rows before the
// POST; this pins BOTH halves of the lane contract: the raw textless producer
// shape is still exactly what the gate FORBES (a forger crafting the same row by
// hand 400s — the death-cue forgery defense survives), while the stamped wire
// body the app actually sends lands 200 with the broadcast.
const REAL_PRODUCER_BODIES = {
    'roll:attack': {
        type: 'roll', characterName: 'Goblin', rollType: 'attack', name: 'Scimitar',
        rolls: [15], mode: 'normal', total: 15, bonus: 4, bonusDetail: '(+4 to hit)',
        baneRoll: null, isNatural20: false, isNatural1: false,
        targetName: 'ElderPaladin', targetAc: 19, effectiveAc: 19,
        shieldAcBonus: 0, hit: true, isAutoMiss: false, isCrit: false,
        damageType: 'Slashing', coverAcBonus: 0,
    },
    'roll:damage': {
        type: 'roll', characterName: 'Goblin', rollType: 'damage', name: 'Scimitar',
        formula: '1d6 + 2', rolls: [6], total: 8, modifier: 2,
        damageType: 'Slashing', targetName: 'ElderPaladin', finalDamage: 8,
        note: 'combined_damage_roll', isCrit: false, gwfApplied: false,
        resistanceReduction: 0,
    },
    'hp_change': {
        type: 'hp_change', targetName: 'ElderPaladin', delta: -8, currentHp: 216,
        maxHp: 224, isHealing: false, isUnconscious: false,
        damageBreakdown: [{ damageType: 'Slashing', amount: 8, resisted: false, status: null }],
        isPlayer: true,
    },
    'encounter joined': {
        type: 'encounter', action: 'joined', encounterName: 'Quick spawn',
        monsters: ['1x Goblin'],
    },
    'death_save finality': {
        type: 'death_save', characterName: 'EvasiveFighter', result: 'dead',
        totalSuccesses: 1, totalFailures: 3,
    },
    'condition applied': {
        type: 'condition', action: 'applied', characterName: 'ElderPaladin',
        condition: 'Prone', reason: 'Scimitar — until the start of Goblin’s next turn',
        note: 'Falls prone.',
    },
};

describe('POST /api/campaigns/:campaign/log — real producer bodies vs the gate', () => {
    it.each(Object.entries(REAL_PRODUCER_BODIES))(
        'raw textless %s body (a hand-forged attack) still 400s — defense intact',
        async (_label, body) => {
            const { publish } = await import('../utils/changeData.js');
            const app = createTestApp();
            const res = await request(app).post(LOG_PATH).send(body);

            expect(res.status).toBe(400);
            expect(res.body).toEqual({
                error: 'Log entry requires non-empty human-readable text (a "message" or "description" field)',
            });
            expect(logCache.get('test-campaign')).toHaveLength(0);
            expect(publish).not.toHaveBeenCalled();
        }
    );

    it.each(Object.entries(REAL_PRODUCER_BODIES))(
        'stamped %s body (what logService.addEntry sends) lands 200, broadcast',
        async (_label, body) => {
            const { publish } = await import('../utils/changeData.js');
            const app = createTestApp();
            const wire = stampAuditText(body);

            expect(typeof wire.message).toBe('string');
            expect(wire.message.trim().length).toBeGreaterThan(0);

            const res = await request(app).post(LOG_PATH).send(wire);

            expect(res.status).toBe(200);
            expect(res.body).toMatchObject({ ...body, message: wire.message });
            expect(logCache.get('test-campaign')).toHaveLength(1);
            expect(publish).toHaveBeenCalledWith(
                'log-test-campaign',
                expect.objectContaining({ type: body.type, message: wire.message }),
                'test-campaign'
            );
        }
    );
});
