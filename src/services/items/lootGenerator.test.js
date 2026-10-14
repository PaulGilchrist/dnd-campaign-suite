import { describe, it, expect } from 'vitest';

import {
  normalizeCurrency,
  formatCurrencyString,
  calculateEncounterXp,
} from './lootGenerator.js';

describe('normalizeCurrency', () => {
  it('returns all zero for totalGP of 0', () => {
    const result = normalizeCurrency(0);
    expect(result).toEqual({ pp: 0, gp: 0, sp: 0, cp: 0 });
  });

  it('converts fractional GP correctly', () => {
    const result = normalizeCurrency(2.55);
    expect(result).toEqual({ pp: 0, gp: 2, sp: 5, cp: 5 });
  });

  it('produces pp for large GP amounts', () => {
    const result = normalizeCurrency(1234.56);
    expect(result).toEqual({ pp: 123, gp: 4, sp: 5, cp: 6 });
  });

  it('handles odd CP remainders', () => {
    const result = normalizeCurrency(0.07);
    expect(result).toEqual({ pp: 0, gp: 0, sp: 0, cp: 7 });
  });

  it('rounds sub-1-cp values to 0', () => {
    const result = normalizeCurrency(0.004);
    expect(result).toEqual({ pp: 0, gp: 0, sp: 0, cp: 0 });
  });

  it('rounds exactly 0.005 gp up to 1 cp', () => {
    const result = normalizeCurrency(0.005);
    expect(result).toEqual({ pp: 0, gp: 0, sp: 0, cp: 1 });
  });

  it('handles exact 100 GP boundary', () => {
    const result = normalizeCurrency(100);
    expect(result).toEqual({ pp: 10, gp: 0, sp: 0, cp: 0 });
  });

  it('handles exact 10 GP boundary', () => {
    const result = normalizeCurrency(10);
    expect(result).toEqual({ pp: 1, gp: 0, sp: 0, cp: 0 });
  });

  it('handles max denominations: 999.99 GP', () => {
    const result = normalizeCurrency(999.99);
    expect(result).toEqual({ pp: 99, gp: 9, sp: 9, cp: 9 });
  });

  it('produces negative values for negative input', () => {
    const result = normalizeCurrency(-5.25);
    expect(result).toEqual({ pp: -1, gp: -6, sp: -3, cp: -5 });
  });

  it('propagates NaN input to all denominations', () => {
    const result = normalizeCurrency(NaN);
    expect(result.pp).toBeNaN();
    expect(result.gp).toBeNaN();
    expect(result.sp).toBeNaN();
    expect(result.cp).toBeNaN();
  });

  it('produces Infinity for pp and NaN for gp/sp/cp with Infinity input', () => {
    const result = normalizeCurrency(Infinity);
    expect(result.pp).toBe(Infinity);
    expect(result.gp).toBeNaN();
    expect(result.sp).toBeNaN();
    expect(result.cp).toBeNaN();
  });

  it('produces -Infinity for pp and NaN for gp/sp/cp with negative Infinity input', () => {
    const result = normalizeCurrency(-Infinity);
    expect(result.pp).toBe(-Infinity);
    expect(result.gp).toBeNaN();
    expect(result.sp).toBeNaN();
    expect(result.cp).toBeNaN();
  });
});

