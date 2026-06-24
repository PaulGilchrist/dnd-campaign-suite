// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  getAllStoreKeys: vi.fn(() => []),
}));

vi.mock('../../ui/utils.js', () => ({
  default: {
    getName: vi.fn((name) => name),
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

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../rules/combat/rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(),
}));

vi.mock('../../automation/handlers/spells/slowHandler.js', () => ({
  processSlowRepeatSave: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../automation/handlers/spells/tashasLaughterHandler.js', () => ({
  processTashasLaughterRepeatSave: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../combat/automation/automationExpressions.js', () => ({
  evaluateAutoExpression: vi.fn(() => 5),
}));

import { applyTurnStartEffects, expireStaleEffects } from './expirations.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import {
  getCombatSummary,
  getCurrentCombatRound,
  getActiveCreatureName,
} from '../../encounters/combatData.js';
import { processSlowRepeatSave } from '../../automation/handlers/spells/slowHandler.js';
import { processTashasLaughterRepeatSave } from '../../automation/handlers/spells/tashasLaughterHandler.js';
import { getDistanceFeet } from '../../rules/combat/rangeValidation.js';
import utils from '../../ui/utils.js';

function resetMocks() {
  vi.clearAllMocks();
  localStorage.clear();
}

describe('applyTurnStartEffects — post-loop logic', () => {
  beforeEach(() => {
    resetMocks();
    getRuntimeValue.mockImplementation((_name, prop) => {
      if (prop === 'targetEffects') return [];
      return null;
    });
  });

  it('checks regenerateActive when turnStartEffects is empty', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'TestCharacter' && prop === 'regenerateActive') return true;
      if (name === 'TestCharacter' && prop === 'hitPoints') return 20;
      if (prop === 'targetEffects') return [];
      return null;
    });

    await applyTurnStartEffects('TestCharacter', { turnStartEffects: [] }, 'TestCampaign');

    expect(getRuntimeValue).toHaveBeenCalledWith(
      'TestCharacter',
      'regenerateActive',
      'TestCampaign'
    );
  });

  it('clears resistanceUsedThisTurn when it is true', async () => {
    getRuntimeValue.mockImplementation((_name, prop) => {
      if (prop === 'targetEffects') return [];
      if (prop === 'resistanceUsedThisTurn') return true;
      return null;
    });

    await applyTurnStartEffects('TestCharacter', { turnStartEffects: [] }, 'TestCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'TestCharacter',
      'resistanceUsedThisTurn',
      false,
      'TestCampaign'
    );
  });

  it('does not call setRuntimeValue when resistanceUsedThisTurn is false', async () => {
    getRuntimeValue.mockImplementation((_name, prop) => {
      if (prop === 'targetEffects') return [];
      if (prop === 'resistanceUsedThisTurn') return false;
      return null;
    });

    await applyTurnStartEffects('TestCharacter', { turnStartEffects: [] }, 'TestCampaign');

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('clears portentUsedThisTurn when it is true', async () => {
    getRuntimeValue.mockImplementation((_name, prop) => {
      if (prop === 'targetEffects') return [];
      if (prop === 'portentUsedThisTurn') return true;
      return null;
    });

    await applyTurnStartEffects('TestCharacter', { turnStartEffects: [] }, 'TestCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'TestCharacter',
      'portentUsedThisTurn',
      false,
      'TestCampaign'
    );
  });

  it('does not call setRuntimeValue when portentUsedThisTurn is false', async () => {
    getRuntimeValue.mockImplementation((_name, prop) => {
      if (prop === 'targetEffects') return [];
      if (prop === 'portentUsedThisTurn') return false;
      return null;
    });

    await applyTurnStartEffects('TestCharacter', { turnStartEffects: [] }, 'TestCampaign');

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('removes multiattack_defense from targetEffects at start of turn', async () => {
    getRuntimeValue.mockImplementation((_name, prop) => {
      if (prop === 'targetEffects') return [
        { effect: 'multiattack_defense', target: 'Enemy1' },
        { effect: 'blinded', target: 'Enemy2' },
      ];
      return null;
    });

    await applyTurnStartEffects('TestCharacter', { turnStartEffects: [] }, 'TestCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'TestCampaign',
      'targetEffects',
      [{ effect: 'blinded', target: 'Enemy2' }],
      'TestCampaign'
    );
  });

  it('does not modify targetEffects when no multiattack_defense entries', async () => {
    getRuntimeValue.mockImplementation((_name, prop) => {
      if (prop === 'targetEffects') return [
        { effect: 'blinded', target: 'Enemy1' },
      ];
      return null;
    });

    await applyTurnStartEffects('TestCharacter', { turnStartEffects: [] }, 'TestCampaign');

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });
});

describe('applyTurnStartEffects — slow and tashas handlers', () => {
  beforeEach(() => {
    resetMocks();
    getRuntimeValue.mockImplementation((_name, prop) => {
      if (prop === 'targetEffects') return [];
      return null;
    });
  });

  it('processes slow repeat save when tracking key exists and target effect found', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'TestCharacter' && prop === '_slow_TestCharacter') return true;
      if (name === 'TestCampaign' && prop === 'targetEffects') return [
        { target: 'TestCharacter', effect: 'slow_repeat_save', source: 'Caster', dc: 12 },
      ];
      return null;
    });

    await applyTurnStartEffects('TestCharacter', { turnStartEffects: [] }, 'TestCampaign');

    expect(processSlowRepeatSave).toHaveBeenCalledWith(
      'Caster',
      'TestCharacter',
      12,
      'TestCampaign'
    );
  });

  it('does not process slow when tracking key is absent', async () => {
    getRuntimeValue.mockImplementation((_name, prop) => {
      if (prop === 'targetEffects') return [
        { target: 'TestCharacter', effect: 'slow_repeat_save', source: 'Caster', dc: 12 },
      ];
      return null;
    });

    await applyTurnStartEffects('TestCharacter', { turnStartEffects: [] }, 'TestCampaign');

    expect(processSlowRepeatSave).not.toHaveBeenCalled();
  });

  it('processes tashas laughter repeat save when tracking key exists and target effect found', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'TestCharacter' && prop === '_tashas_laughter_TestCharacter') return true;
      if (name === 'TestCampaign' && prop === 'targetEffects') return [
        { target: 'TestCharacter', effect: 'tashas_laughter_repeat_save', source: 'Caster', dc: 11 },
      ];
      return null;
    });

    await applyTurnStartEffects('TestCharacter', { turnStartEffects: [] }, 'TestCampaign');

    expect(processTashasLaughterRepeatSave).toHaveBeenCalledWith(
      'Caster',
      'TestCharacter',
      11,
      'TestCampaign'
    );
  });

  it('does not process tashas when tracking key is absent', async () => {
    getRuntimeValue.mockImplementation((_name, prop) => {
      if (prop === 'targetEffects') return [
        { target: 'TestCharacter', effect: 'tashas_laughter_repeat_save', source: 'Caster', dc: 11 },
      ];
      return null;
    });

    await applyTurnStartEffects('TestCharacter', { turnStartEffects: [] }, 'TestCampaign');

    expect(processTashasLaughterRepeatSave).not.toHaveBeenCalled();
  });
});

