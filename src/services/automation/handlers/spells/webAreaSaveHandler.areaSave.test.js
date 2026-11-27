// @maintained-by-ai 2026-11-27 — IMPROVE-AND-TRIM pass (#1989): 21→19 cases (failure/success legs merged into one ordered commit/log/read census per outcome with full-shape toEqual; catch trio → keyed-impl it.each, no *Once chains; gate-order exact read censuses — web runs map→already-restrained→immunity like the sleet twin, reverse of grease; honest-bytes pin: the lane HARDCODES 'STR' even though its own producer stores saveType:'DEX' — web is the only trio member whose stored-vs-issued saveType contradicts in PROD bytes; whitespace key-normalisation, save-promise reject propagation, roll-less ??0 ledger legs and console.warn pin added; resetAllMocks-safe inline-base factories; header line refs re-verified vs current bytes)
// ── webAreaSave QUINTET seam map (shared subject: webAreaSaveHandler.js) ──
// lane (this file, .areaSave) — RECURRING area-save CONTENT:
//   processWebAreaSave ONLY (+ its private callees webTargetIsImmune(:257),
//   restrainRecurringWebTarget(:268), recordWebAreaSaveSuccess(:295)). The
//   other four quintet files import handle() only; this is the ONLY quintet
//   file that imports processWebAreaSave — split verified by CONTENT against
//   current bytes 2026-11-27.
// WIRED (re-verified 2026-11-27, SP-111 Phase-5 pattern, SP-126 web):
//   expireStaleEffects.js:7 imports processWebAreaSave; :129 Phase 5 consumes
//   it via processZoneTurnStartSaves({ effectKey: 'web', trackingPrefix: 'web' })
//   at each carrier's turn-start initiative seam. The shared processSave call
//   is 5-ARG (:76): (te.source, activeName, campaignName, zoneTracking.mapName,
//   resolveTargetStats(activeName, characters)) — the roster-resolved
//   targetStats joined the call with the Option A landing (the old 4-arg claim
//   in this header was stale). In-area enumeration is consumer-side
//   (targetEffects te.target === active creature + te.effect === 'web');
//   consumer routing pinned in expireStaleEffects.web.test.js:101-124 (exact
//   5-arg call, undefined-stats monster leg, roster-threading leg, negatives).
//   grease joined the wired family 2026-11-19 (owner "WIRE IT", Phase 6) —
//   web is WIRED, like sleet (Phase 3), stinkingCloud (Phase 4) and grease.
// Family map (areaSave twins, complete after this pass):
//   saveType: grease FORWARDS tracking.saveType (greaseAreaSaveHandler.js
//   :182/:203/:235); sleet HARDCODES 'DEX'; stinkingCloud HARDCODES 'CON';
//   web HARDCODES 'STR' (:342/:289/:310) AND is the only member whose sole
//   producer stores a CONTRADICTORY byte — handle writes saveType:'DEX' into
//   _web_<caster> (:177), so the 'DEX'→'STR' contradiction is PROD-normal
//   here, not hypothetical: a forwarding implementation would silently
//   re-force the cast-time DEX save. Pinned honestly below.
//   gate ORDER: web = tracking(:320) → mapName-gated range(:324-332) →
//   already-restrained(:334-336) → awaited immunity(:338) — the sleet-twin
//   ordering (condition gate BEFORE immunity); grease runs immunity first,
//   stinkingCloud has NO already-condition gate. The exact read censuses
//   below FAIL if the lane re-orders.
//   reject contract: all three addEntry sites (:352/:292/:313) carry
//   .catch→console.error '[webAreaSave] Error:' — log rejections are
//   SWALLOWED; the awaited save promise (:354) sits OUTSIDE any try — a
//   rejected prompt PROPAGATES out of the lane (sleet/stinkingCloud twins;
//   the grease twin swallows to null — family divergence, pinned honestly).
//   popup: composed INLINE at :362-369, NOT via spellNoticePopup (that
//   helper is handle-lane only: :151/:158/:245). Prose uses display-case
//   'Restrained' (:291/:367) while the stored condition byte is lowercase
//   'restrained' (:272); the skip/filter guards are case-insensitive
//   (:271/:335 String(c).toLowerCase()).
// RAW check (verified honestly against webAreaSaveHandler.js current bytes):
//   2024 Essentials Web — 60-ft range, 20-ft cube, Concentration ≤ 1 hour.
//   Cast-time: DEX save per creature in area (:210-239), Restrained on fail
//   (:88-142). Recurring (this lane): STR save at each turn start while the
//   zone persists, Restrained on fail; already-Restrained creatures SKIP the
//   recurring save (:334-336) — breaking free via a STR (Athletics) ACTION is
//   GM-adjudicated (source :23-24), NOT the recurring save. NO fire
//   mechanics implemented (flammability / 2d4 burn-away is an accepted source
//   gap, source :27-29) — no burn tests written. NO damage anywhere in the
//   module: appliedDamage: 0 on every addTargetResult (:40, :112, :280, :302).
// Siblings (exact split by filename-content, canonical homes decided at source):
//   #1990 .edgeCases — handle() guards/odd shapes: existing-restrained refresh,
//     empty selected-name matches, null combatSummary, missing spellAbilities/
//     proficiency fallback DCs, missing action.automation, roll-less saveResult
//     ON THE CAST LANE (the recurring lane's roll-less ??0 ledger legs are
//     owned here — #1990 imports handle() only).
//   #1991 .errors     — handle() console.error catch legs ([web] prefix). The
//     identically named catches here are a DIFFERENT source site with the
//     '[webAreaSave] Error:' recurring-lane prefix.
//   #1992 .test (main)— handle() cast orchestration: combat-context gate,
//     target selection, buildSaveDc, heightenTarget disadvantage, Restrained
//     apply + activeConditionMeta, expiration registrations, storeSpellLastAttack.
//   #1993 .zone      — handle() zone registration/tracking store: exact
//     `_web_<caster>` key content (incl. the saveType:'DEX' byte this lane
//     contradicts), web zone te for EVERY target, ONE merged 600-round zone
//     expiration, registry 'web' definition, no-racing double-write guard.
//     Also owns the handle-lane 2-arg getRuntimeValue('campaign',
//     'targetEffects') read (:55).
//   this file       — recurring turn-start STR-save lane, all pins below
//   index.webDispatch.test.js (#1999) owns trio dispatch — not re-pinned here.
// Liveness of handle(): automation/index.js:271 import, :557 dispatches
//   'web_area_save' → handle (grep-verified); fired by
//   useSimpleSpellHandlers.js:372 areaExecute('web_area_save','DEX').
// Arity (per #1878): every getRuntimeValue CALL this lane makes is 3-arg in
//   source bytes (:318 tracking, :334/:269 activeConditions) while the real
//   getRuntimeValue is 2-param (useRuntimeState.js:63 — read-side campaignName
//   is inert) — censuses below match the source calls, not the signature.
//   setRuntimeValue writes ARE 4-arg with campaignName threaded (write-side
//   threading is real). getCombatContext is awaited 1-arg (:258).
// Duration policy: this lane reads NO duration/expiry bytes — tracking
//   .duration/.timestamp/.mapName/.campaignName/.caster are carried in the
//   fixtures below and never forwarded (request objects pin the exact 3-key
//   shape). handle-lane parseWebDurationRounds (:77-86) produces hours×600
//   (:80) AND a minutes×10 branch (:81-82) — correcting this header's old
//   "only hours×600" claim; both are handle-lane content (#1992/#1993),
//   where the minutes×10 predates the ≥1min-combat-scoped canon and should
//   cite the #1822 precedent.
// No timers (guard:no-timers compliant): this lane has zero setTimeout/
//   setInterval/Date.now — recurring log rows carry NO timestamp field, so no
//   Date.now freeze is needed (handle-lane Date.now lives at :129/:179).
// Lane-delta NO-side-effect guards vs handle lane (positive pins in #1992/
//   #1993): this lane never writes targetEffects, never calls
//   addExpiration/storeSpellLastAttack/registerSpellConcentration/buildSaveDc,
//   never reads or writes activeConditionMeta (restrainRecurringWebTarget
//   omits it; cast lane :96-104 owns it) — pinned by the exact read/write
//   censuses in the outcome tests below.
// Flags (reported, not silently kept):
//   • PRODUCTION DEFECT FIXED 2026-11-23 (await census finale, same class as
//     sleetStorm's old un-awaited getCombatContext): webTargetIsImmune called
//     async getCombatContext WITHOUT await → ?.creatures undefined in prod →
//     the player-immunity branch was UNREACHABLE — immune PCs took Restrained
//     from the recurring zone save (live-witnessed pre-fix). The predicate is
//     now async + awaited at the single caller (:338), mirroring the grease
//     twin, AND — per the Option A landing (bug-zone-save-computedstats-bucket-
//     has-no-producer, 2026-11-23, which RETIRES the same-day bucket-read
//     canonicalization) — the roster-resolved targetStats PARAMETER is passed
//     to playerIsImmuneToCondition AS the stats object (the runtime
//     `computedStats` bucket had NO producer; its read is deleted). Pins below
//     exercise the async contract.
//   • accepted source gaps (no consumers in this engine, source :27-29):
//     Difficult Terrain / Lightly Obscured prose, STR (Athletics) break-free
//     modal, anchoring/collapse, flammability / 2d4 fire / burn-away.
// Mock rationale: savePrompt factory carries buildSaveDc for import-graph
//   honesty only — the recurring lane never calls it (handle-lane only); the
//   damageRollback factory likewise omits nothing but storeSpellLastAttack is
//   never called here. expirations.js is mocked for import-side-effect
//   isolation + the lane-delta addExpiration-not-called pin. areaSpellUtils
//   and targetEffectDefinitions stay REAL (import-graph-only for this lane —
//   the recurring popup is composed inline). Mock factories carry BASE
//   implementations inline (vi.fn(async…)) so they survive vi.resetAllMocks()
//   — no *Once chains, no mid-test re-harness beyond the exact-key runtime
//   router.
// ──────────────────────────────────────────────────────────────────────────────
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(), // import-graph only — the recurring lane never calls it
  createSaveListener: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(async () => ({})),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

