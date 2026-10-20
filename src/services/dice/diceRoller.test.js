// @maintained-by-ai
// ── diceRoller ENGINE lane ───────────────────────────────────────────
// This file owns the real dice engine: grammar, RNG consumption counts,
// keep-highest/lowest selection core (#938: rollAdvantage/rollDisadvantage
// exact pairs), and reroll semantics. Consumer lanes (fallDamage, attack
// steps, automation handlers, etc.) MOCK this module — they pin their own
// applied bytes (#1032), never engine math, so nothing here duplicates them.
// Stub-convention fidelity (#1026): consumer stubs roll NdM → ⌊M/2⌋+1;
// that mirrors this engine's real rollDie exactly at Math.random()=0.5 —
// pinned in the rollDie table below. If that pin ever fails, the stub
// convention has drifted: forward the correction to the consumer lanes.
//
// RNG is the only external seam: every total is exact from a pinned random
// sequence, consumed-exactly pins on every roll (#973: no range assertions).
// No keep-highest dice grammar (kh/kl) is authored — such formulas honestly
// parse to null (#945). No huge-count cap is authored — not tested.
//
// old→new map: 45 range-leaning its → 15 exact tables.
//   rollD20/rollDie/rollDice range loops → exact-face tables + consumed pins
//   8 parseExpression its → 2 it.each tables (valid / null)
//   12 rollExpression its → grammar table + invalid table + rerollOnes pair
//   5 doubled / 2 maximized its → 1 it.each each
//   10 formatDamageFormula + 5 applyHealingRerollOnes its → tables
// ──────────────────────────────────────────────────────────────────────
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  rollD20,
  rollDie,
  rollDice,
  rollAdvantage,
  rollDisadvantage,
  parseExpression,
  canRollExpression,
  rollExpression,
  rollExpressionDoubled,
  rollExpressionMaximized,
  formatDamageFormula,
  applyHealingRerollOnes,
} from './diceRoller.js';

// Pin Math.random to an exact byte sequence; over-consumption fails loudly
// and every test asserts the full sequence was consumed (consumed-exactly).
function pinRandom(seq) {
  const spy = vi.spyOn(Math, 'random').mockImplementation(() => {
    const i = spy.mock.calls.length - 1;
    if (i >= seq.length) {
      throw new Error(`RNG over-consumed: call ${i + 1} exceeds pinned sequence of ${seq.length}`);
    }
    return seq[i];
  });
  return spy;
}

afterEach(() => {
  vi.restoreAllMocks(); // re-arms real Math.random (#1007/#1057)
});

// ── primitive dice: exact faces from pinned sequences ────────────────

describe('rollD20', () => {
  it.each([
    { label: 'min face', seq: [0], expected: 1 },
    { label: 'max face', seq: [0.999999], expected: 20 },
  ])('rolls exactly $expected ($label), consuming one random', ({ seq, expected }) => {
    const rng = pinRandom(seq);
    expect(rollD20()).toBe(expected);
    expect(rng).toHaveReturnedTimes(1);
  });
});

describe('rollDie', () => {
  // At Math.random()=0.5 the engine yields ⌊sides/2⌋+1 — the exact value
  // the #1026 consumer stub convention promises. Pin keeps stub faithful.
  it.each([4, 6, 8, 10, 12, 20])('d%i at random=0.5 rolls %i (stub-convention mirror)', (sides) => {
    const rng = pinRandom([0.5]);
    expect(rollDie(sides)).toBe(Math.floor(sides / 2) + 1);
    expect(rng).toHaveReturnedTimes(1);
  });
});

describe('rollDice', () => {
  it.each([
    { count: 2, sides: 6, seq: [0.1, 0.9], rolls: [1, 6], total: 7 },
    { count: 3, sides: 6, seq: [0, 0, 0], rolls: [1, 1, 1], total: 3 },
    { count: 3, sides: 20, seq: [0.999999, 0.999999, 0.999999], rolls: [20, 20, 20], total: 60 },
    { count: 0, sides: 6, seq: [], rolls: [], total: 0 },
    { count: -1, sides: 6, seq: [], rolls: [], total: 0 },
  ])('rollDice($count, d$sides) → total $total, consuming exactly $seq.length randoms', ({ count, sides, seq, rolls, total }) => {
    const rng = pinRandom(seq);
    expect(rollDice(count, sides)).toEqual({ rolls, total });
    expect(rng).toHaveReturnedTimes(seq.length);
  });
});

// ── selection core (#938): keep-highest / keep-lowest pairs ─────────

