// @maintained-by-ai
// L5-005 §9.2 — confirmed-ruling apply tests: gated lanes, refusals, audit.
// Every mutating boundary (runtime store, log, dice, effect registry) is
// mocked; the oracle lane stubs fetch to pin the server-roll URL contract.
// Pure dispatcher over a stable applier table — deterministic, no churn
// expected when the app changes.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
}));
vi.mock('../ui/logService.js', () => ({ addEntry: vi.fn(async () => ({})) }));
vi.mock('../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(() => ({ total: 9, rolls: [4, 5] })),
    rollAdvantage: vi.fn(() => ({ total: 17, rolls: [8, 17], label: 'advantage' })),
    rollDisadvantage: vi.fn(() => ({ total: 3, rolls: [3, 12], label: 'disadvantage' })),
}));
vi.mock('../combat/conditions/targetEffectDefinitions.js', () => ({
    getEffectDefinition: vi.fn((key) => (key === 'bless' ? { effect: 'bless' } : null)),
}));

import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../ui/logService.js';
import { rollExpression, rollAdvantage, rollDisadvantage } from '../dice/diceRoller.js';
import { applyRuling, isAtomicRuling } from './applyRuling.js';

const CN = 'test-campaign';
const OFF = { mode: 'off' };

beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(null);
});
afterEach(() => vi.unstubAllGlobals());

describe('applyRuling — atomic ops walk existing lanes', () => {
    it('narrative applies as a logged outcome and audits', async () => {
        const r = await applyRuling({ campaignName: CN, enforcement: OFF, ruling: { type: 'narrative', text: 'The door opens.' } });
        expect(r.applied).toBe(true);
        expect(addEntry).toHaveBeenCalledWith(CN, expect.objectContaining({ type: 'ai_ruling_applied' }));
    });

    it('dice rolls client-side when serverDice is off (engine rolls, never the AI)', async () => {
        const r = await applyRuling({ campaignName: CN, enforcement: OFF, ruling: { type: 'dice', expression: '2d6+3', targetName: 'Goblin' } });
        expect(rollExpression).toHaveBeenCalledWith('2d6+3');
        expect(r.applied).toBe(true);
        expect(r.detail).toContain('→ 9');
        expect(addEntry).toHaveBeenCalledWith(CN, expect.objectContaining({ type: 'roll' }));
    });

    it('d20 advantage and disadvantage use their own lanes', async () => {
        const adv = await applyRuling({ campaignName: CN, enforcement: OFF, ruling: { type: 'dice', expression: '1d20+5', mode: 'advantage' } });
        expect(rollAdvantage).toHaveBeenCalled();
        expect(adv.detail).toMatch(/\(advantage\).*→ 17/);

        const dis = await applyRuling({ campaignName: CN, enforcement: OFF, ruling: { type: 'dice', expression: '1d20+5', mode: 'disadvantage' } });
        expect(rollDisadvantage).toHaveBeenCalled();
        expect(rollAdvantage).toHaveBeenCalledTimes(1);
        expect(dis.detail).toMatch(/\(disadvantage\).*→ 3/);
    });

    it('serverDice ON routes through the oracle (server rolls)', async () => {
        const fetchFn = vi.fn(async () => ({ ok: true, json: async () => ({ total: 14, rolls: [14], roller: 'server' }) }));
        vi.stubGlobal('fetch', fetchFn);
        const r = await applyRuling({ campaignName: CN, enforcement: { mode: 'on', serverDice: true }, ruling: { type: 'dice', expression: '1d20+5' } });
        expect(fetchFn).toHaveBeenCalledWith('/api/campaigns/test-campaign/roll', expect.objectContaining({ method: 'POST' }));
        expect(r.detail).toContain('[server dice]');
    });

    it('target_effect registers through the campaign te store; unknown keys REFUSED', async () => {
        getRuntimeValue.mockReturnValue([{ target: 'X', effect: 'old', source: 'Y' }]);
        const r = await applyRuling({ campaignName: CN, enforcement: OFF, ruling: { type: 'target_effect', effect: 'bless', targetName: 'Hero' } });
        expect(r.applied).toBe(true);
        expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects',
            expect.arrayContaining([expect.objectContaining({ target: 'Hero', effect: 'bless', source: 'AI referee' })]), CN);

        const bad = await applyRuling({ campaignName: CN, enforcement: OFF, ruling: { type: 'target_effect', effect: 'not_a_real_key', targetName: 'Hero' } });
        expect(bad.applied).toBe(false);
        expect(bad.detail).toMatch(/registry/);

        // Re-applying the same target+effect REPLACES (no stacking).
        await applyRuling({ campaignName: CN, enforcement: OFF, ruling: { type: 'target_effect', effect: 'bless', targetName: 'Hero' } });
        const payload = setRuntimeValue.mock.calls.at(-1)[2];
        expect(payload.filter(te => te.effect === 'bless' && te.target === 'Hero')).toHaveLength(1);
    });

    it('hp_change applies to runtime HP with a zero floor; no-runtime-track targets REFUSED', async () => {
        getRuntimeValue.mockImplementation((name, key) => (name === 'Hero' && key === 'currentHitPoints' ? 12 : null));
        const r = await applyRuling({ campaignName: CN, enforcement: OFF, ruling: { type: 'hp_change', targetName: 'Hero', amount: -14 } });
        expect(r.applied).toBe(true);
        expect(setRuntimeValue).toHaveBeenCalledWith('Hero', 'currentHitPoints', 0, CN);
        expect(r.detail).toMatch(/death saves/);

        const npc = await applyRuling({ campaignName: CN, enforcement: OFF, ruling: { type: 'hp_change', targetName: 'Goblin', amount: -5 } });
        expect(npc.applied).toBe(false);
        expect(setRuntimeValue).not.toHaveBeenCalledWith('Goblin', 'currentHitPoints', expect.anything(), CN);
    });
});

