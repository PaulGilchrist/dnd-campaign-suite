import { describe, it, expect } from 'vitest';
import { computeSaveDc } from './saveDc.js';

describe('computeSaveDc', () => {
  it('should return 8 + ability bonus + proficiency', () => {
    const playerStats = {
      abilities: [{ name: 'Strength', bonus: 3 }],
    };
    expect(computeSaveDc(playerStats, 'strength', 2)).toBe(13);
  });

  it('should use proficiency of 0 when not provided', () => {
    const playerStats = {
      abilities: [{ name: 'Dexterity', bonus: 2 }],
    };
    expect(computeSaveDc(playerStats, 'dex')).toBe(10);
  });

  it('should use proficiency of 0 when explicitly passed as 0', () => {
    const playerStats = {
      abilities: [{ name: 'Constitution', bonus: 1 }],
    };
    expect(computeSaveDc(playerStats, 'con', 0)).toBe(9);
  });

  it('should handle negative ability bonus', () => {
    const playerStats = {
      abilities: [{ name: 'Strength', bonus: -2 }],
    };
    expect(computeSaveDc(playerStats, 'strength', 2)).toBe(8);
  });

  it('should handle positive proficiency bonus', () => {
    const playerStats = {
      abilities: [{ name: 'Wisdom', bonus: 4 }],
    };
    expect(computeSaveDc(playerStats, 'wisdom', 6)).toBe(18);
  });

  it('should handle ability name as shorthand abbreviation', () => {
    const playerStats = {
      abilities: [{ name: 'Charisma', bonus: 5 }],
    };
    expect(computeSaveDc(playerStats, 'cha', 3)).toBe(16);
  });

  it('should handle ability name as full name', () => {
    const playerStats = {
      abilities: [{ name: 'Intelligence', bonus: 3 }],
    };
    expect(computeSaveDc(playerStats, 'intelligence', 2)).toBe(13);
  });

  it('should handle ability name case-insensitively', () => {
    const playerStats = {
      abilities: [{ name: 'Strength', bonus: 2 }],
    };
    expect(computeSaveDc(playerStats, 'STRENGTH', 1)).toBe(11);
  });

  it('should handle ability name with spaces case-insensitively', () => {
    const playerStats = {
      abilities: [{ name: 'Dexterity', bonus: 3 }],
    };
    expect(computeSaveDc(playerStats, 'dexterity', 2)).toBe(13);
  });

  it('should return base 8 when ability bonus is 0 and proficiency is 0', () => {
    const playerStats = {
      abilities: [{ name: 'Constitution', bonus: 0 }],
    };
    expect(computeSaveDc(playerStats, 'con')).toBe(8);
  });

  it('should handle unknown ability name (bonus defaults to 0)', () => {
    const playerStats = {
      abilities: [{ name: 'Strength', bonus: 3 }],
    };
    expect(computeSaveDc(playerStats, 'magic', 2)).toBe(10);
  });

  it('should handle playerStats with no abilities property', () => {
    const playerStats = {};
    expect(computeSaveDc(playerStats, 'strength', 2)).toBe(10);
  });

  it('should handle null playerStats', () => {
    expect(computeSaveDc(null, 'strength', 2)).toBe(10);
  });

  it('should handle undefined playerStats', () => {
    expect(computeSaveDc(undefined, 'strength', 2)).toBe(10);
  });

  it('should handle empty abilities array', () => {
    const playerStats = {
      abilities: [],
    };
    expect(computeSaveDc(playerStats, 'strength', 2)).toBe(10);
  });

  it('should handle all six ability scores', () => {
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

  it('should handle large proficiency bonus', () => {
    const playerStats = {
      abilities: [{ name: 'Strength', bonus: 5 }],
    };
    expect(computeSaveDc(playerStats, 'strength', 8)).toBe(21);
  });

  it('should handle negative proficiency bonus', () => {
    const playerStats = {
      abilities: [{ name: 'Strength', bonus: 3 }],
    };
    expect(computeSaveDc(playerStats, 'strength', -1)).toBe(10);
  });

  it('should handle both negative ability bonus and negative proficiency', () => {
    const playerStats = {
      abilities: [{ name: 'Strength', bonus: -3 }],
    };
    expect(computeSaveDc(playerStats, 'strength', -2)).toBe(3);
  });

  it('should handle ability name with mixed casing and spaces', () => {
    const playerStats = {
      abilities: [{ name: 'Charisma', bonus: 2 }],
    };
    expect(computeSaveDc(playerStats, 'cHaRiSmA', 1)).toBe(11);
  });
});
