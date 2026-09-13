// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildAttackContextSync } from './contextBuilder.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

vi.mock('./common/damageRoll.js', () => ({
  buildBaseAttackContext: vi.fn(),
}));

vi.mock('../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../maps/mapsService.js', () => ({
  loadMapData: vi.fn(),
}));

vi.mock('../rules/combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(),
  computeMeleeProximityEffect: vi.fn(),
  getDistanceFeet: vi.fn(),
  isHostileNPC: vi.fn(),
  getNearestPlacedItem: vi.fn(),
  rangeToFeet: vi.fn(),
}));

vi.mock('../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../rules/combat/coverService.js', () => ({
  computeCover: vi.fn(),
}));

vi.mock('../npcs/npcsService.js', () => ({
  loadNPCs: vi.fn(),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../combat/buffs/buffService.js', () => ({
  getInnateSorceryBonus: vi.fn(),
}));

vi.mock('../combat/auras/wolfAuraUtils.js', () => ({
  getWolfAdvantageAgainst: vi.fn(),
}));

vi.mock('../combat/auras/duplicityAuraUtils.js', () => ({
  getDuplicityAdvantageAgainst: vi.fn(),
}));

vi.mock('../combat/auras/lionAuraUtils.js', () => ({
  getLionDisadvantageAgainst: vi.fn(),
}));

vi.mock('../combat/auras/coronaAuraUtils.js', () => ({
  getCoronaSaveDisadvantage: vi.fn(),
}));

vi.mock('./handlers/class-cleric-paladin/avengingAngelHandler.js', () => ({
  isActive: vi.fn(),
  isAuraTarget: vi.fn(),
  handle: vi.fn(),
}));

vi.mock('../automation/handlers/buffs/protectionFromEvilAndGoodHandler.js', () => ({
  isProtectionFromEvilAndGoodActive: vi.fn().mockReturnValue(false),
  isCreatureWarded: vi.fn().mockReturnValue(false),
  handle: vi.fn(),
}));

vi.mock('../automation/handlers/buffs/deathWardHandler.js', () => ({
  isDeathWardActive: vi.fn().mockReturnValue(false),
  handle: vi.fn(),
}));

vi.mock('../combat/automation/automationService.js', () => ({
  collectWeaponMastery: vi.fn().mockReturnValue({ baseMastery: null, extraMasteries: [] }),
}));

vi.mock('../combat/automation/automationExpressions.js', () => ({
  resolveDiceExpression: vi.fn(),
}));

vi.mock('../combat/automation/automationPassives.js', () => ({
  isResilientSphereActive: vi.fn().mockReturnValue(false),
}));

vi.mock('../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn().mockReturnValue(1),
}));

const { buildBaseAttackContext } = await import('./common/damageRoll.js');
const { getInnateSorceryBonus } = await import('../combat/buffs/buffService.js');
const { getWolfAdvantageAgainst } = await import('../combat/auras/wolfAuraUtils.js');
const { getDuplicityAdvantageAgainst } = await import('../combat/auras/duplicityAuraUtils.js');
const { getLionDisadvantageAgainst } = await import('../combat/auras/lionAuraUtils.js');
const { getCoronaSaveDisadvantage } = await import('../combat/auras/coronaAuraUtils.js');
const { isDeathWardActive } = await import('../automation/handlers/buffs/deathWardHandler.js');

const mockStats = {
  name: 'Fighter1',
  level: 5,
  proficiency: 2,
  class: {
    class_levels: [{ rage_damage: 2 }],
  },
  abilities: [
    { name: 'Charisma', bonus: 2 },
    { name: 'Strength', bonus: 4 },
    { name: 'Dexterity', bonus: 3 },
  ],
  automation: {
    passives: [],
  },
};

const mockAttack = {
  name: 'Longsword',
  damage: '1d8+4',
  damageType: 'Slashing',
  hitBonus: 7,
  hitBonusFormula: 'To Hit = 4 + 2 + 1',
  weaponType: 'melee',
};

function defaultBaseAttackContext(targetName = 'Orc', target = null) {
  buildBaseAttackContext.mockResolvedValue({
    target: target ?? { name: targetName },
    targetName,
    resistanceNotice: null,
  });
}

function defaultAuraMocks() {
  getWolfAdvantageAgainst.mockReturnValue({ advantage: false });
  getDuplicityAdvantageAgainst.mockReturnValue({ advantage: false });
  getLionDisadvantageAgainst.mockReturnValue({ disadvantage: false });
  getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: false });
  getInnateSorceryBonus.mockReturnValue({ spellAdvantage: false, saveDcBonus: 0 });
}