describe('rollAdvantage', () => {
  it.each([
    { seq: [0.999999, 0.1], rolls: [20, 3], kept: 20 },
    { seq: [0.1, 0.999999], rolls: [3, 20], kept: 20 },
    { seq: [0.5, 0.5], rolls: [11, 11], kept: 11 },
  ])('keeps highest of $rolls, consuming exactly 2', ({ seq, rolls, kept }) => {
    const rng = pinRandom(seq);
    expect(rollAdvantage()).toEqual({ total: kept, rolls, label: 'advantage' });
    expect(rng).toHaveReturnedTimes(2);
  });
});

describe('rollDisadvantage', () => {
  it.each([
    { seq: [0.999999, 0.1], rolls: [20, 3], kept: 3 },
    { seq: [0.1, 0.999999], rolls: [3, 20], kept: 3 },
  ])('keeps lowest of $rolls, consuming exactly 2', ({ seq, rolls, kept }) => {
    const rng = pinRandom(seq);
    expect(rollDisadvantage()).toEqual({ total: kept, rolls, label: 'disadvantage' });
    expect(rng).toHaveReturnedTimes(2);
  });
});

// ── grammar: parseExpression (pure, consumes 0 RNG) ─────────────────

describe('parseExpression', () => {
  it.each([
    { formula: 'd20', count: 1, sides: 20, modifier: 0 },
    { formula: '2d6', count: 2, sides: 6, modifier: 0 },
    { formula: '1d8+3', count: 1, sides: 8, modifier: 3 },
    { formula: '1d10-2', count: 1, sides: 10, modifier: -2 },
    { formula: '1d8+4+2', count: 1, sides: 8, modifier: 6 },
    { formula: '1d10+5-3', count: 1, sides: 10, modifier: 2 },
    { formula: '2d6[fire]', count: 2, sides: 6, modifier: 0 },
    { formula: '[Damage] 1d8+3', count: 1, sides: 8, modifier: 3 },
    { formula: '1d8 [tag] +3', count: 1, sides: 8, modifier: 3 },
    { formula: '2D6', count: 2, sides: 6, modifier: 0 },
    { formula: '1D8+3', count: 1, sides: 8, modifier: 3 },
    { formula: '2 d 6', count: 2, sides: 6, modifier: 0 },
    { formula: '0d6', count: 0, sides: 6, modifier: 0 },
    { formula: '1d8 + 3 or 2d6', count: 1, sides: 8, modifier: 3 },
    { formula: 'invalid or 2d6', count: 2, sides: 6, modifier: 0 },
  ])('parses $formula', ({ formula, count, sides, modifier }) => {
    expect(parseExpression(formula)).toEqual({ count, sides, modifier });
  });

  // Junk fails honestly (null), never a fabricated roll (#945).
  // kh/kl keep notation is NOT authored here — selection core lives in
  // rollAdvantage/rollDisadvantage; junk keep-formulas parse to null.
  it.each([
    '', '   ', '[tag]', '[a] [b]', 'not a formula', 'abc',
    '2d', 'd', '4', '0', '-2d6', '2d6kh1', 'd6kl1', 'invalid or nonsense',
  ])('returns null for $formula', (formula) => {
    expect(parseExpression(formula)).toBeNull();
  });
});

describe('canRollExpression', () => {
  it.each([
    ['2d6', true],
    ['d20', true],
    ['1d8+3[damage]', true],
    ['1d8 plus 2', true],
    ['2d6 or junk', true],
    [' 2d6 ', true],
    ['', false],
    ['   ', false],
    ['junk', false],
    ['4', false],
    ['2d', false],
    ['2d6kh1', false],
    ['[tag]', false],
  ])('canRollExpression($formula) === $expected', (formula, expected) => {
    expect(canRollExpression(formula)).toBe(expected);
  });
});

// ── rollExpression: grammar + exact totals + RNG consumption ─────────

