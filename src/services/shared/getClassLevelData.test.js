import { describe, it, expect } from 'vitest';
import { getClassLevelData } from './getClassLevelData.js';

describe('getClassLevelData', () => {
  it('should throw when playerStats is null', () => {
    expect(() => getClassLevelData(null)).toThrow();
  });

  it('should throw when playerStats is undefined', () => {
    expect(() => getClassLevelData(undefined)).toThrow();
  });

  it('should return null when playerStats has no class', () => {
    expect(getClassLevelData({})).toBeNull();
  });

  it('should return null when playerStats.class is null', () => {
    expect(getClassLevelData({ class: null })).toBeNull();
  });

  it('should return null when playerStats.class has no class_levels', () => {
    expect(getClassLevelData({ class: { name: 'Fighter' } })).toBeNull();
  });

  it('should return null when class_levels is empty', () => {
    expect(getClassLevelData({ class: { class_levels: [] } })).toBeNull();
  });

  it('should return null when no matching level is found', () => {
    const playerStats = {
      level: 5,
      class: {
        class_levels: [
          { level: 1, features: ['Fighter 1st Level'] },
          { level: 2, features: ['Second Wind'] },
          { level: 3, features: ['Martial Archetype'] },
        ],
      },
    };
    expect(getClassLevelData(playerStats)).toBeNull();
  });

  it('should return the matching level entry', () => {
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
    const result = getClassLevelData(playerStats);
    expect(result).toEqual({ level: 3, features: ['Martial Archetype'] });
  });

  it('should return the first level when level is 1', () => {
    const playerStats = {
      level: 1,
      class: {
        class_levels: [
          { level: 1, features: ['Fighter 1st Level'] },
          { level: 2, features: ['Second Wind'] },
        ],
      },
    };
    const result = getClassLevelData(playerStats);
    expect(result).toEqual({ level: 1, features: ['Fighter 1st Level'] });
  });

  it('should return the last level when level is max', () => {
    const playerStats = {
      level: 20,
      class: {
        class_levels: [
          { level: 1, features: ['Fighter 1st Level'] },
          { level: 20, features: ['Indomitable (9)'] },
        ],
      },
    };
    const result = getClassLevelData(playerStats);
    expect(result).toEqual({ level: 20, features: ['Indomitable (9)'] });
  });

  it('should handle class_levels with objects containing many properties', () => {
    const playerStats = {
      level: 5,
      class: {
        class_levels: [
          { level: 5, hp: 45, features: ['Extra Attack'], profBonus: 3 },
        ],
      },
    };
    const result = getClassLevelData(playerStats);
    expect(result).toEqual({ level: 5, hp: 45, features: ['Extra Attack'], profBonus: 3 });
  });

  it('should return null when level is 0', () => {
    const playerStats = {
      level: 0,
      class: {
        class_levels: [{ level: 1, features: ['Fighter 1st Level'] }],
      },
    };
    expect(getClassLevelData(playerStats)).toBeNull();
  });

  it('should handle non-integer level values', () => {
    const playerStats = {
      level: 3.5,
      class: {
        class_levels: [
          { level: 3, features: ['Martial Archetype'] },
          { level: 4, features: ['Ability Score Improvement'] },
        ],
      },
    };
    expect(getClassLevelData(playerStats)).toBeNull();
  });

  it('should handle level as string', () => {
    const playerStats = {
      level: '3',
      class: {
        class_levels: [
          { level: '3', features: ['Martial Archetype'] },
        ],
      },
    };
    const result = getClassLevelData(playerStats);
    expect(result).toEqual({ level: '3', features: ['Martial Archetype'] });
  });
});
