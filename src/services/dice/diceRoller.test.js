import { describe, it, expect } from 'vitest';
import {
  rollD20,
  rollDie,
  rollDice,
  rollAdvantage,
  rollDisadvantage,
  parseExpression,
  rollExpression,
  rollExpressionDoubled,
  rollExpressionMaximized,
  formatDamageFormula,
  applyHealingRerollOnes,
} from './diceRoller.js';

// ── Helpers ──────────────────────────────────────────────────────────

function seededRandom(values) {
  const original = Math.random;
  let i = 0;
  Math.random = () => values[i++] ?? 0.5;
  return {
    restore: () => { Math.random = original; },
  };
}

// ── rollD20 ──────────────────────────────────────────────────────────

describe('rollD20', () => {
  it('returns an integer between 1 and 20 inclusive', () => {
    const { restore } = seededRandom([0]);
    try {
      const result = rollD20();
      expect(Number.isInteger(result)).toBe(true);
      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(20);
    } finally {
      restore();
    }
  });
});

// ── rollDie ──────────────────────────────────────────────────────────

describe('rollDie', () => {
  it('returns an integer between 1 and sides for standard dice', () => {
    for (const sides of [4, 6, 8, 10, 12, 20]) {
      const result = rollDie(sides);
      expect(Number.isInteger(result)).toBe(true);
      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(sides);
    }
  });
});

// ── rollDice ─────────────────────────────────────────────────────────

describe('rollDice', () => {
  it('returns correct number of rolls and sum for valid input', () => {
    const { restore } = seededRandom([0.1, 0.9]);
    try {
      const result = rollDice(2, 6);
      expect(result.rolls).toHaveLength(2);
      expect(result.rolls[0]).toBeGreaterThanOrEqual(1);
      expect(result.rolls[0]).toBeLessThanOrEqual(6);
      expect(result.rolls[1]).toBeGreaterThanOrEqual(1);
      expect(result.rolls[1]).toBeLessThanOrEqual(6);
      expect(result.total).toBe(result.rolls[0] + result.rolls[1]);
    } finally {
      restore();
    }
  });

  it('returns empty rolls and zero total when count is 0 or negative', () => {
    expect(rollDice(0, 6)).toEqual({ rolls: [], total: 0 });
    expect(rollDice(-1, 6)).toEqual({ rolls: [], total: 0 });
  });
});

// ── rollAdvantage ────────────────────────────────────────────────────

describe('rollAdvantage', () => {
  it('returns max of two d20 rolls with label "advantage"', () => {
    const { restore } = seededRandom([0.1, 0.8]);
    try {
      const result = rollAdvantage();
      expect(result.rolls).toEqual([3, 17]);
      expect(result.total).toBe(17);
      expect(result.label).toBe('advantage');
    } finally {
      restore();
    }
  });
});

// ── rollDisadvantage ─────────────────────────────────────────────────

describe('rollDisadvantage', () => {
  it('returns min of two d20 rolls with label "disadvantage"', () => {
    const { restore } = seededRandom([0.8, 0.1]);
    try {
      const result = rollDisadvantage();
      expect(result.rolls).toEqual([17, 3]);
      expect(result.total).toBe(3);
      expect(result.label).toBe('disadvantage');
    } finally {
      restore();
    }
  });
});

// ── parseExpression ──────────────────────────────────────────────────

describe('parseExpression', () => {
  it('parses minimal d20 without count', () => {
    expect(parseExpression('d20')).toEqual({ count: 1, sides: 20, modifier: 0 });
  });

  it('parses count and sides without modifier', () => {
    expect(parseExpression('2d6')).toEqual({ count: 2, sides: 6, modifier: 0 });
  });

  it('parses positive and negative modifiers', () => {
    expect(parseExpression('1d8+3')).toEqual({ count: 1, sides: 8, modifier: 3 });
    expect(parseExpression('1d10-2')).toEqual({ count: 1, sides: 10, modifier: -2 });
  });

  it('parses multiple modifier segments', () => {
    expect(parseExpression('1d8+4+2')).toEqual({ count: 1, sides: 8, modifier: 6 });
    expect(parseExpression('1d10+5-3')).toEqual({ count: 1, sides: 10, modifier: 2 });
  });

  it('strips square-bracket tags before parsing', () => {
    expect(parseExpression('2d6[fire]')).toEqual({ count: 2, sides: 6, modifier: 0 });
    expect(parseExpression('[Damage] 1d8+3')).toEqual({ count: 1, sides: 8, modifier: 3 });
    expect(parseExpression('1d8 [tag] +3')).toEqual({ count: 1, sides: 8, modifier: 3 });
  });

  it('returns null for empty, whitespace, tag-only, or unrecognised input', () => {
    expect(parseExpression('')).toBeNull();
    expect(parseExpression('   ')).toBeNull();
    expect(parseExpression('[tag]')).toBeNull();
    expect(parseExpression('[a] [b]')).toBeNull();
    expect(parseExpression('not a formula')).toBeNull();
    expect(parseExpression('abc')).toBeNull();
    expect(parseExpression('2d')).toBeNull();
    expect(parseExpression('d')).toBeNull();
  });

  it('selects the first valid " or " option', () => {
    expect(parseExpression('1d8 + 3 or 2d6')).toEqual({ count: 1, sides: 8, modifier: 3 });
    expect(parseExpression('invalid or 2d6')).toEqual({ count: 2, sides: 6, modifier: 0 });
    expect(parseExpression('invalid or nonsense')).toBeNull();
  });

  it('handles uppercase dice notation', () => {
    expect(parseExpression('2D6')).toEqual({ count: 2, sides: 6, modifier: 0 });
    expect(parseExpression('1D8+3')).toEqual({ count: 1, sides: 8, modifier: 3 });
  });
});

