// @maintained-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/* ------------------------------------------------------------------ */
/*  helpers.js PWK span (:277-:334) — module-direct execution face. */
/*                                                                    */
/*  Mocks: the canonical 13-module helpers-dependency roster, byte- */
/*  for-byte with sibling helpers lanes (#1478/79/80 family canon — */
/*  consumers mock ./helpers.js wholesale, this lane runs it REAL). */
/*                                                                    */
/*  Boundary (cited, never re-grown):                               */
/*  - earlyReturns-modal #1471 owns the index.js:702/:703 EARLY arm */
/*    table — name-gate (:703 `spell.name &&` guarded; heal's :702  */
/*    was the UNGUARDED :10 twin, #1481 fixed there), declined/    */
/*    passThrough envelopes, :702-before-:703 order. This lane owns */
/*    what executes AFTER routing lands here.                        */
/*  - modalSpells.powerWordSpread owns the spread gate (:28-:34)    */
/*    with an INJECTED fake helper — the REAL :281 short-circuit is */
/*    untouched there, pinned below on this direct face (#1481 CLA- */
/*    392 twin; heal's :259 fold is hub-owned by #1454).            */
/*                                                                    */
/*  Semantics from DISK, not memory (#1365):                        */
/*  - 5e public/data/spells.json: "If the creature you choose has   */
/*    100 hit points or fewer, it dies. Otherwise, the spell has no */
/*    effect."                                                       */
/*  - 2024 public/data/2024/spells.json: "If the target has 100 Hit */
/*    Points or fewer, it dies. Otherwise, it takes 12d12 Psychic    */
/*    damage." damage_at_slot_level {"9":"12d12"} Psychic.           */
/*  Both disks agree on the `<= 100` tie (dies AT 100). #1482 FIX:  */
/*  the span now BRANCHES the >100 arm by caster ruleset (house      */
/*  selector fix#98, playerStats.rules === '2024'; unset defaults 5e)*/
/*  — 12d12 Psychic is lawful ONLY on the 2024 row; 5e casts take the*/
/*  disk's "no effect" branch (zero roll, zero damage, zero popup,    */
/*  loud ability_use log). Former single-codepath deviation is gone.  */
/*  Write-path: instant death is implemented AS damage equal to     */
/*    currentHp through applyDamageToTarget (:305) plus a threshold-*/
/*    'dead' log (:293-:303) — no kill-flag, no condition writes,  */
/*    no tempHp consultation (no deviation: span never reads temp   */
/*    HP). Sanctum/revivify adjacency owned by #1349/revivify lanes.*/
/*  NO-CLOCK: instantaneous kill; log/popup payloads carry NO        */
/*    timestamp key — pinned by exact toEqual key-sets below.        */
/*                                                                    */
/*  Kill-matrix (mutants killed, declaration #1481 form):            */
/*  M1 :292 `<=`->`<`                T2 (100 arm still dies)          */
/*  M2 :292 threshold 100->N        T2 (100 vs 101 byte split)      */
/*  M3 :305 currentHp->const/roll   T1/T2 (forward == live currentHp)*/
/*  M4 :317 formula bytes           T2 (rollExactly ['12d12'])       */
/*  M5 drop :293 log                T1 (full addEntry census)         */
/*  M6 :296 drop `||` fallback      T5 (quirk delta bytes flip)     */
/*  M7 :319 drop ?./??             T3 (TypeError instead of 0)       */
/*  M8 drop popups                  T1/T2 (exact popup key-sets)      */
/*  M9 :287 isPlayer flip          T4 (runtime-vs-snapshot branch)   */
/*  M10 opts mutation               T1 (exact 5th-arg object)         */
/*  M11 :281 always-fetch          T7 (zero-fetch census + identity) */
/*  M12 ruleset-branch dropped     5e-disk-law + divergence tests   */
/*     (both rulesets re-take 12d12 -> red on no-effect census)     */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Mocks — dependencies of helpers.js                                */
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

import { applyPowerWordKillToTarget } from './helpers.js';
import { getRuntimeValue } from '../../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../../ui/logService.js';
import { applyDamageToTarget } from '../../../../../services/rules/combat/applyDamage.js';
import { getCombatContext } from '../../../combat/damageUtils.js';
import { rollExpression } from '../../../../dice/diceRoller.js';

