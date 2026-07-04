// @cleaned-by-ai
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
} from './diceRoller.js';

describe('rollD20', () => {
  it('returns an integer between 1 and 20', () => {
    const result = rollD20();
    expect(Number.isInteger(result)).toBe(true);
    expect(result).toBeGreaterThanOrEqual(1);
    expect(result).toBeLessThanOrEqual(20);
  });
});

describe('rollDie', () => {
  it('returns an integer between 1 and sides for valid dice', () => {
    for (const sides of [4, 6, 8, 10, 12, 20]) {
      const result = rollDie(sides);
      expect(Number.isInteger(result)).toBe(true);
      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(sides);
    }
  });
});

describe('rollDice', () => {
  it('returns correct number of rolls and sum', () => {
    const result = rollDice(2, 6);
    expect(result.rolls).toHaveLength(2);
    expect(result.total).toBe(result.rolls[0] + result.rolls[1]);
  });

  it('returns empty rolls and zero total when count is 0', () => {
    const result = rollDice(0, 6);
    expect(result.rolls).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});

describe('rollAdvantage', () => {
  it('returns max of two d20 rolls with correct label', () => {
    const result = rollAdvantage();
    expect(result.rolls).toHaveLength(2);
    expect(result.total).toBe(Math.max(...result.rolls));
    expect(result.label).toBe('advantage');
  });
});

describe('rollDisadvantage', () => {
  it('returns min of two d20 rolls with correct label', () => {
    const result = rollDisadvantage();
    expect(result.rolls).toHaveLength(2);
    expect(result.total).toBe(Math.min(...result.rolls));
    expect(result.label).toBe('disadvantage');
  });
});

describe('parseExpression', () => {
  it('parses "d20" with implicit count of 1', () => {
    expect(parseExpression('d20')).toEqual({ count: 1, sides: 20, modifier: 0 });
  });

  it('parses "2d6"', () => {
    expect(parseExpression('2d6')).toEqual({ count: 2, sides: 6, modifier: 0 });
  });

  it('parses "1d8+3"', () => {
    expect(parseExpression('1d8+3')).toEqual({ count: 1, sides: 8, modifier: 3 });
  });

  it('parses "1d10-2"', () => {
    expect(parseExpression('1d10-2')).toEqual({ count: 1, sides: 10, modifier: -2 });
  });

  it('strips square-bracket tags before parsing', () => {
    expect(parseExpression('2d6[Fire]')).toEqual({ count: 2, sides: 6, modifier: 0 });
    expect(parseExpression('[Damage] 1d8+3')).toEqual({ count: 1, sides: 8, modifier: 3 });
  });

  it('returns null for empty or whitespace-only input', () => {
    expect(parseExpression('')).toBeNull();
    expect(parseExpression('   ')).toBeNull();
    expect(parseExpression('[tag]')).toBeNull();
  });

  it('returns null for invalid formula', () => {
    expect(parseExpression('not a formula')).toBeNull();
  });

  it('parses first valid option when formula contains " or "', () => {
    expect(parseExpression('1d8 + 3 or 2d6')).toEqual({ count: 1, sides: 8, modifier: 3 });
  });

  it('skips invalid first option and parses second option in " or " formula', () => {
    expect(parseExpression('invalid or 2d6')).toEqual({ count: 2, sides: 6, modifier: 0 });
  });

  it('returns null when all options in " or " formula are invalid', () => {
    expect(parseExpression('invalid or nonsense')).toBeNull();
  });

  it('supports multi-digit counts and sides', () => {
    expect(parseExpression('10d100')).toEqual({ count: 10, sides: 100, modifier: 0 });
  });

  it('parses multiple modifiers like "1d8+4+2"', () => {
    expect(parseExpression('1d8+4+2')).toEqual({ count: 1, sides: 8, modifier: 6 });
  });

  it('parses multiple modifiers with mixed signs', () => {
    expect(parseExpression('1d10+5-3')).toEqual({ count: 1, sides: 10, modifier: 2 });
  });
});

describe('rollExpression', () => {
  it('rolls a d20 expression', () => {
    const result = rollExpression('d20');
    expect(result).not.toBeNull();
    expect(result.rolls).toHaveLength(1);
    expect(result.total).toBeGreaterThanOrEqual(1);
    expect(result.total).toBeLessThanOrEqual(20);
    expect(result.formula).toBe('d20');
    expect(result.modifier).toBe(0);
  });

  it('rolls with a positive modifier', () => {
    const result = rollExpression('1d8+3');
    expect(result).not.toBeNull();
    expect(result.rolls).toHaveLength(1);
    expect(result.modifier).toBe(3);
    expect(result.total).toBe(result.rolls[0] + 3);
    expect(result.formula).toBe('1d8+3');
  });

  it('rolls with a negative modifier', () => {
    const result = rollExpression('1d6-2');
    expect(result).not.toBeNull();
    expect(result.modifier).toBe(-2);
    expect(result.total).toBe(result.rolls[0] - 2);
  });

  it('rolls multiple dice', () => {
    const result = rollExpression('2d6');
    expect(result).not.toBeNull();
    expect(result.rolls).toHaveLength(2);
    expect(result.total).toBe(result.rolls[0] + result.rolls[1]);
  });

  it('returns null for invalid expression', () => {
    expect(rollExpression('xyz')).toBeNull();
    expect(rollExpression('')).toBeNull();
    expect(rollExpression('   ')).toBeNull();
  });

  it('returns null when formula is only brackets', () => {
    expect(rollExpression('[tag]')).toBeNull();
  });

  it('rolls first valid option when formula contains " or "', () => {
    const result = rollExpression('1d8 + 3 or 2d6');
    expect(result).not.toBeNull();
    expect(result.rolls).toHaveLength(1);
    expect(result.modifier).toBe(3);
    expect(result.formula).toBe('1d8 + 3');
  });

  it('rolls combined damage when formula contains " plus "', () => {
    const result = rollExpression('1d8+3 plus 2d6');
    expect(result).not.toBeNull();
    expect(result.rolls).toHaveLength(3);
    expect(result.modifier).toBe(3);
    expect(result.formula).toBe('1d8+3 plus 2d6');
  });

  it('rolls combined damage with modifiers on both sides', () => {
    const result = rollExpression('1d6+2 plus 1d4+1');
    expect(result).not.toBeNull();
    expect(result.rolls).toHaveLength(2);
    expect(result.modifier).toBe(3);
  });

  it('strips brackets before evaluating', () => {
    const result = rollExpression('1d8+3[damage]');
    expect(result).not.toBeNull();
    expect(result.modifier).toBe(3);
  });
});

describe('rollExpressionDoubled', () => {
  it('doubles the dice total and rolls', () => {
    const result = rollExpressionDoubled('1d8+3');
    expect(result).not.toBeNull();
    expect(result.modifier).toBe(3);
    expect(result.rolls).toHaveLength(1);
    expect(result.doubledRolls).toHaveLength(2);
    expect(result.total).toBe(result.doubledRolls.reduce((s, r) => s + r, 0) + 3);
  });

  it('doubles combined damage dice and rolls', () => {
    const result = rollExpressionDoubled('1d8+3 plus 2d6');
    expect(result).not.toBeNull();
    expect(result.rolls).toHaveLength(3);
    expect(result.doubledRolls).toHaveLength(6);
    expect(result.modifier).toBe(3);
  });

  it('returns null for invalid expression', () => {
    expect(rollExpressionDoubled('xyz')).toBeNull();
    expect(rollExpressionDoubled('')).toBeNull();
  });

  it('selects first valid " or " option and doubles it', () => {
    const result = rollExpressionDoubled('1d8+3 or 2d6');
    expect(result).not.toBeNull();
    expect(result.rolls).toHaveLength(1);
    expect(result.doubledRolls).toHaveLength(2);
    expect(result.modifier).toBe(3);
  });
});

describe('rollExpressionMaximized', () => {
  it('fills all dice with maximum value', () => {
    const result = rollExpressionMaximized('2d6');
    expect(result).not.toBeNull();
    expect(result.rolls).toHaveLength(2);
    expect(result.rolls[0]).toBe(6);
    expect(result.rolls[1]).toBe(6);
    expect(result.total).toBe(12);
    expect(result.maximized).toBe(true);
  });

  it('adds modifier to maximized total', () => {
    const result = rollExpressionMaximized('1d8+5');
    expect(result).not.toBeNull();
    expect(result.total).toBe(8 + 5);
    expect(result.modifier).toBe(5);
  });

  it('handles negative modifier', () => {
    const result = rollExpressionMaximized('3d10-2');
    expect(result).not.toBeNull();
    expect(result.total).toBe(30 - 2);
    expect(result.modifier).toBe(-2);
  });

  it('returns null for invalid expression', () => {
    expect(rollExpressionMaximized('xyz')).toBeNull();
    expect(rollExpressionMaximized('')).toBeNull();
  });

  it('preserves the original formula', () => {
    const result = rollExpressionMaximized('4d12');
    expect(result.formula).toBe('4d12');
  });
});

describe('rerollOnes option', () => {
  it('rerolls 1s to new values when rerollOnes is true', () => {
    const originalRandom = Math.random;
    const results = [0, 0, 0, 1 / 6, 1 / 6, 1 / 6];
    let callCount = 0;
    Math.random = () => {
      const val = results[callCount] ?? 0.5;
      callCount++;
      return val;
    };
    try {
      const result = rollExpression('3d6', { rerollOnes: true });
      expect(result).not.toBeNull();
      expect(result.rolls).toHaveLength(3);
      for (const r of result.rolls) {
        expect(r).toBeGreaterThanOrEqual(2);
        expect(r).toBeLessThanOrEqual(6);
      }
    } finally {
      Math.random = originalRandom;
    }
  });
});
