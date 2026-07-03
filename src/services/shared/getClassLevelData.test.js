// @cleaned-by-ai
import { describe, it, expect } from 'vitest';
import { getClassLevelData } from './getClassLevelData.js';

describe('getClassLevelData', () => {
  describe('invalid or missing data returns null', () => {
    it('returns null when class_levels is absent, null, or undefined', () => {
      expect(getClassLevelData({ level: 1 })).toBeNull();
      expect(getClassLevelData({ class: { class_levels: null } })).toBeNull();
      expect(getClassLevelData({ class: { class_levels: undefined } })).toBeNull();
    });

    it('returns null when level does not match any entry', () => {
      const playerStats = {
        level: 5,
        class: {
          class_levels: [
            { level: 1, features: ['Fighter 1st Level'] },
            { level: 2, features: ['Second Wind'] },
          ],
        },
      };
      expect(getClassLevelData(playerStats)).toBeNull();
    });
  });

  describe('returns matching level entry', () => {
    it('returns the entry whose level matches playerStats.level', () => {
      const playerStats = {
        level: 3,
        class: {
          class_levels: [
            { level: 1, features: ['Fighter 1st Level'] },
            { level: 2, features: ['Second Wind'] },
            { level: 3, features: ['Martial Archetype'] },
          ],
        },
      };
      expect(getClassLevelData(playerStats)).toEqual({ level: 3, features: ['Martial Archetype'] });
    });

    it('returns the full entry object including extra properties', () => {
      const result = getClassLevelData({
        level: 5,
        class: {
          class_levels: [
            { level: 5, hp: 45, features: ['Extra Attack'], profBonus: 3 },
          ],
        },
      });
      expect(result).toEqual({ level: 5, hp: 45, features: ['Extra Attack'], profBonus: 3 });
    });
  });
});