// Import-side-effect isolation only — the recurring lane never registers expirations.
vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(async () => {}),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn(async () => true),
}));

vi.mock('../../../combat/automation/automationImmunities.js', () => ({
  playerIsImmuneToCondition: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
  storeSpellLastAttack: vi.fn(), // handle-lane only — never called here
  addTargetResult: vi.fn(async () => ({})),
}));

// ── Imports ────────────────────────────────────────────────────

import { processWebAreaSave } from './webAreaSaveHandler.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as logService from '../../../ui/logService.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as rangeCheck from '../../../rules/combat/rangeCheck.js';
import * as automationImmunities from '../../../combat/automation/automationImmunities.js';
import * as damageRollback from '../../common/damageRollback.js';

// ── Constants & Helpers ────────────────────────────────────────

const campaignName = 'test-campaign';
const casterName = 'TestCaster';
const targetName = 'Goblin';
const mapName = 'test-map';

// Reader mirrors the writer's key normalisation (handle stores
// `_web_${caster.replace(/\s+/g,'_')}` at :171): 'Weird  Caster' → _web_Weird_Caster
const trackingKeyFor = (caster) => `_web_${caster.replace(/\s+/g, '_')}`;
const TRACKING_KEY = trackingKeyFor(casterName);

// HONEST producer shape (handle :172-181 writes EVERY key below, including
// the saveType:'DEX' byte this lane contradicts with its hardcoded 'STR').
function makeTracking(overrides = {}) {
  return {
    caster: casterName,
    mapName,
    campaignName,
    saveDc: 15,
    saveType: 'DEX',
    radius: 20, // 20-foot cube
    timestamp: 1700000000000,
    duration: 'Concentration, up to 1 hour',
    ...overrides,
  };
}

