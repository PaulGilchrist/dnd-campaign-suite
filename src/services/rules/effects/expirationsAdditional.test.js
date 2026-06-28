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

import { applyTurnStartEffects } from './expirations.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../encounters/combatData.js';
import { getDistanceFeet } from '../../rules/combat/rangeValidation.js';

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

describe('applyTurnStartEffects — survivor_turn_start_heal', () => {
  beforeEach(() => {
    resetMocks();
    getRuntimeValue.mockImplementation((_name, prop) => {
      if (prop === 'targetEffects') return [];
      return null;
    });
  });

  it('heals when bloodied (currentHp <= maxHp/2) and has at least 1 HP', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'TestCharacter' && prop === 'hitPoints') return 40;
      if (name === 'TestCharacter' && prop === 'currentHitPoints') return 15;
      if (prop === 'targetEffects') return [];
      return null;
    });

    await applyTurnStartEffects('TestCharacter', {
      turnStartEffects: [{ type: 'survivor_turn_start_heal', healExpression: '5 + CON modifier' }]
    }, 'TestCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'TestCharacter',
      'currentHitPoints',
      20,
      'TestCampaign'
    );
  });

  it('does not heal when above half HP', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'TestCharacter' && prop === 'hitPoints') return 40;
      if (name === 'TestCharacter' && prop === 'currentHitPoints') return 25;
      if (prop === 'targetEffects') return [];
      return null;
    });

    await applyTurnStartEffects('TestCharacter', {
      turnStartEffects: [{ type: 'survivor_turn_start_heal', healExpression: '5 + CON modifier' }]
    }, 'TestCampaign');

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('does not heal at 0 HP', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'TestCharacter' && prop === 'hitPoints') return 40;
      if (name === 'TestCharacter' && prop === 'currentHitPoints') return 0;
      if (prop === 'targetEffects') return [];
      return null;
    });

    await applyTurnStartEffects('TestCharacter', {
      turnStartEffects: [{ type: 'survivor_turn_start_heal', healExpression: '5 + CON modifier' }]
    }, 'TestCampaign');

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('caps healing at max HP when bloodied', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'TestCharacter' && prop === 'hitPoints') return 20;
      if (name === 'TestCharacter' && prop === 'currentHitPoints') return 10;
      if (prop === 'targetEffects') return [];
      return null;
    });

    await applyTurnStartEffects('TestCharacter', {
      turnStartEffects: [{ type: 'survivor_turn_start_heal', healExpression: '5 + CON modifier' }]
    }, 'TestCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'TestCharacter',
      'currentHitPoints',
      15,
      'TestCampaign'
    );
  });

  it('heals correct amount when bloodied at exactly half HP', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'TestCharacter' && prop === 'hitPoints') return 20;
      if (name === 'TestCharacter' && prop === 'currentHitPoints') return 10;
      if (prop === 'targetEffects') return [];
      return null;
    });

    await applyTurnStartEffects('TestCharacter', {
      turnStartEffects: [{ type: 'survivor_turn_start_heal', healExpression: '5 + CON modifier' }]
    }, 'TestCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'TestCharacter',
      'currentHitPoints',
      15,
      'TestCampaign'
    );
  });

  it('does not call setRuntimeValue for non-bloodied character at exactly half HP threshold', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'TestCharacter' && prop === 'hitPoints') return 20;
      if (name === 'TestCharacter' && prop === 'currentHitPoints') return 11;
      if (prop === 'targetEffects') return [];
      return null;
    });

    await applyTurnStartEffects('TestCharacter', {
      turnStartEffects: [{ type: 'survivor_turn_start_heal', healExpression: '5 + CON modifier' }]
    }, 'TestCampaign');

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('uses default heal amount when no expression provided', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'TestCharacter' && prop === 'hitPoints') return 40;
      if (name === 'TestCharacter' && prop === 'currentHitPoints') return 15;
      if (prop === 'targetEffects') return [];
      return null;
    });

    await applyTurnStartEffects('TestCharacter', {
      turnStartEffects: [{ type: 'survivor_turn_start_heal' }]
    }, 'TestCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'TestCharacter',
      'currentHitPoints',
      20,
      'TestCampaign'
    );
  });
});
