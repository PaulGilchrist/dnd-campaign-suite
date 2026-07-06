// @improved-by-ai
import { describe, it, expect } from 'vitest';
import { getSpellActionType, isSpellAttack } from './attackCalc.js';

describe('getSpellActionType', () => {
  it('should return Action for action casting times', () => {
    expect(getSpellActionType('1 action')).toBe('Action');
    expect(getSpellActionType('1 Action')).toBe('Action');
    expect(getSpellActionType('action')).toBe('Action');
    expect(getSpellActionType('Action')).toBe('Action');
  });

  it('should return Bonus Action for bonus action casting times', () => {
    expect(getSpellActionType('1 bonus action')).toBe('Bonus Action');
    expect(getSpellActionType('1 Bonus Action')).toBe('Bonus Action');
    expect(getSpellActionType('bonus action')).toBe('Bonus Action');
    expect(getSpellActionType('Bonus Action')).toBe('Bonus Action');
  });

  it('should return null for non-action casting times', () => {
    expect(getSpellActionType('1 reaction')).toBeNull();
    expect(getSpellActionType('1 Reaction')).toBeNull();
    expect(getSpellActionType('1 round')).toBeNull();
    expect(getSpellActionType('Instantaneous')).toBeNull();
    expect(getSpellActionType('')).toBeNull();
  });
});

describe('isSpellAttack', () => {
  it('should return true when spell has no dc or a falsy dc', () => {
    expect(isSpellAttack({ name: 'Fire Bolt', damage: { damage_at_slot_level: { '1': '1d10' } } })).toBe(true);
    expect(isSpellAttack({ name: 'Magic Missile' })).toBe(true);
    expect(isSpellAttack({ name: 'Test Spell', dc: 0 })).toBe(true);
    expect(isSpellAttack({ name: 'Test Spell', dc: null })).toBe(true);
    expect(isSpellAttack({ name: 'Test Spell', dc: undefined })).toBe(true);
  });

  it('should return false when spell has a truthy dc', () => {
    expect(isSpellAttack({ name: 'Hold Monster', dc: 15 })).toBe(false);
  });
});