describe('formatCurrencyString', () => {
  it('returns "0 platinum pieces" for all-zero currency', () => {
    expect(formatCurrencyString({ pp: 0, gp: 0, sp: 0, cp: 0 })).toBe('0 platinum pieces');
  });

  it('uses singular/plural correctly per denomination', () => {
    expect(formatCurrencyString({ pp: 1, gp: 0, sp: 0, cp: 0 })).toBe('1 platinum piece');
    expect(formatCurrencyString({ pp: 5, gp: 0, sp: 0, cp: 0 })).toBe('5 platinum pieces');
    expect(formatCurrencyString({ pp: 0, gp: 1, sp: 0, cp: 0 })).toBe('1 gold piece');
    expect(formatCurrencyString({ pp: 0, gp: 3, sp: 0, cp: 0 })).toBe('3 gold pieces');
    expect(formatCurrencyString({ pp: 0, gp: 0, sp: 1, cp: 0 })).toBe('1 silver coin');
    expect(formatCurrencyString({ pp: 0, gp: 0, sp: 2, cp: 0 })).toBe('2 silver coins');
    expect(formatCurrencyString({ pp: 0, gp: 0, sp: 0, cp: 1 })).toBe('1 copper coin');
    expect(formatCurrencyString({ pp: 0, gp: 0, sp: 0, cp: 4 })).toBe('4 copper coins');
  });

  it('joins multiple denominations with ", "', () => {
    const result = formatCurrencyString({ pp: 1, gp: 3, sp: 2, cp: 5 });
    expect(result).toBe('1 platinum piece, 3 gold pieces, 2 silver coins, 5 copper coins');
  });

  it('omits zero-valued denominations', () => {
    const result = formatCurrencyString({ pp: 0, gp: 5, sp: 0, cp: 3 });
    expect(result).toBe('5 gold pieces, 3 copper coins');
  });

  it('handles missing properties as zeros', () => {
    expect(formatCurrencyString({ gp: 5 })).toBe('5 gold pieces');
    expect(formatCurrencyString({})).toBe('0 platinum pieces');
  });

  it('handles large values across all denominations', () => {
    const result = formatCurrencyString({ pp: 99, gp: 99, sp: 99, cp: 99 });
    expect(result).toBe('99 platinum pieces, 99 gold pieces, 99 silver coins, 99 copper coins');
  });

  it('omits zero denominations in the middle of the currency object', () => {
    const result = formatCurrencyString({ pp: 1, gp: 0, sp: 1, cp: 0 });
    expect(result).toBe('1 platinum piece, 1 silver coin');
  });

  it('handles negative values by including them in the output', () => {
    const result = formatCurrencyString({ pp: -1, gp: -2, sp: -3, cp: -4 });
    expect(result).toBe('-1 platinum pieces, -2 gold pieces, -3 silver coins, -4 copper coins');
  });

  it('handles a mix of positive and negative values', () => {
    const result = formatCurrencyString({ pp: 1, gp: -1, sp: 0, cp: 0 });
    expect(result).toBe('1 platinum piece, -1 gold pieces');
  });
});

describe('calculateEncounterXp', () => {
  it('returns 0 for null, undefined, and empty array', () => {
    expect(calculateEncounterXp(null)).toBe(0);
    expect(calculateEncounterXp(undefined)).toBe(0);
    expect(calculateEncounterXp([])).toBe(0);
  });

  it('returns 0 for inputs without .length property (number, object)', () => {
    expect(calculateEncounterXp(42)).toBe(0);
    expect(calculateEncounterXp({ name: 'Goblin' })).toBe(0);
  });

  it('throws for string input (array-like but not an array)', () => {
    expect(() => calculateEncounterXp('goblins')).toThrow(TypeError);
  });

  it('sums xp multiplied by qty for a single monster', () => {
    const monsters = [{ name: 'Goblin', xp: 50, qty: 2 }];
    expect(calculateEncounterXp(monsters)).toBe(100);
  });

  it('defaults missing xp to 0', () => {
    const monsters = [{ name: 'Unknown' }];
    expect(calculateEncounterXp(monsters)).toBe(0);
  });

  it('treats falsy qty (0, null, undefined) as 1 via || operator', () => {
    expect(calculateEncounterXp([{ name: 'A', xp: 50, qty: 0 }])).toBe(50);
    expect(calculateEncounterXp([{ name: 'B', xp: 50, qty: null }])).toBe(50);
    expect(calculateEncounterXp([{ name: 'C', xp: 50, qty: undefined }])).toBe(50);
  });

  it('defaults missing qty to 1 (covered by falsy qty test)', () => {
    const monsters = [{ name: 'Goblin', xp: 50 }];
    expect(calculateEncounterXp(monsters)).toBe(50);
  });

  it('multiplies xp by qty when present', () => {
    const monsters = [{ name: 'Orc', xp: 200, qty: 3 }];
    expect(calculateEncounterXp(monsters)).toBe(600);
  });

  it('handles mixed monsters with and without xp and qty', () => {
    const monsters = [
      { name: 'Goblin', xp: 50, qty: 2 },
      { name: 'Skeleton' },
      { name: 'Orc', xp: 200 },
    ];
    expect(calculateEncounterXp(monsters)).toBe(300);
  });

  it('handles negative xp values', () => {
    const monsters = [
      { name: 'Friendly NPC', xp: -50 },
      { name: 'Hostile NPC', xp: 100 },
    ];
    expect(calculateEncounterXp(monsters)).toBe(50);
  });

  it('handles negative qty values', () => {
    const monsters = [{ name: 'Negative', xp: 50, qty: -2 }];
    expect(calculateEncounterXp(monsters)).toBe(-100);
  });

  it('handles very large qty values', () => {
    const monsters = [{ name: 'Horde', xp: 10, qty: 1000 }];
    expect(calculateEncounterXp(monsters)).toBe(10000);
  });
});
