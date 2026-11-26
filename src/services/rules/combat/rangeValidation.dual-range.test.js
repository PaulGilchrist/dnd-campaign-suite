// @maintained-by-ai 2026-11-20
// bug-monster-ranged-attack-wrong-range-bands: dual-notation ranges ("80/320 ft.",
// 79 authored bestiary fields) used to fail rangeToFeet's anchored single regex
// → null → computeRangeEffect NEVER applied the bands, and the monster-card press
// lane fell back to a fabricated 30 ft (×2 = 60) band: a Goblin Shortbow shot at
// 35/65 ft was forced disadvantaged/auto-missed and a 170-ft Hobgoblin Longbow
// AUTO-MISSed a would-hit roll — all inside the authored RAW ranges. These pins
// lock the real { normal, long } pair replacing the ×2 model for authored duals
// while single values keep the RAW normal×2 convention byte-identically.
import { describe, it, expect } from 'vitest';
import { rangeToFeet, rangePairToFeet, computeRangeEffect } from './rangeValidation.js';

describe('rangeToFeet — dual notation resolves to the NORMAL band', () => {
  it.each([
    ['"80/320 ft."', '80/320 ft.', 80],
    ['"150/600 ft."', '150/600 ft.', 150],
    ['"20/60 ft."', '20/60 ft.', 20],
    ['unit-less dual (MA-0436 shape)', '30/120', 30],
    ['spaces around the slash', '80 / 320 feet', 80],
    ['garbage dual stays null', '80/320 ft. extra', null],
  ])('%s → %p', (_label, range, feet) => {
    const result = rangeToFeet(range);
    if (feet === null) expect(result).toBeNull();
    else expect(result).toBe(feet);
  });
});

describe('rangePairToFeet — authored long figure beats the ×2 model', () => {
  it.each([
    ['dual string keeps the real long', '80/320 ft.', { normal: 80, long: 320 }],
    ['dual ×4 family', '150/600 ft.', { normal: 150, long: 600 }],
    ['dual ×3 family', '20/60 ft.', { normal: 20, long: 60 }],
    ['single number keeps RAW normal×2', 100, { normal: 100, long: 200 }],
    ['single string keeps RAW normal×2', '30 ft.', { normal: 30, long: 60 }],
    ['inverted dual is clamped (long ≥ normal)', '320/80 ft.', { normal: 320, long: 320 }],
    ['Touch is a melee pair', 'Touch', { normal: 8, long: 8 }],
    ['sight/unlimited stay infinite', 'Sight', { normal: Infinity, long: Infinity }],
  ])('%s', (_label, range, pair) => {
    expect(rangePairToFeet(range)).toEqual(pair);
  });

  // Nothing derivable → null (LENIENT), never a fabricated band.
  it.each([null, undefined, '', 'Special', 'Self', 'Self (cone)', 'abc', '120 feet extra'])(
    'rangePairToFeet(%p) → null', (range) => {
      expect(rangePairToFeet(range)).toBeNull();
    }
  );
});

describe('computeRangeEffect — live bug faces (test-campaign sandbox rig)', () => {
  // Goblin Shortbow 80/320: 35 ft was a forced "Beyond normal range (35 ft > 30 ft)"
  // disadvantage and 65 ft an "Out of range (65 ft > 60 ft)" auto-miss — both are
  // WITHIN normal RAW range and must roll a plain single die.
  it.each([35, 65, 80])('Shortbow 80/320 within normal at %p ft → normal', (ft) => {
    expect(computeRangeEffect('80/320 ft.', ft)).toEqual({ mode: 'normal' });
  });

  // Hobgoblin Longbow 150/600 at 170 ft: the natural 19 (+22 vs AC 12) was killed
  // by "Out of range (170 ft > 60 ft)". The honest face is long-range DISADVANTAGE.
  it('Longbow 150/600 at 170 ft → disadvantage, never auto-miss', () => {
    expect(computeRangeEffect('150/600 ft.', 170)).toEqual({
      mode: 'disadvantage',
      reason: 'Beyond normal range (170 ft > 150 ft)',
    });
  });

  // The genuine out-of-long-range shot still auto-misses — against the REAL
  // 600 (not the fabricated 60) figure.
  it('Longbow 150/600 beyond the real long band → auto-miss at the authored figure', () => {
    expect(computeRangeEffect('150/600 ft.', 665)).toEqual({
      mode: 'miss',
      reason: 'Out of range (665 ft > 600 ft)',
    });
  });

  // Boundaries on the real long figure (not ×2 of normal).
  it.each([
    [320, 'disadvantage'],
    [321, 'miss'],
  ])('Shortbow 80/320 boundary %p ft → %s', (ft, mode) => {
    expect(computeRangeEffect('80/320 ft.', ft).mode).toBe(mode);
  });

  it('dual band with featEffects: multiplier scales both figures, Sharpshooter caps at the real long', () => {
    expect(computeRangeEffect('150/600 ft.', 300, { rangeMultiplier: 2 })).toEqual({ mode: 'normal' });
    expect(computeRangeEffect('150/600 ft.', 301, { rangeMultiplier: 2 }).mode).toBe('disadvantage');
    expect(computeRangeEffect('150/600 ft.', 1201, { rangeMultiplier: 2 }).mode).toBe('miss');
    expect(computeRangeEffect('80/320 ft.', 300, { ignoresLongRangeDisadvantage: true }).mode).toBe('normal');
    expect(computeRangeEffect('80/320 ft.', 321, { ignoresLongRangeDisadvantage: true })).toEqual({
      mode: 'miss',
      reason: 'Out of range (321 ft > 320 ft)',
    });
  });

  // Single-value and melee lanes stay byte-identical to the pre-fix ×2 model
  // (rangeValidation.test.js owns the full table; these are the falsifier rows
  // proving the pair refactor changed nothing outside dual notation).
  it.each([
    [100, 150, 'disadvantage'],
    [100, 200, 'disadvantage'],
    [100, 201, 'miss'],
  ])('single numeric range %p at %p ft keeps the ×2 long model → %s', (range, ft, mode) => {
    expect(computeRangeEffect(range, ft).mode).toBe(mode);
  });

  // Lenient-open: an unresolvable range NEVER enforces a band (replaces the
  // fabricated 30 ft fallback the modal used to invent).
  it('unknown range stays lenient at any distance', () => {
    expect(computeRangeEffect(null, 500)).toEqual({ mode: 'normal' });
    expect(computeRangeEffect('Special', 1000000)).toEqual({ mode: 'normal' });
  });
});
