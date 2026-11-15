// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { applyHealingToTarget } from './applyHealing.js';

vi.mock('../../shared/hpModifier.js', () => ({
  modifyHitPoints: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn(),
  setRuntimeBatch: vi.fn(),
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
import { setRuntimeValue, setRuntimeBatch } from '../../../hooks/runtime/useRuntimeState.js';
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

// Mirrors the real modifyHitPoints seam (hpModifier.js): the player leg with
// { deferPlayerHpWrite: true } carries the resolved HP on the result and the
// choke owns the commit.
function makeDeferredPlayerResult({ name, oldHp, newHp }) {
  return makeResult({
    isPlayer: true,
    oldHp,
    newHp,
    delta: newHp - oldHp,
    maxHp: 10,
    creature: { name },
    deferredHpWrite: newHp,
  });
}

describe('applyHealingToTarget', () => {
  beforeEach(() => {
    modifyHitPoints.mockReset();
    setRuntimeValue.mockReset();
    setRuntimeBatch.mockReset();
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
    expect(modifyHitPoints).toHaveBeenCalledWith(cs, 'Goblin', 8, CAMPAIGN, { deferPlayerHpWrite: true });
  });

  it('player revive (oldHp<=0 -> newHp>0) commits HP + death reset in ONE setRuntimeBatch, zero setRuntimeValue', () => {
    // CLA-092 write-batching: the old HP-POST + 3 sequential reset-POSTs
    // (4 SSE echoes) fold into one merged full-store POST carrying all four
    // keys verbatim — the handOfUltimateMercy/revivification/CharHitPoints idiom.
    // boundary: exactly 0 up, and from negative up.
    const legs = [
      { name: 'Fighter', oldHp: 0, newHp: 5 },
      { name: 'Cleric', oldHp: -3, newHp: 2 },
    ];
    for (const { name, oldHp, newHp } of legs) {
      setRuntimeValue.mockClear();
      setRuntimeBatch.mockClear();
      modifyHitPoints.mockReturnValue(makeDeferredPlayerResult({ name, oldHp, newHp }));
      const returned = applyHealingToTarget({}, name, 5, CAMPAIGN);

      expect(setRuntimeBatch).toHaveBeenCalledTimes(1);
      expect(setRuntimeBatch).toHaveBeenCalledWith(name, {
        currentHitPoints: newHp,
        deathSaves: [false, false, false],
        deathFailures: [false, false, false],
        isDead: 0,
      }, CAMPAIGN);
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(returned).toEqual({ actualHeal: newHp - oldHp, oldHp, newHp, maxHp: 10 });
    }
  });

  it('non-revive player heal keeps the exact single setRuntimeValue HP POST (no batch)', () => {
    // Control face (criterion 3): the deferred commit is branch-local — a
    // living-ally heal writes ONLY currentHitPoints, never the death keys.
    modifyHitPoints.mockReturnValue(makeDeferredPlayerResult({ name: 'Paladin', oldHp: 10, newHp: 15 }));
    const returned = applyHealingToTarget({}, 'Paladin', 5, CAMPAIGN);

    expect(setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(setRuntimeValue).toHaveBeenCalledWith('Paladin', 'currentHitPoints', 15, CAMPAIGN);
    expect(setRuntimeBatch).not.toHaveBeenCalled();
    expect(returned).toEqual({ actualHeal: 5, oldHp: 10, newHp: 15, maxHp: 10 });
  });

  it('dispatches combat-summary-updated once AFTER the deferred commit on non-zero delta, never on zero', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    modifyHitPoints.mockReturnValue(makeDeferredPlayerResult({ name: 'Cleric', oldHp: 10, newHp: 15 }));
    applyHealingToTarget({}, 'Cleric', 5, CAMPAIGN);
    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    expect(dispatchSpy.mock.calls[0][0].type).toBe('combat-summary-updated');
    // The HP write must precede the event (listeners never read stale HP).
    expect(setRuntimeValue.mock.invocationCallOrder[0])
      .toBeLessThan(dispatchSpy.mock.invocationCallOrder[0]);

    dispatchSpy.mockClear();
    modifyHitPoints.mockReturnValue(makeDeferredPlayerResult({ name: 'Cleric', oldHp: 15, newHp: 15 }));
    applyHealingToTarget({}, 'Cleric', 0, CAMPAIGN);
    expect(dispatchSpy).not.toHaveBeenCalled();
    dispatchSpy.mockRestore();
  });

  it('leaves death-save state untouched unless a player crosses up through 0', () => {
    const silences = [
      // already above 0 (oldHp > 0 guard)
      makeDeferredPlayerResult({ name: 'Paladin', oldHp: 10, newHp: 15 }),
      // remains at 0 (newHp > 0 guard) — deferredHpWrite 0 still commits HP
      makeDeferredPlayerResult({ name: 'Rogue', oldHp: 0, newHp: 0 }),
      // remains below 0 (newHp > 0 guard)
      makeDeferredPlayerResult({ name: 'Barbarian', oldHp: -5, newHp: -2 }),
      // NPC lifted above 0 (isPlayer guard — no deferred key on the monster leg)
      makeResult({ isPlayer: false, oldHp: 0, newHp: 5, delta: 5, creature: { name: 'Goblin' } }),
    ];
    for (const result of silences) {
      modifyHitPoints.mockReturnValue(result);
      applyHealingToTarget({}, result.creature.name, 5, CAMPAIGN);
    }
    // Player legs commit ONLY the HP key; the death-state keys are never
    // written outside the revive branch, and no batch is ever formed.
    expect(setRuntimeBatch).not.toHaveBeenCalled();
    expect(setRuntimeValue).toHaveBeenCalledTimes(3);
    for (const call of setRuntimeValue.mock.calls) {
      expect(call[1]).toBe('currentHitPoints');
    }
    expect(setRuntimeValue).toHaveBeenCalledWith('Rogue', 'currentHitPoints', 0, CAMPAIGN);
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
