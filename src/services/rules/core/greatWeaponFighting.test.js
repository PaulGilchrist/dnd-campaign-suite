// @improved-by-ai
import { describe, it, expect } from 'vitest';
import { applyGreatWeaponFighting, greatWeaponFightingApplies } from './greatWeaponFighting.js';

const GWF_PASSIVE = { type: 'passive_rule', effect: 'great_weapon_fighting', name: 'Great Weapon Fighting' };

const makePlayerStats = (overrides = {}) => ({
  automation: { passives: [GWF_PASSIVE], ...overrides.automation },
  ...overrides,
});

describe('greatWeaponFighting', () => {
  describe('applyGreatWeaponFighting', () => {
    it('returns non-array inputs unchanged', () => {
      expect(applyGreatWeaponFighting(null)).toBe(null);
      expect(applyGreatWeaponFighting(undefined)).toBe(undefined);
      expect(applyGreatWeaponFighting(5)).toBe(5);
      expect(applyGreatWeaponFighting('not an array')).toBe('not an array');
    });

    it('returns empty array unchanged', () => {
      expect(applyGreatWeaponFighting([])).toEqual([]);
    });

    it('returns a new array without mutating the input', () => {
      const rolls = [1, 2, 3];
      const result = applyGreatWeaponFighting(rolls);
      expect(result).toEqual([3, 3, 3]);
      expect(result).not.toBe(rolls);
      expect(rolls).toEqual([1, 2, 3]);
    });

    it('converts 1s and 2s to 3s, leaves 3+ unchanged', () => {
      expect(applyGreatWeaponFighting([1, 2, 3, 4, 5, 6])).toEqual([3, 3, 3, 4, 5, 6]);
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

    it('handles rolls with duplicates', () => {
      expect(applyGreatWeaponFighting([1, 1, 1, 2, 2, 2])).toEqual([3, 3, 3, 3, 3, 3]);
    });

    it('handles rolls with no 1s or 2s', () => {
      expect(applyGreatWeaponFighting([3, 4, 5, 6])).toEqual([3, 4, 5, 6]);
    });
  });

  describe('greatWeaponFightingApplies', () => {
    it('returns false when weapon is null', () => {
      expect(greatWeaponFightingApplies(null, {})).toBe(false);
    });

    it('returns false when player has no GWF passive', () => {
      const weapon = { properties: ['Two-Handed'] };
      const playerStats = { automation: { passives: [] } };
      expect(greatWeaponFightingApplies(weapon, playerStats)).toBe(false);
    });

    it('returns false when player has passives but none match GWF', () => {
      const weapon = { properties: ['Two-Handed'] };
      const playerStats = {
        automation: { passives: [{ type: 'passive_rule', effect: 'savage_attacker', name: 'Savage Attacker' }] },
      };
      expect(greatWeaponFightingApplies(weapon, playerStats)).toBe(false);
    });

    it('returns false when weapon lacks Two-Handed and Versatile', () => {
      const playerStats = makePlayerStats();
      const weapon = { properties: ['Finesse'] };
      expect(greatWeaponFightingApplies(weapon, playerStats)).toBe(false);
    });

    it('returns false when weapon has no properties array', () => {
      const playerStats = makePlayerStats();
      const weapon = {};
      expect(greatWeaponFightingApplies(weapon, playerStats)).toBe(false);
    });

    it('returns false when playerStats.automation is missing', () => {
      const weapon = { properties: ['Two-Handed'] };
      expect(greatWeaponFightingApplies(weapon, {})).toBe(false);
    });

    it('returns false when playerStats.automation.passives is missing', () => {
      const weapon = { properties: ['Two-Handed'] };
      const playerStats = { automation: {} };
      expect(greatWeaponFightingApplies(weapon, playerStats)).toBe(false);
    });

    it('returns true when player has GWF and weapon has Two-Handed', () => {
      const playerStats = makePlayerStats();
      const weapon = { properties: ['Two-Handed'] };
      expect(greatWeaponFightingApplies(weapon, playerStats)).toBe(true);
    });

    it('returns true when player has GWF and weapon has Versatile', () => {
      const playerStats = makePlayerStats();
      const weapon = { properties: ['Versatile'] };
      expect(greatWeaponFightingApplies(weapon, playerStats)).toBe(true);
    });

    it('returns true when player has GWF and weapon has both properties', () => {
      const playerStats = makePlayerStats();
      const weapon = { properties: ['Two-Handed', 'Versatile'] };
      expect(greatWeaponFightingApplies(weapon, playerStats)).toBe(true);
    });
  });
});
