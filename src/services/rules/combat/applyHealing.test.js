// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { applyHealingToTarget } from './applyHealing.js';

vi.mock('../../shared/hpModifier.js', () => ({
  modifyHitPoints: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn(),
  // Default null keeps the MA-0016 no_healing block lane open in these
  // tests; the blocked lane itself is covered in healingBlock.test.js.
  getRuntimeValue: vi.fn(() => null),
}));

vi.mock('../../ui/storage.js', () => ({ default: { set: vi.fn() } }));

// Chokepoint seam under test is the WIRING here (MA-0367); the service's
// own behavior lives in infernalWoundService.test.js.
vi.mock('../features/infernalWoundService.js', () => ({
  removeInfernalWoundOnHeal: vi.fn(() => Promise.resolve(false)),
}));

import { modifyHitPoints } from '../../shared/hpModifier.js';
import { setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import storage from '../../ui/storage.js';
import { removeInfernalWoundOnHeal } from '../features/infernalWoundService.js';

const CAMPAIGN = 'test-campaign';

function makeResult(opts) {
  return {
    isPlayer: opts.isPlayer ?? false,
    oldHp: opts.oldHp ?? 0,
    newHp: opts.newHp ?? 0,
    delta: opts.delta ?? 0,
    creature: opts.creature ?? { name: 'Test' },
    ...opts,
  };
}

describe('applyHealingToTarget', () => {
  beforeEach(() => {
    modifyHitPoints.mockReset();
    setRuntimeValue.mockReset();
    storage.set.mockReset();
    removeInfernalWoundOnHeal.mockReset().mockResolvedValue(false);
  });

  it('returns null and writes nothing when modifyHitPoints finds no target', () => {
    for (const empty of [null, undefined]) {
      modifyHitPoints.mockReturnValue(empty);
      expect(applyHealingToTarget({}, 'Goblin', 5, CAMPAIGN)).toBeNull();
    }
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(storage.set).not.toHaveBeenCalled();
    expect(removeInfernalWoundOnHeal).not.toHaveBeenCalled();
  });

  it('forwards the heal to modifyHitPoints and returns actualHeal, oldHp, newHp, maxHp', () => {
    const cs = { round: 1, creatures: [] };
    modifyHitPoints.mockReturnValue(
      makeResult({ oldHp: 10, newHp: 15, delta: 5, maxHp: 16, creature: { name: 'Goblin' } })
    );
    expect(applyHealingToTarget(cs, 'Goblin', 8, CAMPAIGN)).toEqual({
      actualHeal: 5, oldHp: 10, newHp: 15, maxHp: 16,
    });
    expect(modifyHitPoints).toHaveBeenCalledWith(cs, 'Goblin', 8, CAMPAIGN);
  });

  it('resets deathSaves, deathFailures, and isDead when a player heals from <=0 to >0', () => {
    // boundary: exactly 0 up, and from negative up
    const legs = [
      { name: 'Fighter', oldHp: 0, newHp: 5 },
      { name: 'Cleric', oldHp: -3, newHp: 2 },
    ];
    for (const { name, oldHp, newHp } of legs) {
      modifyHitPoints.mockReturnValue(
        makeResult({ isPlayer: true, oldHp, newHp, delta: newHp - oldHp, creature: { name } })
      );
      applyHealingToTarget({}, name, 5, CAMPAIGN);
      expect(setRuntimeValue).toHaveBeenLastCalledWith(name, 'isDead', 0, CAMPAIGN);
      expect(setRuntimeValue).toHaveBeenCalledWith(name, 'deathSaves', [false, false, false], CAMPAIGN);
      expect(setRuntimeValue).toHaveBeenCalledWith(name, 'deathFailures', [false, false, false], CAMPAIGN);
    }
    expect(setRuntimeValue).toHaveBeenCalledTimes(6);
  });

  it('leaves death-save state untouched unless a player crosses up through 0', () => {
    const silences = [
      // already above 0 (oldHp > 0 guard)
      makeResult({ isPlayer: true, oldHp: 10, newHp: 15, delta: 5, creature: { name: 'Paladin' } }),
      // remains at 0 (newHp > 0 guard)
      makeResult({ isPlayer: true, oldHp: 0, newHp: 0, delta: 0, creature: { name: 'Rogue' } }),
      // remains below 0 (newHp > 0 guard)
      makeResult({ isPlayer: true, oldHp: -5, newHp: -2, delta: 3, creature: { name: 'Barbarian' } }),
      // NPC lifted above 0 (isPlayer guard)
      makeResult({ isPlayer: false, oldHp: 0, newHp: 5, delta: 5, creature: { name: 'Goblin' } }),
    ];
    for (const result of silences) {
      modifyHitPoints.mockReturnValue(result);
      applyHealingToTarget({}, result.creature.name, 5, CAMPAIGN);
    }
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('persists combatSummary only for NPC HP changes', () => {
    const cs = { round: 1, creatures: [] };

    // fire: NPC delta non-zero persists the same summary object
    modifyHitPoints.mockReturnValue(
      makeResult({ isPlayer: false, oldHp: 10, newHp: 15, delta: 5, creature: { name: 'Goblin' } })
    );
    applyHealingToTarget(cs, 'Goblin', 5, CAMPAIGN);
    expect(storage.set).toHaveBeenCalledTimes(1);
    expect(storage.set).toHaveBeenCalledWith('combatSummary', cs, CAMPAIGN);

    // silence: NPC zero delta, and any player healing
    storage.set.mockClear();
    modifyHitPoints.mockReturnValue(
      makeResult({ isPlayer: false, oldHp: 10, newHp: 10, delta: 0, creature: { name: 'Goblin' } })
    );
    applyHealingToTarget(cs, 'Goblin', 0, CAMPAIGN);
    modifyHitPoints.mockReturnValue(
      makeResult({ isPlayer: true, oldHp: 10, newHp: 15, delta: 5, creature: { name: 'Cleric' } })
    );
    applyHealingToTarget(cs, 'Cleric', 5, CAMPAIGN);
    expect(storage.set).not.toHaveBeenCalled();
  });

  it('closes the Infernal Wound on any actual heal, but never on a zero heal', () => {
    // fire: delta > 0
    modifyHitPoints.mockReturnValue(
      makeResult({ isPlayer: true, oldHp: 10, newHp: 15, delta: 5, creature: { name: 'Cleric' } })
    );
    applyHealingToTarget({}, 'Cleric', 5, CAMPAIGN);
    expect(removeInfernalWoundOnHeal).toHaveBeenCalledTimes(1);
    expect(removeInfernalWoundOnHeal).toHaveBeenCalledWith('Cleric', CAMPAIGN);

    // silence: delta === 0 (fully overhealed-blocked / refused heal)
    modifyHitPoints.mockReturnValue(
      makeResult({ isPlayer: true, oldHp: 15, newHp: 15, delta: 0, creature: { name: 'Cleric' } })
    );
    applyHealingToTarget({}, 'Cleric', 5, CAMPAIGN);
    expect(removeInfernalWoundOnHeal).toHaveBeenCalledTimes(1);
  });
});
