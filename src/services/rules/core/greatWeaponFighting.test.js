// @maintained-by-ai
// Rules canon: the app's 2024 "treat any 1 or 2 on a damage die as a 3" contract,
// pinned verbatim from public/data/2024/feats.json (index "great-weapon-fighting")
// and public/data/fighting-styles.json — NOT the 2014 "reroll and must use the
// new roll" text. The module is pure (rolls are passed in; nothing rolls here).
// Automation-side armed/unarmed delegation to this module is owned by
// src/services/combat/automation/automationPassives.test.js — not duplicated here.
import { describe, it, expect } from 'vitest';
import { applyGreatWeaponFighting, greatWeaponFightingApplies } from './greatWeaponFighting.js';

const GWF_PASSIVE = { type: 'passive_rule', effect: 'great_weapon_fighting', name: 'Great Weapon Fighting' };

describe('greatWeaponFighting', () => {
  describe('applyGreatWeaponFighting', () => {
    it.each([
      { label: 'every d6 face', rolls: [1, 2, 3, 4, 5, 6], expected: [3, 3, 3, 4, 5, 6] },
      { label: 'd4 clamp (2 becomes 3)', rolls: [1, 2, 3, 4], expected: [3, 3, 3, 4] },
      { label: 'all lows clamp to exactly 3', rolls: [1, 2, 1, 2], expected: [3, 3, 3, 3] },
      { label: 'no high die is altered', rolls: [3, 8, 12, 20], expected: [3, 8, 12, 20] },
      { label: 'mixed multi-die damage', rolls: [2, 6, 1, 5, 2], expected: [3, 6, 3, 5, 3] },
    ])('treats 1s and 2s as 3, leaves 3+ untouched — $label', ({ rolls, expected }) => {
      const original = [...rolls];
      expect(applyGreatWeaponFighting(rolls)).toEqual(expected);
      expect(rolls).toEqual(original); // input damage rolls never mutated
    });

    it('passes through empty and non-array inputs unchanged', () => {
      expect(applyGreatWeaponFighting([])).toEqual([]);
      expect(applyGreatWeaponFighting(null)).toBe(null);
      expect(applyGreatWeaponFighting(undefined)).toBe(undefined);
      expect(applyGreatWeaponFighting(5)).toBe(5);
      expect(applyGreatWeaponFighting('not an array')).toBe('not an array');
    });
  });

  describe('greatWeaponFightingApplies', () => {
    it.each([
      { label: 'null weapon', passives: [GWF_PASSIVE], weapon: null, expected: false },
      { label: 'no passives at all', passives: [], weapon: { properties: ['Two-Handed'] }, expected: false },
      { label: 'right effect, wrong passive type', passives: [{ type: 'passive_buff', effect: 'great_weapon_fighting' }], weapon: { properties: ['Two-Handed'] }, expected: false },
      { label: 'right type, foreign effect', passives: [{ type: 'passive_rule', effect: 'protection' }], weapon: { properties: ['Two-Handed'] }, expected: false },
      { label: 'GWF but one-handed weapon (Finesse)', passives: [GWF_PASSIVE], weapon: { properties: ['Finesse'] }, expected: false },
      { label: 'GWF but light melee (Light)', passives: [GWF_PASSIVE], weapon: { properties: ['Light'] }, expected: false },
      { label: 'GWF + Two-Handed', passives: [GWF_PASSIVE], weapon: { properties: ['Two-Handed'] }, expected: true },
      { label: 'GWF + Versatile', passives: [GWF_PASSIVE], weapon: { properties: ['Versatile'] }, expected: true },
      { label: 'GWF + both properties', passives: [GWF_PASSIVE], weapon: { properties: ['Two-Handed', 'Versatile'] }, expected: true },
      { label: 'GWF among other passives + Heavy/Versatile greatsword', passives: [{ type: 'passive_rule', effect: 'other' }, GWF_PASSIVE], weapon: { name: 'Greatsword', properties: ['Heavy', 'Two-Handed'] }, expected: true },
    ])('$label', ({ passives, weapon, expected }) => {
      expect(greatWeaponFightingApplies(weapon, { automation: { passives } })).toBe(expected);
    });

    it('returns false when playerStats.automation is missing', () => {
      expect(greatWeaponFightingApplies({ properties: ['Two-Handed'] }, {})).toBe(false);
    });
  });
});