describe('contextBuilder-sync: target effects that grant advantage (consumed)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultBaseAttackContext();
    getRuntimeValue.mockReturnValue(undefined);
    defaultAuraMocks();
  });

  it.each([
    {
      effect: 'distracting_strike_advantage',
      name: 'distracting strike',
      setup: () => ({ effect: 'distracting_strike_advantage', target: 'Orc', source: 'Ally' }),
    },
    {
      effect: 'next_attack_advantage',
      name: 'vex (next_attack_advantage)',
      setup: () => ({ effect: 'next_attack_advantage', target: 'Fighter1', vexTarget: 'Orc', source: 'Thorn' }),
    },
  ])('sets advantage and consumes $name effect', async ({ setup }) => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'campaign' && key === 'targetEffects') return [setup()];
      if (key === 'activeBuffs') return [];
      return undefined;
    });

    const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal');

    expect(result.forcedMode).toBe('advantage');
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'campaign',
      'targetEffects',
      [],
      'camp',
    );
  });

  it('preserves other effects when consuming a targeting advantage effect', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'campaign' && key === 'targetEffects') return [
        { effect: 'distracting_strike_advantage', target: 'Orc', source: 'Ally' },
        { effect: 'graze', target: 'Orc' },
      ];
      if (key === 'activeBuffs') return [];
      return undefined;
    });

    await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'campaign',
      'targetEffects',
      [{ effect: 'graze', target: 'Orc' }],
      'camp',
    );
  });
});

describe('contextBuilder-sync: target effects that grant advantage (not consumed)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultBaseAttackContext();
    getRuntimeValue.mockReturnValue(undefined);
    defaultAuraMocks();
  });

  it.each([
    { effect: 'reckless_attack', setup: () => ({ effect: 'reckless_attack', target: 'Orc' }) },
    { effect: 'crusher_enhanced_critical', setup: () => ({ effect: 'crusher_enhanced_critical', target: 'Orc' }) },
    { effect: 'protection', setup: () => ({ effect: 'protection', target: 'Orc', source: 'Paladin' }) },
  ])('sets forcedMode when $effect effect is on target', async ({ setup }) => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'campaign' && key === 'targetEffects') return [setup()];
      if (key === 'activeBuffs') return [];
      return undefined;
    });

    const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal');

    expect(result.forcedMode).toBe(setup().effect === 'protection' ? 'disadvantage' : 'advantage');
  });

  it('does not set advantage/disadvantage when effect targets a different creature', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'campaign' && key === 'targetEffects') return [
        { effect: 'reckless_attack', target: 'Goblin' },
      ];
      if (key === 'activeBuffs') return [];
      return undefined;
    });

    const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal');

    expect(result.forcedMode).toBeUndefined();
  });
});

describe('contextBuilder-sync: next_attack_bonus (Sundering Blow)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultBaseAttackContext();
    getRuntimeValue.mockReturnValue(undefined);
    defaultAuraMocks();
  });

  it('processes next_attack_bonus effects on target', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'campaign' && key === 'targetEffects') return [
        { effect: 'next_attack_bonus', target: 'Orc', value: 5 },
      ];
      if (key === 'activeBuffs') return [];
      return undefined;
    });

    const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal');

    expect(result.hitBonus).toBe(7);
  });

  it('processes multiple next_attack_bonus effects on target', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'campaign' && key === 'targetEffects') return [
        { effect: 'next_attack_bonus', target: 'Orc', value: 5 },
        { effect: 'next_attack_bonus', target: 'Orc', value: 3 },
      ];
      if (key === 'activeBuffs') return [];
      return undefined;
    });

    const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal');

    expect(result.hitBonus).toBe(7);
  });
});

describe('contextBuilder-sync: Death Ward grants disadvantage on attacks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultBaseAttackContext();
    getRuntimeValue.mockReturnValue(undefined);
    defaultAuraMocks();
  });

  it('sets disadvantage when target has Death Ward buff', async () => {
    isDeathWardActive.mockReturnValue(true);

    const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal');

    expect(result.forcedMode).toBe('disadvantage');
  });

  it('does not set disadvantage when target has no Death Ward buff', async () => {
    isDeathWardActive.mockReturnValue(false);

    const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal');

    expect(result.forcedMode).toBeUndefined();
  });

  it('stacks with other disadvantage sources', async () => {
    isDeathWardActive.mockReturnValue(true);
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeBuffs') return [{ effect: 'dodge' }];
      return undefined;
    });

    const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal');

    expect(result.forcedMode).toBe('disadvantage');
  });
});
