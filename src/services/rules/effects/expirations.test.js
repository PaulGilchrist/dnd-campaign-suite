// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  applyTurnStartEffects,
  addExpiration,
  clearAllExpirationEffects,
  expireStaleEffects,
} from './expirations.js';

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

import { getRuntimeValue, setRuntimeValue, getAllStoreKeys } from '../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary, getCurrentCombatRound, getActiveCreatureName } from '../../encounters/combatData.js';

function resetMocks() {
  vi.clearAllMocks();
  localStorage.clear();
  window.dispatchEvent = vi.fn();
}

function mockNoTargetEffects() {
  getRuntimeValue.mockImplementation((_name, prop) => {
    if (prop === 'targetEffects') return [];
    return null;
  });
}

// ---------------------------------------------------------------------------
// applyTurnStartEffects
// ---------------------------------------------------------------------------
describe('applyTurnStartEffects', () => {
  beforeEach(() => {
    resetMocks();
    mockNoTargetEffects();
  });

  it('returns early without side effects when activeName is null', () => {
    applyTurnStartEffects(null, { turnStartEffects: [] }, 'TestCampaign');
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('returns early without side effects when playerStats is null', () => {
    applyTurnStartEffects('TestCharacter', null, 'TestCampaign');
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('throws when playerStats has no turnStartEffects property', () => {
    expect(() => applyTurnStartEffects('TestCharacter', {}, 'TestCampaign')).toThrow(
      'Expected array for turnStartEffects',
    );
  });

  it('returns early when turnStartEffects is an empty array', () => {
    applyTurnStartEffects('TestCharacter', { turnStartEffects: [] }, 'TestCampaign');
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('grants hasInspiration at turn start when heroic_inspiration effect is present and not already set', () => {
    getRuntimeValue.mockImplementation((_name, prop) => {
      if (prop === 'hasInspiration') return false;
      if (prop === 'targetEffects') return [];
      return null;
    });

    applyTurnStartEffects('TestCharacter', {
      turnStartEffects: [{ type: 'heroic_inspiration', name: 'Heroic Warrior' }],
    }, 'TestCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'TestCharacter',
      'hasInspiration',
      true,
      'TestCampaign',
    );
  });

  it('does not grant hasInspiration when it is already true', () => {
    getRuntimeValue.mockImplementation((_name, prop) => {
      if (prop === 'hasInspiration') return true;
      if (prop === 'targetEffects') return [];
      return null;
    });

    applyTurnStartEffects('TestCharacter', {
      turnStartEffects: [{ type: 'heroic_inspiration', name: 'Heroic Warrior' }],
    }, 'TestCampaign');

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('ignores unknown effect types without side effects', () => {
    getRuntimeValue.mockImplementation((_name, prop) => {
      if (prop === 'hasInspiration') return false;
      if (prop === 'targetEffects') return [];
      return null;
    });

    applyTurnStartEffects('TestCharacter', {
      turnStartEffects: [{ type: 'unknown_effect', name: 'Some Feature' }],
    }, 'TestCampaign');

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('removes only matching conditions from activeConditions', () => {
    getRuntimeValue.mockImplementation((_name, prop) => {
      if (prop === 'activeConditions') return ['charmed', 'poisoned', 'blinded'];
      if (prop === 'targetEffects') return [];
      return null;
    });

    applyTurnStartEffects('TestCharacter', {
      turnStartEffects: [
        {
          type: 'condition_removal',
          name: 'Self-Restoration',
          conditions: ['charmed', 'frightened', 'poisoned'],
        },
      ],
    }, 'TestCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'TestCharacter',
      'activeConditions',
      ['blinded'],
      'TestCampaign',
    );
  });

  it('does not call setRuntimeValue when no conditions match for removal', () => {
    getRuntimeValue.mockImplementation((_name, prop) => {
      if (prop === 'activeConditions') return ['blinded', 'grappled'];
      if (prop === 'targetEffects') return [];
      return null;
    });

    applyTurnStartEffects('TestCharacter', {
      turnStartEffects: [
        {
          type: 'condition_removal',
          name: 'Self-Restoration',
          conditions: ['charmed', 'frightened', 'poisoned'],
        },
      ],
    }, 'TestCampaign');

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('performs case-insensitive condition matching', () => {
    getRuntimeValue.mockImplementation((_name, prop) => {
      if (prop === 'activeConditions') return ['CHARMED', 'Poisoned', 'Blinded'];
      if (prop === 'targetEffects') return [];
      return null;
    });

    applyTurnStartEffects('TestCharacter', {
      turnStartEffects: [
        {
          type: 'condition_removal',
          name: 'Self-Restoration',
          conditions: ['charmed', 'frightened', 'poisoned'],
        },
      ],
    }, 'TestCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'TestCharacter',
      'activeConditions',
      ['Blinded'],
      'TestCampaign',
    );
  });

  describe('umbral_sight', () => {
    it('adds invisible condition when in darkness and not already invisible', async () => {
      getRuntimeValue.mockImplementation((_name, prop) => {
        if (prop === 'umbralSightDarknessActive') return true;
        if (prop === 'activeConditions') return ['fatigued'];
        if (prop === 'targetEffects') return [];
        return null;
      });

      await applyTurnStartEffects('TestCharacter', {
        turnStartEffects: [{ type: 'umbral_sight', name: 'Umbral Sight' }],
      }, 'TestCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCharacter',
        'activeConditions',
        ['fatigued', 'invisible'],
        'TestCampaign',
      );
    });

    it('removes invisible condition when not in darkness and currently invisible', async () => {
      getRuntimeValue.mockImplementation((_name, prop) => {
        if (prop === 'umbralSightDarknessActive') return false;
        if (prop === 'activeConditions') return ['fatigued', 'invisible'];
        if (prop === 'targetEffects') return [];
        return null;
      });

      await applyTurnStartEffects('TestCharacter', {
        turnStartEffects: [{ type: 'umbral_sight', name: 'Umbral Sight' }],
      }, 'TestCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCharacter',
        'activeConditions',
        ['fatigued'],
        'TestCampaign',
      );
    });

    it('does nothing when in darkness and already invisible', async () => {
      getRuntimeValue.mockImplementation((_name, prop) => {
        if (prop === 'umbralSightDarknessActive') return true;
        if (prop === 'activeConditions') return ['fatigued', 'invisible'];
        if (prop === 'targetEffects') return [];
        return null;
      });

      await applyTurnStartEffects('TestCharacter', {
        turnStartEffects: [{ type: 'umbral_sight', name: 'Umbral Sight' }],
      }, 'TestCampaign');

      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('does nothing when not in darkness and not already invisible', async () => {
      getRuntimeValue.mockImplementation((_name, prop) => {
        if (prop === 'umbralSightDarknessActive') return false;
        if (prop === 'activeConditions') return ['fatigued'];
        if (prop === 'targetEffects') return [];
        return null;
      });

      await applyTurnStartEffects('TestCharacter', {
        turnStartEffects: [{ type: 'umbral_sight', name: 'Umbral Sight' }],
      }, 'TestCampaign');

      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('handles null activeConditions gracefully (treats as empty array)', () => {
      getRuntimeValue.mockImplementation((_name, prop) => {
        if (prop === 'umbralSightDarknessActive') return true;
        if (prop === 'activeConditions') return null;
        if (prop === 'targetEffects') return [];
        return null;
      });

      // umbralSightTurnStart uses Array.isArray() guard, treating null as []
      // When in darkness with no conditions, should add 'invisible'
      applyTurnStartEffects('TestCharacter', {
        turnStartEffects: [{ type: 'umbral_sight', name: 'Umbral Sight' }],
      }, 'TestCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCharacter',
        'activeConditions',
        ['invisible'],
        'TestCampaign',
      );
    });
  });

  describe('regenerate turn-start healing', () => {
    it('heals when regenerateActive is true', () => {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (name === 'Target' && prop === 'regenerateActive') return true;
        if (name === 'Target' && prop === 'currentHitPoints') return 10;
        if (name === 'Target' && prop === 'hitPoints') return 20;
        if (prop === 'targetEffects') return [];
        return null;
      });
      setRuntimeValue.mockResolvedValue(undefined);

      applyTurnStartEffects('Target', {
        turnStartEffects: [{ type: 'regenerate_turn_start_heal' }],
      }, 'TestCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Target',
        'currentHitPoints',
        11,
        'TestCampaign',
      );
    });

    it('does not heal when regenerateActive is false', () => {
      getRuntimeValue.mockImplementation((_name, prop) => {
        if (prop === 'regenerateActive') return false;
        if (prop === 'targetEffects') return [];
        return null;
      });

      applyTurnStartEffects('Target', {
        turnStartEffects: [{ type: 'regenerate_turn_start_heal' }],
      }, 'TestCampaign');

      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('does not heal when regenerateActive is undefined', () => {
      getRuntimeValue.mockImplementation((_name, prop) => {
        if (prop === 'regenerateActive') return undefined;
        if (prop === 'targetEffects') return [];
        return null;
      });

      applyTurnStartEffects('Target', {
        turnStartEffects: [{ type: 'regenerate_turn_start_heal' }],
      }, 'TestCampaign');

      expect(setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('resistance_used flags', () => {
    it('resets resistanceUsedThisTurn when it was true', () => {
      getRuntimeValue.mockImplementation((_name, prop) => {
        if (prop === 'resistanceUsedThisTurn') return true;
        if (prop === 'targetEffects') return [];
        return null;
      });

      applyTurnStartEffects('TestCharacter', { turnStartEffects: [] }, 'TestCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCharacter',
        'resistanceUsedThisTurn',
        false,
        'TestCampaign',
      );
    });

    it('does not reset resistanceUsedThisTurn when it was false', () => {
      getRuntimeValue.mockImplementation((_name, prop) => {
        if (prop === 'resistanceUsedThisTurn') return false;
        if (prop === 'targetEffects') return [];
        return null;
      });

      applyTurnStartEffects('TestCharacter', { turnStartEffects: [] }, 'TestCampaign');

      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('resets portentUsedThisTurn when it was true', () => {
      getRuntimeValue.mockImplementation((_name, prop) => {
        if (prop === 'portentUsedThisTurn') return true;
        if (prop === 'targetEffects') return [];
        return null;
      });

      applyTurnStartEffects('TestCharacter', { turnStartEffects: [] }, 'TestCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCharacter',
        'portentUsedThisTurn',
        false,
        'TestCampaign',
      );
    });

    it('does not reset portentUsedThisTurn when it was false', () => {
      getRuntimeValue.mockImplementation((_name, prop) => {
        if (prop === 'portentUsedThisTurn') return false;
        if (prop === 'targetEffects') return [];
        return null;
      });

      applyTurnStartEffects('TestCharacter', { turnStartEffects: [] }, 'TestCampaign');

      expect(setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('targetEffects cleanup', () => {
    it('removes multiattack_defense from targetEffects', () => {
      getRuntimeValue.mockImplementation((_name, prop) => {
        if (prop === 'targetEffects') {
          return [
            { effect: 'multiattack_defense' },
            { effect: 'slow' },
          ];
        }
        return null;
      });

      applyTurnStartEffects('TestCharacter', { turnStartEffects: [] }, 'TestCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCampaign',
        'targetEffects',
        [{ effect: 'slow' }],
        'TestCampaign',
      );
    });

    it('does not call setRuntimeValue when no multiattack_defense in targetEffects', () => {
      getRuntimeValue.mockImplementation((_name, prop) => {
        if (prop === 'targetEffects') return [{ effect: 'slow' }];
        return null;
      });

      applyTurnStartEffects('TestCharacter', { turnStartEffects: [] }, 'TestCampaign');

      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('removes sap weapon mastery disadvantage after attacker turn', () => {
      getCurrentCombatRound.mockReturnValue(6);
      getRuntimeValue.mockImplementation((_name, prop) => {
        if (prop === 'targetEffects') {
          return [
            { effect: 'disadvantage_next_attack', target: 'TestCharacter', appliedRound: 5 },
          ];
        }
        return null;
      });

      applyTurnStartEffects('TestCharacter', { turnStartEffects: [] }, 'TestCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCampaign',
        'targetEffects',
        [],
        'TestCampaign',
      );
    });

    it('removes topple weapon mastery prone after target turn', () => {
      getCurrentCombatRound.mockReturnValue(6);
      getRuntimeValue.mockImplementation((_name, prop) => {
        if (prop === 'targetEffects') {
          return [
            { effect: 'topple', target: 'EnemyCreature', appliedRound: 5 },
          ];
        }
        if (prop === 'activeConditions') return ['prone', 'fatigued'];
        return null;
      });

      applyTurnStartEffects('TestCharacter', { turnStartEffects: [] }, 'TestCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCampaign',
        'targetEffects',
        [],
        'TestCampaign',
      );
    });

    it('removes slow weapon mastery speed_reduction at start of each turn', () => {
      getRuntimeValue.mockImplementation((_name, prop) => {
        if (prop === 'targetEffects') {
          return [
            { effect: 'speed_reduction', source: 'Slow' },
            { effect: 'slow' },
          ];
        }
        return null;
      });

      applyTurnStartEffects('TestCharacter', { turnStartEffects: [] }, 'TestCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCampaign',
        'targetEffects',
        [{ effect: 'slow' }],
        'TestCampaign',
      );
    });
  });

  describe('multiple effect types in one turn', () => {
    it('processes both heroic_inspiration and condition_removal effects', () => {
      getRuntimeValue.mockImplementation((_name, prop) => {
        if (prop === 'hasInspiration') return false;
        if (prop === 'activeConditions') return ['charmed', 'blinded'];
        if (prop === 'targetEffects') return [];
        return null;
      });

      applyTurnStartEffects('TestCharacter', {
        turnStartEffects: [
          { type: 'heroic_inspiration', name: 'Heroic Warrior' },
          {
            type: 'condition_removal',
            name: 'Self-Restoration',
            conditions: ['charmed'],
          },
        ],
      }, 'TestCampaign');

      // Should have been called for hasInspiration and activeConditions
      expect(setRuntimeValue).toHaveBeenCalledTimes(2);
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCharacter',
        'hasInspiration',
        true,
        'TestCampaign',
      );
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCharacter',
        'activeConditions',
        ['blinded'],
        'TestCampaign',
      );
    });
  });
});

// ---------------------------------------------------------------------------
// addExpiration
// ---------------------------------------------------------------------------
describe('addExpiration', () => {
  beforeEach(() => {
    resetMocks();
    getCurrentCombatRound.mockReturnValue(5);
  });

  it('adds an expiration entry to the attacker runtime store', () => {
    getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'pendingExpirations') return [];
      if (key === 'targetEffects') return [];
      return null;
    });

    addExpiration('Caster', 'Target', [{ type: 'stunned' }], 'TestCampaign', 3);

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Caster',
      'pendingExpirations',
      expect.arrayContaining([
        expect.objectContaining({
          target: 'Target',
          effects: [{ type: 'stunned' }],
          appliedRound: 5,
          expiryRounds: 3,
        }),
      ]),
      'TestCampaign',
    );
  });

  it('throws when rounds is null', () => {
    getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'pendingExpirations') return [];
      if (key === 'targetEffects') return [];
      return null;
    });

    expect(() =>
      addExpiration('Caster', 'Target', [{ type: 'stunned' }], 'TestCampaign', null),
    ).toThrow('rounds is required');
  });

  it('throws when rounds is undefined', () => {
    getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'pendingExpirations') return [];
      if (key === 'targetEffects') return [];
      return null;
    });

    expect(() =>
      addExpiration('Caster', 'Target', [{ type: 'stunned' }], 'TestCampaign', undefined),
    ).toThrow('rounds is required');
  });

  it('throws when pendingExpirations is not an array', () => {
    getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'pendingExpirations') return 'not-an-array';
      return null;
    });

    expect(() =>
      addExpiration('Caster', 'Target', [{ type: 'stunned' }], 'TestCampaign', 3),
    ).toThrow('Missing array: pendingExpirations');
  });

  it('appends to existing expiration list', () => {
    getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'pendingExpirations') return [{ target: 'ExistingTarget', effects: [], appliedRound: 2, expiryRounds: 2 }];
      if (key === 'targetEffects') return [];
      return null;
    });

    addExpiration('Caster', 'NewTarget', [{ type: 'blinded' }], 'TestCampaign', 5);

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Caster',
      'pendingExpirations',
      expect.arrayContaining([
        expect.objectContaining({ target: 'ExistingTarget' }),
        expect.objectContaining({ target: 'NewTarget' }),
      ]),
      'TestCampaign',
    );
  });

  it('uses getCurrentCombatRound for appliedRound', () => {
    getCurrentCombatRound.mockReturnValue(10);
    getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'pendingExpirations') return [];
      if (key === 'targetEffects') return [];
      return null;
    });

    addExpiration('Caster', 'Target', [{ type: 'stunned' }], 'TestCampaign', 3);

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Caster',
      'pendingExpirations',
      expect.arrayContaining([
        expect.objectContaining({ appliedRound: 10 }),
      ]),
      'TestCampaign',
    );
  });
});

// ---------------------------------------------------------------------------
// clearAllExpirationEffects
// ---------------------------------------------------------------------------
describe('clearAllExpirationEffects', () => {
  beforeEach(() => resetMocks());

  it('clears activeBuffs for the character', () => {
    clearAllExpirationEffects('TestCharacter', 'TestCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'TestCharacter',
      'activeBuffs',
      [],
      'TestCampaign',
    );
  });

  it('clears mantleOfMajestyActive for the character', () => {
    clearAllExpirationEffects('TestCharacter', 'TestCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'TestCharacter',
      'mantleOfMajestyActive',
      null,
      'TestCampaign',
    );
  });

  it('clears pending expirations from the character', () => {
    getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'pendingExpirations') return [{ target: 'Target', effects: [], appliedRound: 1, expiryRounds: 1 }];
      if (key === 'targetEffects') return [];
      return null;
    });

    clearAllExpirationEffects('TestCharacter', 'TestCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'TestCharacter',
      'pendingExpirations',
      [],
      'TestCampaign',
    );
  });

  it('returns early when characterName is null', () => {
    clearAllExpirationEffects(null, 'TestCampaign');
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('returns early when campaignName is null', () => {
    clearAllExpirationEffects('TestCharacter', null);
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('returns early when either argument is falsy', () => {
    clearAllExpirationEffects('', 'TestCampaign');
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('clears pendingExpirations when it is not an array', () => {
    getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'pendingExpirations') return 'not-an-array';
      if (key === 'targetEffects') return [];
      return null;
    });

    clearAllExpirationEffects('TestCharacter', 'TestCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'TestCharacter',
      'pendingExpirations',
      [],
      'TestCampaign',
    );
  });

  it('scans other stores for entries targeting the character', () => {
    getAllStoreKeys.mockReturnValue(['OtherCreature', 'AnotherCreature']);
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'pendingExpirations') {
        if (name === 'OtherCreature') {
          return [
            { target: 'TestCharacter', effects: [{ type: 'stunned' }], appliedRound: 1, expiryRounds: 1 },
            { target: 'OtherCreature', effects: [{ type: 'blinded' }], appliedRound: 1, expiryRounds: 1 },
          ];
        }
        return [];
      }
      if (key === 'targetEffects') return [];
      return null;
    });

    clearAllExpirationEffects('TestCharacter', 'TestCampaign');

    // Should have called setRuntimeValue for: activeBuffs, mantleOfMajestyActive,
    // pendingExpirations (self), and OtherCreature's pendingExpirations
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'OtherCreature',
      'pendingExpirations',
      expect.arrayContaining([
        expect.objectContaining({ target: 'OtherCreature' }),
      ]),
      'TestCampaign',
    );
  });

  it('skips the character itself when scanning other stores', () => {
    getAllStoreKeys.mockReturnValue(['TestCharacter', 'OtherCreature']);
    getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'pendingExpirations') return [];
      if (key === 'targetEffects') return [];
      return null;
    });

    clearAllExpirationEffects('TestCharacter', 'TestCampaign');

    // Should only have calls for activeBuffs, mantleOfMajestyActive
    const buffCalls = setRuntimeValue.mock.calls.filter(
      (c) => c[0] === 'TestCharacter' && c[1] === 'pendingExpirations',
    );
    // Self pendingExpirations should have been cleared (empty array input)
    expect(buffCalls.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// expireStaleEffects
// ---------------------------------------------------------------------------
describe('expireStaleEffects', () => {
  beforeEach(() => resetMocks());

  it('returns early when activeName is null', () => {
    getActiveCreatureName.mockReturnValue(null);
    expireStaleEffects('TestCampaign');
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('skips creatures not matching activeName', () => {
    getActiveCreatureName.mockReturnValue('ActiveCreature');
    getCombatSummary.mockReturnValue({
      creatures: [
        { name: 'OtherCreature' },
        { name: 'ActiveCreature' },
      ],
    });
    getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'pendingExpirations') return [];
      if (key === 'targetEffects') return [];
      return null;
    });

    expireStaleEffects('TestCampaign');

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('clears expired entries and keeps non-expired', () => {
    getActiveCreatureName.mockReturnValue('ActiveCreature');
    getCurrentCombatRound.mockReturnValue(10);
    getCombatSummary.mockReturnValue({
      creatures: [{ name: 'ActiveCreature' }],
    });
    getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'pendingExpirations') {
        return [
          {
            target: 'ExpiredTarget',
            effects: [{ type: 'stunned' }],
            appliedRound: 5,
            expiryRounds: 3,
          },
          {
            target: 'ValidTarget',
            effects: [{ type: 'blinded' }],
            appliedRound: 8,
            expiryRounds: 3,
          },
        ];
      }
      if (key === 'targetEffects') return [];
      return null;
    });

    expireStaleEffects('TestCampaign');

    // Expired entry: round 5 + 3 = 8, current round 10 >= 8 → removed
    // Valid entry: round 8 + 3 = 11, current round 10 < 11 → kept
    const calls = setRuntimeValue.mock.calls.filter(
      (c) => c[1] === 'pendingExpirations',
    );
    expect(calls.length).toBeGreaterThan(0);
    const keptEntry = calls[0][2].find((e) => e.target === 'ValidTarget');
    expect(keptEntry).toBeDefined();
    const expiredEntry = calls[0][2].find((e) => e.target === 'ExpiredTarget');
    expect(expiredEntry).toBeUndefined();
  });

  it('clears all entries when all have expired', () => {
    getActiveCreatureName.mockReturnValue('ActiveCreature');
    getCurrentCombatRound.mockReturnValue(10);
    getCombatSummary.mockReturnValue({
      creatures: [{ name: 'ActiveCreature' }],
    });
    getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'pendingExpirations') {
        return [
          {
            target: 'Target1',
            effects: [{ type: 'stunned' }],
            appliedRound: 5,
            expiryRounds: 3,
          },
          {
            target: 'Target2',
            effects: [{ type: 'blinded' }],
            appliedRound: 6,
            expiryRounds: 2,
          },
        ];
      }
      if (key === 'targetEffects') return [];
      return null;
    });

    expireStaleEffects('TestCampaign');

    const calls = setRuntimeValue.mock.calls.filter(
      (c) => c[1] === 'pendingExpirations',
    );
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0][2]).toEqual([]);
  });

  it('handles empty pendingExpirations list', () => {
    getActiveCreatureName.mockReturnValue('ActiveCreature');
    getCombatSummary.mockReturnValue({
      creatures: [{ name: 'ActiveCreature' }],
    });
    getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'pendingExpirations') return [];
      if (key === 'targetEffects') return [];
      return null;
    });

    expireStaleEffects('TestCampaign');

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('returns early when combatSummary is null', () => {
    getActiveCreatureName.mockReturnValue('ActiveCreature');
    getCombatSummary.mockReturnValue(null);
    expireStaleEffects('TestCampaign');
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('returns early when combatSummary is not an object', () => {
    getActiveCreatureName.mockReturnValue('ActiveCreature');
    getCombatSummary.mockReturnValue('not-an-object');
    expireStaleEffects('TestCampaign');
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('returns early when creatures array is missing', () => {
    getActiveCreatureName.mockReturnValue('ActiveCreature');
    getCombatSummary.mockReturnValue({});
    expireStaleEffects('TestCampaign');
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('returns early when creatures is not an array', () => {
    getActiveCreatureName.mockReturnValue('ActiveCreature');
    getCombatSummary.mockReturnValue({ creatures: 'not-an-array' });
    expireStaleEffects('TestCampaign');
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('clears entries with currentRound exactly equal to expiry boundary', () => {
    getActiveCreatureName.mockReturnValue('ActiveCreature');
    getCurrentCombatRound.mockReturnValue(8);
    getCombatSummary.mockReturnValue({
      creatures: [{ name: 'ActiveCreature' }],
    });
    getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'pendingExpirations') {
        return [
          {
            target: 'ExpiredTarget',
            effects: [{ type: 'stunned' }],
            appliedRound: 5,
            expiryRounds: 3,
          },
        ];
      }
      if (key === 'targetEffects') return [];
      return null;
    });

    expireStaleEffects('TestCampaign');

    const calls = setRuntimeValue.mock.calls.filter(
      (c) => c[1] === 'pendingExpirations',
    );
    expect(calls[0][2]).toEqual([]);
  });

  it('keeps entries with currentRound exactly one below expiry boundary', () => {
    getActiveCreatureName.mockReturnValue('ActiveCreature');
    getCurrentCombatRound.mockReturnValue(7);
    getCombatSummary.mockReturnValue({
      creatures: [{ name: 'ActiveCreature' }],
    });
    getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'pendingExpirations') {
        return [
          {
            target: 'ValidTarget',
            effects: [{ type: 'stunned' }],
            appliedRound: 5,
            expiryRounds: 3,
          },
        ];
      }
      if (key === 'targetEffects') return [];
      return null;
    });

    expireStaleEffects('TestCampaign');

    const calls = setRuntimeValue.mock.calls.filter(
      (c) => c[1] === 'pendingExpirations',
    );
    expect(calls[0][2]).toEqual([
      {
        target: 'ValidTarget',
        effects: [{ type: 'stunned' }],
        appliedRound: 5,
        expiryRounds: 3,
      },
    ]);
  });
});
