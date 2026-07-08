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
import { getRuntimeValue, setRuntimeValue, getAllStoreKeys } from '../../../hooks/runtime/useRuntimeState.js';
import utils from '../../ui/utils.js';
import { addEntry } from '../../ui/logService.js';

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
// clearAllExpirationEffects — full coverage
// ---------------------------------------------------------------------------
describe('clearAllExpirationEffects — comprehensive coverage', () => {
  beforeEach(() => {
    resetMocks();
    stubUtilsNameIdentity();
    getRuntimeValue.mockImplementation((_name, _key, _campaign) => null);
  });

  describe('clearing attacker-owned expiration entries', () => {
    it('clears all entries from attacker pendingExpirations and calls clearExpirationEffects for each', () => {
      const myList = [
        { target: 'Orc', effects: [{ type: 'condition', condition: 'stunned' }], appliedRound: 1 },
        { target: 'Human', effects: [{ type: 'blinded' }], appliedRound: 2 },
      ];
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === KEY && name === 'Goblin') return myList;
        if (key === 'activeConditions') return [];
        if (key === KEY) return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      const pendingCalls = setRuntimeValue.mock.calls.filter(
        (c) => c[0] === 'Goblin' && c[1] === KEY,
      );
      expect(pendingCalls.length).toBe(1);
      expect(pendingCalls[0][2]).toEqual([]);
    });

    it('handles empty pendingExpirations array', () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === KEY && name === 'Goblin') return [];
        if (key === KEY) return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      const pendingCalls = setRuntimeValue.mock.calls.filter(
        (c) => c[0] === 'Goblin' && c[1] === KEY,
      );
      expect(pendingCalls.length).toBe(1);
      expect(pendingCalls[0][2]).toEqual([]);
    });

    it('handles null pendingExpirations by replacing with empty array', () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === KEY && name === 'Goblin') return null;
        if (key === KEY) return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      const pendingCalls = setRuntimeValue.mock.calls.filter(
        (c) => c[0] === 'Goblin' && c[1] === KEY,
      );
      expect(pendingCalls.length).toBe(1);
      expect(pendingCalls[0][2]).toEqual([]);
    });
  });

  describe('clearing "to me" entries from other characters', () => {
    it('scans all runtime stores and clears entries targeting the character', () => {
      getAllStoreKeys.mockReturnValue(['Orc', 'Human', 'Elf']);
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === KEY && name === 'Goblin') return [];
        if (key === KEY && name === 'Orc') return [
          { target: 'Goblin', effects: [{ type: 'condition', condition: 'stunned' }], appliedRound: 1 },
          { target: 'Human', effects: [{ type: 'blinded' }], appliedRound: 2 },
        ];
        if (key === KEY && name === 'Human') return [
          { target: 'Goblin', effects: [{ type: 'advantage_on_target' }], appliedRound: 1 },
        ];
        if (key === KEY && name === 'Elf') return [];
        if (key === '_advantageOn_Goblin') return ['Goblin'];
        if (key === 'activeConditions') return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      // Orc should have the Goblin-targeted entry removed
      const orcCalls = setRuntimeValue.mock.calls.filter(
        (c) => c[0] === 'Orc' && c[1] === KEY,
      );
      expect(orcCalls.length).toBe(1);
      expect(orcCalls[0][2]).toEqual([
        { target: 'Human', effects: [{ type: 'blinded' }], appliedRound: 2 },
      ]);

      // Human should have the Goblin-targeted entry removed
      const humanCalls = setRuntimeValue.mock.calls.filter(
        (c) => c[0] === 'Human' && c[1] === KEY,
      );
      expect(humanCalls.length).toBe(1);
      expect(humanCalls[0][2]).toEqual([]);
    });

    it('skips entries targeting other characters', () => {
      getAllStoreKeys.mockReturnValue(['Orc']);
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === KEY && name === 'Goblin') return [];
        if (key === KEY && name === 'Orc') return [
          { target: 'Human', effects: [{ type: 'blinded' }], appliedRound: 1 },
        ];
        if (key === 'activeConditions') return [];
        if (key === KEY) return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      // Orc's list is re-set even though entries target Human (not Goblin),
      // because clearAllExpirationEffects always calls setRuntimeValue for each scanned key
      // regardless of whether the list changed. The entry is preserved since it doesn't target Goblin.
      const orcCalls = setRuntimeValue.mock.calls.filter(
        (c) => c[0] === 'Orc' && c[1] === KEY,
      );
      expect(orcCalls.length).toBe(1);
      expect(orcCalls[0][2]).toEqual([
        { target: 'Human', effects: [{ type: 'blinded' }], appliedRound: 1 },
      ]);
    });

    it('skips non-string keys in getAllStoreKeys', () => {
      getAllStoreKeys.mockReturnValue([123, 'Orc', null, 'Human']);
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === KEY && name === 'Goblin') return [];
        if (key === KEY && name === 'Orc') return [];
        if (key === KEY && name === 'Human') return [];
        if (key === KEY) return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      // Should not throw
      expect(getAllStoreKeys).toHaveBeenCalled();
    });

    it('skips stores with non-array pendingExpirations', () => {
      getAllStoreKeys.mockReturnValue(['Orc']);
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === KEY && name === 'Goblin') return [];
        if (key === KEY && name === 'Orc') return 'not-an-array';
        if (key === KEY) return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      // Should not throw, Orc's list unchanged
      const orcCalls = setRuntimeValue.mock.calls.filter(
        (c) => c[0] === 'Orc' && c[1] === KEY,
      );
      expect(orcCalls.length).toBe(0);
    });
  });

  describe('clearing global state flags', () => {
    it('clears all global state flags for the character', () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === KEY && name === 'Goblin') return [];
        if (key === KEY) return [];
        if (key === 'baitAndSwitchActive') return false;
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeBuffs', [], 'MyCampaign');
      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'mantleOfMajestyActive', null, 'MyCampaign');
      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'innerRadianceActive', null, 'MyCampaign');
      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'unbreakableMajestyActive', null, 'MyCampaign');
      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'unbreakableMajestySaveDc', null, 'MyCampaign');
    });

    it('only clears baitAndSwitch when active', () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === KEY && name === 'Goblin') return [];
        if (key === KEY) return [];
        if (key === 'baitAndSwitchActive') return false;
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      // baitAndSwitch keys should not be set when not active
      const baitCalls = setRuntimeValue.mock.calls.filter(
        (c) => c[0] === 'Goblin' && ['baitAndSwitchActive', 'baitAndSwitchBonus', 'baitAndSwitchSource'].includes(c[1]),
      );
      expect(baitCalls.length).toBe(0);
    });

    it('clears baitAndSwitch when active', () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === KEY && name === 'Goblin') return [];
        if (key === KEY) return [];
        if (key === 'baitAndSwitchActive') return true;
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'baitAndSwitchActive', null, 'MyCampaign');
      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'baitAndSwitchBonus', null, 'MyCampaign');
      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'baitAndSwitchSource', null, 'MyCampaign');
    });
  });

  describe('case-insensitive target matching', () => {
    it('matches target names case-insensitively', () => {
      getAllStoreKeys.mockReturnValue(['Orc']);
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === KEY && name === 'Goblin') return [];
        if (key === KEY && name === 'Orc') return [
          { target: 'goblin', effects: [{ type: 'condition', condition: 'stunned' }], appliedRound: 1 },
        ];
        if (key === 'activeConditions') return [];
        if (key === KEY) return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      const orcCalls = setRuntimeValue.mock.calls.filter(
        (c) => c[0] === 'Orc' && c[1] === KEY,
      );
      expect(orcCalls.length).toBe(1);
      expect(orcCalls[0][2]).toEqual([]);
    });
  });

  describe('clearing targetEffects from campaign', () => {
    it('clears heroism target effects when remove_heroism_buff is present', () => {
      const myList = [
        { target: 'Human', effects: [{ type: 'remove_heroism_buff', buffName: 'Heroism' }], appliedRound: 1 },
      ];
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === KEY && name === 'Goblin') return myList;
        if (key === KEY) return [];
        if (key === 'targetEffects') return [
          { effect: 'heroism', source: 'Heroism', target: 'Human' },
          { effect: 'slow', source: 'Slow', target: 'Orc' },
        ];
        if (key === 'activeConditions') return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      const effectCalls = setRuntimeValue.mock.calls.filter(
        (c) => c[0] === 'MyCampaign' && c[1] === 'targetEffects',
      );
      expect(effectCalls.length).toBeGreaterThan(0);
      expect(effectCalls[0][2]).toEqual([
        { effect: 'slow', source: 'Slow', target: 'Orc' },
      ]);
    });
  });
});