// Exact-key runtime router. NOTE (Option A landing): there is NO
// `computedStats` bucket key any more — the immunity gate receives the
// roster-resolved stats as the targetStats PARAMETER
// (bug-zone-save-computedstats-bucket-has-no-producer).
function routeRuntime({ caster = casterName, activeConditions = [], tracking = makeTracking() } = {}) {
  const trackingKey = trackingKeyFor(caster);
  useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
    if (key === trackingKey) return tracking;
    if (key === 'activeConditions') return activeConditions;
    return null;
  });
}

// getCombatContext in the ASYNC contract (production shape, per the 2026-11-23
// await-fix): a dropped await in webTargetIsImmune leaves ?.creatures
// undefined → the immunity call never happens → the immune-skip pins fail.
function monsterContext(name = targetName) {
  damageUtils.getCombatContext.mockResolvedValue({
    creatures: [{ name, type: 'monster' }],
    players: [{ name: casterName }],
  });
}

function playerContext(name = targetName) {
  damageUtils.getCombatContext.mockResolvedValue({
    creatures: [{ name, type: 'player' }],
    players: [{ name: casterName }],
  });
}

function mockSave(success, { roll, total, promptId = `web-pws-${success ? 'ok' : 'fail'}` } = {}) {
  const outcome = success
    ? { success: true, roll: roll ?? 14, total: total ?? 14 }
    : { success: false, roll: roll ?? 8, total: total ?? 8 };
  savePrompt.createSaveListener.mockReturnValue({ promptId, promise: Promise.resolve(outcome) });
}

