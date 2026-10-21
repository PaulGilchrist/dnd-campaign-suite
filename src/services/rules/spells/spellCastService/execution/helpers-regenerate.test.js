// @maintained-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* ------------------------------------------------------------------ */
/*  helpers.js Regenerate span (:381-:491) — module-direct face.    */
/*                                                                    */
/*  Mocks: the canonical 13-module helpers-dependency roster, byte- */
/*  for-byte with sibling helpers lanes (#1478/79/80/81 family       */
/*  canon — consumers mock ./helpers.js wholesale, this lane runs    */
/*  it REAL).                                                        */
/*                                                                    */
/*  LIVE-vs-DEAD verdict (#1398 dormant-service, resolved):          */
/*  - For REAL disk rows (both rulesets carry                          */
/*    automation.type 'healing_start_of_turn' and 'regenerate' is    */
/*    absent from SERVICE_HANDLED_SPELLS, triggerSpells.js:42-58)    */
/*    the hub consumes at index.js:710 via handleGenericAutomation   */
/*    BEFORE runNoDamagePath — pinned by                             */
/*    spellCastService.heal.test.js:354 (#1398/#1454). The          */
/*    index.js:278 -> triggerSpells.js:59-68 -> applyRegenerateSpell */
/*    arm is therefore UNREACHABLE for disk-byte casts — legacy      */
/*    parallel lane (same dead-route class as the #1472 :316-:359   */
/*    census, folded-cited there; never fake-covered here, #1458).  */
/*  - Live stamp producer is regenerateHandler.applyRegenerateEffect */
/*    (:154) invoked from useSimpleSpellHandlers:124 ->               */
/*    regenerateService.confirmRegenerate; the 1-HP turn tick is     */
/*    consumed by turnStartEffects.js / useInitiativeEffects.js at   */
/*    the initiative seam. This lane owns ONLY helpers.js            */
/*    applyRegenerateSpell module bytes, run directly.               */
/*                                                                    */
/*  RULESET DETERMINATION (disk bytes, #1365): BOTH disks implement */
/*  the HEAL-POINT model, NOT temp HP. 5e spells.json: "The target  */
/*  regains 4d8 + 15 hit points. For the duration of the spell, the */
/*  target regains 1 hit point at the start of each of its turns";  */
/*  2024/spells.json: "A creature you touch regains 4d8 + 15 Hit    */
/*  Points. For the duration, the target regains 1 Hit Point at the */
/*  start of each of its turns". Identical                           */
/*  heal_at_slot_level {"7":"4d8 + 15"}, level 7, non-concentrating */
/*  — asserted programmatically below; no ruleset branch exists in   */
/*  this span, so no #1482-class fidelity gap.                      */
/*                                                                    */
/*  No-clock: the span stamps NO wall-clock. setRuntimeValue holds  */
/*  boolean/string seam flags (regenerateActive/regenerateSource)    */
/*  consumed at the initiative seam; addExpiration carries only the  */
/*  'remove_regenerate_buff' effect byte — countdown ownership is    */
/*  expirations.js's lane (helpers.js:477 comment mentioning         */
/*  "600 rounds" is stale prose, reported — payload has no seconds).*/
/*  Date.now() appears only as benign log timestamps (spied).        */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Mocks — dependencies of helpers.js (13/13 direct-path audit)    */
/* ------------------------------------------------------------------ */

vi.mock('../../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../automation/index.js', () => ({
  executeHandler: vi.fn(),
}));

vi.mock('../../../effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../features/spellUtils.js', () => ({
  usesSpellSlot: vi.fn(() => true),
}));

vi.mock('../../../../automation/handlers/class-wizard/arcaneWardHandler.js', () => ({
  onAbjurationSpellCast: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../../combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(),
}));

vi.mock('../../../../../services/rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(),
}));

vi.mock('../../../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
}));

vi.mock('../../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 5, rolls: [5] })),
  rollExpressionMaximized: vi.fn(() => ({ total: 8, rolls: [8] })),
  applyHealingRerollOnes: vi.fn(() => ({ displayRolls: [5], originalRolls: [5] })),
}));

vi.mock('../../../../combat/automation/automationService.js', () => ({
  markFortifiedHealthUsedIfGranted: vi.fn(),
  resolveHealingBonusesWithDetails: vi.fn(() => ({ totalBonus: 0, details: [] })),
  hasHealingMaximizationForTarget: vi.fn(() => false),
  hasRerollHealingOnes: vi.fn(() => false),
}));

