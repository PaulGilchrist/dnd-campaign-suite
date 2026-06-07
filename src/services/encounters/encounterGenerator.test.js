import { describe, it, expect } from 'vitest';
import { generateEncounterSuggestions } from './encounterGenerator.js';

const makeMonster = (overrides = {}) => ({
  index: overrides.index ?? 0,
  name: overrides.name ?? 'Goblin',
  challenge_rating: overrides.challenge_rating ?? '1/4',
  xp: overrides.xp ?? 50,
  environments: overrides.environments ?? ['forest', 'underground'],
  allies: overrides.allies ?? [],
});

describe('encounterGenerator', () => {
  describe('generateEncounterSuggestions', () => {
    it('should return empty array when no monsters match environments', () => {
      const result = generateEncounterSuggestions({
        monsters: [makeMonster({ environments: ['desert'] })],
        playerLevels: [1, 1, 1, 1],
        difficulty: 1,
        environments: ['forest'],
      });
      expect(result).toEqual([]);
    });

    it('should return empty array when monsters list is empty', () => {
      const result = generateEncounterSuggestions({
        monsters: [],
        playerLevels: [1, 1, 1, 1],
        difficulty: 1,
        environments: ['forest'],
      });
      expect(result).toEqual([]);
    });

    it('should return suggestions when monsters match', () => {
      const monsters = [
        makeMonster({ index: 0, name: 'Goblin', challenge_rating: '1/4', xp: 50 }),
        makeMonster({ index: 1, name: 'Orc', challenge_rating: '1/2', xp: 100 }),
        makeMonster({ index: 2, name: 'Wolf', challenge_rating: '1/4', xp: 50 }),
      ];
      const result = generateEncounterSuggestions({
        monsters,
        playerLevels: [1, 1, 1, 1],
        difficulty: 1,
        environments: ['forest'],
        count: 2,
      });
      expect(result.length).toBeGreaterThan(0);
    });

    it('should not exceed requested count', () => {
      const monsters = Array.from({ length: 10 }, (_, i) =>
        makeMonster({ index: i, name: `Monster${i}`, xp: 50 + i * 10 })
      );
      const result = generateEncounterSuggestions({
        monsters,
        playerLevels: [3, 3, 3, 3],
        difficulty: 1,
        environments: ['forest'],
        count: 3,
      });
      expect(result.length).toBeLessThanOrEqual(3);
    });

    it('should include difficulty label in suggestions', () => {
      const monsters = [
        makeMonster({ index: 0, name: 'Goblin', challenge_rating: '1/4', xp: 50 }),
        makeMonster({ index: 1, name: 'Orc', challenge_rating: '1/2', xp: 100 }),
      ];
      const result = generateEncounterSuggestions({
        monsters,
        playerLevels: [1, 1, 1, 1],
        difficulty: 1,
        environments: ['forest'],
      });
      if (result.length > 0) {
        expect(['Easy', 'Medium', 'Hard', 'Deadly']).toContain(result[0].difficultyLabel);
      }
    });

    it('should include totalXP in suggestions', () => {
      const monsters = [
        makeMonster({ index: 0, name: 'Goblin', challenge_rating: '1/4', xp: 50 }),
        makeMonster({ index: 1, name: 'Orc', challenge_rating: '1/2', xp: 100 }),
      ];
      const result = generateEncounterSuggestions({
        monsters,
        playerLevels: [1, 1, 1, 1],
        difficulty: 1,
        environments: ['forest'],
      });
      if (result.length > 0) {
        expect(result[0].totalXP).toBeGreaterThan(0);
      }
    });

    it('should include monsterCount in suggestions', () => {
      const monsters = [
        makeMonster({ index: 0, name: 'Goblin', challenge_rating: '1/4', xp: 50 }),
        makeMonster({ index: 1, name: 'Orc', challenge_rating: '1/2', xp: 100 }),
      ];
      const result = generateEncounterSuggestions({
        monsters,
        playerLevels: [1, 1, 1, 1],
        difficulty: 1,
        environments: ['forest'],
      });
      if (result.length > 0) {
        expect(result[0].monsterCount).toBeGreaterThan(0);
      }
    });

    it('should include monsters array with qty in suggestions', () => {
      const monsters = [
        makeMonster({ index: 0, name: 'Goblin', challenge_rating: '1/4', xp: 50 }),
        makeMonster({ index: 1, name: 'Orc', challenge_rating: '1/2', xp: 100 }),
      ];
      const result = generateEncounterSuggestions({
        monsters,
        playerLevels: [1, 1, 1, 1],
        difficulty: 1,
        environments: ['forest'],
      });
      if (result.length > 0) {
        expect(result[0].monsters.length).toBeGreaterThan(0);
        expect(result[0].monsters[0].qty).toBeGreaterThanOrEqual(1);
      }
    });

    it('should use allies when available', () => {
      const monsters = [
        makeMonster({ index: 0, name: 'Goblin', challenge_rating: '1/4', xp: 50, allies: [1] }),
        makeMonster({ index: 1, name: 'Orc', challenge_rating: '1/2', xp: 100 }),
      ];
      const result = generateEncounterSuggestions({
        monsters,
        playerLevels: [1, 1, 1, 1],
        difficulty: 1,
        environments: ['forest'],
      });
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle single player party', () => {
      const monsters = [
        makeMonster({ index: 0, name: 'Goblin', challenge_rating: '1/4', xp: 50 }),
        makeMonster({ index: 1, name: 'Orc', challenge_rating: '1/2', xp: 100 }),
      ];
      const result = generateEncounterSuggestions({
        monsters,
        playerLevels: [5],
        difficulty: 2,
        environments: ['forest'],
      });
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle high level party', () => {
      const monsters = [
        makeMonster({ index: 0, name: 'Dragon', challenge_rating: '10', xp: 5900 }),
        makeMonster({ index: 1, name: 'Giant', challenge_rating: '5', xp: 1800 }),
      ];
      const result = generateEncounterSuggestions({
        monsters,
        playerLevels: [15, 15, 15, 15],
        difficulty: 2,
        environments: ['forest'],
      });
      expect(result.length).toBeGreaterThan(0);
    });

    it('should sort suggestions by closeness to target difficulty', () => {
      const monsters = Array.from({ length: 10 }, (_, i) =>
        makeMonster({ index: i, name: `Monster${i}`, xp: 50 + i * 25 })
      );
      const result = generateEncounterSuggestions({
        monsters,
        playerLevels: [3, 3, 3, 3],
        difficulty: 2,
        environments: ['forest'],
        count: 3,
      });
      if (result.length >= 2) {
        const diffOrder = { Easy: 0, Medium: 1, Hard: 2, Deadly: 3 };
        const targetDiff = 2;
        for (let i = 0; i < result.length - 1; i++) {
          const aDist = Math.abs((diffOrder[result[i].difficultyLabel] ?? 0) - targetDiff);
          const bDist = Math.abs((diffOrder[result[i + 1].difficultyLabel] ?? 0) - targetDiff);
          expect(aDist).toBeLessThanOrEqual(bDist);
        }
      }
    });

    it('should handle monsters with fractional CRs', () => {
      const monsters = [
        makeMonster({ index: 0, name: 'Kobold', challenge_rating: '1/8', xp: 25 }),
        makeMonster({ index: 1, name: 'Giant Rat', challenge_rating: '1/8', xp: 25 }),
      ];
      const result = generateEncounterSuggestions({
        monsters,
        playerLevels: [1, 1],
        difficulty: 0,
        environments: ['underground'],
      });
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle monsters with CR 0', () => {
      const monsters = [
        makeMonster({ index: 0, name: 'Commoner', challenge_rating: '0', xp: 10 }),
      ];
      const result = generateEncounterSuggestions({
        monsters,
        playerLevels: [1],
        difficulty: 0,
        environments: ['forest'],
      });
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
