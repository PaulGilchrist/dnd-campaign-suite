// @improved-by-ai
import { describe, it, expect } from 'vitest';
import * as raceRulesModule from './index.js';
import rules5e from './5e.js';
import rules2024 from './2024.js';

const EXPECTED_METHODS = [
  'getImmunities',
  'getRace',
  'getRacialBonus',
  'getResistances',
  'getSenses',
  'addTraits',
  'getTraits',
];

describe('race-rules/index', () => {
  describe('exports', () => {
    it('exports rules5e as a defined object', () => {
      expect(raceRulesModule.rules5e).toBeDefined();
      expect(typeof raceRulesModule.rules5e).toBe('object');
    });

    it('exports rules2024 as a defined object', () => {
      expect(raceRulesModule.rules2024).toBeDefined();
      expect(typeof raceRulesModule.rules2024).toBe('object');
    });

    it('exports are different objects', () => {
      expect(raceRulesModule.rules5e).not.toBe(raceRulesModule.rules2024);
    });

    it('exports rules5e as the default from 5e.js', () => {
      expect(raceRulesModule.rules5e).toBe(rules5e);
    });

    it('exports rules2024 as the default from 2024.js', () => {
      expect(raceRulesModule.rules2024).toBe(rules2024);
    });

    it('exports only rules5e and rules2024', () => {
      expect(Object.keys(raceRulesModule)).toEqual(['rules5e', 'rules2024']);
    });
  });

  describe('rules5e contract', () => {
    it.each(EXPECTED_METHODS)('has method %s as a function', (method) => {
      expect(typeof raceRulesModule.rules5e[method]).toBe('function');
    });

    it('has no unexpected methods beyond the expected set', () => {
      const actualMethods = Object.keys(raceRulesModule.rules5e);
      expect(actualMethods).toEqual(expect.arrayContaining(EXPECTED_METHODS));
    });
  });

  describe('rules2024 contract', () => {
    it.each(EXPECTED_METHODS)('has method %s as a function', (method) => {
      expect(typeof raceRulesModule.rules2024[method]).toBe('function');
    });

    it('has no unexpected methods beyond the expected set', () => {
      const actualMethods = Object.keys(raceRulesModule.rules2024);
      expect(actualMethods).toEqual(expect.arrayContaining(EXPECTED_METHODS));
    });
  });

  describe('5e vs 2024 differences', () => {
    it('exports are not the same reference even though they share the same method names', () => {
      for (const method of EXPECTED_METHODS) {
        expect(typeof raceRulesModule.rules5e[method]).toBe('function');
        expect(typeof raceRulesModule.rules2024[method]).toBe('function');
      }
      expect(raceRulesModule.rules5e).not.toBe(raceRulesModule.rules2024);
    });

    it('5e getRacialBonus returns a non-zero value for a race with ability bonuses', () => {
      const result = raceRulesModule.rules5e.getRacialBonus(
        { race: { ability_bonuses: [{ ability_score: 'Strength', bonus: 2 }] } },
        'Strength'
      );
      expect(result).toBe(2);
    });

    it('2024 getRacialBonus returns 0 regardless of input', () => {
      const result = raceRulesModule.rules2024.getRacialBonus(
        { race: { ability_bonuses: [{ ability_score: 'Strength', bonus: 2 }] } },
        'Strength'
      );
      expect(result).toBe(0);
    });
  });
});