vi.mock('../../../features/invisibilityService.js', () => ({
  endInvisibilityOnHostileAction: vi.fn(),
}));

/* ------------------------------------------------------------------ */
/*  SUT imports after mocks                                            */
/* ------------------------------------------------------------------ */

import { applyRegenerateSpell } from './helpers.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../../ui/logService.js';
import { rollExpression, rollExpressionMaximized, applyHealingRerollOnes } from '../../../../dice/diceRoller.js';
import { addExpiration } from '../../../effects/expirations.js';
import { applyHealingToTarget } from '../../../combat/applyHealing.js';
import { getCombatContext } from '../../../combat/damageUtils.js';
import {
  resolveHealingBonusesWithDetails,
  hasHealingMaximizationForTarget,
  hasRerollHealingOnes,
} from '../../../../combat/automation/automationService.js';

/* ------------------------------------------------------------------ */
/*  Fixtures — REAL disk rows BOTH rulesets, programmatic (#1365)   */
/* ------------------------------------------------------------------ */

const readDisk = (p) => JSON.parse(readFileSync(join(process.cwd(), p), 'utf8'));
const diskRow = (ruleset) => readDisk(ruleset === '2024' ? 'public/data/2024/spells.json' : 'public/data/spells.json')
  .find(s => s.index === 'regenerate');

const CAMPAIGN = 'test-campaign'; // lockdown-compliant
const TS = 1700000000000;
const DISK_5E = diskRow('5e');
const DISK_2024 = diskRow('2024');

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestWizard',
    abilities: [{ name: 'Intelligence', bonus: 5 }],
    proficiency: 4,
    spellAbilities: {
      spellCastingAbility: 'Intelligence',
      toHit: 9,
      saveDc: 17,
      modifier: 5,
    },
    automation: { passives: [] },
    hitPoints: 100,
    level: 10,
    ...overrides,
  };
}

const makeSummary = (creature) => ({ creatures: [creature] });
const GOBLIN_50 = { name: 'Goblin', maxHp: 100, currentHp: 50 };

let consoleError;

/** addEntry calls of one type, as full [campaign, entry] tuples. */
function logTuples(type) {
  return vi.mocked(addEntry).mock.calls.filter(([, e]) => e.type === type);
}

/** The exact hp_change sink for a clamped/unclamped heal (helpers.js:407-419). */
const hpTuple = (delta, currentHp, maxHp, formula, bonusDetails) => [CAMPAIGN, {
  type: 'hp_change', targetName: 'Goblin', delta, currentHp, maxHp,
  isHealing: true, sourceName: 'TestWizard', note: 'Regenerate',
  formula, bonusDetails, timestamp: TS,
}];

const ABILITY_USE_TUPLE = [CAMPAIGN, {
  type: 'ability_use',
  characterName: 'TestWizard',
  abilityName: 'Regenerate',
  description: 'TestWizard cast Regenerate on Goblin. Target regains HP and regains 1 HP at start of each turn for 1 hour.',
  timestamp: TS,
}];

/* ------------------------------------------------------------------ */
/*  Tests                                                            */
/* ------------------------------------------------------------------ */

