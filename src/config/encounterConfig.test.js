// @improved-by-ai
import { describe, it, expect } from 'vitest';
import { ENCOUNTER_CONFIG } from './encounterConfig.js';

// These tests guard the *contract* consumers rely on (encounterGenerator.js,
// EncounterBuilder.jsx), not the individual tunable numbers — the config is
// meant to be adjusted. Each test below fails only when a value would
// silently break the encounter engine:
//  - calculateXPThreshold indexes xpThresholds[level][difficulty] for level 0..20
//  - calculateDifficultyMultiplier scans difficultyMultipliers for the first
//    ratioMax >= monsterCount/partySize, so bands must partition (0, ∞]
//  - getDifficultyLabel divides effectiveXP by the party threshold and
//    compares against difficultyRatios, so thresholds and ratios must be positive
//  - EncounterBuilder uses defaultDifficulty as the initial UI selection
// Generator behavior through these values is covered in
// src/services/encounters/encounterGenerator.test.js — not re-tested here.

const DIFFICULTY_TIERS = 4; // Easy, Medium, Hard, Deadly
const PARTY_LEVELS = 21;    // generator accepts levels 0..20

const EXPECTED_KEYS = [
  'budgetTolerance',
  'crRange',
  'deadlyMultiplier',
  'defaultDifficulty',
  'defaultSuggestionCount',
  'difficultyMultipliers',
  'difficultyRatios',
  'suggestionOvergenerate',
  'xpThresholds',
];

const isPositiveInteger = (value) => Number.isInteger(value) && value > 0;

describe('encounterConfig', () => {
  it('exports exactly the keys its consumers import, and no extras', () => {
    // Sorted comparison gives a readable diff when a key is renamed or added.
    expect(Object.keys(ENCOUNTER_CONFIG).sort()).toEqual(EXPECTED_KEYS);
  });

  describe('xpThresholds', () => {
    it('is indexed [level 0..20][difficulty 0..3] as the generator expects', () => {
      expect(ENCOUNTER_CONFIG.xpThresholds).toHaveLength(PARTY_LEVELS);
      for (const levelThresholds of ENCOUNTER_CONFIG.xpThresholds) {
        expect(levelThresholds).toHaveLength(DIFFICULTY_TIERS);
      }
    });

    it('contains only positive integers (thresholds are summed and used as divisors)', () => {
      for (const levelThresholds of ENCOUNTER_CONFIG.xpThresholds) {
        for (const threshold of levelThresholds) {
          expect(isPositiveInteger(threshold)).toBe(true);
        }
      }
    });

    it('increases from Easy to Deadly within each level', () => {
      for (const [level, thresholds] of ENCOUNTER_CONFIG.xpThresholds.entries()) {
        for (let d = 1; d < DIFFICULTY_TIERS; d++) {
          expect(
            thresholds[d],
            `level ${level}: difficulty ${d} threshold should exceed difficulty ${d - 1}`,
          ).toBeGreaterThan(thresholds[d - 1]);
        }
      }
    });

    it('increases with party level within each difficulty tier', () => {
      for (let d = 0; d < DIFFICULTY_TIERS; d++) {
        for (let level = 1; level < PARTY_LEVELS; level++) {
          expect(
            ENCOUNTER_CONFIG.xpThresholds[level][d],
            `difficulty ${d}: level ${level} threshold should exceed level ${level - 1}`,
          ).toBeGreaterThan(ENCOUNTER_CONFIG.xpThresholds[level - 1][d]);
        }
      }
    });

    it('starts at the documented DMG baseline for a level 1 party', () => {
      // Anchors the table against column shifts; higher rows are custom-tuned.
      expect(ENCOUNTER_CONFIG.xpThresholds[0]).toEqual([15, 25, 40, 50]);
    });
  });

  describe('difficultyMultipliers', () => {
    const { difficultyMultipliers } = ENCOUNTER_CONFIG;

    it('covers every possible ratio — last band extends to Infinity', () => {
      expect(difficultyMultipliers.length).toBeGreaterThan(0);
      const last = difficultyMultipliers[difficultyMultipliers.length - 1];
      expect(last.ratioMax).toBe(Infinity);
    });

    it('has strictly ascending ratio bands with no gaps or overlaps', () => {
      // The generator returns the first band whose ratioMax >= ratio, so
      // unordered or overlapping bands would silently mis-score encounters.
      for (let i = 0; i < difficultyMultipliers.length; i++) {
        const { ratioMax } = difficultyMultipliers[i];
        if (i === difficultyMultipliers.length - 1) {
          expect(Number.isFinite(ratioMax)).toBe(false);
        } else {
          expect(Number.isFinite(ratioMax) && ratioMax > 0).toBe(true);
          expect(ratioMax).toBeLessThan(difficultyMultipliers[i + 1].ratioMax);
        }
      }
    });

    it('scales multipliers up with monster pressure, from a neutral first band', () => {
      // More monsters per adventurer must never make an encounter count for
      // *less* effective XP; the first band (few monsters) stays unadjusted.
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
      expect(Number.isFinite(minMultiplier) && minMultiplier > 0).toBe(true);
      expect(minMultiplier).toBeLessThanOrEqual(1);
      expect(Number.isFinite(minGap) && minGap >= 0).toBe(true);
    });

    it('budgetTolerance is at least 1 (never trims a suggestion below target XP)', () => {
      expect(ENCOUNTER_CONFIG.budgetTolerance).toBeGreaterThanOrEqual(1);
    });

    it('deadlyMultiplier keeps the safety cap above the deadly threshold', () => {
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
