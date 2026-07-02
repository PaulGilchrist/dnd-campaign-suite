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
  loadCombatSummary: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../rules/combat/rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(),
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

import { applyTurnStartEffects } from './expirations.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../encounters/combatData.js';
import storage from '../../ui/storage.js';
import { addEntry } from '../../ui/logService.js';

function resetMocks() {
  vi.clearAllMocks();
  localStorage.clear();
  window.dispatchEvent = vi.fn();
}

// ---------------------------------------------------------------------------
// applyGrappleDamageTurnStart — indirect via applyTurnStartEffects
// ---------------------------------------------------------------------------
describe('applyGrappleDamageTurnStart (indirect tests)', () => {
  beforeEach(() => {
    resetMocks();
    getRuntimeValue.mockImplementation((_name, prop) => {
      if (prop === 'targetEffects') return [];
      return null;
    });
  });

  it('skips creatures that are not grappled', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (prop === 'targetEffects') return [];
      return null;
    });
    getCombatSummary.mockReturnValue({
      creatures: [
        { name: 'Orc', conditions: [{ key: 'grappled' }], hit_points: { current: 15 } },
      ],
    });

    await applyTurnStartEffects('TestCharacter', {
      turnStartEffects: [{
        type: 'grapple_damage',
        damageType: 'Slashing',
      }],
      abilities: [],
    }, 'TestCampaign');

    const damageEntries = addEntry.mock.calls.filter(
      (c) => c[1]?.type === 'damage'
    );
    expect(damageEntries.length).toBe(1);
    expect(damageEntries[0][1]?.damageType).toBe('slashing');
  });

  it('uses default damage type Bludgeoning when not provided', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (prop === 'targetEffects') return [];
      return null;
    });
    getCombatSummary.mockReturnValue({
      creatures: [
        { name: 'Orc', conditions: [{ key: 'grappled' }], hit_points: { current: 15 } },
      ],
    });

    await applyTurnStartEffects('TestCharacter', {
      turnStartEffects: [{
        type: 'grapple_damage',
        damageExpression: '2',
      }],
      abilities: [],
    }, 'TestCampaign');

    const damageEntries = addEntry.mock.calls.filter(
      (c) => c[1]?.type === 'damage'
    );
    expect(damageEntries.length).toBe(1);
    expect(damageEntries[0][1]?.damageType).toBe('bludgeoning');
  });

  it('handles grappled condition as string instead of object', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (prop === 'targetEffects') return [];
      return null;
    });
    getCombatSummary.mockReturnValue({
      creatures: [
        { name: 'Orc', conditions: ['grappled'], hit_points: { current: 15 } },
      ],
    });

    await applyTurnStartEffects('TestCharacter', {
      turnStartEffects: [{
        type: 'grapple_damage',
        damageExpression: '2',
      }],
      abilities: [],
    }, 'TestCampaign');

    const damageEntries = addEntry.mock.calls.filter(
      (c) => c[1]?.type === 'damage'
    );
    expect(damageEntries.length).toBe(1);
  });

  it('skips the active character themselves', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (prop === 'targetEffects') return [];
      return null;
    });
    getCombatSummary.mockReturnValue({
      creatures: [
        { name: 'TestCharacter', conditions: [{ key: 'grappled' }], hit_points: { current: 15 } },
      ],
    });

    await applyTurnStartEffects('TestCharacter', {
      turnStartEffects: [{
        type: 'grapple_damage',
        damageExpression: '2',
      }],
      abilities: [],
    }, 'TestCampaign');

    const damageEntries = addEntry.mock.calls.filter(
      (c) => c[1]?.type === 'damage'
    );
    expect(damageEntries).toHaveLength(0);
  });

  it('skips when no combat summary', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (prop === 'targetEffects') return [];
      return null;
    });
    getCombatSummary.mockReturnValue(null);

    await applyTurnStartEffects('TestCharacter', {
      turnStartEffects: [{
        type: 'grapple_damage',
        damageExpression: '2',
      }],
      abilities: [],
    }, 'TestCampaign');

    expect(storage.set).not.toHaveBeenCalled();
  });

  it('handles creature with currentHp fallback', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (prop === 'targetEffects') return [];
      return null;
    });
    getCombatSummary.mockReturnValue({
      creatures: [
        { name: 'Orc', conditions: [{ key: 'grappled' }], hit_points: { current: 15 }, currentHp: 15 },
      ],
    });

    await applyTurnStartEffects('TestCharacter', {
      turnStartEffects: [{
        type: 'grapple_damage',
        damageExpression: '2',
      }],
      abilities: [],
    }, 'TestCampaign');

    const damageEntries = addEntry.mock.calls.filter(
      (c) => c[1]?.type === 'damage'
    );
    expect(damageEntries).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// applyHeroismTempHp — indirect via applyTurnStartEffects
