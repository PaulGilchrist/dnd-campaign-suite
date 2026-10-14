import { describe, it, expect } from 'vitest';
import raceRules from './2024.js';

describe('raceRules 2024 - getRacialBonus', () => {
  describe('getRacialBonus', () => {
    it('always returns 0 regardless of arguments', () => {
      expect(raceRules.getRacialBonus()).toBe(0);
      expect(raceRules.getRacialBonus(undefined, undefined)).toBe(0);
      expect(raceRules.getRacialBonus({}, 'Strength')).toBe(0);
      expect(raceRules.getRacialBonus(null, 'Strength')).toBe(0);
      expect(raceRules.getRacialBonus({ race: { name: 'Human', ability_bonuses: [{ ability_score: 'Strength', bonus: 2 }] } }, 'Strength')).toBe(0);
    });
  });
});
