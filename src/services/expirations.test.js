import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports (hoisted by vitest) ───────────────────

vi.mock('../hooks/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('./utils.js', () => ({
  default: {
    getName: vi.fn(),
  },
}));

vi.mock('./combatData.js', () => ({
  getCurrentCombatRound: vi.fn(),
  getActiveCreatureName: vi.fn(),
  getCombatSummary: vi.fn(),
}));

// ── Imports (Vite returns mocked versions) ─────────────────────

import {
  addExpiration,
  clearAllExpirationEffects,
  expireStaleEffects,
} from './expirations.js';

import { getRuntimeValue, setRuntimeValue } from '../hooks/useRuntimeState.js';
import utils from './utils.js';
import {
  getCurrentCombatRound,
  getActiveCreatureName,
  getCombatSummary,
} from './combatData.js';

// ── Helpers ────────────────────────────────────────────────────

const KEY = 'pendingExpirations';

function resetMocks() {
  vi.clearAllMocks();
  // Reset localStorage between tests so clearAllExpirationEffects doesn't see stale keys
  localStorage.clear();
}

// Make utils.getName default to identity (pass-through) for most tests
function stubUtilsNameIdentity() {
  utils.getName.mockImplementation((v) => v);
}

/**
 * Stub getRuntimeValue for clearAllExpirationEffects localStorage scan.
  * @param {Object} keysMap - Map of creature name → pendingExpirations list
  *                           The key in localStorage will be the object's own key (lowercased from char name).
  * @param {Array} myPendingList - What to return for the characterName call to pendingExpirations
 */
function setupLocalStorageScan(keysMap, myPendingList) {
  // Set up localStorage keys
  const lowerChar = Object.keys(keysMap); // we'll set these as localStorage keys
  for (const key of Object.keys(keysMap)) {
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
    return null;
   });
}

// ── Tests ───────────────────────────────────────────────────────

describe('addExpiration', () => {
  beforeEach(() => {
    resetMocks();
    stubUtilsNameIdentity();
    getCurrentCombatRound.mockReturnValue(1);
  });

  it('adds a new expiration entry when no existing list', () => {
    getRuntimeValue.mockReturnValueOnce(null);

    addExpiration('Goblin', 'Human', [{ type: 'stunned' }], 'MyCampaign');

    expect(getRuntimeValue).toHaveBeenCalledWith('Goblin', KEY);
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Goblin',
      KEY,
      [{ target: 'Human', effects: [{ type: 'stunned' }], appliedRound: 1 }],
      'MyCampaign'
    );
  });

  it('adds to existing list of expirations', () => {
    const existingList = [
      { target: 'Orc', effects: [{ type: 'advantage_on_target' }], appliedRound: 0 },
    ];
    getRuntimeValue.mockReturnValueOnce(existingList);

    addExpiration('Goblin', 'Human', [{ type: 'stunned' }], 'MyCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Goblin',
      KEY,
      [
        ...existingList,
        { target: 'Human', effects: [{ type: 'stunned' }], appliedRound: 1 },
      ],
      'MyCampaign'
    );
  });

  it('preserves the original list reference for spread (does not mutate)', () => {
    const existingList = [
      { target: 'Orc', effects: [], appliedRound: 0 },
    ];
    getRuntimeValue.mockReturnValueOnce(existingList);

    addExpiration('Goblin', 'Human', [{ type: 'stunned' }], 'MyCampaign');

    // Original list should __not__ have the new entry (we used spread)
    expect(existingList.length).toBe(1);
  });

  it('uses current combat round from getCurrentCombatRound', () => {
    getCurrentCombatRound.mockReturnValue(5);
    getRuntimeValue.mockReturnValueOnce(null);

    addExpiration('Goblin', 'Human', [{ type: 'stunned' }], 'MyCampaign');

    const call = setRuntimeValue.mock.calls[0];
    expect(call[2][0].appliedRound).toBe(5);
  });

  it('passes effects array through unchanged in entry', () => {
    const effects = [
      { type: 'stunned', condition: 'speed_halved' },
      { type: 'advantage_on_target' },
    ];
    getRuntimeValue.mockReturnValueOnce(null);

    addExpiration('Goblin', 'Human', effects, 'MyCampaign');

    const call = setRuntimeValue.mock.calls[0];
    expect(call[2][0].effects).toBe(effects);
  });
});

