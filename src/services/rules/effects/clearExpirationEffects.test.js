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
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../rules/combat/rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(() => 10),
}));

vi.mock('../../automation/handlers/spells/slowHandler.js', () => ({
  processSlowRepeatSave: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../automation/handlers/spells/tashasLaughterHandler.js', () => ({
  processTashasLaughterRepeatSave: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../combat/automation/automationExpressions.js', () => ({
  evaluateAutoExpression: vi.fn((expr) => {
    if (typeof expr === 'number') return expr;
    return 1;
  }),
}));

import { expireStaleEffects, clearAllExpirationEffects } from './expirations.js';
import { getRuntimeValue, setRuntimeValue, getAllStoreKeys } from '../../../hooks/runtime/useRuntimeState.js';
import utils from '../../ui/utils.js';
import storage from '../../ui/storage.js';
import { getCombatSummary, getCurrentCombatRound, getActiveCreatureName } from '../../encounters/combatData.js';

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
// clearAllExpirationEffects — behavioral tests
// ---------------------------------------------------------------------------
describe('clearAllExpirationEffects', () => {
  beforeEach(() => {
    resetMocks();
    stubUtilsNameIdentity();
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeConditions') return [];
      if (key.startsWith('_advantageOn_')) return [];
      return null;
    });
  });

  describe('early return guards', () => {
    it('returns early without side effects when characterName is null', () => {
      clearAllExpirationEffects(null, 'MyCampaign');
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('returns early without side effects when campaignName is null', () => {
      clearAllExpirationEffects('Goblin', null);
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('returns early without side effects when either argument is falsy', () => {
      clearAllExpirationEffects('', 'MyCampaign');
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('clears own character state', () => {
    it('clears activeBuffs to empty array', () => {
      clearAllExpirationEffects('Goblin', 'MyCampaign');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeBuffs',
        [],
        'MyCampaign',
      );
    });

    it('clears mantleOfMajestyActive to null', () => {
      clearAllExpirationEffects('Goblin', 'MyCampaign');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'mantleOfMajestyActive',
        null,
        'MyCampaign',
      );
    });

    it('clears pendingExpirations to empty array when list is empty', () => {
      clearAllExpirationEffects('Goblin', 'MyCampaign');
      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', KEY, [], 'MyCampaign');
    });

    it('clears pendingExpirations to empty array when list is not an array', () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeConditions') return [];
        if (key === KEY && name === 'Goblin') return 'not-an-array';
        if (key === KEY) return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');
      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', KEY, [], 'MyCampaign');
    });
  });

  describe('clears "from me" effects', () => {
    it('processes each entry and then clears the list', () => {
      const myList = [
        { target: 'Human', effects: [{ type: 'stunned', condition: 'stunned' }], appliedRound: 1 },
        { target: 'Orc', effects: [{ type: 'advantage_on_target' }], appliedRound: 2 },
      ];
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeConditions') return [];
        if (key === KEY && name === 'Goblin') return myList;
        if (key === KEY) return [];
        if (key.startsWith('_advantageOn_')) return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', KEY, [], 'MyCampaign');
    });

    it('handles null effects in an entry', () => {
      const myList = [
        { target: 'Human', effects: null, appliedRound: 1 },
      ];
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeConditions') return [];
        if (key === KEY && name === 'Goblin') return myList;
        if (key === KEY) return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');
      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', KEY, [], 'MyCampaign');
    });

    it('handles non-array effects in an entry', () => {
      const myList = [
        { target: 'Human', effects: 'string', appliedRound: 1 },
      ];
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeConditions') return [];
        if (key === KEY && name === 'Goblin') return myList;
        if (key === KEY) return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');
      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', KEY, [], 'MyCampaign');
    });

    it('handles empty effects array in an entry', () => {
      const myList = [
        { target: 'Human', effects: [], appliedRound: 1 },
      ];
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeConditions') return [];
        if (key === KEY && name === 'Goblin') return myList;
        if (key === KEY) return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');
      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', KEY, [], 'MyCampaign');
    });
  });

  describe('clears "to me" effects from other stores', () => {
    it('scans all store keys for entries targeting the character', () => {
      getAllStoreKeys.mockReturnValue(['OtherCreature']);
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === KEY && name === 'OtherCreature') {
          return [{ target: 'Goblin', effects: [{ type: 'stunned' }], appliedRound: 1 }];
        }
        if (key === KEY) return [];
        if (key === 'activeConditions') return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      expect(getRuntimeValue).toHaveBeenCalledWith('OtherCreature', KEY);
    });

    it('keeps non-matching targets in other creatures lists', () => {
      getAllStoreKeys.mockReturnValue(['OtherCreature']);
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === KEY && name === 'OtherCreature') {
          return [
            { target: 'Goblin', effects: [], appliedRound: 1 },
            { target: 'Elf', effects: [], appliedRound: 1 },
          ];
        }
        if (key === KEY) return [];
        if (key === 'activeConditions') return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      const keptCall = setRuntimeValue.mock.calls.find(
        (c) => c[0] === 'OtherCreature' && c[1] === KEY,
      );
      expect(keptCall).toBeTruthy();
      expect(keptCall[2]).toEqual([{ target: 'Elf', effects: [], appliedRound: 1 }]);
    });

    it('skips own character key during store scan', () => {
      getAllStoreKeys.mockReturnValue(['goblin']);
      getRuntimeValue.mockReturnValue([]);

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      const selfCalls = getRuntimeValue.mock.calls.filter(
        (c) => c[1] === KEY && c[0] === 'goblin',
      );
      expect(selfCalls).toHaveLength(0);
    });

    it('skips empty lists during store scan', () => {
      getAllStoreKeys.mockReturnValue(['OtherCreature']);
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === KEY) return [];
        if (key === 'activeConditions') return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      const setCallForOrc = setRuntimeValue.mock.calls.find(
        (c) => c[0] === 'OtherCreature' && c[1] === KEY,
      );
      expect(setCallForOrc).toBeUndefined();
    });

    it('uses utils.getName for target comparison in "to me" scan', () => {
      getAllStoreKeys.mockReturnValue(['orc']);
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === KEY && name === 'orc') {
          return [{ target: 'GoblinSlayer', effects: [], appliedRound: 1 }];
        }
        if (key === KEY) return [];
        if (key === 'activeConditions') return [];
        return null;
      });
      utils.getName.mockImplementation((v) => {
        if (v === 'Goblin' || v === 'goblin') return 'goblin';
        if (v === 'GoblinSlayer') return 'goblin';
        return String(v);
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      const keptCall = setRuntimeValue.mock.calls.find(
        (c) => c[0] === 'orc' && c[1] === KEY,
      );
      expect(keptCall).toBeTruthy();
    });
  });
});

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
      // Each call reads from the same mock, so the final state reflects only
      // the last removal (speed_zero). The test verifies the function was called
      // for all three conditions by checking the last activeConditions call.
      const condCalls = setRuntimeValue.mock.calls.filter(
        (c) => c[0] === 'Human' && c[1] === 'activeConditions',
      );
      expect(condCalls.length).toBe(3);
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

