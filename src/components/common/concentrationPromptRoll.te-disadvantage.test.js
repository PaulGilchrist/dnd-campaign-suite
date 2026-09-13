import { describe, it, expect, vi, beforeEach } from 'vitest';

// MA-0038: te-driven concentration disadvantage in the PC concentration
// prompt roll (Adult Black Dragon Cloud of Insects failed-save clause).

const d20Seq = [];
vi.mock('../../services/dice/diceRoller.js', () => ({
    rollD20: () => d20Seq.shift(),
}));

let activeTe = null;
vi.mock('../../services/combat/conditions/targetEffectDefinitions.js', () => ({
    getActiveTargetEffect: (_c, targetName, effectKey) =>
        (activeTe && targetName === activeTe.target && effectKey === activeTe.effect) ? activeTe : null,
}));

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
    hasSaveModifier: () => false,
}));

vi.mock('../../services/combat/conditions/conditionUtils.js', () => ({
    getAbilitySaveBonus: () => 5,
}));

vi.mock('./savePromptUtils.js', () => ({
    getHolyAuraSaveAdvantage: () => false,
}));

import { resolveConcentrationRoll } from './concentrationPromptRoll.js';

const TARGET = 'AberrantSorcerer';
const current = { targetName: TARGET, spellName: 'Haste', dc: 13, attackerName: 'Adult Black Dragon 1' };

beforeEach(() => {
    d20Seq.length = 0;
    activeTe = null;
});

describe('MA-0038 resolveConcentrationRoll te disadvantage', () => {
    it('target carrying concentration_disadvantage te: rolls 2d20 keep-low, mode disadvantage, attributed', () => {
        activeTe = { target: TARGET, effect: 'concentration_disadvantage', source: 'Adult Black Dragon 1', actionName: 'Cloud of Insects' };
        d20Seq.push(17, 4);

        const r = resolveConcentrationRoll({ current, characters: [], campaignName: 'test-campaign', auraBonus: 0, auraSourceName: undefined });

        expect(r.rawRolls).toEqual([17, 4]);
        expect(r.roll).toBe(4);
        expect(r.total).toBe(4);
        expect(r.mode).toBe('disadvantage');
        expect(r.disadvantageSource).toBe('Cloud of Insects');
    });

    it('no te, plain attacker: single d20, normal mode, no attribution', () => {
        d20Seq.push(11);

        const r = resolveConcentrationRoll({ current, characters: [], campaignName: 'test-campaign', auraBonus: 0, auraSourceName: undefined });

        expect(r.rawRolls).toEqual([11]);
        expect(r.roll).toBe(11);
        expect(r.mode).toBe('normal');
        expect(r.disadvantageSource).toBeNull();
    });

    it('expired te (absent from store): no disadvantage — clause drains with its clock', () => {
        d20Seq.push(15);

        const r = resolveConcentrationRoll({ current, characters: [], campaignName: 'test-campaign', auraBonus: 0, auraSourceName: undefined });

        expect(r.rawRolls).toEqual([15]);
        expect(r.mode).toBe('normal');
        expect(r.success).toBe(true);
    });
});
