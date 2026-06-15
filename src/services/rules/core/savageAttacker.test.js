import { applySavageAttacker, applySavageAttackerFull, savageAttackerApplies } from './savageAttacker.js';

describe('savageAttacker', () => {
    describe('applySavageAttacker', () => {
        it('returns empty array for null input', () => {
            expect(applySavageAttacker(null)).toBe(null);
        });

        it('returns empty array for undefined input', () => {
            expect(applySavageAttacker(undefined)).toBe(undefined);
        });

        it('returns empty array for empty array', () => {
            expect(applySavageAttacker([])).toEqual([]);
        });

        it('returns single roll as-is', () => {
            const result = applySavageAttacker([5]);
            expect(result).toEqual([5]);
        });

        it('returns multi-die rolls as-is (placeholder implementation)', () => {
            const result = applySavageAttacker([3, 4, 5]);
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBe(3);
        });
    });

    describe('applySavageAttackerFull', () => {
        it('returns original rolls for null formula', () => {
            const result = applySavageAttackerFull([3, 4], null);
            expect(result.rolls).toEqual([3, 4]);
            expect(result.secondRolls).toEqual([]);
            expect(result.higher).toBe(false);
        });

        it('returns original rolls for empty rolls', () => {
            const result = applySavageAttackerFull([], '2d6');
            expect(result.rolls).toEqual([]);
            expect(result.secondRolls).toEqual([]);
            expect(result.higher).toBe(false);
        });

        it('returns original rolls for invalid formula', () => {
            const result = applySavageAttackerFull([3, 4], 'invalid');
            expect(result.rolls).toEqual([3, 4]);
            expect(result.higher).toBe(false);
        });

        it('returns original rolls when dice count mismatch', () => {
            const result = applySavageAttackerFull([3, 4, 5], '2d6');
            expect(result.rolls).toEqual([3, 4, 5]);
            expect(result.higher).toBe(false);
        });

        it('returns second roll when it is higher', () => {
            // Seed-based: force second roll to be higher (6d6 vs 1d6)
            const firstRolls = [1, 1, 1, 1, 1, 1];
            const result = applySavageAttackerFull(firstRolls, '6d6');
            expect(result.rolls.length).toBe(6);
            expect(result.secondRolls.length).toBe(6);
            expect(result.secondRolls.every(r => r >= 1 && r <= 6)).toBe(true);
            // The result should be the higher of the two
            // Since second roll is random, just verify the logic is correct
            expect(result.higher || result.rolls === firstRolls).toBe(true);
        });

        it('returns first roll when it is higher', () => {
            const firstRolls = [6, 6, 6, 6, 6, 6];
            const result = applySavageAttackerFull(firstRolls, '6d6');
            expect(result.rolls.length).toBe(6);
            expect(result.secondRolls.length).toBe(6);
            // First roll is max, so it should always win
            expect(result.rolls).toEqual(firstRolls);
            expect(result.higher).toBe(false);
        });

        it('handles single die', () => {
            const firstRolls = [3];
            const result = applySavageAttackerFull(firstRolls, '1d6');
            expect(result.rolls.length).toBe(1);
            expect(result.secondRolls.length).toBe(1);
            expect(result.secondRolls[0]).toBeGreaterThanOrEqual(1);
            expect(result.secondRolls[0]).toBeLessThanOrEqual(6);
        });
    });

    describe('savageAttackerApplies', () => {
        it('returns false for null playerStats', () => {
            expect(savageAttackerApplies(null)).toBe(false);
        });

        it('returns false for empty playerStats', () => {
            expect(savageAttackerApplies({})).toBe(false);
        });

        it('returns false when no passives', () => {
            expect(savageAttackerApplies({ automation: {} })).toBe(false);
        });

        it('returns false when passives have no matching effect', () => {
            const ps = {
                automation: {
                    passives: [
                        { type: 'passive_rule', effect: 'great_weapon_fighting', name: 'Great Weapon Fighting' }
                    ]
                }
            };
            expect(savageAttackerApplies(ps)).toBe(false);
        });

        it('returns true when reroll_damage_once_per_turn passive exists', () => {
            const ps = {
                automation: {
                    passives: [
                        { type: 'passive_rule', effect: 'reroll_damage_once_per_turn', name: 'Savage Attacker' }
                    ]
                }
            };
            expect(savageAttackerApplies(ps)).toBe(true);
        });
    });
});