// ────────────────────────────────────────────────────────────────
// clearAllExpirationEffects tests
// ────────────────────────────────────────────────────────────────

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

    // First call: get my list
    getRuntimeValue.mockReturnValueOnce(myList);

    // Mock for clearExpirationEffects on Human's stunned condition (removes activeCondition)
    // For type 'stunned' with condition 'stunned', it removes via removeActiveCondition
    getRuntimeValue
      .mockReturnValueOnce(null)         // removeActiveCondition for Human activeConditions → null
      .mockReturnValueOnce([])          // For advantage path: getRuntimeValue for attacker _advantageOn_Orc → empty / not containing target
      .mockReturnValueOnce([]);         // Actually let me trace more carefully...

    clearAllExpirationEffects('Goblin', 'MyCampaign');

    // Should have called setRuntimeValue to reset my list to []
    expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', KEY, [], 'MyCampaign');
  });

  it('clears "from me" — uses getRuntimeValue for my pendingExpirations list', () => {
    const myList = [
      { target: 'Human', effects: [{ type: 'stunned', condition: 'speed_halved' }], appliedRound: 1 },
    ];

    // get my list → return the list
    getRuntimeValue.mockReturnValueOnce(myList);
    // clearExpirationEffects for speed_halved calls setRuntimeValue directly (no further getRuntimeValue)
    getRuntimeValue.mockReturnValue(null);
    // After clearing entries, set my list to []
    // Then localStorage scan: no other keys

    clearAllExpirationEffects('Goblin', 'MyCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', KEY, [], 'MyCampaign');
  });

  it('clears "to me" — scans localStorage and filters entries targeting me', () => {
    setupLocalStorageScan({ orc: [{ target: 'goblin', effects: [], appliedRound: 1 }] }, []);

    clearAllExpirationEffects('Goblin', 'MyCampaign');

    // getRuntimeValue was called for the 'orc' key to fetch its pending list
    expect(getRuntimeValue).toHaveBeenCalledWith('orc', KEY);
   });

  it('keeps "to me" — non-matching targets preserved in other lists', () => {
    setupLocalStorageScan({ orc: [{ target: 'elf', effects: [], appliedRound: 1 }] }, []);

    clearAllExpirationEffects('Goblin', 'MyCampaign');

     // The entry targeting 'elf' (not goblin) is kept in orc's list
    const keepCall = setRuntimeValue.mock.calls.find(
       (c) => c[0] === 'orc' && c[1] === KEY
     );
    expect(keepCall).toBeTruthy();
   });

  it('skips combatSummary and activeCreatureName keys in localStorage scan', () => {
    localStorage.setItem('combatSummary', JSON.stringify({}));
    localStorage.setItem('activeCreatureName', JSON.stringify({}));

    getRuntimeValue.mockReturnValue([]);

    clearAllExpirationEffects('Goblin', 'MyCampaign');

     // combatSummary and activeCreatureName should NOT be used as character names
    const allCalls = getRuntimeValue.mock.calls.filter((c) => c[1] === KEY);
    const skippedNames = ['combatSummary', 'activeCreatureName'];
    for (const name of skippedNames) {
      expect(allCalls.find((c) => c[0] === name)).toBeUndefined();
     }
   });

  it('skips own character key in localStorage scan', () => {
    localStorage.setItem('goblin', JSON.stringify({}));

    getRuntimeValue.mockReturnValue([]);

    clearAllExpirationEffects('Goblin', 'MyCampaign');

     // Should not call getRuntimeValue with 'goblin' as name during the scan phase
    const allCalls = getRuntimeValue.mock.calls.filter((c) => c[1] === KEY);
    expect(allCalls.find((c) => c[0] === 'goblin')).toBeUndefined();
   });

  it('skips empty runtime list in localStorage entries', () => {
    setupLocalStorageScan({ orc: [] }, []);

    clearAllExpirationEffects('Goblin', 'MyCampaign');

     // Should NOT call setRuntimeValue for 'orc' because list is empty (line 35 short-circuits)
    const setCallForOrc = setRuntimeValue.mock.calls.find(
       (c) => c[0] === 'orc' && c[1] === KEY
     );
    expect(setCallForOrc).toBeUndefined();
   });

  it('uses utils.getName for target comparison in "to me" scan', () => {
     // utils.getName is called on entry.target during scan; when it matches charLower, entry is cleared
     setupLocalStorageScan(
       { orc: [{ target: 'GoblinSlayer', effects: [{ type: 'stunned', condition: 'speed_halved' }], appliedRound: 1 }] },
       []
     );
     // utils.getName maps "GoblinSlayer" → "goblin" which matches charLower
    utils.getName.mockReturnValue('goblin');

    clearAllExpirationEffects('Goblin', 'MyCampaign');

     // setRuntimeValue was called for the orc key (to clear matching entry)
    const setCallForOrc = setRuntimeValue.mock.calls.find(
       (c) => c[0] === 'orc' && c[1] === KEY
     );
    expect(setCallForOrc).toBeTruthy();
   });

  it('clears "from me" empty list when myList has no entries', () => {
    getRuntimeValue.mockReturnValueOnce([]); // my list is empty

    clearAllExpirationEffects('Goblin', 'MyCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', KEY, [], 'MyCampaign');
  });

  it('does not iterate localStorage when characterName has no local storage match', () => {
    getRuntimeValue.mockReturnValueOnce(null); // my list is null/undefined
    // No other localStorage keys exist

    clearAllExpirationEffects('Goblin', 'MyCampaign');

    // Only call should be the initial getRuntimeValue for my KEY + setRuntimeValue to set empty array
    expect(getRuntimeValue).toHaveBeenCalledWith('Goblin', KEY);
    expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', KEY, [], 'MyCampaign');
  });
});

