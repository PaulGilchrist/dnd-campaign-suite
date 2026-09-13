// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildAttackContextSync } from './contextBuilder.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

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

vi.mock('./handlers/spells/sanctuaryHandler.js', () => ({
  endSanctuary: vi.fn(),
}));

vi.mock('../automation/handlers/buffs/protectionFromEvilAndGoodHandler.js', () => ({
  isProtectionFromEvilAndGoodActive: vi.fn().mockReturnValue(false),
  isCreatureWarded: vi.fn().mockReturnValue(false),
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
const { isActive: isAvengingAngelActive, isAuraTarget } = await import('./handlers/class-cleric-paladin/avengingAngelHandler.js');

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
  isAvengingAngelActive.mockReturnValue(false);
  isAuraTarget.mockReturnValue(false);
}

describe('contextBuilder-sync: innate sorcery bonus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultBaseAttackContext();
    getRuntimeValue.mockReturnValue(undefined);
    defaultAuraMocks();
  });

  it('sets forcedMode to advantage and adds saveDcBonus when innate sorcery is active', async () => {
    getInnateSorceryBonus.mockReturnValue({ spellAdvantage: true, saveDcBonus: 2 });
    const attack = { ...mockAttack, saveDc: 13 };

    const result = await buildAttackContextSync(attack, mockStats, 'camp', 'normal');

    expect(result.forcedMode).toBe('advantage');
    expect(result.saveDc).toBe(15);
  });
});

describe('contextBuilder-sync: activeBuffs — stance damage (rage)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultBaseAttackContext();
    getRuntimeValue.mockReturnValue(undefined);
    defaultAuraMocks();
  });

  it('accumulates stance damage from multiple rage buffs and uses class_levels rage_damage value', async () => {
    const stats = {
      ...mockStats,
      level: 4,
      class: {
        class_levels: [undefined, undefined, undefined, { rage_damage: 5 }],
      },
    };
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeBuffs') return [
        { damageBonusExpression: 'rage_damage' },
        { damageBonusExpression: 'rage_damage' },
      ];
      return undefined;
    });

    const result = await buildAttackContextSync(mockAttack, stats, 'camp', 'normal');

    expect(result.autoDamageFormula).toBe('1d8+4 plus 10');
  });

  it('uses rage_damage from class_levels when buff expression is rage_damage', async () => {
    const stats = {
      ...mockStats,
      level: 2,
      class: {
        class_levels: [undefined, { rage_damage: 5 }],
      },
    };
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeBuffs') return [{ damageBonusExpression: 'rage_damage' }];
      return undefined;
    });

    const result = await buildAttackContextSync(mockAttack, stats, 'camp', 'normal');

    expect(result.autoDamageFormula).toBe('1d8+4 plus 5');
  });

  it('defaults to 2 for rage_damage when class_levels entry is undefined', async () => {
    const stats = {
      ...mockStats,
      class: {
        class_levels: [undefined, undefined, undefined],
      },
      level: 4,
    };
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeBuffs') return [{ damageBonusExpression: 'rage_damage' }];
      return undefined;
    });

    const result = await buildAttackContextSync(mockAttack, stats, 'camp', 'normal');

    expect(result.autoDamageFormula).toBe('1d8+4 plus 2');
  });

  it('ignores non-rage_damage damageBonusExpression', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeBuffs') return [{ damageBonusExpression: 'some_other_expression' }];
      return undefined;
    });

    const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal');

    expect(result.autoDamageFormula).toBe('1d8+4');
  });
});

describe('contextBuilder-sync: activeBuffs — advantage buffs (reckless attack, advantage_attacks_and_saves, create_illusion)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultBaseAttackContext();
    getRuntimeValue.mockReturnValue(undefined);
    defaultAuraMocks();
  });

  it.each([
    { effect: 'advantage_attacks_advantage_against', name: 'reckless attack' },
    { effect: 'advantage_attacks_and_saves', name: 'advantage_attacks_and_saves' },
    { effect: 'create_illusion', name: 'create_illusion' },
  ])('sets forcedMode to advantage when %s buff is active', async ({ effect }) => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeBuffs') return [{ effect }];
      return undefined;
    });

    const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal');

    expect(result.forcedMode).toBe('advantage');
  });
});

describe('contextBuilder-sync: activeBuffs — Ram', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultBaseAttackContext();
    getRuntimeValue.mockReturnValue(undefined);
    defaultAuraMocks();
  });

  it('sets ramActive true when Ram buff is present', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeBuffs') return [{ optionName: 'Ram' }];
      return undefined;
    });

    const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal');

    expect(result.ramActive).toBe(true);
  });
});

