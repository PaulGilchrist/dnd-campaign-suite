// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { applyHealingToTarget } from './applyHealing.js';

vi.mock('../../shared/hpModifier.js', () => ({
  modifyHitPoints: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../ui/storage.js', () => ({ default: { set: vi.fn() } }));

import { modifyHitPoints } from '../../shared/hpModifier.js';
import { setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import storage from '../../ui/storage.js';

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
  });

  describe('return value', () => {
    it('returns null when modifyHitPoints returns null or undefined', () => {
      modifyHitPoints.mockReturnValue(null);
      expect(applyHealingToTarget({}, 'Goblin', 5, 'TestCampaign')).toBeNull();

      modifyHitPoints.mockReturnValue(undefined);
      expect(applyHealingToTarget({}, 'Goblin', 5, 'TestCampaign')).toBeNull();
    });

    it('returns actualHeal, oldHp, and newHp from result', () => {
      modifyHitPoints.mockReturnValue(makeResult({ oldHp: 10, newHp: 15, delta: 5 }));
      const result = applyHealingToTarget({}, 'Goblin', 5, 'TestCampaign');
      expect(result).toEqual({ actualHeal: 5, oldHp: 10, newHp: 15 });
    });
  });

  describe('death save reset', () => {
    it('resets deathSaves and deathFailures when player heals from <=0 to >0', () => {
      // from 0 to positive
      modifyHitPoints.mockReturnValue(
        makeResult({ isPlayer: true, oldHp: 0, newHp: 5, delta: 5, creature: { name: 'Fighter' } })
      );
      applyHealingToTarget({}, 'Fighter', 5, 'TestCampaign');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Fighter', 'deathSaves', [false, false, false], 'TestCampaign'
      );
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Fighter', 'deathFailures', [false, false, false], 'TestCampaign'
      );

      // from negative to positive
      setRuntimeValue.mockClear();
      modifyHitPoints.mockReturnValue(
        makeResult({ isPlayer: true, oldHp: -3, newHp: 2, delta: 5, creature: { name: 'Cleric' } })
      );
      applyHealingToTarget({}, 'Cleric', 5, 'TestCampaign');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Cleric', 'deathSaves', [false, false, false], 'TestCampaign'
      );
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Cleric', 'deathFailures', [false, false, false], 'TestCampaign'
      );
    });

    it('does not reset death saves when player is already above 0', () => {
      modifyHitPoints.mockReturnValue(
        makeResult({ isPlayer: true, oldHp: 10, newHp: 15, delta: 5, creature: { name: 'Paladin' } })
      );
      applyHealingToTarget({}, 'Paladin', 5, 'TestCampaign');
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('does not reset death saves when player remains at or below 0', () => {
      // remains at 0
      modifyHitPoints.mockReturnValue(
        makeResult({ isPlayer: true, oldHp: 0, newHp: 0, delta: 0, creature: { name: 'Rogue' } })
      );
      applyHealingToTarget({}, 'Rogue', 5, 'TestCampaign');
      expect(setRuntimeValue).not.toHaveBeenCalled();

      // remains below 0
      setRuntimeValue.mockClear();
      modifyHitPoints.mockReturnValue(
        makeResult({ isPlayer: true, oldHp: -5, newHp: -2, delta: 3, creature: { name: 'Barbarian' } })
      );
      applyHealingToTarget({}, 'Barbarian', 3, 'TestCampaign');
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('does not reset death saves for NPC creatures', () => {
      modifyHitPoints.mockReturnValue(
        makeResult({ isPlayer: false, oldHp: 0, newHp: 5, delta: 5, creature: { name: 'Goblin' } })
      );
      applyHealingToTarget({}, 'Goblin', 5, 'TestCampaign');
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('NPC combat summary persistence', () => {
    it('saves combatSummary via storage when NPC delta is non-zero', () => {
      const cs = { round: 1, creatures: [] };
      modifyHitPoints.mockReturnValue(
        makeResult({ isPlayer: false, oldHp: 10, newHp: 15, delta: 5, creature: { name: 'Goblin' } })
      );
      applyHealingToTarget(cs, 'Goblin', 5, 'TestCampaign');
      expect(storage.set).toHaveBeenCalledWith('combatSummary', cs, 'TestCampaign');
    });

    it('does not save combatSummary when NPC delta is zero or for player healing', () => {
      const cs = { round: 1, creatures: [] };

      // NPC with zero delta
      modifyHitPoints.mockReturnValue(
        makeResult({ isPlayer: false, oldHp: 10, newHp: 10, delta: 0, creature: { name: 'Goblin' } })
      );
      applyHealingToTarget(cs, 'Goblin', 0, 'TestCampaign');
      expect(storage.set).not.toHaveBeenCalled();

      // Player healing
      storage.set.mockClear();
      modifyHitPoints.mockReturnValue(
        makeResult({ isPlayer: true, oldHp: 10, newHp: 15, delta: 5, creature: { name: 'Cleric' } })
      );
      applyHealingToTarget(cs, 'Cleric', 5, 'TestCampaign');
      expect(storage.set).not.toHaveBeenCalled();
    });
  });
});
