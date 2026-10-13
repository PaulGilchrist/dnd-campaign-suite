import { request } from '../test-utils/localhostSupertest.js';
import express from 'express';

vi.mock('../utils/changeData.js', () => ({
    characterChangeData: new Map(),
    publish: vi.fn(),
    saveFile: vi.fn(),
    debouncedSave: vi.fn(),
    markDirty: vi.fn(),
}));

import { characterChangeData, publish, markDirty } from '../utils/changeData.js';
import campaignsChangedata from './campaigns-changedata.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(campaignsChangedata);
    return app;
}

const VALID_ENFORCEMENT = { mode: 'on', turnLock: true, actionEconomy: true };
const VALID_TURN_STATE = {
    Rakan: { actionsUsed: 1, bonusActionsUsed: 0, reactionsUsed: 0, movementUsedFeet: 10, hasMoved: true, turnActive: true },
};

beforeEach(() => {
    vi.mocked(markDirty).mockClear();
    vi.mocked(publish).mockClear();
    characterChangeData.set('test-campaign', {});
});

describe('L5-001 change-data validation chokepoint', () => {
    describe('pass-through guarantee (L1–4)', () => {
        it('unregistered keys write exactly as before', async () => {
            const res = await request(createTestApp())
                .post('/api/campaigns/test-campaign/combatSummary')
                .send({ value: { round: 2, activeCreatureName: 'Rakan' } });
            expect(res.status).toBe(200);
            expect(characterChangeData.get('test-campaign').combatSummary.round).toBe(2);
        });

        it('enforcement writes pass freely while enforcement is OFF (default)', async () => {
            const res = await request(createTestApp())
                .post('/api/campaigns/test-campaign/enforcement')
                .set('Host', '10.0.0.5')
                .send({ value: VALID_ENFORCEMENT });
            expect(res.status).toBe(200);
            expect(characterChangeData.get('test-campaign').enforcement).toEqual(VALID_ENFORCEMENT);
        });
    });

    describe('enforcement shape', () => {
        it('rejects unknown flags', async () => {
            const res = await request(createTestApp())
                .post('/api/campaigns/test-campaign/enforcement')
                .send({ value: { mode: 'on', cheatMode: true } });
            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/unknown enforcement flag/);
            expect(characterChangeData.get('test-campaign').enforcement).toBeUndefined();
        });

        it('rejects invalid mode', async () => {
            const res = await request(createTestApp())
                .post('/api/campaigns/test-campaign/enforcement')
                .send({ value: { mode: 'yes' } });
            expect(res.status).toBe(400);
        });

        it('rejects non-boolean flags', async () => {
            const res = await request(createTestApp())
                .post('/api/campaigns/test-campaign/enforcement')
                .send({ value: { mode: 'on', turnLock: 'true' } });
            expect(res.status).toBe(400);
        });
    });

    describe('turnState shape + sanity caps', () => {
        it('accepts a well-formed economy', async () => {
            const res = await request(createTestApp())
                .post('/api/campaigns/test-campaign/turnState')
                .send({ value: VALID_TURN_STATE });
            expect(res.status).toBe(200);
            expect(characterChangeData.get('test-campaign').turnState.Rakan.movementUsedFeet).toBe(10);
        });

        it('rejects negative budget counters', async () => {
            const res = await request(createTestApp())
                .post('/api/campaigns/test-campaign/turnState')
                .send({ value: { Goblin: { ...VALID_TURN_STATE.Rakan, actionsUsed: -1 } } });
            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/actionsUsed/);
        });

        it('rejects fabricated over-cap budgets', async () => {
            const res = await request(createTestApp())
                .post('/api/campaigns/test-campaign/turnState')
                .send({ value: { Goblin: { ...VALID_TURN_STATE.Rakan, actionsUsed: 7 } } });
            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/sanity cap/);
        });

        it('rejects garbage entries', async () => {
            const res = await request(createTestApp())
                .post('/api/campaigns/test-campaign/turnState')
                .send({ value: { Goblin: 'whatever' } });
            expect(res.status).toBe(400);
        });
    });

    describe('referee authority while enforcement is ON', () => {
        beforeEach(() => {
            characterChangeData.get('test-campaign').enforcement = VALID_ENFORCEMENT;
            characterChangeData.get('test-campaign').referee = { name: 'Rakan', clientId: 'cid-ref-1' };
        });

        it('non-localhost anonymous write ⇒ 400 + denied SSE event', async () => {
            const res = await request(createTestApp())
                .post('/api/campaigns/test-campaign/enforcement')
                .set('Host', '10.0.0.5')
                .send({ value: { mode: 'off' } });
            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/referee/);
            expect(characterChangeData.get('test-campaign').enforcement.mode).toBe('on'); // unchanged
            expect(publish).toHaveBeenCalledWith(
                'denied-test-campaign-enforcement',
                expect.objectContaining({ key: 'enforcement' }),
                'test-campaign',
            );
        });

        it('referee client id ⇒ allowed', async () => {
            const res = await request(createTestApp())
                .post('/api/campaigns/test-campaign/enforcement')
                .set('Host', '10.0.0.5')
                .set('X-Client-Id', 'cid-ref-1')
                .send({ value: { mode: 'off' } });
            expect(res.status).toBe(200);
            expect(characterChangeData.get('test-campaign').enforcement.mode).toBe('off');
        });

        it('localhost always retains authority', async () => {
            const res = await request(createTestApp())
                .post('/api/campaigns/test-campaign/referee')
                .send({ value: null });
            expect(res.status).toBe(200);
            expect(characterChangeData.get('test-campaign').referee).toBeNull();
        });

        it('referee key still shape-checked', async () => {
            const res = await request(createTestApp())
                .post('/api/campaigns/test-campaign/referee')
                .send({ value: { name: '', clientId: 'x' } });
            expect(res.status).toBe(400);
        });
    });

    describe('aiConfig (Phase 3 §9, D3 privacy contract)', () => {
        const LOCAL = { endpoint: 'http://localhost:11434', model: 'llama3.1:8b', mode: 'suggest' };

        function proxyApp() {
            const app = createTestApp();
            app.set('trust proxy', true);
            return app;
        }

        it('null ⇒ allowed (AI unset = today)', async () => {
            const res = await request(createTestApp())
                .post('/api/campaigns/test-campaign/aiConfig')
                .send({ value: null });
            expect(res.status).toBe(200);
        });

        it('local endpoint + known mode ⇒ accepted from localhost', async () => {
            const res = await request(createTestApp())
                .post('/api/campaigns/test-campaign/aiConfig')
                .send({ value: LOCAL });
            expect(res.status).toBe(200);
            expect(characterChangeData.get('test-campaign').aiConfig.mode).toBe('suggest');
        });

        it('REMOTE endpoint ⇒ 400 — campaign/world data must never leave the machine', async () => {
            for (const mode of ['suggest', 'autopilot']) {
                const res = await request(createTestApp())
                    .post('/api/campaigns/test-campaign/aiConfig')
                    .send({ value: { ...LOCAL, mode, endpoint: 'https://api.openai.com' } });
                expect(res.status).toBe(400);
                expect(res.body.reason || JSON.stringify(res.body)).toMatch(/LOCAL/i);
            }
        });

        it('unknown mode / bad temperature / missing model ⇒ 400', async () => {
            const bad = [
                { ...LOCAL, mode: 'yolo' },
                { ...LOCAL, temperature: 9 },
                { endpoint: 'http://localhost:11434', mode: 'suggest' },
                { ...LOCAL, provider: 'claude' },
            ];
            for (const value of bad) {
                const res = await request(createTestApp())
                    .post('/api/campaigns/test-campaign/aiConfig')
                    .send({ value });
                expect(res.status).toBe(400);
            }
        });

        it('ENGAGING the AI from a non-localhost anonymous client ⇒ 400 (a write that turns AI on is an act of authority)', async () => {
            const res = await request(proxyApp())
                .post('/api/campaigns/test-campaign/aiConfig')
                .set('Host', '203.0.113.7')
                .send({ value: LOCAL });
            expect(res.status).toBe(400);
        });

        it('engaged aiConfig change by referee clientId ⇒ allowed', async () => {
            characterChangeData.get('test-campaign').referee = { name: 'Ref', clientId: 'ref-1' };
            characterChangeData.get('test-campaign').aiConfig = LOCAL;
            const res = await request(proxyApp())
                .post('/api/campaigns/test-campaign/aiConfig')
                .set('Host', '203.0.113.7')
                .set('X-Client-Id', 'ref-1')
                .send({ value: { ...LOCAL, mode: 'autopilot' } });
            expect(res.status).toBe(200);
        });
    });
});