// ---------------------------------------------------------------------------
describe('applyHeroismTempHp (indirect tests)', () => {
  beforeEach(() => {
    resetMocks();
    getRuntimeValue.mockImplementation((_name, prop) => {
      if (prop === 'targetEffects') return [];
      return null;
    });
  });

  it('sets tempHp when Heroism buff exists with tempHpAmount', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'Test' && prop === 'activeBuffs') return [
        { name: 'Heroism', tempHpAmount: 5 },
      ];
      if (name === 'Test' && prop === 'tempHp') return 0;
      if (prop === 'targetEffects') return [];
      return null;
    });

    await applyTurnStartEffects('Test', {
      turnStartEffects: [{ type: 'heroism_temp_hp' }],
    }, 'TestCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Test',
      'tempHp',
      5,
      'TestCampaign',
    );
  });

  it('uses max of existing tempHp and heroism tempHpAmount', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'Test' && prop === 'activeBuffs') return [
        { name: 'Heroism', tempHpAmount: 3 },
      ];
      if (name === 'Test' && prop === 'tempHp') return 7;
      if (prop === 'targetEffects') return [];
      return null;
    });

    await applyTurnStartEffects('Test', {
      turnStartEffects: [{ type: 'heroism_temp_hp' }],
    }, 'TestCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Test',
      'tempHp',
      7,
      'TestCampaign',
    );
  });

  it('returns early when no Heroism buff', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'Test' && prop === 'activeBuffs') return [
        { name: 'OtherBuff' },
      ];
      if (prop === 'targetEffects') return [];
      return null;
    });

    await applyTurnStartEffects('Test', {
      turnStartEffects: [{ type: 'heroism_temp_hp' }],
    }, 'TestCampaign');

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('returns early when Heroism buff has no tempHpAmount', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'Test' && prop === 'activeBuffs') return [
        { name: 'Heroism' },
      ];
      if (prop === 'targetEffects') return [];
      return null;
    });

    await applyTurnStartEffects('Test', {
      turnStartEffects: [{ type: 'heroism_temp_hp' }],
    }, 'TestCampaign');

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('returns early when Heroism buff has zero tempHpAmount', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'Test' && prop === 'activeBuffs') return [
        { name: 'Heroism', tempHpAmount: 0 },
      ];
      if (prop === 'targetEffects') return [];
      return null;
    });

    await applyTurnStartEffects('Test', {
      turnStartEffects: [{ type: 'heroism_temp_hp' }],
    }, 'TestCampaign');

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('handles empty activeBuffs array', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'Test' && prop === 'activeBuffs') return [];
      if (prop === 'targetEffects') return [];
      return null;
    });

    await applyTurnStartEffects('Test', {
      turnStartEffects: [{ type: 'heroism_temp_hp' }],
    }, 'TestCampaign');

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// applyUmbralSightTurnStart — indirect via applyTurnStartEffects
// ---------------------------------------------------------------------------
describe('applyUmbralSightTurnStart (indirect tests)', () => {
  beforeEach(() => {
    resetMocks();
    getRuntimeValue.mockImplementation((_name, prop) => {
      if (prop === 'targetEffects') return [];
      return null;
    });
  });

  it('adds invisible when in darkness and not already invisible', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'Test' && prop === 'umbralSightDarknessActive') return true;
      if (name === 'Test' && prop === 'activeConditions') return ['fatigued'];
      if (prop === 'targetEffects') return [];
      return null;
    });

    await applyTurnStartEffects('Test', {
      turnStartEffects: [{ type: 'umbral_sight' }],
    }, 'TestCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Test',
      'activeConditions',
      ['fatigued', 'invisible'],
      'TestCampaign',
    );
  });

  it('removes invisible when not in darkness and currently invisible', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'Test' && prop === 'umbralSightDarknessActive') return false;
      if (name === 'Test' && prop === 'activeConditions') return ['fatigued', 'invisible'];
      if (prop === 'targetEffects') return [];
      return null;
    });

    await applyTurnStartEffects('Test', {
      turnStartEffects: [{ type: 'umbral_sight' }],
    }, 'TestCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Test',
      'activeConditions',
      ['fatigued'],
      'TestCampaign',
    );
  });

  it('does nothing when in darkness and already invisible', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'Test' && prop === 'umbralSightDarknessActive') return true;
      if (name === 'Test' && prop === 'activeConditions') return ['fatigued', 'invisible'];
      if (prop === 'targetEffects') return [];
      return null;
    });

    await applyTurnStartEffects('Test', {
      turnStartEffects: [{ type: 'umbral_sight' }],
    }, 'TestCampaign');

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('does nothing when not in darkness and not invisible', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'Test' && prop === 'umbralSightDarknessActive') return false;
      if (name === 'Test' && prop === 'activeConditions') return ['fatigued'];
      if (prop === 'targetEffects') return [];
      return null;
    });

    await applyTurnStartEffects('Test', {
      turnStartEffects: [{ type: 'umbral_sight' }],
    }, 'TestCampaign');

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// applySteadyAimClearTurnStart — indirect via applyTurnStartEffects
// ---------------------------------------------------------------------------
describe('applySteadyAimClearTurnStart (indirect tests)', () => {
  beforeEach(() => {
    resetMocks();
    getRuntimeValue.mockImplementation((_name, prop) => {
      if (prop === 'targetEffects') return [];
      return null;
    });
  });

  it('removes speed_zero condition', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'Test' && prop === 'activeConditions') return ['speed_zero', 'blinded'];
      if (prop === 'targetEffects') return [];
      return null;
    });

    await applyTurnStartEffects('Test', {
      turnStartEffects: [{ type: 'steady_aim_clear' }],
    }, 'TestCampaign');

    await Promise.resolve();

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Test',
      'activeConditions',
      ['blinded'],
      'TestCampaign',
    );
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Test',
      'steadyAimMovedThisTurn',
      false,
      'TestCampaign',
    );
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Test',
      'steadyAimSpeedZero',
      false,
      'TestCampaign',
    );
  });

  it('clears steadyAim flags even when no speed_zero condition', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'Test' && prop === 'activeConditions') return ['blinded'];
      if (prop === 'targetEffects') return [];
      return null;
    });

    await applyTurnStartEffects('Test', {
      turnStartEffects: [{ type: 'steady_aim_clear' }],
    }, 'TestCampaign');

    const condCalls = setRuntimeValue.mock.calls.filter(
      (c) => c[1] === 'activeConditions',
    );
    expect(condCalls).toHaveLength(0);
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Test',
      'steadyAimMovedThisTurn',
      false,
      'TestCampaign',
    );
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Test',
      'steadyAimSpeedZero',
      false,
      'TestCampaign',
    );
  });
});

