// @improved-by-ai
// SP-094: attacker-type gate must resolve combatSummary monsterType (not 'npc').
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildAttackContextSync } from './contextBuilder.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

vi.mock('./common/damageRoll.js', () => ({ buildBaseAttackContext: vi.fn() }));
vi.mock('../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
}));
vi.mock('../maps/mapsService.js', () => ({ loadMapData: vi.fn() }));
vi.mock('../rules/combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(), computeMeleeProximityEffect: vi.fn(),
  getDistanceFeet: vi.fn(), isHostileNPC: vi.fn(), getNearestPlacedItem: vi.fn(), rangeToFeet: vi.fn(),
}));
vi.mock('../rules/combat/rangeCheck.js', () => ({ isWithinRange: vi.fn().mockResolvedValue(true) }));
vi.mock('../rules/combat/coverService.js', () => ({ computeCover: vi.fn() }));
vi.mock('../npcs/npcsService.js', () => ({ loadNPCs: vi.fn() }));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()), useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(), getRuntimeValue: vi.fn(), setRuntimeValue: vi.fn(),
}));
vi.mock('../combat/buffs/buffService.js', () => ({ getInnateSorceryBonus: vi.fn() }));
vi.mock('../combat/auras/wolfAuraUtils.js', () => ({ getWolfAdvantageAgainst: vi.fn() }));
vi.mock('../combat/auras/duplicityAuraUtils.js', () => ({ getDuplicityAdvantageAgainst: vi.fn() }));
vi.mock('../combat/auras/lionAuraUtils.js', () => ({ getLionDisadvantageAgainst: vi.fn() }));
vi.mock('../combat/auras/coronaAuraUtils.js', () => ({ getCoronaSaveDisadvantage: vi.fn() }));
vi.mock('./handlers/class-cleric-paladin/avengingAngelHandler.js', () => ({ isActive: vi.fn(), isAuraTarget: vi.fn(), handle: vi.fn() }));
vi.mock('./handlers/spells/sanctuaryHandler.js', () => ({ endSanctuary: vi.fn() }));

const WARDED = ['Aberration', 'Celestial', 'Elemental', 'Fey', 'Fiend', 'Undead'];
vi.mock('../automation/handlers/buffs/protectionFromEvilAndGoodHandler.js', () => ({
  isProtectionFromEvilAndGoodActive: vi.fn(() => false),
  isCreatureWarded: vi.fn((type) => WARDED.some(t => t.toLowerCase() === String(type).toLowerCase())),
}));
vi.mock('../combat/automation/automationService.js', () => ({ collectWeaponMastery: vi.fn().mockReturnValue({ baseMastery: null, extraMasteries: [] }) }));
vi.mock('../combat/brutalStrikeSelection.js', () => ({ selectBrutalStrikeRiders: vi.fn().mockReturnValue({}) }));
vi.mock('../combat/automation/automationExpressions.js', () => ({ resolveDiceExpression: vi.fn() }));
vi.mock('../combat/automation/automationPassives.js', () => ({ isResilientSphereActive: vi.fn().mockReturnValue(false) }));
vi.mock('../encounters/combatData.js', () => ({ getCurrentCombatRound: vi.fn().mockReturnValue(1) }));

const { buildBaseAttackContext } = await import('./common/damageRoll.js');
const { getCombatContext } = await import('../rules/combat/damageUtils.js');
const { getInnateSorceryBonus } = await import('../combat/buffs/buffService.js');
const { getWolfAdvantageAgainst } = await import('../combat/auras/wolfAuraUtils.js');
const { getDuplicityAdvantageAgainst } = await import('../combat/auras/duplicityAuraUtils.js');
const { getLionDisadvantageAgainst } = await import('../combat/auras/lionAuraUtils.js');
const { getCoronaSaveDisadvantage } = await import('../combat/auras/coronaAuraUtils.js');
const { isActive: isAvengingAngelActive, isAuraTarget } = await import('./handlers/class-cleric-paladin/avengingAngelHandler.js');
const pfeg = await import('../automation/handlers/buffs/protectionFromEvilAndGoodHandler.js');

const attack = { name: 'Necrotic Sword', damage: '1d8+2', damageType: 'Necrotic', hitBonus: 4, weaponType: 'melee' };

function makeStats(name) {
  return { name, level: 5, proficiency: 2, class: { class_levels: [] }, abilities: [], automation: { passives: [] } };
}

function setup(attackerCreature) {
  buildBaseAttackContext.mockResolvedValue({ target: { name: 'HexWarlock' }, targetName: 'HexWarlock', resistanceNotice: null });
  getRuntimeValue.mockReturnValue(undefined);
  getCombatContext.mockResolvedValue({ creatures: [attackerCreature] });
  getInnateSorceryBonus.mockReturnValue({ spellAdvantage: false, saveDcBonus: 0 });
  getWolfAdvantageAgainst.mockReturnValue({ advantage: false });
  getDuplicityAdvantageAgainst.mockReturnValue({ advantage: false });
  getLionDisadvantageAgainst.mockReturnValue({ disadvantage: false });
  getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: false });
  isAvengingAngelActive.mockReturnValue(false);
  isAuraTarget.mockReturnValue(false);
  pfeg.isProtectionFromEvilAndGoodActive.mockReturnValue(true);
  pfeg.isCreatureWarded.mockImplementation((type) => WARDED.some(t => t.toLowerCase() === String(type).toLowerCase()));
}

describe('contextBuilder-sync - Protection from Evil and Good attacker-type lookup (SP-094)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('resolves monsterType (not npc) so a warded Undead attacker forces Disadvantage', async () => {
    setup({ name: 'Wight 1', type: 'npc', monsterType: 'Undead' });
    const result = await buildAttackContextSync(attack, makeStats('Wight 1'), 'camp', 'normal');
    expect(pfeg.isCreatureWarded.mock.calls[0][0]).toBe('Undead');
    expect(result.forcedMode).toBe('disadvantage');
  });

  it('leaves a non-warded attacker (Giant) at normal mode', async () => {
    setup({ name: 'Ogre 1', type: 'npc', monsterType: 'Giant' });
    const result = await buildAttackContextSync(attack, makeStats('Ogre 1'), 'camp', 'normal');
    expect(pfeg.isCreatureWarded.mock.calls[0][0]).toBe('Giant');
    expect(result.forcedMode).not.toBe('disadvantage');
  });

  it('leaves a PC attacker (type pc, no monsterType) at normal mode', async () => {
    setup({ name: 'Wight 1', type: 'pc' });
    const result = await buildAttackContextSync(attack, makeStats('Wight 1'), 'camp', 'normal');
    expect(pfeg.isCreatureWarded.mock.calls[0][0]).toBe('pc');
    expect(result.forcedMode).not.toBe('disadvantage');
  });
});