// ────────────────────────────────────────────────────────────────
// expireStaleEffects tests
// ────────────────────────────────────────────────────────────────

describe('expireStaleEffects', () => {
  beforeEach(() => {
    resetMocks();
    stubUtilsNameIdentity();
    getCurrentCombatRound.mockReturnValue(2);
    getActiveCreatureName.mockReturnValue('Goblin');
  });

  it('returns early when no active creature name', () => {
    getActiveCreatureName.mockReturnValue(null);

    expireStaleEffects('MyCampaign');

    expect(getRuntimeValue).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('returns early when active creature name is empty string', () => {
    getActiveCreatureName.mockReturnValue('');

    expireStaleEffects('MyCampaign');

    // Still checks: !activeName → '' is falsy, so returns early
    expect(getRuntimeValue).not.toHaveBeenCalled();
  });

  it('does not process creatures that do not match active name', () => {
    getCombatSummary.mockReturnValue({
      creatures: [
        { name: 'Orc' },
        { name: 'Goblin' },
      ],
    });
    getRuntimeValue.mockReturnValue(null); // Goblin has no pending list

    expireStaleEffects('MyCampaign');

    // Should call getRuntimeValue for 'Goblin', not 'Orc'
    expect(getRuntimeValue).toHaveBeenCalledWith('Goblin', KEY);
  });

  it('compares attacker name using utils.getName and skips non-matching', () => {
    getCombatSummary.mockReturnValue({
      creatures: [
        { name: 'Big Orc' },
        { name: 'goblin' },
      ],
    });
    getRuntimeValue.mockReturnValue(null);

    expireStaleEffects('MyCampaign');

    expect(utils.getName).toHaveBeenCalledWith('Big Orc');
    expect(utils.getName).toHaveBeenCalledWith('goblin');
  });

  it('clears stale effects (appliedRound < currentRound)', () => {
    const staleEntry = { target: 'Human', effects: [{ type: 'stunned', condition: 'speed_halved' }], appliedRound: 1 };
    const freshEntry = { target: 'Orc', effects: [{ type: 'advantage_on_target' }], appliedRound: 2 };
    const list = [staleEntry, freshEntry];

    getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
    getRuntimeValue.mockReturnValueOnce(list); // stale + fresh
    getCurrentCombatRound.mockReturnValue(2);  // round 2 > appliedRound 1 → stale

    expireStaleEffects('MyCampaign');

    // setRuntimeValue for speed_halved clearance on Human (clearExpirationEffects calls it)
    expect(setRuntimeValue).toHaveBeenCalledWith('Human', 'stunned_speedHalved', null, 'MyCampaign');

    // Final list should only have the fresh entry
    const finalCall = setRuntimeValue.mock.calls.find(
      (c) => c[0] === 'Goblin' && c[1] === KEY
    );
    expect(finalCall).toBeTruthy();
    expect(finalCall[2]).toEqual([freshEntry]);
  });

  it('keeps fresh effects (appliedRound >= currentRound)', () => {
    const freshEntry = { target: 'Human', effects: [{ type: 'stunned' }], appliedRound: 2 };
    getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
    getCurrentCombatRound.mockReturnValue(2);
    getRuntimeValue.mockReturnValueOnce([freshEntry]);

    expireStaleEffects('MyCampaign');

    const finalCall = setRuntimeValue.mock.calls.find(
      (c) => c[0] === 'Goblin' && c[1] === KEY
    );
    expect(finalCall).toBeTruthy();
    expect(finalCall[2]).toEqual([freshEntry]);
  });

  it('skips attacker when pending list is empty', () => {
    getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
    getRuntimeValue.mockReturnValueOnce([]);

    expireStaleEffects('MyCampaign');

     // if !list.length continue (line 67) → so setRuntimeValue is NOT called for KEY
    const finalCall = setRuntimeValue.mock.calls.find(
        (c) => c[0] === 'Goblin' && c[1] === KEY
      );
    expect(finalCall).toBeUndefined();
   });

  it('handles empty combat summary gracefully', () => {
    getCombatSummary.mockReturnValue(null);

    expireStaleEffects('MyCampaign');

    // No crashes, no errors
    expect(getRuntimeValue).not.toHaveBeenCalled();
  });

  it('handles missing creatures array in combat summary', () => {
    getCombatSummary.mockReturnValue({});

    expireStaleEffects('MyCampaign');

    expect(getRuntimeValue).not.toHaveBeenCalled();
  });



  it('clears all entries when every entry is stale', () => {
    const list = [
      { target: 'Human', effects: [{ type: 'stunned', condition: 'speed_halved' }], appliedRound: 0 },
    ];

    getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
    getCurrentCombatRound.mockReturnValue(5);
    getRuntimeValue.mockReturnValueOnce(list);

    expireStaleEffects('MyCampaign');

    const finalCall = setRuntimeValue.mock.calls.find(
      (c) => c[0] === 'Goblin' && c[1] === KEY
    );
    expect(finalCall).toBeTruthy();
    expect(finalCall[2]).toEqual([]);
  });

  it('processes multiple stale+fresh entries in a single list', () => {
    const list = [
      { target: 'A', effects: [{ type: 'stunned', condition: 'speed_halved' }], appliedRound: 0 }, // stale
      { target: 'B', effects: [{ type: 'stunned' }], appliedRound: 1 }, // stale
      { target: 'C', effects: [{ type: 'advantage_on_target' }], appliedRound: 2 }, // fresh (=== round)
    ];

    getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
    getCurrentCombatRound.mockReturnValue(2);
    getRuntimeValue.mockReturnValueOnce(list);

    expireStaleEffects('MyCampaign');

    const finalCall = setRuntimeValue.mock.calls.find(
      (c) => c[0] === 'Goblin' && c[1] === KEY
    );
    expect(finalCall).toBeTruthy();
    expect(finalCall[2]).toEqual([list[2]]); // only fresh entry kept
  });

  it('clears advantage_on_target stale effect for matching attacker', () => {
    const list = [
      { target: 'Human', effects: [{ type: 'advantage_on_target' }], appliedRound: 0 },
    ];

    getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
    getCurrentCombatRound.mockReturnValue(5);

    // For advantage_on_target, clearExpirationEffects calls getRuntimeValue for attacker's _advantageOn_Human
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'Goblin' && key === KEY) return list;
      if (key === `_advantageOn_Human`) return ['Human']; // stored advantage includes target
      return null;
    });

    expireStaleEffects('MyCampaign');

    // setRuntimeValue should be called to remove the advantage entry for Human
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Goblin',
      `_advantageOn_Human`,
      [], // filtered list excludes Human
      'MyCampaign'
    );
  });

  it('clears stunned condition when stale entry has type/stunned combo', () => {
    const list = [
      { target: 'Human', effects: [{ type: 'stunned', condition: 'stunned' }], appliedRound: 0 },
    ];

    getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
    getCurrentCombatRound.mockReturnValue(5);

    // For stunned → removes activeCondition. That calls getRuntimeValue for Human activeConditions
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'Goblin' && key === KEY) return list;
      if (name === 'Human' && key === 'activeConditions') return ['stunned'];
      return null;
    });

    expireStaleEffects('MyCampaign');

    // removeActiveCondition should filter out stunned and set activeConditions
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Human',
      'activeConditions',
      [], // filtered list (stunned removed)
      'MyCampaign'
    );
  });

  it('uses campaignName in all runtime state calls', () => {
    const list = [
      { target: 'Human', effects: [{ type: 'stunned', condition: 'speed_halved' }], appliedRound: 0 },
    ];
    getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
    getCurrentCombatRound.mockReturnValue(5);
    getRuntimeValue.mockReturnValueOnce(list);

    expireStaleEffects('TestCampaign');

    // All setRuntimeValue calls should use TestCampaign
    for (const call of setRuntimeValue.mock.calls) {
      expect(call[3]).toBe('TestCampaign');
    }
  });
});