describe('applyTurnStartEffects — superior_defense', () => {
  beforeEach(() => {
    resetMocks();
    getRuntimeValue.mockImplementation((_name, prop) => {
      if (prop === 'targetEffects') return [];
      return null;
    });
  });

  it('returns early when character is incapacitated', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'TestCharacter' && prop === 'activeConditions') return ['incapacitated'];
      if (prop === 'targetEffects') return [];
      return null;
    });

    await applyTurnStartEffects('TestCharacter', {
      turnStartEffects: [{ type: 'superior_defense', cost: 1 }]
    }, 'TestCampaign');

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('returns early when Superior Defense buff already active', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'TestCharacter' && prop === 'activeConditions') return [];
      if (name === 'TestCharacter' && prop === 'activeBuffs') return [
        { name: 'Superior Defense', effect: 'damage_resistance' }
      ];
      if (prop === 'targetEffects') return [];
      return null;
    });

    await applyTurnStartEffects('TestCharacter', {
      turnStartEffects: [{ type: 'superior_defense', cost: 1 }]
    }, 'TestCampaign');

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('returns early when focus points are insufficient', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'TestCharacter' && prop === 'activeConditions') return [];
      if (name === 'TestCharacter' && prop === 'activeBuffs') return [];
      if (name === 'TestCharacter' && prop === 'focusPoints') return 0;
      if (prop === 'targetEffects') return [];
      return null;
    });

    await applyTurnStartEffects('TestCharacter', {
      turnStartEffects: [{ type: 'superior_defense', cost: 2 }],
      class: { class_levels: [{ level: 1, focus_points: 3 }] },
      level: 1,
    }, 'TestCampaign');

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('activates Superior Defense when conditions are met', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'TestCharacter' && prop === 'activeConditions') return [];
      if (name === 'TestCharacter' && prop === 'activeBuffs') return [];
      if (name === 'TestCharacter' && prop === 'focusPoints') return 2;
      if (prop === 'targetEffects') return [];
      return null;
    });

    await applyTurnStartEffects('TestCharacter', {
      turnStartEffects: [{ type: 'superior_defense', cost: 1 }]
    }, 'TestCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'TestCharacter',
      'focusPoints',
      1,
      'TestCampaign'
    );
    const buffsCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeBuffs');
    expect(buffsCall).toBeDefined();
    expect(buffsCall[2]).toEqual([
      {
        name: 'Superior Defense',
        effect: 'damage_resistance',
        duration: '1_minute',
        resistanceTypes: expect.any(Array),
      }
    ]);
  });
});

