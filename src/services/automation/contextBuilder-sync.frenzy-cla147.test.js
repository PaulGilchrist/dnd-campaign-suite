// @improved-by-ai
// CLA-147: contextBuilder-sync must contribute NO frenzy dice to autoDamageFormula.
// Pre-fix it baked 'rage_damage_d6' (' plus 4d6') into the display formula, which
// diceRoller rolled as part of the base damage — while the attack pipeline's
// applyFrenzyBonuses rolled a SECOND 4d6 on the same hit (double-apply).
// The pipeline (attackRollBonuses) is the single roll owner.
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

vi.mock('../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn().mockResolvedValue(true),
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
  handle: vi.fn(),
}));

vi.mock('../automation/handlers/buffs/protectionFromEvilAndGoodHandler.js', () => ({
  isProtectionFromEvilAndGoodActive: vi.fn().mockReturnValue(false),
  isCreatureWarded: vi.fn().mockReturnValue(false),
  handle: vi.fn(),
}));

vi.mock('../combat/automation/automationService.js', () => ({
  collectWeaponMastery: vi.fn().mockReturnValue({ baseMastery: null, extraMasteries: [] }),
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

const FRENZY_ACTION = {
  type: 'damage_bonus',
  trigger: 'reckless_attack_hit_while_raging',
  damageExpression: 'rage_damage_d6',
  damageType: 'same_as_weapon',
  oncePerTurn: true,
};

// lv20 Barbarian (Path of the Berserker shape), STR +5
const frenzyStats = {
  name: 'DraconicDragon',
  level: 20,
  proficiency: 6,
  class: { class_levels: Array.from({ length: 20 }, (_, i) => ({ rage_damage: i === 19 ? 4 : 2 })) },
  abilities: [
    { name: 'Strength', bonus: 5 },
    { name: 'Dexterity', bonus: 2 },
  ],
  automation: { actions: [FRENZY_ACTION], passives: [] },
};

const longsword = {
  name: 'Longsword',
  damage: '1d8+5',
  damageType: 'Slashing',
  hitBonus: 11,
  weaponType: 'melee',
  saveDc: 0,
};

function ragingRecklessBuffs() {
  return [
    { damageBonusExpression: 'rage_damage' },
    { effect: 'advantage_attacks_advantage_against' },
  ];
}

describe('CLA-147 contextBuilder-sync: no frenzy bake into autoDamageFormula', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildBaseAttackContext.mockResolvedValue({
      target: { name: 'Bandit 1' },
      targetName: 'Bandit 1',
      resistanceNotice: null,
    });
    getRuntimeValue.mockReturnValue(undefined);
    getInnateSorceryBonus.mockReturnValue({ spellAdvantage: false, saveDcBonus: 0 });
    getWolfAdvantageAgainst.mockReturnValue({ advantage: false });
    getDuplicityAdvantageAgainst.mockReturnValue({ advantage: false });
    getLionDisadvantageAgainst.mockReturnValue({ disadvantage: false });
    getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: false });
    isAvengingAngelActive.mockReturnValue(false);
    isAuraTarget.mockReturnValue(false);
  });

  it('raging + reckless + STR + latch unset → formula has weapon + rage flat only, NO frenzy dice', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeBuffs') return ragingRecklessBuffs();
      return undefined;
    });

    const result = await buildAttackContextSync(longsword, frenzyStats, 'test-campaign', 'normal');

    expect(result.autoDamageFormula).toBe('1d8+5 plus 4');
    expect(result.autoDamageFormula).not.toMatch(/d6/);
  });

  it('still no frenzy dice with only rage active (no reckless)', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeBuffs') return [{ damageBonusExpression: 'rage_damage' }];
      return undefined;
    });

    const result = await buildAttackContextSync(longsword, frenzyStats, 'test-campaign', 'normal');

    expect(result.autoDamageFormula).toBe('1d8+5 plus 4');
    expect(result.autoDamageFormula).not.toMatch(/d6/);
  });
});
