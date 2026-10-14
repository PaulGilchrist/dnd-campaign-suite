import { describe, it, expect } from 'vitest';
import { combineAttackModes } from './conditionEffects.js';

// ---------------------------------------------------------------------------
// combineAttackModes — attacks-other source gating (Compelled Duel / Steps of the Fey)
// ---------------------------------------------------------------------------

describe('combineAttackModes — attacks-other source gating', () => {
  const baseEffects = () => ({ attackAdvantageCount: 0, attackDisadvantageCount: 0, restoreBalance: false });
  const emptyTarget = { targetAdvantageCount: 0, targetDisadvantageCount: 0 };

  it('applies disadvantage when attacking a creature other than the source', () => {
    const attacker = { ...baseEffects(), attacksOtherDisadvantageSource: 'Paladin' };
    expect(combineAttackModes(attacker, emptyTarget, 5, 'Goblin')).toBe('disadvantage');
  });

  it('does not apply disadvantage when attacking the source', () => {
    const attacker = { ...baseEffects(), attacksOtherDisadvantageSource: 'Paladin' };
    expect(combineAttackModes(attacker, emptyTarget, 5, 'Paladin')).toBe('normal');
  });

  it('does not apply disadvantage when targetName is unknown', () => {
    const attacker = { ...baseEffects(), attacksOtherDisadvantageSource: 'Paladin' };
    expect(combineAttackModes(attacker, emptyTarget, 5)).toBe('normal');
  });

  it('combines with other disadvantage sources', () => {
    const attacker = { ...baseEffects(), attackDisadvantageCount: 1, attacksOtherDisadvantageSource: 'Paladin' };
    expect(combineAttackModes(attacker, emptyTarget, 5, 'Goblin')).toBe('disadvantage');
  });
});
