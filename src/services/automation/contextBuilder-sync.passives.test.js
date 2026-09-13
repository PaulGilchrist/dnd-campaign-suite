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
  collectWeaponMastery: vi.fn(),
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
const { collectWeaponMastery } = await import('../combat/automation/automationService.js');

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
  collectWeaponMastery.mockReturnValue({ baseMastery: null, extraMasteries: [] });
}

describe('contextBuilder-sync: hunter lore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultBaseAttackContext();
    getRuntimeValue.mockReturnValue(undefined);
    defaultAuraMocks();
  });

  it('includes hunterLoreNotice with full IRV data when passive exists and target has vulnerabilities, resistances, and immunities', async () => {
    buildBaseAttackContext.mockResolvedValue({
      target: { vulnerabilities: ['fire'], resistances: ['cold'], immunities: ['poison'] },
      targetName: 'Orc',
      resistanceNotice: null,
    });
    const stats = {
      ...mockStats,
      automation: { passives: [{ type: 'passive_rule', effect: 'hunter_lore' }] },
    };

    const result = await buildAttackContextSync(mockAttack, stats, 'camp', 'normal');

    expect(result.hunterLoreNotice).toBe('Vulnerabilities: fire\nResistances: cold\nImmunities: poison');
  });

  it('includes hunterLoreNotice with only present IRV categories', async () => {
    buildBaseAttackContext.mockResolvedValue({
      target: { vulnerabilities: ['fire'], resistances: [], immunities: [] },
      targetName: 'Orc',
      resistanceNotice: null,
    });
    const stats = {
      ...mockStats,
      automation: { passives: [{ type: 'passive_rule', effect: 'hunter_lore' }] },
    };

    const result = await buildAttackContextSync(mockAttack, stats, 'camp', 'normal');

    expect(result.hunterLoreNotice).toBe('Vulnerabilities: fire');
  });

  it.each([
    { name: 'target has no IRV data', target: { name: 'Orc' }, hasPassive: true },
    { name: 'target is null', target: null, hasPassive: true },
    { name: 'passive does not exist', target: { name: 'Orc' }, hasPassive: false },
  ])('returns null hunterLoreNotice when $name', async ({ target, hasPassive }) => {
    buildBaseAttackContext.mockResolvedValue({
      target,
      targetName: target ? 'Orc' : null,
      resistanceNotice: null,
    });
    const stats = hasPassive
      ? { ...mockStats, automation: { passives: [{ type: 'passive_rule', effect: 'hunter_lore' }] } }
      : mockStats;

    const result = await buildAttackContextSync(mockAttack, stats, 'camp', 'normal');

    expect(result.hunterLoreNotice).toBeNull();
  });
});

describe('contextBuilder-sync: critical range', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultBaseAttackContext();
    getRuntimeValue.mockReturnValue(undefined);
    defaultAuraMocks();
  });

  it('includes criticalRange from passives', async () => {
    const stats = {
      ...mockStats,
      automation: {
        passives: [{ type: 'passive_rule', effect: 'critical_range', criticalRange: '19-20' }],
      },
    };

    const result = await buildAttackContextSync(mockAttack, stats, 'camp', 'normal');

    expect(result.criticalRange).toBe('19-20');
  });

  it('returns empty string when no critical range passive exists', async () => {
    const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal');
    expect(result.criticalRange).toBe('');
  });

  it('returns empty string when passive exists but lacks criticalRange value', async () => {
    const stats = {
      ...mockStats,
      automation: { passives: [{ type: 'passive_rule', effect: 'critical_range' }] },
    };

    const result = await buildAttackContextSync(mockAttack, stats, 'camp', 'normal');
    expect(result.criticalRange).toBe('');
  });

  it('uses last matching critical_range passive when multiple exist', async () => {
    const stats = {
      ...mockStats,
      automation: {
        passives: [
          { type: 'passive_rule', effect: 'critical_range', criticalRange: '19-20' },
          { type: 'passive_rule', effect: 'critical_range', criticalRange: '20' },
        ],
      },
    };

    const result = await buildAttackContextSync(mockAttack, stats, 'camp', 'normal');

    expect(result.criticalRange).toBe('20');
  });
});

describe('contextBuilder-sync: glorious defense', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultBaseAttackContext();
    getRuntimeValue.mockReturnValue(undefined);
    defaultAuraMocks();
  });

  it('does not include gloriousDefenseBonus in context (handled retroactively by handler)', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'gloriousDefenseActive') return true;
      if (key === 'gloriousDefenseBonus') return 2;
      return undefined;
    });

    const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal');

    expect(result.gloriousDefenseBonus).toBeUndefined();
  });
});

