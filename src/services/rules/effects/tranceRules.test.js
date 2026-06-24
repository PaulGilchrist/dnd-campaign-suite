// @improved-by-ai
import { describe, it, expect } from 'vitest';
import { hasTranceTrait } from './tranceRules.js';

describe('tranceRules', () => {
  describe('hasTranceTrait', () => {
    it('returns true when race has a Trance trait', () => {
      const playerStats = {
        race: {
          traits: [{ name: 'Trance', description: "You don't need to sleep." }],
        },
      };
      expect(hasTranceTrait(playerStats)).toBe(true);
    });

    it('returns true when Trance trait appears among other traits', () => {
      const playerStats = {
        race: {
          traits: [
            { name: 'Darkvision', description: '...' },
            { name: 'Trance', description: "You don't need to sleep." },
            { name: 'Fey Ancestry', description: '...' },
          ],
        },
      };
      expect(hasTranceTrait(playerStats)).toBe(true);
    });

    it('returns false for a trait with similar but different name', () => {
      const playerStats = {
        race: {
          traits: [
            { name: 'Trance-like', description: '...' },
            { name: 'Deep Trance', description: '...' },
            { name: 'trance', description: '...' },
          ],
        },
      };
      expect(hasTranceTrait(playerStats)).toBe(false);
    });

    it('returns false when race has no traits', () => {
      const playerStats = { race: { traits: [] } };
      expect(hasTranceTrait(playerStats)).toBe(false);
    });

    it('returns false when race object has no traits property', () => {
      const playerStats = { race: {} };
      expect(hasTranceTrait(playerStats)).toBe(false);
    });

    it('returns false when race is null', () => {
      const playerStats = { race: null };
      expect(hasTranceTrait(playerStats)).toBe(false);
    });

    it('returns false when race is undefined', () => {
      const playerStats = { race: undefined };
      expect(hasTranceTrait(playerStats)).toBe(false);
    });

    it('returns false when playerStats has no race property', () => {
      const playerStats = {};
      expect(hasTranceTrait(playerStats)).toBe(false);
    });

    it('handles traits as falsy non-array value', () => {
      const playerStats = { race: { traits: null } };
      expect(hasTranceTrait(playerStats)).toBe(false);
    });

    it('handles traits as falsy empty string', () => {
      const playerStats = { race: { traits: '' } };
      expect(hasTranceTrait(playerStats)).toBe(false);
    });

    it('returns false when a trait object has no name property', () => {
      const playerStats = {
        race: {
          traits: [{ description: 'Some trait without a name' }],
        },
      };
      expect(hasTranceTrait(playerStats)).toBe(false);
    });
  });
});