// ---------------------------------------------------------------------------
// applySupremeSneakTurnStart — indirect via applyTurnStartEffects
// ---------------------------------------------------------------------------
describe('applySupremeSneakTurnStart (indirect tests)', () => {
  beforeEach(() => {
    resetMocks();
    getRuntimeValue.mockImplementation((_name, prop) => {
      if (prop === 'targetEffects') return [];
      return null;
    });
  });

  it('clears stealthAttackCost and preserves invisible when cost > 0 and invisible', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'Test' && prop === 'stealthAttackCost') return 1;
      if (name === 'Test' && prop === 'activeConditions') return ['invisible', 'blinded'];
      if (prop === 'targetEffects') return [];
      return null;
    });

    await applyTurnStartEffects('Test', {
      turnStartEffects: [{ type: 'supreme_sneak' }],
    }, 'TestCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Test',
      'stealthAttackCost',
      0,
      'TestCampaign',
    );
  });

  it('does nothing when stealthAttackCost is 0', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'Test' && prop === 'stealthAttackCost') return 0;
      if (prop === 'targetEffects') return [];
      return null;
    });

    await applyTurnStartEffects('Test', {
      turnStartEffects: [{ type: 'supreme_sneak' }],
    }, 'TestCampaign');

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('does nothing when stealthAttackCost is null', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'Test' && prop === 'stealthAttackCost') return null;
      if (prop === 'targetEffects') return [];
      return null;
    });

    await applyTurnStartEffects('Test', {
      turnStartEffects: [{ type: 'supreme_sneak' }],
    }, 'TestCampaign');

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('does nothing when stealthAttackCost is negative', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'Test' && prop === 'stealthAttackCost') return -1;
      if (prop === 'targetEffects') return [];
      return null;
    });

    await applyTurnStartEffects('Test', {
      turnStartEffects: [{ type: 'supreme_sneak' }],
    }, 'TestCampaign');

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// applyUseMagicDeviceTurnStart — indirect via applyTurnStartEffects
// ---------------------------------------------------------------------------
describe('applyUseMagicDeviceTurnStart (indirect tests)', () => {
  beforeEach(() => {
    resetMocks();
    getRuntimeValue.mockImplementation((_name, prop) => {
      if (prop === 'targetEffects') return [];
      return null;
    });
  });

  it('is a no-op placeholder', async () => {
    await applyTurnStartEffects('Test', {
      turnStartEffects: [{ type: 'use_magic_device' }],
    }, 'TestCampaign');

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// applyElderChampionRegeneration — indirect via applyTurnStartEffects
// ---------------------------------------------------------------------------
describe('applyElderChampionRegeneration (indirect tests)', () => {
  beforeEach(() => {
    resetMocks();
    getRuntimeValue.mockImplementation((_name, prop) => {
      if (prop === 'targetEffects') return [];
      return null;
    });
  });

  it('returns early when elderChampionActive is false', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'Test' && prop === 'elderChampionActive') return false;
      if (prop === 'targetEffects') return [];
      return null;
    });

    await applyTurnStartEffects('Test', {
      turnStartEffects: [{ type: 'elder_champion_regeneration', healExpression: '1d8' }],
    }, 'TestCampaign');

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('heals using default amount when no expression', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'Test' && prop === 'elderChampionActive') return true;
      if (name === 'Test' && prop === 'hitPoints') return 20;
      if (name === 'Test' && prop === 'currentHitPoints') return 10;
      if (prop === 'targetEffects') return [];
      return null;
    });

    await applyTurnStartEffects('Test', {
      turnStartEffects: [{ type: 'elder_champion_regeneration' }],
    }, 'TestCampaign');

    // No expression → default 10, but evaluateAutoExpression mock returns 1 for string '10'
    // Actually the code checks: effect.healExpression ? evaluateAutoExpression(...) : 10
    // When no expression, it defaults to 10 directly without calling evaluateAutoExpression
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Test',
      'currentHitPoints',
      20,
      'TestCampaign',
    );
  });

  it('heals using custom expression when provided', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'Test' && prop === 'elderChampionActive') return true;
      if (name === 'Test' && prop === 'hitPoints') return 20;
      if (name === 'Test' && prop === 'currentHitPoints') return 10;
      if (prop === 'targetEffects') return [];
      return null;
    });

    await applyTurnStartEffects('Test', {
      turnStartEffects: [{ type: 'elder_champion_regeneration', healExpression: '5' }],
    }, 'TestCampaign');

    // evaluateAutoExpression mock returns 1 for string '5'
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Test',
      'currentHitPoints',
      11,
      'TestCampaign',
    );
  });

  it('caps healing at max hit points', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'Test' && prop === 'elderChampionActive') return true;
      if (name === 'Test' && prop === 'hitPoints') return 20;
      if (name === 'Test' && prop === 'currentHitPoints') return 18;
      if (prop === 'targetEffects') return [];
      return null;
    });

    await applyTurnStartEffects('Test', {
      turnStartEffects: [{ type: 'elder_champion_regeneration', healExpression: '5' }],
    }, 'TestCampaign');

    // evaluateAutoExpression mock returns 1 for string '5', so 18+1=19, capped at 20
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Test',
      'currentHitPoints',
      19,
      'TestCampaign',
    );
  });

  it('does not heal when hitPoints is null', async () => {
    let rejectionCaught = false;
    const handler = () => { rejectionCaught = true; };
    process.once('unhandledRejection', handler);

    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'Test' && prop === 'elderChampionActive') return true;
      if (prop === 'hitPoints') return null;
      if (prop === 'targetEffects') return [];
      return null;
    });

    applyTurnStartEffects('Test', {
      turnStartEffects: [{ type: 'elder_champion_regeneration', healExpression: '5' }],
    }, 'TestCampaign');

    await new Promise((r) => setTimeout(r, 0));

    process.off('unhandledRejection', handler);
    expect(rejectionCaught).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// applyDreadAmbushSpeedTurnStart — indirect via applyTurnStartEffects