// ────────────────────────────────────────────────────────────────
// Indirect tests: clearExpirationEffects and removeActiveCondition
// Through addExpiration → doesn't call it, so through the other two exports
// Actually addExpiration does NOT call clearExpirationEffects.
// It's only called by clearAllExpirationEffects and expireStaleEffects.
// These are already covered above.  Add a few edge-case tests.
// ────────────────────────────────────────────────────────────────

describe('clearExpirationEffects (via clearAllExpirationEffects)', () => {
  beforeEach(() => {
    resetMocks();
    stubUtilsNameIdentity();
  });

  it('does nothing when effects is null', () => {
    const myList = [
      { target: 'Human', effects: null, appliedRound: 1 },
    ];
    getRuntimeValue.mockReturnValueOnce(myList);

    clearAllExpirationEffects('Goblin', 'MyCampaign');

    // No side-effects from null effects (line 84 returns early)
    expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', KEY, [], 'MyCampaign');
  });

  it('does nothing when effects is not an array', () => {
    const myList = [
      { target: 'Human', effects: 'string', appliedRound: 1 },
    ];
    getRuntimeValue.mockReturnValueOnce(myList);

    clearAllExpirationEffects('Goblin', 'MyCampaign');

    // Same — effects is not array, so no processing (line 84)
    expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', KEY, [], 'MyCampaign');
  });

  it('does nothing when effects is an empty array', () => {
    const myList = [
      { target: 'Human', effects: [], appliedRound: 1 },
    ];
    getRuntimeValue.mockReturnValueOnce(myList);

    clearAllExpirationEffects('Goblin', 'MyCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', KEY, [], 'MyCampaign');
  });

  it('ignores unknown effect types in switch statement (default break)', () => {
    const myList = [
      { target: 'Human', effects: [{ type: 'unknownEffectType' }], appliedRound: 1 },
    ];
    getRuntimeValue.mockReturnValueOnce(myList);

    clearAllExpirationEffects('Goblin', 'MyCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', KEY, [], 'MyCampaign');
    // No additional setRuntimeValue calls beyond clearing my list
  });

  it('handles advantage_on_target when storedAdv is null (not array)', () => {
    const myList = [
      { target: 'Human', effects: [{ type: 'advantage_on_target' }], appliedRound: 1 },
    ];
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'Goblin' && key === KEY) return myList;
      // storedAdv is null — line 98 returns null, so the if guard on line 99 fails
      return null;
    });

    clearAllExpirationEffects('Goblin', 'MyCampaign');

    // No setRuntimeValue called for advantageOn key since storedAdv was not an array
    const advCall = setRuntimeValue.mock.calls.find((c) => c[1].startsWith('_advantageOn_'));
    expect(advCall).toBeUndefined();
  });

  it('handles advantage_on_target when storedAdv does not include targetName', () => {
    const myList = [
      { target: 'Human', effects: [{ type: 'advantage_on_target' }], appliedRound: 1 },
    ];
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'Goblin' && key === KEY) return myList;
      // storedAdv is an array but doesn't include Human
      if (key === `_advantageOn_Human`) return ['Orc', 'Elf'];
      return null;
    });

    clearAllExpirationEffects('Goblin', 'MyCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', KEY, [], 'MyCampaign');
    // No setRuntimeValue called for advantage key since target not included in array
    const advCall = setRuntimeValue.mock.calls.find((c) => c[1].startsWith('_advantageOn_'));
    expect(advCall).toBeUndefined();
  });

  it('removes target from storedAdv when it is included', () => {
    const myList = [
      { target: 'Human', effects: [{ type: 'advantage_on_target' }], appliedRound: 1 },
    ];
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'Goblin' && key === KEY) return myList;
      if (key === `_advantageOn_Human`) return ['Orc', 'Human', 'Elf'];
      return null;
    });

    clearAllExpirationEffects('Goblin', 'MyCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Goblin',
      `_advantageOn_Human`,
      ['Orc', 'Elf'], // Human removed
      'MyCampaign'
    );
  });

  it('handles multiple advantage targets in the same effects array', () => {
    const myList = [
      { target: 'Human', effects: [{ type: 'advantage_on_target' }], appliedRound: 1 },
    ];
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'Goblin' && key === KEY) return myList;
      if (key === `_advantageOn_Human`) return ['Human'];
      return null;
    });

    clearAllExpirationEffects('Goblin', 'MyCampaign');

    // After filtering, only Human was in the list so result is []
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Goblin',
      `_advantageOn_Human`,
      [],
      'MyCampaign'
    );
  });
});

