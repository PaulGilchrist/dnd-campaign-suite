// @cleaned-by-ai
import { describe, it, expect } from 'vitest';
import { categories2024 } from './featureCategories.js';

const {
  featuresToIgnore,
  actions,
  bonusActions,
  reactions,
  characterAdvancement
} = categories2024;

describe('featureCategories2024', () => {
  describe('featuresToIgnore', () => {
    it('should be an array', () => {
      expect(Array.isArray(featuresToIgnore)).toBe(true);
    });

    it('should contain key class feature categories to ignore', () => {
      const expectedItems = [
        'Ability Score Improvement',
        'Channel Divinity',
        'Extra Attack',
        'Epic Boon',
        'Fighting Style',
        'Spellcasting',
        'Thieves\' Cant',
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
        'Ki',
        'Martial Archetype',
      ];

      for (const item of notIgnored) {
        expect(featuresToIgnore).not.toContain(item);
      }
    });
  });

  describe('actions', () => {
    it('should be an array with expected entries', () => {
      expect(Array.isArray(actions)).toBe(true);
      expect(actions).toContain('Naturally Stealthy');
    });
  });

  describe('bonusActions', () => {
    it('should be an array with expected entries', () => {
      expect(Array.isArray(bonusActions)).toBe(true);
      expect(bonusActions).toContain("Nature's Veil");
    });
  });

  describe('reactions', () => {
    it('should be an array with expected entries', () => {
      expect(Array.isArray(reactions)).toBe(true);
      expect(reactions).toContain('Protection');
    });
  });

  describe('characterAdvancement', () => {
    it('should be an array with expected entries', () => {
      expect(Array.isArray(characterAdvancement)).toBe(true);
      const expectedItems = [
        'Deft Explorer',
        'Draconic Ancestry',
        'Expertise',
        'Magical Secrets',
        'Pact Magic',
      ];
      for (const item of expectedItems) {
        expect(characterAdvancement).toContain(item);
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

    it('should have no overlap between action categories', () => {
      const allItems = [
        ...actions, ...bonusActions, ...reactions, ...characterAdvancement
      ];
      const unique = new Set(allItems);
      expect(allItems).toHaveLength(unique.size);
    });
  });
});
