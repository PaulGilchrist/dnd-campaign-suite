import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../hooks/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../ui/utils.js', () => ({
  default: {
    getName: vi.fn(),
  },
}));

vi.mock('../ui/storage.js', () => ({
  default: {
    set: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(),
  getActiveCreatureName: vi.fn(),
  getCombatSummary: vi.fn(),
}));

import { expireStaleEffects } from './expirations.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/useRuntimeState.js';
import utils from '../ui/utils.js';
import storage from '../ui/storage.js';
import {
  getCurrentCombatRound,
  getActiveCreatureName,
  getCombatSummary,
} from '../encounters/combatData.js';

const KEY = 'pendingExpirations';

function resetMocks() {
  vi.clearAllMocks();
  localStorage.clear();
  window.dispatchEvent = vi.fn();
}

function stubUtilsNameIdentity() {
  utils.getName.mockImplementation((v) => v);
}

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

    expect(getRuntimeValue).not.toHaveBeenCalled();
  });

  it('does not process creatures that do not match active name', () => {
    getCombatSummary.mockReturnValue({
      creatures: [
        { name: 'Orc' },
        { name: 'Goblin' },
      ],
    });
    getRuntimeValue.mockReturnValue(null);

    expireStaleEffects('MyCampaign');

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
    getRuntimeValue.mockReturnValueOnce(list);
    getCurrentCombatRound.mockReturnValue(2);

    expireStaleEffects('MyCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith('Human', 'stunned_speedHalved', null, 'MyCampaign');

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

    const finalCall = setRuntimeValue.mock.calls.find(
        (c) => c[0] === 'Goblin' && c[1] === KEY
      );
    expect(finalCall).toBeUndefined();
   });

  it('handles empty combat summary gracefully', () => {
    getCombatSummary.mockReturnValue(null);

    expireStaleEffects('MyCampaign');

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
      { target: 'A', effects: [{ type: 'stunned', condition: 'speed_halved' }], appliedRound: 0 },
      { target: 'B', effects: [{ type: 'stunned' }], appliedRound: 1 },
      { target: 'C', effects: [{ type: 'advantage_on_target' }], appliedRound: 2 },
    ];

    getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
    getCurrentCombatRound.mockReturnValue(2);
    getRuntimeValue.mockReturnValueOnce(list);

    expireStaleEffects('MyCampaign');

    const finalCall = setRuntimeValue.mock.calls.find(
      (c) => c[0] === 'Goblin' && c[1] === KEY
    );
    expect(finalCall).toBeTruthy();
    expect(finalCall[2]).toEqual([list[2]]);
  });

  it('clears advantage_on_target stale effect for matching attacker', () => {
    const list = [
      { target: 'Human', effects: [{ type: 'advantage_on_target' }], appliedRound: 0 },
    ];

    getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
    getCurrentCombatRound.mockReturnValue(5);

    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'Goblin' && key === KEY) return list;
      if (key === `_advantageOn_Human`) return ['Human'];
      return null;
    });

    expireStaleEffects('MyCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Goblin',
      `_advantageOn_Human`,
      [],
      'MyCampaign'
    );
  });

  it('clears stunned condition when stale entry has type/stunned combo', () => {
    const list = [
      { target: 'Human', effects: [{ type: 'stunned', condition: 'stunned' }], appliedRound: 0 },
    ];

    getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
    getCurrentCombatRound.mockReturnValue(5);

    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'Goblin' && key === KEY) return list;
      if (name === 'Human' && key === 'activeConditions') return ['stunned'];
      return null;
    });

    expireStaleEffects('MyCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Human',
      'activeConditions',
      [],
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

    for (const call of setRuntimeValue.mock.calls) {
      expect(call[3]).toBe('TestCampaign');
    }
  });
});

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
  });

  it('skips creature whose name does not match after utils.getName transform', () => {
    utils.getName.mockImplementation((v) => v);
    getCombatSummary.mockReturnValue({
      creatures: [
        { name: 'Orc' },
      ],
    });

    expireStaleEffects('MyCampaign');

    expect(getRuntimeValue).not.toHaveBeenCalled();
  });

  it('processes creature whose name matches after utils.getName transform', () => {
    utils.getName.mockImplementation((v) => (v === 'goblin' ? 'Goblin' : v));
    getCombatSummary.mockReturnValue({
      creatures: [
        { name: 'Orc' },
        { name: 'goblin' },
      ],
    });
    getRuntimeValue.mockReturnValue([
      { target: 'Human', effects: [{ type: 'stunned', condition: 'speed_halved' }], appliedRound: 0 },
    ]);

    expireStaleEffects('MyCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Human',
      'stunned_speedHalved',
      null,
      'MyCampaign'
    );
  });

  it('handles when getRuntimeValue returns non-array pendingExpirations for an attacker', () => {
    getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
    getRuntimeValue.mockReturnValueOnce('not-an-array');

    expect(() => expireStaleEffects('MyCampaign')).not.toThrow();
  });

  it('clears fly_speed_equals_walk_speed effect via expireStaleEffects', () => {
    const list = [
      { target: 'Human', effects: [{ type: 'fly_speed_equals_walk_speed' }], appliedRound: 0 },
    ];
    getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
    getCurrentCombatRound.mockReturnValue(3);

    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'Goblin' && key === KEY) return list;
      return null;
    });

    expireStaleEffects('MyCampaign');

    const filterCall = setRuntimeValue.mock.calls.find(
      (c) => c[1] === 'activeBuffs' && c[0] === 'Human'
    );
    expect(filterCall).toBeTruthy();
    expect(filterCall[2]).toEqual([]);

    const finalCall = setRuntimeValue.mock.calls.find(
      (c) => c[0] === 'Goblin' && c[1] === KEY
    );
    expect(finalCall).toBeTruthy();
    expect(finalCall[2]).toEqual([]);
  });

  it('clears remove_active_buff effect via expireStaleEffects', () => {
    const list = [
      { target: 'Human', effects: [{ type: 'remove_active_buff', buffName: 'RecklessAttack' }], appliedRound: 0 },
    ];
    getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
    getCurrentCombatRound.mockReturnValue(3);

    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'Goblin' && key === KEY) return list;
      return null;
    });

    expireStaleEffects('MyCampaign');

    const filterCall = setRuntimeValue.mock.calls.find(
      (c) => c[1] === 'activeBuffs' && c[0] === 'Human'
    );
    expect(filterCall).toBeTruthy();
    expect(filterCall[2]).toEqual([]);
  });

  it('clears remove_bardic_inspiration effect via expireStaleEffects', () => {
    const list = [
      { target: 'Human', effects: [{ type: 'remove_bardic_inspiration' }], appliedRound: 0 },
    ];
    getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
    getCurrentCombatRound.mockReturnValue(3);

    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'Goblin' && key === KEY) return list;
      return null;
    });

    expireStaleEffects('MyCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith('Human', 'bardicInspirationDie', null, 'MyCampaign');
    expect(setRuntimeValue).toHaveBeenCalledWith('Human', 'bardicInspirationGrantedBy', null, 'MyCampaign');
    expect(setRuntimeValue).toHaveBeenCalledWith('Human', 'bardicInspirationCombatOptions', null, 'MyCampaign');
  });

  it('clears inspiring_movement_no_oa effect via expireStaleEffects', () => {
    const list = [
      { target: 'Human', effects: [{ type: 'inspiring_movement_no_oa' }], appliedRound: 0 },
    ];
    getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
    getCurrentCombatRound.mockReturnValue(3);

    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'Goblin' && key === KEY) return list;
      return null;
    });

    expireStaleEffects('MyCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith('Human', 'inspiringMovementNoOA', null, 'MyCampaign');
  });

  it('clears inspiring_movement_granted effect via expireStaleEffects', () => {
    const list = [
      { target: 'Human', effects: [{ type: 'inspiring_movement_granted' }], appliedRound: 0 },
    ];
    getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
    getCurrentCombatRound.mockReturnValue(3);

    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'Goblin' && key === KEY) return list;
      return null;
    });

    expireStaleEffects('MyCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith('Human', 'inspiringMovementGranted', null, 'MyCampaign');
  });

  it('clears unbreakable_majesty effect via expireStaleEffects', () => {
    const list = [
      { target: 'Human', effects: [{ type: 'unbreakable_majesty' }], appliedRound: 0 },
    ];
    getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
    getCurrentCombatRound.mockReturnValue(3);

    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'Goblin' && key === KEY) return list;
      return null;
    });

    expireStaleEffects('MyCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith('Human', 'unbreakableMajestyActive', null, 'MyCampaign');
    expect(setRuntimeValue).toHaveBeenCalledWith('Human', 'unbreakableMajestySaveDc', null, 'MyCampaign');
  });

  it('cleared activeBuffs with fly_speed_equals_walk_speed mixed with other buffs', () => {
    const list = [
      { target: 'Human', effects: [{ type: 'fly_speed_equals_walk_speed' }], appliedRound: 0 },
    ];
    getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
    getCurrentCombatRound.mockReturnValue(3);

    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'Goblin' && key === KEY) return list;
      if (name === 'Human' && key === 'activeBuffs') return [
        { effect: 'fly_speed_equals_walk_speed', duration: 3 },
        { effect: 'double_move', duration: 2 },
      ];
      return null;
    });

    expireStaleEffects('MyCampaign');

    const filterCall = setRuntimeValue.mock.calls.find(
      (c) => c[1] === 'activeBuffs' && c[0] === 'Human'
    );
    expect(filterCall).toBeTruthy();
    expect(filterCall[2]).toEqual([{ effect: 'double_move', duration: 2 }]);
  });

  it('cleared activeBuffs with remove_active_buff mixed with other buffs', () => {
    const list = [
      { target: 'Human', effects: [{ type: 'remove_active_buff', buffName: 'RecklessAttack' }], appliedRound: 0 },
    ];
    getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
    getCurrentCombatRound.mockReturnValue(3);

    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'Goblin' && key === KEY) return list;
      if (name === 'Human' && key === 'activeBuffs') return [
        { name: 'RecklessAttack', duration: 3 },
        { name: 'DivineSmite', duration: 2 },
      ];
      return null;
    });

    expireStaleEffects('MyCampaign');

    const filterCall = setRuntimeValue.mock.calls.find(
      (c) => c[1] === 'activeBuffs' && c[0] === 'Human'
    );
    expect(filterCall).toBeTruthy();
    expect(filterCall[2]).toEqual([{ name: 'DivineSmite', duration: 2 }]);
  });

  it('handles clearing condition type effect via expireStaleEffects', () => {
    const list = [
      { target: 'Orc', effects: [{ type: 'condition', condition: 'poisoned' }], appliedRound: 0 },
    ];
    getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
    getCurrentCombatRound.mockReturnValue(3);

    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'Goblin' && key === KEY) return list;
      if (name === 'Orc' && key === 'activeConditions') return ['poisoned'];
      return null;
    });

    expireStaleEffects('MyCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith('Orc', 'activeConditions', [], 'MyCampaign');
    expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', KEY, [], 'MyCampaign');
  });

  it('removes NPC condition via removeNpcCondition when matching NPC found in combat summary', () => {
    const list = [
      { target: 'Orc', effects: [{ type: 'condition', condition: 'poisoned' }], appliedRound: 0 },
    ];
    getCombatSummary.mockReturnValue({
      creatures: [
        { name: 'Goblin', conditions: [] },
        { name: 'Orc', conditions: [{ key: 'poisoned' }, { key: 'exhausted' }] },
      ],
    });
    getCurrentCombatRound.mockReturnValue(3);

    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'Goblin' && key === KEY) return list;
      if (name === 'Orc' && key === 'activeConditions') return ['poisoned'];
      return null;
    });

    expireStaleEffects('MyCampaign');

    expect(storage.set).toHaveBeenCalledWith(
      'combatSummary',
      {
        creatures: [
          { name: 'Goblin', conditions: [] },
          { name: 'Orc', conditions: [{ key: 'exhausted' }] },
        ],
      },
      'MyCampaign'
    );
    expect(window.dispatchEvent).toHaveBeenCalled();
  });
});