describe('rollExpression', () => {
  it.each([
    { formula: 'd20', seq: [0.5], rolls: [11], modifier: 0, total: 11, echo: 'd20' },
    { formula: '2d6+3', seq: [0.1, 0.9], rolls: [1, 6], modifier: 3, total: 10, echo: '2d6+3' },
    { formula: '1d8-2', seq: [0.5], rolls: [5], modifier: -2, total: 3, echo: '1d8-2' },
    { formula: '1d8+4+2', seq: [0], rolls: [1], modifier: 6, total: 7, echo: '1d8+4+2' },
    { formula: '2 d 6', seq: [0.5, 0.5], rolls: [4, 4], modifier: 0, total: 8, echo: '2 d 6' },
    { formula: '2d6[fire]', seq: [0.5, 0.5], rolls: [4, 4], modifier: 0, total: 8, echo: '2d6[fire]' },
    { formula: '2D20', seq: [0.999999, 0], rolls: [20, 1], modifier: 0, total: 21, echo: '2D20' },
    { formula: '0d6+2', seq: [], rolls: [], modifier: 2, total: 2, echo: '0d6+2' },
    { formula: '1d8+7 plus 4', seq: [0.5], rolls: [5], modifier: 11, total: 16, echo: '1d8+7 plus 4' },
    { formula: '1d8+7 plus 4 [bludgeoning]', seq: [0.5], rolls: [5], modifier: 11, total: 16, echo: '1d8+7 plus 4 [bludgeoning]' },
    { formula: '1d8 plus 2d6', seq: [0.5, 0.5, 0.5], rolls: [5, 4, 4], modifier: 0, total: 13, echo: '1d8 plus 2d6' },
    { formula: '1d8+3 or 2d6', seq: [0.5], rolls: [5], modifier: 3, total: 8, echo: '1d8+3' },
    { formula: 'invalid or 2d6', seq: [0.5, 0.5], rolls: [4, 4], modifier: 0, total: 8, echo: '2d6' },
    { formula: '4 plus 3', seq: [], rolls: [], modifier: 7, total: 7, echo: '4 plus 3' },
  ])('rolls $formula → total $total from pinned bytes, consuming exactly $seq.length', ({ formula, seq, rolls, modifier, total, echo }) => {
    const rng = pinRandom(seq);
    // "or" results echo the selected part's formula, "plus" results the full input.
    expect(rollExpression(formula)).toEqual({ total, rolls, modifier, formula: echo });
    expect(rng).toHaveReturnedTimes(seq.length);
  });

  // Flat constants alone never roll (#1063); junk and unauthored kh notation
  // fail honestly to null with 0 RNG consumed (#945).
  it.each(['', '   ', 'xyz', '[tag]', 'junk or nonsense', '4', '0', '-2d6', '2d', '2d6kh1'])('returns null for $formula (consuming 0)', (formula) => {
    const rng = pinRandom([]);
    expect(rollExpression(formula)).toBeNull();
    expect(rng).toHaveReturnedTimes(0);
  });

  // rerollOnes: only 1s consume a reroll; consumed counts are exact.
  it.each([
    { formula: '1d6', label: 'no ones', seq: [0.5], rolls: [4], total: 4 },
    { formula: '3d6', label: 'one reroll', seq: [0, 0.5, 0.9, 0.7], rolls: [5, 4, 6], total: 15 },
    { formula: '2d6', label: 'all rerolled', seq: [0, 0, 0.999999, 0.5], rolls: [6, 4], total: 10 },
    { formula: '1d6', label: 'reroll stays a 1', seq: [0, 0], rolls: [1], total: 1 },
  ])('rerollOnes $formula ($label) → rolls $rolls, consuming exactly $seq.length', ({ formula, seq, rolls, total }) => {
    const rng = pinRandom(seq);
    expect(rollExpression(formula, { rerollOnes: true })).toEqual({ total, rolls, modifier: 0, formula });
    expect(rng).toHaveReturnedTimes(seq.length);
  });
});

// ── crit doubling: dice double, modifiers and constants do not ──────

describe('rollExpressionDoubled', () => {
  it.each([
    { formula: '1d8+3', seq: [0.5], rolls: [5], doubledRolls: [5, 5], modifier: 3, total: 13, echo: '1d8+3' },
    { formula: '1d8+7 plus 4', seq: [0.5], rolls: [5], doubledRolls: [5, 5], modifier: 11, total: 21, echo: '1d8+7 plus 4' },
    { formula: '1d8 plus 2d6', seq: [0.5, 0.5, 0.5], rolls: [5, 4, 4], doubledRolls: [5, 5, 4, 4, 4, 4], modifier: 0, total: 26, echo: '1d8 plus 2d6' },
    { formula: '1d8+3 or 2d6', seq: [0.5], rolls: [5], doubledRolls: [5, 5], modifier: 3, total: 13, echo: '1d8+3' },
  ])('doubles $formula → total $total (modifier flat), consuming exactly $seq.length', ({ formula, seq, rolls, doubledRolls, modifier, total, echo }) => {
    const rng = pinRandom(seq);
    expect(rollExpressionDoubled(formula)).toEqual({ total, rolls, doubledRolls, modifier, formula: echo });
    expect(rng).toHaveReturnedTimes(seq.length);
  });

  it.each(['xyz', '', '[tag]'])('returns null for $formula (consuming 0)', (formula) => {
    const rng = pinRandom([]);
    expect(rollExpressionDoubled(formula)).toBeNull();
    expect(rng).toHaveReturnedTimes(0);
  });
});