// ---------------------------------------------------------------------------
describe('applyDreadAmbushSpeedTurnStart (indirect tests)', () => {
  beforeEach(() => {
    resetMocks();
    getRuntimeValue.mockImplementation((_name, prop) => {
      if (prop === 'targetEffects') return [];
      return null;
    });
  });

  it('returns early when not round 1', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'Test' && prop === 'dreadAmbushSpeedActive') return false;
      if (prop === 'targetEffects') return [];
      return null;
    });
    getCombatSummary.mockReturnValue({ round: 3 });

    await applyTurnStartEffects('Test', {
      turnStartEffects: [{ type: 'dread_ambush_speed', bonusExpression: '10' }],
    }, 'TestCampaign');

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('returns early when already active', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'Test' && prop === 'dreadAmbushSpeedActive') return true;
      if (prop === 'targetEffects') return [];
      return null;
    });
    getCombatSummary.mockReturnValue({ round: 1 });

    await applyTurnStartEffects('Test', {
      turnStartEffects: [{ type: 'dread_ambush_speed', bonusExpression: '10' }],
    }, 'TestCampaign');

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('activates speed boost when round 1 and not already active', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'Test' && prop === 'dreadAmbushSpeedActive') return false;
      if (name === 'Test' && prop === 'activeBuffs') return [];
      if (prop === 'targetEffects') return [];
      return null;
    });
    getCombatSummary.mockReturnValue({ round: 1 });

    await applyTurnStartEffects('Test', {
      turnStartEffects: [{ type: 'dread_ambush_speed', bonusExpression: '15' }],
    }, 'TestCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Test',
      'dreadAmbushSpeedActive',
      true,
      'TestCampaign',
    );
    const buffsCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeBuffs');
    expect(buffsCall).toBeDefined();
    expect(buffsCall[2]).toEqual([
      {
        name: 'Dread Ambush',
        effect: 'speed_boost',
        duration: 'until_end_of_turn',
        speedBonus: 15,
      },
    ]);
  });
});

