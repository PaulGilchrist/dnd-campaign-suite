// @improved-by-ai
import { describe, it, expect } from 'vitest';
import * as baseCombatActions from './baseCombatActions.js';
import { OPPORTUNITY_ATTACK, MELEE_REACH_FEET } from './baseCombatActions.js';

describe('baseCombatActions module exports', () => {
  it('exports exactly OPPORTUNITY_ATTACK and MELEE_REACH_FEET as named exports', () => {
    const exportedNames = Object.keys(baseCombatActions);
    expect(exportedNames).toEqual(['OPPORTUNITY_ATTACK', 'MELEE_REACH_FEET']);
  });

  it('OPPORTUNITY_ATTACK and MELEE_REACH_FEET are the same references via namespace import', () => {
    expect(baseCombatActions.OPPORTUNITY_ATTACK).toBe(OPPORTUNITY_ATTACK);
    expect(baseCombatActions.MELEE_REACH_FEET).toBe(MELEE_REACH_FEET);
  });
});

describe('OPPORTUNITY_ATTACK', () => {
  it('exports the correct name and description', () => {
    expect(OPPORTUNITY_ATTACK.name).toBe('Opportunity Attack');
    expect(OPPORTUNITY_ATTACK.description).toBe('Can attack creature that moves out of your reach');
  });

  it('is a plain object with exactly name and description properties', () => {
    expect(OPPORTUNITY_ATTACK).toBeTypeOf('object');
    expect(Object.keys(OPPORTUNITY_ATTACK)).toEqual(['name', 'description']);
  });

  it('has non-empty string values for all properties', () => {
    for (const key of Object.keys(OPPORTUNITY_ATTACK)) {
      expect(typeof OPPORTUNITY_ATTACK[key]).toBe('string');
      expect(OPPORTUNITY_ATTACK[key].length).toBeGreaterThan(0);
    }
  });

});

describe('MELEE_REACH_FEET', () => {
  it('is set to 5', () => {
    expect(MELEE_REACH_FEET).toBe(5);
  });

  it('is a positive integer', () => {
    expect(Number.isInteger(MELEE_REACH_FEET)).toBe(true);
    expect(MELEE_REACH_FEET).toBeGreaterThan(0);
  });

  it('is a number type, not a string', () => {
    expect(typeof MELEE_REACH_FEET).toBe('number');
  });
});
