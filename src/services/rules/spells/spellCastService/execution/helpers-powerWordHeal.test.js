// @maintained-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/* ------------------------------------------------------------------ */
/*  helpers.js PWH span (:190-:275) — module-direct execution face. */
/*                                                                    */
/*  Mocks: the canonical 13-module helpers-dependency roster, byte- */
/*  for-byte with sibling helpers lanes (#1478/79/80 family canon — */
/*  consumers mock ./helpers.js wholesale, this lane runs it REAL). */
/*                                                                    */
/*  Boundary (cited, never re-grown):                               */
/*  - earlyReturns-modal #1471 owns the index.js:702 EARLY arm —   */
/*    name-gate, declined/passThrough envelopes, :702-before-:703   */
/*    arm order. This lane owns what executes AFTER that arm        */
/*    routes here: applyPowerWordHealToTarget -> powerWordHealDamage*/
/*    -> powerWordHealConditions.                                   */
/*  - spellCastService.heal.test.js #1454 owns hub traversal:      */
/*    CLA-392 shared snapshot (:259 short-circuit pinned there as  */
/*    getCombatContext-times-1), runtime-HP-beats-snapshot via the */
/*    chain, healing-popup consume-trail payload (#1392), producer- */
/*    null fold-back (:195) via hub. Hub generic delta-0 log       */
/*    contrast (heal.test.js:290) vs this helper's silent-0 skip is */
/*    pinned below on the direct face.                             */
/*  - spellCastService.powerWordHeal.test.js owns hub edge cases   */
/*    incl. multiTarget-equals-first dedup; modalSpells.powerWord   */
/*    Spread owns the CLA-392 spread gate with an injected fake.   */
/*  - Kill-side tiers are helpers-powerWordKill #1478 lane. This   */
/*    heal span has NO HP-threshold tiers and rolls NO dice:       */
/*    REAL 2024 disk row (absent from 5e disk, #1450) reads "the   */
/*    target regains all its Hit Points" + ends Charmed/Frightened/*/
/*    Paralyzed/Poisoned/Stunned + Prone stand-by-Reaction — the   */
/*    gap-to-max + strip + permission bytes pinned here. Hub       */
/*    compute/clamp family #1455 cited.                            */
/*  - No-clock: heal is instantaneous; sinks carry only the fixed- */
/*    Date.now timestamp (spied below for determinism).             */
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

import { applyPowerWordHealToTarget } from './helpers.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../../ui/logService.js';
import { applyHealingToTarget } from '../../../combat/applyHealing.js';
import { getCombatContext } from '../../../combat/damageUtils.js';

/* ------------------------------------------------------------------ */
/*  Determinism + fixtures                                             */
/* ------------------------------------------------------------------ */

const CAMPAIGN = 'test-campaign';
const TS = 1700000000000;

// The span consumes playerStats.name only (:204, :211) — documented
// lightweight route (#1472); no fabricated PlayerStats keys.
const caster = { name: 'TestWizard' };

const makeSummary = (creature) => ({ creatures: [creature] });
const GOBLIN_50 = { name: 'Goblin', maxHp: 100, currentHp: 50 };

let consoleError;
let popups;
const onPopup = (e) => popups.push(e.detail);

/** addEntry calls of one type, as full [campaign, entry] tuples. */
function logTuples(type) {
  return vi.mocked(addEntry).mock.calls.filter(([, e]) => e.type === type);
}

/** The exact condition-removed log payload (helpers.js:235-242). */
const condTuple = (Name) => [CAMPAIGN, {
  type: 'condition',
  action: 'removed',
  characterName: 'Goblin',
  condition: Name,
  reason: 'Power Word Heal',
  timestamp: TS,
}];

/** Per-key runtime store stub; conditions default to []. Explicit
 *  undefined/null values are honored via hasOwnProperty (SP-002 arm). */
function stubRuntime(overrides = {}) {
  getRuntimeValue.mockImplementation((char, key) => {
    if (Object.prototype.hasOwnProperty.call(overrides, key)) return overrides[key];
    if (key === 'activeConditions') return [];
    return undefined;
  });
}

/* ------------------------------------------------------------------ */
/*  Tests                                                            */
/* ------------------------------------------------------------------ */