describe('contextBuilder-sync: Dodge action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultBaseAttackContext();
    getRuntimeValue.mockReturnValue(undefined);
    defaultAuraMocks();
  });

  it('sets forcedMode to disadvantage when target has Dodge active', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeBuffs' && name === 'Orc') return [{ name: 'Dodge', effect: 'dodge', duration: 'until_start_of_next_turn' }];
      return undefined;
    });

    const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal');

    expect(result.forcedMode).toBe('disadvantage');
  });

  it('cancels dodge disadvantage with reckless attack advantage', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'campaign' && key === 'targetEffects') return [{ effect: 'reckless_attack', target: 'Orc' }];
      if (key === 'activeBuffs' && name === 'Orc') return [{ name: 'Dodge', effect: 'dodge' }];
      if (key === 'activeBuffs') return [{ effect: 'advantage_attacks_advantage_against' }];
      return undefined;
    });

    const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal');

    expect(result.forcedMode).toBe('advantage');
  });
});

describe('contextBuilder-sync: activeBuffs — sacred weapon', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultBaseAttackContext();
    getRuntimeValue.mockReturnValue(undefined);
    defaultAuraMocks();
  });

  it('adds Charisma bonus to sacredWeaponBonus and hitBonus for melee and unarmed attacks', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeBuffs') return [{ effect: 'sacred_weapon' }];
      return undefined;
    });

    let result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal');
    expect(result.sacredWeaponBonus).toBe(2);
    expect(result.hitBonus).toBe(9);

    const unarmedAttack = { ...mockAttack, weaponType: 'unarmed' };
    result = await buildAttackContextSync(unarmedAttack, mockStats, 'camp', 'normal');
    expect(result.sacredWeaponBonus).toBe(2);
  });

  it('caps sacred weapon Charisma bonus at minimum 1 for both negative and missing stats', async () => {
    const negativeStats = {
      ...mockStats,
      abilities: [
        { name: 'Charisma', bonus: -1 },
        { name: 'Strength', bonus: 4 },
      ],
    };
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeBuffs') return [{ effect: 'sacred_weapon' }];
      return undefined;
    });

    let result = await buildAttackContextSync(mockAttack, negativeStats, 'camp', 'normal');
    expect(result.sacredWeaponBonus).toBe(1);

    const missingChaStats = {
      ...mockStats,
      abilities: [
        { name: 'Strength', bonus: 4 },
      ],
    };
    result = await buildAttackContextSync(mockAttack, missingChaStats, 'camp', 'normal');
    expect(result.sacredWeaponBonus).toBe(1);
  });
});

describe('contextBuilder-sync: activeBuffs — vow of enmity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultBaseAttackContext();
    getRuntimeValue.mockReturnValue(undefined);
    defaultAuraMocks();
  });

  it('sets advantage when vow_of_enmity is on target activeBuffs', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeBuffs') return [{ effect: 'vow_of_enmity' }];
      return undefined;
    });

    const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal');

    expect(result.forcedMode).toBe('advantage');
  });
});

describe('contextBuilder-sync: activeBuffs — clairvoyant combatant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultBaseAttackContext();
    getRuntimeValue.mockReturnValue(undefined);
    defaultAuraMocks();
  });

  it('sets advantage when clairvoyant_combatant is active and target matches', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeBuffs') return [{ effect: 'clairvoyant_combatant' }];
      if (key === 'clairvoyantCombatantTarget') return 'Orc';
      return undefined;
    });

    const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal');

    expect(result.forcedMode).toBe('advantage');
  });
});

describe('contextBuilder-sync: activeBuffs — avenging angel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultBaseAttackContext();
    getRuntimeValue.mockReturnValue(undefined);
    defaultAuraMocks();
  });

  it('sets advantage when avenging angel active and target is in aura', async () => {
    isAvengingAngelActive.mockReturnValue(true);
    isAuraTarget.mockReturnValue(true);

    const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal');

    expect(result.forcedMode).toBe('advantage');
  });
});

describe('contextBuilder-sync: activeBuffs — blessed warrior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultBaseAttackContext();
    getRuntimeValue.mockReturnValue(undefined);
    defaultAuraMocks();
  });

  it('adds +2 to hitBonus and hitBonusFormula for melee and unarmed attacks', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeBuffs') return [{ effect: 'blessed_warrior' }];
      return undefined;
    });

    let result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal');
    expect(result.hitBonus).toBe(9);
    expect(result.hitBonusFormula).toBe('To Hit = 4 + 2 + 1 + Blessed Warrior (2)');

    const unarmedAttack = { ...mockAttack, weaponType: 'unarmed' };
    result = await buildAttackContextSync(unarmedAttack, mockStats, 'camp', 'normal');
    expect(result.hitBonus).toBe(9);
  });
});
