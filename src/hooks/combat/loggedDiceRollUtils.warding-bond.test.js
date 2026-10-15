// @maintained-by-ai: 2026-10-14
// SP-125 AC-bonus seam: wardingBondHandler stamps acBonus:1 on the WARDEE's
// activeBuffs (public/data/spells.json "Warding Bond": +1 AC, +1 saves,
// resistance to all damage, shared damage). The caster-side bond buff carries
// NO acBonus, so the guard `b.effect === 'warding_bond' && b.acBonus` keeps
// the caster from folding it. getWardingBondAcBonus reads the target-side
// stamp for useLoggedDiceRollAttack to fold into effectiveAc — the fold and
// hit/miss boundaries live in useLoggedDiceRollAttack.warding-bond.test.js,
// so don't re-test them here.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { getWardingBondAcBonus } from './loggedDiceRollUtils.js';
import { getRuntimeValue } from '../runtime/useRuntimeState.js';

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
}));

beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(null);
});

describe('getWardingBondAcBonus', () => {
    it('folds the acBonus stamped on the ward-ee, reading the target-side runtime key', () => {
        // Exact shape stamped by wardingBondHandler (SP-125: +1 AC).
        getRuntimeValue.mockImplementation((name, key) => (key === 'activeBuffs'
            ? [{ name: 'Warding Bond', effect: 'warding_bond', acBonus: 1, saveBonus: 1, sourceCharacter: 'Divine_Cleric' }]
            : null));
        expect(getWardingBondAcBonus('EvasiveFighter', 'test-campaign')).toBe(1);
        expect(getRuntimeValue).toHaveBeenCalledWith('EvasiveFighter', 'activeBuffs', 'test-campaign');
    });

    it('returns 0 without a usable stamp — other buffs, the caster-side bond shape, or an empty/invalid store', () => {
        getRuntimeValue.mockReturnValue([{ effect: 'shield_of_faith' }]);
        expect(getWardingBondAcBonus('EvasiveFighter', 'test-campaign')).toBe(0);

        // Caster-side buff from wardingBondHandler: warding_bond effect, no acBonus.
        getRuntimeValue.mockReturnValue([{ effect: 'warding_bond', sourceCharacter: 'Divine_Cleric', bondTarget: 'EvasiveFighter' }]);
        expect(getWardingBondAcBonus('Divine_Cleric', 'test-campaign')).toBe(0);

        // Empty and non-array store values.
        getRuntimeValue.mockReturnValue([]);
        expect(getWardingBondAcBonus('EvasiveFighter', 'test-campaign')).toBe(0);
        getRuntimeValue.mockReturnValue('nonsense');
        expect(getWardingBondAcBonus('EvasiveFighter', 'test-campaign')).toBe(0);
    });

    it('returns 0 without a target name and skips the runtime read', () => {
        expect(getWardingBondAcBonus(null, 'test-campaign')).toBe(0);
        expect(getRuntimeValue).not.toHaveBeenCalled();
    });
});