// H1 hardening (§17): monster-side economy property scan at the chokepoint.
describe('H1 monster-economy shape validation (§17)', () => {
    const monster = (props) => request(createTestApp())
        .post('/api/campaigns/test-campaign/Goblin%201')
        .send({ value: props });

    it('accepts honest legendary/recharge state (byte pass-through)', async () => {
        const res = await monster({
            activeConditions: ['prone'],
            monsterLegendaryUses: { max: 3, used: 1 },
            _legendaryUses_usedRound: { round: 2, activeCreature: 'Rakan' },
            monsterLegendaryActionCooldowns: { scorching_sands: { round: 2, usedBefore: 0 } },
            monsterRecharge: { 'Fire Breath': { recharged: false, threshold: 5 } },
        });
        expect(res.status).toBe(200);
        expect(characterChangeData.get('test-campaign')['Goblin 1'].monsterLegendaryUses.used).toBe(1);
    });

    it('refuses legendary used > max — a client cannot self-forgery past exhaustion', async () => {
        const res = await monster({ monsterLegendaryUses: { max: 3, used: 4 } });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/exceeds max/);
    });

    it('refuses negative/fractional legendary spends', async () => {
        expect((await monster({ monsterLegendaryUses: { max: 3, used: -1 } })).status).toBe(400);
        expect((await monster({ monsterLegendaryUses: { max: 3, used: 1.5 } })).status).toBe(400);
    });

    it('refuses recharge thresholds outside the authored d6 range 1..6', async () => {
        expect((await monster({ monsterRecharge: { 'Breath': { recharged: false, threshold: 9 } } })).status).toBe(400);
        expect((await monster({ monsterRecharge: { 'Breath': { recharged: 'yes' } } })).status).toBe(400);
    });

    it('accepts authored low thresholds (1 and 3 exist in monsters.json)', async () => {
        const res = await monster({ monsterRecharge: { 'Breath': { recharged: true, threshold: 1 } } });
        expect(res.status).toBe(200);
    });

    it('null-cleared economy state stays legal (regain/clear seams)', async () => {
        const res = await monster({
            monsterLegendaryUses: null,
            _legendaryUses_usedRound: null,
            monsterLegendaryActionCooldowns: null,
            monsterRecharge: null,
        });
        expect(res.status).toBe(200);
    });

    it('stores without economy props are untouched by the scan', async () => {
        const res = await monster({ activeConditions: ['stunned'], hitPoints: 7 });
        expect(res.status).toBe(200);
    });
});

