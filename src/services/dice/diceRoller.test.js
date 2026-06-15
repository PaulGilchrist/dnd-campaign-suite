
import { describe, it, expect } from 'vitest';
import { rollD20, rollDie, rollDice, rollAdvantage, rollDisadvantage, parseExpression, rollExpression } from './diceRoller.js';

describe('rollD20', () => {
  it('returns a number between 1 and 20', () => {
    for (let i = 0; i < 100; i++) {
      const result = rollD20();
      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(20);
      expect(Number.isInteger(result)).toBe(true);
    }
  });
});

describe('rollDie', () => {
  it('returns a number between 1 and sides', () => {
    for (const sides of [4, 6, 8, 10, 12, 20]) {
      for (let i = 0; i < 50; i++) {
        const result = rollDie(sides);
        expect(result).toBeGreaterThanOrEqual(1);
        expect(result).toBeLessThanOrEqual(sides);
        expect(Number.isInteger(result)).toBe(true);
      }
    }
  });
});

describe('rollDice', () => {
  it('returns correct number of rolls and sum', () => {
    const result = rollDice(2, 6);
    expect(result.rolls).toHaveLength(2);
    expect(result.total).toBe(result.rolls[0] + result.rolls[1]);
    result.rolls.forEach(r => {
      expect(r).toBeGreaterThanOrEqual(1);
      expect(r).toBeLessThanOrEqual(6);
    });
  });
});

describe('rollAdvantage', () => {
  it('returns max of two rolls', () => {
    for (let i = 0; i < 50; i++) {
      const result = rollAdvantage();
      expect(result.rolls).toHaveLength(2);
      expect(result.total).toBe(Math.max(...result.rolls));
      expect(result.label).toBe('advantage');
    }
  });
});

describe('rollDisadvantage', () => {
  it('returns min of two rolls', () => {
    for (let i = 0; i < 50; i++) {
      const result = rollDisadvantage();
      expect(result.rolls).toHaveLength(2);
      expect(result.total).toBe(Math.min(...result.rolls));
      expect(result.label).toBe('disadvantage');
    }
  });
});

describe('parseExpression', () => {
  it('parses d20', () => {
    expect(parseExpression('d20')).toEqual({ count: 1, sides: 20, modifier: 0 });
  });

  it('parses 2d6', () => {
    expect(parseExpression('2d6')).toEqual({ count: 2, sides: 6, modifier: 0 });
  });

  it('parses 1d8+3', () => {
    expect(parseExpression('1d8+3')).toEqual({ count: 1, sides: 8, modifier: 3 });
  });

  it('parses 1d10-2', () => {
    expect(parseExpression('1d10-2')).toEqual({ count: 1, sides: 10, modifier: -2 });
  });

  it('returns null for invalid formula', () => {
    expect(parseExpression('not a formula')).toBeNull();
    expect(parseExpression('')).toBeNull();
  });
});

describe('rollExpression', () => {
  it('rolls a d20 expression', () => {
    const result = rollExpression('d20');
    expect(result).not.toBeNull();
    expect(result.total).toBeGreaterThanOrEqual(1);
    expect(result.total).toBeLessThanOrEqual(20);
    expect(result.rolls).toHaveLength(1);
    expect(result.formula).toBe('d20');
  });

  it('rolls with modifier', () => {
    const result = rollExpression('1d8+3');
    expect(result).not.toBeNull();
    expect(result.total).toBeGreaterThanOrEqual(4);
    expect(result.total).toBeLessThanOrEqual(11);
    expect(result.rolls).toHaveLength(1);
    expect(result.modifier).toBe(3);
  });

  it('rolls multiple dice', () => {
    const result = rollExpression('2d6');
    expect(result).not.toBeNull();
    expect(result.rolls).toHaveLength(2);
    expect(result.total).toBe(result.rolls[0] + result.rolls[1]);
  });

  it('returns null for invalid expression', () => {
    expect(rollExpression('xyz')).toBeNull();
  });

  it('rerolls 1s when rerollOnes option is true', () => {
    const originalRandom = Math.random;
    let idx = 0;
    const values = [0, 0, 0.5, 0.7];
    Math.random = () => values[idx++] || 0.5;
    try {
      const result = rollExpression('2d6', { rerollOnes: true });
      expect(result).not.toBeNull();
      expect(result.rolls).toHaveLength(2);
      expect(result.rolls[0]).toBeGreaterThanOrEqual(2);
      expect(result.rolls[0]).toBeLessThanOrEqual(6);
      expect(result.rolls[1]).toBeGreaterThanOrEqual(2);
      expect(result.rolls[1]).toBeLessThanOrEqual(6);
    } finally {
      Math.random = originalRandom;
    }
  });

  it('does not reroll 1s when rerollOnes option is false', () => {
    const originalRandom = Math.random;
    Math.random = () => 0.01;
    try {
      const result = rollExpression('1d20', { rerollOnes: false });
      expect(result).not.toBeNull();
      expect(result.rolls[0]).toBe(1);
    } finally {
      Math.random = originalRandom;
    }
  });

  it('rerolls only 1s, not other values', () => {
    const originalRandom = Math.random;
    let idx = 0;
    const values = [0.5, 0, 0.9];
    Math.random = () => values[idx++] || 0.5;
    try {
      const result = rollExpression('3d6', { rerollOnes: true });
      expect(result).not.toBeNull();
      expect(result.rolls).toHaveLength(3);
      expect(result.rolls[0]).toBe(4);
      expect(result.rolls[1]).toBeGreaterThanOrEqual(2);
      expect(result.rolls[1]).toBeLessThanOrEqual(6);
      expect(result.rolls[2]).toBe(6);
    } finally {
      Math.random = originalRandom;
    }
  });
});