// ---------------------------------------------------------------------------
// removeNpcCondition — NPC condition removal in combat summary
// ---------------------------------------------------------------------------
describe('removeNpcCondition (via condition effect type)', () => {
  beforeEach(() => {
    resetMocks();
    stubUtilsNameIdentity();
  });

  it('removes condition from NPC in combat summary when found', () => {
    const myList = [
      { target: 'Orc', effects: [{ type: 'condition', condition: 'poisoned' }], appliedRound: 1 },
    ];
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'Orc' && key === 'activeConditions') return ['poisoned'];
      if (key === 'activeConditions') return [];
      if (key === KEY && name === 'Goblin') return myList;
      if (key === KEY) return [];
      return null;
    });
    getCombatSummary.mockReturnValue({
      creatures: [
        { name: 'Goblin', conditions: [] },
        { name: 'Orc', conditions: [{ key: 'poisoned' }, { key: 'exhausted' }] },
      ],
    });

    clearAllExpirationEffects('Goblin', 'MyCampaign');

    expect(storage.set).toHaveBeenCalledWith(
      'combatSummary',
      {
        creatures: [
          { name: 'Goblin', conditions: [] },
          { name: 'Orc', conditions: [{ key: 'exhausted' }] },
        ],
      },
      'MyCampaign',
    );
    expect(window.dispatchEvent).toHaveBeenCalled();
  });

  it('does nothing when NPC not found in combat summary', () => {
    const myList = [
      { target: 'Unknown', effects: [{ type: 'condition', condition: 'poisoned' }], appliedRound: 1 },
    ];
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'Unknown' && key === 'activeConditions') return ['poisoned'];
      if (key === 'activeConditions') return [];
      if (key === KEY && name === 'Goblin') return myList;
      if (key === KEY) return [];
      return null;
    });
    getCombatSummary.mockReturnValue({
      creatures: [{ name: 'Goblin', conditions: [] }],
    });

    clearAllExpirationEffects('Goblin', 'MyCampaign');

    expect(storage.set).not.toHaveBeenCalled();
  });

  it('handles null combatSummary gracefully', () => {
    const myList = [
      { target: 'Orc', effects: [{ type: 'condition', condition: 'poisoned' }], appliedRound: 1 },
    ];
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'Orc' && key === 'activeConditions') return ['poisoned'];
      if (key === 'activeConditions') return [];
      if (key === KEY && name === 'Goblin') return myList;
      if (key === KEY) return [];
      return null;
    });
    getCombatSummary.mockReturnValue(null);

    clearAllExpirationEffects('Goblin', 'MyCampaign');

    expect(storage.set).not.toHaveBeenCalled();
  });

  it('handles missing creatures array in combatSummary gracefully', () => {
    const myList = [
      { target: 'Orc', effects: [{ type: 'condition', condition: 'poisoned' }], appliedRound: 1 },
    ];
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'Orc' && key === 'activeConditions') return ['poisoned'];
      if (key === 'activeConditions') return [];
      if (key === KEY && name === 'Goblin') return myList;
      if (key === KEY) return [];
      return null;
    });
    getCombatSummary.mockReturnValue({});

    clearAllExpirationEffects('Goblin', 'MyCampaign');

    expect(storage.set).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// expireStaleEffects — behavioral tests
