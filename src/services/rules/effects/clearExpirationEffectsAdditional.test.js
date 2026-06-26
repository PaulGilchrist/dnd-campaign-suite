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

import { clearAllExpirationEffects } from './expirations.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import utils from '../../ui/utils.js';
import storage from '../../ui/storage.js';
import { getCombatSummary } from '../../encounters/combatData.js';

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
// remove_target_effect and bait_and_switch_clear effect types
// ---------------------------------------------------------------------------
describe('remove_target_effect effect type', () => {
  beforeEach(() => {
    resetMocks();
    stubUtilsNameIdentity();
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeConditions') return [];
      if (key.startsWith('_advantageOn_')) return [];
      return null;
    });
  });

  it('removes target effect by effectKey and source', () => {
    const myList = [
      { target: 'Human', effects: [{ type: 'remove_target_effect', effectKey: 'blinded', source: 'RayOfSickness' }], appliedRound: 1 },
    ];
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === KEY && name === 'Goblin') return myList;
      if (name === 'MyCampaign' && key === 'targetEffects') return [
        { effect: 'blinded', source: 'RayOfSickness' },
        { effect: 'slow', source: 'Slow' },
      ];
      if (key === 'activeConditions') return [];
      if (key === KEY) return [];
      return null;
    });

    clearAllExpirationEffects('Goblin', 'MyCampaign');

    const teCall = setRuntimeValue.mock.calls.find(
      (c) => c[0] === 'MyCampaign' && c[1] === 'targetEffects'
    );
    expect(teCall).toBeTruthy();
    expect(teCall[2]).toEqual([{ effect: 'slow', source: 'Slow' }]);
  });

  it('preserves other target effects that do not match', () => {
    const myList = [
      { target: 'Human', effects: [{ type: 'remove_target_effect', effectKey: 'blinded', source: 'RayOfSickness' }], appliedRound: 1 },
    ];
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === KEY && name === 'Goblin') return myList;
      if (name === 'MyCampaign' && key === 'targetEffects') return [
        { effect: 'blinded', source: 'RayOfSickness' },
        { effect: 'blinded', source: 'OtherSpell' },
        { effect: 'slow', source: 'Slow' },
      ];
      if (key === 'activeConditions') return [];
      if (key === KEY) return [];
      return null;
    });

    clearAllExpirationEffects('Goblin', 'MyCampaign');

    const teCall = setRuntimeValue.mock.calls.find(
      (c) => c[0] === 'MyCampaign' && c[1] === 'targetEffects'
    );
    expect(teCall).toBeTruthy();
    expect(teCall[2]).toEqual([
      { effect: 'blinded', source: 'OtherSpell' },
      { effect: 'slow', source: 'Slow' },
    ]);
  });

  it('handles empty targetEffects array', () => {
    const myList = [
      { target: 'Human', effects: [{ type: 'remove_target_effect', effectKey: 'blinded', source: 'RayOfSickness' }], appliedRound: 1 },
    ];
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === KEY && name === 'Goblin') return myList;
      if (name === 'MyCampaign' && key === 'targetEffects') return [];
      if (key === 'activeConditions') return [];
      if (key === KEY) return [];
      return null;
    });

    clearAllExpirationEffects('Goblin', 'MyCampaign');

    const teCall = setRuntimeValue.mock.calls.find(
      (c) => c[0] === 'MyCampaign' && c[1] === 'targetEffects'
    );
    expect(teCall).toBeTruthy();
    expect(teCall[2]).toEqual([]);
  });
});

describe('bait_and_switch_clear effect type', () => {
  beforeEach(() => {
    resetMocks();
    stubUtilsNameIdentity();
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeConditions') return [];
      if (key.startsWith('_advantageOn_')) return [];
      return null;
    });
  });

  it('clears baitAndSwitch state when wasActive is true', () => {
    const myList = [
      { target: 'Human', effects: [{ type: 'bait_and_switch_clear' }], appliedRound: 1 },
    ];
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'Human' && key === 'baitAndSwitchActive') return true;
      if (key === KEY && name === 'Goblin') return myList;
      if (key === KEY) return [];
      return null;
    });

    clearAllExpirationEffects('Goblin', 'MyCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Human',
      'baitAndSwitchActive',
      null,
      'MyCampaign'
    );
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Human',
      'baitAndSwitchBonus',
      null,
      'MyCampaign'
    );
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Human',
      'baitAndSwitchSource',
      null,
      'MyCampaign'
    );
  });

  it('does nothing when baitAndSwitchActive is false', () => {
    const myList = [
      { target: 'Human', effects: [{ type: 'bait_and_switch_clear' }], appliedRound: 1 },
    ];
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'Human' && key === 'baitAndSwitchActive') return false;
      if (key === KEY && name === 'Goblin') return myList;
      if (key === KEY) return [];
      return null;
    });

    clearAllExpirationEffects('Goblin', 'MyCampaign');

    const baitCalls = setRuntimeValue.mock.calls.filter(
      (c) => c[0] === 'Human' && c[1].startsWith('baitAndSwitch')
    );
    expect(baitCalls).toHaveLength(0);
  });

  it('does nothing when baitAndSwitchActive is null', () => {
    const myList = [
      { target: 'Human', effects: [{ type: 'bait_and_switch_clear' }], appliedRound: 1 },
    ];
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'Human' && key === 'baitAndSwitchActive') return null;
      if (key === KEY && name === 'Goblin') return myList;
      if (key === KEY) return [];
      return null;
    });

    clearAllExpirationEffects('Goblin', 'MyCampaign');

    const baitCalls = setRuntimeValue.mock.calls.filter(
      (c) => c[0] === 'Human' && c[1].startsWith('baitAndSwitch')
    );
    expect(baitCalls).toHaveLength(0);
  });
});
