// @improved-by-ai
import { describe, it, expect } from 'vitest';
import { getClassLevelData } from './getClassLevelData.js';

describe('getClassLevelData', () => {
  describe('invalid or missing data returns null', () => {
    it('returns null when class_levels is absent, null, or undefined', () => {
      expect(getClassLevelData({ level: 1 })).toBeNull();
      expect(getClassLevelData({ class: {} })).toBeNull();
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

    it('returns null when level is zero or negative', () => {
      expect(getClassLevelData({ level: 0, class: { class_levels: [{ level: 1 }] } })).toBeNull();
      expect(getClassLevelData({ level: -1, class: { class_levels: [{ level: 1 }] } })).toBeNull();
    });

    it('returns null when level is a non-integer', () => {
      expect(getClassLevelData({
        level: 3.5,
        class: { class_levels: [{ level: 3 }, { level: 4 }] },
      })).toBeNull();
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

    it('returns the first matching entry when multiple entries share the same level', () => {
      const playerStats = {
        level: 2,
        class: {
          class_levels: [
            { level: 2, features: ['Second Wind'] },
            { level: 2, features: ['Duplicate Feature'] },
          ],
        },
      };
      expect(getClassLevelData(playerStats)).toEqual({ level: 2, features: ['Second Wind'] });
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

    it('finds entries in non-contiguous level arrays', () => {
      const result = getClassLevelData({
        level: 11,
        class: {
          class_levels: [
            { level: 1, features: ['Level 1'] },
            { level: 2, features: ['Level 2'] },
            { level: 11, features: ['Epic Boon'] },
            { level: 20, features: ['Level 20'] },
          ],
        },
      });
      expect(result).toEqual({ level: 11, features: ['Epic Boon'] });
    });

    it('returns the entry at level 1', () => {
      expect(getClassLevelData({
        level: 1,
        class: {
          class_levels: [
            { level: 1, features: ['Spellcasting'] },
            { level: 2, features: ['Font of Magic'] },
          ],
        },
      })).toEqual({ level: 1, features: ['Spellcasting'] });
    });

    it('returns the entry at level 20', () => {
      expect(getClassLevelData({
        level: 20,
        class: {
          class_levels: [
            { level: 1, features: ['Fighter 1st Level'] },
            { level: 20, features: ['Indomitable (9)'] },
          ],
        },
      })).toEqual({ level: 20, features: ['Indomitable (9)'] });
    });
  });
});