describe('applyTurnStartEffects — flurry_healing_harm', () => {
  beforeEach(() => {
    resetMocks();
    getRuntimeValue.mockImplementation((_name, prop) => {
      if (prop === 'targetEffects') return [];
      return null;
    });
  });

  it('sets flurryHealingHarmUses based on expression value', async () => {
    getRuntimeValue.mockImplementation((_name, prop) => {
      if (prop === 'targetEffects') return [];
      return null;
    });

    await applyTurnStartEffects('TestCharacter', {
      turnStartEffects: [{
        type: 'flurry_healing_harm',
        usesExpression: '3',
      }],
      abilities: [{ name: 'Wisdom', bonus: 3 }]
    }, 'TestCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'TestCharacter',
      'flurryHealingHarmUses',
      3,
      'TestCampaign'
    );
  });

  it('defaults uses to 1 when expression evaluation fails', async () => {
    getRuntimeValue.mockImplementation((_name, prop) => {
      if (prop === 'targetEffects') return [];
      return null;
    });

    await applyTurnStartEffects('TestCharacter', {
      turnStartEffects: [{
        type: 'flurry_healing_harm',
        usesExpression: 'invalid_expression_here',
      }],
      abilities: [{ name: 'Wisdom', bonus: 0 }]
    }, 'TestCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'TestCharacter',
      'flurryHealingHarmUses',
      1,
      'TestCampaign'
    );
  });
});

describe('applyTurnStartEffects — holy_nimbus_radiant_damage', () => {
  beforeEach(() => {
    resetMocks();
    getRuntimeValue.mockImplementation((_name, prop) => {
      if (prop === 'targetEffects') return [];
      return null;
    });
  });

  it('returns early when holyNimbusActive is false', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'TestCharacter' && prop === 'holyNimbusActive') return false;
      if (prop === 'targetEffects') return [];
      return null;
    });
    getCombatSummary.mockReturnValue({ creatures: [] });

    await applyTurnStartEffects('TestCharacter', {
      turnStartEffects: [{ type: 'holy_nimbus_radiant_damage', damageExpression: 'CHA modifier + proficiency_bonus' }],
      abilities: [{ name: 'Charisma', bonus: 3 }],
      proficiency: 2,
    }, 'TestCampaign');

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('returns early when no combat summary', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'TestCharacter' && prop === 'holyNimbusActive') return true;
      if (prop === 'targetEffects') return [];
      return null;
    });
    getCombatSummary.mockReturnValue(null);

    await applyTurnStartEffects('TestCharacter', {
      turnStartEffects: [{ type: 'holy_nimbus_radiant_damage' }],
    }, 'TestCampaign');

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });
});

describe('applyTurnStartEffects — living_legend_turn_start', () => {
  beforeEach(() => {
    resetMocks();
    getRuntimeValue.mockImplementation((_name, prop) => {
      if (prop === 'targetEffects') return [];
      return null;
    });
  });

  it('resets unerringStrikeUsed to false', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'TestCharacter' && prop === 'unerringStrikeUsed') return true;
      if (prop === 'targetEffects') return [];
      return null;
    });

    await applyTurnStartEffects('TestCharacter', {
      turnStartEffects: [{ type: 'living_legend_turn_start' }]
    }, 'TestCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'TestCharacter',
      'unerringStrikeUsed',
      false,
      'TestCampaign'
    );
  });
});

describe('applyTurnStartEffects — radiant_soul_turn_start', () => {
  beforeEach(() => {
    resetMocks();
    getRuntimeValue.mockImplementation((_name, prop) => {
      if (prop === 'targetEffects') return [];
      return null;
    });
  });

  it('resets the once-per-turn key to false', async () => {
    await applyTurnStartEffects('TestCharacter', {
      turnStartEffects: [{ type: 'radiant_soul_turn_start' }]
    }, 'TestCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'TestCharacter',
      '_radiantSoul_TestCharacter_oncePerTurn',
      false,
      'TestCampaign'
    );
  });
});

describe('applyTurnStartEffects — inner_radiance_turn_start', () => {
  beforeEach(() => {
    resetMocks();
    getRuntimeValue.mockImplementation((_name, prop) => {
      if (prop === 'targetEffects') return [];
      return null;
    });
    getDistanceFeet.mockReturnValue(5);
  });

  it('returns early when Inner Radiance buff not active', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'TestCharacter' && prop === 'activeBuffs') return [];
      if (prop === 'targetEffects') return [];
      return null;
    });
    getCombatSummary.mockReturnValue({ creatures: [] });

    await applyTurnStartEffects('TestCharacter', {
      turnStartEffects: [{ type: 'inner_radiance_turn_start' }]
    }, 'TestCampaign');

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('returns early when no combat summary', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'TestCharacter' && prop === 'activeBuffs') return [
        { name: 'Inner Radiance', effect: 'aura_damage' }
      ];
      if (prop === 'targetEffects') return [];
      return null;
    });
    getCombatSummary.mockReturnValue(null);

    await applyTurnStartEffects('TestCharacter', {
      turnStartEffects: [{ type: 'inner_radiance_turn_start' }]
    }, 'TestCampaign');

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });
});

