// @improved-by-ai
import { describe, it, expect } from 'vitest';
import { computeSaveDc } from './saveDc.js';

describe('computeSaveDc', () => {
  describe('formula correctness', () => {
    it('returns 8 + ability bonus + proficiency', () => {
      const playerStats = {
        abilities: [{ name: 'Strength', bonus: 3 }],
      };
      expect(computeSaveDc(playerStats, 'strength', 2)).toBe(13);
    });

    it('handles negative ability bonus', () => {
      const playerStats = {
        abilities: [{ name: 'Strength', bonus: -2 }],
      };
      expect(computeSaveDc(playerStats, 'strength', 2)).toBe(8);
    });

    it('handles negative proficiency bonus', () => {
      const playerStats = {
        abilities: [{ name: 'Strength', bonus: 3 }],
      };
      expect(computeSaveDc(playerStats, 'strength', -1)).toBe(10);
    });

    it('handles large proficiency bonus', () => {
      const playerStats = {
        abilities: [{ name: 'Strength', bonus: 5 }],
      };
      expect(computeSaveDc(playerStats, 'strength', 8)).toBe(21);
    });
  });

  describe('proficiency fallback', () => {
    it('uses 0 when proficiency is omitted', () => {
      const playerStats = {
        abilities: [{ name: 'Constitution', bonus: 1 }],
      };
      expect(computeSaveDc(playerStats, 'con')).toBe(9);
    });

    it('uses 0 when proficiency is explicitly 0', () => {
      const playerStats = {
        abilities: [{ name: 'Constitution', bonus: 1 }],
      };
      expect(computeSaveDc(playerStats, 'con', 0)).toBe(9);
    });

    it('uses 0 when proficiency is undefined', () => {
      const playerStats = {
        abilities: [{ name: 'Constitution', bonus: 1 }],
      };
      expect(computeSaveDc(playerStats, 'con', undefined)).toBe(9);
    });

    it('returns base 8 when ability and proficiency are both 0', () => {
      const playerStats = {
        abilities: [{ name: 'Constitution', bonus: 0 }],
      };
      expect(computeSaveDc(playerStats, 'con')).toBe(8);
    });
  });

  describe('ability name resolution', () => {
    it('resolves shorthand ability names', () => {
      const playerStats = {
        abilities: [{ name: 'Charisma', bonus: 5 }],
      };
      expect(computeSaveDc(playerStats, 'cha', 3)).toBe(16);
    });

    it('resolves full ability names', () => {
      const playerStats = {
        abilities: [{ name: 'Intelligence', bonus: 3 }],
      };
      expect(computeSaveDc(playerStats, 'intelligence', 2)).toBe(13);
    });

    it('resolves ability names case-insensitively', () => {
      const playerStats = {
        abilities: [{ name: 'Strength', bonus: 2 }],
      };
      expect(computeSaveDc(playerStats, 'STRENGTH', 1)).toBe(11);
    });

    it('resolves ability names with spaces case-insensitively', () => {
      const playerStats = {
        abilities: [{ name: 'Dexterity', bonus: 3 }],
      };
      expect(computeSaveDc(playerStats, 'dexterity', 2)).toBe(13);
    });

    it('defaults to 0 bonus for unknown ability names', () => {
      const playerStats = {
        abilities: [{ name: 'Strength', bonus: 3 }],
      };
      expect(computeSaveDc(playerStats, 'magic', 2)).toBe(10);
    });
  });

  describe('all six abilities', () => {
    it('computes correct save DC for each ability score', () => {
      const playerStats = {
        abilities: [
          { name: 'Strength', bonus: 3 },
          { name: 'Dexterity', bonus: 2 },
          { name: 'Constitution', bonus: 1 },
          { name: 'Intelligence', bonus: 4 },
          { name: 'Wisdom', bonus: 5 },
          { name: 'Charisma', bonus: -1 },
        ],
      };
      expect(computeSaveDc(playerStats, 'str', 2)).toBe(13);
      expect(computeSaveDc(playerStats, 'dex', 2)).toBe(12);
      expect(computeSaveDc(playerStats, 'con', 2)).toBe(11);
      expect(computeSaveDc(playerStats, 'int', 2)).toBe(14);
      expect(computeSaveDc(playerStats, 'wis', 2)).toBe(15);
      expect(computeSaveDc(playerStats, 'cha', 2)).toBe(9);
    });
  });
});
