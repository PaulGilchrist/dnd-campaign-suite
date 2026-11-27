// @maintained-by-ai 2026-11-26
// CLA-283 lane: async aura utils MUST be awaited at gridless sync consumers —
// non-awaited reads of .advantage/.disadvantage off a Promise were always
// undefined, so Wolf/Lion aura mode never reached forcedMode. Canonical home
// for the resolveWolfAura/resolveLionAura sync lane: one it.each table pins
// both auras × both faces (gridless lenient skipRangeCheck:true with the
// honest "proximity unmeasured (gridless) — GM-enforced" reason, and active-
// map measured skipRangeCheck:false with the "within 5 ft" reason — plus the
// bug-wolf-aura-unmeasured-on-pc-roller-lane gate census proving ALL three
// sync aura resolvers (wolf/duplicity/lion) drop leniency when '__map__' is
// active and refusals leave mode normal. Corona attack-lane absence is owned
// by contextBuilder-sync.corona-attack-lane.test.js (stronger, 4 faces).
// forcedMode passthrough/preservation lives in contextBuilder-sync.test.js,
// the WM-008 roll-only vex consume contract in
// contextBuilder-sync.wm008-vex-consume.test.js, duplicity in
// contextBuilder-sync.improved-duplicity.test.js, chain-wide WHO-WINS priority
// in contextBuilder-sync.advantage-priority.test.js.
// Resolver order: resolveWolfAura sits above the WM-008 one-shot consume rows in
// resolveAttackModeResolvers, so a live Wolf aura short-circuits the loop first
// and must leave the freshly-stamped vex te untouched (roll-only consumption).
// Honesty precedent (bug-adv-chip-borrows-range-reason / bug-wolf-gridless-
// chip-claims-within-5ft-unmeasured / lion twin 2cd75b9de / 3db9da635): the
// gridless face must NOT claim "within 5 ft" — proximity was never measured.
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
  isAvengingAngelActive.mockReturnValue(false);
  isAuraTarget.mockReturnValue(false);
}

// '__map__' mirrors what MapContextSync stamps when a map is activated; every
// other runtime read stays undefined (no buffs/tes) exactly like setup().
function activeMap(name = 'battle-arena') {
  getRuntimeValue.mockImplementation((entity, key) => (
    entity === '__map__' && key === 'activeMapName' ? name : undefined
  ));
}

// Each arm() MUST use mockResolvedValue: the utils are async (CLA-283 — a
// non-awaited read of .advantage off a Promise is always undefined).
const auraFaces = [
  {
    face: 'wolf aura, gridless lenient face',
    hasMap: false,
    util: getWolfAdvantageAgainst,
    arm: () => getWolfAdvantageAgainst.mockResolvedValue({ advantage: true, source: 'DraconicDragon' }),
    expectedArgs: { attackerName: 'HexWarlock', targetName: 'Thug 1', campaignName: 'test-campaign', skipRangeCheck: true },
    expectedMode: 'advantage',
    expectedReason: 'Wolf rage aura — enemy of raging DraconicDragon — proximity unmeasured (gridless) — GM-enforced',
  },
  {
    face: 'lion aura, gridless lenient face',
    hasMap: false,
    util: getLionDisadvantageAgainst,
    arm: () => getLionDisadvantageAgainst.mockResolvedValue({ disadvantage: true, source: 'DraconicDragon' }),
    expectedArgs: { attackerName: 'HexWarlock', targetName: 'Thug 1', campaignName: 'test-campaign', skipRangeCheck: true },
    expectedMode: 'disadvantage',
    expectedReason: 'Lion rage aura — enemy of raging DraconicDragon — proximity unmeasured (gridless) — GM-enforced',
  },
  {
    face: 'wolf aura, active-map measured face',
    hasMap: true,
    util: getWolfAdvantageAgainst,
    arm: () => getWolfAdvantageAgainst.mockResolvedValue({ advantage: true, source: 'DraconicDragon' }),
    expectedArgs: { attackerName: 'HexWarlock', targetName: 'Thug 1', campaignName: 'test-campaign', skipRangeCheck: false },
    expectedMode: 'advantage',
    expectedReason: 'Wolf rage aura — enemy of raging DraconicDragon within 5 ft',
  },
  {
    face: 'lion aura, active-map measured face',
    hasMap: true,
    util: getLionDisadvantageAgainst,
    arm: () => getLionDisadvantageAgainst.mockResolvedValue({ disadvantage: true, source: 'ElderPaladin' }),
    expectedArgs: { attackerName: 'HexWarlock', targetName: 'Thug 1', campaignName: 'test-campaign', skipRangeCheck: false },
    expectedMode: 'disadvantage',
    expectedReason: 'Lion rage aura — enemy of raging ElderPaladin within 5 ft',
  },
];

describe('contextBuilder-sync - Wolf/Lion aura awaited at both faces (CLA-283)', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(auraFaces)(
    '$face awaits the util, stamps $expectedMode and threads the honest reason',
    async ({ hasMap, util, arm, expectedArgs, expectedMode, expectedReason }) => {
      setup();
      if (hasMap) activeMap();
      arm();

      const result = await buildAttackContextSync(attack, makeStats('HexWarlock'), 'test-campaign', 'normal');

      expect(util).toHaveBeenCalledWith(expectedArgs);
      expect(result.forcedMode).toBe(expectedMode);
      expect(result.advantageReason).toBe(expectedReason);
    }
  );

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
});

// bug-wolf-aura-unmeasured-on-pc-roller-lane: with an ACTIVE map the sync lane
// must consult the aura utils MEASURED (skipRangeCheck:false). The unconditional
// lenient stamp pre-empted the measured aura pass in contextBuilder-map.js
// (accumulateAuraCounts is guarded by base.forcedMode === undefined), so a Wolf
// bearer anywhere on a positioned map granted advantage at 15/25 ft distances.
// The table's gridless rows above pin that skipRangeCheck:true leniency stays
// the no-map fallback.
describe('contextBuilder-sync - active map MEASURES every aura axis (skipRangeCheck gate)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('active map → wolf/duplicity/lion all consulted measured (never lenient) and refusals leave mode normal', async () => {
    setup();
    activeMap();

    const result = await buildAttackContextSync(attack, makeStats('HexWarlock'), 'test-campaign', 'normal');

    // Duplicity takes no targetName (attacker-only illusion adjacency).
    expect(getDuplicityAdvantageAgainst).toHaveBeenCalledWith({
      attackerName: 'HexWarlock',
      campaignName: 'test-campaign',
      skipRangeCheck: false,
    });
    for (const util of [getWolfAdvantageAgainst, getLionDisadvantageAgainst]) {
      expect(util).toHaveBeenCalledWith({
        attackerName: 'HexWarlock',
        targetName: 'Thug 1',
        campaignName: 'test-campaign',
        skipRangeCheck: false,
      });
    }
    for (const util of [getWolfAdvantageAgainst, getDuplicityAdvantageAgainst, getLionDisadvantageAgainst]) {
      expect(util).not.toHaveBeenCalledWith(expect.objectContaining({ skipRangeCheck: true }));
    }
    // Refused measurements stamp nothing (the regression that motivated the gate).
    expect(result.forcedMode).toBeUndefined();
    expect(result.advantageReason).toBeUndefined();
  });
});
