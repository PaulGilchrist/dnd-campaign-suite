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
});