describe('helpers.js applyRegenerateSpell — module-direct span (:381-:491); dead-arm-for-disk legacy lane pinned honestly (#1398)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(TS);
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    setRuntimeValue.mockResolvedValue(undefined);
    applyHealingToTarget.mockReturnValue({ actualHeal: 33, oldHp: 50, newHp: 83 });
    getCombatContext.mockResolvedValue(makeSummary(GOBLIN_50));
    rollExpression.mockReturnValue({ total: 33, rolls: [8, 7, 6, 4] });
    resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 0, details: [] });
    hasHealingMaximizationForTarget.mockReturnValue(false);
    hasRerollHealingOnes.mockReturnValue(false);
  });

  afterEach(() => {
    consoleError.mockRestore();
    vi.restoreAllMocks();
  });

  it('both disks carry byte-identical Regenerate rows and a cast produces the full exact write census: 4-arg-arity roll, clamped-free heal, ordered regenerateActive-then-Source stamps, durationless expiration, ordered hp_change-then-ability_use logs, exact 7-key envelope', async () => {
    // Disk-fidelity gate first: both rulesets exist, heal-point model,
    // identical span-relevant bytes -> one shared expectation set (#1365).
    expect(DISK_5E.heal_at_slot_level).toEqual(DISK_2024.heal_at_slot_level);
    expect(DISK_5E.heal_at_slot_level).toEqual({ 7: '4d8 + 15' });
    expect([DISK_5E.level, DISK_2024.level]).toEqual([7, 7]);
    expect([DISK_5E.name, DISK_2024.name]).toEqual(['Regenerate', 'Regenerate']);
    expect([DISK_5E.concentration, DISK_2024.concentration]).toEqual([false, false]);
    expect([DISK_5E.automation.type, DISK_2024.automation.type]).toEqual(['healing_start_of_turn', 'healing_start_of_turn']);

    for (const ruleset of ['5e', '2024']) {
      vi.clearAllMocks();
      const caster = makePlayerStats();
      const summary = makeSummary(GOBLIN_50);
      getCombatContext.mockResolvedValue(summary);

      const result = await applyRegenerateSpell(diskRow(ruleset), { name: 'Goblin' }, caster, CAMPAIGN);

      // Bonus context arity-2 tuple (:462): || 0 / || 1 defaults NOT exercised here.
      expect(vi.mocked(resolveHealingBonusesWithDetails).mock.calls).toEqual([
        [caster, { prof: 4, level: 10, slotLevel: 7, campaignName: CAMPAIGN }],
      ]);
      expect(vi.mocked(getCombatContext).mock.calls).toEqual([[CAMPAIGN]]);
      expect(vi.mocked(rollExpression).mock.calls).toEqual([['4d8 + 15']]);
      expect(vi.mocked(rollExpressionMaximized).mock.calls).toEqual([]);
      expect(vi.mocked(applyHealingRerollOnes).mock.calls).toEqual([]);
      expect(vi.mocked(applyHealingToTarget).mock.calls).toEqual([[summary, 'Goblin', 33, CAMPAIGN]]);
      // Conditional-read census: currentHp present -> key NEVER read (:436 ??-short).
      expect(vi.mocked(getRuntimeValue).mock.calls).toEqual([]);
      // Full ordered stamp census (:474-:475).
      expect(vi.mocked(setRuntimeValue).mock.calls).toEqual([
        ['Goblin', 'regenerateActive', true, CAMPAIGN],
        ['Goblin', 'regenerateSource', 'TestWizard', CAMPAIGN],
      ]);
      // Expiration carries NO duration bytes — seam flag only (no-clock).
      expect(vi.mocked(addExpiration).mock.calls).toEqual([[{
        attackerName: 'TestWizard', targetName: 'Goblin',
        effects: [{ type: 'remove_regenerate_buff' }], campaignName: CAMPAIGN,
      }]]);
      // Ordered log census: hp_change (:407) precedes ability_use (:482).
      expect(vi.mocked(addEntry).mock.calls).toEqual([
        hpTuple(33, 83, 100, '4d8 + 15', undefined),
        ABILITY_USE_TUPLE,
      ]);
      // Exact 7-key envelope (:490) — no fabricated keys.
      expect(result).toEqual({
        targetName: 'Goblin', healAmount: 33, formula: '4d8 + 15',
        rolls: [8, 7, 6, 4], rawTotal: 33, bonusHeal: 0, bonusDetails: [],
      });
      expect(consoleError).not.toHaveBeenCalled();
    }
  });

  it('expression resolution arms: exact-level slot beats downward fallback; fallback takes the HIGHEST tier at or below slot; no tier at or below skips the heal but still stamps (#1423 title correction)', async () => {
    // Arm A — exact hit (:382-:383) beats lower tiers: level 8, {7:'4d8 + 15', 8:'8d8 + 30'}.
    // Synthetic multi-tier map (disk carries ONLY tier 7) documented as such.
    const spellA = { name: 'Regenerate', level: 8, heal_at_slot_level: { 7: '4d8 + 15', 8: '8d8 + 30' } };
    const resultA = await applyRegenerateSpell(spellA, { name: 'Goblin' }, makePlayerStats(), CAMPAIGN);
    expect(vi.mocked(rollExpression).mock.calls).toEqual([['8d8 + 30']]);
    expect(resultA.formula).toBe('8d8 + 30');
    expect(resultA.healAmount).toBe(33); // rolled via the level-8 formula; mock total 33

    // Arm B — downward fallback: level 8, {6:'2d8 + 5', 7:'4d8 + 15'} -> highest BELOW = 7.
    vi.clearAllMocks();
    const spellB = { name: 'Regenerate', level: 8, heal_at_slot_level: { 6: '2d8 + 5', 7: '4d8 + 15' } };
    const resultB = await applyRegenerateSpell(spellB, { name: 'Goblin' }, makePlayerStats(), CAMPAIGN);
    expect(resultB.formula).toBe('4d8 + 15');
    expect(vi.mocked(rollExpression).mock.calls).toEqual([['4d8 + 15']]);

    // Arm C — every tier ABOVE slot (level 5, {7:...}) -> expression undefined ->
    // whole applyRegenerateInitialHeal skipped, stamps + expiration + ability_use
    // still written; rawTotal NaN-fold QUIRK (:490) settles to 0.
    vi.clearAllMocks();
    const spellC = { name: 'Regenerate', level: 5, heal_at_slot_level: { 7: '4d8 + 15' } };
    const resultC = await applyRegenerateSpell(spellC, { name: 'Goblin' }, makePlayerStats(), CAMPAIGN);
    expect(vi.mocked(rollExpression).mock.calls).toEqual([]);
    expect(vi.mocked(getCombatContext).mock.calls).toEqual([]);
    expect(vi.mocked(applyHealingToTarget).mock.calls).toEqual([]);
    expect(resultC).toEqual({
      targetName: 'Goblin', healAmount: 0, formula: undefined,
      rolls: [], rawTotal: 0, bonusHeal: 0, bonusDetails: [],
    });
    expect(vi.mocked(setRuntimeValue).mock.calls).toEqual([
      ['Goblin', 'regenerateActive', true, CAMPAIGN],
      ['Goblin', 'regenerateSource', 'TestWizard', CAMPAIGN],
    ]);
    expect(vi.mocked(addEntry).mock.calls).toEqual([ABILITY_USE_TUPLE]);
  });

  it('validation guards: null/undefined level throws, non-object heal map throws, but falsy-0 level PASSES the == null gate and stamps without healing (falsy triple, #1352)', async () => {
    const caster = makePlayerStats();
    for (const level of [null, undefined]) {
      await expect(
        applyRegenerateSpell({ name: 'Regenerate', level, heal_at_slot_level: { 7: '4d8 + 15' } }, { name: 'Goblin' }, caster, CAMPAIGN),
      ).rejects.toThrow('spell.level is required for regenerate spell');
    }
    expect(vi.mocked(setRuntimeValue).mock.calls).toEqual([]);
    expect(vi.mocked(rollExpression).mock.calls).toEqual([]);

    for (const bad of [null, undefined, '7', 7]) {
      await expect(
        applyRegenerateSpell({ name: 'Regenerate', level: 7, heal_at_slot_level: bad }, { name: 'Goblin' }, caster, CAMPAIGN),
      ).rejects.toThrow('heal_at_slot_level must be an object');
    }
    expect(vi.mocked(setRuntimeValue).mock.calls).toEqual([]);

    // Falsy triple: level 0 is NOT null -> guard passes; no tier <= 0 exists
    // on the disk map -> heal silently skipped; stamps still land. QUIRK pin.
    vi.clearAllMocks();
    const spell0 = { ...diskRow('5e'), level: 0 };
    const casterStrip = makePlayerStats({ proficiency: undefined, level: undefined });
    const r0 = await applyRegenerateSpell(spell0, { name: 'Goblin' }, casterStrip, CAMPAIGN);
    expect(vi.mocked(resolveHealingBonusesWithDetails).mock.calls).toEqual([
      [casterStrip, { prof: 0, level: 1, slotLevel: 0, campaignName: CAMPAIGN }],
    ]);
    expect(vi.mocked(applyHealingToTarget).mock.calls).toEqual([]);
    expect(r0.healAmount).toBe(0);
    expect(vi.mocked(setRuntimeValue).mock.calls).toEqual([
      ['Goblin', 'regenerateActive', true, CAMPAIGN],
      ['Goblin', 'regenerateSource', 'TestWizard', CAMPAIGN],
    ]);
  });

  it('roll-mode precedence: maximize beats reroll-ones (normal roll and reroll helper never invoked); reroll-ones swaps DISPLAY rolls only — applied heal keeps the pre-reroll total (QUIRK, :390-:398)', async () => {
    // Arm A — maximize wins even when rerollOnes is also true.
    hasHealingMaximizationForTarget.mockReturnValue(true);
    hasRerollHealingOnes.mockReturnValue(true);
    vi.mocked(rollExpressionMaximized).mockReturnValue({ total: 32, rolls: [8, 8, 8, 8] });
    const spell = diskRow('5e');
    const caster = makePlayerStats();

    const resultA = await applyRegenerateSpell(spell, { name: 'Goblin' }, caster, CAMPAIGN);
    expect(vi.mocked(rollExpressionMaximized).mock.calls).toEqual([['4d8 + 15']]);
    expect(vi.mocked(rollExpression).mock.calls).toEqual([]);
    expect(vi.mocked(applyHealingRerollOnes).mock.calls).toEqual([]);
    expect(resultA.rolls).toEqual([8, 8, 8, 8]);
    expect(vi.mocked(applyHealingToTarget).mock.calls[0][2]).toBe(32);

    // Arm B — reroll-only: ones replaced in the DISPLAY set, but :437 clamps
    // from result.total = 15 (unchanged by the display swap).
    vi.clearAllMocks();
    hasHealingMaximizationForTarget.mockReturnValue(false);
    hasRerollHealingOnes.mockReturnValue(true);
    rollExpression.mockReturnValue({ total: 15, rolls: [1, 5, 5, 4] });
    vi.mocked(applyHealingRerollOnes).mockReturnValue({ displayRolls: [5, 5, 5, 5], originalRolls: [1, 5, 5, 4] });

    const resultB = await applyRegenerateSpell(spell, { name: 'Goblin' }, caster, CAMPAIGN);
    expect(vi.mocked(applyHealingRerollOnes).mock.calls).toEqual([[[1, 5, 5, 4], '4d8 + 15']]);
    expect(resultB.rolls).toEqual([5, 5, 5, 5]);
    expect(resultB.rawTotal).toBe(15);
    expect(vi.mocked(applyHealingToTarget).mock.calls[0][2]).toBe(15);
  });

  it('bonus flow with clamped heal: bonus joins rawTotal and the log formula concat, applied forward is min(roll+bonus, gap) only; raw envelope keeps the unclamped rawTotal', async () => {
    resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 5, details: [{ amount: 5, name: 'Spell Power' }] });
    const summary = makeSummary({ name: 'Goblin', maxHp: 50, currentHp: 45 });
    getCombatContext.mockResolvedValue(summary);
    rollExpression.mockReturnValue({ total: 20, rolls: [5, 5, 5, 5] });

    const result = await applyRegenerateSpell(diskRow('5e'), { name: 'Goblin' }, makePlayerStats(), CAMPAIGN);

    expect(vi.mocked(applyHealingToTarget).mock.calls).toEqual([[summary, 'Goblin', 5, CAMPAIGN]]);
    expect(logTuples('hp_change')).toEqual([hpTuple(5, 50, 50, '4d8 + 15 + (5 Spell Power)', [{ amount: 5, name: 'Spell Power' }])]);
    expect(result).toEqual({
      targetName: 'Goblin', healAmount: 5, formula: '4d8 + 15',
      rolls: [5, 5, 5, 5], rawTotal: 25, bonusHeal: 5, bonusDetails: [{ amount: 5, name: 'Spell Power' }],
    });
  });

  it('HP fallback chains: null creature maxHp falls back through || to caster.hitPoints; null currentHp falls through ?? to the 3-arg currentHitPoints read then ?? to maxHp yielding delta-0 silence contrast (apply skipped, log still written); 0 currentHp is PRESERVED by ?? and heals to full gap', async () => {
    // Arm A — both creature HP null, runtime read null: maxHp = caster.hitPoints
    // (:435 ||), currentHp = maxHp (:436 ?? chain terminal) -> gap 0.
    const summary = makeSummary({ name: 'Goblin', maxHp: null, currentHp: null });
    getCombatContext.mockResolvedValue(summary);
    getRuntimeValue.mockReturnValue(null);

    const resultA = await applyRegenerateSpell(diskRow('5e'), { name: 'Goblin' }, makePlayerStats({ hitPoints: 100 }), CAMPAIGN);
    expect(vi.mocked(getRuntimeValue).mock.calls).toEqual([['Goblin', 'currentHitPoints', CAMPAIGN]]);
    expect(vi.mocked(applyHealingToTarget).mock.calls).toEqual([]); // :439 > 0 gate
    // :0-silence contrast (#1481 form): heal silent, log NOT — exact delta-0 sink.
    expect(logTuples('hp_change')).toEqual([hpTuple(0, 100, 100, '4d8 + 15', undefined)]);
    expect(resultA.healAmount).toBe(0);
    expect(resultA.rawTotal).toBe(33); // raw survives the skip (healed total, unapplied)
    expect(vi.mocked(setRuntimeValue).mock.calls).toEqual([
      ['Goblin', 'regenerateActive', true, CAMPAIGN],
      ['Goblin', 'regenerateSource', 'TestWizard', CAMPAIGN],
    ]);

    // Arm B — currentHp 0 at the ?? head: 0 is not nullish -> runtime key NEVER
    // read; full gap 50 heals.
    vi.clearAllMocks();
    getCombatContext.mockResolvedValue(makeSummary({ name: 'Goblin', maxHp: 50, currentHp: 0 }));

    const resultB = await applyRegenerateSpell(diskRow('5e'), { name: 'Goblin' }, makePlayerStats(), CAMPAIGN);
    expect(vi.mocked(getRuntimeValue).mock.calls).toEqual([]);
    expect(vi.mocked(applyHealingToTarget).mock.calls[0][2]).toBe(33);
    expect(logTuples('hp_change')).toEqual([hpTuple(33, 33, 50, '4d8 + 15', undefined)]);
    expect(resultB.healAmount).toBe(33);
  });

  it('max-HP-missing guard throws AFTER the dice roll (validate-after-side-effect order, #1481 form): roll consumed, zero writes, zero logs, console stamped once', async () => {
    getCombatContext.mockResolvedValue(makeSummary({ name: 'Goblin', maxHp: null, currentHp: null }));
    getRuntimeValue.mockReturnValue(null);
    const caster = makePlayerStats({ hitPoints: null });

    await expect(
      applyRegenerateSpell(diskRow('5e'), { name: 'Goblin' }, caster, CAMPAIGN),
    ).rejects.toThrow('max HP is required for regenerate spell');

    expect(vi.mocked(rollExpression).mock.calls).toEqual([['4d8 + 15']]); // already consumed at :424
    expect(vi.mocked(applyHealingToTarget).mock.calls).toEqual([]);
    expect(vi.mocked(setRuntimeValue).mock.calls).toEqual([]);
    expect(vi.mocked(addExpiration).mock.calls).toEqual([]);
    expect(vi.mocked(addEntry).mock.calls).toEqual([]);
    expect(consoleError.mock.calls).toEqual([
      ['[spellCast] applyRegenerateSpell: max HP is missing for both creature and caster'],
    ]);
  });
});

