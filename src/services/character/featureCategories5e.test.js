// @improved-by-ai
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

    it('should contain no duplicate entries', () => {
      const unique = new Set(featuresToIgnore);
      expect(featuresToIgnore).toHaveLength(unique.size);
    });

    it('should use consistent string casing (no trailing whitespace)', () => {
      for (const item of featuresToIgnore) {
        expect(item).toBe(item.trim());
        expect(item).toMatch(/^[A-Z]/);
      }
    });
  });

  describe('actions', () => {
    it('should be an array', () => {
      expect(Array.isArray(actions)).toBe(true);
    });

    it('should be empty (commented-out items pending categorization)', () => {
      expect(actions).toHaveLength(0);
    });

    it('should contain no duplicate entries', () => {
      const unique = new Set(actions);
      expect(actions).toHaveLength(unique.size);
    });
  });

  describe('bonusActions', () => {
    it('should be an array', () => {
      expect(Array.isArray(bonusActions)).toBe(true);
    });

    it('should be empty (commented-out items pending categorization)', () => {
      expect(bonusActions).toHaveLength(0);
    });

    it('should contain no duplicate entries', () => {
      const unique = new Set(bonusActions);
      expect(bonusActions).toHaveLength(unique.size);
    });
  });

  describe('reactions', () => {
    it('should be an array', () => {
      expect(Array.isArray(reactions)).toBe(true);
    });

    it('should be empty (commented-out items pending categorization)', () => {
      expect(reactions).toHaveLength(0);
    });

    it('should contain no duplicate entries', () => {
      const unique = new Set(reactions);
      expect(reactions).toHaveLength(unique.size);
    });
  });

  describe('characterAdvancement', () => {
    it('should be an array', () => {
      expect(Array.isArray(characterAdvancement)).toBe(true);
    });

    it('should be empty (commented-out items pending categorization)', () => {
      expect(characterAdvancement).toHaveLength(0);
    });

    it('should contain no duplicate entries', () => {
      const unique = new Set(characterAdvancement);
      expect(characterAdvancement).toHaveLength(unique.size);
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

    it('should have no overlap between action categories', () => {
      const allItems = [
        ...actions,
        ...bonusActions,
        ...reactions,
        ...characterAdvancement
      ];
      const unique = new Set(allItems);
      expect(allItems).toHaveLength(unique.size);
    });
  });
});