describe('applyTurnStartEffects — elder_champion_regeneration', () => {
  beforeEach(() => {
    resetMocks();
    getRuntimeValue.mockImplementation((_name, prop) => {
      if (prop === 'targetEffects') return [];
      return null;
    });
  });

  it('returns early when elderChampionActive is false', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'TestCharacter' && prop === 'elderChampionActive') return false;
      if (prop === 'targetEffects') return [];
      return null;
    });

    await applyTurnStartEffects('TestCharacter', {
      turnStartEffects: [{ type: 'elder_champion_regeneration', healExpression: '1d8' }]
    }, 'TestCampaign');

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });
});

describe('applyTurnStartEffects — dread_ambush_speed', () => {
  beforeEach(() => {
    resetMocks();
    getRuntimeValue.mockImplementation((_name, prop) => {
      if (prop === 'targetEffects') return [];
      return null;
    });
  });

  it('returns early when not round 1', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'TestCharacter' && prop === 'dreadAmbushSpeedActive') return false;
      if (prop === 'targetEffects') return [];
      return null;
    });
    getCombatSummary.mockReturnValue({ round: 3 });

    await applyTurnStartEffects('TestCharacter', {
      turnStartEffects: [{ type: 'dread_ambush_speed', bonusExpression: '10' }]
    }, 'TestCampaign');

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('returns early when dreadAmbushSpeedActive is already true', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'TestCharacter' && prop === 'dreadAmbushSpeedActive') return true;
      if (prop === 'targetEffects') return [];
      return null;
    });
    getCombatSummary.mockReturnValue({ round: 1 });

    await applyTurnStartEffects('TestCharacter', {
      turnStartEffects: [{ type: 'dread_ambush_speed', bonusExpression: '10' }]
    }, 'TestCampaign');

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });
});

describe('applyTurnStartEffects — steady_aim_clear', () => {
  beforeEach(() => {
    resetMocks();
    getRuntimeValue.mockImplementation((_name, prop) => {
      if (prop === 'targetEffects') return [];
      return null;
    });
  });

  it('removes speed_zero condition and clears flags', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'TestCharacter' && prop === 'activeConditions') return ['speed_zero', 'blinded'];
      if (name === 'TestCharacter' && prop === 'steadyAimMovedThisTurn') return true;
      if (name === 'TestCharacter' && prop === 'steadyAimSpeedZero') return true;
      if (prop === 'targetEffects') return [];
      return null;
    });

    await applyTurnStartEffects('TestCharacter', {
      turnStartEffects: [{ type: 'steady_aim_clear' }]
    }, 'TestCampaign');

    // Source uses await before each setRuntimeValue call, so all 3 calls happen
    // in sequence but the await creates microtasks. Since setRuntimeValue is
    // mocked as vi.fn() returning undefined, await undefined resolves immediately.
    // However, the await still defers execution to the next microtask.
    await Promise.resolve();

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'TestCharacter',
      'activeConditions',
      ['blinded'],
      'TestCampaign'
    );
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'TestCharacter',
      'steadyAimMovedThisTurn',
      false,
      'TestCampaign'
    );
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'TestCharacter',
      'steadyAimSpeedZero',
      false,
      'TestCampaign'
    );
  });

  it('still clears steadyAim flags even when no speed_zero condition', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'TestCharacter' && prop === 'activeConditions') return ['blinded'];
      if (name === 'TestCharacter' && prop === 'steadyAimMovedThisTurn') return true;
      if (name === 'TestCharacter' && prop === 'steadyAimSpeedZero') return true;
      if (prop === 'targetEffects') return [];
      return null;
    });

    await applyTurnStartEffects('TestCharacter', {
      turnStartEffects: [{ type: 'steady_aim_clear' }]
    }, 'TestCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'TestCharacter',
      'steadyAimMovedThisTurn',
      false,
      'TestCampaign'
    );
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'TestCharacter',
      'steadyAimSpeedZero',
      false,
      'TestCampaign'
    );
    const condCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditions');
    expect(condCall).toBeUndefined();
  });
});