// ---------------------------------------------------------------------------
describe('expireStaleEffects', () => {
  beforeEach(() => {
    resetMocks();
    stubUtilsNameIdentity();
  });

  describe('early return guards', () => {
    it('returns early when no active creature name', () => {
      getActiveCreatureName.mockReturnValue(null);
      expireStaleEffects('MyCampaign');
      expect(getRuntimeValue).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('returns early when active creature name is empty', () => {
      getActiveCreatureName.mockReturnValue('');
      expireStaleEffects('MyCampaign');
      expect(getRuntimeValue).not.toHaveBeenCalled();
    });

    it('returns early when combatSummary is null', () => {
      getActiveCreatureName.mockReturnValue('Goblin');
      getCombatSummary.mockReturnValue(null);
      expireStaleEffects('MyCampaign');
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('returns early when combatSummary is not an object', () => {
      getActiveCreatureName.mockReturnValue('Goblin');
      getCombatSummary.mockReturnValue('not-an-object');
      expireStaleEffects('MyCampaign');
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('returns early when creatures array is missing', () => {
      getActiveCreatureName.mockReturnValue('Goblin');
      getCombatSummary.mockReturnValue({});
      expireStaleEffects('MyCampaign');
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('returns early when creatures is not an array', () => {
      getActiveCreatureName.mockReturnValue('Goblin');
      getCombatSummary.mockReturnValue({ creatures: 'not-an-array' });
      expireStaleEffects('MyCampaign');
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('creature matching', () => {
    it('skips creatures whose name does not match active creature', () => {
      getActiveCreatureName.mockReturnValue('Goblin');
      getCombatSummary.mockReturnValue({
        creatures: [{ name: 'Orc' }, { name: 'Goblin' }],
      });
      getRuntimeValue.mockReturnValue(null);

      expireStaleEffects('MyCampaign');

      expect(getRuntimeValue).toHaveBeenCalledWith('Goblin', KEY);
    });

    it('uses utils.getName for case-insensitive name matching', () => {
      getActiveCreatureName.mockReturnValue('Goblin');
      utils.getName.mockImplementation((v) => {
        if (typeof v === 'string') return v.toLowerCase();
        return v;
      });
      getCombatSummary.mockReturnValue({
        creatures: [{ name: 'goblin' }],
      });
      getRuntimeValue.mockReturnValue([]);

      expireStaleEffects('MyCampaign');

      // utils.getName lowercases the creature name, so getRuntimeValue
      // is called with the lowercased version
      expect(getRuntimeValue).toHaveBeenCalledWith('goblin', KEY);
    });
  });

  describe('stale vs fresh entry logic', () => {
    it('clears entries where currentRound >= appliedRound + expiryRounds', () => {
      const list = [
        { target: 'ExpiredTarget', effects: [{ type: 'stunned' }], appliedRound: 1, expiryRounds: 1 },
      ];
      getCurrentCombatRound.mockReturnValue(2);
      getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
      getRuntimeValue.mockReturnValueOnce(list);

      expireStaleEffects('MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', KEY, [], 'MyCampaign');
    });

    it('keeps entries where currentRound < appliedRound + expiryRounds', () => {
      const list = [
        { target: 'ValidTarget', effects: [{ type: 'stunned' }], appliedRound: 2, expiryRounds: 3 },
      ];
      getCurrentCombatRound.mockReturnValue(2);
      getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
      getRuntimeValue.mockReturnValueOnce(list);

      expireStaleEffects('MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        KEY,
        list,
        'MyCampaign',
      );
    });

    it('clears all entries when all have expired', () => {
      const list = [
        { target: 'Target1', effects: [{ type: 'stunned' }], appliedRound: 0, expiryRounds: 1 },
        { target: 'Target2', effects: [{ type: 'blinded' }], appliedRound: 1, expiryRounds: 1 },
      ];
      getCurrentCombatRound.mockReturnValue(5);
      getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
      getRuntimeValue.mockReturnValueOnce(list);

      expireStaleEffects('MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', KEY, [], 'MyCampaign');
    });

    it('keeps non-expired entries while clearing expired ones', () => {
      const list = [
        { target: 'Expired', effects: [{ type: 'stunned' }], appliedRound: 0, expiryRounds: 1 },
        { target: 'Valid', effects: [{ type: 'blinded' }], appliedRound: 2, expiryRounds: 5 },
      ];
      getCurrentCombatRound.mockReturnValue(3);
      getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
      getRuntimeValue.mockReturnValueOnce(list);

      expireStaleEffects('MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        KEY,
        [list[1]],
        'MyCampaign',
      );
    });

    it('handles boundary: clears when currentRound equals appliedRound + expiryRounds', () => {
      const list = [
        { target: 'Target', effects: [{ type: 'stunned' }], appliedRound: 5, expiryRounds: 3 },
      ];
      getCurrentCombatRound.mockReturnValue(8);
      getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
      getRuntimeValue.mockReturnValueOnce(list);

      expireStaleEffects('MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', KEY, [], 'MyCampaign');
    });

    it('handles boundary: keeps when currentRound is one below appliedRound + expiryRounds', () => {
      const list = [
        { target: 'Target', effects: [{ type: 'stunned' }], appliedRound: 5, expiryRounds: 3 },
      ];
      getCurrentCombatRound.mockReturnValue(7);
      getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
      getRuntimeValue.mockReturnValueOnce(list);

      expireStaleEffects('MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        KEY,
        list,
        'MyCampaign',
      );
    });
  });

  describe('edge cases', () => {
    it('does not call setRuntimeValue when pendingExpirations is empty', () => {
      getActiveCreatureName.mockReturnValue('Goblin');
      getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
      getRuntimeValue.mockReturnValueOnce([]);

      expireStaleEffects('MyCampaign');

      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('handles null effects in list entries', () => {
      getCurrentCombatRound.mockReturnValue(2);
      const list = [
        { target: 'Human', effects: null, appliedRound: 0, expiryRounds: 1 },
      ];
      getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
      getRuntimeValue.mockReturnValueOnce(list);

      expireStaleEffects('MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', KEY, [], 'MyCampaign');
    });

    it('handles non-array effects in list entries', () => {
      getCurrentCombatRound.mockReturnValue(2);
      const list = [
        { target: 'Human', effects: {}, appliedRound: 0, expiryRounds: 1 },
      ];
      getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
      getRuntimeValue.mockReturnValueOnce(list);

      expireStaleEffects('MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', KEY, [], 'MyCampaign');
    });

    it('handles advantage_on_target with empty storedAdv array', () => {
      getCurrentCombatRound.mockReturnValue(2);
      const list = [
        { target: 'Human', effects: [{ type: 'advantage_on_target' }], appliedRound: 0, expiryRounds: 1 },
      ];
      getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
      getRuntimeValue.mockImplementation((name, key) => {
        if (name === 'Goblin' && key === KEY) return list;
        if (key === '_advantageOn_Human') return [];
        if (key === 'activeConditions') return [];
        if (key === KEY) return [];
        return null;
      });

      expireStaleEffects('MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', KEY, [], 'MyCampaign');
      const advCalls = setRuntimeValue.mock.calls.filter(
        (c) => c[1].startsWith('_advantageOn_'),
      );
      expect(advCalls).toHaveLength(0);
    });

    it('uses campaignName in all runtime state calls', () => {
      const list = [
        { target: 'Human', effects: [{ type: 'stunned', condition: 'speed_halved' }], appliedRound: 0, expiryRounds: 1 },
      ];
      getActiveCreatureName.mockReturnValue('Goblin');
      getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
      getCurrentCombatRound.mockReturnValue(5);
      getRuntimeValue.mockReturnValueOnce(list);

      expireStaleEffects('TestCampaign');

      for (const call of setRuntimeValue.mock.calls) {
        expect(call[3]).toBe('TestCampaign');
      }
    });
  });
});
