import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildAttackContextSync } from './contextBuilder-sync.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { isWithinRange } from '../rules/combat/rangeCheck.js';
import { getCombatContext } from '../rules/combat/damageUtils.js';
import { getCurrentCombatRound } from '../encounters/combatData.js';

vi.mock('./common/damageRoll.js', () => ({
  buildBaseAttackContext: vi.fn(),
}));

vi.mock('../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn().mockResolvedValue(false),
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

vi.mock('./handlers/spells/sanctuaryHandler.js', () => ({
  endSanctuary: vi.fn(),
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

const rogueStats = {
  name: 'AasimarTest',
  level: 17,
  proficiency: 6,
  class: {
    name: 'Rogue',
    class_levels: [{ level: 17, sneak_attack_num_d6: 9 }],
  },
  abilities: [{ name: 'Dexterity', bonus: 5 }],
  automation: { passives: [] },
};

const finesseAttack = {
  name: 'Shortsword',
  damage: '1d6+2',
  damageType: 'Piercing',
  hitBonus: 8,
  hitBonusFormula: 'To Hit = 5 + 3',
  weaponType: 'melee',
  properties: ['Finesse', 'Light'],
};

function combatSummary(allyConds) {
  return {
    round: 1,
    creatures: [
      { name: 'AasimarTest', type: 'player' },
      { name: 'Thug 1', type: 'npc', attitude: 'hostile' },
      { name: 'ElderPaladin', type: 'player', ...(allyConds ? { conditions: allyConds } : {}) },
    ],
  };
}

function setupRuntime({ latch = null, activeConditions = [] } = {}) {
  getRuntimeValue.mockImplementation((name, key) => {
    if (name === 'campaign' && key === 'targetEffects') return [];
    if (name === 'AasimarTest' && key === '_SneakAttack_usedRound') return latch;
    if (name === 'ElderPaladin' && key === 'activeConditions') return activeConditions;
    return undefined;
  });
}

describe('CLA-317: sneak attack ally-5ft gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildBaseAttackContext.mockResolvedValue({
      target: { name: 'Thug 1' },
      targetName: 'Thug 1',
      resistanceNotice: null,
    });
    getInnateSorceryBonus.mockReturnValue({ spellAdvantage: false, saveDcBonus: 0 });
    getWolfAdvantageAgainst.mockReturnValue({ advantage: false });
    getDuplicityAdvantageAgainst.mockReturnValue({ advantage: false });
    getLionDisadvantageAgainst.mockReturnValue({ disadvantage: false });
    getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: false });
    getCurrentCombatRound.mockReturnValue(1);
    getCombatContext.mockResolvedValue(combatSummary());
    isWithinRange.mockResolvedValue(false);
    setupRuntime();
  });

  it('refuses sneak when no trigger: no advantage and no ally within 5 ft', async () => {
    const result = await buildAttackContextSync(finesseAttack, rogueStats, 'camp', 'normal');
    expect(result.sneakAttackDice).toBe(0);
    expect(isWithinRange).toHaveBeenCalledWith('Thug 1', 'ElderPaladin', 5);
  });

  it('grants sneak when a healthy ally is within 5 ft of the target', async () => {
    isWithinRange.mockResolvedValue(true);
    const result = await buildAttackContextSync(finesseAttack, rogueStats, 'camp', 'normal');
    expect(result.sneakAttackDice).toBe(9);
  });

  it('refuses sneak when the only ally in range has the Incapacitated condition (runtime)', async () => {
    isWithinRange.mockResolvedValue(true);
    setupRuntime({ activeConditions: ['incapacitated'] });
    const result = await buildAttackContextSync(finesseAttack, rogueStats, 'camp', 'normal');
    expect(result.sneakAttackDice).toBe(0);
  });

  it('refuses sneak when the only ally in range is Stunned (grants Incapacitated)', async () => {
    isWithinRange.mockResolvedValue(true);
    setupRuntime({ activeConditions: ['stunned'] });
    const result = await buildAttackContextSync(finesseAttack, rogueStats, 'camp', 'normal');
    expect(result.sneakAttackDice).toBe(0);
  });

  it('refuses sneak when ally conditions on combatSummary include Incapacitated', async () => {
    isWithinRange.mockResolvedValue(true);
    getCombatContext.mockResolvedValue(combatSummary([{ key: 'Incapacitated' }]));
    const result = await buildAttackContextSync(finesseAttack, rogueStats, 'camp', 'normal');
    expect(result.sneakAttackDice).toBe(0);
  });

  it('grants sneak via advantage without consulting the ally range loop', async () => {
    const result = await buildAttackContextSync(finesseAttack, rogueStats, 'camp', 'advantage');
    expect(result.sneakAttackDice).toBe(9);
    expect(isWithinRange).not.toHaveBeenCalled();
  });

  it('refuses sneak with disadvantage even with adjacent ally and advantage trigger available', async () => {
    isWithinRange.mockResolvedValue(true);
    const result = await buildAttackContextSync(finesseAttack, rogueStats, 'camp', 'disadvantage');
    expect(result.sneakAttackDice).toBe(0);
    expect(isWithinRange).not.toHaveBeenCalled();
  });

  it('round latch blocks sneak on a second attack in the same round', async () => {
    isWithinRange.mockResolvedValue(true);
    setupRuntime({ latch: 1 });
    const result = await buildAttackContextSync(finesseAttack, rogueStats, 'camp', 'normal');
    expect(result.sneakAttackDice).toBe(0);
    expect(isWithinRange).not.toHaveBeenCalled();
  });

  it('re-arms sneak on a new round', async () => {
    isWithinRange.mockResolvedValue(true);
    setupRuntime({ latch: 1 });
    getCurrentCombatRound.mockReturnValue(2);
    const result = await buildAttackContextSync(finesseAttack, rogueStats, 'camp', 'normal');
    expect(result.sneakAttackDice).toBe(9);
  });

  it('refuses sneak for non-finesse melee weapon', async () => {
    isWithinRange.mockResolvedValue(true);
    const result = await buildAttackContextSync(
      { ...finesseAttack, name: 'Mace', properties: [], damageType: 'Bludgeoning' },
      rogueStats, 'camp', 'normal'
    );
    expect(result.sneakAttackDice).toBe(0);
  });
});
