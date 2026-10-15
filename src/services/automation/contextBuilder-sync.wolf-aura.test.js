// @maintained-by-ai
// CLA-283 lane: async aura utils MUST be awaited at gridless sync consumers —
// non-awaited reads of .advantage/.disadvantage off a Promise were always
// undefined, so Wolf/Lion aura mode never reached forcedMode. Canonical home
// for the resolveWolfAura/resolveLionAura sync lane. forcedMode passthrough/
// preservation lives in contextBuilder-sync.test.js, the WM-008 roll-only vex
// consume contract in contextBuilder-sync.wm008-vex-consume.test.js, duplicity
// in contextBuilder-sync.improved-duplicity.test.js, chain-wide WHO-WINS
// priority in contextBuilder-sync.advantage-priority.test.js.
// Resolver order: resolveWolfAura sits above the WM-008 one-shot consume rows in
// resolveAttackModeResolvers, so a live Wolf aura short-circuits the loop first
// and must leave the freshly-stamped vex te untouched (roll-only consumption).
// Deterministic: all externals mocked → stable contract, flag kept.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildAttackContextSync } from './contextBuilder.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

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

const attack = { name: 'Eldritch Blast', damage: '1d10', damageType: 'Force', hitBonus: 8, weaponType: 'ranged' };
// WM-008 one-shot te that the attack-roll ctx would consume if the resolver
// loop ever reached the consume rows (they sit below the Wolf/Lion rows).
const vexTe = { effect: 'next_attack_advantage', target: 'HexWarlock', vexTarget: 'Thug 1', source: 'Vex' };

function teWrite() {
  return setRuntimeValue.mock.calls.find(c => c[0] === 'campaign' && c[1] === 'targetEffects');
}

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

  it('leaves one-shot vex te untouched when Wolf aura wins above the WM-008 consume rows', async () => {
    setup();
    getWolfAdvantageAgainst.mockResolvedValue({ advantage: true, source: 'DraconicDragon' });
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'campaign' && key === 'targetEffects') return [vexTe];
      return undefined;
    });

    const result = await buildAttackContextSync(attack, makeStats('HexWarlock'), 'test-campaign', 'normal');

    expect(result.forcedMode).toBe('advantage');
    // Short-circuited at resolveWolfAura — consume rows never ran (roll-only semantics).
    expect(teWrite()).toBeUndefined();
    expect(setRuntimeValue).not.toHaveBeenCalledWith('campaign', '_Vex_appliedTarget', null, 'test-campaign');
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
