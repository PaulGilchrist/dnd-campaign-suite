// @improved-by-ai
import { describe, it, expect } from 'vitest';
import { getSpellActionType, isSpellAttack } from './attackCalc.js';

describe('getSpellActionType', () => {
  it('should return Action for "1 action"', () => {
    expect(getSpellActionType('1 action')).toBe('Action');
  });

  it('should return Action for "1 Action"', () => {
    expect(getSpellActionType('1 Action')).toBe('Action');
  });

  it('should return Action for "action"', () => {
    expect(getSpellActionType('action')).toBe('Action');
  });

  it('should return Action for "Action"', () => {
    expect(getSpellActionType('Action')).toBe('Action');
  });

  it('should return Bonus Action for "1 bonus action"', () => {
    expect(getSpellActionType('1 bonus action')).toBe('Bonus Action');
  });

  it('should return Bonus Action for "1 Bonus Action"', () => {
    expect(getSpellActionType('1 Bonus Action')).toBe('Bonus Action');
  });

  it('should return Bonus Action for "bonus action"', () => {
    expect(getSpellActionType('bonus action')).toBe('Bonus Action');
  });

  it('should return Bonus Action for "Bonus Action"', () => {
    expect(getSpellActionType('Bonus Action')).toBe('Bonus Action');
  });

  it('should return null for reaction casting time', () => {
    expect(getSpellActionType('1 reaction')).toBeNull();
  });

  it('should return null for reaction casting time capitalized', () => {
    expect(getSpellActionType('1 Reaction')).toBeNull();
  });

  it('should return null for round casting time', () => {
    expect(getSpellActionType('1 round')).toBeNull();
  });

  it('should return null for unsupported casting time', () => {
    expect(getSpellActionType('Instantaneous')).toBeNull();
  });

  it('should return null for empty string', () => {
    expect(getSpellActionType('')).toBeNull();
  });
});

describe('isSpellAttack', () => {
  it('should return true when spell has no DC', () => {
    const spell = { name: 'Fire Bolt', damage: { damage_at_slot_level: { '1': '1d10' } } };
    expect(isSpellAttack(spell)).toBe(true);
  });

  it('should return true when spell has no dc property at all', () => {
    const spell = { name: 'Magic Missile' };
    expect(isSpellAttack(spell)).toBe(true);
  });

  it('should return false when spell has a DC', () => {
    const spell = { name: 'Hold Monster', dc: 15 };
    expect(isSpellAttack(spell)).toBe(false);
  });

  it('should return true when spell DC is zero (falsy but present)', () => {
    const spell = { name: 'Test Spell', dc: 0 };
    expect(isSpellAttack(spell)).toBe(true);
  });

  it('should return true when spell DC is null (evaluates to !null = true)', () => {
    const spell = { name: 'Test Spell', dc: null };
    expect(isSpellAttack(spell)).toBe(true);
  });

  it('should return true when spell DC is undefined (same as missing dc)', () => {
    const spell = { name: 'Test Spell', dc: undefined };
    expect(isSpellAttack(spell)).toBe(true);
  });
});