// P4-a (§10.1): session orchestration truth at the chokepoint.
describe('P4-a sessionState validation (§10.1)', () => {
    const post = (value) => request(createTestApp())
        .post('/api/campaigns/test-campaign/sessionState')
        .send({ value });

    it('accepts the four authored phases, then null clears to unset', async () => {
        for (const phase of ['exploration', 'encounter', 'travel', 'roleplay']) {
            expect((await post({ phase, changedBy: 'referee console' })).status).toBe(200);
        }
        expect(characterChangeData.get('test-campaign').sessionState.phase).toBe('roleplay');
        // Unset write ⇒ null lands (readSessionPhase defaults to exploration).
        expect((await post(null)).status).toBe(200);
        expect(characterChangeData.get('test-campaign').sessionState).toBeNull();
    });

    it('refuses an unknown phase — the enum is the contract', async () => {
        const res = await post({ phase: 'murderhobo-carnival' });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/phase must be one of/);
    });

    it('refuses non-object shapes and junk timestamps', async () => {
        expect((await post('encounter')).status).toBe(400);
        expect((await post({ phase: 'encounter', changedAt: 'soon' })).status).toBe(400);
    });
});

// P4-b (§10.2): auto-encounters rides the enforcement flag set.
describe('P4-b enforcement.autoEncounters flag (§10.2)', () => {
    const post = (enforcement) => request(createTestApp())
        .post('/api/campaigns/test-campaign/enforcement')
        .set('X-Client-Id', 'cid-hoster')
        .send({ value: enforcement });

    it('accepts autoEncounters with the same honesty contract as the other flags', async () => {
        const good = await post({ mode: 'off', autoEncounters: true });
        expect(good.status).toBe(200);
        const junk = await post({ mode: 'off', autoEncounters: 'sure' });
        expect(junk.status).toBe(400);
    });
});
