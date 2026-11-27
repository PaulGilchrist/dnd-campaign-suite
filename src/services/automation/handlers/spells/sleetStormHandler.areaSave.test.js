// @maintained-by-ai 2026-11-27 — IMPROVE-AND-TRIM pass: 21→20 cases (7 failure-leg assertion tests merged into one ordered commit/log/read census per outcome; reject family → keyed-impl it.each, no *Once chains; gate-order exact read censuses incl. sleet's prone-before-immunity order; honest-bytes pin: lane consumes only tracking.saveDc/radius, saveType hardcoded DEX unlike grease twin; resetAllMocks-safe factories; whitespace key-normalisation + promptId-paired reject-leg log census added; header line refs re-verified vs current bytes)
// ── sleetStorm QUARTET seam map (shared subject: sleetStormHandler.js) ──
// lane (this) — .areaSave: processSleetStormAreaSave ONLY — the recurring
//   per-creature DEX-save lane, fired at the caster-turn initiative seam by
//   expireStaleEffects.js:57 (Phase 3, re-verified 2026-11-27). LIVE-wired —
//   SP-111 precedent, grease's tracking-store lane joined it 2026-11-19.
//   In-area enumeration itself lives in expireStaleEffects (targetEffects
//   filter effect==='sleet_storm' && source===caster → per-target re-force,
//   :46-48); pinned over there in expirations_expireStaleEffects.test.js.
// RAW check (2024 Essentials, sleetStormHandler.js:369-411): weather area
//   spell, 20-ft-radius / 40-ft-tall cylinder, heavily obscured, difficult
//   terrain, Concentration ≤ 1 minute. Save is DEX (NOT CON) and there is NO
//   damage — appliedDamage: 0 on every addTargetResult, no damage dice in the
//   module ("2d8 cold + 1d4 bludgeoning" is ice storm, not sleet storm).
//   Fail = Prone + concentration loss. Turn-based: the area persists via
//   runtime-store tracking + concentration, expired only at round seams —
//   no clocks here (grep-verified: zero timers in module).
// Siblings (split verified by CONTENT, honest):
//   #1961 .handle         — handle() cast-time application: per-target
//     applySleetStormProneTarget (activeConditionMeta, breakConcentration,
//     targetEffects, condition/concentration_lost logs), tracking-key write,
//     duration→rounds parsing, addExpiration, registerSpellConcentration
//   #1962 .handleResults  — handle() outcome reporting: storeSpellLastAttack,
//     per-target ability_use entries, summary popup text, mixed multi-target
//   #1963 .test (main)    — handle() early returns, target selection, save
//     prompt shape (heightenTarget disadvantage), prone immunity via
//     weaknessesAndResistivities (isProneImmune, cast-time lane)
// Split is honest by content: this is the ONLY quartet file that imports
// processSleetStormAreaSave; siblings all import handle().
// Gate ORDER (sleet-DISTINCT bytes; do not family-merge blindly): sleet's
//   shouldSkipSleetAreaSave runs map/in-area (:272-280) → already-prone
//   (:282-284) → player immunity (:289-307). The grease twin (#1921) runs
//   immunity BEFORE the prone read — the exact-array read censuses below
//   fail if either lane re-orders. Where an assertion is identical except
//   the handler name, a family-wide it.each consolidation is a REPORT-ONLY
//   recommendation (owner sign-off pending on the shared guard table).
// Field consumption (prose verdict, #1891 audit): the lane reads ONLY
//   tracking.saveDc and tracking.radius. createSaveListener's saveType and
//   every log/popup string HARDCODE 'DEX'/'Prone' — unlike grease (which
//   reads tracking.saveType into the request), a contradicted tracking.saveType
//   changes nothing here. Latent-only: the sole producer (handle :52-61)
//   always writes saveType:'DEX', so prod bytes agree. Pinned honestly below
//   ('consumes ONLY ...' case); re-pin if the lane ever parameterises.
//   tracking.duration/timestamp/mapName are stored by handle but never read
//   by this lane (persistence lives in expiration + concentration instead).
// Duration policy: this lane stores NO durations/expirations (handle-lane
//   owns those). Divergence noted cross-file only: handle's '1_minute'→10
//   rounds minutes×10 encoding (sleetStormHandler.js:64-70) predates the
//   ≥1min-combat-scoped canon — #1961 handle.test.js should pin the honest
//   bytes and cite the #1822 owner-pending precedent.
// Arity (per #1878): every getRuntimeValue CALL this lane makes is 3-arg in
//   source bytes (:371 tracking, :282+:313 activeConditions, :329
//   concentration) while the real getRuntimeValue is 2-param (read-side
//   campaignName is inert) — censuses below match the source calls, not the
//   signature. setRuntimeValue writes ARE 4-arg with campaignName threaded.
// Lane-delta guards (their positive pins live in #1961 —
//   applySleetAreaSaveFailure intentionally omits them): no
//   activeConditionMeta/targetEffects write, no addExpiration, no
//   breakConcentration/getCombatSummary, no 'condition'/'concentration_lost'
//   log entries, no storeSpellLastAttack.
// Flags (reported, not silently kept):
//   • PRODUCTION DEFECT FIXED 2026-11-23 (await census finale):
//     shouldSkipSleetAreaSave :289 called async getCombatContext WITHOUT
//     await, so ?.creatures was undefined in prod and the playerIsImmuneToCondition
//     branch was UNREACHABLE — immune PCs took Prone from the recurring area
//     save. Now awaited (grease twin) AND, per the Option A landing
//     (bug-zone-save-computedstats-bucket-has-no-producer, 2026-11-23), the
//     roster-resolved targetStats PARAMETER is passed to
//     playerIsImmuneToCondition AS the stats object — the runtime
//     'computedStats' BUCKET had NO producer (data-starved gate) and its read
//     is DELETED (one canonical shape). Pins below exercise the async
//     contract: immunity-skips / non-immune-resolves / NPC-unaffected.
//   • WIRED 2026-11-19 (owner "WIRE IT"): remove_sleet_storm_area expiration
//     (rounds:10 from the '1_minute' encoding) is PRODUCED at
//     sleetStormHandler.js:72-76 (handle lane) and consumed by
//     clearExpirationEffects.js EXPIRATION_HANDLERS — the clock nulls the
//     tracking key (pin: clearExpirationEffects.grease-sleet-zone-expiry.test.js).
//   • registry note (re-verified 2026-11-27): automation/index.js dispatches
//     BOTH 'sleet_storm_area_save' (558) and 'sleet_storm' (585) to handle()
//     — not to this export; trio dispatch is owned by index.webDispatch.test.js.
// Mock factories carry BASE implementations inline (vi.fn(async…)) so they
//   survive vi.resetAllMocks() — no *Once chains, no mid-test re-harness
//   beyond the exact-key runtime router.
// ──────────────────────────────────────────────────────────────────────────────
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(), // import-graph only — the process lane never calls it
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

