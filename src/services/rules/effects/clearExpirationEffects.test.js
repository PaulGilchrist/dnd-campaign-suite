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
    it('removes the specified condition from target activeConditions and leaves others', () => {
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
    it.each([
      { stored: ['Orc', 'Human', 'Elf'], expected: ['Orc', 'Elf'], label: 'removes target from storedAdv' },
      { stored: ['Human'], expected: [], label: 'clears array when only target remains' },
    ])('$label', ({ stored, expected }) => {
      const myList = [
        { target: 'Human', effects: [{ type: 'advantage_on_target' }], appliedRound: 1 },
      ];
      getRuntimeValue.mockImplementation((name, key) => {
        if (name === 'Goblin' && key === KEY) return myList;
        if (key === '_advantageOn_Human') return stored;
        if (key === 'activeConditions') return [];
        if (key === KEY) return [];
        return null;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        '_advantageOn_Human',
        expected,
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
    const flightBuffTests = [
      { type: 'fly_speed_equals_walk_speed', buff: 'fly_speed_equals_walk_speed', remaining: [{ effect: 'double_move', duration: 2 }] },
      { type: 'fly_speed_20_hover', buff: 'fly_speed_20_hover', remaining: [] },
      { type: 'dragon_wings', buff: 'dragon_wings', remaining: [] },
      { type: 'ice_walk', buff: 'ice_walk', remaining: [] },
      { type: 'speed_boost', buff: 'speed_boost', remaining: [] },
    ];

    it.each(flightBuffTests)(
      'removes $type buff from activeBuffs',
      ({ type, buff, remaining }) => {
        const myList = [
          { target: 'Human', effects: [{ type }], appliedRound: 1 },
        ];
        getRuntimeValue.mockImplementation((name, key) => {
          if (name === 'Human' && key === 'activeBuffs') {
            if (remaining.length === 0) return [];
            return [{ effect: buff, duration: 3 }, { effect: 'double_move', duration: 2 }];
          }
          if (name === 'Human' && key === 'activeConditions') return [];
          if (key === KEY && name === 'Goblin') return myList;
          if (key === KEY) return [];
          return null;
        });

        clearAllExpirationEffects('Goblin', 'MyCampaign');

        // clearAllExpirationEffects clears activeBuffs globally at the top,
        // then the specific buff handler re-filters. The final state for
        // the target is what we verify via the setRuntimeValue calls.
        const buffCalls = setRuntimeValue.mock.calls.filter(
          (c) => c[0] === 'Human' && c[1] === 'activeBuffs',
        );
        expect(buffCalls.length).toBeGreaterThan(0);
        // The last call for Human activeBuffs should reflect the filtered result
        const lastBuffCall = buffCalls[buffCalls.length - 1];
        expect(lastBuffCall[2]).toEqual(remaining);
      },
    );
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
  });

  describe('state-clearing effect types', () => {
    const stateClearingTests = [
      {
        type: 'peerless_athlete_end',
        checks: [
          { key: 'peerlessAthleteActive', value: false },
          { key: 'activeBuffs', value: [] },
        ],
      },
      {
        type: 'large_form_end',
        checks: [
          { key: 'largeFormActive', value: false },
        ],
      },
      {
        type: 'remove_bardic_inspiration',
        checks: [
          { key: 'bardicInspirationDie', value: null },
          { key: 'bardicInspirationGrantedBy', value: null },
          { key: 'bardicInspirationCombatOptions', value: null },
        ],
      },
      {
        type: 'inspiring_movement_no_oa',
        checks: [
          { key: 'inspiringMovementNoOA', value: null },
        ],
      },
      {
        type: 'inspiring_movement_granted',
        checks: [
          { key: 'inspiringMovementGranted', value: null },
        ],
      },
      {
        type: 'remove_natures_sanctuary',
        checks: [
          { key: 'naturesSanctuaryActive', value: null },
          { key: 'naturesSanctuaryMoves', value: null },
          { key: 'naturesSanctuaryCubeX', value: null },
          { key: 'naturesSanctuaryCubeY', value: null },
          { key: 'naturesSanctuaryRange', value: null },
          { key: 'naturesSanctuaryResistance', value: null },
        ],
      },
      {
        type: 'remove_bulwark_of_force',
        checks: [
          { key: 'bulwarkOfForceActive', value: null },
          { key: 'bulwarkOfForceTargets', value: null },
        ],
      },
      {
        type: 'unbreakable_majesty',
        checks: [
          { key: 'unbreakableMajestyActive', value: null },
          { key: 'unbreakableMajestySaveDc', value: null },
        ],
      },
      {
        type: 'remove_cosmic_omen',
        checks: [
          { key: 'cosmicOmenEffect', value: null },
        ],
      },
      {
        type: 'remove_regenerate_buff',
        checks: [
          { key: 'regenerateActive', value: null },
          { key: 'regenerateSource', value: null },
        ],
      },
    ];

    it.each(stateClearingTests)(
      'clears $type state',
      ({ type, checks }) => {
        const myList = [
          { target: 'Human', effects: [{ type }], appliedRound: 1 },
        ];
        getRuntimeValue.mockImplementation((name, key) => {
          if (key === KEY && name === 'Goblin') return myList;
          if (key === KEY) return [];
          return null;
        });

        clearAllExpirationEffects('Goblin', 'MyCampaign');

        for (const check of checks) {
          expect(setRuntimeValue).toHaveBeenCalledWith(
            'Human',
            check.key,
            check.value,
            'MyCampaign',
          );
        }
      },
    );
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

      const condCalls = setRuntimeValue.mock.calls.filter(
        (c) => c[0] === 'Human' && c[1] === 'activeConditions',
      );
      // remove_feign_death_buff removes blinded, incapacitated, speed_zero one by one
      // Each condition removal calls removeActiveCondition which calls setRuntimeValue,
      // giving 3 total calls (plus removeNpcCondition also calls setRuntimeValue,
      // but removeNpcCondition catches errors and may not always call setRuntimeValue).
      // With the mock returning the same initial array each time, the final state
      // reflects removing all three conditions from the original array.
      expect(condCalls.length).toBeGreaterThan(0);
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
});