describe('applyTurnStartEffects — supreme_sneak', () => {
  beforeEach(() => {
    resetMocks();
    getRuntimeValue.mockImplementation((_name, prop) => {
      if (prop === 'targetEffects') return [];
      return null;
    });
  });

  it('clears stealthAttackCost and preserves invisible when cost > 0 and invisible', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'TestCharacter' && prop === 'stealthAttackCost') return 1;
      if (name === 'TestCharacter' && prop === 'activeConditions') return ['invisible', 'blinded'];
      if (prop === 'targetEffects') return [];
      return null;
    });

    await applyTurnStartEffects('TestCharacter', {
      turnStartEffects: [{ type: 'supreme_sneak' }]
    }, 'TestCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'TestCharacter',
      'stealthAttackCost',
      0,
      'TestCampaign'
    );
  });

  it('does nothing when stealthAttackCost is 0', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'TestCharacter' && prop === 'stealthAttackCost') return 0;
      if (name === 'TestCharacter' && prop === 'activeConditions') return ['invisible'];
      if (prop === 'targetEffects') return [];
      return null;
    });

    await applyTurnStartEffects('TestCharacter', {
      turnStartEffects: [{ type: 'supreme_sneak' }]
    }, 'TestCampaign');

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('does nothing when stealthAttackCost is null', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'TestCharacter' && prop === 'stealthAttackCost') return null;
      if (prop === 'targetEffects') return [];
      return null;
    });

    await applyTurnStartEffects('TestCharacter', {
      turnStartEffects: [{ type: 'supreme_sneak' }]
    }, 'TestCampaign');

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });
});

describe('applyTurnStartEffects — use_magic_device', () => {
  beforeEach(() => {
    resetMocks();
    getRuntimeValue.mockImplementation((_name, prop) => {
      if (prop === 'targetEffects') return [];
      return null;
    });
  });

  it('is a no-op placeholder', async () => {
    await applyTurnStartEffects('TestCharacter', {
      turnStartEffects: [{ type: 'use_magic_device' }]
    }, 'TestCampaign');

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });
});

describe('applyTurnStartEffects — heroism_temp_hp', () => {
  beforeEach(() => {
    resetMocks();
    getRuntimeValue.mockImplementation((_name, prop) => {
      if (prop === 'targetEffects') return [];
      return null;
    });
  });

  it('sets tempHp when Heroism buff exists with tempHpAmount', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'TestCharacter' && prop === 'activeBuffs') return [
        { name: 'Heroism', tempHpAmount: 5 }
      ];
      if (name === 'TestCharacter' && prop === 'tempHp') return 0;
      if (prop === 'targetEffects') return [];
      return null;
    });

    await applyTurnStartEffects('TestCharacter', {
      turnStartEffects: [{ type: 'heroism_temp_hp' }]
    }, 'TestCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'TestCharacter',
      'tempHp',
      5,
      'TestCampaign'
    );
  });

  it('uses max of existing tempHp and heroism tempHpAmount', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'TestCharacter' && prop === 'activeBuffs') return [
        { name: 'Heroism', tempHpAmount: 3 }
      ];
      if (name === 'TestCharacter' && prop === 'tempHp') return 7;
      if (prop === 'targetEffects') return [];
      return null;
    });

    await applyTurnStartEffects('TestCharacter', {
      turnStartEffects: [{ type: 'heroism_temp_hp' }]
    }, 'TestCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'TestCharacter',
      'tempHp',
      7,
      'TestCampaign'
    );
  });

  it('returns early when no Heroism buff', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'TestCharacter' && prop === 'activeBuffs') return [
        { name: 'OtherBuff' }
      ];
      if (prop === 'targetEffects') return [];
      return null;
    });

    await applyTurnStartEffects('TestCharacter', {
      turnStartEffects: [{ type: 'heroism_temp_hp' }]
    }, 'TestCampaign');

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });
});

