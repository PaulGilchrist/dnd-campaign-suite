// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect } from 'vitest';
import * as baseCombatActions from './baseCombatActions.js';
import { OPPORTUNITY_ATTACK, MELEE_REACH_FEET } from './baseCombatActions.js';

describe('baseCombatActions module exports', () => {
  it('exports OPPORTUNITY_ATTACK as a plain object with name and description', () => {
    expect(OPPORTUNITY_ATTACK).toEqual({
      name: 'Opportunity Attack',
      description: 'Can attack creature that moves out of your reach',
    });
  });

  it('exports MELEE_REACH_FEET as the number 5', () => {
    expect(MELEE_REACH_FEET).toBe(5);
  });

  it('exports are accessible via namespace import', () => {
    expect(baseCombatActions.OPPORTUNITY_ATTACK).toBe(OPPORTUNITY_ATTACK);
    expect(baseCombatActions.MELEE_REACH_FEET).toBe(MELEE_REACH_FEET);
  });
});
