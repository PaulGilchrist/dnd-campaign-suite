// @maintained-by-ai
// CLA-315 fall-damage producer lane: fallDamage.js is the app's only producer of
// trigger:'falling' events. Authored rule: 2d10 bludgeoning per 10 feet fallen,
// min 2d10, cap 20d10 (cap clamps at 110ft+ raw 22d10 → 20d10).
//
// Lane split (owners cited, not duplicated here):
// - falling te chip delegation/one-shot latch → createEffectAdderHandlers.falling.test.js
// - damage application + trigger passthrough onto lastAttack → applyDamage lanes #940-#942
//   (applyDamage.falling-trigger.test.js); reaction consumers pressing against the
//   stamped lastAttack → featherFallHandler.test.js #950, damageReductionHandler.slow-fall.test.js
// - THIS lane: distance→dice ladder (pure, zero mocks) + producer seam: exact chain-header
//   stamp bytes ordered BEFORE apply, exact apply args, exact fall_damage log bytes, guards.
//
// old→new map: ladder table (strengthened: exact edges/cap falsifier/junk),
// happy-path seam (strengthened: exact bytes), feet-default test folded into ladder
// (formula assembly already pinned by happy path), two guard legs consolidated.
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
const characters = [{ name: 'Monk', computedStats: {} }];

describe('fallDamage (CLA-315 producer)', () => {
  beforeEach(() => vi.clearAllMocks());

  // Ladder hand-derived once: increments = max(1, floor(max(feet,10)/10)); dice = min(20, increments*2).
  // Edges: 19→2 vs 20→4 (per-full-10ft floor), 69→12 vs 70→14, junk/missing → min 2.
  // Cap falsifier: 109→20 is exact math; 110 raw=22 must clamp to 20 (cap-1 would be 19 at 95..109).
  it('2d10 per full 10 feet, minimum 2d10, clamps at 20d10', () => {
    const ladder = [
      [10, 2], [19, 2], [20, 4], [59, 10], [60, 12], [69, 12], [70, 14],
      [100, 20], [109, 20], [110, 20], [5000, 20],
    ];
    ladder.forEach(([feet, dice]) => expect(fallDamageDice(feet)).toBe(dice));
    // authored junk behavior: missing/zero/negative/NaN → 2d10 minimum; numeric string coerces
    expect(fallDamageDice(0)).toBe(2);
    expect(fallDamageDice(undefined)).toBe(2);
    expect(fallDamageDice(-50)).toBe(2);
    expect(fallDamageDice('abc')).toBe(2);
    expect(fallDamageDice('60')).toBe(12);
  });

  it('stamps fresh fall chain header before apply, applies bludgeoning, logs exact fall_damage bytes', async () => {
    const out = await produceFallDamage({ combatSummary: cs, targetName: 'Monk', feet: 60, campaignName: 'test-campaign', characters });

    // Fresh chain header BEFORE damage apply (no stale primary/secondary merge for reaction consumers)
    expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'lastAttack', {
      attackerName: 'Falling', targetName: 'Monk', rollType: 'fall', trigger: 'falling',
      rawDamage: 0, damageApplied: false, timestamp: expect.any(Number),
    }, 'test-campaign');
    expect(setRuntimeValue.mock.invocationCallOrder[0]).toBeLessThan(applyDamageToTarget.mock.invocationCallOrder[0]);

    expect(rollExpression).toHaveBeenCalledWith('12d10');
    expect(applyDamageToTarget).toHaveBeenCalledWith(cs, 'Monk', 27, ['bludgeoning'], {
      campaignName: 'test-campaign', characters, attackerName: 'Falling', trigger: 'falling',
    });
    expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      type: 'automation',
      characterName: 'Monk',
      automationType: 'fall_damage',
      name: 'Falling',
      description: 'Monk falls 60 feet — 12d10 [5, 6, 7, 9] = 27 bludgeoning (40 → 13 HP). Slow Fall and Feather Fall Reactions can be pressed against this fall.',
    }));
    expect(out.formula).toBe('12d10');
    expect(out.newHp).toBe(13);
  });

  it('guards: unrollable formula does nothing at all; missing target stamps header but never logs', async () => {
    // leg 1: roll failure — zero writes, zero application
    rollExpression.mockReturnValueOnce(null);
    expect(await produceFallDamage({ combatSummary: cs, targetName: 'Monk', feet: 30, campaignName: 'test-campaign', characters })).toBeNull();
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(applyDamageToTarget).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();

    // leg 2: target absent from combatSummary — header stamped, fall not applied, no log
    applyDamageToTarget.mockResolvedValueOnce(null);
    expect(await produceFallDamage({ combatSummary: cs, targetName: 'Ghost', feet: 30, campaignName: 'test-campaign', characters })).toBeNull();
    expect(setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
    expect(addEntry).not.toHaveBeenCalled();
  });
});
