import { describe, it, expect } from 'vitest';

import { normalizeCurrency } from './lootGenerator.js';

// Edge-case rounding tests not in lootGenerator.test.js.
// Removed: normalizeCurrency(-5.25) exact duplicate of main file line 56.
// Removed: formatCurrencyString missing properties / large values / singular-plural
//   — all covered by main file formatCurrencyString tests (lines 86-135).

describe('normalizeCurrency rounding edge cases', () => {
  it('rounds 0.015 gp up to 2 cp', () => {
    expect(normalizeCurrency(0.015)).toEqual({ pp: 0, gp: 0, sp: 0, cp: 2 });
  });

  it('rounds 0.095 gp up to 10 cp then normalizes to 1 sp', () => {
    expect(normalizeCurrency(0.095)).toEqual({ pp: 0, gp: 0, sp: 1, cp: 0 });
  });

  it('rounds 19.99 gp correctly with carry', () => {
    expect(normalizeCurrency(19.99)).toEqual({ pp: 1, gp: 9, sp: 9, cp: 9 });
  });

  it('rounds 99.99 gp correctly with carry', () => {
    expect(normalizeCurrency(99.99)).toEqual({ pp: 9, gp: 9, sp: 9, cp: 9 });
  });

  it('rounds 100.005 gp to nearest cp', () => {
    expect(normalizeCurrency(100.005)).toEqual({ pp: 10, gp: 0, sp: 0, cp: 1 });
  });

  it('handles 0.045 gp rounding', () => {
    expect(normalizeCurrency(0.045)).toEqual({ pp: 0, gp: 0, sp: 0, cp: 5 });
  });

  it('handles 0.055 gp rounding', () => {
    expect(normalizeCurrency(0.055)).toEqual({ pp: 0, gp: 0, sp: 0, cp: 6 });
  });
});