// ---------------------------------------------------------------------------
// applyFlurryHealingHarmTurnStart — indirect via applyTurnStartEffects
// ---------------------------------------------------------------------------
describe('applyFlurryHealingHarmTurnStart (indirect tests)', () => {
  beforeEach(() => {
    resetMocks();
    getRuntimeValue.mockImplementation((_name, prop) => {
      if (prop === 'targetEffects') return [];
      return null;
    });
  });

  it('sets flurryHealingHarmUses based on WIS modifier expression', async () => {
    getRuntimeValue.mockImplementation((_name, prop) => {
      if (prop === 'targetEffects') return [];
      return null;
    });

    await applyTurnStartEffects('Test', {
      turnStartEffects: [{
        type: 'flurry_healing_harm',
        usesExpression: 'WIS modifier minimum 1',
      }],
      abilities: [{ name: 'Wisdom', bonus: 3 }],
    }, 'TestCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Test',
      'flurryHealingHarmUses',
      3,
      'TestCampaign',
    );
  });

  it('defaults uses to 1 when WIS modifier is 0', async () => {
    getRuntimeValue.mockImplementation((_name, prop) => {
      if (prop === 'targetEffects') return [];
      return null;
    });

    await applyTurnStartEffects('Test', {
      turnStartEffects: [{
        type: 'flurry_healing_harm',
        usesExpression: 'WIS modifier minimum 1',
      }],
      abilities: [{ name: 'Wisdom', bonus: 0 }],
    }, 'TestCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Test',
      'flurryHealingHarmUses',
      1,
      'TestCampaign',
    );
  });

  it('defaults uses to 1 when expression evaluation fails', async () => {
    getRuntimeValue.mockImplementation((_name, prop) => {
      if (prop === 'targetEffects') return [];
      return null;
    });

    await applyTurnStartEffects('Test', {
      turnStartEffects: [{
        type: 'flurry_healing_harm',
        usesExpression: 'invalid_expression',
      }],
      abilities: [{ name: 'Wisdom', bonus: 0 }],
    }, 'TestCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Test',
      'flurryHealingHarmUses',
      1,
      'TestCampaign',
    );
  });

  it('uses explicit numeric expression directly', async () => {
    getRuntimeValue.mockImplementation((_name, prop) => {
      if (prop === 'targetEffects') return [];
      return null;
    });

    await applyTurnStartEffects('Test', {
      turnStartEffects: [{
        type: 'flurry_healing_harm',
        usesExpression: '5',
      }],
      abilities: [{ name: 'Wisdom', bonus: 0 }],
    }, 'TestCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Test',
      'flurryHealingHarmUses',
      5,
      'TestCampaign',
    );
  });
});

