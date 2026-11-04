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
      targetName: 'Thug 1',
      campaignName: 'test-campaign',
      skipRangeCheck: true,
    });
    expect(result.forcedMode).toBe('advantage');
    // bug-adv-chip-borrows-range-reason: the sync wolf resolver must thread a
    // reason (monster-card-lane buildLionAuraReason parity) so the popup's
    // Adv chip prints the aura instead of borrowing a rangeReason.
    // bug-wolf-gridless-chip-claims-within-5ft-unmeasured: gridless lenient
    // face must NOT claim "within 5 ft" — proximity was never measured (lion
    // twin 2cd75b9de / 3db9da635 honesty precedent).
    expect(result.advantageReason).toBe('Wolf rage aura — enemy of raging DraconicDragon — proximity unmeasured (gridless) — GM-enforced');
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
      targetName: 'Thug 1',
      campaignName: 'test-campaign',
      skipRangeCheck: true,
    });
    expect(result.forcedMode).toBe('disadvantage');
    // Attribution parity (2026-11-03 QA backlog): gridless lenient face must
    // NOT claim "within 5 ft" — proximity was never measured (3db9da635 tail).
    expect(result.advantageReason).toBe('Lion rage aura — enemy of raging DraconicDragon — proximity unmeasured (gridless) — GM-enforced');
  });
});

// bug-wolf-aura-unmeasured-on-pc-roller-lane: with an ACTIVE map the sync lane
// must consult the aura utils MEASURED (skipRangeCheck:false). The unconditional
// lenient stamp pre-empted the measured aura pass in contextBuilder-map.js
// (accumulateAuraCounts is guarded by base.forcedMode === undefined), so a Wolf
// bearer anywhere on a positioned map granted advantage at 15/25 ft distances.
// The gridless faces above (getRuntimeValue → undefined, no '__map__') pin that
// skipRangeCheck:true leniency stays the no-map fallback.
describe('contextBuilder-sync - active map MEASURES the aura axes (skipRangeCheck gate)', () => {
  beforeEach(() => vi.clearAllMocks());

  // '__map__' mirrors what MapContextSync stamps when a map is activated; every
  // other runtime read stays undefined (no buffs/tes) exactly like setup().
  function activeMap(name = 'battle-arena') {
    getRuntimeValue.mockImplementation((entity, key) => (
      entity === '__map__' && key === 'activeMapName' ? name : undefined
    ));
  }

  it('far-face: active map → wolf consulted measured; a refused measurement leaves mode normal', async () => {
    setup();
    activeMap();
    getWolfAdvantageAgainst.mockResolvedValue({ advantage: false });

    const result = await buildAttackContextSync(attack, makeStats('HexWarlock'), 'test-campaign', 'normal');

    expect(getWolfAdvantageAgainst).toHaveBeenCalledWith({
      attackerName: 'HexWarlock',
      targetName: 'Thug 1',
      campaignName: 'test-campaign',
      skipRangeCheck: false,
    });
    expect(result.forcedMode).toBeUndefined();
  });

  it('near-face: active map + measured wolf advantage still stamps forcedMode advantage', async () => {
    setup();
    activeMap();
    getWolfAdvantageAgainst.mockResolvedValue({ advantage: true, source: 'DraconicDragon' });

    const result = await buildAttackContextSync(attack, makeStats('HexWarlock'), 'test-campaign', 'normal');

    expect(getWolfAdvantageAgainst).toHaveBeenCalledWith(expect.objectContaining({ skipRangeCheck: false }));
    expect(result.forcedMode).toBe('advantage');
    // Measured face keeps the honest "within 5 ft" prose byte-identical
    // (isWithinRange compared bearer↔target) — mirrors the lion twin pin below.
    expect(result.advantageReason).toBe('Wolf rage aura — enemy of raging DraconicDragon within 5 ft');
  });

  it('lion twin: active map + refused measurement no longer stamps a lenient disadvantage', async () => {
    setup();
    activeMap();
    getLionDisadvantageAgainst.mockResolvedValue({ disadvantage: false });

    const result = await buildAttackContextSync(attack, makeStats('HexWarlock'), 'test-campaign', 'normal');

    expect(getLionDisadvantageAgainst).toHaveBeenCalledWith(expect.objectContaining({ skipRangeCheck: false }));
    expect(result.forcedMode).toBeUndefined();
  });

  it('lion twin: active map + MEASURED disadvantage threads the accurate within-5-ft reason', async () => {
    setup();
    activeMap();
    getLionDisadvantageAgainst.mockResolvedValue({ disadvantage: true, source: 'ElderPaladin' });

    const result = await buildAttackContextSync(attack, makeStats('HexWarlock'), 'test-campaign', 'normal');

    expect(result.forcedMode).toBe('disadvantage');
    // Measured face keeps the honest "within 5 ft" prose (isWithinRange compared
    // bearer↔attacker coordinates) — mirrors the monster lane buildLionAuraReason.
    expect(result.advantageReason).toBe('Lion rage aura — enemy of raging ElderPaladin within 5 ft');
  });

  it('corona is NEVER consulted on the attack lane (save-only effect — bug file)', async () => {
    setup();
    activeMap();
    // Corona of Light is "Disadvantage on saving throws against Fire/Radiant
    // SPELLS" (2024 classes.json Light Domain lv17) — a SAVE-lane effect. Even
    // a util that reports disadvantage must not touch the attack roll.
    getCoronaSaveDisadvantage.mockResolvedValue({ disadvantage: true, source: 'ElderPaladin' });

    const result = await buildAttackContextSync(attack, makeStats('HexWarlock'), 'test-campaign', 'normal');

    expect(getCoronaSaveDisadvantage).not.toHaveBeenCalled();
    expect(result.forcedMode).toBeUndefined();
    expect(result.advantageReason).toBeUndefined();
  });

  it('all three sync aura resolvers (wolf/duplicity/lion) drop skipRangeCheck when a map is active', async () => {
    setup();
    activeMap();

    await buildAttackContextSync(attack, makeStats('HexWarlock'), 'test-campaign', 'normal');

    for (const util of [getWolfAdvantageAgainst, getDuplicityAdvantageAgainst, getLionDisadvantageAgainst]) {
      expect(util).toHaveBeenCalledWith(expect.objectContaining({ skipRangeCheck: false }));
      expect(util).not.toHaveBeenCalledWith(expect.objectContaining({ skipRangeCheck: true }));
    }
    // Corona no longer rides this lane at all (gridless OR measured).
    expect(getCoronaSaveDisadvantage).not.toHaveBeenCalled();
  });
});
