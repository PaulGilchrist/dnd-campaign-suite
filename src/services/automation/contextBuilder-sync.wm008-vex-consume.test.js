// WM-008: the Vex next_attack_advantage te (with vexTarget) is consumed by the NEXT
// attack ROLL only. Damage-phase ctx rebuilds (proceedWithDamage / buildContext /
// cunningStrike) pass { consumeAttackTe:false } so they never erase the te that the
// same attack's tacticalMaster step has just stamped — that self-erase was why
// advantage was never produced.
// @improved-by-ai
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
vi.mock('../maps/mapsService.js', () => ({ loadMapData: vi.fn() }));
vi.mock('../rules/combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(),
  computeMeleeProximityEffect: vi.fn(),
  getDistanceFeet: vi.fn(),
  isHostileNPC: vi.fn(),
  getNearestPlacedItem: vi.fn(),
  rangeToFeet: vi.fn(),
}));
vi.mock('../rules/combat/rangeCheck.js', () => ({ isWithinRange: vi.fn().mockResolvedValue(true) }));
vi.mock('../rules/combat/coverService.js', () => ({ computeCover: vi.fn() }));
vi.mock('../npcs/npcsService.js', () => ({ loadNPCs: vi.fn() }));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));
vi.mock('../combat/buffs/buffService.js', () => ({ getInnateSorceryBonus: vi.fn() }));
vi.mock('../combat/auras/wolfAuraUtils.js', () => ({ getWolfAdvantageAgainst: vi.fn() }));
vi.mock('../combat/auras/duplicityAuraUtils.js', () => ({ getDuplicityAdvantageAgainst: vi.fn() }));
vi.mock('../combat/auras/lionAuraUtils.js', () => ({ getLionDisadvantageAgainst: vi.fn() }));
vi.mock('../combat/auras/coronaAuraUtils.js', () => ({ getCoronaSaveDisadvantage: vi.fn() }));
vi.mock('./handlers/class-cleric-paladin/avengingAngelHandler.js', () => ({ isActive: vi.fn(), isAuraTarget: vi.fn(), handle: vi.fn() }));
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
vi.mock('../combat/automation/automationExpressions.js', () => ({ resolveDiceExpression: vi.fn() }));
vi.mock('../combat/automation/automationPassives.js', () => ({ isResilientSphereActive: vi.fn().mockReturnValue(false) }));
vi.mock('../encounters/combatData.js', () => ({ getCurrentCombatRound: vi.fn().mockReturnValue(1) }));

const { buildBaseAttackContext } = await import('./common/damageRoll.js');
const { getWolfAdvantageAgainst } = await import('../combat/auras/wolfAuraUtils.js');
const { getDuplicityAdvantageAgainst } = await import('../combat/auras/duplicityAuraUtils.js');
const { getLionDisadvantageAgainst } = await import('../combat/auras/lionAuraUtils.js');
const { getCoronaSaveDisadvantage } = await import('../combat/auras/coronaAuraUtils.js');
const { getInnateSorceryBonus } = await import('../combat/buffs/buffService.js');

const mockStats = {
  name: 'Fighter1', level: 5, proficiency: 2,
  abilities: [{ name: 'Dexterity', bonus: 3 }],
  automation: { passives: [] },
};
const mockAttack = { name: 'Shortsword', damage: '1d6+3', damageType: 'Piercing', hitBonus: 6, weaponType: 'melee' };

const vexTe = { effect: 'next_attack_advantage', target: 'Fighter1', vexTarget: 'Thug 1', source: 'Vex' };

function teWrite() {
  return setRuntimeValue.mock.calls.find(c => c[0] === 'campaign' && c[1] === 'targetEffects');
}

describe('WM-008 contextBuilder-sync: vex te consumption', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildBaseAttackContext.mockResolvedValue({ target: { name: 'Thug 1' }, targetName: 'Thug 1', resistanceNotice: null });
    getWolfAdvantageAgainst.mockReturnValue({ advantage: false });
    getDuplicityAdvantageAgainst.mockReturnValue({ advantage: false });
    getLionDisadvantageAgainst.mockReturnValue({ disadvantage: false });
    getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: false });
    getInnateSorceryBonus.mockReturnValue({ spellAdvantage: false, saveDcBonus: 0 });
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'campaign' && key === 'targetEffects') return [vexTe];
      if (key === 'activeBuffs') return [];
      return undefined;
    });
  });

  it('attack-roll ctx consumes the vex te and grants advantage', async () => {
    const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});
    expect(result.forcedMode).toBe('advantage');
    expect(teWrite()).toBeDefined();
    expect(teWrite()[2]).toEqual([]);
  });

  it('damage-phase ctx rebuild (consumeAttackTe:false) does NOT consume the freshly-stamped te', async () => {
    const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {}, { consumeAttackTe: false });
    expect(result.forcedMode).toBeUndefined();
    expect(teWrite()).toBeUndefined();
  });

  it('attack-roll consumption releases the campaign _Vex_appliedTarget latch', async () => {
    await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});
    expect(setRuntimeValue).toHaveBeenCalledWith('campaign', '_Vex_appliedTarget', null, 'camp');
  });

  it('damage-phase rebuild does NOT release the latch', async () => {
    await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {}, { consumeAttackTe: false });
    expect(setRuntimeValue).not.toHaveBeenCalledWith('campaign', '_Vex_appliedTarget', null, 'camp');
  });
});