// ── maximize: no RNG at all ──────────────────────────────────────────

describe('rollExpressionMaximized', () => {
  it.each([
    { formula: '2d6', rolls: [6, 6], modifier: 0, total: 12 },
    { formula: '1d8+5', rolls: [8], modifier: 5, total: 13 },
    { formula: '3d10-2', rolls: [10, 10, 10], modifier: -2, total: 28 },
  ])('maximizes $formula → total $total without touching Math.random', ({ formula, rolls, modifier, total }) => {
    const rng = pinRandom([]);
    expect(rollExpressionMaximized(formula)).toEqual({ total, rolls, modifier, formula, maximized: true });
    expect(rng).toHaveReturnedTimes(0);
  });

  it.each(['xyz', '', '[tag]'])('returns null for $formula', (formula) => {
    expect(rollExpressionMaximized(formula)).toBeNull();
  });
});

// ── display formatting (pure strings) ───────────────────────────────

describe('formatDamageFormula', () => {
  it.each([
    { formula: '1d8', rolls: [5], isCrit: false, expected: '1d8 (5)' },
    { formula: '1d8+3', rolls: [5], isCrit: false, expected: '1d8+3 (5)' },
    { formula: '1d8-2', rolls: [5], isCrit: false, expected: '1d8-2 (5)' },
    { formula: '1d8+3', rolls: [5, 6], isCrit: false, expected: '1d8+3 (5, 6)' },
    { formula: '1d8+3', rolls: [5, 6], isCrit: true, expected: '1d8*2+3 (5, 6)' },
    { formula: '2d6', rolls: [3, 4], isCrit: false, expected: '2d6 (3, 4)' },
    { formula: '1d8+3[fire]', rolls: [5], isCrit: false, expected: '1d8+3 (5)' },
    { formula: '1d8+4+2', rolls: [3], isCrit: false, expected: '1d8+6 (3)' },
    { formula: '1d8+3', rolls: null, isCrit: false, expected: '1d8+3' },
    { formula: '1d8+3', rolls: [], isCrit: false, expected: '1d8+3' },
    { formula: '[tag]', rolls: [5], isCrit: false, expected: '[tag]' },
    { formula: 'not a formula', rolls: [5], isCrit: false, expected: 'not a formula' },
    { formula: '', rolls: [5], isCrit: false, expected: '' },
    { formula: null, rolls: [5], isCrit: false, expected: null },
    { formula: undefined, rolls: [5], isCrit: false, expected: undefined },
  ])('formats $formula rolls=$rolls crit=$isCrit → $expected', ({ formula, rolls, isCrit, expected }) => {
    expect(formatDamageFormula(formula, rolls, isCrit)).toBe(expected);
  });
});

// ── healing reroll of 1s (Lucky / healing reroll UI) ────────────────

describe('applyHealingRerollOnes', () => {
  it.each([
    { label: 'two of three are 1s', formula: '3d6', seq: [0.5, 0.9], rolls: [1, 4, 1], displayRolls: [4, 4, 6], originalRolls: [1, 4, 1] },
    { label: 'single die', formula: '1d6', seq: [0.9], rolls: [1], displayRolls: [6], originalRolls: [1] },
    // Reroll consumed the RNG but landed on a 1 again — honest pass-through.
    { label: 'reroll stays 1', formula: '2d6', seq: [0, 0], rolls: [1, 1], displayRolls: [1, 1], originalRolls: null },
  ])('rerolls 1s in $rolls for $formula ($label), consuming exactly $seq.length', ({ formula, seq, rolls, displayRolls, originalRolls }) => {
    const rng = pinRandom(seq);
    expect(applyHealingRerollOnes(rolls, formula)).toEqual({ displayRolls, originalRolls });
    expect(rng).toHaveReturnedTimes(seq.length);
  });

  // Pass-through cases never touch the RNG.
  it.each([
    { rolls: null, formula: '1d8+3', expected: { displayRolls: null, originalRolls: null } },
    { rolls: 'not an array', formula: '1d8+3', expected: { displayRolls: 'not an array', originalRolls: null } },
    { rolls: [3, 4, 5], formula: '3d6', expected: { displayRolls: [3, 4, 5], originalRolls: null } },
    { rolls: [1, 2, 3], formula: 'invalid', expected: { displayRolls: [1, 2, 3], originalRolls: null } },
  ])('passes through $rolls / $formula without consuming RNG', ({ rolls, formula, expected }) => {
    const rng = pinRandom([]);
    expect(applyHealingRerollOnes(rolls, formula)).toEqual(expected);
    expect(rng).toHaveReturnedTimes(0);
  });
});
