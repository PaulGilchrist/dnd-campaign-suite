// CLA-315 fall-event producer: 2d10 per 10ft capped at 20d10; applies via
// applyDamageToTarget with trigger:'falling'; logs fall_damage.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../dice/diceRoller.js', () => ({
  rollExpression: vi.fn((f) => ({ total: 27, rolls: [5, 6, 7, 9], formula: f })),
}));
vi.mock('../rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn().mockResolvedValue({ finalDamage: 27, oldHp: 40, newHp: 13 }),
}));
vi.mock('../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

import { fallDamageDice, produceFallDamage } from './fallDamage.js';
import { rollExpression } from '../dice/diceRoller.js';
import { applyDamageToTarget } from '../rules/combat/applyDamage.js';
import { addEntry } from '../ui/logService.js';
import { setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

const cs = { round: 1, creatures: [{ name: 'Monk', type: 'player' }] };

describe('fallDamage (CLA-315 producer)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('2d10 per 10 feet, minimum 2d10, cap 20d10', () => {
    expect(fallDamageDice(10)).toBe(2);
    expect(fallDamageDice(5)).toBe(2);
    expect(fallDamageDice(0)).toBe(2);
    expect(fallDamageDice(60)).toBe(12);
    expect(fallDamageDice(69)).toBe(12);
    expect(fallDamageDice(100)).toBe(20);
    expect(fallDamageDice(5000)).toBe(20);
  });

  it('rolls, applies bludgeoning with trigger:falling stamp, logs fall_damage', async () => {
    const out = await produceFallDamage({ combatSummary: cs, targetName: 'Monk', feet: 60, campaignName: 'test-campaign', characters: [] });
    // fresh chain header stamped BEFORE damage apply (no stale primary/secondary merge)
    expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'lastAttack', expect.objectContaining({
      attackerName: 'Falling', targetName: 'Monk', trigger: 'falling', rollType: 'fall', rawDamage: 0,
    }), 'test-campaign');
    expect(setRuntimeValue.mock.invocationCallOrder[0]).toBeLessThan(applyDamageToTarget.mock.invocationCallOrder[0]);
    expect(rollExpression).toHaveBeenCalledWith('12d10');
    expect(applyDamageToTarget).toHaveBeenCalledWith(cs, 'Monk', 27, ['bludgeoning'], expect.objectContaining({
      attackerName: 'Falling',
      trigger: 'falling',
      campaignName: 'test-campaign',
    }));
    expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      automationType: 'fall_damage',
      characterName: 'Monk',
      description: expect.stringMatching(/falls 60 feet.*12d10.*bludgeoning \(40 → 13 HP\)/s),
    }));
    expect(out.formula).toBe('12d10');
    expect(out.newHp).toBe(13);
  });

  it('target not in combatSummary: null, no log', async () => {
    applyDamageToTarget.mockResolvedValueOnce(null);
    const out = await produceFallDamage({ combatSummary: cs, targetName: 'Ghost', feet: 30, campaignName: 'test-campaign', characters: [] });
    expect(out).toBeNull();
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('feet defaults to one 10ft increment for missing/zero', async () => {
    await produceFallDamage({ combatSummary: cs, targetName: 'Monk', campaignName: 'test-campaign' });
    expect(rollExpression).toHaveBeenCalledWith('2d10');
  });
});
