// Regression tests for CLA-189 — Improved Duplicity: granted ally Advantage must reach PC attack rolls.
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
  name: 'War_Cleric',
  level: 17,
  proficiency: 5,
  class: {},
  abilities: [],
  automation: { passives: [] },
};

const mockAttack = {
  name: 'Guiding Bolt',
  damage: '4d8',
  damageType: 'Radiant',
  hitBonus: 10,
  hitBonusFormula: 'To Hit = 5 + 5',
  weaponType: 'ranged',
};

beforeEach(() => {
  vi.clearAllMocks();
  buildBaseAttackContext.mockResolvedValue({
    target: { name: 'Wight 1' },
    targetName: 'Wight 1',
    resistanceNotice: null,
  });
  getRuntimeValue.mockReturnValue(undefined);
  getWolfAdvantageAgainst.mockReturnValue({ advantage: false });
  getLionDisadvantageAgainst.mockReturnValue({ disadvantage: false });
  getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: false });
  getInnateSorceryBonus.mockReturnValue({ spellAdvantage: false, saveDcBonus: 0 });
  isAvengingAngelActive.mockReturnValue(false);
  isAuraTarget.mockReturnValue(false);
});

describe('contextBuilder-sync: CLA-189 Improved Duplicity granted ally advantage', () => {
  it('awaits getDuplicityAdvantageAgainst and forces advantage for a granted ally', async () => {
    // mockResolvedValue returns a real Promise: a missing await (the CLA-189 bug) makes this fail.
    getDuplicityAdvantageAgainst.mockResolvedValue({ advantage: true, source: 'Divine_Cleric' });

    const result = await buildAttackContextSync(mockAttack, mockStats, 'test-campaign', 'normal');

    expect(getDuplicityAdvantageAgainst).toHaveBeenCalledWith({
      attackerName: 'War_Cleric',
      campaignName: 'test-campaign',
      skipRangeCheck: true,
    });
    expect(result.forcedMode).toBe('advantage');
    expect(result.advantageReason).toBe('Improved Duplicity');
  });

  it('does not force advantage when no duplicity grant applies', async () => {
    getDuplicityAdvantageAgainst.mockResolvedValue({ advantage: false });

    const result = await buildAttackContextSync(mockAttack, mockStats, 'test-campaign', 'normal');

    expect(result.forcedMode).toBeUndefined();
  });

  it('does not override an already-forced disadvantage from conditions', async () => {
    getDuplicityAdvantageAgainst.mockResolvedValue({ advantage: true, source: 'Divine_Cleric' });

    const result = await buildAttackContextSync(mockAttack, mockStats, 'test-campaign', 'disadvantage');

    expect(result.forcedMode).toBe('disadvantage');
  });
});
