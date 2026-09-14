// MA-0102: generalized STR-test roll consumer — any te carrying the generic
// strCheckDisadvantage flag (weakening_breath from Adult Gold Dragon
// Weakening Breath; ray_of_enfeeble_debuff parity) forces Disadvantage on
// the afflicted creature's STR ability/skill checks. Non-STR and save rolls
// are untouched.
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

const TARGET = 'EvasiveFighter';
const weakeningTe = [{
    target: TARGET,
    effect: 'weakening_breath',
    source: 'Adult Gold Dragon 1',
    duration: '1_minute',
    dc: 21,
    saveType: 'Strength',
    strCheckDisadvantage: true,
    damageSubtractDie: '1d6',
}];

beforeEach(() => {
    vi.clearAllMocks();
    rollD20.mockReturnValue(12);
    rollExpression.mockReturnValue({ total: 3, rolls: [3], modifier: 0 });
    tes = [];
});

describe('MA-0102 STR-test disadvantage consumer (via computeD20Roll)', () => {
    it('STR ability check: forcedMode disadvantage, two d20 low kept', () => {
        tes = weakeningTe;
        rollD20.mockReturnValueOnce(15).mockReturnValueOnce(6);
        const r = computeD20Roll({ characterName: TARGET, campaignName: 'test-campaign', name: 'Athletics', rollType: 'check', context: {}, bonus: 5, isResilientSphereActive: () => false });
        expect(r.forcedMode).toBe('disadvantage');
        expect(r.effectiveD20Roll).toBe(6);
    });

    it('skill check keyed STR (Athletics) disadvantaged; INT skill untouched', () => {
        tes = weakeningTe;
        rollD20.mockReturnValueOnce(15).mockReturnValueOnce(6);
        const ath = computeD20Roll({ characterName: TARGET, campaignName: 'test-campaign', name: 'Athletics', rollType: 'skill', context: {}, bonus: 5, isResilientSphereActive: () => false });
        expect(ath.forcedMode).toBe('disadvantage');
        const arc = computeD20Roll({ characterName: TARGET, campaignName: 'test-campaign', name: 'Arcana', rollType: 'skill', context: {}, bonus: 5, isResilientSphereActive: () => false });
        expect(arc.forcedMode).not.toBe('disadvantage');
    });

    it('ray_of_enfeeble_debuff legacy te (no flag) keeps its own keyed behavior', () => {
        tes = [{ ...weakeningTe[0], effect: 'ray_of_enfeeble_debuff' }];
        rollD20.mockReturnValueOnce(15).mockReturnValueOnce(6);
        const r = computeD20Roll({ characterName: TARGET, campaignName: 'test-campaign', name: 'Strength', rollType: 'check', context: {}, bonus: 5, isResilientSphereActive: () => false });
        expect(r.forcedMode).toBe('disadvantage');
    });

    it('te without the flag on the roller is inert', () => {
        tes = [{ ...weakeningTe[0], target: 'SomeoneElse' }];
        const r = computeD20Roll({ characterName: TARGET, campaignName: 'test-campaign', name: 'Athletics', rollType: 'check', context: {}, bonus: 5, isResilientSphereActive: () => false });
        expect(r.forcedMode).not.toBe('disadvantage');
    });
});