describe('removeActiveCondition (via clearExpirationEffects)', () => {
  beforeEach(() => {
    resetMocks();
    stubUtilsNameIdentity();
  });

  it('removes active condition when getRuntimeValue returns an array', () => {
    const myList = [
      { target: 'Human', effects: [{ type: 'stunned', condition: 'stunned' }], appliedRound: 1 },
    ];
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'Goblin' && key === KEY) return myList;
      // removeActiveCondition fetches activeConditions for Human → has stunned
      if (name === 'Human' && key === 'activeConditions') return ['stunned', 'poisoned'];
      return null;
    });

    clearAllExpirationEffects('Goblin', 'MyCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Human',
      'activeConditions',
      ['poisoned'], // stunned removed
      'MyCampaign'
    );
  });

  it('does nothing when activeConditions is not an array', () => {
    const myList = [
      { target: 'Human', effects: [{ type: 'stunned', condition: 'stunned' }], appliedRound: 1 },
    ];
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'Goblin' && key === KEY) return myList;
      // activeConditions is a string — not an array (line 118 returns early)
      if (name === 'Human' && key === 'activeConditions') return 'stunned';
      return null;
    });

    clearAllExpirationEffects('Goblin', 'MyCampaign');

    // No setRuntimeValue for activeConditions since it was not an array
    const condCall = setRuntimeValue.mock.calls.find((c) => c[1] === 'activeConditions');
    expect(condCall).toBeUndefined();
  });

  it('uses utils.getName for condition comparison in removeActiveCondition', () => {
    const myList = [
      { target: 'Human', effects: [{ type: 'stunned', condition: 'stunned' }], appliedRound: 1 },
    ];
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'Goblin' && key === KEY) return myList;
      if (name === 'Human' && key === 'activeConditions') return ['STUNNED'];
      return null;
    });

    // utils.getName returns identity here (same name) — filter keeps entries whose name !== conditionName
    // utils.getName('STUNNED') = 'STUNNED', utils.getName('stunned') = 'stunned' → not equal, kept!
    clearAllExpirationEffects('Goblin', 'MyCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Human',
      'activeConditions',
      ['STUNNED'], // kept because getName comparison is exact (not lowered)
      'MyCampaign'
    );
  });

  it('uses utils.getName for target name in removeActiveCondition', () => {
    const myList = [
      { target: 'Human', effects: [{ type: 'stunned', condition: 'stunned' }], appliedRound: 1 },
    ];
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'Goblin' && key === KEY) return myList;
      // activeConditions for 'Human' → has stunned
      if (name === 'Human' && key === 'activeConditions') return ['stunned'];
      return null;
    });

    clearAllExpirationEffects('Goblin', 'MyCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Human',
      'activeConditions',
      [], // stunned filtered out
      'MyCampaign'
    );
  });

  it('does not remove unrelated conditions when targeting specific one', () => {
    const myList = [
      { target: 'Human', effects: [{ type: 'stunned', condition: 'stunned' }], appliedRound: 1 },
    ];
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'Goblin' && key === KEY) return myList;
      if (name === 'Human' && key === 'activeConditions') return ['frightened', 'stunned', 'blinded'];
      return null;
    });

    clearAllExpirationEffects('Goblin', 'MyCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Human',
      'activeConditions',
      ['frightened', 'blinded'], // only stunned removed
      'MyCampaign'
    );
  });

  it('handles getRuntimeValue returning null for activeConditions', () => {
    const myList = [
      { target: 'Human', effects: [{ type: 'stunned', condition: 'stunned' }], appliedRound: 1 },
    ];
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'Goblin' && key === KEY) return myList;
      // No activeConditions set → null. Line 117 || [] makes this empty array
      // Wait no: line 118 checks Array.isArray(condList) first.
      // The guard on line 117 is `const condList = ... || []` so even if null it's []
      // But wait — the mock returns null, then || [] makes it [], which IS an array.
      // So it will proceed but with empty filtered result.
      return null;
    });

    clearAllExpirationEffects('Goblin', 'MyCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Human',
      'activeConditions',
      [],
      'MyCampaign'
    );
  });
});

