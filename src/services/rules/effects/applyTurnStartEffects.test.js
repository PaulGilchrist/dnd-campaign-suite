// @maintained-by-ai
// Turn-start orchestration owner: dispatch contract of applyTurnStartEffects
// (via the expirations.js barrel) — guard returns, effect-type → handler
// routing in array order, and the hasInspiration / CLA-307 / umbral_sight /
// elder_champion / regenerate-buff / bait_and_switch lanes.
// Callee internals are owned by sibling lanes: innerRadiance + Holy Nimbus
// pre-guard + runtime merge (expirations_applyAuraDamage.test.js,
// turnStartEffects_innerRadiance.test.js), resistance/infernal-wound/
// constrict/whirlwind pre-playerStats seams (turnStartEffects.*.test.js),
// topple/cloak/wild-magic/flag clears (expirations_expireStaleEffects.test.js),
// remaining handlers (turnStartEffects_additional.test.js,
// expirations_additional.test.js). No round-counter reads on this face;
// round-sensitive handlers are pinned in their own lanes (no-timers policy).
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  getAllStoreKeys: vi.fn(() => []),
}));

vi.mock('../../ui/utils.js', () => ({
  default: {
    getName: vi.fn((name) => name),
  },
}));

vi.mock('../../ui/storage.js', () => ({
  default: {
    set: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(),
  getActiveCreatureName: vi.fn(),
  getCombatSummary: vi.fn(),
  loadCombatSummary: vi.fn(),
  setCombatSummaryCache: vi.fn(),
}));

vi.mock('../../combat/automation/automationExpressions.js', () => ({
  evaluateAutoExpression: vi.fn(() => 5),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../rules/combat/rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(() => 5),
}));

vi.mock('../../automation/handlers/spells/slowHandler.js', () => ({
  processSlowRepeatSave: vi.fn().mockResolvedValue(undefined),
  handle: vi.fn(),
}));

vi.mock('../../automation/handlers/spells/tashasLaughterHandler.js', () => ({
  processTashasLaughterRepeatSave: vi.fn().mockResolvedValue(undefined),
  handle: vi.fn(),
}));

import { applyTurnStartEffects } from './expirations.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

function resetMocks() {
  vi.clearAllMocks();
  localStorage.clear();
  window.dispatchEvent = vi.fn();
}

describe('applyTurnStartEffects', () => {
  beforeEach(() => {
    resetMocks();
    getRuntimeValue.mockReset();
    setRuntimeValue.mockReset();
    getRuntimeValue.mockImplementation(() => null);
  });

  describe('playerStats guard', () => {
    it('writes nothing when activeName or playerStats is missing, even with a write-capable effect present', async () => {
      // bait_and_switch_clear writes unconditionally once dispatched — a
      // tripwire that fires if the `!activeName || !playerStats` guard is
      // removed (an empty effect list would pass even with the guard broken).
      const writeCapable = { turnStartEffects: [{ type: 'bait_and_switch_clear' }] };

      await applyTurnStartEffects(null, writeCapable, 'TestCampaign');
      expect(setRuntimeValue).not.toHaveBeenCalled();

      // null playerStats: removing the guard would hit ensureArray() and throw.
      await applyTurnStartEffects('TestCharacter', null, 'TestCampaign');
      await applyTurnStartEffects('TestCharacter', undefined, 'TestCampaign');
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('dispatch contract', () => {
    it('dispatches every effect in array order, routing each type to its handler writes', async () => {
      getRuntimeValue.mockImplementation((_name, prop) => {
        if (prop === 'umbralSightDarknessActive') return true;
        if (prop === 'activeConditions') return ['fatigued'];
        return null;
      });

      const characters = [{ name: 'Other' }];
      await applyTurnStartEffects(
        'TestCharacter',
        { turnStartEffects: [
          { type: 'umbral_sight', name: 'Umbral Sight' },
          { type: 'bait_and_switch_clear' },
        ] },
        'TestCampaign',
        characters
      );

      // Exactly the umbral write first, then the three bait clears — proving
      // the loop iterates every entry and routes each type to its handler.
      expect(setRuntimeValue.mock.calls).toEqual([
        ['TestCharacter', 'activeConditions', ['fatigued', 'invisible'], 'TestCampaign'],
        ['TestCharacter', 'baitAndSwitchActive', null, 'TestCampaign'],
        ['TestCharacter', 'baitAndSwitchBonus', null, 'TestCampaign'],
        ['TestCharacter', 'baitAndSwitchSource', null, 'TestCampaign'],
      ]);
    });

    it('skips unrecognized effect types without crashing or writing', async () => {
      await applyTurnStartEffects('TestCharacter', {
        turnStartEffects: [{ type: 'not_a_registered_turn_start_type', name: 'Ghost Effect' }]
      }, 'TestCampaign');

      expect(setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('heroic_inspiration effect', () => {
    function setupInspiration(hasInspiration) {
      getRuntimeValue.mockImplementation((_name, prop) => {
        if (prop === 'hasInspiration') return hasInspiration;
        return null;
      });
    }

    it('grants hasInspiration once and does not rewrite when already set', async () => {
      setupInspiration(false);
      await applyTurnStartEffects('TestCharacter', {
        turnStartEffects: [{ type: 'heroic_inspiration', name: 'Heroic Warrior' }]
      }, 'TestCampaign');

      expect(setRuntimeValue).toHaveBeenCalledTimes(1);
      expect(setRuntimeValue).toHaveBeenCalledWith('TestCharacter', 'hasInspiration', true, 'TestCampaign');

      // Already inspired: the !hasInspiration guard must suppress a second write.
      setupInspiration(true);
      await applyTurnStartEffects('TestCharacter', {
        turnStartEffects: [{ type: 'heroic_inspiration', name: 'Heroic Warrior' }]
      }, 'TestCampaign');

      expect(setRuntimeValue).toHaveBeenCalledTimes(1);
    });
  });

  describe('condition_removal effect (CLA-307: must NOT run at turn start)', () => {
    it('does NOT remove conditions at turn start — removal moved to owner turn end', async () => {
      getRuntimeValue.mockImplementation((_name, prop) => {
        if (prop === 'activeConditions') return ['charmed', 'poisoned', 'blinded'];
        return null;
      });

      await applyTurnStartEffects('TestCharacter', {
        turnStartEffects: [{
          type: 'condition_removal',
          name: 'Self-Restoration',
          conditions: ['charmed', 'frightened', 'poisoned']
        }]
      }, 'TestCampaign');

      const conditionWrites = setRuntimeValue.mock.calls.filter(([, key]) => key === 'activeConditions');
      expect(conditionWrites).toEqual([]);
    });
  });

  describe('umbral_sight effect', () => {
    function setupUmbralSight(inDarkness, conditions) {
      getRuntimeValue.mockImplementation((_name, prop) => {
        if (prop === 'umbralSightDarknessActive') return inDarkness;
        if (prop === 'activeConditions') return conditions;
        return null;
      });
    }

    it('tracks invisible with darkness state: adds, no-ops when already correct, removes', async () => {
      const effect = [{ type: 'umbral_sight', name: 'Umbral Sight' }];

      setupUmbralSight(true, ['fatigued']);
      await applyTurnStartEffects('TestCharacter', { turnStartEffects: effect }, 'TestCampaign');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCharacter', 'activeConditions', ['fatigued', 'invisible'], 'TestCampaign'
      );

      // Already invisible in darkness — no redundant write.
      setupUmbralSight(true, ['fatigued', 'invisible']);
      await applyTurnStartEffects('TestCharacter', { turnStartEffects: effect }, 'TestCampaign');
      expect(setRuntimeValue).toHaveBeenCalledTimes(1);

      // Out of darkness — invisible removed.
      setupUmbralSight(false, ['fatigued', 'invisible']);
      await applyTurnStartEffects('TestCharacter', { turnStartEffects: effect }, 'TestCampaign');
      expect(setRuntimeValue).toHaveBeenCalledTimes(2);
      expect(setRuntimeValue).toHaveBeenLastCalledWith(
        'TestCharacter', 'activeConditions', ['fatigued'], 'TestCampaign'
      );
    });
  });

  describe('elder_champion_regeneration effect', () => {
    function setupHp(active, currentHp) {
      getRuntimeValue.mockImplementation((_name, prop) => {
        if (prop === 'elderChampionActive') return active;
        if (prop === 'hitPoints') return 20;
        if (prop === 'currentHitPoints') return currentHp;
        return null;
      });
    }

    it('heals by the resolved expression while active, clamps at max HP, and stays inert when inactive', async () => {
      const effects = {
        turnStartEffects: [{
          type: 'elder_champion_regeneration',
          name: 'Elder Champion Regeneration',
          healExpression: '5',
        }]
      };

      setupHp(true, 10);
      await applyTurnStartEffects('TestCharacter', effects, 'TestCampaign');
      expect(setRuntimeValue).toHaveBeenCalledWith('TestCharacter', 'currentHitPoints', 15, 'TestCampaign');

      setupHp(true, 18);
      await applyTurnStartEffects('TestCharacter', effects, 'TestCampaign');
      expect(setRuntimeValue).toHaveBeenLastCalledWith('TestCharacter', 'currentHitPoints', 20, 'TestCampaign');

      // Not an elder champion — no further writes.
      setupHp(false, 10);
      await applyTurnStartEffects('TestCharacter', effects, 'TestCampaign');
      expect(setRuntimeValue).toHaveBeenCalledTimes(2);
    });
  });

  describe('regenerate buff healing', () => {
    it('heals when regenerateActive flag is true', async () => {
      getRuntimeValue.mockImplementation((_name, prop) => {
        if (prop === 'regenerateActive') return true;
        if (prop === 'hitPoints') return 20;
        if (prop === 'currentHitPoints') return 10;
        return null;
      });

      await applyTurnStartEffects('Target', { turnStartEffects: [] }, 'TestCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Target',
        'currentHitPoints',
        11,
        'TestCampaign'
      );
    });
  });

  describe('bait_and_switch_clear turn-start effect', () => {
    it('clears baitAndSwitch state when effect is present', async () => {
      getRuntimeValue.mockImplementation((_name, prop) => {
        if (prop === 'baitAndSwitchActive') return true;
        return null;
      });

      await applyTurnStartEffects('TestCharacter', {
        turnStartEffects: [{ type: 'bait_and_switch_clear' }]
      }, 'TestCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith('TestCharacter', 'baitAndSwitchActive', null, 'TestCampaign');
      expect(setRuntimeValue).toHaveBeenCalledWith('TestCharacter', 'baitAndSwitchBonus', null, 'TestCampaign');
      expect(setRuntimeValue).toHaveBeenCalledWith('TestCharacter', 'baitAndSwitchSource', null, 'TestCampaign');
    });
  });
});
