// @maintained-by-ai 2026-11-26
// L5-005 §9.2 — confirmed-ruling apply tests: gated lanes, refusals, audit.
// Mutating boundaries (runtime store, log, dice, effect registry) are mocked;
// the oracle lane stubs fetch because the server-roll URL POST *is* the seam
// contract (the server half is covered by server/routes/campaigns-roll.test.js,
// the rendering half by LogAiAudit.test.jsx — this file owns the writer).
// Failure COPY law is owned by applyFailureCopy.test.js — only the routed raw
// tail is pinned here. Audit wording 'AI ruling applied/refused:' is ours.
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

// The audit row written for the (0-based) apply call made in this test.
const auditRow = (index = 0) => addEntry.mock.calls[index][1];

beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(null);
});
afterEach(() => vi.unstubAllGlobals());

describe('applyRuling — atomic ops walk existing lanes', () => {
    it('narrative applies as a logged outcome; audit row is shaped', async () => {
        const r = await applyRuling({ campaignName: CN, enforcement: OFF, ruling: { type: 'narrative', text: 'The door opens.' } });
        expect(r.applied).toBe(true);
        expect(r.detail).toBe('The door opens.');
        expect(addEntry).toHaveBeenCalledWith(CN, expect.objectContaining({
            type: 'ai_ruling_applied',
            // MMM 2026-11-21: characterName is the sole author field — the row
            // used to stamp `name` and render an empty .log-character.
            characterName: 'AI referee',
        }));
        expect(auditRow()).not.toHaveProperty('name');
        expect(auditRow().description).toContain('AI ruling applied: narrative');
    });

    it('dice rolls client-side when serverDice is off (engine rolls, never the AI)', async () => {
        const r = await applyRuling({ campaignName: CN, enforcement: OFF, ruling: { type: 'dice', expression: '2d6+3', targetName: 'Goblin' } });
        expect(rollExpression).toHaveBeenCalledWith('2d6+3');
        expect(r.applied).toBe(true);
        expect(r.detail).toContain('→ 9');
        expect(addEntry).toHaveBeenCalledWith(CN, expect.objectContaining({ type: 'roll' }));
    });

    it('d20 advantage/disadvantage use their own lanes; non-d20 with a mode falls back to the plain roll', async () => {
        const adv = await applyRuling({ campaignName: CN, enforcement: OFF, ruling: { type: 'dice', expression: '1d20+5', mode: 'advantage' } });
        expect(rollAdvantage).toHaveBeenCalled();
        expect(adv.detail).toMatch(/\(advantage\).*→ 17/);

        const dis = await applyRuling({ campaignName: CN, enforcement: OFF, ruling: { type: 'dice', expression: '1d20+5', mode: 'disadvantage' } });
        expect(rollDisadvantage).toHaveBeenCalled();
        expect(rollAdvantage).toHaveBeenCalledTimes(1);
        expect(dis.detail).toMatch(/\(disadvantage\).*→ 3/);

        // advantage is a d20-only lane — a 2d6 with a mode never fakes it
        const plain = await applyRuling({ campaignName: CN, enforcement: OFF, ruling: { type: 'dice', expression: '2d6+3', mode: 'advantage' } });
        expect(plain.applied).toBe(true);
        expect(rollAdvantage).toHaveBeenCalledTimes(1);
        expect(rollExpression).toHaveBeenCalledWith('2d6+3');
        expect(plain.detail).toContain('→ 9');
    });

    it('serverDice ON routes through the oracle; the flag alone (mode off) never hits the server', async () => {
        const fetchFn = vi.fn(async () => ({ ok: true, json: async () => ({ total: 14, rolls: [14], roller: 'server' }) }));
        vi.stubGlobal('fetch', fetchFn);
        const r = await applyRuling({ campaignName: CN, enforcement: { mode: 'on', serverDice: true }, ruling: { type: 'dice', expression: '1d20+5' } });
        expect(fetchFn).toHaveBeenCalledWith('/api/campaigns/test-campaign/roll', expect.objectContaining({ method: 'POST' }));
        expect(r.detail).toContain('[server dice]');

        // oracle needs BOTH gates — mode 'on' without serverDice stays client-side
        await applyRuling({ campaignName: CN, enforcement: { mode: 'on' }, ruling: { type: 'dice', expression: '1d20+5' } });
        expect(fetchFn).toHaveBeenCalledTimes(1);
        expect(rollExpression).toHaveBeenCalledWith('1d20+5');
    });

    it('target_effect registers through the campaign te store; unknown keys REFUSED', async () => {
        getRuntimeValue.mockReturnValue([{ target: 'X', effect: 'old', source: 'Y' }]);
        const r = await applyRuling({ campaignName: CN, enforcement: OFF, ruling: { type: 'target_effect', effect: 'bless', targetName: 'Hero' } });
        expect(r.applied).toBe(true);
        expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects',
            expect.arrayContaining([expect.objectContaining({ target: 'Hero', effect: 'bless', source: 'AI referee' })]), CN);

        const bad = await applyRuling({ campaignName: CN, enforcement: OFF, ruling: { type: 'target_effect', effect: 'not_a_real_key', targetName: 'Hero' } });
        expect(bad.applied).toBe(false);
        // the registry-honesty tokens — the card pre-filter must not soften this lane
        expect(bad.detail).toContain("unknown target effect 'not_a_real_key'");
        expect(bad.detail).toContain('(refused)');

        // Re-applying the same target+effect REPLACES (no stacking).
        await applyRuling({ campaignName: CN, enforcement: OFF, ruling: { type: 'target_effect', effect: 'bless', targetName: 'Hero' } });
        const payload = setRuntimeValue.mock.calls.at(-1)[2];
        expect(payload.filter(te => te.effect === 'bless' && te.target === 'Hero')).toHaveLength(1);
    });

    it('hp_change applies to runtime HP with a zero floor; no-runtime-track targets REFUSED', async () => {
        getRuntimeValue.mockImplementation((name, key) => (name === 'Hero' && key === 'currentHitPoints' ? 12 : null));
        const r = await applyRuling({ campaignName: CN, enforcement: OFF, ruling: { type: 'hp_change', targetName: 'Hero', expression: '2d8+1', amount: -14 } });
        expect(r.applied).toBe(true);
        expect(setRuntimeValue).toHaveBeenCalledWith('Hero', 'currentHitPoints', 0, CN);
        expect(r.detail).toMatch(/death saves/);

        const npc = await applyRuling({ campaignName: CN, enforcement: OFF, ruling: { type: 'hp_change', targetName: 'Goblin', expression: '1d6', amount: -5 } });
        expect(npc.applied).toBe(false);
        expect(setRuntimeValue).not.toHaveBeenCalledWith('Goblin', 'currentHitPoints', expect.anything(), CN);
    });
});

