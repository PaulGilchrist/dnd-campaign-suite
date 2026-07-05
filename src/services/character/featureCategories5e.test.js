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

    it('should contain key class feature categories to ignore', () => {
      const expectedItems = [
        'Ability Score Improvement',
        'Channel Divinity',
        'Divine Domain',
        'Extra Attack',
        'Ki',
        'Martial Archetype',
        'Rage',
        'Sacred Oath',
        'Spellcasting',
      ];

      for (const item of expectedItems) {
        expect(featuresToIgnore).toContain(item);
      }
    });

    it('should not contain items that are not meant to be ignored', () => {
      const notIgnored = [
        'Sneak Attack',
        'Evasion',
        'Uncanny Dodge',
        'Second Wind',
        'Action Surge',
      ];

      for (const item of notIgnored) {
        expect(featuresToIgnore).not.toContain(item);
      }
    });
  });

  describe('data integrity', () => {
    it('should have no overlap between featuresToIgnore and action categories', () => {
      const allActionItems = [
        ...actions, ...bonusActions, ...reactions, ...characterAdvancement
      ];
      for (const item of featuresToIgnore) {
        expect(allActionItems).not.toContain(item);
      }
    });
  });
});