describe('contextBuilder-sync: stroke of luck and boon of fate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultBaseAttackContext();
    getRuntimeValue.mockReturnValue(undefined);
    defaultAuraMocks();
  });

  it('sets strokeOfLuck true when passive exists and not used', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'strokeOfLuckUsed') return false;
      return undefined;
    });
    const stats = {
      ...mockStats,
      automation: { passives: [{ type: 'stroke_of_luck' }] },
    };

    const result = await buildAttackContextSync(mockAttack, stats, 'camp', 'normal');
    expect(result.strokeOfLuck).toBe(true);
  });

  it('sets strokeOfLuck false when passive exists but already used', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'strokeOfLuckUsed') return true;
      return undefined;
    });
    const stats = {
      ...mockStats,
      automation: { passives: [{ type: 'stroke_of_luck' }] },
    };

    const result = await buildAttackContextSync(mockAttack, stats, 'camp', 'normal');
    expect(result.strokeOfLuck).toBe(false);
  });

  it('sets strokeOfLuck false when passive does not exist', async () => {
    const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal');
    expect(result.strokeOfLuck).toBe(false);
  });

  it('sets boonOfFate true when passive exists and not used', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'boonOfFateUsed') return false;
      return undefined;
    });
    const stats = {
      ...mockStats,
      automation: { passives: [{ type: 'modify_d20_roll' }] },
    };

    const result = await buildAttackContextSync(mockAttack, stats, 'camp', 'normal');
    expect(result.boonOfFate).toBe(true);
  });

  it('sets boonOfFate false when passive exists but already used', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'boonOfFateUsed') return true;
      return undefined;
    });
    const stats = {
      ...mockStats,
      automation: { passives: [{ type: 'modify_d20_roll' }] },
    };

    const result = await buildAttackContextSync(mockAttack, stats, 'camp', 'normal');
    expect(result.boonOfFate).toBe(false);
  });

  it('sets boonOfFate false when passive does not exist', async () => {
    const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal');
    expect(result.boonOfFate).toBe(false);
  });
});

describe('contextBuilder-sync: graze damage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultBaseAttackContext();
    getRuntimeValue.mockReturnValue(undefined);
    defaultAuraMocks();
    collectWeaponMastery.mockReturnValue({ baseMastery: null, extraMasteries: [] });
  });

  it('includes grazeDamage when Graze mastery is in baseMastery', async () => {
    collectWeaponMastery.mockReturnValue({ baseMastery: 'Graze', extraMasteries: [] });

    const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal');

    expect(result.grazeDamage).toBe(true);
    expect(result.grazeAbilityName).toBe('Strength');
    expect(result.grazeAbilityMod).toBe(4);
  });

  it('includes grazeDamage when Graze mastery is in extraMasteries', async () => {
    collectWeaponMastery.mockReturnValue({ baseMastery: 'Cleave', extraMasteries: ['Graze'] });

    const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal');

    expect(result.grazeDamage).toBe(true);
    expect(result.grazeAbilityMod).toBe(4);
  });

  it('uses attack.abilityName when provided, defaults to Strength when omitted', async () => {
    collectWeaponMastery.mockReturnValue({ baseMastery: 'Graze', extraMasteries: [] });

    const dexAttack = { ...mockAttack, abilityName: 'Dexterity' };
    let result = await buildAttackContextSync(dexAttack, mockStats, 'camp', 'normal');
    expect(result.grazeAbilityName).toBe('Dexterity');
    expect(result.grazeAbilityMod).toBe(3);

    const undefAttack = { ...mockAttack, abilityName: undefined };
    result = await buildAttackContextSync(undefAttack, mockStats, 'camp', 'normal');
    expect(result.grazeAbilityName).toBe('Strength');
  });

  it('excludes grazeDamage when no Graze mastery', async () => {
    collectWeaponMastery.mockReturnValue({ baseMastery: 'Cleave', extraMasteries: [] });

    const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal');

    expect(result.grazeDamage).toBe(false);
    expect(result.grazeAbilityName).toBeNull();
    expect(result.grazeAbilityMod).toBe(0);
  });
});

describe('contextBuilder-sync: boon of combat prowess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultBaseAttackContext();
    getRuntimeValue.mockReturnValue(undefined);
    defaultAuraMocks();
  });

  it('sets boonOfCombatProwess true when auto_reroll passive exists and not used', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'boonOfCombatProwessUsed') return false;
      return undefined;
    });
    const stats = {
      ...mockStats,
      automation: {
        actions: [{ type: 'auto_reroll', effect: 'convert_miss_to_hit' }],
      },
    };

    const result = await buildAttackContextSync(mockAttack, stats, 'camp', 'normal');
    expect(result.boonOfCombatProwess).toBe(true);
  });

  it('sets boonOfCombatProwess true when auto_reroll exists in reactions', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'boonOfCombatProwessUsed') return false;
      return undefined;
    });
    const stats = {
      ...mockStats,
      automation: {
        reactions: [{ type: 'auto_reroll', automation: { effect: 'convert_miss_to_hit' } }],
      },
    };

    const result = await buildAttackContextSync(mockAttack, stats, 'camp', 'normal');
    expect(result.boonOfCombatProwess).toBe(true);
  });

  it('sets boonOfCombatProwess false when auto_reroll passive exists but already used', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'boonOfCombatProwessUsed') return true;
      return undefined;
    });
    const stats = {
      ...mockStats,
      automation: {
        actions: [{ type: 'auto_reroll', effect: 'convert_miss_to_hit' }],
      },
    };

    const result = await buildAttackContextSync(mockAttack, stats, 'camp', 'normal');
    expect(result.boonOfCombatProwess).toBe(false);
  });

  it('sets boonOfCombatProwess false when auto_reroll passive does not exist', async () => {
    const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal');
    expect(result.boonOfCombatProwess).toBe(false);
  });
});
