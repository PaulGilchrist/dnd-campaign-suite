// SP-125: getWardingBondAcBonus reads the warded creature's warding_bond
// activeBuff acBonus for the AC resolver to fold into effectiveAc.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

import { getWardingBondAcBonus } from './loggedDiceRollUtils.js';
import { getRuntimeValue } from '../runtime/useRuntimeState.js';

describe('getWardingBondAcBonus (SP-125)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns the acBonus from an active warding_bond buff', () => {
        getRuntimeValue.mockReturnValue([{ effect: 'warding_bond', acBonus: 1, sourceCharacter: 'Divine_Cleric' }]);
        expect(getWardingBondAcBonus('EvasiveFighter', 'test-campaign')).toBe(1);
    });

    it('returns 0 when no warding_bond buff exists', () => {
        getRuntimeValue.mockReturnValue([{ effect: 'shield_of_faith' }]);
        expect(getWardingBondAcBonus('EvasiveFighter', 'test-campaign')).toBe(0);
    });

    it('returns 0 when the warding_bond buff carries no acBonus', () => {
        getRuntimeValue.mockReturnValue([{ effect: 'warding_bond' }]);
        expect(getWardingBondAcBonus('EvasiveFighter', 'test-campaign')).toBe(0);
    });

    it('returns 0 without a character name and never reads the store', () => {
        expect(getWardingBondAcBonus(null, 'test-campaign')).toBe(0);
        expect(getRuntimeValue).not.toHaveBeenCalled();
    });

    it('returns 0 when the store value is not an array', () => {
        getRuntimeValue.mockReturnValue(null);
        expect(getWardingBondAcBonus('EvasiveFighter', 'test-campaign')).toBe(0);
    });
});
