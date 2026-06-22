import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  getAllStoreKeys: vi.fn(() => []),
}));

vi.mock('../../ui/utils.js', () => ({
  default: {
    getName: vi.fn(),
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
}));

import { clearAllExpirationEffects } from './expirations.js';
import { getRuntimeValue, setRuntimeValue, getAllStoreKeys } from '../../../hooks/runtime/useRuntimeState.js';
import utils from '../../ui/utils.js';

const KEY = 'pendingExpirations';

function resetMocks() {
  vi.clearAllMocks();
  localStorage.clear();
  window.dispatchEvent = vi.fn();
}

function stubUtilsNameIdentity() {
  utils.getName.mockImplementation((v) => v);
}

function setupLocalStorageScan(keysMap, myPendingList) {
  const lowerChar = Object.keys(keysMap);
  getAllStoreKeys.mockReturnValue(lowerChar);
  for (const key of lowerChar) {
     Object.defineProperty(localStorage, key, { value: JSON.stringify({}), enumerable: true, writable: true, configurable: true });
   }

  getRuntimeValue.mockImplementation((name, key) => {
    if (key === KEY) {
        for (const k of lowerChar) {
            if (name === k) return keysMap[k];
        }
        if (myPendingList !== undefined) {
            return myPendingList;
        }
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

  it('returns early when characterName is falsy', () => {
    clearAllExpirationEffects(null, 'MyCampaign');
    expect(getRuntimeValue).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('returns early when campaignName is falsy', () => {
    clearAllExpirationEffects('Goblin', null);
    expect(getRuntimeValue).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('clears "from me" effects — iterates my list and clears each entry', () => {
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

  it('clears "from me" — uses getRuntimeValue for my pendingExpirations list', () => {
    const myList = [
      { target: 'Human', effects: [{ type: 'stunned', condition: 'speed_halved' }], appliedRound: 1 },
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

  it('clears "to me" — scans localStorage and filters entries targeting me', () => {
    setupLocalStorageScan({ orc: [{ target: 'goblin', effects: [], appliedRound: 1 }] }, []);

    clearAllExpirationEffects('Goblin', 'MyCampaign');

    expect(getRuntimeValue).toHaveBeenCalledWith('orc', KEY);
   });

  it('keeps "to me" — non-matching targets preserved in other lists', () => {
    setupLocalStorageScan({ orc: [{ target: 'elf', effects: [], appliedRound: 1 }] }, []);

    clearAllExpirationEffects('Goblin', 'MyCampaign');

    const keepCall = setRuntimeValue.mock.calls.find(
       (c) => c[0] === 'orc' && c[1] === KEY
     );
    expect(keepCall).toBeTruthy();
   });

  it('skips own character key in store scan', () => {
    getAllStoreKeys.mockReturnValue(['goblin']);

    getRuntimeValue.mockReturnValue([]);

    clearAllExpirationEffects('Goblin', 'MyCampaign');

    const allCalls = getRuntimeValue.mock.calls.filter((c) => c[1] === KEY);
    expect(allCalls.find((c) => c[0] === 'goblin')).toBeUndefined();
   });

  it('skips empty runtime list in store entries', () => {
    setupLocalStorageScan({ orc: [] }, []);

    clearAllExpirationEffects('Goblin', 'MyCampaign');

    const setCallForOrc = setRuntimeValue.mock.calls.find(
       (c) => c[0] === 'orc' && c[1] === KEY
     );
    expect(setCallForOrc).toBeUndefined();
   });

  it('uses utils.getName for target comparison in "to me" scan', () => {
    setupLocalStorageScan(
      { orc: [{ target: 'GoblinSlayer', effects: [{ type: 'stunned', condition: 'speed_halved' }], appliedRound: 1 }] },
      []
    );
    utils.getName.mockReturnValue('goblin');

    clearAllExpirationEffects('Goblin', 'MyCampaign');

    const setCallForOrc = setRuntimeValue.mock.calls.find(
       (c) => c[0] === 'orc' && c[1] === KEY
     );
    expect(setCallForOrc).toBeTruthy();
   });

  it('clears "from me" empty list when myList has no entries', () => {
    getRuntimeValue.mockReturnValueOnce([]);

    clearAllExpirationEffects('Goblin', 'MyCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', KEY, [], 'MyCampaign');
  });

  it('does not iterate localStorage when characterName has no local storage match', () => {
    getRuntimeValue.mockReturnValueOnce([]);

    clearAllExpirationEffects('Goblin', 'MyCampaign');

    expect(getRuntimeValue).toHaveBeenCalledWith('Goblin', KEY);
    expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', KEY, [], 'MyCampaign');
  });
});