describe('helpers.js applyPowerWordHealToTarget — module-direct PWH span (:190-:275)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(TS);
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    popups = [];
    window.addEventListener('healing-popup', onPopup);
    setRuntimeValue.mockResolvedValue(undefined);
    stubRuntime();
    getCombatContext.mockResolvedValue(makeSummary(GOBLIN_50));
    applyHealingToTarget.mockReturnValue({ actualHeal: 50, oldHp: 50, newHp: 100 });
  });

  afterEach(() => {
    window.removeEventListener('healing-popup', onPopup);
    consoleError.mockRestore();
    vi.restoreAllMocks();
  });

  it('snapshot-HP target: exact 4-arg forward tuple; producer actualHeal folds into clamped hp_change log and popup; quiet console', async () => {
    const summary = makeSummary(GOBLIN_50);
    getCombatContext.mockResolvedValue(summary);
    // Producer over-reports vs the 50 gap — pins the :196 defensive
    // clamp-to-maxHp doc arm (dead-only-in-practice; #1455 hub clamp cited).
    applyHealingToTarget.mockReturnValue({ actualHeal: 80, oldHp: 50, newHp: 130 });

    await applyPowerWordHealToTarget('Goblin', caster, CAMPAIGN);

    // Forward: fetched snapshot identity + computed gap-to-max (no tiers,
    // no dice — disk-row bytes above), arity 4 vs REAL signature.
    expect(vi.mocked(applyHealingToTarget).mock.calls).toEqual([[summary, 'Goblin', 50, CAMPAIGN]]);
    // Fold-back (:195) + clamp (:196) into the exact hp_change byte census.
    expect(logTuples('hp_change')).toEqual([[CAMPAIGN, {
      type: 'hp_change', targetName: 'Goblin', delta: 80, currentHp: 100, maxHp: 100,
      isHealing: true, sourceName: 'TestWizard', note: 'Power Word Heal', timestamp: TS,
    }]]);
    // Empty stored conditions -> zero condition writes/logs; no prone -> no permission.
    expect(vi.mocked(addEntry).mock.calls).toHaveLength(1);
    expect(vi.mocked(setRuntimeValue).mock.calls).toEqual([]);
    // Popup payload also owned via hub by #1454/#1392 — direct-face fold-back sink pin.
    expect(popups).toEqual([{
      targetName: 'Goblin', sourceName: 'TestWizard', healingName: 'Power Word Heal',
      rollInfo: '', maximizeHealingDice: false, popupText: 'Power Word Heal on Goblin: Regained 80 HP',
    }]);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('player-type target: runtime hitPoints/currentHitPoints beat snapshot HP; null producer return folds to computed gap (:195, :267-:270)', async () => {
    const summary = makeSummary({ name: 'TestWizard', type: 'player', maxHp: 99, currentHp: 99 });
    getCombatContext.mockResolvedValue(summary);
    // hitPoints 110 BEATS snapshot max 99 (:267); currentHitPoints 30 beats
    // snapshot 99 (:270). Forward = gap 80; log clamps to runtime max.
    stubRuntime({ currentHitPoints: 30, hitPoints: 110 });
    applyHealingToTarget.mockReturnValue(null); // fold-back to computed 80 (#1454 hub-face twin)

    await applyPowerWordHealToTarget('TestWizard', caster, CAMPAIGN);

    expect(vi.mocked(applyHealingToTarget).mock.calls).toEqual([[summary, 'TestWizard', 80, CAMPAIGN]]);
    expect(logTuples('hp_change')).toEqual([[CAMPAIGN, {
      type: 'hp_change', targetName: 'TestWizard', delta: 80, currentHp: 110, maxHp: 110,
      isHealing: true, sourceName: 'TestWizard', note: 'Power Word Heal', timestamp: TS,
    }]]);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('case-insensitive strip leaves PRONE; exact full addEntry census (fix#337S flipped the phantom-over-log quirk — all five were stored, so all five are named truthfully); heal precedes condition writes', async () => {
    stubRuntime({ activeConditions: ['CHARMED', 'Frightened', 'PARALYZED', 'Poisoned', 'Stunned', 'PRONE'] });

    await applyPowerWordHealToTarget('Goblin', caster, CAMPAIGN);

    // Survivor tuple + permission write are the COMPLETE store census, in chain order.
    expect(vi.mocked(setRuntimeValue).mock.calls).toEqual([
      ['Goblin', 'activeConditions', ['PRONE'], CAMPAIGN],
      ['Goblin', 'powerWordHealStandPermission', true, CAMPAIGN],
    ]);
    // QUIRK pin FLIPPED (fix#337S #1481): :273-:286 now logs ONLY actually-stored
    // removals in candidate order — here all five WERE stored (mixed case), so the
    // census is byte-identical; the anti-phantom arm is pinned in the next test.
    expect(addEntryLogConditionNames()).toEqual(['Charmed', 'Frightened', 'Paralyzed', 'Poisoned', 'Stunned']);
    expect(logTuples('condition')).toEqual([
      condTuple('Charmed'), condTuple('Frightened'), condTuple('Paralyzed'),
      condTuple('Poisoned'), condTuple('Stunned'),
    ]);
    // Faithful order tap (#1480 canon): damage (:194) before condition write (:232).
    expect(vi.mocked(applyHealingToTarget).mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(setRuntimeValue).mock.invocationCallOrder[0]);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('stand-permission arms: non-prone never reads the key; prone-and-already-set reads once and writes nothing', async () => {
    // Arm A — no prone: key never read, never written. SINGLE-removal
    // strip (mutant-proof :231 boundary — one stripped condition must still
    // write the survivor tuple).
    stubRuntime({ activeConditions: ['charmed'] });
    await applyPowerWordHealToTarget('Goblin', caster, CAMPAIGN);
    expect(vi.mocked(getRuntimeValue).mock.calls.filter(([, key]) => key === 'powerWordHealStandPermission')).toEqual([]);
    expect(vi.mocked(setRuntimeValue).mock.calls.filter(([, key]) => key === 'powerWordHealStandPermission')).toEqual([]);
    // Truth census (fix#337S #1481 flipped the ghost-phantom quirk): only
    // charmed was present, so ONLY Charmed is logged — four ghosts never land.
    expect(addEntryLogConditionNames()).toEqual(['Charmed']);
    expect(vi.mocked(setRuntimeValue).mock.calls).toEqual([['Goblin', 'activeConditions', [], CAMPAIGN]]);

    // Arm B — prone already permitted: read once; prone survives the strip at
    // equal length so NO activeConditions write either — complete census empty.
    vi.clearAllMocks();
    stubRuntime({ activeConditions: ['prone'], powerWordHealStandPermission: true });
    await applyPowerWordHealToTarget('Goblin', caster, CAMPAIGN);
    expect(vi.mocked(getRuntimeValue).mock.calls.filter(([, key]) => key === 'powerWordHealStandPermission'))
      .toEqual([['Goblin', 'powerWordHealStandPermission', CAMPAIGN]]);
    expect(vi.mocked(setRuntimeValue).mock.calls).toEqual([]);
  });

  it('SP-002: storedConditions null, undefined, and [] all mean nothing-to-strip — heal proceeds, zero condition writes or logs', async () => {
    for (const value of [null, undefined, []]) {
      vi.clearAllMocks();
      stubRuntime({ activeConditions: value });

      await expect(applyPowerWordHealToTarget('Goblin', caster, CAMPAIGN)).resolves.toBeUndefined();

      expect(vi.mocked(applyHealingToTarget).mock.calls).toEqual([[makeSummary(GOBLIN_50), 'Goblin', 50, CAMPAIGN]]);
      expect(vi.mocked(setRuntimeValue).mock.calls).toEqual([]);
      expect(logTuples('condition')).toEqual([]);
    }
    expect(consoleError).not.toHaveBeenCalled();
  });

  // #1481 FIX (flips the former validation-order quirk pin): activeConditions
  // validation is HOISTED above powerWordHealDamage's heal + log + popup
  // dispatch (fix#22 validate-before-mutate lineage, useAttackDamageResolution
  // :511-:514 house order). An invalid payload now refuses the WHOLE cast
  // BEFORE any HP is restored — half-applied state is structurally impossible.
  it('#1481 invalid activeConditions throws BEFORE any heal — store-dark, zero HP restored, zero popup, zero logs (validate-before-mutate)', async () => {
    stubRuntime({ activeConditions: 'not-an-array' });

    await expect(applyPowerWordHealToTarget('Goblin', caster, CAMPAIGN))
      .rejects.toThrow('activeConditions must be an array');

    expect(consoleError).toHaveBeenCalledWith('[spellCast] applyPowerWordHealToTarget: activeConditions is not an array');
    // Half-applied state proven impossible (#1517 store-dark form): the
    // throw precedes every mutation and every dispatch.
    expect(vi.mocked(applyHealingToTarget).mock.calls).toEqual([]);
    expect(logTuples('hp_change')).toEqual([]);
    expect(vi.mocked(setRuntimeValue).mock.calls).toEqual([]);
    expect(popups).toEqual([]);
    // The validation read still happens exactly once, and it is the ONLY read.
    expect(vi.mocked(getRuntimeValue).mock.calls.filter(([, key]) => key === 'activeConditions'))
      .toEqual([['Goblin', 'activeConditions', CAMPAIGN]]);
  });

  it('#1481 order ledger (valid payload): validation read < heal write < popup dispatch — dispatch bytes byte-intact', async () => {
    const ledger = [];
    stubRuntime({ activeConditions: ['charmed'] });
    const origStub = vi.mocked(getRuntimeValue).getMockImplementation();
    getRuntimeValue.mockImplementation((...args) => {
      if (args[1] === 'activeConditions') ledger.push('validate');
      return origStub(...args);
    });
    applyHealingToTarget.mockImplementation((..._args) => { ledger.push('heal'); return { actualHeal: 50, oldHp: 50, newHp: 100 }; });
    const orderListener = () => ledger.push('popup');
    window.addEventListener('healing-popup', orderListener);

    await applyPowerWordHealToTarget('Goblin', caster, CAMPAIGN);
    window.removeEventListener('healing-popup', orderListener);

    // validate-index < heal-index < popup-index (exact first-occurrence ledger).
    expect(ledger.indexOf('validate')).toBe(0);
    expect(ledger.indexOf('heal')).toBe(1);
    expect(ledger.indexOf('popup')).toBeGreaterThan(1);
    // Valid-path dispatch bytes unchanged: strip write + removal log still land.
    expect(vi.mocked(setRuntimeValue).mock.calls).toEqual([['Goblin', 'activeConditions', [], CAMPAIGN]]);
    expect(addEntryLogConditionNames()).toEqual(['Charmed']); // fix#337S #1481: only the stored condition is logged
  });

  it('abort guards: null combat context or missing target row produce an identical full no-op (zero reads, writes, logs, popups)', async () => {
    // Guard 1 — :260 combat context null.
    getCombatContext.mockResolvedValue(null);
    await applyPowerWordHealToTarget('Goblin', caster, CAMPAIGN);
    expect(vi.mocked(getCombatContext).mock.calls).toEqual([[CAMPAIGN]]);
    expectFullNoOp();

    // Guard 2 — :262-:263 creature absent from a healthy snapshot.
    vi.clearAllMocks();
    getCombatContext.mockResolvedValue(makeSummary({ name: 'Ogre', maxHp: 7, currentHp: 7 }));
    await applyPowerWordHealToTarget('Goblin', caster, CAMPAIGN);
    expect(vi.mocked(getCombatContext).mock.calls).toEqual([[CAMPAIGN]]);
    expectFullNoOp();
  });

  it('full-HP target skips the heal block entirely — no forward, no hp_change, no popup (contrast hub generic delta-0 log, heal.test.js:290) — while condition/permission handling still runs', async () => {
    getCombatContext.mockResolvedValue(makeSummary({ name: 'Goblin', maxHp: 100, currentHp: 100 }));
    stubRuntime({ activeConditions: ['prone'] });

    await applyPowerWordHealToTarget('Goblin', caster, CAMPAIGN);

    expect(vi.mocked(applyHealingToTarget)).not.toHaveBeenCalled();
    expect(vi.mocked(addEntry)).not.toHaveBeenCalled();
    expect(popups).toEqual([]);
    // Strip/permission are HP-independent (:273 early-return is damage-only):
    // prone survives (not a removal candidate -> no conditions write) but the
    // stand permission is still granted.
    expect(vi.mocked(setRuntimeValue).mock.calls).toEqual([
      ['Goblin', 'powerWordHealStandPermission', true, CAMPAIGN],
    ]);
    expect(consoleError).not.toHaveBeenCalled();
  });
});

/** Complete no-op census shared by both abort guards. */
function expectFullNoOp() {
  expect(vi.mocked(getRuntimeValue).mock.calls).toEqual([]);
  expect(vi.mocked(applyHealingToTarget)).not.toHaveBeenCalled();
  expect(vi.mocked(setRuntimeValue)).not.toHaveBeenCalled();
  expect(vi.mocked(addEntry)).not.toHaveBeenCalled();
  expect(popups).toEqual([]);
}

/** Condition-log names in dispatch order (quirk census helper). */
function addEntryLogConditionNames() {
  return vi.mocked(addEntry).mock.calls
    .filter(([, e]) => e.type === 'condition')
    .map(([, e]) => e.condition);
}