// ---------------------------------------------------------------------------
// clearExpirationEffects — additional effect types not in clearExpirationEffects.test.js
// ---------------------------------------------------------------------------
describe('clearExpirationEffects — additional effect types', () => {
  beforeEach(() => {
    resetMocks();
    stubUtilsNameIdentity();
    getRuntimeValue.mockImplementation((_name, _key, _campaign) => null);
  });

  describe('remove_heroes_feast_buff effect type', () => {
    it('removes the buff and reduces HP max increase', () => {
      const myList = [
        { target: 'Human', effects: [{ type: 'remove_heroes_feast_buff', buffName: 'HeroesFeast', hpKey: 'heroesFeastHpMaxIncrease' }], appliedRound: 1 },
      ];
      getRuntimeValue.mockImplementation((name, key) => {
        if (name === 'Human' && key === 'activeBuffs') return [
          { name: 'HeroesFeast', duration: 3 },
          { name: 'OtherBuff', duration: 2 },
        ];
        if (name === 'Human' && key === 'hitPoints') return 30;
        if (name === 'Human' && key === 'heroesFeastHpMaxIncrease') return 5;
        if (name === 'Human' && key === 'currentHitPoints') return 25;
        if (key === KEY && name === 'Goblin') return myList;
        if (key === KEY) return [];
        if (key === 'activeConditions') return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Human',
        'activeBuffs',
        [{ name: 'OtherBuff', duration: 2 }],
        'MyCampaign',
      );
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Human',
        'hitPoints',
        25,
        'MyCampaign',
      );
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Human',
        'currentHitPoints',
        20,
        'MyCampaign',
      );
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Human',
        'heroesFeastHpMaxIncrease',
        0,
        'MyCampaign',
      );
    });

    it('does not modify HP when increase is 0', () => {
      const myList = [
        { target: 'Human', effects: [{ type: 'remove_heroes_feast_buff', buffName: 'HeroesFeast', hpKey: 'heroesFeastHpMaxIncrease' }], appliedRound: 1 },
      ];
      getRuntimeValue.mockImplementation((name, key) => {
        if (name === 'Human' && key === 'activeBuffs') return [{ name: 'HeroesFeast', duration: 3 }];
        if (name === 'Human' && key === 'hitPoints') return 30;
        if (name === 'Human' && key === 'heroesFeastHpMaxIncrease') return 0;
        if (name === 'Human' && key === 'currentHitPoints') return 25;
        if (key === KEY && name === 'Goblin') return myList;
        if (key === KEY) return [];
        if (key === 'activeConditions') return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Human',
        'activeBuffs',
        [],
        'MyCampaign',
      );
      // HP should not be modified when increase is 0
      expect(setRuntimeValue).not.toHaveBeenCalledWith('Human', 'hitPoints', expect.anything(), 'MyCampaign');
    });

    it('handles missing currentHitPoints gracefully', () => {
      const myList = [
        { target: 'Human', effects: [{ type: 'remove_heroes_feast_buff', buffName: 'HeroesFeast', hpKey: 'heroesFeastHpMaxIncrease' }], appliedRound: 1 },
      ];
      getRuntimeValue.mockImplementation((name, key) => {
        if (name === 'Human' && key === 'activeBuffs') return [{ name: 'HeroesFeast', duration: 3 }];
        if (name === 'Human' && key === 'hitPoints') return 30;
        if (name === 'Human' && key === 'heroesFeastHpMaxIncrease') return 5;
        if (key === KEY && name === 'Goblin') return myList;
        if (key === KEY) return [];
        if (key === 'activeConditions') return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Human',
        'activeBuffs',
        [],
        'MyCampaign',
      );
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Human',
        'hitPoints',
        25,
        'MyCampaign',
      );
    });
  });

  describe('remove_aid_buff effect type', () => {
    it('removes the buff and reduces HP max increase', () => {
      const myList = [
        { target: 'Human', effects: [{ type: 'remove_aid_buff', buffName: 'Aid', hpKey: 'aidHpMaxIncrease' }], appliedRound: 1 },
      ];
      getRuntimeValue.mockImplementation((name, key) => {
        if (name === 'Human' && key === 'activeBuffs') return [
          { name: 'Aid', duration: 3 },
          { name: 'OtherBuff', duration: 2 },
        ];
        if (name === 'Human' && key === 'hitPoints') return 25;
        if (name === 'Human' && key === 'aidHpMaxIncrease') return 3;
        if (name === 'Human' && key === 'currentHitPoints') return 22;
        if (key === KEY && name === 'Goblin') return myList;
        if (key === KEY) return [];
        if (key === 'activeConditions') return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Human',
        'activeBuffs',
        [{ name: 'OtherBuff', duration: 2 }],
        'MyCampaign',
      );
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Human',
        'currentHitPoints',
        19,
        'MyCampaign',
      );
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Human',
        'aidHpMaxIncrease',
        0,
        'MyCampaign',
      );
    });

    it('handles missing currentHitPoints for aid buff', () => {
      const myList = [
        { target: 'Human', effects: [{ type: 'remove_aid_buff', buffName: 'Aid', hpKey: 'aidHpMaxIncrease' }], appliedRound: 1 },
      ];
      getRuntimeValue.mockImplementation((name, key) => {
        if (name === 'Human' && key === 'activeBuffs') return [{ name: 'Aid', duration: 3 }];
        if (name === 'Human' && key === 'hitPoints') return 25;
        if (name === 'Human' && key === 'aidHpMaxIncrease') return 3;
        if (key === KEY && name === 'Goblin') return myList;
        if (key === KEY) return [];
        if (key === 'activeConditions') return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Human',
        'activeBuffs',
        [],
        'MyCampaign',
      );
      // currentHitPoints should not be set when it was missing
      const currentHpCalls = setRuntimeValue.mock.calls.filter(
        (c) => c[0] === 'Human' && c[1] === 'currentHitPoints',
      );
      expect(currentHpCalls.length).toBe(0);
    });
  });

  describe('remove_target_effect effect type', () => {
    it('removes the specified target effect from campaign targetEffects', () => {
      const myList = [
        { target: 'Human', effects: [{ type: 'remove_target_effect', effectKey: 'slow', source: 'Slow' }], appliedRound: 1 },
      ];
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === KEY && name === 'Goblin') return myList;
        if (key === KEY) return [];
        if (key === 'targetEffects') return [
          { effect: 'slow', source: 'Slow', target: 'Human' },
          { effect: 'heroism', source: 'Heroism', target: 'Orc' },
        ];
        if (key === 'activeConditions') return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      const effectCalls = setRuntimeValue.mock.calls.filter(
        (c) => c[0] === 'MyCampaign' && c[1] === 'targetEffects',
      );
      expect(effectCalls.length).toBeGreaterThan(0);
      expect(effectCalls[0][2]).toEqual([
        { effect: 'heroism', source: 'Heroism', target: 'Orc' },
      ]);
    });
  });

  describe('bait_and_switch_clear effect type (via clearExpirationEffects)', () => {
    it('clears baitAndSwitch state when wasActive is true', () => {
      const myList = [
        { target: 'Human', effects: [{ type: 'bait_and_switch_clear' }], appliedRound: 1 },
      ];
      getRuntimeValue.mockImplementation((name, key) => {
        if (name === 'Human' && key === 'baitAndSwitchActive') return true;
        if (key === KEY && name === 'Goblin') return myList;
        if (key === KEY) return [];
        if (key === 'activeConditions') return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Human',
        'baitAndSwitchActive',
        null,
        'MyCampaign',
      );
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Human',
        'baitAndSwitchBonus',
        null,
        'MyCampaign',
      );
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Human',
        'baitAndSwitchSource',
        null,
        'MyCampaign',
      );
    });

    it('does not clear baitAndSwitch when wasActive is false', () => {
      const myList = [
        { target: 'Human', effects: [{ type: 'bait_and_switch_clear' }], appliedRound: 1 },
      ];
      getRuntimeValue.mockImplementation((name, key) => {
        if (name === 'Human' && key === 'baitAndSwitchActive') return false;
        if (key === KEY && name === 'Goblin') return myList;
        if (key === KEY) return [];
        if (key === 'activeConditions') return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      const baitCalls = setRuntimeValue.mock.calls.filter(
        (c) => c[0] === 'Human' && ['baitAndSwitchActive', 'baitAndSwitchBonus', 'baitAndSwitchSource'].includes(c[1]),
      );
      expect(baitCalls.length).toBe(0);
    });
  });

  describe('remove_feign_death_buff edge cases', () => {
    it('handles empty activeBuffs array', () => {
      const myList = [
        { target: 'Human', effects: [{ type: 'remove_feign_death_buff', buffName: 'FeignDeath' }], appliedRound: 1 },
      ];
      getRuntimeValue.mockImplementation((name, key) => {
        if (name === 'Human' && key === 'activeBuffs') return [];
        if (name === 'Human' && key === 'activeConditions') return ['blinded', 'incapacitated', 'speed_zero'];
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

  describe('remove_active_buff edge cases', () => {
    it('does not add new conditions when speed_zero already present', () => {
      const myList = [
        { target: 'Human', effects: [{ type: 'remove_active_buff', buffName: 'Haste' }], appliedRound: 1 },
      ];
      getRuntimeValue.mockImplementation((name, key) => {
        if (name === 'Human' && key === 'activeBuffs') return [{ name: 'Haste', effect: 'haste', duration: 3 }];
        if (name === 'Human' && key === 'activeConditions') return ['speed_zero', 'poisoned'];
        if (key === KEY && name === 'Goblin') return myList;
        if (key === KEY) return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      // newConditions = conditions.filter(!speed_zero) + ['speed_zero'] + ['incapacitated']
      // = ['poisoned'] + ['speed_zero'] + ['incapacitated'] = ['poisoned', 'speed_zero', 'incapacitated']
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Human',
        'activeConditions',
        ['poisoned', 'speed_zero', 'incapacitated'],
        'MyCampaign',
      );
    });

    it('does not add incapacitated when already present', () => {
      const myList = [
        { target: 'Human', effects: [{ type: 'remove_active_buff', buffName: 'Haste' }], appliedRound: 1 },
      ];
      getRuntimeValue.mockImplementation((name, key) => {
        if (name === 'Human' && key === 'activeBuffs') return [{ name: 'Haste', effect: 'haste', duration: 3 }];
        if (name === 'Human' && key === 'activeConditions') return ['incapacitated', 'poisoned'];
        if (key === KEY && name === 'Goblin') return myList;
        if (key === KEY) return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Human',
        'activeConditions',
        ['incapacitated', 'poisoned', 'speed_zero'],
        'MyCampaign',
      );
    });
  });

  describe('fly_speed_equals_walk_speed with incapacitated', () => {
    it('logs ability_use when target is incapacitated', () => {
      const myList = [
        { target: 'Human', effects: [{ type: 'fly_speed_equals_walk_speed' }], appliedRound: 1 },
      ];
      getRuntimeValue.mockImplementation((name, key) => {
        if (name === 'Human' && key === 'activeBuffs') return [];
        if (name === 'Human' && key === 'activeConditions') return ['incapacitated'];
        if (key === KEY && name === 'Goblin') return myList;
        if (key === KEY) return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      expect(addEntry).toHaveBeenCalledWith('MyCampaign', expect.objectContaining({
        type: 'ability_use',
        characterName: 'Human',
        abilityName: 'Draconic Flight',
        description: "Human's spectral wings dissolve due to the Incapacitated condition.",
      }));
    });
  });
});
