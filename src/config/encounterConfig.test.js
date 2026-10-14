// @maintained-by-ai: 2026-10-14
import { describe, it, expect } from 'vitest';
import { ENCOUNTER_CONFIG } from './encounterConfig.js';

// These tests guard the *contract* consumers rely on (encounterGenerator.js,
// EncounterBuilder.jsx), not the individual tunable numbers — the config is
// meant to be adjusted. Generator behavior through these values is covered
// in src/services/encounters/encounterGenerator.test.js, not re-tested here.

const DIFFICULTY_TIERS = 4; // Easy, Medium, Hard, Deadly
const PARTY_LEVELS = 21;    // calculateXPThreshold indexes levels 0..20

const isPositiveInteger = (value) => Number.isInteger(value) && value > 0;

describe('encounterConfig', () => {
  it('exports exactly the keys its consumers import, and no extras', () => {
    expect(Object.keys(ENCOUNTER_CONFIG).sort()).toEqual([
      'budgetTolerance',
      'crRange',
      'deadlyMultiplier',
      'defaultDifficulty',
      'defaultSuggestionCount',
      'difficultyMultipliers',
      'difficultyRatios',
      'suggestionOvergenerate',
      'xpThresholds',
    ]);
  });

  describe('xpThresholds', () => {
    it('is an ascending table of positive integers, [level 0..20][difficulty 0..3]', () => {
      const { xpThresholds } = ENCOUNTER_CONFIG;
      expect(xpThresholds).toHaveLength(PARTY_LEVELS);
      // Thresholds are summed and used as divisors — every entry must be positive.
      expect(xpThresholds.flat().every(isPositiveInteger)).toBe(true);
      for (const [level, thresholds] of xpThresholds.entries()) {
        expect(thresholds).toHaveLength(DIFFICULTY_TIERS);
        for (let d = 1; d < DIFFICULTY_TIERS; d++) {
          expect(
            thresholds[d],
            `level ${level}: difficulty ${d} should exceed difficulty ${d - 1}`,
          ).toBeGreaterThan(thresholds[d - 1]);
        }
        if (level > 0) {
          for (let d = 0; d < DIFFICULTY_TIERS; d++) {
            expect(
              thresholds[d],
              `difficulty ${d}: level ${level} should exceed level ${level - 1}`,
            ).toBeGreaterThan(xpThresholds[level - 1][d]);
          }
        }
      }
    });

    it('starts at the documented DMG baseline for a level 1 party', () => {
      // Anchors the table against column shifts; higher rows are custom-tuned.
      expect(ENCOUNTER_CONFIG.xpThresholds[0]).toEqual([15, 25, 40, 50]);
    });
  });

  describe('difficultyMultipliers', () => {
    it('bands partition (0, ∞] so every monster-count ratio resolves', () => {
      // calculateDifficultyMultiplier returns the first band whose ratioMax
      // >= monsterCount/partySize, so bands must be ordered and gapless.
      const { difficultyMultipliers } = ENCOUNTER_CONFIG;
      expect(difficultyMultipliers.length).toBeGreaterThan(0);
      difficultyMultipliers.forEach(({ ratioMax }, i) => {
        if (i === difficultyMultipliers.length - 1) {
          expect(ratioMax).toBe(Infinity);
        } else {
          expect(ratioMax).toBeGreaterThan(0);
          expect(ratioMax).toBeLessThan(difficultyMultipliers[i + 1].ratioMax);
        }
      });
    });

    it('scales multipliers up with monster pressure, from a neutral first band', () => {
      // More monsters per adventurer must never reduce effective XP.
      const { difficultyMultipliers } = ENCOUNTER_CONFIG;
      expect(difficultyMultipliers[0].multiplier).toBe(1);
      for (let i = 1; i < difficultyMultipliers.length; i++) {
        expect(difficultyMultipliers[i].multiplier)
          .toBeGreaterThanOrEqual(difficultyMultipliers[i - 1].multiplier);
      }
    });
  });

  describe('scalars and sub-ranges', () => {
    it('defaultDifficulty is a valid xpThresholds column index (0..3)', () => {
      const { defaultDifficulty } = ENCOUNTER_CONFIG;
      expect(Number.isInteger(defaultDifficulty) && defaultDifficulty >= 0).toBe(true);
      expect(defaultDifficulty).toBeLessThan(DIFFICULTY_TIERS);
    });

    it('crRange keeps candidate CR bounds finite and non-degenerate', () => {
      const { minMultiplier, minGap } = ENCOUNTER_CONFIG.crRange;
      expect(minMultiplier).toBeGreaterThan(0);
      expect(minMultiplier).toBeLessThanOrEqual(1);
      expect(minGap).toBeGreaterThanOrEqual(0);
    });

    it('budgetTolerance and deadlyMultiplier keep trims and safety caps at or above target', () => {
      expect(ENCOUNTER_CONFIG.budgetTolerance).toBeGreaterThanOrEqual(1);
      expect(ENCOUNTER_CONFIG.deadlyMultiplier).toBeGreaterThan(1);
    });

    it('difficultyRatios define ascending, positive band edges so all four labels are reachable', () => {
      const { easyMax, mediumMax, hardMax } = ENCOUNTER_CONFIG.difficultyRatios;
      expect(easyMax).toBeGreaterThan(0);
      expect(mediumMax).toBeGreaterThan(easyMax);
      expect(hardMax).toBeGreaterThan(mediumMax);
    });

    it('suggestion count settings stay positive integers so suggestions are always produced', () => {
      expect(isPositiveInteger(ENCOUNTER_CONFIG.defaultSuggestionCount)).toBe(true);
      // Overgenerate < 1 would stop the candidate loop before any suggestion is built.
      expect(isPositiveInteger(ENCOUNTER_CONFIG.suggestionOvergenerate)).toBe(true);
    });
  });
});
