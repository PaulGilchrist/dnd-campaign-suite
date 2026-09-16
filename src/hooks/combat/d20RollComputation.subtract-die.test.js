// MA-0093: generalized subtract-die roll-time consumer — giggling_magic_debuff
// te (subtractDie 1d6) subtracts a rolled 1d6 from attack rolls AND ability
// checks of the afflicted creature until its expiration clock drains the te.
// Bane/Blade Ward stays attack-only 1d4 (MA-0070 era behavior).
import { describe, it, expect, vi, beforeEach } from 'vitest';

const rollD20 = vi.fn(() => 12);
const rollExpression = vi.fn(() => ({ total: 3, rolls: [3], modifier: 0 }));
vi.mock('../../services/dice/diceRoller.js', () => ({
    rollD20: (...args) => rollD20(...args),
    rollExpression: (...args) => rollExpression(...args),
}));

let tes = [];
vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: (name, key) => (key === 'targetEffects' ? tes : undefined),
    setRuntimeValue: vi.fn(),
}));

vi.mock('./starryDragon.js', () => ({
    hasStarryDragonActive: () => false,
    starryDragonAppliesToRoll: () => false,
}));

import { computeD20Roll } from './d20RollComputation.js';

const TARGET = 'AberrantSorcerer';
const gigglingTe = [{
    target: TARGET,
    effect: 'giggling_magic_debuff',
    source: 'Adult Copper Dragon 1',
    duration: 'until_end_of_next_turn',
    subtractDie: '1d6',
    displayLabel: 'Giggling Magic',
}];

beforeEach(() => {
    vi.clearAllMocks();
    rollD20.mockReturnValue(12);
    rollExpression.mockReturnValue({ total: 3, rolls: [3], modifier: 0 });
    tes = [];
});

describe('MA-0093 computeSubtractDiePenalty (via computeD20Roll)', () => {
    it('attack roll: subtracts rolled 1d6, labels [Giggling Magic], carries subtractDie', () => {
        tes = gigglingTe;
        const r = computeD20Roll({ characterName: TARGET, campaignName: 'test-campaign', name: 'Fire Bolt', rollType: 'attack', context: { targetName: 'Adult Copper Dragon 1' }, bonus: 7, isResilientSphereActive: () => false });
        expect(rollExpression).toHaveBeenCalledWith('1d6');
        expect(r.subtractDiePenalty).toBe(-3);
        expect(r.subtractDieRoll).toBe(3);
        expect(r.subtractDie).toBe('1d6');
        expect(r.effectiveBonus).toBe(4);
        expect(r.finalBonusDetail).toContain('[Giggling Magic]');
    });

    it('ability check: subtract-die rider applies (RAW checks + attacks)', () => {
        tes = gigglingTe;
        const r = computeD20Roll({ characterName: TARGET, campaignName: 'test-campaign', name: 'Arcana', rollType: 'check', context: {}, bonus: 9, isResilientSphereActive: () => false });
        expect(rollExpression).toHaveBeenCalledWith('1d6');
        expect(r.effectiveBonus).toBe(6);
        expect(r.finalBonusDetail).toContain('[Giggling Magic]');
    });

    it('save roll: rider NOT applied (RAW checks + attacks only)', () => {
        tes = gigglingTe;
        const r = computeD20Roll({ characterName: TARGET, campaignName: 'test-campaign', name: 'Death', rollType: 'save', context: {}, bonus: -1, isResilientSphereActive: () => false });
        expect(rollExpression).not.toHaveBeenCalled();
        expect(r.effectiveBonus).toBe(-1);
    });

    it('bane_penalty stays attack-only 1d4 on checks (locked legacy behavior)', () => {
        tes = [{ target: TARGET, effect: 'bane_penalty' }];
        const r = computeD20Roll({ characterName: TARGET, campaignName: 'test-campaign', name: 'Athletics', rollType: 'check', context: {}, bonus: 5, isResilientSphereActive: () => false });
        expect(rollExpression).not.toHaveBeenCalled();
        expect(r.baneAttackPenalty).toBe(0);
        expect(r.effectiveBonus).toBe(5);
    });

    it('te without the effect on the roller is inert', () => {
        tes = [{ ...gigglingTe[0], target: 'SomeoneElse' }];
        const r = computeD20Roll({ characterName: TARGET, campaignName: 'test-campaign', name: 'Fire Bolt', rollType: 'attack', context: { targetName: 'Adult Copper Dragon 1' }, bonus: 7, isResilientSphereActive: () => false });
        expect(rollExpression).not.toHaveBeenCalled();
        expect(r.effectiveBonus).toBe(7);
    });
});
