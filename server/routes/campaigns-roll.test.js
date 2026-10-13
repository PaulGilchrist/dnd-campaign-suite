import { request } from '../test-utils/localhostSupertest.js';
import express from 'express';

vi.mock('../utils/changeData.js', () => ({
    characterChangeData: new Map(),
    publish: vi.fn(),
}));
vi.mock('./log.js', () => ({
    addEntry: vi.fn(() => ({})),
}));

import { characterChangeData, publish } from '../utils/changeData.js';
import { addEntry } from './log.js';
import campaignsRoll, { parseExpression, computeRoll } from './campaigns-roll.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(campaignsRoll);
    return app;
}

const SE = { mode: 'on', serverDice: true };
const setEnforcement = (v) => characterChangeData.set('test-campaign', { enforcement: v });

beforeEach(() => {
    vi.clearAllMocks();
    characterChangeData.set('test-campaign', {});
});

describe('parseExpression', () => {
    it('parses dice + optional modifier', () => {
        expect(parseExpression('2d6+3')).toEqual({ count: 2, sides: 6, mod: 3 });
        expect(parseExpression('d8')).toEqual({ count: 1, sides: 8, mod: 0 });
        expect(parseExpression('1d20-1')).toEqual({ count: 1, sides: 20, mod: -1 });
    });
    it('rejects junk, zero dice, bad sides, math', () => {
        expect(parseExpression('foo')).toBeNull();
        expect(parseExpression('0d6')).toBeNull();
        expect(parseExpression('2d1')).toBeNull();
        expect(parseExpression('101d6')).toBeNull();
        expect(parseExpression('2+2')).toBeNull();
    });
});

describe('computeRoll', () => {
    it('advantage keeps the higher d20, disadvantage the lower', () => {
        const adv = computeRoll('1d20', { count: 1, sides: 20, mod: 0 }, 'advantage');
        expect(adv.rolls.length).toBe(2);
        expect(adv.kept).toBe(Math.max(...adv.rolls));
        const dis = computeRoll('1d20', { count: 1, sides: 20, mod: 0 }, 'disadvantage');
        expect(dis.kept).toBe(Math.min(...dis.rolls));
    });
    it('damage dice sum + modifier', () => {
        const r = computeRoll('2d6+1', { count: 2, sides: 6, mod: 1 }, 'normal');
        expect(r.rolls.length).toBe(2);
        expect(r.total).toBe(r.rolls[0] + r.rolls[1] + 1);
        expect(r.roller).toBe('server');
    });
});

describe('POST /api/campaigns/:campaign/roll (L5-002 §7.4)', () => {
    it('403 when enforcement is off (never rolls)', async () => {
        setEnforcement({ mode: 'off' });
        const res = await request(createTestApp()).post('/api/campaigns/test-campaign/roll').send({ expression: '1d20' });
        expect(res.status).toBe(403);
        expect(publish).not.toHaveBeenCalled();
    });

    it('403 when enforcement on but serverDice flag off', async () => {
        setEnforcement({ mode: 'on', serverDice: false });
        const res = await request(createTestApp()).post('/api/campaigns/test-campaign/roll').send({ expression: '1d20' });
        expect(res.status).toBe(403);
    });

    it('server-rolls when serverDice is on, logs + broadcasts', async () => {
        setEnforcement(SE);
        const res = await request(createTestApp()).post('/api/campaigns/test-campaign/roll').send({ expression: '1d20+5', mode: 'advantage', reason: 'attack' });
        expect(res.status).toBe(200);
        expect(res.body.roller).toBe('server');
        expect(res.body.rolls.length).toBe(2);
        expect(res.body.kept).toBe(Math.max(...res.body.rolls));
        expect(res.body.total).toBe(res.body.kept + 5);
        expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({ type: 'roll', roller: 'server' }));
        expect(publish).toHaveBeenCalledWith('server-roll-test-campaign', expect.objectContaining({ total: res.body.total }), 'test-campaign');
    });

    it('400 on a bad expression (flag on)', async () => {
        setEnforcement(SE);
        const res = await request(createTestApp()).post('/api/campaigns/test-campaign/roll').send({ expression: 'drop table' });
        expect(res.status).toBe(400);
    });
});
