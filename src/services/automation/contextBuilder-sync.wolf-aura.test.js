// @improved-by-ai
// CLA-283: async aura utils MUST be awaited at gridless sync consumers —
// non-awaited reads of .advantage/.disadvantage off a Promise were always undefined.
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
vi.mock('../automation/handlers/buffs/protectionFromEvilAndGoodHandler.js', () => ({
  isProtectionFromEvilAndGoodActive: vi.fn(() => false),
  isCreatureWarded: vi.fn(() => false),
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

const attack = { name: 'Eldritch Blast', damage: '1d10', damageType: 'Force', hitBonus: 8, weaponType: 'ranged' };

function makeStats(name) {
  return { name, level: 14, proficiency: 5, class: { class_levels: [] }, abilities: [], automation: { passives: [] } };
}

function setup() {
  buildBaseAttackContext.mockResolvedValue({ target: { name: 'Thug 1' }, targetName: 'Thug 1', resistanceNotice: null });
  getRuntimeValue.mockReturnValue(undefined);
  getCombatContext.mockResolvedValue({ creatures: [{ name: 'HexWarlock', type: 'player' }] });
  getInnateSorceryBonus.mockReturnValue({ spellAdvantage: false, saveDcBonus: 0 });
  getWolfAdvantageAgainst.mockResolvedValue({ advantage: false });
  getDuplicityAdvantageAgainst.mockResolvedValue({ advantage: false });
  getLionDisadvantageAgainst.mockResolvedValue({ disadvantage: false });
  getCoronaSaveDisadvantage.mockResolvedValue({ disadvantage: false });
  isAvengingAngelActive.mockReturnValue(false);
  isAuraTarget.mockReturnValue(false);
}

describe('contextBuilder-sync - Wolf/Lion aura consumers awaited (CLA-283)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('awaits getWolfAdvantageAgainst and sets forcedMode advantage when a Wolf ally is live', async () => {
    setup();
    getWolfAdvantageAgainst.mockResolvedValue({ advantage: true, source: 'DraconicDragon' });

    const result = await buildAttackContextSync(attack, makeStats('HexWarlock'), 'test-campaign', 'normal');

    expect(getWolfAdvantageAgainst).toHaveBeenCalledWith({
      attackerName: 'HexWarlock',
      campaignName: 'test-campaign',
      skipRangeCheck: true,
    });
    expect(result.forcedMode).toBe('advantage');
  });

  it('leaves forcedMode undefined when no Wolf ally is live (control)', async () => {
    setup();
    getWolfAdvantageAgainst.mockResolvedValue({ advantage: false });

    const result = await buildAttackContextSync(attack, makeStats('HexWarlock'), 'test-campaign', 'normal');

    expect(result.forcedMode).toBeUndefined();
  });

  it('awaits getLionDisadvantageAgainst and sets forcedMode disadvantage when a Lion ally is live', async () => {
    setup();
    getLionDisadvantageAgainst.mockResolvedValue({ disadvantage: true, source: 'DraconicDragon' });

    const result = await buildAttackContextSync(attack, makeStats('HexWarlock'), 'test-campaign', 'normal');

    expect(getLionDisadvantageAgainst).toHaveBeenCalledWith({
      attackerName: 'HexWarlock',
      campaignName: 'test-campaign',
      skipRangeCheck: true,
    });
    expect(result.forcedMode).toBe('disadvantage');
  });
});
