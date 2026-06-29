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
  getActiveCreatureName: vi.fn(() => 'TestCharacter'),
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

const KEY = 'pendingExpirations';

function resetMocks() {
  vi.clearAllMocks();
  localStorage.clear();
  getRuntimeValue.mockReset();
  setRuntimeValue.mockReset();
  getAllStoreKeys.mockReset();
  utils.getName.mockReset();
}

function stubUtilsNameIdentity() {
  utils.getName.mockImplementation((v) => v);
}

function stubUtilsNameTransform(transformFn) {
  utils.getName.mockImplementation(transformFn);
}

function setupRuntimeMocks(myList, otherLists = {}) {
  getRuntimeValue.mockImplementation((name, key) => {
    if (key === KEY) {
      if (name === 'Goblin') return myList;
      return otherLists[name] !== undefined ? otherLists[name] : [];
    }
    if (key === 'activeConditions') return [];
    return null;
  });
}

function setupLocalStorageScan(keysMap, myPendingList) {
  const lowerChars = Object.keys(keysMap);
  getAllStoreKeys.mockReturnValue(lowerChars);
  for (const key of lowerChars) {
    Object.defineProperty(localStorage, key, {
      value: JSON.stringify(keysMap[key]),
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }

  getRuntimeValue.mockImplementation((name, key) => {
    if (key === KEY) {
      for (const k of lowerChars) {
        if (name === k) return keysMap[k];
      }
      if (myPendingList !== undefined) return myPendingList;
    }
    if (key === 'activeConditions') return [];
    return null;
  });
}

describe('clearAllExpirationEffects', () => {
  beforeEach(() => {
    resetMocks();
    stubUtilsNameIdentity();
  });

  describe('early return guards', () => {
    it('returns early without calling any runtime functions when characterName is null', () => {
      clearAllExpirationEffects(null, 'MyCampaign');

      expect(getRuntimeValue).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('returns early without calling any runtime functions when characterName is empty string', () => {
      clearAllExpirationEffects('', 'MyCampaign');

      expect(getRuntimeValue).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('returns early without calling any runtime functions when campaignName is null', () => {
      clearAllExpirationEffects('Goblin', null);

      expect(getRuntimeValue).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('returns early without calling any runtime functions when campaignName is empty string', () => {
      clearAllExpirationEffects('Goblin', '');

      expect(getRuntimeValue).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('clearing "from me" effects', () => {
    it('clears pending expirations list and resets to empty array when list has entries', () => {
      const myList = [
        { target: 'Human', effects: [{ type: 'stunned', condition: 'stunned' }], appliedRound: 1 },
        { target: 'Orc', effects: [{ type: 'advantage_on_target' }], appliedRound: 2 },
      ];

      getRuntimeValue.mockImplementation((name, key) => {
        if (key === KEY) {
          if (name === 'Goblin') return myList;
          return [];
        }
        if (key === 'activeConditions') return [];
        if (key.startsWith('_advantageOn_')) return ['Orc'];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', KEY, [], 'MyCampaign');
    });

    it('resets to empty array when myList is already empty', () => {
      setupRuntimeMocks([]);

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', KEY, [], 'MyCampaign');
    });

    it('resets to empty array when getRuntimeValue returns non-array for my list', () => {
      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === KEY) return null;
        if (key === 'activeConditions') return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', KEY, [], 'MyCampaign');
    });

    it('clears activeBuffs and mantleOfMajestyActive for own character', () => {
      setupRuntimeMocks([]);

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeBuffs', [], 'MyCampaign');
      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'mantleOfMajestyActive', null, 'MyCampaign');
    });
  });

  describe('scanning "to me" effects from other stores', () => {
    it('iterates all store keys via getAllStoreKeys', () => {
      setupLocalStorageScan({ orc: [{ target: 'goblin', effects: [], appliedRound: 1 }] }, []);

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      expect(getAllStoreKeys).toHaveBeenCalled();
    });

    it('skips own character key during store scan loop', () => {
      getAllStoreKeys.mockReturnValue(['goblin', 'orc']);
      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === KEY) return [];
        if (key === 'activeConditions') return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      const scanCallsForMyKey = getRuntimeValue.mock.calls.filter(
        (c) => c[1] === KEY && c[0] === 'goblin'
      );
      const scanCallsForOrc = getRuntimeValue.mock.calls.filter(
        (c) => c[1] === KEY && c[0] === 'orc'
      );
      expect(scanCallsForMyKey).toHaveLength(0);
      expect(scanCallsForOrc).toHaveLength(1);
    });

    it('clears entries in other stores that target me', () => {
      setupLocalStorageScan(
        { orc: [{ target: 'goblin', effects: [{ type: 'stunned', condition: 'speed_halved' }], appliedRound: 1 }] },
        []
      );

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      const setCallForOrc = setRuntimeValue.mock.calls.find(
        (c) => c[0] === 'orc' && c[1] === KEY
      );
      expect(setCallForOrc).toBeTruthy();
      expect(setCallForOrc[2]).toEqual([]);
    });

    it('preserves entries in other stores that target a different creature', () => {
      const preservedEntry = { target: 'elf', effects: [{ type: 'stunned' }], appliedRound: 1 };
      setupLocalStorageScan({ orc: [preservedEntry] }, []);

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      const setCallForOrc = setRuntimeValue.mock.calls.find(
        (c) => c[0] === 'orc' && c[1] === KEY
      );
      expect(setCallForOrc).toBeTruthy();
      expect(setCallForOrc[2]).toEqual([preservedEntry]);
    });

    it('skips stores with empty pendingExpirations lists', () => {
      setupLocalStorageScan({ orc: [] }, []);

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      const setCallForOrc = setRuntimeValue.mock.calls.find(
        (c) => c[0] === 'orc' && c[1] === KEY
      );
      expect(setCallForOrc).toBeUndefined();
    });

    it('skips stores where getRuntimeValue returns non-array', () => {
      getAllStoreKeys.mockReturnValue(['orc']);

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      const setCallForOrc = setRuntimeValue.mock.calls.find(
        (c) => c[0] === 'orc' && c[1] === KEY
      );
      expect(setCallForOrc).toBeUndefined();
    });

    it('uses utils.getName for case-insensitive target comparison', () => {
      stubUtilsNameTransform((v) => {
        if (v === 'GoblinSlayer') return 'goblin';
        return v;
      });
      setupLocalStorageScan(
        {
          orc: [
            {
              target: 'GoblinSlayer',
              effects: [{ type: 'stunned', condition: 'speed_halved' }],
              appliedRound: 1,
            },
          ],
        },
        []
      );

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      const setCallForOrc = setRuntimeValue.mock.calls.find(
        (c) => c[0] === 'orc' && c[1] === KEY
      );
      expect(setCallForOrc).toBeTruthy();
    });

    it('preserves non-targeting entries when some entries target me', () => {
      const targetsMe = { target: 'goblin', effects: [], appliedRound: 1 };
      const targetsOther = { target: 'elf', effects: [], appliedRound: 2 };
      setupLocalStorageScan({ orc: [targetsMe, targetsOther] }, []);

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      const setCallForOrc = setRuntimeValue.mock.calls.find(
        (c) => c[0] === 'orc' && c[1] === KEY
      );
      expect(setCallForOrc).toBeTruthy();
      expect(setCallForOrc[2]).toEqual([targetsOther]);
    });

    it('handles multiple other stores in a single scan', () => {
      const targetsMe = { target: 'goblin', effects: [], appliedRound: 1 };
      const targetsOther = { target: 'elf', effects: [], appliedRound: 2 };
      setupLocalStorageScan(
        { orc: [targetsMe], dragon: [targetsOther] },
        []
      );

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      const setCallForOrc = setRuntimeValue.mock.calls.find(
        (c) => c[0] === 'orc' && c[1] === KEY
      );
      expect(setCallForOrc).toBeTruthy();
      expect(setCallForOrc[2]).toEqual([]);

      const setCallForDragon = setRuntimeValue.mock.calls.find(
        (c) => c[0] === 'dragon' && c[1] === KEY
      );
      expect(setCallForDragon).toBeTruthy();
      expect(setCallForDragon[2]).toEqual([targetsOther]);
    });

    it('skips non-string keys during store scan', () => {
      getAllStoreKeys.mockReturnValue(['orc', 42, null, true]);
      getRuntimeValue.mockReturnValue([]);

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      const getCallForNumeric = getRuntimeValue.mock.calls.find(
        (c) => c[0] === 42
      );
      expect(getCallForNumeric).toBeUndefined();
    });
  });
});