describe('clearExpirationEffects via expireStaleEffects', () => {
  beforeEach(() => {
    resetMocks();
    utils.getName.mockImplementation((v) => v);
    getActiveCreatureName.mockReturnValue('Goblin');
    getCurrentCombatRound.mockReturnValue(5);
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeConditions') return [];
      if (key === 'pendingExpirations') return [];
      return null;
    });
  });

  it('clears fly_speed_20_hover buff', () => {
    const list = [
      { target: 'Human', effects: [{ type: 'fly_speed_20_hover' }], appliedRound: 0, expiryRounds: 1 },
    ];
    getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'Goblin' && key === 'pendingExpirations') return list;
      if (name === 'Human' && key === 'activeBuffs') return [
        { effect: 'fly_speed_20_hover', duration: 3 },
      ];
      if (name === 'Human' && key === 'activeConditions') return [];
      return null;
    });

    expireStaleEffects('MyCampaign');

    const filterCall = setRuntimeValue.mock.calls.find(
      (c) => c[1] === 'activeBuffs' && c[0] === 'Human'
    );
    expect(filterCall).toBeTruthy();
    expect(filterCall[2]).toEqual([]);
  });

  it('clears dragon_wings buff', () => {
    const list = [
      { target: 'Human', effects: [{ type: 'dragon_wings' }], appliedRound: 0, expiryRounds: 1 },
    ];
    getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'Goblin' && key === 'pendingExpirations') return list;
      if (name === 'Human' && key === 'activeBuffs') return [
        { effect: 'dragon_wings', duration: 3 },
      ];
      if (name === 'Human' && key === 'activeConditions') return [];
      return null;
    });

    expireStaleEffects('MyCampaign');

    const filterCall = setRuntimeValue.mock.calls.find(
      (c) => c[1] === 'activeBuffs' && c[0] === 'Human'
    );
    expect(filterCall).toBeTruthy();
    expect(filterCall[2]).toEqual([]);
  });

  it('clears ice_walk buff', () => {
    const list = [
      { target: 'Human', effects: [{ type: 'ice_walk' }], appliedRound: 0, expiryRounds: 1 },
    ];
    getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'Goblin' && key === 'pendingExpirations') return list;
      if (name === 'Human' && key === 'activeBuffs') return [
        { effect: 'ice_walk', duration: 3 },
      ];
      if (name === 'Human' && key === 'activeConditions') return [];
      return null;
    });

    expireStaleEffects('MyCampaign');

    const filterCall = setRuntimeValue.mock.calls.find(
      (c) => c[1] === 'activeBuffs' && c[0] === 'Human'
    );
    expect(filterCall).toBeTruthy();
    expect(filterCall[2]).toEqual([]);
  });

  it('clears speed_boost buff while preserving other buffs', () => {
    const list = [
      { target: 'Human', effects: [{ type: 'speed_boost' }], appliedRound: 0, expiryRounds: 1 },
    ];
    getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'Goblin' && key === 'pendingExpirations') return list;
      if (name === 'Human' && key === 'activeBuffs') return [
        { effect: 'speed_boost', duration: 3 },
        { effect: 'double_move', duration: 2 },
      ];
      if (name === 'Human' && key === 'activeConditions') return [];
      return null;
    });

    expireStaleEffects('MyCampaign');

    const filterCall = setRuntimeValue.mock.calls.find(
      (c) => c[1] === 'activeBuffs' && c[0] === 'Human'
    );
    expect(filterCall).toBeTruthy();
    expect(filterCall[2]).toEqual([{ effect: 'double_move', duration: 2 }]);
  });

  it('clears peerless_athlete_end effect and sets flag', () => {
    const list = [
      { target: 'Human', effects: [{ type: 'peerless_athlete_end' }], appliedRound: 0, expiryRounds: 1 },
    ];
    getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'Goblin' && key === 'pendingExpirations') return list;
      if (name === 'Human' && key === 'activeBuffs') return [
        { effect: 'peerless_athlete', duration: 3 },
      ];
      if (name === 'Human' && key === 'activeConditions') return [];
      return null;
    });

    expireStaleEffects('MyCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith('Human', 'peerlessAthleteActive', false, 'MyCampaign');
    const filterCall = setRuntimeValue.mock.calls.find(
      (c) => c[1] === 'activeBuffs' && c[0] === 'Human'
    );
    expect(filterCall).toBeTruthy();
    expect(filterCall[2]).toEqual([]);
  });

  it('clears large_form_end effect and sets flag', () => {
    const list = [
      { target: 'Human', effects: [{ type: 'large_form_end' }], appliedRound: 0, expiryRounds: 1 },
    ];
    getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'Goblin' && key === 'pendingExpirations') return list;
      if (name === 'Human' && key === 'activeBuffs') return [
        { effect: 'large_form', duration: 3 },
      ];
      if (name === 'Human' && key === 'activeConditions') return [];
      return null;
    });

    expireStaleEffects('MyCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith('Human', 'largeFormActive', false, 'MyCampaign');
    const filterCall = setRuntimeValue.mock.calls.find(
      (c) => c[1] === 'activeBuffs' && c[0] === 'Human'
    );
    expect(filterCall).toBeTruthy();
    expect(filterCall[2]).toEqual([]);
  });

  it('clears remove_natures_sanctuary effect and all related state', () => {
    const list = [
      { target: 'Human', effects: [{ type: 'remove_natures_sanctuary' }], appliedRound: 0, expiryRounds: 1 },
    ];
    getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'Goblin' && key === 'pendingExpirations') return list;
      return null;
    });

    expireStaleEffects('MyCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith('Human', 'naturesSanctuaryActive', null, 'MyCampaign');
    expect(setRuntimeValue).toHaveBeenCalledWith('Human', 'naturesSanctuaryMoves', null, 'MyCampaign');
    expect(setRuntimeValue).toHaveBeenCalledWith('Human', 'naturesSanctuaryCubeX', null, 'MyCampaign');
    expect(setRuntimeValue).toHaveBeenCalledWith('Human', 'naturesSanctuaryCubeY', null, 'MyCampaign');
    expect(setRuntimeValue).toHaveBeenCalledWith('Human', 'naturesSanctuaryRange', null, 'MyCampaign');
    expect(setRuntimeValue).toHaveBeenCalledWith('Human', 'naturesSanctuaryResistance', null, 'MyCampaign');
  });

  it('clears remove_bulwark_of_force effect and related state', () => {
    const list = [
      { target: 'Human', effects: [{ type: 'remove_bulwark_of_force' }], appliedRound: 0, expiryRounds: 1 },
    ];
    getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'Goblin' && key === 'pendingExpirations') return list;
      return null;
    });

    expireStaleEffects('MyCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith('Human', 'bulwarkOfForceActive', null, 'MyCampaign');
    expect(setRuntimeValue).toHaveBeenCalledWith('Human', 'bulwarkOfForceTargets', null, 'MyCampaign');
  });

  it('clears remove_cosmic_omen effect', () => {
    const list = [
      { target: 'Human', effects: [{ type: 'remove_cosmic_omen' }], appliedRound: 0, expiryRounds: 1 },
    ];
    getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'Goblin' && key === 'pendingExpirations') return list;
      return null;
    });

    expireStaleEffects('MyCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith('Human', 'cosmicOmenEffect', null, 'MyCampaign');
  });

  it('clears tashas_laughter_expiration effect', () => {
    const list = [
      { target: 'Human', effects: [{ type: 'tashas_laughter_expiration' }], appliedRound: 0, expiryRounds: 1 },
    ];
    getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'Goblin' && key === 'pendingExpirations') return list;
      return null;
    });

    expireStaleEffects('MyCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Human',
      'tashas_laughter_Human_damageTrigger',
      false,
      'MyCampaign'
    );
  });

  it('clears remove_feign_death_buff and associated conditions', () => {
    const list = [
      { target: 'Human', effects: [{ type: 'remove_feign_death_buff', buffName: 'FeignDeath' }], appliedRound: 0, expiryRounds: 1 },
    ];
    getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'Goblin' && key === 'pendingExpirations') return list;
      if (name === 'Human' && key === 'activeBuffs') return [
        { name: 'FeignDeath' },
        { name: 'OtherBuff' },
      ];
      if (name === 'Human' && key === 'activeConditions') return ['blinded', 'incapacitated', 'speed_zero'];
      return null;
    });

    expireStaleEffects('MyCampaign');

    const filterCall = setRuntimeValue.mock.calls.find(
      (c) => c[1] === 'activeBuffs' && c[0] === 'Human'
    );
    expect(filterCall).toBeTruthy();
    expect(filterCall[2]).toEqual([{ name: 'OtherBuff' }]);
  });

  it('removes target from avenging_angel_aura targets list', () => {
    const list = [
      { target: 'Human', effects: [{ type: 'avenging_angel_aura' }], appliedRound: 0, expiryRounds: 1 },
    ];
    getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'Goblin' && key === 'pendingExpirations') return list;
      if (name === 'Goblin' && key === 'avengingAngelAuraTargets') return ['Human', 'Orc'];
      if (name === 'Human' && key === 'activeConditions') return [];
      return null;
    });

    expireStaleEffects('MyCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Goblin',
      'avengingAngelAuraTargets',
      ['Orc'],
      'MyCampaign'
    );
  });

  it('clears remove_regenerate_buff effect and related state', () => {
    const list = [
      { target: 'Human', effects: [{ type: 'remove_regenerate_buff' }], appliedRound: 0, expiryRounds: 1 },
    ];
    getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'Goblin' && key === 'pendingExpirations') return list;
      return null;
    });

    expireStaleEffects('MyCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith('Human', 'regenerateActive', null, 'MyCampaign');
    expect(setRuntimeValue).toHaveBeenCalledWith('Human', 'regenerateSource', null, 'MyCampaign');
  });

  it('handles remove_active_buff with haste — adds speed_zero and incapacitated', () => {
    const list = [
      { target: 'Human', effects: [{ type: 'remove_active_buff', buffName: 'Haste' }], appliedRound: 0, expiryRounds: 1 },
    ];
    getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'Goblin' && key === 'pendingExpirations') return list;
      if (name === 'Human' && key === 'activeBuffs') return [
        { name: 'Haste', effect: 'haste' },
        { name: 'OtherBuff' },
      ];
      if (name === 'Human' && key === 'activeConditions') return ['blinded'];
      return null;
    });

    expireStaleEffects('MyCampaign');

    const filterCall = setRuntimeValue.mock.calls.find(
      (c) => c[1] === 'activeBuffs' && c[0] === 'Human'
    );
    expect(filterCall).toBeTruthy();
    expect(filterCall[2]).toEqual([{ name: 'OtherBuff' }]);

    const conditionsCall = setRuntimeValue.mock.calls.find(
      (c) => c[1] === 'activeConditions' && c[0] === 'Human'
    );
    expect(conditionsCall).toBeTruthy();
    expect(conditionsCall[2]).toEqual(['blinded', 'speed_zero', 'incapacitated']);
  });

  it('handles remove_heroes_feast_buff — reduces HP and max', () => {
    const list = [
      { target: 'Human', effects: [{ type: 'remove_heroes_feast_buff', buffName: 'HeroesFeast', hpKey: 'heroesFeastHpMaxIncrease' }], appliedRound: 0, expiryRounds: 1 },
    ];
    getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'Goblin' && key === 'pendingExpirations') return list;
      if (name === 'Human' && key === 'activeBuffs') return [
        { name: 'HeroesFeast' },
      ];
      if (name === 'Human' && key === 'heroesFeastHpMaxIncrease') return 5;
      if (name === 'Human' && key === 'hitPoints') return 20;
      if (name === 'Human' && key === 'currentHitPoints') return 15;
      if (name === 'Human' && key === 'activeConditions') return [];
      return null;
    });

    expireStaleEffects('MyCampaign');

    const filterCall = setRuntimeValue.mock.calls.find(
      (c) => c[1] === 'activeBuffs' && c[0] === 'Human'
    );
    expect(filterCall).toBeTruthy();
    expect(filterCall[2]).toEqual([]);
    expect(setRuntimeValue).toHaveBeenCalledWith('Human', 'hitPoints', 15, 'MyCampaign');
    expect(setRuntimeValue).toHaveBeenCalledWith('Human', 'currentHitPoints', 10, 'MyCampaign');
    expect(setRuntimeValue).toHaveBeenCalledWith('Human', 'heroesFeastHpMaxIncrease', 0, 'MyCampaign');
  });

  it('handles remove_aid_buff — reduces current HP', () => {
    const list = [
      { target: 'Human', effects: [{ type: 'remove_aid_buff', buffName: 'Aid', hpKey: 'aidHpMaxIncrease' }], appliedRound: 0, expiryRounds: 1 },
    ];
    getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'Goblin' && key === 'pendingExpirations') return list;
      if (name === 'Human' && key === 'activeBuffs') return [
        { name: 'Aid' },
      ];
      if (name === 'Human' && key === 'aidHpMaxIncrease') return 3;
      if (name === 'Human' && key === 'hitPoints') return 20;
      if (name === 'Human' && key === 'currentHitPoints') return 18;
      if (name === 'Human' && key === 'activeConditions') return [];
      return null;
    });

    expireStaleEffects('MyCampaign');

    const filterCall = setRuntimeValue.mock.calls.find(
      (c) => c[1] === 'activeBuffs' && c[0] === 'Human'
    );
    expect(filterCall).toBeTruthy();
    expect(filterCall[2]).toEqual([]);
    expect(setRuntimeValue).toHaveBeenCalledWith('Human', 'currentHitPoints', 15, 'MyCampaign');
    expect(setRuntimeValue).toHaveBeenCalledWith('Human', 'aidHpMaxIncrease', 0, 'MyCampaign');
  });

  it('handles remove_heroism_buff — removes buff and target effect', () => {
    const list = [
      { target: 'Human', effects: [{ type: 'remove_heroism_buff', buffName: 'Heroism' }], appliedRound: 0, expiryRounds: 1 },
    ];
    getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'Goblin' && key === 'pendingExpirations') return list;
      if (name === 'Human' && key === 'activeBuffs') return [
        { name: 'Heroism' },
      ];
      if (name === 'MyCampaign' && key === 'targetEffects') return [
        { effect: 'heroism', source: 'Heroism' },
        { effect: 'blinded', source: 'Other' },
      ];
      if (name === 'Human' && key === 'activeConditions') return [];
      return null;
    });

    expireStaleEffects('MyCampaign');

    const filterCall = setRuntimeValue.mock.calls.find(
      (c) => c[1] === 'activeBuffs' && c[0] === 'Human'
    );
    expect(filterCall).toBeTruthy();
    expect(filterCall[2]).toEqual([]);
    const teCall = setRuntimeValue.mock.calls.find(
      (c) => c[1] === 'targetEffects' && c[0] === 'MyCampaign'
    );
    expect(teCall).toBeTruthy();
    expect(teCall[2]).toEqual([{ effect: 'blinded', source: 'Other' }]);
  });

  it('removes speed_zero condition', () => {
    const list = [
      { target: 'Human', effects: [{ type: 'speed_zero' }], appliedRound: 0, expiryRounds: 1 },
    ];
    getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'Goblin' && key === 'pendingExpirations') return list;
      if (name === 'Human' && key === 'activeConditions') return ['speed_zero', 'blinded'];
      return null;
    });

    expireStaleEffects('MyCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Human',
      'activeConditions',
      ['blinded'],
      'MyCampaign'
    );
  });
});