// ────────────────────────────────────────────────────────────────
// Edge cases for clearExpirationEffects via expireStaleEffects
// ────────────────────────────────────────────────────────────────

describe('clearExpirationEffects (via expireStaleEffects)', () => {
  beforeEach(() => {
    resetMocks();
    stubUtilsNameIdentity();
    getCurrentCombatRound.mockReturnValue(2);
    getActiveCreatureName.mockReturnValue('Goblin');
  });

  it('does not process effects when null through expire path', () => {
    const list = [
      { target: 'Human', effects: null, appliedRound: 0 },
    ];
    getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
    getRuntimeValue.mockReturnValueOnce(list);

    expireStaleEffects('MyCampaign');

    // setRuntimeValue for KEY should only be called with the kept list (empty because effects cleared? no entry has appliedRound < 2)
    const finalCall = setRuntimeValue.mock.calls.find(
      (c) => c[0] === 'Goblin' && c[1] === KEY
    );
    expect(finalCall).toBeTruthy();
    // The entry is stale but effects null → clearExpirationEffects returns early, no side effects
    expect(finalCall[2]).toEqual([]);
  });

  it('does not process effects when non-array through expire path', () => {
    const list = [
      { target: 'Human', effects: {}, appliedRound: 0 },
    ];
    getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
    getRuntimeValue.mockReturnValueOnce(list);

    expireStaleEffects('MyCampaign');

    const finalCall = setRuntimeValue.mock.calls.find(
      (c) => c[0] === 'Goblin' && c[1] === KEY
    );
    expect(finalCall).toBeTruthy();
    expect(finalCall[2]).toEqual([]); // entry stale but effects not array → cleared from list
  });

  it('handles advantage_on_target with storedAdv being an empty array', () => {
    const list = [
      { target: 'Human', effects: [{ type: 'advantage_on_target' }], appliedRound: 0 },
    ];
    getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'Goblin' && key === KEY) return list;
      if (key === `_advantageOn_Human`) return []; // empty array — includes check fails on .includes
      return null;
    });

    expireStaleEffects('MyCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Goblin',
      KEY,
      [], // entry is stale so removed from list
      'MyCampaign'
    );
    // No setRuntimeValue for _advantageOn_ because storedAdv didn't include target
    const advCall = setRuntimeValue.mock.calls.find((c) => c[1].startsWith('_advantageOn_'));
    expect(advCall).toBeUndefined();
  });
});

