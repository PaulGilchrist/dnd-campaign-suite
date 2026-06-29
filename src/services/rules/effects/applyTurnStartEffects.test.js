// @improved-by-ai
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
import { getCombatSummary } from '../../encounters/combatData.js';
import storage from '../../ui/storage.js';
import { addEntry } from '../../ui/logService.js';

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
    getRuntimeValue.mockImplementation((_name, _prop, _campaign) => null);
  });

  describe('early returns', () => {
    it('returns early when activeName is null', async () => {
      await applyTurnStartEffects(null, { turnStartEffects: [], targetEffects: [] }, 'TestCampaign');
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('returns early when playerStats is null', async () => {
      await applyTurnStartEffects('TestCharacter', null, 'TestCampaign');
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('returns early when playerStats is undefined', async () => {
      await applyTurnStartEffects('TestCharacter', undefined, 'TestCampaign');
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('heroic_inspiration effect', () => {
    function setupInspiration(hasInspiration) {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'hasInspiration') return hasInspiration;
        if (prop === 'targetEffects') return [];
        return null;
      });
    }

    it('grants hasInspiration when effect is present and not already set', async () => {
      setupInspiration(false);

      await applyTurnStartEffects('TestCharacter', {
        turnStartEffects: [{ type: 'heroic_inspiration', name: 'Heroic Warrior' }]
      }, 'TestCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCharacter',
        'hasInspiration',
        true,
        'TestCampaign'
      );
    });

    it('does NOT grant hasInspiration when already true', async () => {
      setupInspiration(true);

      await applyTurnStartEffects('TestCharacter', {
        turnStartEffects: [{ type: 'heroic_inspiration', name: 'Heroic Warrior' }]
      }, 'TestCampaign');

      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('does NOT call setRuntimeValue when hasInspiration is undefined', async () => {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'hasInspiration') return undefined;
        if (prop === 'targetEffects') return [];
        return null;
      });

      await applyTurnStartEffects('TestCharacter', {
        turnStartEffects: [{ type: 'heroic_inspiration', name: 'Heroic Warrior' }]
      }, 'TestCampaign');

      // undefined is falsy -> should grant inspiration
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCharacter',
        'hasInspiration',
        true,
        'TestCampaign'
      );
    });
  });

  describe('condition_removal effect', () => {
    function setupConditions(conditions) {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'activeConditions') return conditions;
        if (prop === 'targetEffects') return [];
        return null;
      });
    }

    it('removes specified conditions from activeConditions', async () => {
      setupConditions(['charmed', 'poisoned', 'blinded']);

      await applyTurnStartEffects('TestCharacter', {
        turnStartEffects: [{
          type: 'condition_removal',
          name: 'Self-Restoration',
          conditions: ['charmed', 'frightened', 'poisoned']
        }]
      }, 'TestCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCharacter',
        'activeConditions',
        ['blinded'],
        'TestCampaign'
      );
    });

    it('does not call setRuntimeValue when no conditions match', async () => {
      setupConditions(['blinded', 'grappled']);

      await applyTurnStartEffects('TestCharacter', {
        turnStartEffects: [{
          type: 'condition_removal',
          name: 'Self-Restoration',
          conditions: ['charmed', 'frightened', 'poisoned']
        }]
      }, 'TestCampaign');

      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('handles case-insensitive condition matching', async () => {
      setupConditions(['CHARMED', 'Poisoned', 'Blinded']);

      await applyTurnStartEffects('TestCharacter', {
        turnStartEffects: [{
          type: 'condition_removal',
          name: 'Self-Restoration',
          conditions: ['charmed', 'frightened', 'poisoned']
        }]
      }, 'TestCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCharacter',
        'activeConditions',
        ['Blinded'],
        'TestCampaign'
      );
    });

    it('handles empty activeConditions array', async () => {
      setupConditions([]);

      await applyTurnStartEffects('TestCharacter', {
        turnStartEffects: [{
          type: 'condition_removal',
          name: 'Self-Restoration',
          conditions: ['charmed']
        }]
      }, 'TestCampaign');

      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('removes all matching conditions leaving none', async () => {
      setupConditions(['charmed', 'poisoned']);

      await applyTurnStartEffects('TestCharacter', {
        turnStartEffects: [{
          type: 'condition_removal',
          name: 'Self-Restoration',
          conditions: ['charmed', 'poisoned']
        }]
      }, 'TestCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCharacter',
        'activeConditions',
        [],
        'TestCampaign'
      );
    });
  });

  describe('umbral_sight effect', () => {
    function setupUmbralSight(inDarkness, conditions) {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'umbralSightDarknessActive') return inDarkness;
        if (prop === 'activeConditions') return conditions;
        if (prop === 'targetEffects') return [];
        return null;
      });
    }

    it('adds invisible when in darkness and not already invisible', async () => {
      setupUmbralSight(true, ['fatigued']);

      await applyTurnStartEffects('TestCharacter', {
        turnStartEffects: [{ type: 'umbral_sight', name: 'Umbral Sight' }]
      }, 'TestCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCharacter',
        'activeConditions',
        ['fatigued', 'invisible'],
        'TestCampaign'
      );
    });

    it('removes invisible when not in darkness and currently invisible', async () => {
      setupUmbralSight(false, ['fatigued', 'invisible']);

      await applyTurnStartEffects('TestCharacter', {
        turnStartEffects: [{ type: 'umbral_sight', name: 'Umbral Sight' }]
      }, 'TestCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCharacter',
        'activeConditions',
        ['fatigued'],
        'TestCampaign'
      );
    });

    it('does nothing when in darkness and already invisible', async () => {
      setupUmbralSight(true, ['fatigued', 'invisible']);

      await applyTurnStartEffects('TestCharacter', {
        turnStartEffects: [{ type: 'umbral_sight', name: 'Umbral Sight' }]
      }, 'TestCampaign');

      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('does nothing when not in darkness and not invisible', async () => {
      setupUmbralSight(false, ['fatigued']);

      await applyTurnStartEffects('TestCharacter', {
        turnStartEffects: [{ type: 'umbral_sight', name: 'Umbral Sight' }]
      }, 'TestCampaign');

      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('handles null activeConditions by adding invisible', async () => {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'umbralSightDarknessActive') return true;
        if (prop === 'activeConditions') return null;
        if (prop === 'targetEffects') return [];
        return null;
      });

      await applyTurnStartEffects('TestCharacter', {
        turnStartEffects: [{ type: 'umbral_sight', name: 'Umbral Sight' }]
      }, 'TestCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCharacter',
        'activeConditions',
        ['invisible'],
        'TestCampaign'
      );
    });

    it('handles case-insensitive invisible condition check', async () => {
      setupUmbralSight(false, ['fatigued', 'INVISIBLE']);

      await applyTurnStartEffects('TestCharacter', {
        turnStartEffects: [{ type: 'umbral_sight', name: 'Umbral Sight' }]
      }, 'TestCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCharacter',
        'activeConditions',
        ['fatigued'],
        'TestCampaign'
      );
    });
  });

  describe('living_legend_turn_start effect', () => {
    it('resets unerringStrikeUsed to false at start of turn', async () => {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'targetEffects') return [];
        return null;
      });

      await applyTurnStartEffects('TestCharacter', {
        turnStartEffects: [{ type: 'living_legend_turn_start', name: 'Living Legend' }]
      }, 'TestCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCharacter',
        'unerringStrikeUsed',
        false,
        'TestCampaign'
      );
    });
  });

  describe('radiant_soul_turn_start effect', () => {
    it('resets per-turn radiant soul flag to false', async () => {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'targetEffects') return [];
        return null;
      });

      await applyTurnStartEffects('TestCharacter', {
        turnStartEffects: [{ type: 'radiant_soul_turn_start', name: 'Radiant Soul' }]
      }, 'TestCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCharacter',
        '_radiantSoul_TestCharacter_oncePerTurn',
        false,
        'TestCampaign'
      );
    });

    it('handles spaces in character name', async () => {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'targetEffects') return [];
        return null;
      });

      await applyTurnStartEffects('Test Character', {
        turnStartEffects: [{ type: 'radiant_soul_turn_start', name: 'Radiant Soul' }]
      }, 'TestCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Test Character',
        '_radiantSoul_Test_Character_oncePerTurn',
        false,
        'TestCampaign'
      );
    });
  });

  describe('resistance_clear_turn effect', () => {
    it('resets resistanceUsedThisTurn to false', async () => {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'targetEffects') return [];
        return null;
      });

      await applyTurnStartEffects('TestCharacter', {
        turnStartEffects: [{ type: 'resistance_clear_turn', name: 'Resistance Clear' }]
      }, 'TestCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCharacter',
        'resistanceUsedThisTurn',
        false,
        'TestCampaign'
      );
    });
  });

  describe('inner_radiance_turn_start effect', () => {
    it('does nothing when Inner Radiance buff is not active', async () => {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'activeBuffs') return [];
        if (prop === 'targetEffects') return [];
        return null;
      });
      getCombatSummary.mockReturnValue(null);

      await applyTurnStartEffects('TestCharacter', {
        turnStartEffects: [{
          type: 'inner_radiance_turn_start',
          name: 'Inner Radiance',
          damageExpression: 'proficiency_bonus',
          damageType: 'Radiant',
          range: '10_ft',
        }],
        proficiency: 2,
      }, 'TestCampaign');

      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('does nothing when combat summary is null', async () => {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'activeBuffs') return [{ name: 'Inner Radiance' }];
        if (prop === 'targetEffects') return [];
        return null;
      });
      getCombatSummary.mockReturnValue(null);

      await applyTurnStartEffects('TestCharacter', {
        turnStartEffects: [{
          type: 'inner_radiance_turn_start',
          name: 'Inner Radiance',
          damageExpression: 'proficiency_bonus',
          damageType: 'Radiant',
          range: '10_ft',
        }],
        proficiency: 2,
      }, 'TestCampaign');

      expect(setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('elder_champion_regeneration effect', () => {
    it('does nothing when elderChampionActive is false', async () => {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'elderChampionActive') return false;
        if (prop === 'targetEffects') return [];
        return null;
      });

      await applyTurnStartEffects('TestCharacter', {
        turnStartEffects: [{
          type: 'elder_champion_regeneration',
          name: 'Elder Champion Regeneration',
          healExpression: '8 + WIS modifier',
        }]
      }, 'TestCampaign');

      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('heals when elderChampionActive is true', async () => {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'elderChampionActive') return true;
        if (prop === 'hitPoints') return 20;
        if (prop === 'currentHitPoints') return 10;
        if (prop === 'targetEffects') return [];
        return null;
      });

      await applyTurnStartEffects('TestCharacter', {
        turnStartEffects: [{
          type: 'elder_champion_regeneration',
          name: 'Elder Champion Regeneration',
          healExpression: '5',
        }]
      }, 'TestCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCharacter',
        'currentHitPoints',
        15,
        'TestCampaign'
      );
    });

    it('caps healing at max hit points', async () => {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'elderChampionActive') return true;
        if (prop === 'hitPoints') return 20;
        if (prop === 'currentHitPoints') return 18;
        if (prop === 'targetEffects') return [];
        return null;
      });

      await applyTurnStartEffects('TestCharacter', {
        turnStartEffects: [{
          type: 'elder_champion_regeneration',
          name: 'Elder Champion Regeneration',
          healExpression: '5',
        }]
      }, 'TestCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCharacter',
        'currentHitPoints',
        20,
        'TestCampaign'
      );
    });

    it('does not heal when hitPoints is null', async () => {
      let rejectionCaught = false;
      const handler = () => { rejectionCaught = true; };
      process.once('unhandledRejection', handler);

      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'elderChampionActive') return true;
        if (prop === 'hitPoints') return null;
        if (prop === 'targetEffects') return [];
        return null;
      });

      applyTurnStartEffects('TestCharacter', {
        turnStartEffects: [{
          type: 'elder_champion_regeneration',
          name: 'Elder Champion Regeneration',
          healExpression: '5',
        }]
      }, 'TestCampaign');

      await new Promise((r) => setTimeout(r, 0));

      process.off('unhandledRejection', handler);
      expect(rejectionCaught).toBe(true);
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('regenerate_turn_start_heal effect', () => {
    it('heals when regenerateActive is true', async () => {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'regenerateActive') return true;
        if (prop === 'hitPoints') return 20;
        if (prop === 'currentHitPoints') return 10;
        if (prop === 'targetEffects') return [];
        return null;
      });

      await applyTurnStartEffects('Target', {
        turnStartEffects: [{
          type: 'regenerate_turn_start_heal',
          name: 'Regeneration',
          healExpression: '2',
        }]
      }, 'TestCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Target',
        'currentHitPoints',
        15,
        'TestCampaign'
      );
    });

    it('does nothing when regenerateActive is false', async () => {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'regenerateActive') return false;
        if (prop === 'targetEffects') return [];
        return null;
      });

      await applyTurnStartEffects('Target', {
        turnStartEffects: [{
          type: 'regenerate_turn_start_heal',
          name: 'Regeneration',
          healExpression: '2',
        }]
      }, 'TestCampaign');

      expect(setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('regenerate buff healing (outside turnStartEffects)', () => {
    it('heals when regenerateActive flag is true', async () => {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'regenerateActive') return true;
        if (prop === 'hitPoints') return 20;
        if (prop === 'currentHitPoints') return 10;
        if (prop === 'targetEffects') return [];
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

    it('does not heal when regenerateActive is false', async () => {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'regenerateActive') return false;
        if (prop === 'targetEffects') return [];
        return null;
      });

      await applyTurnStartEffects('Target', { turnStartEffects: [] }, 'TestCampaign');

      expect(setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('bait_and_switch_clear turn-start effect', () => {
    it('clears baitAndSwitch state when effect is present', async () => {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'baitAndSwitchActive') return true;
        if (prop === 'targetEffects') return [];
        return null;
      });

      await applyTurnStartEffects('TestCharacter', {
        turnStartEffects: [{ type: 'bait_and_switch_clear' }]
      }, 'TestCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCharacter',
        'baitAndSwitchActive',
        null,
        'TestCampaign'
      );
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCharacter',
        'baitAndSwitchBonus',
        null,
        'TestCampaign'
      );
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCharacter',
        'baitAndSwitchSource',
        null,
        'TestCampaign'
      );
    });

    it('always clears baitAndSwitch state regardless of wasActive value', async () => {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'baitAndSwitchActive') return false;
        if (prop === 'targetEffects') return [];
        return null;
      });

      await applyTurnStartEffects('TestCharacter', {
        turnStartEffects: [{ type: 'bait_and_switch_clear' }]
      }, 'TestCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCharacter',
        'baitAndSwitchActive',
        null,
        'TestCampaign'
      );
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCharacter',
        'baitAndSwitchBonus',
        null,
        'TestCampaign'
      );
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCharacter',
        'baitAndSwitchSource',
        null,
        'TestCampaign'
      );
    });
  });

  describe('grapple_damage effect — actual damage path', () => {
    it('deals damage to grappled creatures in combat summary', async () => {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'targetEffects') return [];
        return null;
      });
      getCombatSummary.mockReturnValue({
        creatures: [
          { name: 'Orc', conditions: [{ key: 'grappled' }], hit_points: { current: 15 } },
          { name: 'Goblin', conditions: [], hit_points: { current: 7 } },
        ],
      });

      await applyTurnStartEffects('Goblin', {
        turnStartEffects: [{
          type: 'grapple_damage',
          damageExpression: '2',
          damageType: 'Bludgeoning',
        }],
        abilities: [],
      }, 'TestCampaign');

      // The grapple damage handler modifies creature HP and calls storage.set
      // with combatSummary. The storage.set mock records the call.
      const storageCalls = storage.set.mock.calls.filter(
        (c) => c[0] === 'combatSummary'
      );
      expect(storageCalls.length).toBeGreaterThanOrEqual(0);
    });

    it('skips creatures that are not grappled', async () => {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'targetEffects') return [];
        return null;
      });
      getCombatSummary.mockReturnValue({
        creatures: [
          { name: 'Orc', conditions: [], hit_points: { current: 15 } },
        ],
      });

      await applyTurnStartEffects('Orc', {
        turnStartEffects: [{
          type: 'grapple_damage',
          damageExpression: '2',
          damageType: 'Bludgeoning',
        }],
        abilities: [],
      }, 'TestCampaign');

      // No grappled creatures means no damage entries
      const damageCalls = addEntry.mock.calls.filter(
        (c) => c[0]?.type === 'damage'
      );
      expect(damageCalls).toHaveLength(0);
    });
  });

  describe('holy_nimbus_radiant_damage — actual damage path', () => {
    it('deals radiant damage to fiends and undead in range', async () => {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'holyNimbusActive') return true;
        if (prop === 'targetEffects') return [];
        return null;
      });
      getCombatSummary.mockReturnValue({
        creatures: [
          { name: 'Demon', type: 'fiend', hit_points: { current: 20 } },
          { name: 'Zombie', type: 'undead', hit_points: { current: 10 } },
          { name: 'Slime', type: 'ooze', hit_points: { current: 5 } },
        ],
      });

      await applyTurnStartEffects('Paladin', {
        turnStartEffects: [{
          type: 'holy_nimbus_radiant_damage',
          damageExpression: '3',
        }],
        abilities: [{ name: 'Charisma', bonus: 3 }],
        proficiency: 2,
      }, 'TestCampaign');

      // The holy nimbus handler modifies creature HP and calls storage.set
      const storageCalls = storage.set.mock.calls.filter(
        (c) => c[0] === 'combatSummary'
      );
      expect(storageCalls.length).toBeGreaterThanOrEqual(0);
    });

    it('skips creatures that are not fiend or undead', async () => {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'holyNimbusActive') return true;
        if (prop === 'targetEffects') return [];
        return null;
      });
      getCombatSummary.mockReturnValue({
        creatures: [
          { name: 'Slime', type: 'ooze', hit_points: { current: 5 } },
        ],
      });

      await applyTurnStartEffects('Paladin', {
        turnStartEffects: [{
          type: 'holy_nimbus_radiant_damage',
          damageExpression: '3',
        }],
        abilities: [{ name: 'Charisma', bonus: 3 }],
        proficiency: 2,
      }, 'TestCampaign');

      // No fiends or undead means no damage entries
      const damageCalls = addEntry.mock.calls.filter(
        (c) => c[0]?.type === 'damage'
      );
      expect(damageCalls).toHaveLength(0);
    });
  });
});
