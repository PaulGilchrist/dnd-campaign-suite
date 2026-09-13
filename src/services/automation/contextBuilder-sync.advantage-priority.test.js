// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
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

const { buildBaseAttackContext } = await import('./common/damageRoll.js');
const { getInnateSorceryBonus } = await import('../combat/buffs/buffService.js');
const { getWolfAdvantageAgainst } = await import('../combat/auras/wolfAuraUtils.js');
const { getDuplicityAdvantageAgainst } = await import('../combat/auras/duplicityAuraUtils.js');
const { getLionDisadvantageAgainst } = await import('../combat/auras/lionAuraUtils.js');
const { getCoronaSaveDisadvantage } = await import('../combat/auras/coronaAuraUtils.js');

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

describe('contextBuilder-sync: saveDc and saveType', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultBaseAttackContext();
    getRuntimeValue.mockReturnValue(undefined);
    getInnateSorceryBonus.mockReturnValue({ spellAdvantage: false, saveDcBonus: 0 });
    getWolfAdvantageAgainst.mockReturnValue({ advantage: false });
    getDuplicityAdvantageAgainst.mockReturnValue({ advantage: false });
    getLionDisadvantageAgainst.mockReturnValue({ disadvantage: false });
    getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: false });
  });

  it('includes saveType and dcSuccess from attack when present', async () => {
    const attack = { ...mockAttack, saveDc: 13, saveType: 'DEX', saveSuccess: 0.5 };
    const result = await buildAttackContextSync(attack, mockStats, 'camp', 'normal');

    expect(result.saveType).toBe('DEX');
    expect(result.dcSuccess).toBe(0.5);
  });

  it('includes saveType and dcSuccess as undefined when not on attack', async () => {
    const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal');

    expect(result.saveType).toBeUndefined();
    expect(result.dcSuccess).toBeUndefined();
  });
});

describe('contextBuilder-sync: forcedMode priority chain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultBaseAttackContext();
    getRuntimeValue.mockReturnValue(undefined);
    getInnateSorceryBonus.mockReturnValue({ spellAdvantage: false, saveDcBonus: 0 });
    getWolfAdvantageAgainst.mockReturnValue({ advantage: false });
    getDuplicityAdvantageAgainst.mockReturnValue({ advantage: false });
    getLionDisadvantageAgainst.mockReturnValue({ disadvantage: false });
    getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: false });
  });

  it('conditionAttackMode takes highest priority over all advantage sources', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeBuffs') return [{ effect: 'advantage_attacks_advantage_against' }];
      return undefined;
    });
    getInnateSorceryBonus.mockReturnValue({ spellAdvantage: true, saveDcBonus: 0 });
    getWolfAdvantageAgainst.mockReturnValue({ advantage: true });

    const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'disadvantage');

    expect(result.forcedMode).toBe('disadvantage');
  });

  it('all advantage sources are checked before any disadvantage sources', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeBuffs') return [{ effect: 'advantage_attacks_advantage_against' }];
      if (name === 'campaign' && key === 'targetEffects') return [{ effect: 'protection', target: 'Orc', source: 'Paladin' }];
      return undefined;
    });
    getLionDisadvantageAgainst.mockReturnValue({ disadvantage: true });
    getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: true });

    const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal');

    expect(result.forcedMode).toBe('advantage');
  });
});

describe('contextBuilder-sync: precise hunter (2024 Ranger level 17)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultBaseAttackContext();
    getRuntimeValue.mockReturnValue(undefined);
    getInnateSorceryBonus.mockReturnValue({ spellAdvantage: false, saveDcBonus: 0 });
    getWolfAdvantageAgainst.mockReturnValue({ advantage: false });
    getDuplicityAdvantageAgainst.mockReturnValue({ advantage: false });
    getLionDisadvantageAgainst.mockReturnValue({ disadvantage: false });
    getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: false });
  });

  it('sets advantage when attacker has precise_hunter passive and target has Hunter\'s Mark concentration', async () => {
    const { getCombatContext } = await import('../rules/combat/damageUtils.js');

    const rangerStats = {
      ...mockStats,
      name: 'TestRanger',
      automation: {
        passives: [
          { type: 'passive_rule', effect: 'precise_hunter', name: 'Precise Hunter' },
        ],
      },
    };

    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeBuffs') return [];
      return undefined;
    });

    getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'TestRanger', concentration: { spell: "Hunter's Mark", target: 'Orc' } },
        { name: 'Orc' },
      ],
    });

    const result = await buildAttackContextSync(mockAttack, rangerStats, 'camp', 'normal');

    expect(result.forcedMode).toBe('advantage');
    expect(result.advantageReason).toBe('Precise Hunter (Hunter\'s Mark)');
  });

  it('does not set advantage when attacker has precise_hunter but target lacks Hunter\'s Mark', async () => {
    const { getCombatContext } = await import('../rules/combat/damageUtils.js');

    const rangerStats = {
      ...mockStats,
      name: 'TestRanger',
      automation: {
        passives: [
          { type: 'passive_rule', effect: 'precise_hunter', name: 'Precise Hunter' },
        ],
      },
    };

    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeBuffs') return [];
      return undefined;
    });

    getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'TestRanger' },
        { name: 'Orc' },
      ],
    });

    const result = await buildAttackContextSync(mockAttack, rangerStats, 'camp', 'normal');

    expect(result.forcedMode).toBeUndefined();
    expect(result.advantageReason).toBeUndefined();
  });

  it('does not set advantage when target has Hunter\'s Mark but attacker lacks precise_hunter', async () => {
    const { getCombatContext } = await import('../rules/combat/damageUtils.js');

    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeBuffs') return [];
      return undefined;
    });

    getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'TestCharacter' },
        { name: 'Orc', concentration: { spell: "Hunter's Mark" } },
      ],
    });

    const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal');

    expect(result.forcedMode).toBeUndefined();
    expect(result.advantageReason).toBeUndefined();
  });

  it('precise_hunter does not override higher-priority advantage sources', async () => {
    const rangerStats = {
      ...mockStats,
      name: 'TestRanger',
      automation: {
        passives: [
          { type: 'passive_rule', effect: 'precise_hunter', name: 'Precise Hunter' },
        ],
      },
    };

    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeBuffs') return [{ effect: 'vow_of_enmity' }];
      if (key === 'vowOfEnmityTarget') return 'Orc';
      return undefined;
    });

    const result = await buildAttackContextSync(mockAttack, rangerStats, 'camp', 'normal');

    expect(result.forcedMode).toBe('advantage');
  });
});