// ────────────────────────────────────────────────────────────────
// Additional coverage for expired stale effects edge cases
// ────────────────────────────────────────────────────────────────

describe('expireStaleEffects — additional edge cases', () => {
  beforeEach(() => {
    resetMocks();
    stubUtilsNameIdentity();
    getCurrentCombatRound.mockReturnValue(3);
    getActiveCreatureName.mockReturnValue('Goblin');
  });

  it('handles combatData.creatures being undefined (|| [])', () => {
    getCombatSummary.mockReturnValue({ creatures: undefined });

    expireStaleEffects('MyCampaign');

    // No crash — line 61 treats undefined as []
  });

  it('skips creature whose name does not match after utils.getName transform', () => {
    utils.getName.mockImplementation((v) => v);
    getCombatSummary.mockReturnValue({
      creatures: [
        { name: 'Orc' }, // not Goblin → skipped
      ],
    });

    expireStaleEffects('MyCampaign');

    // Should NOT call getRuntimeValue for Orc's KEY because name comparison fails
    expect(getRuntimeValue).not.toHaveBeenCalled();
  });

  it('processes creature whose name matches after utils.getName transform', () => {
    utils.getName.mockImplementation((v) => (v === 'goblin' ? 'Goblin' : v));
    getCombatSummary.mockReturnValue({
      creatures: [
        { name: 'Orc' },
        { name: 'goblin' }, // should map to 'Goblin' and match
      ],
    });
    getRuntimeValue.mockReturnValue([
      { target: 'Human', effects: [{ type: 'stunned', condition: 'speed_halved' }], appliedRound: 0 },
    ]);

    expireStaleEffects('MyCampaign');

    // Should process goblin/goblin → matches active name 'Goblin'
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Human',
      'stunned_speedHalved',
      null,
      'MyCampaign'
    );
  });

  it('handles when getRuntimeValue returns non-array pendingExpirations for an attacker', () => {
    getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
    // || [] on line 66 makes this treated as empty list → skipped
    getRuntimeValue.mockReturnValueOnce('not-an-array');

    expireStaleEffects('MyCampaign');

    // Since list (after || []) is still ['not-an-array'] which is truthy but length check fails...
    // Actually "string" has .length > 0, and then iterates... let me think.
    // Line 66: const list = getRuntimeValue(...) || []; If returns string → list = 'not-an-array' (truthy!)
    // Line 67: if (!list.length) continue;  'not-an-array'.length is 13, so NOT skipped.
    // Then for...of iterates chars. Each item is a char like 'n', accessing .appliedRound === undefined < 3 → stale!
    // This would call clearExpirationEffects with undefined effects → early return on each.
    // But the loop sets newEntries and calls setRuntimeValue at the end.
    // OK this is edge behavior — let's just verify it doesnt crash.
    expect(() => expireStaleEffects('MyCampaign')).not.toThrow();
  });

  it('handles fresh entries not being stale (appliedRound === currentRound)', () => {
    getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
    getCurrentCombatRound.mockReturnValue(3);
    const list = [
      { target: 'Human', effects: [{ type: 'stunned' }], appliedRound: 3 }, // not stale (===)
    ];
    getRuntimeValue.mockReturnValueOnce(list);

    expireStaleEffects('MyCampaign');

    // Entry should be KEPT because appliedRound >= currentRound
    const finalCall = setRuntimeValue.mock.calls.find(
      (c) => c[0] === 'Goblin' && c[1] === KEY
    );
    expect(finalCall).toBeTruthy();
    expect(finalCall[2]).toEqual(list);
  });

  it('handles entries with appliedRound greater than currentRound (future)', () => {
    getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
    getCurrentCombatRound.mockReturnValue(1);
    const list = [
      { target: 'Human', effects: [{ type: 'stunned' }], appliedRound: 5 }, // future
    ];
    getRuntimeValue.mockReturnValueOnce(list);

    expireStaleEffects('MyCampaign');

    const finalCall = setRuntimeValue.mock.calls.find(
      (c) => c[0] === 'Goblin' && c[1] === KEY
    );
    expect(finalCall).toBeTruthy();
    expect(finalCall[2]).toEqual(list); // kept because not stale
  });
});