/* ------------------------------------------------------------------ */
/*  Fixtures (lightweight route #1472: span consumes targetName,     */
/*  snapshot rows, and playerStats.name only — no fabricated keys)  */
/* ------------------------------------------------------------------ */

const CAMPAIGN = 'test-campaign';
// #1482: caster carries an explicit ruleset — the 12d12 damage arm below is
// lawful ONLY for 2024 (public/data/2024/spells.json:10210). 5e casts take the
// no-effect branch pinned in the dedicated #1482 arms.
const caster = { name: 'TestWizard', rules: '2024' };

const makeSummary = (creature) => ({ creatures: [creature] });
const GOBLIN_80 = { name: 'Goblin', maxHp: 80, currentHp: 80 };

let consoleError;
let popups;
const onPopup = (e) => popups.push(e.detail);

/** hp_change entries of the span (:293-:303): the ONLY log it emits. */
function hpChangeTuples() {
  return vi.mocked(addEntry).mock.calls.filter(([, e]) => e.type === 'hp_change');
}

/* ------------------------------------------------------------------ */
/*  Tests                                                            */
/* ------------------------------------------------------------------ */

describe('helpers.js applyPowerWordKillToTarget — module-direct PWK span (:277-:334)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    popups = [];
    window.addEventListener('damage-popup', onPopup);
    getRuntimeValue.mockReturnValue(undefined);
    getCombatContext.mockResolvedValue(makeSummary(GOBLIN_80));
    // Lane hygiene (#1482): earlier tests override implementations
    // (addEntry-reject at :300, rollExpression-undefined at :234) and
    // clearAllMocks does NOT restore them — re-arm canonical behavior.
    addEntry.mockImplementation(() => Promise.resolve());
    rollExpression.mockReturnValue({ total: 5, rolls: [5] });
    // Span ignores applyDamageToTarget's return value (:305/:320) — no
    // stub needed; undefined return is the honest sink.
  });

  afterEach(() => {
    window.removeEventListener('damage-popup', onPopup);
    consoleError.mockRestore();
    vi.restoreAllMocks();
  });

  it('NPC kill at 80 HP: exact forward tuple (snapshot identity, damage == currentHp, full opts), dead-threshold log dispatched BEFORE the write, full popup key-set without rolls/formula, zero runtime reads, quiet console', async () => {
    const summary = makeSummary(GOBLIN_80);
    getCombatContext.mockResolvedValue(summary);

    await applyPowerWordKillToTarget('Goblin', caster, CAMPAIGN);

    // Forward (:305): identity of the fetched snapshot + currentHp as the
    // damage number — instant death implemented AS damage, not a flag.
    expect(vi.mocked(applyDamageToTarget).mock.calls).toEqual([[summary, 'Goblin', 80, ['Psychic'], { campaignName: CAMPAIGN, characters: [], ignoreResistance: false, attackerName: 'TestWizard' }]]);
    expect(vi.mocked(applyDamageToTarget).mock.calls[0][0]).toBe(summary);
    // Log (:293-:303): exact key-set — NO timestamp key (no-clock),
    // threshold 'dead', isUnconscious false, delta -currentHp.
    expect(hpChangeTuples()).toEqual([[CAMPAIGN, {
      type: 'hp_change', targetName: 'Goblin', delta: -80, currentHp: 0, maxHp: 80,
      isHealing: false, isUnconscious: false, threshold: 'dead', note: 'Power Word Kill',
    }]]);
    // Order tap (#1481 heal-lane twin form): log (:293) precedes write (:305).
    expect(vi.mocked(addEntry).mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(applyDamageToTarget).mock.invocationCallOrder[0]);
    // Kill popup (:307-:315): exactly five keys — no rolls/formula, the
    // contrast with the damage arm pinned in the next test.
    expect(popups).toEqual([{
      targetName: 'Goblin', sourceName: 'TestWizard', spellName: 'Power Word Kill',
      popupText: 'Goblin was slain by Power Word Kill', damageType: 'Psychic',
    }]);
    // NPC never consults the runtime store (:288 ternary guard).
    expect(vi.mocked(getRuntimeValue).mock.calls).toEqual([]);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('boundary at disk threshold: currentHp 100 dies outright (both ruleset disks: "100 hit points or fewer") while 2024 caster at 101 takes the single 12d12 roll and the full damage-arm popup bytes (#1482: 5e 101 arm owned by the 5e-disk-law test)', async () => {
    // Arm A — 100 HP ties the threshold and KILLS (kills M1 `<=`->`<`, M2).
    const at100 = makeSummary({ name: 'Knight', maxHp: 100, currentHp: 100 });
    getCombatContext.mockResolvedValue(at100);

    await applyPowerWordKillToTarget('Knight', caster, CAMPAIGN);

    expect(vi.mocked(applyDamageToTarget).mock.calls).toEqual([[at100, 'Knight', 100, ['Psychic'], { campaignName: CAMPAIGN, characters: [], ignoreResistance: false, attackerName: 'TestWizard' }]]);
    expect(hpChangeTuples()[0][1].threshold).toBe('dead');
    expect(popups[0].popupText).toBe('Knight was slain by Power Word Kill');
    expect(vi.mocked(rollExpression).mock.calls).toEqual([]);

    // Arm B — 101 HP survives to the damage arm (kills M2/M4/M8).
    vi.clearAllMocks();
    popups = [];
    const over = makeSummary({ name: 'Ogre', maxHp: 200, currentHp: 101 });
    getCombatContext.mockResolvedValue(over);

    await applyPowerWordKillToTarget('Ogre', caster, CAMPAIGN);

    expect(vi.mocked(rollExpression).mock.calls).toEqual([['12d12']]);
    expect(vi.mocked(applyDamageToTarget).mock.calls).toEqual([[over, 'Ogre', 5, ['Psychic'], { campaignName: CAMPAIGN, characters: [], ignoreResistance: false, attackerName: 'TestWizard' }]]);
    // Damage arm emits NO hp_change log and NO threshold — log census empty.
    expect(vi.mocked(addEntry).mock.calls).toEqual([]);
    // Damage popup (:322-:332): seven keys — rolls + formula present here.
    expect(popups).toEqual([{
      targetName: 'Ogre', sourceName: 'TestWizard', spellName: 'Power Word Kill',
      popupText: 'Ogre took 5 Psychic damage (too healthy to kill)', damageType: 'Psychic',
      rolls: [5], formula: '12d12',
    }]);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('silent-undefined roll quirk (:319 `?.total ?? 0`, :329 `?.rolls || []`): undefined roll result forwards damage 0 and popup total 0 without throwing', async () => {
    getCombatContext.mockResolvedValue(makeSummary({ name: 'Ogre', maxHp: 200, currentHp: 150 }));
    rollExpression.mockReturnValue(undefined);

    await expect(applyPowerWordKillToTarget('Ogre', caster, CAMPAIGN)).resolves.toBeUndefined();

    // Kills M7: dereferencing damageResult.total or dropping ?? 0 throws.
    expect(vi.mocked(applyDamageToTarget).mock.calls).toHaveLength(1);
    expect(vi.mocked(applyDamageToTarget).mock.calls[0][2]).toBe(0);
    expect(popups).toEqual([{
      targetName: 'Ogre', sourceName: 'TestWizard', spellName: 'Power Word Kill',
      popupText: 'Ogre took 0 Psychic damage (too healthy to kill)', damageType: 'Psychic',
      rolls: [], formula: '12d12',
    }]);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('HP-source census (:288-:290): player runtime currentHitPoints beats snapshot 150 and picks the kill arm while maxHp stays snapshot-only (heal :267 asymmetry — hitPoints never read); NPC row missing currentHp falls back ?? maxHp', async () => {
    // Arm A — player: runtime 50 beats snapshot 150 (kills M9 isPlayer flip:
    // the NPC read of the same snapshot would take the 12d12 arm).
    const summary = makeSummary({ name: 'TestWizard', type: 'player', maxHp: 200, currentHp: 150 });
    getCombatContext.mockResolvedValue(summary);
    getRuntimeValue.mockImplementation((char, key) => (key === 'currentHitPoints' ? 50 : undefined));

    await applyPowerWordKillToTarget('TestWizard', caster, CAMPAIGN);

    expect(vi.mocked(applyDamageToTarget).mock.calls).toEqual([[summary, 'TestWizard', 50, ['Psychic'], { campaignName: CAMPAIGN, characters: [], ignoreResistance: false, attackerName: 'TestWizard' }]]);
    const log = hpChangeTuples()[0][1];
    // maxHp :298 reads creature.maxHp from the snapshot — kill side has NO
    // runtime 'hitPoints' read (heal :267 does; asymmetry cited #1481 twin).
    expect(log).toEqual({
      type: 'hp_change', targetName: 'TestWizard', delta: -50, currentHp: 0, maxHp: 200,
      isHealing: false, isUnconscious: false, threshold: 'dead', note: 'Power Word Kill',
    });
    // Read census: exactly one key, arity 2 vs REAL getRuntimeValue usage.
    expect(vi.mocked(getRuntimeValue).mock.calls).toEqual([['TestWizard', 'currentHitPoints']]);

    // Arm B — NPC currentHp absent: `creature.currentHp ?? creature.maxHp`
    // (:290) treats a missing row value as full HP: 90 <= 100 -> kill arm.
    vi.clearAllMocks();
    const noHpRow = makeSummary({ name: 'Ogre', maxHp: 90 });
    getCombatContext.mockResolvedValue(noHpRow);

    await applyPowerWordKillToTarget('Ogre', caster, CAMPAIGN);

    expect(vi.mocked(applyDamageToTarget).mock.calls[0][2]).toBe(90);
    expect(hpChangeTuples()[0][1].threshold).toBe('dead');
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('QUIRK :296 `-(currentHp || creature.maxHp)`: an already-dead (currentHp 0) NPC logs delta -maxHp while forwarding damage 0 — log/write divergence; a rejected fire-and-forget addEntry swallows to console "[spellCast] Error:" and the kill proceeds', async () => {
    // :296 `||` fallback on currentHp=0 (the death state itself) logs
    // delta:-80 though :305 forwards 0 damage (#1481 fallback-chain form).
    const dead = makeSummary({ name: 'Goblin', maxHp: 80, currentHp: 0 });
    getCombatContext.mockResolvedValue(dead);

    await applyPowerWordKillToTarget('Goblin', caster, CAMPAIGN);

    expect(hpChangeTuples()).toEqual([[CAMPAIGN, {
      type: 'hp_change', targetName: 'Goblin', delta: -80, currentHp: 0, maxHp: 80,
      isHealing: false, isUnconscious: false, threshold: 'dead', note: 'Power Word Kill',
    }]]);
    expect(vi.mocked(applyDamageToTarget).mock.calls[0][2]).toBe(0);

    // Fire-and-forget log rejection (:303): swallowed to console.error with
    // exact bytes; the damage write is unaffected.
    vi.clearAllMocks();
    const err = new Error('log down');
    addEntry.mockImplementation(() => Promise.reject(err));
    const deadAgain = makeSummary({ name: 'Goblin', maxHp: 80, currentHp: 0 });
    getCombatContext.mockResolvedValue(deadAgain);

    await expect(applyPowerWordKillToTarget('Goblin', caster, CAMPAIGN)).resolves.toBeUndefined();
    await Promise.resolve(); // flush the rejected addEntry microtask
    await Promise.resolve();

    expect(consoleError).toHaveBeenCalledWith('[spellCast] Error:', err);
    expect(vi.mocked(applyDamageToTarget).mock.calls).toHaveLength(1);
  });

  it('abort guards (:282, :285): null combat context or absent creature row produce an identical full no-op — one fetch, zero runtime reads, zero damage, zero logs, zero popups, resolves undefined', async () => {
    // Guard 1 — :282 null summary.
    getCombatContext.mockResolvedValue(null);
    await expect(applyPowerWordKillToTarget('Goblin', caster, CAMPAIGN)).resolves.toBeUndefined();
    expect(vi.mocked(getCombatContext).mock.calls).toEqual([[CAMPAIGN]]);
    expectFullNoOp();

    // Guard 2 — :285 creature absent from a healthy snapshot.
    vi.clearAllMocks();
    getCombatContext.mockResolvedValue(makeSummary({ name: 'Other', maxHp: 50, currentHp: 50 }));
    await expect(applyPowerWordKillToTarget('Goblin', caster, CAMPAIGN)).resolves.toBeUndefined();
    expect(vi.mocked(getCombatContext).mock.calls).toEqual([[CAMPAIGN]]);
    expectFullNoOp();
  });

  it('CLA-392 shared-snapshot short-circuit (:281): a supplied combatSummary skips getCombatContext entirely and is forwarded by identity; REAL signature arity is 4 (the 5e-modal dispatch of #1471/#1478 passes exactly this)', async () => {
    const shared = makeSummary(GOBLIN_80);

    await applyPowerWordKillToTarget('Goblin', caster, CAMPAIGN, shared);

    expect(vi.mocked(getCombatContext).mock.calls).toEqual([]);
    expect(vi.mocked(applyDamageToTarget).mock.calls[0][0]).toBe(shared);
    expect(applyPowerWordKillToTarget.length).toBe(4);
  });

  it('#1482 5e disk law: >100 HP takes NO damage, NO roll, NO popup — "Otherwise, the spell has no effect" (spells.json:7588); loud ability_use no-effect log', async () => {
    // Pre-fix capture (#1482): the unfixed span applied 12d12 Psychic here for
    // BOTH rulesets — damage the 5e law does not grant. This pin goes GREEN
    // only with the ruleset branch (house selector fix#98: playerStats.rules).
    const caster5e = { name: 'TestWizard', rules: '5e' };
    const over = makeSummary({ name: 'Ogre', maxHp: 200, currentHp: 101 });
    getCombatContext.mockResolvedValue(over);

    await applyPowerWordKillToTarget('Ogre', caster5e, CAMPAIGN);

    // No dice, no damage write, no popup, no hp_change — pure no-effect.
    expect(vi.mocked(rollExpression).mock.calls).toEqual([]);
    expect(vi.mocked(applyDamageToTarget).mock.calls).toEqual([]);
    expect(popups).toEqual([]);
    expect(hpChangeTuples()).toEqual([]);
    // Loud per AGENTS.md (every automation logs): exact no-effect census.
    expect(vi.mocked(addEntry).mock.calls).toEqual([[CAMPAIGN, {
      type: 'ability_use', characterName: 'TestWizard', abilityName: 'Power Word Kill',
      description: 'Power Word Kill on Ogre: target has 101 hit points (more than 100) — the spell has no effect.',
    }]]);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('#1482 ruleset divergence: unset rules defaults to 5e no-effect while 2024 caster at the SAME 101 HP takes the full 12d12 arm (2024 spells.json:10210); <=100 kill arm stays ruleset-independent', async () => {
    // Arm A — unset rules caster (rulesFactory defaults '5e'): no effect at 101.
    const overA = makeSummary({ name: 'Ogre', maxHp: 200, currentHp: 101 });
    getCombatContext.mockResolvedValue(overA);
    const casterUnset = { name: 'TestWizard' };

    await applyPowerWordKillToTarget('Ogre', casterUnset, CAMPAIGN);

    expect(vi.mocked(applyDamageToTarget).mock.calls).toEqual([]);
    expect(vi.mocked(rollExpression).mock.calls).toEqual([]);

    // Arm B — 2024 caster, identical 101 HP: fallback IS lawful 2024 text
    // ("Otherwise, it takes 12d12 Psychic damage.").
    vi.clearAllMocks();
    popups = [];
    getCombatContext.mockResolvedValue(overA);
    const caster2024 = { name: 'TestWizard', rules: '2024' };

    await applyPowerWordKillToTarget('Ogre', caster2024, CAMPAIGN);

    expect(vi.mocked(rollExpression).mock.calls).toEqual([['12d12']]);
    expect(vi.mocked(applyDamageToTarget).mock.calls).toEqual([[overA, 'Ogre', 5, ['Psychic'], { campaignName: CAMPAIGN, characters: [], ignoreResistance: false, attackerName: 'TestWizard' }]]);
    expect(popups[0].popupText).toBe('Ogre took 5 Psychic damage (too healthy to kill)');

    // Arm C — the <=100 kill arm never consults rules: 5e caster at 100 dies.
    vi.clearAllMocks();
    popups = [];
    const at100 = makeSummary({ name: 'Knight', maxHp: 100, currentHp: 100 });
    getCombatContext.mockResolvedValue(at100);

    await applyPowerWordKillToTarget('Knight', { name: 'TestWizard', rules: '5e' }, CAMPAIGN);

    expect(vi.mocked(applyDamageToTarget).mock.calls[0][2]).toBe(100);
    expect(hpChangeTuples()[0][1].threshold).toBe('dead');
    expect(popups[0].popupText).toBe('Knight was slain by Power Word Kill');
  });
});

/** Complete no-op census shared by both abort guards (heal-lane twin form). */
function expectFullNoOp() {
  expect(vi.mocked(getRuntimeValue).mock.calls).toEqual([]);
  expect(vi.mocked(applyDamageToTarget).mock.calls).toEqual([]);
  expect(vi.mocked(rollExpression).mock.calls).toEqual([]);
  expect(vi.mocked(addEntry).mock.calls).toEqual([]);
  expect(popups).toEqual([]);
}