// Import-side-effect isolation only — the process lane never writes expirations.
vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(async () => {}),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn(async () => true),
}));

vi.mock('../../../combat/automation/automationImmunities.js', () => ({
  playerIsImmuneToCondition: vi.fn(),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn(),
  breakConcentration: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

vi.mock('../../../ui/storage.js', () => ({
  __esModule: true,
  default: {
    set: vi.fn(),
  },
}));

vi.mock('../../common/damageRollback.js', () => ({
  storeSpellLastAttack: vi.fn(),
  addTargetResult: vi.fn(async () => ({})),
}));

// ── Imports ────────────────────────────────────────────────────

import { processSleetStormAreaSave } from './sleetStormHandler.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as logService from '../../../ui/logService.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as rangeCheck from '../../../rules/combat/rangeCheck.js';
import * as automationImmunities from '../../../combat/automation/automationImmunities.js';
import * as concentrationService from '../../../combat/concentration/concentrationService.js';
import * as combatData from '../../../encounters/combatData.js';
import * as damageRollback from '../../common/damageRollback.js';

// ── Constants & Helpers ────────────────────────────────────────

const campaignName = 'TestCampaign';
const mapName = 'test-map';
const casterName = 'TestWizard';
const targetName = 'Goblin';

// Reader mirrors the writer's key normalisation (handle stores
// `_sleetStorm_${caster.replace(/\s+/g,'_')}`): 'Test Wizard' → _sleetStorm_Test_Wizard
const trackingKeyFor = (caster) => `_sleetStorm_${caster.replace(/\s+/g, '_')}`;
const concentrationKeyFor = (caster) => `_sleetStorm_concentration_${caster.replace(/\s+/g, '_')}`;
const TRACKING_KEY = trackingKeyFor(casterName);
const CONCENTRATION_KEY = concentrationKeyFor(casterName);

function makeTracking(overrides = {}) {
  return {
    caster: casterName,
    saveDc: 15,
    saveType: 'DEX',
    radius: 20,
    ...overrides,
  };
}

// Exact-key runtime router. NOTE (Option A landing): there is NO
// `computedStats` bucket key any more — the immunity gate receives the
// roster-resolved stats as the targetStats PARAMETER
// (bug-zone-save-computedstats-bucket-has-no-producer).
function routeRuntime({
  caster = casterName,
  activeConditions = [],
  concentration = [],
  tracking = makeTracking(),
} = {}) {
  const trackingKey = trackingKeyFor(caster);
  const concentrationKey = concentrationKeyFor(caster);
  useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
    if (key === concentrationKey) return concentration;
    if (key === trackingKey) return tracking;
    if (key === 'activeConditions') return activeConditions;
    return null;
  });
}

// getCombatContext in the ASYNC contract (production shape, per the 2026-11-23
// await-fix): the source awaits it before reading .creatures. Pins that need
// the player-immunity branch resolve a PLAYER row, so a dropped await drops
// the row to undefined and fails them (the old sync-mock shape passed even
// un-awaited — that mock lie hid the defect).
function monsterContext(name = targetName) {
  damageUtils.getCombatContext.mockResolvedValue({
    creatures: [{ name, type: 'monster' }],
  });
}

function playerContext(name = targetName) {
  damageUtils.getCombatContext.mockResolvedValue({
    creatures: [{ name, type: 'player' }],
  });
}

function mockSave(success, { roll, total, promptId = `sleet-area-${success ? 'ok' : 'fail'}` } = {}) {
  const outcome = success
    ? { success: true, roll: roll ?? 14, total: total ?? 14 }
    : { success: false, roll: roll ?? 5, total: total ?? 5 };
  savePrompt.createSaveListener.mockReturnValue({ promptId, promise: Promise.resolve(outcome) });
}

// Happy-path base: in-area monster, valid tracking, save resolves `success`.
function setupAreaSave(success = false) {
  routeRuntime();
  monsterContext();
  mockSave(success);
}

// ── Tests: processSleetStormAreaSave ───────────────────────────

describe('sleetStormHandler.processSleetStormAreaSave', () => {
  beforeEach(() => {
    vi.resetAllMocks(); // factories carry inline base impls — nothing to reinstall
  });

  describe('tracking guards', () => {
    it('returns null for missing or saveDc-less tracking, reading ONLY the tracking key', async () => {
      routeRuntime({ tracking: null });
      expect(await processSleetStormAreaSave(casterName, targetName, campaignName, mapName)).toBeNull();

      routeRuntime({ tracking: { caster: casterName } }); // no saveDc
      expect(await processSleetStormAreaSave(casterName, targetName, campaignName, mapName)).toBeNull();

      // both guard legs: read census is the tracking read ONLY (:371, 3-arg) —
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
    // Sleet order is map → already-prone → immunity (grease twin is the
    // reverse for the last two): each exact read census FAILS on re-ordering.
    it.each([
      {
        title: 'already prone (case-insensitive activeConditions read)',
        setup: () => {
          routeRuntime({ activeConditions: ['PrOnE'] });
          monsterContext();
        },
        expectReads: [
          [casterName, TRACKING_KEY, campaignName],
          [targetName, 'activeConditions', campaignName],
        ],
      },
      {
        title: 'outside the tracked radius',
        setup: () => {
          routeRuntime({ tracking: makeTracking({ radius: 20 }) });
          monsterContext();
          rangeCheck.isWithinRange.mockResolvedValue(false);
        },
        expectReads: [[casterName, TRACKING_KEY, campaignName]], // prone read never reached — range gate is FIRST
      },
      {
        title: 'immune player — gate receives the PASSED roster stats verbatim',
        setup: () => {
          routeRuntime();
          playerContext();
          automationImmunities.playerIsImmuneToCondition.mockReturnValue(true);
        },
        // prone read precedes the immunity gate; no concentration read
        expectReads: [
          [casterName, TRACKING_KEY, campaignName],
          [targetName, 'activeConditions', campaignName],
        ],
        expectImmunityCall: {
          conditionKey: 'prone',
          playerStats: { name: targetName, immunities: ['prone'] },
          getRuntimeValue: expect.any(Function),
          campaignName,
        },
      },
    ])('skips the save entirely when the target is $title — zero spends', async (c) => {
      const rosterStats = { name: targetName, immunities: ['prone'] };
      c.setup();

      expect(await processSleetStormAreaSave(casterName, targetName, campaignName, mapName, rosterStats)).toBeNull();

      // exact-array read census: nothing after the firing gate is read
      expect(useRuntimeState.getRuntimeValue.mock.calls).toEqual(c.expectReads);
      // the computedStats bucket (deleted with Option A) is never read
      expect(useRuntimeState.getRuntimeValue.mock.calls.every(([, key]) => key !== 'computedStats')).toBe(true);
      // gate ORDER: the range check is FIRST on all three skip legs (the
      // out-of-radius case fires the gate by answering false — call #1)
      expect(rangeCheck.isWithinRange).toHaveBeenCalledTimes(1);
      expect(rangeCheck.isWithinRange).toHaveBeenCalledWith(casterName, targetName, 20);
      if (c.expectImmunityCall) {
        expect(automationImmunities.playerIsImmuneToCondition).toHaveBeenCalledWith(c.expectImmunityCall);
      } else {
        // out-of-range never fetches the immunity context; already-prone
        // returns BEFORE the context fetch (prone gate sits ahead of it)
        expect(damageUtils.getCombatContext).not.toHaveBeenCalled();
        expect(automationImmunities.playerIsImmuneToCondition).not.toHaveBeenCalled();
      }
      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
      expect(logService.addEntry).not.toHaveBeenCalled();
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('skips the range check when mapName is null and proceeds with the save', async () => {
      routeRuntime();
      monsterContext();
      mockSave(true);

      const result = await processSleetStormAreaSave(casterName, targetName, campaignName, null);

      expect(result.type).toBe('popup');
      expect(rangeCheck.isWithinRange).not.toHaveBeenCalled();
      expect(savePrompt.createSaveListener).toHaveBeenCalledTimes(1);
    });

    it('proceeds with the save when isWithinRange throws (map data unavailable)', async () => {
      routeRuntime();
      monsterContext();
      rangeCheck.isWithinRange.mockRejectedValue(new Error('map not found'));
      mockSave(true);
      const consoleWarn = vi.spyOn(console, 'warn').mockReturnValue();

      const result = await processSleetStormAreaSave(casterName, targetName, campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(savePrompt.createSaveListener).toHaveBeenCalledTimes(1);
      expect(consoleWarn).toHaveBeenCalledWith(
        '[sleetStormHandler] Map data unavailable, proceeding with save:',
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
      mockSave(true);

      const result = await processSleetStormAreaSave(casterName, targetName, campaignName, mapName, stats);

      expect(result.type).toBe('popup');
      // The param IS the stats object playerIsImmuneToCondition reads — passed
      // directly, never re-wrapped under a computedStats key.
      expect(automationImmunities.playerIsImmuneToCondition).toHaveBeenCalledWith({
        conditionKey: 'prone',
        playerStats: stats,
        getRuntimeValue: expect.any(Function),
        campaignName,
      });
      expect(savePrompt.createSaveListener).toHaveBeenCalledTimes(1);
    });

    it('immunity leg is player-only: monster row with an immunity-carrying stats arg still saves', async () => {
      // Awaited contract + defect-incompatible: the resolved MONSTER row keeps
      // the immunity check out even when an immunity-carrying roster arg is
      // threaded (roster lookup by cs-row TYPE, not by the passed stats).
      routeRuntime();
      monsterContext();
      automationImmunities.playerIsImmuneToCondition.mockReturnValue(true);
      mockSave(true);

      const result = await processSleetStormAreaSave(casterName, targetName, campaignName, mapName, { name: targetName, immunities: ['prone'] });

      expect(result.type).toBe('popup');
      expect(automationImmunities.playerIsImmuneToCondition).not.toHaveBeenCalled();
    });
  });

  describe('save outcome sequences', () => {
    it('failed save — exact request, ordered log census (promptId-paired), popup, and ordered write census condition→concentration', async () => {
      routeRuntime();
      monsterContext();
      mockSave(false, { promptId: 'p-fail' });

      const result = await processSleetStormAreaSave(casterName, targetName, campaignName, mapName);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Sleet Storm',
          description: 'Goblin failed the DEX save (DC 15). Becomes Prone and loses Concentration.',
        },
      });

      // re-forced at the turn-start seam: DEX save at the tracked DC, ONE
      // listener, tracking extras (radius/duration/timestamp) never forwarded
      expect(savePrompt.createSaveListener).toHaveBeenCalledTimes(1);
      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName,
        saveType: 'DEX',
        saveDc: 15,
      });

      // ordered full-array log census: ability_use carries the SAME promptId
      // the listener returned (pairing — stray-prompt detector), then the
      // save_result outcome entry. Exactly 2 — no 'condition'/
      // 'concentration_lost' entries leak in from the handle lane.
      expect(logService.addEntry.mock.calls).toEqual([
        [campaignName, {
          type: 'ability_use',
          characterName: casterName,
          abilityName: 'Sleet Storm',
          description: 'Goblin must make a DEX save (DC 15) or become Prone and lose Concentration (Sleet Storm area).',
          promptId: 'p-fail',
        }],
        [campaignName, {
          type: 'save_result',
          characterName: casterName,
          rollType: 'save-sleet-storm',
          targetName,
          saveDc: 15,
          saveType: 'DEX',
          success: false,
          description: 'Goblin failed DEX save against Sleet Storm. Becomes Prone and loses Concentration.',
        }],
      ]);

      // ordered full-array write census (4-arg, campaignName threaded):
      // condition append, then the caster-side concentration-loss tracker.
      expect(useRuntimeState.setRuntimeValue.mock.calls).toEqual([
        [targetName, 'activeConditions', ['prone'], campaignName],
        [casterName, CONCENTRATION_KEY, [targetName], campaignName],
      ]);

      // exact read census: tracking, skip-gate conditions, re-read on apply,
      // concentration list — nothing else (:371, :282, :313, :329)
      expect(useRuntimeState.getRuntimeValue.mock.calls).toEqual([
        [casterName, TRACKING_KEY, campaignName],
        [targetName, 'activeConditions', campaignName],
        [targetName, 'activeConditions', campaignName],
        [casterName, CONCENTRATION_KEY, campaignName],
      ]);

      // rollback ledger: ONE entry, failure shape, zero damage (no dice here)
      expect(damageRollback.addTargetResult).toHaveBeenCalledTimes(1);
      expect(damageRollback.addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName,
        saveResult: 'failure',
        roll: 5,
        total: 5,
        conditions: ['prone'],
        appliedDamage: 0,
      });
    });

    it('successful save — popup + logs only; write census is EMPTY and the concentration list is never read', async () => {
      routeRuntime();
      monsterContext();
      mockSave(true, { promptId: 'p-ok' });

      const result = await processSleetStormAreaSave(casterName, targetName, campaignName, mapName);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Sleet Storm',
          description: 'Goblin succeeded the DEX save (DC 15). Unaffected.',
        },
      });

      expect(logService.addEntry.mock.calls).toEqual([
        [campaignName, {
          type: 'ability_use',
          characterName: casterName,
          abilityName: 'Sleet Storm',
          description: 'Goblin must make a DEX save (DC 15) or become Prone and lose Concentration (Sleet Storm area).',
          promptId: 'p-ok',
        }],
        [campaignName, {
          type: 'save_result',
          characterName: casterName,
          rollType: 'save-sleet-storm',
          targetName,
          saveDc: 15,
          saveType: 'DEX',
          success: true,
          description: 'Goblin succeeded on DEX save against Sleet Storm.',
        }],
      ]);

      // success leg: NO condition or concentration write at all
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      // …and the concentration key is never even read (recordSleetAreaSaveSuccess
      // skips applySleetAreaSaveFailure's list read)
      expect(useRuntimeState.getRuntimeValue.mock.calls).toEqual([
        [casterName, TRACKING_KEY, campaignName],
        [targetName, 'activeConditions', campaignName],
      ]);

      expect(damageRollback.addTargetResult).toHaveBeenCalledTimes(1);
      expect(damageRollback.addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName,
        saveResult: 'success',
        roll: 14,
        total: 14,
        conditions: [],
        appliedDamage: 0,
      });
    });

    it('consumes ONLY tracking.saveDc and tracking.radius — saveType/prone stay hardcoded DEX/Prone (honest bytes, latent-only vs grease twin)', async () => {
      // HONEST BYTE: unlike the grease twin (which forwards tracking.saveType
      // into the request), this lane hardcodes 'DEX' in the listener args and
      // every prose string; a contradicted tracking.saveType changes nothing.
      // The sole producer (handle :57) always writes 'DEX', so this is a
      // latent-only quirk — re-pin if the lane ever parameterises.
      routeRuntime({ tracking: makeTracking({ saveType: 'CON', radius: 30 }) });
      monsterContext();
      mockSave(false);

      const result = await processSleetStormAreaSave(casterName, targetName, campaignName, mapName);

      expect(rangeCheck.isWithinRange).toHaveBeenCalledWith(casterName, targetName, 30); // radius IS tracked
      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName,
        saveType: 'DEX', // hardcoded, NOT the contradicted tracked 'CON'
        saveDc: 15,
      });
      expect(result.payload.description).toBe('Goblin failed the DEX save (DC 15). Becomes Prone and loses Concentration.');
      expect(useRuntimeState.setRuntimeValue.mock.calls).toEqual([
        [targetName, 'activeConditions', ['prone'], campaignName],
        [casterName, CONCENTRATION_KEY, [targetName], campaignName],
      ]);
    });

    it('preserves existing conditions and appends concentration-tracker entries without duplicating', async () => {
      routeRuntime({ activeConditions: ['blinded', 'restrained'], concentration: ['Orc'] });
      monsterContext();
      mockSave(false);

      await processSleetStormAreaSave(casterName, targetName, campaignName, mapName);

      expect(useRuntimeState.setRuntimeValue.mock.calls).toEqual([
        [targetName, 'activeConditions', ['blinded', 'restrained', 'prone'], campaignName],
        [casterName, CONCENTRATION_KEY, ['Orc', targetName], campaignName],
      ]);
    });

    it('target already in the concentration-loss list: list NOT rewritten, condition write still lands', async () => {
      routeRuntime({ concentration: [targetName] });
      monsterContext();
      mockSave(false);

      await processSleetStormAreaSave(casterName, targetName, campaignName, mapName);

      // exact write census: ONLY the activeConditions write survives
      expect(useRuntimeState.setRuntimeValue.mock.calls).toEqual([
        [targetName, 'activeConditions', ['prone'], campaignName],
      ]);
      expect(useRuntimeState.getRuntimeValue).toHaveBeenCalledWith(casterName, CONCENTRATION_KEY, campaignName);
    });

    it('caster whitespace normalises into BOTH keys (reader mirrors the writer)', async () => {
      routeRuntime({ caster: 'Test Wizard' });
      monsterContext('Goblin');
      mockSave(false);

      await processSleetStormAreaSave('Test Wizard', targetName, campaignName, mapName);

      expect(useRuntimeState.getRuntimeValue).toHaveBeenCalledWith('Test Wizard', '_sleetStorm_Test_Wizard', campaignName);
      expect(useRuntimeState.setRuntimeValue.mock.calls).toEqual([
        [targetName, 'activeConditions', ['prone'], campaignName],
        ['Test Wizard', '_sleetStorm_concentration_Test_Wizard', [targetName], campaignName],
      ]);
    });
  });

  describe('lane-delta guards vs the handle lane (#1961)', () => {
    it('area failure runs NO handle-lane side effects', async () => {
      setupAreaSave(false);

      await processSleetStormAreaSave(casterName, targetName, campaignName, mapName);

      // Positive pins for all of these live in #1961 (applySleetStormProneTarget);
      // applySleetAreaSaveFailure must stay free of them.
      expect(useRuntimeState.setRuntimeValue.mock.calls.map((c) => c[1])).toEqual([
        'activeConditions',
        CONCENTRATION_KEY,
      ]);
      expect(logService.addEntry.mock.calls.map((c) => c[1].type)).toEqual(['ability_use', 'save_result']);
      expect(expirations.addExpiration).not.toHaveBeenCalled();
      expect(concentrationService.breakConcentration).not.toHaveBeenCalled();
      expect(combatData.getCombatSummary).not.toHaveBeenCalled();
      expect(damageRollback.storeSpellLastAttack).not.toHaveBeenCalled();
    });
  });

  describe('error handling (floating addEntry catches, save promise)', () => {
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

      const result = await processSleetStormAreaSave(casterName, targetName, campaignName, mapName);

      expect(result.type).toBe('popup');
      // both log attempts still happen (full-array spend census)
      expect(logService.addEntry.mock.calls.map((e) => e[1].type)).toEqual(['ability_use', 'save_result']);
      expect(consoleError).toHaveBeenCalledTimes(1);
      expect(consoleError).toHaveBeenCalledWith('[sleetStormAreaSave] Error:', expect.any(Error));
      // failure application completed before/independent of the log rejection;
      // success leg commits nothing
      const condWrites = useRuntimeState.setRuntimeValue.mock.calls.filter((w) => w[1] === 'activeConditions');
      expect(condWrites.length).toBe(c.condWrites);
      expect(damageRollback.addTargetResult).toHaveBeenCalledTimes(1);
      consoleError.mockRestore();
    });

    it('save promise rejects → throws with ONLY the paired ability_use logged and zero writes', async () => {
      routeRuntime();
      monsterContext();
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'sleet-area-reject',
        promise: Promise.reject(new Error('save cancelled')),
      });

      await expect(
        processSleetStormAreaSave(casterName, targetName, campaignName, mapName),
      ).rejects.toThrow('save cancelled');

      // exactly-1-log census: only the promptId-paired ability_use was posted
      expect(logService.addEntry.mock.calls).toEqual([
        [campaignName, expect.objectContaining({ type: 'ability_use', promptId: 'sleet-area-reject' })],
      ]);
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(damageRollback.addTargetResult).not.toHaveBeenCalled();
    });
  });
});
