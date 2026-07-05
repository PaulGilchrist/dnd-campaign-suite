// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect } from 'vitest';
import {
  generateEncounterSuggestions,
  calculateXPThreshold,
  calculateDifficultyMultiplier,
  getDifficultyLabel,
} from './encounterGenerator.js';

const makeMonster = (overrides = {}) => ({
  index: overrides.index ?? 0,
  name: overrides.name ?? 'Goblin',
  challenge_rating: overrides.challenge_rating ?? '1/4',
  xp: overrides.xp ?? 50,
  environments: overrides.environments ?? ['forest'],
  allies: overrides.allies ?? [],
});

describe('encounterGenerator', () => {
  describe('calculateXPThreshold', () => {
    it('should sum thresholds for each party member at the given difficulty', () => {
      expect(calculateXPThreshold([1, 2], 1)).toBe(150);
    });

    it('should return 0 for an empty party', () => {
      expect(calculateXPThreshold([], 1)).toBe(0);
    });

    it('should skip invalid levels but include valid ones', () => {
      expect(calculateXPThreshold([5, 'bad'], 0)).toBe(250);
    });

    it('should handle level boundaries', () => {
      expect(calculateXPThreshold([0], 1)).toBe(25);
      expect(calculateXPThreshold([20], 1)).toBe(5700);
      expect(calculateXPThreshold([25], 1)).toBe(0);
    });
  });

  describe('calculateDifficultyMultiplier', () => {
    it('should return 1 when monster count is half the party size or fewer', () => {
      expect(calculateDifficultyMultiplier(2, 5)).toBe(1);
    });

    it('should return 1.5 when ratio is between 0.5 and 1', () => {
      expect(calculateDifficultyMultiplier(3, 4)).toBe(1.5);
    });

    it('should return 2 when ratio is between 1 and 2', () => {
      expect(calculateDifficultyMultiplier(4, 2)).toBe(2);
    });

    it('should return 2.5 when ratio is between 2 and 3', () => {
      expect(calculateDifficultyMultiplier(7, 3)).toBe(2.5);
    });

    it('should return 3 when ratio is between 3 and 4', () => {
      expect(calculateDifficultyMultiplier(10, 3)).toBe(3);
    });

    it('should return 4 when ratio is 4 or more', () => {
      expect(calculateDifficultyMultiplier(20, 3)).toBe(4);
    });

    it('should handle zero party size by treating it as 1', () => {
      expect(calculateDifficultyMultiplier(2, 0)).toBe(2);
    });

    it('should return 1 when both counts are zero', () => {
      expect(calculateDifficultyMultiplier(0, 0)).toBe(1);
    });
  });

  describe('getDifficultyLabel', () => {
    it('should return Easy for low effective XP ratio', () => {
      expect(getDifficultyLabel(30, 2, 100, 2)).toBe('Easy');
    });

    it('should return Medium for moderate effective XP ratio', () => {
      expect(getDifficultyLabel(120, 2, 100, 2)).toBe('Medium');
    });

    it('should return Hard for high effective XP ratio', () => {
      expect(getDifficultyLabel(150, 2, 100, 2)).toBe('Hard');
    });

    it('should return Deadly for very high effective XP ratio', () => {
      expect(getDifficultyLabel(300, 2, 100, 2)).toBe('Deadly');
    });

    it('should account for difficulty multiplier when labeling', () => {
      expect(getDifficultyLabel(200, 4, 100, 2)).toBe('Hard');
    });
  });

  describe('generateEncounterSuggestions', () => {
    describe('input validation and edge cases', () => {
      it('should return empty array when monsters list is empty', () => {
        const result = generateEncounterSuggestions({
          monsters: [],
          playerLevels: [1, 1, 1, 1],
          difficulty: 1,
          environments: ['forest'],
        });
        expect(result).toEqual([]);
      });

      it('should return empty array when no monsters match environments', () => {
        const result = generateEncounterSuggestions({
          monsters: [makeMonster({ environments: ['desert'] })],
          playerLevels: [1, 1, 1, 1],
          difficulty: 1,
          environments: ['forest'],
        });
        expect(result).toEqual([]);
      });

      it('should handle single player party', () => {
        const result = generateEncounterSuggestions({
          monsters: [makeMonster({ index: 0, name: 'Goblin', challenge_rating: '1/4', xp: 50 })],
          playerLevels: [5],
          difficulty: 1,
          environments: ['forest'],
        });
        expect(result.length).toBeGreaterThan(0);
      });

      it('should handle fractional CR values', () => {
        const result = generateEncounterSuggestions({
          monsters: [
            makeMonster({ challenge_rating: '1/8', xp: 25 }),
            makeMonster({ challenge_rating: '1/2', xp: 100 }),
          ],
          playerLevels: [1, 1],
          difficulty: 1,
          environments: ['forest'],
        });
        expect(Array.isArray(result)).toBe(true);
      });
    });

    describe('suggestion structure', () => {
      const baseParams = {
        monsters: [
          makeMonster({ index: 0, name: 'Goblin', challenge_rating: '1/4', xp: 50 }),
          makeMonster({ index: 1, name: 'Orc', challenge_rating: '1/2', xp: 100 }),
        ],
        playerLevels: [1, 1, 1, 1],
        difficulty: 1,
        environments: ['forest'],
      };

      it('should return suggestions with correct difficultyLabel values', () => {
        const result = generateEncounterSuggestions(baseParams);
        const validLabels = ['Easy', 'Medium', 'Hard', 'Deadly'];
        for (const suggestion of result) {
          expect(validLabels).toContain(suggestion.difficultyLabel);
        }
      });

      it('should include totalXP greater than 0 in each suggestion', () => {
        const result = generateEncounterSuggestions(baseParams);
        for (const suggestion of result) {
          expect(suggestion.totalXP).toBeGreaterThan(0);
        }
      });

      it('should include monsterCount greater than 0 in each suggestion', () => {
        const result = generateEncounterSuggestions(baseParams);
        for (const suggestion of result) {
          expect(suggestion.monsterCount).toBeGreaterThan(0);
        }
      });

      it('should include monsters array with qty >= 1 in each suggestion', () => {
        const result = generateEncounterSuggestions(baseParams);
        for (const suggestion of result) {
          expect(Array.isArray(suggestion.monsters)).toBe(true);
          expect(suggestion.monsters.length).toBeGreaterThan(0);
          for (const m of suggestion.monsters) {
            expect(m.qty).toBeGreaterThanOrEqual(1);
          }
        }
      });
    });

    describe('count and filtering behavior', () => {
      it('should not exceed the requested count', () => {
        const monsters = Array.from({ length: 20 }, (_, i) =>
          makeMonster({ index: i, name: `Monster${i}`, environments: ['forest'] })
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

      it('should respect count of 1', () => {
        const result = generateEncounterSuggestions({
          monsters: [
            makeMonster({ index: 0, name: 'Goblin', challenge_rating: '1/4', xp: 50 }),
            makeMonster({ index: 1, name: 'Orc', challenge_rating: '1/2', xp: 100 }),
          ],
          playerLevels: [1, 1, 1, 1],
          difficulty: 1,
          environments: ['forest'],
          count: 1,
        });
        expect(result.length).toBeLessThanOrEqual(1);
      });

      it('should filter by environment matching', () => {
        const result = generateEncounterSuggestions({
          monsters: [
            makeMonster({ index: 0, name: 'Goblin', environments: ['forest'] }),
            makeMonster({ index: 1, name: 'Marid', environments: ['underwater'] }),
          ],
          playerLevels: [1, 1, 1, 1],
          difficulty: 1,
          environments: ['forest'],
        });
        for (const suggestion of result) {
          for (const m of suggestion.monsters) {
            expect(m.environments).toContain('forest');
          }
        }
      });

      it('should include allied monsters when available', () => {
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
        const hasBoth = result.some(
          (s) => s.monsters.length >= 2 && s.monsters.some((m) => m.name === 'Goblin')
        );
        expect(hasBoth).toBe(true);
      });
    });

    describe('party size and level variations', () => {
      it('should produce suggestions for high level parties', () => {
        const result = generateEncounterSuggestions({
          monsters: [
            makeMonster({ index: 0, name: 'Dragon', challenge_rating: '10', xp: 5900 }),
            makeMonster({ index: 1, name: 'Giant', challenge_rating: '5', xp: 1800 }),
          ],
          playerLevels: [15, 15, 15, 15],
          difficulty: 2,
          environments: ['forest'],
        });
        expect(Array.isArray(result)).toBe(true);
      });

      it('should produce different suggestions for different difficulty indices', () => {
        const monsters = [
          makeMonster({ index: 0, name: 'Goblin', challenge_rating: '1/4', xp: 50 }),
          makeMonster({ index: 1, name: 'Orc', challenge_rating: '1/2', xp: 100 }),
          makeMonster({ index: 2, name: 'Troll', challenge_rating: '5', xp: 1800 }),
          makeMonster({ index: 3, name: 'Dragon', challenge_rating: '10', xp: 5900 }),
        ];
        const easyResult = generateEncounterSuggestions({
          monsters,
          playerLevels: [3, 3, 3, 3],
          difficulty: 0,
          environments: ['forest'],
          count: 5,
        });
        const hardResult = generateEncounterSuggestions({
          monsters,
          playerLevels: [3, 3, 3, 3],
          difficulty: 2,
          environments: ['forest'],
          count: 5,
        });
        const easyLabels = easyResult.map((s) => s.difficultyLabel);
        const hardLabels = hardResult.map((s) => s.difficultyLabel);
        expect(easyLabels).not.toEqual(hardLabels);
      });

      it('should handle uneven party levels', () => {
        const result = generateEncounterSuggestions({
          monsters: [
            makeMonster({ index: 0, name: 'Goblin', challenge_rating: '1/4', xp: 50 }),
            makeMonster({ index: 1, name: 'Orc', challenge_rating: '1/2', xp: 100 }),
          ],
          playerLevels: [1, 3, 5, 7],
          difficulty: 1,
          environments: ['forest'],
        });
        expect(Array.isArray(result)).toBe(true);
      });
    });
  });
});