describe('applyRuling — never-auto ops and refusals', () => {
    it('automation and needs_human are surfaced, never auto-run (P3 parked)', async () => {
        const auto = await applyRuling({ campaignName: CN, enforcement: OFF, ruling: { type: 'automation', actionName: 'Attack with Longsword' } });
        expect(auto.applied).toBe(false);
        expect(auto.detail).toMatch(/parked|own lane/i);
        expect(auditRow(0).description).toContain('AI ruling refused: automation');

        const human = await applyRuling({ campaignName: CN, enforcement: OFF, ruling: { type: 'needs_human', text: 'GM decides' } });
        expect(human.applied).toBe(false);
        expect(human.detail).toBe('GM decides');
    });

    it('unknown/null rulings refused; apply failure captured with its raw tail, never thrown at the console', async () => {
        expect((await applyRuling({ campaignName: CN, enforcement: OFF, ruling: { type: 'reality_rewrite' } })).applied).toBe(false);
        expect((await applyRuling({ campaignName: CN, enforcement: OFF, ruling: null })).applied).toBe(false);

        // throw → plain-English refusal (copy law owned by applyFailureCopy.test.js);
        // here only the routed raw tail is pinned, mirroring the director lane
        getRuntimeValue.mockImplementation(() => { throw new Error('store down'); });
        const r = await applyRuling({ campaignName: CN, enforcement: OFF, ruling: { type: 'hp_change', targetName: 'Hero', expression: '1d6', amount: -1 } });
        expect(r.applied).toBe(false);
        expect(r.detail).toContain('store down');
    });
});

describe('isAtomicRuling', () => {
    it('narrative/dice/hp/effect auto-apply in autopilot; automation & needs_human wait for the referee', () => {
        for (const type of ['narrative', 'dice', 'hp_change', 'target_effect']) {
            expect(isAtomicRuling({ type })).toBe(true);
        }
        expect(isAtomicRuling({ type: 'automation' })).toBe(false);
        expect(isAtomicRuling({ type: 'needs_human' })).toBe(false);
        expect(isAtomicRuling(null)).toBe(false);
    });
});