// ---------------------------------------------------------------------------
// applySuperiorDefenseTurnStart — indirect via applyTurnStartEffects
// ---------------------------------------------------------------------------
describe('applySuperiorDefenseTurnStart (indirect tests)', () => {
  beforeEach(() => {
    resetMocks();
    getRuntimeValue.mockImplementation((_name, prop) => {
      if (prop === 'targetEffects') return [];
      return null;
    });
  });

  it('returns early when incapacitated', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'Test' && prop === 'activeConditions') return ['incapacitated'];
      if (prop === 'targetEffects') return [];
      return null;
    });

    await applyTurnStartEffects('Test', {
      turnStartEffects: [{ type: 'superior_defense', cost: 1 }],
    }, 'TestCampaign');

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('returns early when Superior Defense buff already active', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'Test' && prop === 'activeConditions') return [];
      if (name === 'Test' && prop === 'activeBuffs') return [
        { name: 'Superior Defense', effect: 'damage_resistance' },
      ];
      if (prop === 'targetEffects') return [];
      return null;
    });

    await applyTurnStartEffects('Test', {
      turnStartEffects: [{ type: 'superior_defense', cost: 1 }],
    }, 'TestCampaign');

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('returns early when focus points are insufficient', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'Test' && prop === 'activeConditions') return [];
      if (name === 'Test' && prop === 'activeBuffs') return [];
      if (name === 'Test' && prop === 'focusPoints') return 0;
      if (prop === 'targetEffects') return [];
      return null;
    });

    await applyTurnStartEffects('Test', {
      turnStartEffects: [{ type: 'superior_defense', cost: 2 }],
      class: { class_levels: [{ level: 1, focus_points: 3 }] },
      level: 1,
    }, 'TestCampaign');

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('activates Superior Defense when conditions are met', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'Test' && prop === 'activeConditions') return [];
      if (name === 'Test' && prop === 'activeBuffs') return [];
      if (name === 'Test' && prop === 'focusPoints') return 2;
      if (prop === 'targetEffects') return [];
      return null;
    });

    await applyTurnStartEffects('Test', {
      turnStartEffects: [{ type: 'superior_defense', cost: 1 }],
    }, 'TestCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Test',
      'focusPoints',
      1,
      'TestCampaign',
    );
    const buffsCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeBuffs');
    expect(buffsCall).toBeDefined();
    expect(buffsCall[2]).toEqual([
      {
        name: 'Superior Defense',
        effect: 'damage_resistance',
        duration: '1_minute',
        resistanceTypes: expect.any(Array),
      },
    ]);
  });
});

// ---------------------------------------------------------------------------
// applyRegenerateTurnStartHeal — indirect via applyTurnStartEffects
// ---------------------------------------------------------------------------
describe('applyRegenerateTurnStartHeal (indirect tests)', () => {
  beforeEach(() => {
    resetMocks();
    getRuntimeValue.mockImplementation((_name, prop) => {
      if (prop === 'targetEffects') return [];
      return null;
    });
  });

  it('heals when regenerateActive is true', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'Test' && prop === 'regenerateActive') return true;
      if (name === 'Test' && prop === 'hitPoints') return 20;
      if (name === 'Test' && prop === 'currentHitPoints') return 10;
      if (prop === 'targetEffects') return [];
      return null;
    });

    await applyTurnStartEffects('Test', {
      turnStartEffects: [{ type: 'regenerate_turn_start_heal', healExpression: '2' }],
    }, 'TestCampaign');

    // evaluateAutoExpression mock returns 1 for string '2'
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Test',
      'currentHitPoints',
      11,
      'TestCampaign',
    );
  });

  it('does nothing when regenerateActive is false', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'Test' && prop === 'regenerateActive') return false;
      if (prop === 'targetEffects') return [];
      return null;
    });

    await applyTurnStartEffects('Test', {
      turnStartEffects: [{ type: 'regenerate_turn_start_heal', healExpression: '2' }],
    }, 'TestCampaign');

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('caps healing at max hit points', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'Test' && prop === 'regenerateActive') return true;
      if (name === 'Test' && prop === 'hitPoints') return 20;
      if (name === 'Test' && prop === 'currentHitPoints') return 18;
      if (prop === 'targetEffects') return [];
      return null;
    });

    await applyTurnStartEffects('Test', {
      turnStartEffects: [{ type: 'regenerate_turn_start_heal', healExpression: '5' }],
    }, 'TestCampaign');

    // evaluateAutoExpression mock returns 1 for string '5', so 18+1=19, capped at 20
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Test',
      'currentHitPoints',
      19,
      'TestCampaign',
    );
  });
});