// ── rollExpression ───────────────────────────────────────────────────

describe('rollExpression', () => {
  it('rolls a plain d20 expression', () => {
    const { restore } = seededRandom([0.5]);
    try {
      const result = rollExpression('d20');
      expect(result).not.toBeNull();
      expect(result.rolls).toHaveLength(1);
      expect(result.total).toBeGreaterThanOrEqual(1);
      expect(result.total).toBeLessThanOrEqual(20);
      expect(result.formula).toBe('d20');
      expect(result.modifier).toBe(0);
    } finally {
      restore();
    }
  });

  it('applies positive and negative modifiers to the total', () => {
    const { restore } = seededRandom([0.5, 0.5]);
    try {
      const pos = rollExpression('1d8+3');
      expect(pos.total).toBe(pos.rolls[0] + 3);
      expect(pos.modifier).toBe(3);
      expect(pos.formula).toBe('1d8+3');

      const neg = rollExpression('1d6-2');
      expect(neg.total).toBe(neg.rolls[0] - 2);
      expect(neg.modifier).toBe(-2);
    } finally {
      restore();
    }
  });

  it('rolls multiple dice and sums them', () => {
    const { restore } = seededRandom([0.5, 0.5]);
    try {
      const result = rollExpression('2d6');
      expect(result.rolls).toHaveLength(2);
      expect(result.total).toBe(result.rolls[0] + result.rolls[1]);
    } finally {
      restore();
    }
  });

  it('returns null for invalid or empty expressions', () => {
    expect(rollExpression('xyz')).toBeNull();
    expect(rollExpression('')).toBeNull();
    expect(rollExpression('   ')).toBeNull();
    expect(rollExpression('[tag]')).toBeNull();
  });

  it('selects first valid " or " option and handles invalid alternatives', () => {
    const { restore } = seededRandom([0.5]);
    try {
      const result = rollExpression('1d8 + 3 or 2d6');
      expect(result).not.toBeNull();
      expect(result.rolls).toHaveLength(1);
      expect(result.modifier).toBe(3);
      expect(result.formula).toBe('1d8 + 3');
    } finally {
      restore();
    }
    expect(rollExpression('invalid or nonsense')).toBeNull();
  });

  it('combines " plus " segments by summing dice and modifiers', () => {
    const { restore } = seededRandom([0.5, 0.5]);
    try {
      const result = rollExpression('1d8+3 plus 2d6');
      expect(result).not.toBeNull();
      expect(result.rolls).toHaveLength(3);
      expect(result.modifier).toBe(3);
      expect(result.formula).toBe('1d8+3 plus 2d6');
    } finally {
      restore();
    }
  });

  it('strips brackets before evaluating', () => {
    const { restore } = seededRandom([0.5]);
    try {
      const result = rollExpression('1d8+3[damage]');
      expect(result).not.toBeNull();
      expect(result.modifier).toBe(3);
    } finally {
      restore();
    }
  });

  it('includes constant-only " plus N" parts in total and modifier (CLA-281)', () => {
    const { restore } = seededRandom([0]);
    try {
      const result = rollExpression('1d8+7 plus 4');
      expect(result).not.toBeNull();
      expect(result.rolls).toEqual([1]);
      expect(result.modifier).toBe(11);
      expect(result.total).toBe(result.rolls[0] + 7 + 4);
      expect(result.formula).toBe('1d8+7 plus 4');
    } finally {
      restore();
    }
  });

  it('keeps dice-only " plus " behavior unchanged (CLA-281 regression)', () => {
    const { restore } = seededRandom([0.5, 0.5]);
    try {
      const result = rollExpression('1d8+3 plus 2d6');
      expect(result.rolls).toHaveLength(3);
      expect(result.modifier).toBe(3);
      expect(result.total).toBe(result.rolls.reduce((s, r) => s + r, 0) + 3);
    } finally {
      restore();
    }
  });

  it('adds bracket-tagged constant " plus 4 [bludgeoning]" part to total', () => {
    const { restore } = seededRandom([0]);
    try {
      const result = rollExpression('1d8+7 plus 4 [bludgeoning]');
      expect(result).not.toBeNull();
      expect(result.modifier).toBe(11);
      expect(result.total).toBe(1 + 7 + 4);
    } finally {
      restore();
    }
  });

  it('still returns null for unparseable plus parts and standalone constants', () => {
    const { restore } = seededRandom([0.5]);
    try {
      const result = rollExpression('1d8 plus nonsense');
      expect(result.total).toBe(result.rolls[0]);
      expect(result.modifier).toBe(0);
    } finally {
      restore();
    }
    expect(rollExpression('4')).toBeNull();
  });

  it('respects rerollOnes option to reroll 1s', () => {
    const { restore } = seededRandom([0, 0.5, 0.5]);
    try {
      const result = rollExpression('3d6', { rerollOnes: true });
      expect(result).not.toBeNull();
      expect(result.rolls).toHaveLength(3);
      for (const r of result.rolls) {
        expect(r).toBeGreaterThanOrEqual(2);
        expect(r).toBeLessThanOrEqual(6);
      }
    } finally {
      restore();
    }
  });
});