describe('applyRuling — never-auto ops', () => {
    it('automation is surfaced, never auto-run (P3 parked)', async () => {
        const r = await applyRuling({ campaignName: CN, enforcement: OFF, ruling: { type: 'automation', actionName: 'Attack with Longsword' } });
        expect(r.applied).toBe(false);
        expect(r.detail).toMatch(/parked|own lane/i);
        expect(addEntry).toHaveBeenCalledWith(CN, expect.objectContaining({ type: 'ai_ruling_applied', description: expect.stringContaining('refused') }));
    });

    it('needs_human passes the referee prompt through untouched, unapplied', async () => {
        const r = await applyRuling({ campaignName: CN, enforcement: OFF, ruling: { type: 'needs_human', text: 'GM decides' } });
        expect(r.applied).toBe(false);
        expect(r.detail).toBe('GM decides');
    });

    it('unknown type refused; apply failure captured, never thrown at the console', async () => {
        expect((await applyRuling({ campaignName: CN, enforcement: OFF, ruling: { type: 'reality_rewrite' } })).applied).toBe(false);
        expect((await applyRuling({ campaignName: CN, enforcement: OFF, ruling: null })).applied).toBe(false);
        getRuntimeValue.mockImplementation(() => { throw new Error('store down'); });
        const r = await applyRuling({ campaignName: CN, enforcement: OFF, ruling: { type: 'hp_change', targetName: 'Hero', amount: -1 } });
        expect(r.applied).toBe(false);
        expect(r.detail).toMatch(/apply failed/);
    });
});

describe('isAtomicRuling', () => {
    it('narrative/dice/hp/effect auto-apply in autopilot; automation & needs_human wait for the referee', () => {
        expect(isAtomicRuling({ type: 'narrative' })).toBe(true);
        expect(isAtomicRuling({ type: 'dice' })).toBe(true);
        expect(isAtomicRuling({ type: 'hp_change' })).toBe(true);
        expect(isAtomicRuling({ type: 'target_effect' })).toBe(true);
        expect(isAtomicRuling({ type: 'automation' })).toBe(false);
        expect(isAtomicRuling({ type: 'needs_human' })).toBe(false);
        expect(isAtomicRuling(null)).toBe(false);
    });
});
