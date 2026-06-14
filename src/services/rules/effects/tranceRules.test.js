import { describe, it, expect } from 'vitest';
import { hasTranceTrait } from './tranceRules.js';

describe('tranceRules', () => {
  describe('hasTranceTrait', () => {
    it('returns true when race has Trance trait', () => {
      const playerStats = {
        race: {
          traits: [{ name: 'Trance', description: "You don't need to sleep." }]
        }
      };
      expect(hasTranceTrait(playerStats)).toBe(true);
    });

    it('returns false when race has no traits', () => {
      const playerStats = { race: { traits: [] } };
      expect(hasTranceTrait(playerStats)).toBe(false);
    });

    it('returns false when race has no traits property', () => {
      const playerStats = { race: {} };
      expect(hasTranceTrait(playerStats)).toBe(false);
    });

    it('returns false when race is null', () => {
      const playerStats = { race: null };
      expect(hasTranceTrait(playerStats)).toBe(false);
    });

    it('returns false when race is undefined', () => {
      const playerStats = {};
      expect(hasTranceTrait(playerStats)).toBe(false);
    });

    it('returns false for other trait names', () => {
      const playerStats = {
        race: {
          traits: [{ name: 'Darkvision', description: '...' }]
        }
      };
      expect(hasTranceTrait(playerStats)).toBe(false);
    });
  });
});
