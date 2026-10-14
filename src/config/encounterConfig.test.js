import { describe, it, expect } from 'vitest';
import { ENCOUNTER_CONFIG } from './encounterConfig.js';

const EXPECTED_KEYS = [
  'xpThresholds',
  'defaultDifficulty',
  'difficultyMultipliers',
  'crRange',
  'budgetTolerance',
  'deadlyMultiplier',
  'difficultyRatios',
  'defaultSuggestionCount',
  'suggestionOvergenerate',
];

describe('encounterConfig', () => {
  it('exports exactly the expected configuration keys and no extras', () => {
    const keys = Object.keys(ENCOUNTER_CONFIG);
    expect(keys).toHaveLength(9);
    expect(new Set(keys)).toEqual(new Set(EXPECTED_KEYS));
  });

  describe('xpThresholds', () => {
    it('is a 21x4 array with non-negative integers increasing across levels and difficulties', () => {
      expect(ENCOUNTER_CONFIG.xpThresholds).toHaveLength(21);
      for (const level of ENCOUNTER_CONFIG.xpThresholds) {
        expect(level).toHaveLength(4);
        for (const val of level) {
          expect(Number.isInteger(val) && val >= 0).toBe(true);
        }
        for (let i = 1; i < level.length; i++) {
          expect(level[i]).toBeGreaterThan(level[i - 1]);
        }
      }
      for (let d = 0; d < 4; d++) {
        for (let l = 1; l < ENCOUNTER_CONFIG.xpThresholds.length; l++) {
          expect(ENCOUNTER_CONFIG.xpThresholds[l][d]).toBeGreaterThan(
            ENCOUNTER_CONFIG.xpThresholds[l - 1][d],
          );
        }
      }
    });
  });
});
