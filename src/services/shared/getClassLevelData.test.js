// @improved-by-ai
import { describe, it, expect } from 'vitest';
import { getClassLevelData } from './getClassLevelData.js';

describe('getClassLevelData', () => {
  describe('invalid input', () => {
    it('throws when playerStats is null', () => {
      expect(() => getClassLevelData(null)).toThrow(TypeError);
    });

    it('throws when playerStats is undefined', () => {
      expect(() => getClassLevelData(undefined)).toThrow(TypeError);
    });

    it('returns null when playerStats is a primitive', () => {
      expect(getClassLevelData(42)).toBeNull();
      expect(getClassLevelData('foo')).toBeNull();
      expect(getClassLevelData(true)).toBeNull();
    });
  });

  describe('missing class data', () => {
    it('returns null when playerStats has no class property', () => {
      expect(getClassLevelData({})).toBeNull();
    });

    it('returns null when class is null', () => {
      expect(getClassLevelData({ class: null })).toBeNull();
    });

    it('returns null when class is missing class_levels', () => {
      expect(getClassLevelData({ class: { name: 'Fighter' } })).toBeNull();
    });

    it('returns null when class_levels is null', () => {
      expect(getClassLevelData({ class: { class_levels: null } })).toBeNull();
    });

    it('throws when class_levels is not an array-like value', () => {
      expect(() => getClassLevelData({ class: { class_levels: {} } })).toThrow(TypeError);
    });
  });

  describe('empty or non-matching levels', () => {
    it('returns null when class_levels is empty', () => {
      expect(getClassLevelData({ class: { class_levels: [] } })).toBeNull();
    });

    it('returns null when no level entry matches playerStats.level', () => {
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

    it('returns null when level is 0', () => {
      expect(getClassLevelData({
        level: 0,
        class: { class_levels: [{ level: 1, features: ['Fighter 1st Level'] }] },
      })).toBeNull();
    });

    it('returns null when level is a non-integer', () => {
      expect(getClassLevelData({
        level: 3.5,
        class: {
          class_levels: [
            { level: 3, features: ['Martial Archetype'] },
            { level: 4, features: ['Ability Score Improvement'] },
          ],
        },
      })).toBeNull();
    });
  });

  describe('matching level entries', () => {
    it('returns the level entry that matches playerStats.level', () => {
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

    it('returns the first level entry when level is 1', () => {
      const result = getClassLevelData({
        level: 1,
        class: {
          class_levels: [
            { level: 1, features: ['Fighter 1st Level'] },
            { level: 2, features: ['Second Wind'] },
          ],
        },
      });
      expect(result).toEqual({ level: 1, features: ['Fighter 1st Level'] });
    });

    it('returns the highest level entry when level is 20', () => {
      const result = getClassLevelData({
        level: 20,
        class: {
          class_levels: [
            { level: 1, features: ['Fighter 1st Level'] },
            { level: 20, features: ['Indomitable (9)'] },
          ],
        },
      });
      expect(result).toEqual({ level: 20, features: ['Indomitable (9)'] });
    });

    it('returns the full level entry object including extra properties', () => {
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

    it('returns the matching entry when levels are non-contiguous', () => {
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
  });
});
