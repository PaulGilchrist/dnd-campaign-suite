// @improved-by-ai
import { describe, it, expect } from 'vitest';
import * as constants from './constants.js';

describe('constants', () => {
  describe('REQUIRED_FIELDS', () => {
    it('should export an array containing exactly the expected required field names', () => {
      expect(constants.REQUIRED_FIELDS).toBeInstanceOf(Array);
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
      expect(constants.REQUIRED_FIELDS).toHaveLength(expected.length);
      for (const field of expected) {
        expect(constants.REQUIRED_FIELDS).toContain(field);
      }
    });
  });

  describe('DEFAULT_FORM_DATA', () => {
    it('should have all expected top-level keys and no extras', () => {
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

    it('should have correct nested default structures', () => {
      const { abilities, class: cls, race, inventory } = constants.DEFAULT_FORM_DATA;

      expect(abilities).toBeInstanceOf(Array);
      expect(abilities).toHaveLength(6);
      expect(abilities[0].name).toBe('Strength');
      expect(abilities[0].baseScore).toBe(8);

      expect(cls).toEqual({
        name: 'Fighter',
        subclass: { name: '' },
        divineOrder: '',
        primalOrder: '',
      });

      expect(race).toEqual({ name: 'Human', subrace: { name: '' } });

      expect(inventory).toEqual({
        backpack: [],
        equipped: [],
        gold: 10,
        magicItems: [],
      });
    });
  });
});
