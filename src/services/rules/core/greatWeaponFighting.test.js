import { describe, it, expect } from 'vitest';
import { applyGreatWeaponFighting, greatWeaponFightingApplies } from './greatWeaponFighting.js';

describe('greatWeaponFighting', () => {
    describe('applyGreatWeaponFighting', () => {
        it('returns input when rolls is null', () => {
            expect(applyGreatWeaponFighting(null)).toBe(null);
        });

        it('returns input when rolls is undefined', () => {
            expect(applyGreatWeaponFighting(undefined)).toBe(undefined);
        });

        it('returns input when rolls is not an array', () => {
            expect(applyGreatWeaponFighting(5)).toBe(5);
        });

        it('returns empty array when rolls is empty', () => {
            expect(applyGreatWeaponFighting([])).toEqual([]);
        });

        it('converts 1s to 3s', () => {
            expect(applyGreatWeaponFighting([1, 5, 3])).toEqual([3, 5, 3]);
        });

        it('converts 2s to 3s', () => {
            expect(applyGreatWeaponFighting([2, 6, 4])).toEqual([3, 6, 4]);
        });

        it('converts both 1s and 2s to 3s', () => {
            expect(applyGreatWeaponFighting([1, 2, 3, 4, 5, 6])).toEqual([3, 3, 3, 4, 5, 6]);
        });

        it('leaves 3+ unchanged', () => {
            expect(applyGreatWeaponFighting([3, 4, 5, 6])).toEqual([3, 4, 5, 6]);
        });

        it('handles all 1s and 2s', () => {
            expect(applyGreatWeaponFighting([1, 1, 2, 2])).toEqual([3, 3, 3, 3]);
        });

        it('handles single die roll of 1', () => {
            expect(applyGreatWeaponFighting([1])).toEqual([3]);
        });

        it('handles single die roll of 6', () => {
            expect(applyGreatWeaponFighting([6])).toEqual([6]);
        });
    });

    describe('greatWeaponFightingApplies', () => {
        it('returns false when weapon is null', () => {
            expect(greatWeaponFightingApplies(null, {})).toBe(false);
        });

        it('returns false when player has no GWF passive', () => {
            const weapon = { properties: ['Two-Handed'] };
            expect(greatWeaponFightingApplies(weapon, { automation: { passives: [] } })).toBe(false);
        });

        it('returns false when weapon lacks Two-Handed or Versatile', () => {
            const playerStats = {
                automation: {
                    passives: [{ type: 'passive_rule', effect: 'great_weapon_fighting', name: 'Great Weapon Fighting' }]
                }
            };
            const weapon = { properties: ['Finesse'] };
            expect(greatWeaponFightingApplies(weapon, playerStats)).toBe(false);
        });

        it('returns true when player has GWF and weapon has Two-Handed', () => {
            const playerStats = {
                automation: {
                    passives: [{ type: 'passive_rule', effect: 'great_weapon_fighting', name: 'Great Weapon Fighting' }]
                }
            };
            const weapon = { properties: ['Two-Handed'] };
            expect(greatWeaponFightingApplies(weapon, playerStats)).toBe(true);
        });

        it('returns true when player has GWF and weapon has Versatile', () => {
            const playerStats = {
                automation: {
                    passives: [{ type: 'passive_rule', effect: 'great_weapon_fighting', name: 'Great Weapon Fighting' }]
                }
            };
            const weapon = { properties: ['Versatile'] };
            expect(greatWeaponFightingApplies(weapon, playerStats)).toBe(true);
        });

        it('returns true when player has GWF and weapon has both properties', () => {
            const playerStats = {
                automation: {
                    passives: [{ type: 'passive_rule', effect: 'great_weapon_fighting', name: 'Great Weapon Fighting' }]
                }
            };
            const weapon = { properties: ['Two-Handed', 'Versatile'] };
            expect(greatWeaponFightingApplies(weapon, playerStats)).toBe(true);
        });

        it('returns false when player has no passives array', () => {
            const weapon = { properties: ['Two-Handed'] };
            expect(greatWeaponFightingApplies(weapon, { automation: {} })).toBe(false);
        });
    });
});
