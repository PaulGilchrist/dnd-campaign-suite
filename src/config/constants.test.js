// @improved-by-ai
import { describe, it, expect } from 'vitest';
import * as constants from './constants.js';

describe('constants', () => {
  describe('REQUIRED_FIELDS', () => {
    it('should export an array containing exactly 9 required field names', () => {
      expect(constants.REQUIRED_FIELDS).toBeInstanceOf(Array);
      expect(constants.REQUIRED_FIELDS).toHaveLength(9);
    });

    it('should contain all expected character sheet field keys', () => {
      const expected = [
        'name',
        'level',
        'alignment',
        'race',
        'class',
        'abilities',
        'inventory',
        'skillProficiencies',
        'expertSkills',
      ];
      for (const field of expected) {
        expect(constants.REQUIRED_FIELDS).toContain(field);
      }
    });
  });

  describe('DEFAULT_FORM_DATA', () => {
    it('should be a plain object with all expected top-level keys', () => {
      const expectedKeys = [
        'name',
        'level',
        'alignment',
        'abilities',
        'background',
        'class',
        'expertSkills',
        'feats',
        'fightingStyles',
        'race',
        'immunities',
        'inventory',
        'languages',
        'resistances',
        'skillProficiencies',
        'specialActions',
        'spells',
        'rules',
        'xp',
        'xpMode',
      ];
      for (const key of expectedKeys) {
        expect(constants.DEFAULT_FORM_DATA).toHaveProperty(key);
      }
      const actualKeys = Object.keys(constants.DEFAULT_FORM_DATA);
      expect(actualKeys).toHaveLength(expectedKeys.length);
    });

    it('should have correct primitive defaults', () => {
      expect(constants.DEFAULT_FORM_DATA.name).toBe('');
      expect(constants.DEFAULT_FORM_DATA.level).toBe(1);
      expect(constants.DEFAULT_FORM_DATA.alignment).toBe('True Neutral');
      expect(constants.DEFAULT_FORM_DATA.background).toBe('');
      expect(constants.DEFAULT_FORM_DATA.rules).toBe('5e');
      expect(constants.DEFAULT_FORM_DATA.xp).toBe(0);
      expect(constants.DEFAULT_FORM_DATA.xpMode).toBe('milestone');
    });

    it('should have an abilities array with 6 entries, each with correct structure', () => {
      const abilities = constants.DEFAULT_FORM_DATA.abilities;
      expect(abilities).toBeInstanceOf(Array);
      expect(abilities).toHaveLength(6);

      const expectedNames = [
        'Strength',
        'Dexterity',
        'Constitution',
        'Intelligence',
        'Wisdom',
        'Charisma',
      ];
      abilities.forEach((ability, index) => {
        expect(ability.name).toBe(expectedNames[index]);
        expect(ability.baseScore).toBe(8);
        expect(ability.featIncrease).toBe(0);
        expect(ability.backgroundIncrease).toBe(0);
        expect(ability.miscIncrease).toBe(0);
      });
    });

    it('should have default class with nested subclass and order fields', () => {
      const cls = constants.DEFAULT_FORM_DATA.class;
      expect(cls.name).toBe('Fighter');
      expect(cls.subclass).toEqual({ name: '' });
      expect(cls.divineOrder).toBe('');
      expect(cls.primalOrder).toBe('');
    });

    it('should have default race with nested subrace', () => {
      const race = constants.DEFAULT_FORM_DATA.race;
      expect(race.name).toBe('Human');
      expect(race.subrace).toEqual({ name: '' });
    });

    it('should have default inventory with correct structure', () => {
      const inventory = constants.DEFAULT_FORM_DATA.inventory;
      expect(inventory).toEqual({
        backpack: [],
        equipped: [],
        gold: 10,
        magicItems: [],
      });
    });

    it('should have empty arrays for list-based optional fields', () => {
      const listFields = [
        'expertSkills',
        'feats',
        'fightingStyles',
        'immunities',
        'languages',
        'resistances',
        'skillProficiencies',
        'specialActions',
        'spells',
      ];
      for (const field of listFields) {
        expect(constants.DEFAULT_FORM_DATA[field]).toEqual([]);
      }
    });
  });
});
