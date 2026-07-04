// @cleaned-by-ai
import { describe, it, expect } from 'vitest';
import { categories5e } from './featureCategories.js';

const {
  featuresToIgnore,
  actions,
  bonusActions,
  reactions,
  characterAdvancement
} = categories5e;

describe('featureCategories5e', () => {
  describe('featuresToIgnore', () => {
    it('should be an array', () => {
      expect(Array.isArray(featuresToIgnore)).toBe(true);
    });

    it('should contain all expected class feature categories to ignore', () => {
      const expectedItems = [
        'Ability Score Improvement',
        'Bardic Inspiration',
        'Brutal Critical',
        'Channel Divinity',
        'Divine Domain',
        'Domain Spells',
        'Druid Circle',
        'Druidic',
        'Extra Attack',
        'Ki',
        'Martial Archetype',
        'Monastic Tradition',
        'Primal Path',
        'Rage',
        'Ranger Archetype',
        'Roguish Archetype',
        'Sacred Oath',
        'Sorcerous Origin',
        'Spellcasting'
      ];

      for (const item of expectedItems) {
        expect(featuresToIgnore).toContain(item);
      }
    });

    it('should have exactly 19 items', () => {
      expect(featuresToIgnore).toHaveLength(19);
    });

    it('should not contain items that are not meant to be ignored', () => {
      const notIgnored = [
        'Sneak Attack',
        'Evasion',
        'Uncanny Dodge',
        'Second Wind',
        'Action Surge'
      ];

      for (const item of notIgnored) {
        expect(featuresToIgnore).not.toContain(item);
      }
    });
  });

  describe('data integrity', () => {
    it('should have no overlap between featuresToIgnore and action categories', () => {
      const allActionItems = [
        ...actions,
        ...bonusActions,
        ...reactions,
        ...characterAdvancement
      ];

      for (const item of featuresToIgnore) {
        expect(allActionItems).not.toContain(item);
      }
    });
  });
});