// ── rollExpressionDoubled ────────────────────────────────────────────

describe('rollExpressionDoubled', () => {
  it('doubles dice rolls and keeps modifier', () => {
    const { restore } = seededRandom([0.5]);
    try {
      const result = rollExpressionDoubled('1d8+3');
      expect(result).not.toBeNull();
      expect(result.rolls).toHaveLength(1);
      expect(result.doubledRolls).toHaveLength(2);
      expect(result.modifier).toBe(3);
      expect(result.total).toBe(result.doubledRolls.reduce((s, r) => s + r, 0) + 3);
    } finally {
      restore();
    }
  });

  it('doubles combined damage dice from " plus " segments', () => {
    const { restore } = seededRandom([0.5, 0.5, 0.5]);
    try {
      const result = rollExpressionDoubled('1d8+3 plus 2d6');
      expect(result).not.toBeNull();
      expect(result.rolls).toHaveLength(3);
      expect(result.doubledRolls).toHaveLength(6);
      expect(result.modifier).toBe(3);
    } finally {
      restore();
    }
  });

  it('returns null for invalid or empty expressions', () => {
    expect(rollExpressionDoubled('xyz')).toBeNull();
    expect(rollExpressionDoubled('')).toBeNull();
    expect(rollExpressionDoubled('[tag]')).toBeNull();
  });

  it('keeps constant " plus N" part flat (not doubled) on crits (CLA-281)', () => {
    const { restore } = seededRandom([0]);
    try {
      const result = rollExpressionDoubled('1d8+7 plus 4');
      expect(result).not.toBeNull();
      expect(result.rolls).toEqual([1]);
      expect(result.doubledRolls).toEqual([1, 1]);
      expect(result.modifier).toBe(11);
      expect(result.total).toBe(2 + 7 + 4);
    } finally {
      restore();
    }
  });

  it('selects first valid " or " option and handles invalid alternatives', () => {
    const { restore } = seededRandom([0.5]);
    try {
      const result = rollExpressionDoubled('1d8+3 or 2d6');
      expect(result).not.toBeNull();
      expect(result.rolls).toHaveLength(1);
      expect(result.doubledRolls).toHaveLength(2);
      expect(result.modifier).toBe(3);
    } finally {
      restore();
    }
    const result2 = rollExpressionDoubled('invalid or nonsense');
    expect(result2).toBeNull();
  });
});

// ── rollExpressionMaximized ──────────────────────────────────────────

describe('rollExpressionMaximized', () => {
  it('fills all dice with maximum value and adds modifier', () => {
    const basic = rollExpressionMaximized('2d6');
    expect(basic).not.toBeNull();
    expect(basic.rolls).toHaveLength(2);
    expect(basic.rolls[0]).toBe(6);
    expect(basic.rolls[1]).toBe(6);
    expect(basic.total).toBe(12);
    expect(basic.maximized).toBe(true);

    const withMod = rollExpressionMaximized('1d8+5');
    expect(withMod.total).toBe(8 + 5);
    expect(withMod.modifier).toBe(5);

    const negMod = rollExpressionMaximized('3d10-2');
    expect(negMod.total).toBe(30 - 2);
    expect(negMod.modifier).toBe(-2);
  });

  it('returns null for invalid or empty expressions', () => {
    expect(rollExpressionMaximized('xyz')).toBeNull();
    expect(rollExpressionMaximized('')).toBeNull();
    expect(rollExpressionMaximized('[tag]')).toBeNull();
  });
});

// ── formatDamageFormula ──────────────────────────────────────────────

