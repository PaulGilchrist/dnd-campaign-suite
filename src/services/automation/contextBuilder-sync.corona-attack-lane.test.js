// @maintained-by-ai
// bug-corona-save-disadv-applied-to-attack-roll: Corona of Light (Light Domain
// Cleric lv17, effect `sunlight_aura`) grants "Disadvantage on SAVING THROWS
// against spells that deal Fire or Radiant damage" (public/data/2024/classes.json).
// The attack-lane resolvers (resolveAttackModeResolvers #10 + the
// accumulateAuraCounts corona block on the map lane) applied it as Disadvantage
// on the ATTACK ROLL of whoever attacks a designated enemy — wrong axis, wrong
// attacker, non-spell triggers included. The fix drops both attack-lane
// entries; the save-lane consumers (handleNpcSaveDamage / handlePlayerSaveDamage
// / aoeService / DivineSparkModal) keep it. This file locks the removed
// behavior: even a util that REPORTS disadvantage must never be consulted (and
// therefore never taxed) by a PC attack-roll build, gridless or measured.
// Harness mirrors contextBuilder-sync.wolf-aura.test.js (same mock census).
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
vi.mock('./handlers/spells/sanctuaryHandler.js', () => ({ endSanctuary: vi.fn(), handle: vi.fn() }));
vi.mock('../automation/handlers/buffs/protectionFromEvilAndGoodHandler.js', () => ({
  isProtectionFromEvilAndGoodActive: vi.fn(() => false),
  isCreatureWarded: vi.fn(() => false),
  handle: vi.fn(),
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

// Live repro weapon: EvasiveFighter's Shortbow — a NON-spell weapon attack whose
// own damageType ('Piercing') was matched against the buff's enemiesDisadvantageSaves.
const shortbow = { name: 'Shortbow', damage: '1d6+1', damageType: 'Piercing', hitBonus: 7, weaponType: 'ranged', range: '80 ft.' };
const fireBolt = { name: 'Fire Bolt', damage: '4d10', damageType: 'Fire', hitBonus: 9, weaponType: 'ranged', range: '120 ft.' };

function makeStats(name) {
  return { name, level: 17, proficiency: 6, class: { class_levels: [] }, abilities: [], automation: { passives: [] } };
}

function setup() {
  buildBaseAttackContext.mockResolvedValue({ target: { name: 'Winged Kobold' }, targetName: 'Winged Kobold', resistanceNotice: null });
  getRuntimeValue.mockReturnValue(undefined);
  getCombatContext.mockResolvedValue({ creatures: [{ name: 'EvasiveFighter', type: 'player' }] });
  getInnateSorceryBonus.mockReturnValue({ spellAdvantage: false, saveDcBonus: 0 });
  getWolfAdvantageAgainst.mockResolvedValue({ advantage: false });
  getDuplicityAdvantageAgainst.mockResolvedValue({ advantage: false });
  getLionDisadvantageAgainst.mockResolvedValue({ disadvantage: false });
  // The save-lane util would grant disadvantage (a corona-listed target is armed).
  getCoronaSaveDisadvantage.mockResolvedValue({ disadvantage: true, source: 'ElderPaladin' });
  isAvengingAngelActive.mockReturnValue(false);
  isAuraTarget.mockReturnValue(false);
}

describe('contextBuilder-sync: Corona of Light NEVER taxes the attack roll', () => {
  beforeEach(() => vi.clearAllMocks());

  it('gridless face: matching weapon damageType (Piercing) does not consult the corona util', async () => {
    setup();

    const result = await buildAttackContextSync(shortbow, makeStats('EvasiveFighter'), 'test-campaign', 'normal');

    expect(getCoronaSaveDisadvantage).not.toHaveBeenCalled();
    expect(result.forcedMode).toBeUndefined();
    expect(result.advantageReason).toBeUndefined();
  });

  it('gridless face: a bearer-ally SPELL attack (Fire) also rolls normally', async () => {
    setup();

    const result = await buildAttackContextSync(fireBolt, makeStats('EvasiveFighter'), 'test-campaign', 'normal');

    // RAW: the disadvantage is on the enemy's save against the BEARER'S spells —
    // an ally's fire spell attack must not self-penalize on the attack roll.
    expect(getCoronaSaveDisadvantage).not.toHaveBeenCalled();
    expect(result.forcedMode).toBeUndefined();
  });

  it('active-map face: lenient stamp must not leak through the sync lane', async () => {
    setup();
    getRuntimeValue.mockImplementation((entity, key) => (
      entity === '__map__' && key === 'activeMapName' ? 'battle-arena' : undefined
    ));

    const result = await buildAttackContextSync(shortbow, makeStats('EvasiveFighter'), 'test-campaign', 'normal');

    expect(getCoronaSaveDisadvantage).not.toHaveBeenCalled();
    expect(result.forcedMode).toBeUndefined();
    expect(result.advantageReason).toBeUndefined();
  });

  it('no target armed: still never consults corona (regression guard, no throw)', async () => {
    setup();
    buildBaseAttackContext.mockResolvedValue({ target: null, targetName: null, resistanceNotice: null });

    const result = await buildAttackContextSync(shortbow, makeStats('EvasiveFighter'), 'test-campaign', 'normal');

    expect(getCoronaSaveDisadvantage).not.toHaveBeenCalled();
    expect(result.forcedMode).toBeUndefined();
  });
});