/* ------------------------------------------------------------------ */
/*  KILL MATRIX (declared, mutants -> killing test):                 */
/*  M1 :438 drop Math.min clamp            -> t5 (apply 25 vs 5)     */
/*  M2 :439 > 0 becomes >= 0               -> t6 arm A (apply 0 call)*/
/*  M3 :385 <= becomes >=                  -> t2 arm B picks nothing/  */
/*      (sort/pop dir)    8d8-side; arm C NaN shape differs          */
/*  M4 :383 exact-hit removed             -> t2 arm A ('4d8 + 15'    */
/*      via fallback instead of exact '8d8 + 30')                     */
/*  M5 :393 maximize ternary flip        -> t4 arm A/B                */
/*  M6 :394 drop && !maximize            -> t4 arm A (reroll called   */
/*      while maximized)                                               */
/*  M7 :431 && becomes ||                -> t6 arm A (would throw on  */
/*      caster.hitPoints fallback)                                     */
/*  M8 :436 ?? head swap to ||           -> t6 arm B (0 read as null, */
/*      runtime key read, heal 0)                                      */
/*  M9 :437 drop bonusHeal               -> t5 rawTotal 20 vs 25      */
/*  M10 :490 drop || initialHeal fold   -> t2 arm C rawTotal NaN     */
/*  M11 :474/:475 stamp swap or drop     -> t1/t2/t3/t6 ordered       */
/*      setRuntimeValue censuses                                       */
/*  M12 :479 effect byte mutate          -> t1 exact addExpiration    */
/*  M13 :424 roll moved after :427 fetch -> t7 order-after-throw pin  */
/*  EQUIVALENT (unkillable, documented): :385 `<=`->`<` (exact hits   */
/*  already returned at :383, so the arms are observationally equal); */
/*  :435 `||`->`??` (only differs at maxHp===0, an absurd creature    */
/*  row that exists on no disk).                                       */
/* ------------------------------------------------------------------ */