describe('formatDamageFormula', () => {
  it('returns input formula when formula is null or undefined', () => {
    expect(formatDamageFormula(null, [1, 2], false)).toBeNull();
    expect(formatDamageFormula(undefined, [1, 2], false)).toBeUndefined();
  });

  it('returns empty string when formula is empty', () => {
    expect(formatDamageFormula('', [1, 2], false)).toBe('');
  });

  it('returns original formula when stripped formula is empty or parsing fails', () => {
    const result = formatDamageFormula('[tag]', [1, 2], false);
    expect(result).toBe('[tag]');
    const result2 = formatDamageFormula('not a formula', [1, 2], false);
    expect(result2).toBe('not a formula');
  });

  it('formats a basic damage formula with rolls but no modifier or crit', () => {
    expect(formatDamageFormula('1d8', [5], false)).toBe('1d8 (5)');
  });

  it('formats with positive and negative modifiers', () => {
    expect(formatDamageFormula('1d8+3', [5], false)).toBe('1d8+3 (5)');
    expect(formatDamageFormula('1d8-2', [5], false)).toBe('1d8-2 (5)');
  });

  it('omits roll suffix when rolls is null, undefined, or empty', () => {
    expect(formatDamageFormula('1d8+3', null, false)).toBe('1d8+3');
    expect(formatDamageFormula('1d8+3', undefined, false)).toBe('1d8+3');
    expect(formatDamageFormula('1d8+3', [], false)).toBe('1d8+3');
  });

  it('includes crit suffix "*2" when isCrit is true', () => {
    expect(formatDamageFormula('1d8+3', [5, 6], true)).toBe('1d8*2+3 (5, 6)');
  });

  it('does not include crit suffix when isCrit is false', () => {
    expect(formatDamageFormula('1d8+3', [5, 6], false)).toBe('1d8+3 (5, 6)');
  });

  it('strips brackets before formatting', () => {
    expect(formatDamageFormula('1d8+3[fire]', [5], false)).toBe('1d8+3 (5)');
  });

  it('formats multiple rolls separated by commas', () => {
    expect(formatDamageFormula('2d6', [3, 4], false)).toBe('2d6 (3, 4)');
  });
});

// ── applyHealingRerollOnes ───────────────────────────────────────────

describe('applyHealingRerollOnes', () => {
  it('returns displayRolls as-is when rolls is null or not an array', () => {
    const result1 = applyHealingRerollOnes(null, '1d8+3');
    expect(result1).toEqual({ displayRolls: null, originalRolls: null });
    const result2 = applyHealingRerollOnes('not an array', '1d8+3');
    expect(result2).toEqual({ displayRolls: 'not an array', originalRolls: null });
  });

  it('returns displayRolls as-is when parsing expression fails or no 1s are present', () => {
    const result1 = applyHealingRerollOnes([1, 2, 3], 'invalid');
    expect(result1).toEqual({ displayRolls: [1, 2, 3], originalRolls: null });
    const result2 = applyHealingRerollOnes([3, 4, 5], '3d6');
    expect(result2).toEqual({ displayRolls: [3, 4, 5], originalRolls: null });
  });

  it('rerolls 1s and preserves original rolls when rerolls occur', () => {
    const { restore } = seededRandom([0.5, 0.5, 0.5]);
    try {
      const result = applyHealingRerollOnes([1, 4, 1], '3d6');
      expect(result.displayRolls).toHaveLength(3);
      expect(result.displayRolls[0]).toBeGreaterThanOrEqual(2);
      expect(result.displayRolls[0]).toBeLessThanOrEqual(6);
      expect(result.displayRolls[1]).toBe(4);
      expect(result.displayRolls[2]).toBeGreaterThanOrEqual(2);
      expect(result.displayRolls[2]).toBeLessThanOrEqual(6);
      expect(result.originalRolls).toEqual([1, 4, 1]);
    } finally {
      restore();
    }
  });

  it('handles a single die roll that is a 1', () => {
    const { restore } = seededRandom([0.5]);
    try {
      const result = applyHealingRerollOnes([1], '1d6');
      expect(result.displayRolls).toEqual([Math.floor(0.5 * 6) + 1]);
      expect(result.originalRolls).toEqual([1]);
    } finally {
      restore();
    }
  });

  it('handles all 1s being rerolled', () => {
    const { restore } = seededRandom([0.5, 0.5, 0.5]);
    try {
      const result = applyHealingRerollOnes([1, 1, 1], '2d6');
      expect(result.displayRolls).toHaveLength(3);
      expect(result.originalRolls).toEqual([1, 1, 1]);
      for (const r of result.displayRolls) {
        expect(r).toBeGreaterThanOrEqual(2);
        expect(r).toBeLessThanOrEqual(6);
      }
    } finally {
      restore();
    }
  });
});
