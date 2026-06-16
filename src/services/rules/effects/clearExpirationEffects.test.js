import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
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

import { expireStaleEffects, clearAllExpirationEffects } from './expirations.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import utils from '../../ui/utils.js';
import { getCurrentCombatRound, getActiveCreatureName, getCombatSummary } from '../../encounters/combatData.js';

const KEY = 'pendingExpirations';

function resetMocks() {
  vi.clearAllMocks();
  localStorage.clear();
  window.dispatchEvent = vi.fn();
}

function stubUtilsNameIdentity() {
  utils.getName.mockImplementation((v) => v);
}

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

    expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', KEY, [], 'MyCampaign');
  });

  it('does nothing when effects is not an array', () => {
    const myList = [
      { target: 'Human', effects: 'string', appliedRound: 1 },
    ];
    getRuntimeValue.mockReturnValueOnce(myList);

    clearAllExpirationEffects('Goblin', 'MyCampaign');

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
  });

  it('handles advantage_on_target when storedAdv is null (not array)', () => {
    const myList = [
      { target: 'Human', effects: [{ type: 'advantage_on_target' }], appliedRound: 1 },
    ];
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'Goblin' && key === KEY) return myList;
      return null;
    });

    clearAllExpirationEffects('Goblin', 'MyCampaign');

    const advCall = setRuntimeValue.mock.calls.find((c) => c[1].startsWith('_advantageOn_'));
    expect(advCall).toBeUndefined();
  });

  it('handles advantage_on_target when storedAdv does not include targetName', () => {
    const myList = [
      { target: 'Human', effects: [{ type: 'advantage_on_target' }], appliedRound: 1 },
    ];
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'Goblin' && key === KEY) return myList;
      if (key === `_advantageOn_Human`) return ['Orc', 'Elf'];
      return null;
    });

    clearAllExpirationEffects('Goblin', 'MyCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', KEY, [], 'MyCampaign');
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
      ['Orc', 'Elf'],
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

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Goblin',
      `_advantageOn_Human`,
      [],
      'MyCampaign'
    );
  });

  it('handles clearing condition type effect via clearAllExpirationEffects', () => {
    const myList = [
      { target: 'Orc', effects: [{ type: 'condition', condition: 'stunned' }], appliedRound: 1 },
    ];
    getRuntimeValue.mockReturnValueOnce(myList);
    getRuntimeValue.mockReturnValueOnce([]);

    clearAllExpirationEffects('Goblin', 'MyCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith('Orc', 'activeConditions', [], 'MyCampaign');
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
      if (name === 'Human' && key === 'activeConditions') return ['stunned', 'poisoned'];
      return null;
    });

    clearAllExpirationEffects('Goblin', 'MyCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Human',
      'activeConditions',
      ['poisoned'],
      'MyCampaign'
    );
  });

  it('does nothing when activeConditions is not an array', () => {
    const myList = [
      { target: 'Human', effects: [{ type: 'stunned', condition: 'stunned' }], appliedRound: 1 },
    ];
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'Goblin' && key === KEY) return myList;
      if (name === 'Human' && key === 'activeConditions') return 'stunned';
      return null;
    });

    clearAllExpirationEffects('Goblin', 'MyCampaign');

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

    clearAllExpirationEffects('Goblin', 'MyCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Human',
      'activeConditions',
      ['STUNNED'],
      'MyCampaign'
    );
  });

  it('uses utils.getName for target name in removeActiveCondition', () => {
    const myList = [
      { target: 'Human', effects: [{ type: 'stunned', condition: 'stunned' }], appliedRound: 1 },
    ];
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'Goblin' && key === KEY) return myList;
      if (name === 'Human' && key === 'activeConditions') return ['stunned'];
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
      ['frightened', 'blinded'],
      'MyCampaign'
    );
  });

  it('handles getRuntimeValue returning null for activeConditions', () => {
    const myList = [
      { target: 'Human', effects: [{ type: 'stunned', condition: 'stunned' }], appliedRound: 1 },
    ];
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'Goblin' && key === KEY) return myList;
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

    const finalCall = setRuntimeValue.mock.calls.find(
      (c) => c[0] === 'Goblin' && c[1] === KEY
    );
    expect(finalCall).toBeTruthy();
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
    expect(finalCall[2]).toEqual([]);
  });

  it('handles advantage_on_target with storedAdv being an empty array', () => {
    const list = [
      { target: 'Human', effects: [{ type: 'advantage_on_target' }], appliedRound: 0 },
    ];
    getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'Goblin' && key === KEY) return list;
      if (key === `_advantageOn_Human`) return [];
      return null;
    });

    expireStaleEffects('MyCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Goblin',
      KEY,
      [],
      'MyCampaign'
    );
    const advCall = setRuntimeValue.mock.calls.find((c) => c[1].startsWith('_advantageOn_'));
    expect(advCall).toBeUndefined();
  });
});