// Happy-path base: in-area monster, valid tracking, save resolves `success`.
function setupAreaSave(success = false) {
  routeRuntime();
  monsterContext();
  mockSave(success);
}

// ── Tests: processWebAreaSave ──────────────────────────────────

describe('webAreaSaveHandler.processWebAreaSave', () => {
  beforeEach(() => {
    vi.resetAllMocks(); // factories carry inline base impls — nothing to reinstall
  });

  describe('tracking guards', () => {
    it('returns null for missing or saveDc-less tracking, reading ONLY the tracking key', async () => {
      routeRuntime({ tracking: null });
      expect(await processWebAreaSave(casterName, targetName, campaignName, mapName)).toBeNull();

      routeRuntime({ tracking: { caster: casterName } }); // no saveDc
      expect(await processWebAreaSave(casterName, targetName, campaignName, mapName)).toBeNull();

      // both guard legs: read census is the tracking read ONLY (:318, 3-arg) —
      // no later channel (range, conditions, context, prompt, log, write) touched
      expect(useRuntimeState.getRuntimeValue.mock.calls).toEqual([
        [casterName, TRACKING_KEY, campaignName],
        [casterName, TRACKING_KEY, campaignName],
      ]);
      expect(rangeCheck.isWithinRange).not.toHaveBeenCalled();
      expect(damageUtils.getCombatContext).not.toHaveBeenCalled();
      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
      expect(logService.addEntry).not.toHaveBeenCalled();
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('skip gates (gate-order read censuses)', () => {
    // Web order is map → already-restrained → immunity (the sleet twin's
    // order; the grease twin runs immunity BEFORE the condition gate):
    // each exact read census FAILS on re-ordering.
    it.each([
      {
        title: 'already Restrained (lowercase stored byte)',
        activeConditions: ['restrained'],
        expectReads: [
          [casterName, TRACKING_KEY, campaignName],
          [targetName, 'activeConditions', campaignName],
        ],
      },
      {
        title: 'already Restrained (mixed-case prose byte — :335 lowercases)',
        activeConditions: ['Restrained'],
        expectReads: [
          [casterName, TRACKING_KEY, campaignName],
          [targetName, 'activeConditions', campaignName],
        ],
      },
      {
        title: 'outside the tracked radius',
        activeConditions: [],
        outOfRange: true,
        expectReads: [[casterName, TRACKING_KEY, campaignName]], // restrained read never reached — range gate is FIRST
      },
      {
        title: 'an immune player — gate receives the PASSED roster stats verbatim',
        activeConditions: [],
        immunePlayer: true,
        expectReads: [
          [casterName, TRACKING_KEY, campaignName],
          [targetName, 'activeConditions', campaignName],
        ], // restrained read precedes the immunity gate (web = sleet order)
      },
    ])('skips the save entirely when the target is $title — zero spends', async (c) => {
      const rosterStats = { name: targetName, immunities: ['restrained'] };
      routeRuntime({ activeConditions: c.activeConditions });
      if (c.immunePlayer) {
        playerContext();
        automationImmunities.playerIsImmuneToCondition.mockReturnValue(true);
      } else {
        monsterContext();
      }
      if (c.outOfRange) rangeCheck.isWithinRange.mockResolvedValue(false);

      expect(await processWebAreaSave(casterName, targetName, campaignName, mapName, rosterStats)).toBeNull();

      // exact-array read census: nothing after the firing gate is read;
      // all reads 3-arg in source bytes; the deleted computedStats bucket
      // never appears
      expect(useRuntimeState.getRuntimeValue.mock.calls).toEqual(c.expectReads);
      expect(useRuntimeState.getRuntimeValue.mock.calls.every(([, , campaign]) => campaign === campaignName)).toBe(true);
      expect(useRuntimeState.getRuntimeValue.mock.calls.every(([, key]) => key !== 'computedStats')).toBe(true);
      // gate ORDER: the range check is FIRST on all four skip legs (the
      // out-of-radius case fires the gate by answering false — call #1 — at
      // the stored radius byte)
      expect(rangeCheck.isWithinRange).toHaveBeenCalledTimes(1);
      expect(rangeCheck.isWithinRange).toHaveBeenCalledWith(casterName, targetName, 20);
      if (c.immunePlayer) {
        // awaited async context (:258) + the param IS the stats object the
        // gate reads — passed directly, never re-wrapped under a
        // computedStats key
        expect(damageUtils.getCombatContext).toHaveBeenCalledWith(campaignName);
        expect(automationImmunities.playerIsImmuneToCondition).toHaveBeenCalledWith({
          conditionKey: 'restrained',
          playerStats: rosterStats,
          getRuntimeValue: expect.any(Function),
          campaignName,
        });
      } else {
        // out-of-range never fetches the immunity context; already-restrained
        // returns BEFORE the context fetch (restrained gate sits ahead of it)
        expect(damageUtils.getCombatContext).not.toHaveBeenCalled();
        expect(automationImmunities.playerIsImmuneToCondition).not.toHaveBeenCalled();
      }
      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
      expect(logService.addEntry).not.toHaveBeenCalled();
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('range gate legs', () => {
    it('skips the range check when mapName is null and proceeds with the save', async () => {
      setupAreaSave(true);

      const result = await processWebAreaSave(casterName, targetName, campaignName, null);

      expect(result.type).toBe('popup');
      expect(rangeCheck.isWithinRange).not.toHaveBeenCalled();
      expect(savePrompt.createSaveListener).toHaveBeenCalledTimes(1);
    });

    it('proceeds with the save when isWithinRange throws (fail-open with console.warn)', async () => {
      routeRuntime();
      monsterContext();
      rangeCheck.isWithinRange.mockRejectedValue(new Error('Map error'));
      mockSave(true);
      const consoleWarn = vi.spyOn(console, 'warn').mockReturnValue();

      const result = await processWebAreaSave(casterName, targetName, campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(savePrompt.createSaveListener).toHaveBeenCalledTimes(1);
      expect(consoleWarn).toHaveBeenCalledWith(
        '[webAreaSaveHandler] Map data unavailable, proceeding with save:',
        expect.any(Error),
      );
      consoleWarn.mockRestore();
    });
  });

  describe('immunity contract (awaited async context)', () => {
    it.each([
      ['roster-resolved stats', { name: targetName, immunities: [] }],
      ['absent roster target (undefined stats → the rule guard answers false)', undefined],
    ])('non-immune player with %s proceeds to the save — gate receives the param verbatim', async (_case, stats) => {
      routeRuntime();
      playerContext();
      automationImmunities.playerIsImmuneToCondition.mockReturnValue(false);
      mockSave(false);

      const result = await processWebAreaSave(casterName, targetName, campaignName, mapName, stats);

      expect(result.type).toBe('popup');
      expect(automationImmunities.playerIsImmuneToCondition).toHaveBeenCalledWith({
        conditionKey: 'restrained',
        playerStats: stats,
        getRuntimeValue: expect.any(Function),
        campaignName,
      });
      expect(savePrompt.createSaveListener).toHaveBeenCalledTimes(1);
    });

    it('immunity leg is player-only: monster row with an immunity-carrying stats arg still saves', async () => {
      // Awaited contract + defect-incompatible: the resolved MONSTER row keeps
      // the check out EVEN with the gate mock answering true (lookup by cs-row
      // TYPE, never by the passed stats).
      routeRuntime();
      monsterContext();
      automationImmunities.playerIsImmuneToCondition.mockReturnValue(true);
      mockSave(true);

      const result = await processWebAreaSave(casterName, targetName, campaignName, mapName, { name: targetName, immunities: ['restrained'] });

      expect(result.type).toBe('popup');
      expect(automationImmunities.playerIsImmuneToCondition).not.toHaveBeenCalled();
      expect(savePrompt.createSaveListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('save outcome sequences (ordered commit/log/read censuses)', () => {
    it('failed save — exact STR request (contradicts stored DEX byte), promptId-paired log census, condition write preserving others, ledger, popup, lane-delta zero', async () => {
      routeRuntime({ activeConditions: ['blinded'] }); // filter/append leg: preserve + append once
      monsterContext();
      mockSave(false, { roll: 8, total: 8, promptId: 'web-pws-fail' });

      const result = await processWebAreaSave(casterName, targetName, campaignName, null);

      // re-forced at the turn-start seam: HARDCODED 'STR' at the tracked DC
      // even though the fixture's stored saveType byte is 'DEX' (what handle
      // :177 actually writes) — a saveType-forwarding read would issue DEX.
      // Exact request keys: tracking extras (radius/duration/timestamp/
      // mapName/campaignName/caster) are never forwarded.
      expect(savePrompt.createSaveListener).toHaveBeenCalledTimes(1);
      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName,
        saveType: 'STR',
        saveDc: 15,
      });

      // reads: tracking, then activeConditions read by the skip gate (:334)
      // AND re-read by the commit callee (:269) — ONLY these keys (no
      // activeConditionMeta, no targetEffects, 3-arg each —
      // restrainRecurringWebTarget omits the cast-lane meta write :96-104)
      expect(useRuntimeState.getRuntimeValue.mock.calls).toEqual([
        [casterName, TRACKING_KEY, campaignName],
        [targetName, 'activeConditions', campaignName],
        [targetName, 'activeConditions', campaignName],
      ]);
      // writes: exactly ONE, 4-arg campaignName-threaded, lowercase 'restrained'
      // byte appended after the preserved 'blinded' (prose rows say
      // 'Restrained', the store never does)
      expect(useRuntimeState.setRuntimeValue.mock.calls).toEqual([
        [targetName, 'activeConditions', ['blinded', 'restrained'], campaignName],
      ]);

      // rollback ledger: exact failure shape, zero damage (module deals none)
      expect(damageRollback.addTargetResult).toHaveBeenCalledTimes(1);
      expect(damageRollback.addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName,
        saveResult: 'failure',
        roll: 8,
        total: 8,
        conditions: ['restrained'],
        appliedDamage: 0,
      });

      // own-composition full-string log census, exact 2-entry array in commit
      // order: promptId-paired ability_use BEFORE the awaited save_result row
      expect(logService.addEntry.mock.calls).toEqual([
        [campaignName, {
          type: 'ability_use',
          characterName: casterName,
          abilityName: 'Web',
          description: 'Goblin must make a STR save (DC 15) or become Restrained (Web area).',
          promptId: 'web-pws-fail',
        }],
        [campaignName, {
          type: 'save_result',
          characterName: casterName,
          rollType: 'save-web',
          targetName,
          saveDc: 15,
          saveType: 'STR',
          success: false,
          description: 'Goblin failed STR save against Web. Becomes Restrained.',
        }],
      ]);

      // popup composed INLINE (:362-369), not via spellNoticePopup
      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Web',
          description: 'Goblin failed the STR save (DC 15). Becomes Restrained.',
        },
      });

      // lane-delta vs handle lane (#1992/#1993 own the positives)
      expect(expirations.addExpiration).not.toHaveBeenCalled();
      expect(damageRollback.storeSpellLastAttack).not.toHaveBeenCalled();
    });

    it('successful save — exact ledger/log census, ZERO condition writes, full popup shape', async () => {
      setupAreaSave(true); // monster, roll 14

      const result = await processWebAreaSave(casterName, targetName, campaignName, null);

      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName,
        saveType: 'STR',
        saveDc: 15,
      });
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled(); // success commits nothing
      expect(damageRollback.addTargetResult).toHaveBeenCalledTimes(1);
      expect(damageRollback.addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName,
        saveResult: 'success',
        roll: 14,
        total: 14,
        conditions: [],
        appliedDamage: 0,
      });
      expect(logService.addEntry.mock.calls).toEqual([
        [campaignName, expect.objectContaining({
          type: 'ability_use',
          abilityName: 'Web',
          description: 'Goblin must make a STR save (DC 15) or become Restrained (Web area).',
          promptId: 'web-pws-ok',
        })],
        [campaignName, {
          type: 'save_result',
          characterName: casterName,
          rollType: 'save-web',
          targetName,
          saveDc: 15,
          saveType: 'STR',
          success: true,
          description: 'Goblin succeeded on STR save against Web.',
        }],
      ]);
      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Web',
          description: 'Goblin succeeded the STR save (DC 15). Unaffected.',
        },
      });
    });

    it.each([
      { outcome: 'failure', success: false },
      { outcome: 'success', success: true },
    ])('roll-less saveResult on $outcome ledger leg normalises roll/total to 0 (:277-278/:299-300)', async ({ success }) => {
      routeRuntime();
      monsterContext();
      savePrompt.createSaveListener.mockReturnValue({
        promptId: `web-pws-noroll-${success ? 'ok' : 'fail'}`,
        promise: Promise.resolve({ success }), // no roll/total bytes at all
      });

      await processWebAreaSave(casterName, targetName, campaignName, null);

      expect(damageRollback.addTargetResult).toHaveBeenCalledTimes(1);
      expect(damageRollback.addTargetResult).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        saveResult: success ? 'success' : 'failure',
        roll: 0,
        total: 0,
        appliedDamage: 0,
      }));
    });
  });

  describe('tracking key normalisation', () => {
    it('caster whitespace normalises into the read key (reader mirrors the writer\'s replace(/\\s+/g,\'_\'))', async () => {
      // A WHOLE whitespace run collapses to ONE '_': the exact regex byte
      // (/\s+/g), not a per-space join.
      routeRuntime({ caster: 'Weird  Caster' });
      monsterContext();
      mockSave(true);

      const result = await processWebAreaSave('Weird  Caster', targetName, campaignName, null);

      expect(useRuntimeState.getRuntimeValue.mock.calls[0]).toEqual([
        'Weird  Caster',
        '_web_Weird_Caster',
        campaignName,
      ]);
      expect(result.type).toBe('popup');
    });
  });

  describe('error handling (log rejects swallow; save promise propagates)', () => {
    // Recurring-lane catch legs ('[webAreaSave] Error:' prefix — the cast
    // lane's '[web] Error:' catches in #1991 are DIFFERENT source sites).
    // No *Once chains: keyed impl targets the rejected call by entry.type,
    // immune to call-order drift.
    it.each([
      { outcome: 'failed', success: false, rejectType: 'ability_use', condWrites: 1 },
      { outcome: 'failed', success: false, rejectType: 'save_result', condWrites: 1 },
      { outcome: 'successful', success: true, rejectType: 'save_result', condWrites: 0 },
    ])('addEntry rejection on $rejectType during a $outcome save is caught — exactly-1 console.error, commits complete independently', async (c) => {
      setupAreaSave(c.success);
      logService.addEntry.mockImplementation((campaign, entry) =>
        entry.type === c.rejectType ? Promise.reject(new Error(`${c.rejectType} log error`)) : Promise.resolve({}),
      );
      const consoleError = vi.spyOn(console, 'error').mockReturnValue();

      const result = await processWebAreaSave(casterName, targetName, campaignName, null);

      expect(result.type).toBe('popup'); // swallowing never breaks the lane contract
      // both log attempts still happen (full-array spend census)
      expect(logService.addEntry.mock.calls.map((e) => e[1].type)).toEqual(['ability_use', 'save_result']);
      expect(consoleError).toHaveBeenCalledTimes(1);
      expect(consoleError).toHaveBeenCalledWith('[webAreaSave] Error:', expect.any(Error));
      // failure application completed before/independent of the log rejection;
      // success leg commits nothing
      const condWrites = useRuntimeState.setRuntimeValue.mock.calls.filter((w) => w[1] === 'activeConditions');
      expect(condWrites.length).toBe(c.condWrites);
      expect(damageRollback.addTargetResult).toHaveBeenCalledTimes(1);
      consoleError.mockRestore();
    });

    it('save promise rejects → PROPAGATES with ONLY the paired ability_use logged and zero writes', async () => {
      // Reject contract census (web = sleet/stinkingCloud twin: `await
      // promise` :354 sits outside any try; the grease twin swallows to null).
      routeRuntime();
      monsterContext();
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-pws-reject',
        promise: Promise.reject(new Error('save cancelled')),
      });

      await expect(
        processWebAreaSave(casterName, targetName, campaignName, null),
      ).rejects.toThrow('save cancelled');

      // exactly-1-log census: only the promptId-paired ability_use was posted
      expect(logService.addEntry.mock.calls).toEqual([
        [campaignName, expect.objectContaining({ type: 'ability_use', promptId: 'web-pws-reject' })],
      ]);
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(damageRollback.addTargetResult).not.toHaveBeenCalled();
    });
  });
});