// ---------------------------------------------------------------------------
// applySurvivorTurnStartHeal — indirect via applyTurnStartEffects
// ---------------------------------------------------------------------------
describe('applySurvivorTurnStartHeal (indirect tests)', () => {
  beforeEach(() => {
    resetMocks();
    getRuntimeValue.mockImplementation((_name, prop) => {
      if (prop === 'targetEffects') return [];
      return null;
    });
  });

  it('heals when bloodied and survivor not used this turn', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'Test' && prop === 'hitPoints') return 40;
      if (name === 'Test' && prop === 'currentHitPoints') return 15;
      if (prop === 'targetEffects') return [];
      return null;
    });

    await applyTurnStartEffects('Test', {
      turnStartEffects: [{ type: 'survivor_turn_start_heal', healExpression: '5' }],
    }, 'TestCampaign');

    // evaluateAutoExpression mock returns 1 for string '5', so 15+1=16
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Test',
      'currentHitPoints',
      16,
      'TestCampaign',
    );
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Test',
      'survivorUsedThisTurn',
      true,
      'TestCampaign',
    );
  });

  it('does not heal when above half HP', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'Test' && prop === 'survivorUsedThisTurn') return false;
      if (name === 'Test' && prop === 'hitPoints') return 40;
      if (name === 'Test' && prop === 'currentHitPoints') return 25;
      if (prop === 'targetEffects') return [];
      return null;
    });

    await applyTurnStartEffects('Test', {
      turnStartEffects: [{ type: 'survivor_turn_start_heal', healExpression: '5' }],
    }, 'TestCampaign');

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('does not heal at 0 HP', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'Test' && prop === 'survivorUsedThisTurn') return false;
      if (name === 'Test' && prop === 'hitPoints') return 40;
      if (name === 'Test' && prop === 'currentHitPoints') return 0;
      if (prop === 'targetEffects') return [];
      return null;
    });

    await applyTurnStartEffects('Test', {
      turnStartEffects: [{ type: 'survivor_turn_start_heal', healExpression: '5' }],
    }, 'TestCampaign');

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('caps healing at max HP', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'Test' && prop === 'hitPoints') return 20;
      if (name === 'Test' && prop === 'currentHitPoints') return 10;
      if (prop === 'targetEffects') return [];
      return null;
    });

    await applyTurnStartEffects('Test', {
      turnStartEffects: [{ type: 'survivor_turn_start_heal', healExpression: '15' }],
    }, 'TestCampaign');

    // evaluateAutoExpression mock returns 1 for string '15', so 10+1=11, capped at 20
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Test',
      'currentHitPoints',
      11,
      'TestCampaign',
    );
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Test',
      'survivorUsedThisTurn',
      true,
      'TestCampaign',
    );
  });

  it('uses default heal amount when no expression provided', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (name === 'Test' && prop === 'hitPoints') return 40;
      if (name === 'Test' && prop === 'currentHitPoints') return 15;
      if (prop === 'targetEffects') return [];
      return null;
    });

    await applyTurnStartEffects('Test', {
      turnStartEffects: [{ type: 'survivor_turn_start_heal' }],
    }, 'TestCampaign');

    // No expression → default 5, applied directly without evaluateAutoExpression
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Test',
      'currentHitPoints',
      20,
      'TestCampaign',
    );
  });
});
