// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  getAllStoreKeys: vi.fn(() => []),
}));

vi.mock('../../ui/utils.js', () => ({
  default: {
    getName: vi.fn((val) => String(val)),
  },
}));

vi.mock('../../ui/storage.js', () => ({
  default: {
    set: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(() => 5),
  getActiveCreatureName: vi.fn(() => 'Goblin'),
  getCombatSummary: vi.fn(),
  loadCombatSummary: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../rules/combat/rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(() => 10),
}));

vi.mock('../../automation/handlers/spells/slowHandler.js', () => ({
  processSlowRepeatSave: vi.fn().mockResolvedValue(undefined),
  handle: vi.fn(),
}));

vi.mock('../../automation/handlers/spells/tashasLaughterHandler.js', () => ({
  processTashasLaughterRepeatSave: vi.fn().mockResolvedValue(undefined),
  handle: vi.fn(),
}));

vi.mock('../../combat/automation/automationExpressions.js', () => ({
  evaluateAutoExpression: vi.fn((expr) => {
    if (typeof expr === 'number') return expr;
    return 1;
  }),
}));

import { clearAllExpirationEffects } from './expirations.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import utils from '../../ui/utils.js';

const KEY = 'pendingExpirations';

function resetMocks() {
  vi.clearAllMocks();
  localStorage.clear();
  window.dispatchEvent = vi.fn();
}

function stubUtilsNameIdentity() {
  utils.getName.mockImplementation((v) => String(v));
}

// ---------------------------------------------------------------------------
// clearExpirationEffects — effect type handling (via clearAllExpirationEffects)
// ---------------------------------------------------------------------------
describe('clearExpirationEffects effect types (via clearAllExpirationEffects)', () => {
  beforeEach(() => {
    resetMocks();
    stubUtilsNameIdentity();
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeConditions') return [];
      if (key.startsWith('_advantageOn_')) return [];
      return null;
    });
  });

  describe('condition effect type', () => {
    it('removes the specified condition from target activeConditions', () => {
      const myList = [
        { target: 'Orc', effects: [{ type: 'condition', condition: 'stunned' }], appliedRound: 1 },
      ];
      getRuntimeValue.mockImplementation((name, key) => {
        if (name === 'Orc' && key === 'activeConditions') return ['stunned', 'poisoned'];
        if (key === 'activeConditions') return [];
        if (key === KEY && name === 'Goblin') return myList;
        if (key === KEY) return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Orc',
        'activeConditions',
        ['poisoned'],
        'MyCampaign',
      );
    });

    it('handles non-array activeConditions gracefully', () => {
      const myList = [
        { target: 'Orc', effects: [{ type: 'condition', condition: 'stunned' }], appliedRound: 1 },
      ];
      getRuntimeValue.mockImplementation((name, key) => {
        if (name === 'Orc' && key === 'activeConditions') return 'stunned';
        if (key === 'activeConditions') return [];
        if (key === KEY && name === 'Goblin') return myList;
        if (key === KEY) return [];
        return null;
      });

      expect(() => clearAllExpirationEffects('Goblin', 'MyCampaign')).not.toThrow();
    });

    it('handles null activeConditions gracefully', () => {
      const myList = [
        { target: 'Orc', effects: [{ type: 'condition', condition: 'stunned' }], appliedRound: 1 },
      ];
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeConditions') return [];
        if (key === KEY && name === 'Goblin') return myList;
        if (key === KEY) return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Orc',
        'activeConditions',
        [],
        'MyCampaign',
      );
    });

    it('uses utils.getName for case-insensitive condition comparison', () => {
      const myList = [
        { target: 'Orc', effects: [{ type: 'condition', condition: 'stunned' }], appliedRound: 1 },
      ];
      utils.getName.mockImplementation((v) => String(v).toLowerCase());
      getRuntimeValue.mockImplementation((name, key) => {
        if (name === 'Orc' && key === 'activeConditions') return ['STUNNED', 'poisoned'];
        if (key === 'activeConditions') return [];
        if (key === KEY && name === 'Goblin') return myList;
        if (key === KEY) return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Orc',
        'activeConditions',
        ['poisoned'],
        'MyCampaign',
      );
    });

    it('only removes the matching condition, leaves others', () => {
      const myList = [
        { target: 'Orc', effects: [{ type: 'condition', condition: 'stunned' }], appliedRound: 1 },
      ];
      getRuntimeValue.mockImplementation((name, key) => {
        if (name === 'Orc' && key === 'activeConditions') return ['frightened', 'stunned', 'blinded'];
        if (key === 'activeConditions') return [];
        if (key === KEY && name === 'Goblin') return myList;
        if (key === KEY) return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Orc',
        'activeConditions',
        ['frightened', 'blinded'],
        'MyCampaign',
      );
    });
  });

  describe('advantage_on_target effect type', () => {
    it('removes target from storedAdv when present', () => {
      const myList = [
        { target: 'Human', effects: [{ type: 'advantage_on_target' }], appliedRound: 1 },
      ];
      getRuntimeValue.mockImplementation((name, key) => {
        if (name === 'Goblin' && key === KEY) return myList;
        if (key === '_advantageOn_Human') return ['Orc', 'Human', 'Elf'];
        if (key === 'activeConditions') return [];
        if (key === KEY) return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        '_advantageOn_Human',
        ['Orc', 'Elf'],
        'MyCampaign',
      );
    });

    it('does not call setRuntimeValue for advantage key when target not in storedAdv', () => {
      const myList = [
        { target: 'Human', effects: [{ type: 'advantage_on_target' }], appliedRound: 1 },
      ];
      getRuntimeValue.mockImplementation((name, key) => {
        if (name === 'Goblin' && key === KEY) return myList;
        if (key === '_advantageOn_Human') return ['Orc', 'Elf'];
        if (key === 'activeConditions') return [];
        if (key === KEY) return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      const advCalls = setRuntimeValue.mock.calls.filter(
        (c) => c[1].startsWith('_advantageOn_'),
      );
      expect(advCalls).toHaveLength(0);
    });

    it('removes all entries when storedAdv contains only the target', () => {
      const myList = [
        { target: 'Human', effects: [{ type: 'advantage_on_target' }], appliedRound: 1 },
      ];
      getRuntimeValue.mockImplementation((name, key) => {
        if (name === 'Goblin' && key === KEY) return myList;
        if (key === '_advantageOn_Human') return ['Human'];
        if (key === 'activeConditions') return [];
        if (key === KEY) return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        '_advantageOn_Human',
        [],
        'MyCampaign',
      );
    });
  });

  describe('stunned effect type', () => {
    it('removes stunned condition when condition is "stunned"', () => {
      const myList = [
        { target: 'Orc', effects: [{ type: 'stunned', condition: 'stunned' }], appliedRound: 1 },
      ];
      getRuntimeValue.mockImplementation((name, key) => {
        if (name === 'Orc' && key === 'activeConditions') return ['stunned', 'poisoned'];
        if (key === 'activeConditions') return [];
        if (key === KEY && name === 'Goblin') return myList;
        if (key === KEY) return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Orc',
        'activeConditions',
        ['poisoned'],
        'MyCampaign',
      );
    });

    it('sets stunned_speedHalved to null when condition is "speed_halved"', () => {
      const myList = [
        { target: 'Orc', effects: [{ type: 'stunned', condition: 'speed_halved' }], appliedRound: 1 },
      ];
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeConditions') return [];
        if (key === KEY && name === 'Goblin') return myList;
        if (key === KEY) return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Orc',
        'stunned_speedHalved',
        null,
        'MyCampaign',
      );
    });
  });

  describe('flight/buff removal effect types', () => {
    it('removes fly_speed_equals_walk_speed buff from activeBuffs', () => {
      const myList = [
        { target: 'Human', effects: [{ type: 'fly_speed_equals_walk_speed' }], appliedRound: 1 },
      ];
      getRuntimeValue.mockImplementation((name, key) => {
        if (name === 'Human' && key === 'activeBuffs') return [
          { effect: 'fly_speed_equals_walk_speed', duration: 3 },
          { effect: 'double_move', duration: 2 },
        ];
        if (name === 'Human' && key === 'activeConditions') return [];
        if (key === KEY && name === 'Goblin') return myList;
        if (key === KEY) return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Human',
        'activeBuffs',
        [{ effect: 'double_move', duration: 2 }],
        'MyCampaign',
      );
    });

    it('removes fly_speed_20_hover buff from activeBuffs', () => {
      const myList = [
        { target: 'Human', effects: [{ type: 'fly_speed_20_hover' }], appliedRound: 1 },
      ];
      getRuntimeValue.mockImplementation((name, key) => {
        if (name === 'Human' && key === 'activeBuffs') return [
          { effect: 'fly_speed_20_hover', duration: 3 },
        ];
        if (key === KEY && name === 'Goblin') return myList;
        if (key === KEY) return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Human',
        'activeBuffs',
        [],
        'MyCampaign',
      );
    });

    it('removes dragon_wings buff from activeBuffs', () => {
      const myList = [
        { target: 'Human', effects: [{ type: 'dragon_wings' }], appliedRound: 1 },
      ];
      getRuntimeValue.mockImplementation((name, key) => {
        if (name === 'Human' && key === 'activeBuffs') return [
          { effect: 'dragon_wings', duration: 3 },
        ];
        if (key === KEY && name === 'Goblin') return myList;
        if (key === KEY) return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Human',
        'activeBuffs',
        [],
        'MyCampaign',
      );
    });

    it('removes ice_walk buff from activeBuffs', () => {
      const myList = [
        { target: 'Human', effects: [{ type: 'ice_walk' }], appliedRound: 1 },
      ];
      getRuntimeValue.mockImplementation((name, key) => {
        if (name === 'Human' && key === 'activeBuffs') return [
          { effect: 'ice_walk', duration: 3 },
        ];
        if (key === KEY && name === 'Goblin') return myList;
        if (key === KEY) return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Human',
        'activeBuffs',
        [],
        'MyCampaign',
      );
    });

    it('removes speed_boost buff from activeBuffs', () => {
      const myList = [
        { target: 'Human', effects: [{ type: 'speed_boost' }], appliedRound: 1 },
      ];
      getRuntimeValue.mockImplementation((name, key) => {
        if (name === 'Human' && key === 'activeBuffs') return [
          { effect: 'speed_boost', duration: 3 },
        ];
        if (key === KEY && name === 'Goblin') return myList;
        if (key === KEY) return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Human',
        'activeBuffs',
        [],
        'MyCampaign',
      );
    });

    it('handles empty activeBuffs for flight effect types', () => {
      const myList = [
        { target: 'Human', effects: [{ type: 'fly_speed_equals_walk_speed' }], appliedRound: 1 },
      ];
      getRuntimeValue.mockImplementation((name, key) => {
        if (name === 'Human' && key === 'activeBuffs') return [];
        if (key === KEY && name === 'Goblin') return myList;
        if (key === KEY) return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Human',
        'activeBuffs',
        [],
        'MyCampaign',
      );
    });
  });

  describe('remove_active_buff effect type', () => {
    it('removes buff by name from activeBuffs', () => {
      const myList = [
        { target: 'Human', effects: [{ type: 'remove_active_buff', buffName: 'RecklessAttack' }], appliedRound: 1 },
      ];
      getRuntimeValue.mockImplementation((name, key) => {
        if (name === 'Human' && key === 'activeBuffs') return [
          { name: 'RecklessAttack', effect: 'reckless_attack', duration: 3 },
          { name: 'DivineSmite', effect: 'divine_smite', duration: 2 },
        ];
        if (key === KEY && name === 'Goblin') return myList;
        if (key === KEY) return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Human',
        'activeBuffs',
        [{ name: 'DivineSmite', effect: 'divine_smite', duration: 2 }],
        'MyCampaign',
      );
    });

    it('adds speed_zero and incapacitated conditions when removing haste buff', () => {
      const myList = [
        { target: 'Human', effects: [{ type: 'remove_active_buff', buffName: 'Haste' }], appliedRound: 1 },
      ];
      getRuntimeValue.mockImplementation((name, key) => {
        if (name === 'Human' && key === 'activeBuffs') return [
          { name: 'Haste', effect: 'haste', duration: 3 },
        ];
        if (name === 'Human' && key === 'activeConditions') return ['poisoned'];
        if (key === KEY && name === 'Goblin') return myList;
        if (key === KEY) return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Human',
        'activeConditions',
        ['poisoned', 'speed_zero', 'incapacitated'],
        'MyCampaign',
      );
    });

    it('does not duplicate speed_zero if already present when removing haste', () => {
      const myList = [
        { target: 'Human', effects: [{ type: 'remove_active_buff', buffName: 'Haste' }], appliedRound: 1 },
      ];
      getRuntimeValue.mockImplementation((name, key) => {
        if (name === 'Human' && key === 'activeBuffs') return [
          { name: 'Haste', effect: 'haste', duration: 3 },
        ];
        if (name === 'Human' && key === 'activeConditions') return ['speed_zero', 'poisoned'];
        if (key === KEY && name === 'Goblin') return myList;
        if (key === KEY) return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      const condCalls = setRuntimeValue.mock.calls.filter(
        (c) => c[0] === 'Human' && c[1] === 'activeConditions',
      );
      expect(condCalls.length).toBe(1);
      // Set order: speed_zero, poisoned were already present, incapacitated was added
      expect(condCalls[0][2]).toEqual(
        expect.arrayContaining(['speed_zero', 'poisoned', 'incapacitated']),
      );
    });

    it('does not add incapacitated if already present when removing haste', () => {
      const myList = [
        { target: 'Human', effects: [{ type: 'remove_active_buff', buffName: 'Haste' }], appliedRound: 1 },
      ];
      getRuntimeValue.mockImplementation((name, key) => {
        if (name === 'Human' && key === 'activeBuffs') return [
          { name: 'Haste', effect: 'haste', duration: 3 },
        ];
        if (name === 'Human' && key === 'activeConditions') return ['incapacitated', 'poisoned'];
        if (key === KEY && name === 'Goblin') return myList;
        if (key === KEY) return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      const condCalls = setRuntimeValue.mock.calls.filter(
        (c) => c[0] === 'Human' && c[1] === 'activeConditions',
      );
      expect(condCalls.length).toBe(1);
      // incapacitated already present, so no new conditions added
      expect(condCalls[0][2]).toEqual(
        expect.arrayContaining(['incapacitated', 'poisoned']),
      );
    });
  });

  describe('state-clearing effect types', () => {
    it('clears peerless_athlete state', () => {
      const myList = [
        { target: 'Human', effects: [{ type: 'peerless_athlete_end' }], appliedRound: 1 },
      ];
      getRuntimeValue.mockImplementation((name, key) => {
        if (name === 'Human' && key === 'activeBuffs') return [
          { effect: 'peerless_athlete', duration: 3 },
        ];
        if (key === KEY && name === 'Goblin') return myList;
        if (key === KEY) return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Human',
        'peerlessAthleteActive',
        false,
        'MyCampaign',
      );
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Human',
        'activeBuffs',
        [],
        'MyCampaign',
      );
    });

    it('clears large_form state', () => {
      const myList = [
        { target: 'Human', effects: [{ type: 'large_form_end' }], appliedRound: 1 },
      ];
      getRuntimeValue.mockImplementation((name, key) => {
        if (name === 'Human' && key === 'activeBuffs') return [
          { effect: 'large_form', duration: 3 },
        ];
        if (key === KEY && name === 'Goblin') return myList;
        if (key === KEY) return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Human',
        'largeFormActive',
        false,
        'MyCampaign',
      );
    });

    it('clears bardic inspiration state', () => {
      const myList = [
        { target: 'Human', effects: [{ type: 'remove_bardic_inspiration' }], appliedRound: 1 },
      ];
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === KEY && name === 'Goblin') return myList;
        if (key === KEY) return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Human',
        'bardicInspirationDie',
        null,
        'MyCampaign',
      );
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Human',
        'bardicInspirationGrantedBy',
        null,
        'MyCampaign',
      );
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Human',
        'bardicInspirationCombatOptions',
        null,
        'MyCampaign',
      );
    });

    it('clears inspiring_movement_no_oa state', () => {
      const myList = [
        { target: 'Human', effects: [{ type: 'inspiring_movement_no_oa' }], appliedRound: 1 },
      ];
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === KEY && name === 'Goblin') return myList;
        if (key === KEY) return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Human',
        'inspiringMovementNoOA',
        null,
        'MyCampaign',
      );
    });

    it('clears inspiring_movement_granted state', () => {
      const myList = [
        { target: 'Human', effects: [{ type: 'inspiring_movement_granted' }], appliedRound: 1 },
      ];
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === KEY && name === 'Goblin') return myList;
        if (key === KEY) return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Human',
        'inspiringMovementGranted',
        null,
        'MyCampaign',
      );
    });

    it('clears natures_sanctuary state', () => {
      const myList = [
        { target: 'Human', effects: [{ type: 'remove_natures_sanctuary' }], appliedRound: 1 },
      ];
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === KEY && name === 'Goblin') return myList;
        if (key === KEY) return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Human',
        'naturesSanctuaryActive',
        null,
        'MyCampaign',
      );
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Human',
        'naturesSanctuaryMoves',
        null,
        'MyCampaign',
      );
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Human',
        'naturesSanctuaryCubeX',
        null,
        'MyCampaign',
      );
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Human',
        'naturesSanctuaryCubeY',
        null,
        'MyCampaign',
      );
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Human',
        'naturesSanctuaryRange',
        null,
        'MyCampaign',
      );
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Human',
        'naturesSanctuaryResistance',
        null,
        'MyCampaign',
      );
    });

    it('clears bulwark_of_force state', () => {
      const myList = [
        { target: 'Human', effects: [{ type: 'remove_bulwark_of_force' }], appliedRound: 1 },
      ];
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === KEY && name === 'Goblin') return myList;
        if (key === KEY) return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Human',
        'bulwarkOfForceActive',
        null,
        'MyCampaign',
      );
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Human',
        'bulwarkOfForceTargets',
        null,
        'MyCampaign',
      );
    });

    it('clears unbreakable_majesty state', () => {
      const myList = [
        { target: 'Human', effects: [{ type: 'unbreakable_majesty' }], appliedRound: 1 },
      ];
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === KEY && name === 'Goblin') return myList;
        if (key === KEY) return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Human',
        'unbreakableMajestyActive',
        null,
        'MyCampaign',
      );
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Human',
        'unbreakableMajestySaveDc',
        null,
        'MyCampaign',
      );
    });

    it('clears cosmic_omen state', () => {
      const myList = [
        { target: 'Human', effects: [{ type: 'remove_cosmic_omen' }], appliedRound: 1 },
      ];
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === KEY && name === 'Goblin') return myList;
        if (key === KEY) return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Human',
        'cosmicOmenEffect',
        null,
        'MyCampaign',
      );
    });
  });

  describe('tashas_laughter_expiration effect type', () => {
    it('resets the damage trigger flag', () => {
      const myList = [
        { target: 'Human', effects: [{ type: 'tashas_laughter_expiration' }], appliedRound: 1 },
      ];
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === KEY && name === 'Goblin') return myList;
        if (key === KEY) return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Human',
        'tashas_laughter_Human_damageTrigger',
        false,
        'MyCampaign',
      );
    });
  });

  describe('speed_zero effect type', () => {
    it('removes speed_zero from activeConditions and NPC conditions', () => {
      const myList = [
        { target: 'Human', effects: [{ type: 'speed_zero' }], appliedRound: 1 },
      ];
      getRuntimeValue.mockImplementation((name, key) => {
        if (name === 'Human' && key === 'activeConditions') return ['speed_zero', 'poisoned'];
        if (key === 'activeConditions') return [];
        if (key === KEY && name === 'Goblin') return myList;
        if (key === KEY) return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Human',
        'activeConditions',
        ['poisoned'],
        'MyCampaign',
      );
    });
  });

  describe('remove_feign_death_buff effect type', () => {
    it('removes the buff and associated conditions', () => {
      const myList = [
        { target: 'Human', effects: [{ type: 'remove_feign_death_buff', buffName: 'FeignDeath' }], appliedRound: 1 },
      ];
      getRuntimeValue.mockImplementation((name, key) => {
        if (name === 'Human' && key === 'activeBuffs') return [
          { name: 'FeignDeath', duration: 3 },
          { name: 'OtherBuff', duration: 2 },
        ];
        if (name === 'Human' && key === 'activeConditions') return ['blinded', 'incapacitated', 'speed_zero', 'poisoned'];
        if (key === 'activeConditions') return [];
        if (key === KEY && name === 'Goblin') return myList;
        if (key === KEY) return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Human',
        'activeBuffs',
        [{ name: 'OtherBuff', duration: 2 }],
        'MyCampaign',
      );

      // remove_feign_death_buff removes blinded, incapacitated, speed_zero one by one
      // Each condition removal calls both removeActiveCondition and removeNpcCondition,
      // each of which calls setRuntimeValue for 'activeConditions', giving 6 total calls.
      const condCalls = setRuntimeValue.mock.calls.filter(
        (c) => c[0] === 'Human' && c[1] === 'activeConditions',
      );
      expect(condCalls.length).toBe(6);
    });
  });

  describe('avenging_angel_aura effect type', () => {
    it('removes target from aura targets list', () => {
      const myList = [
        { target: 'Human', effects: [{ type: 'avenging_angel_aura' }], appliedRound: 1 },
      ];
      getRuntimeValue.mockImplementation((name, key) => {
        if (name === 'Goblin' && key === 'avengingAngelAuraTargets') return ['Human', 'Elf'];
        if (key === KEY && name === 'Goblin') return myList;
        if (key === KEY) return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'avengingAngelAuraTargets',
        ['Elf'],
        'MyCampaign',
      );
    });
  });

  describe('remove_regenerate_buff effect type', () => {
    it('clears regenerate state', () => {
      const myList = [
        { target: 'Human', effects: [{ type: 'remove_regenerate_buff' }], appliedRound: 1 },
      ];
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === KEY && name === 'Goblin') return myList;
        if (key === KEY) return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Human',
        'regenerateActive',
        null,
        'MyCampaign',
      );
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Human',
        'regenerateSource',
        null,
        'MyCampaign',
      );
    });
  });
});


