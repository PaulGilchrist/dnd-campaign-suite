// @maintained-by-ai 2026-11-27 — IMPROVE-AND-TRIM pass (#1973): 16→26 cases; per-outcome ordered commit/log/read censuses with full-shape toEqual under frozen Date.now; gate-order exact read censuses; honest-bytes pin (lane consumes ONLY tracking.saveDc/radius(+`|| 20` fallback), saveType hardcoded 'CON' like the sleet twin, unlike the forwarding grease twin); whitespace key-normalisation, promptId-paired censuses, save-promise reject leg, keyed-impl log-rejection family (no *Once chains); resetAllMocks-safe inline-base factories; header claims re-verified vs current bytes
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── PAIR seam map (stinkingCloudHandler.js — this file + stinkingCloudHandler.test.js) ─
// THIS file (#1973) — SP-111 RECURRING area-save CONTENT (processStinkingCloudAreaSave +
//   applyStinkingCloudTurnEnd): exact-key `_stinkingCloud_<caster>` tracking guard incl.
//   whitespace normalisation (reader mirrors the writer's replace(/\s+/g,'_')), the
//   mapName-gated caster-anchored range check (skip when falsy, proceed when it THROWS),
//   poison-immunity skip gates (monster cs-row 'Poison' damage immunity + player
//   Poisoned-condition registry against the PASSED roster stats — never a runtime
//   `computedStats` bucket, which has NO producer: bug-zone-save-computedstats-bucket-has-no-producer),
//   turn-start CON save via createSaveListener, Poisoned apply/refresh with
//   activeConditionMeta dc/ability/source, block-te registerTargetEffect write (REAL
//   registry fn → setRuntimeValue 5th arg skipSync=true) + in-place dedupe, rollback
//   ledger (addTargetResult, appliedDamage 0 — this spell deals NO damage, condition +
//   action block only), promptId-paired ordered log censuses both legs, popup prose
//   (composed INLINE at :149-156, not via spellNoticePopup), save-promise reject
//   propagation, keyed log-rejection resilience, and the turn-end shed lane ("until the
//   end of the current turn"): sheds only when the creature carries a live stinking_cloud
//   zone te (manual poison never auto-shed), idempotent no-side-effect guards.
// SIBLING stinkingCloudHandler.test.js (#1974 main, swept 2026-11-27) — cast-time
//   handle() orchestration: buildSaveDc, combat-context gate, target selection,
//   per-target cast saves (disadvantage on heightenTarget), cast-time Poisoned/meta/
//   zone-marker writes, concentration registration, the `_stinkingCloud_<caster>`
//   tracking STORE, the zone-expiration content (clear_runtime_value +
//   remove_target_effect stinking_cloud/no_action_and_bonus_action), the cast-time
//   block-te write (skipSync=true), immunity counting, popup tallies, [stinkingCloud]
//   catch chains. Those content pins now LIVE there — nothing inherited-unpinned.
// Gate ORDER (stinkingCloud-DISTINCT bytes; do not family-merge blindly):
//   tracking (:106) → in-area (:110-118, only when mapName truthy) → awaited
//   getCombatContext + immunity (:120-124) → save. There is NO already-poisoned skip
//   gate — a Poisoned creature re-saves every turn start (the refresh census below
//   proves it), unlike the grease twin (area→immunity→prone) and the sleet twin
//   (area→prone→immunity). The exact-array read censuses FAIL if the lane re-orders.
// Field consumption (honest bytes, #1891/#1892 family audit): the lane reads ONLY
//   tracking.saveDc and tracking.radius (with a `|| 20` fallback); createSaveListener's
//   saveType and every log/popup string HARDCODE 'CON' — like sleet (hardcoded 'DEX'),
//   UNLIKE grease (which forwards tracking.saveType). A contradicted tracking.saveType
//   changes nothing here; latent-only, the sole producer (handle :315) always writes
//   'CON'. Pinned below ('consumes ONLY' family). tracking.duration/timestamp/
//   mapName/campaignName are stored by handle but never read by this lane.
// Duration policy: this lane stores NO durations/expirations (handle-lane owns those;
//   the addExpiration mock is import-side-effect isolation only). Cross-file note: the
//   cast lane's '1 minute'→10 rounds minutes×10 encoding (:438-445) predates the
//   ≥1min-combat-scoped canon — stinkingCloudHandler.test.js should cite the #1822
//   precedent alongside its honest-bytes pins.
// Arity (per #1878): every getRuntimeValue CALL this lane (and the REAL
//   registerTargetEffect callee) makes is 3-arg in source bytes (:104 tracking, :160/
//   :216/:44/:54 activeConditions, :165 activeConditionMeta, :231 + registry :1535
//   targetEffects) while the real getRuntimeValue is 2-param (read-side campaignName is
//   inert) — censuses below match the source calls, not the signature. setRuntimeValue
//   writes are 4-arg with campaignName threaded, EXCEPT the registerTargetEffect
//   targetEffects write which is 5-arg (skipSync=true) — the censuses keep the two
//   targetEffects-write shapes distinguishable.
// Liveness (re-verified 2026-11-27 against current bytes): expireStaleEffects.js:123
//   Phase 4 processZoneTurnStartSaves(effectKey 'stinking_cloud', trackingPrefix
//   'stinkingCloud') consumes caster zone tracking and calls
//   processStinkingCloudAreaSave(te.source, activeName, campaignName, zoneTracking
//   .mapName); in-area enumeration is consumer-side (te.target === active creature),
//   geometry detail lives behind isWithinRange here. Consumer-side routing pinned in
//   expireStaleEffects.test.js. applyStinkingCloudTurnEnd LIVE at
//   src/components/initiative/navigationHandlers.js:240 (own-turn-end seam); handle()
//   LIVE via automation index.js:584 'stinking_cloud' dispatch. grease joined this wired
//   family 2026-11-19 (owner "WIRE IT", Phase 6); sleet Phase 3 / web Phase 5 share the
//   pattern (sleet quartet closed 20/…, grease lane 13 cases).
// Reject contract: `await promise` (:141) sits OUTSIDE any try — a rejected save promise
//   PROPAGATES out of the lane (sleet-twin behavior; the grease twin swallows to null —
//   family divergence, pinned honestly). PROD DEFECT grep (sleetStorm's old un-awaited
//   getCombatContext contrast): CLEAN — both sites awaited (:120 area save, :287 handle).
// Turn-based only: no timers in this file or in these handler lanes; Date.now() is
//   frozen solely to pin write-metadata timestamps (log rows), never a game clock.
// Mock rationale: targetEffectDefinitions is REAL (unmocked) — registerTargetEffect
//   owns the dedupe + skipSync write through the mocked runtime store. areaSpellUtils
//   is REAL but import-graph-only for this lane (the recurring popup is composed
//   inline); its imports (concentrationService / combatData / storage) are mocked to
//   isolate module-import side effects of the handler graph. damageRollback mock:
//   addTargetResult is awaited in this lane; storeSpellLastAttack is handle()-side only.
// Mock factories carry BASE implementations inline (vi.fn(async…)) so they survive
//   vi.resetAllMocks() — no *Once chains, no mid-test re-harness beyond the fresh
//   exact-key store each test installs at its start.

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(), // import-graph only — the recurring lane never calls it
  createSaveListener: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn(async () => true),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(async () => ({})),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

// Import-side-effect isolation only — neither recurring export calls addExpiration
// (cast-time wires owned by sibling #1974).
vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(async () => {}),
}));

vi.mock('../../../combat/automation/automationImmunities.js', () => ({
  playerIsImmuneToCondition: vi.fn(() => false),
}));

// Import-side-effect isolation only (real areaSpellUtils imports these).
vi.mock('../../../combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn(),
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

import { processStinkingCloudAreaSave, applyStinkingCloudTurnEnd } from './stinkingCloudHandler.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as damageRollback from '../../common/damageRollback.js';
import * as logService from '../../../ui/logService.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as rangeCheck from '../../../rules/combat/rangeCheck.js';
import * as automationImmunities from '../../../combat/automation/automationImmunities.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as concentrationService from '../../../combat/concentration/concentrationService.js';
import * as combatData from '../../../encounters/combatData.js';

// ── Constants & helpers ────────────────────────────────────────

const campaignName = 'test-campaign';
const mapName = 'test-map';
const casterName = 'TestWizard';
const targetName = 'Thug 1';

// Reader mirrors the writer's key normalisation (handle stores
// `_stinkingCloud_${caster.replace(/\s+/g,'_')}`): 'Test Wizard' → _stinkingCloud_Test_Wizard
const trackingKeyFor = (caster) => `_stinkingCloud_${caster.replace(/\s+/g, '_')}`;
const TRACKING_KEY = trackingKeyFor(casterName);

// Frozen wall clock: Date.now() here is write-metadata only (condition-log
// timestamps), never a game timer — freezing pins the honest full bytes.
const FROZEN_NOW = 1700000000000;

const baseTracking = {
  caster: casterName,
  mapName,
  campaignName,
  saveDc: 18,
  saveType: 'CON',
  radius: 20,
  timestamp: 123,
  duration: 'Concentration, up to 1 minute',
};

// Simple in-memory store for the mocked runtime service: reads see earlier
// writes, so the REAL registerTargetEffect dedupe lane behaves production-side.
function createStore(initial = {}) {
  const store = { ...initial };
  const getRuntimeValue = vi.fn((key, field) => {
    const v = store[`${key}.${field}`];
    return v === undefined ? null : v;
  });
  const setRuntimeValue = vi.fn((key, field, value) => {
    store[`${key}.${field}`] = value;
  });
  return { store, getRuntimeValue, setRuntimeValue };
}

function installStore(store) {
  useRuntimeState.getRuntimeValue.mockImplementation(store.getRuntimeValue);
  useRuntimeState.setRuntimeValue.mockImplementation(store.setRuntimeValue);
  return store;
}

// The recurring-lane base: tracking live, everything else empty. Pass overrides
// for stored tes/conditions/meta (keyed by the exact `name.field` source reads).
function harness({ tracking = baseTracking, tes, conditions, meta } = {}) {
  const seed = { [`${casterName}.${TRACKING_KEY}`]: tracking };
  if (tes !== undefined) seed['campaign.targetEffects'] = tes;
  if (conditions !== undefined) seed[`${targetName}.activeConditions`] = conditions;
  if (meta !== undefined) seed[`${targetName}.activeConditionMeta`] = meta;
  return installStore(createStore(seed));
}

function monsterContext(creature) {
  damageUtils.getCombatContext.mockResolvedValue({
    creatures: [creature || { name: targetName, type: 'monster' }],
  });
}

function playerContext(name) {
  damageUtils.getCombatContext.mockResolvedValue({
    creatures: [{ name, type: 'player' }],
  });
}

function mockSave(success, { promptId = `stink-area-${success ? 'ok' : 'fail'}`, roll, total } = {}) {
  const outcome = success
    ? { success: true, roll: roll ?? 19, total: total ?? 21 }
    : { success: false, roll: roll ?? 2, total: total ?? 4 };
  savePrompt.createSaveListener.mockReturnValue({ promptId, promise: Promise.resolve(outcome) });
}

// The zone marker the creature carries from a live cloud (opaque stored data:
// this lane filters it but never writes it) and the block te EXACTLY as the
// REAL registerTargetEffect composes it ({...defaults, ...extraProps}).
const zoneTe = { target: targetName, effect: 'stinking_cloud', source: casterName, duration: 'concentration', dc: 18 };
const blockTe = {
  target: targetName,
  effect: 'no_action_and_bonus_action',
  source: casterName,
  duration: 'until_end_of_current_turn',
  reason: "Poisoned by Stinking Cloud (can't take an Action or Bonus Action)",
};

// ── processStinkingCloudAreaSave: recurring turn-start CON save ───
// Consumed live by expireStaleEffects Phase 4 (SP-111) at each zone-te-carrying
// creature's TURN START. Zero damage — Poisoned + block te only.

describe('stinkingCloudHandler.processStinkingCloudAreaSave', () => {
  let nowSpy;

  beforeEach(() => {
    vi.resetAllMocks(); // factories carry inline base impls — nothing to reinstall
    nowSpy = vi.spyOn(Date, 'now').mockReturnValue(FROZEN_NOW);
  });

  afterEach(() => {
    nowSpy.mockRestore();
  });

  describe('skip gates (gate-order read censuses)', () => {
    // StinkingCloud order is tracking → area → context+immunity, and there is
    // NO already-poisoned gate: each exact read census FAILS on re-ordering.
    it.each([
      {
        title: 'zone tracking is missing entirely',
        setup: () => harness({ tracking: null }),
        extras: () => {
          expect(rangeCheck.isWithinRange).not.toHaveBeenCalled();
          expect(damageUtils.getCombatContext).not.toHaveBeenCalled();
        },
      },
      {
        title: 'tracking lacks saveDc',
        setup: () => harness({ tracking: { caster: casterName } }),
        extras: () => {
          expect(rangeCheck.isWithinRange).not.toHaveBeenCalled();
          expect(damageUtils.getCombatContext).not.toHaveBeenCalled();
        },
      },
      {
        title: 'a positioned target is outside the tracked sphere (movement-exit; re-forced next turn start)',
        setup: () => {
          harness();
          rangeCheck.isWithinRange.mockResolvedValue(false);
        },
        extras: () => {
          expect(rangeCheck.isWithinRange).toHaveBeenCalledTimes(1);
          expect(rangeCheck.isWithinRange).toHaveBeenCalledWith(casterName, targetName, 20);
          // gate ORDER: the area gate precedes the context fetch + immunity
          expect(damageUtils.getCombatContext).not.toHaveBeenCalled();
          expect(automationImmunities.playerIsImmuneToCondition).not.toHaveBeenCalled();
        },
      },
      {
        title: 'a monster cs-row carries Poison damage immunity (case-normalised, registry never consulted)',
        setup: () => {
          harness();
          monsterContext({
            name: targetName,
            type: 'monster',
            weaknessesAndResistivities: { immunities: ['Poison'] },
          });
        },
        extras: () => {
          // the cs-row branch answers BEFORE the player-registry branch
          expect(automationImmunities.playerIsImmuneToCondition).not.toHaveBeenCalled();
        },
      },
      {
        title: 'a player is Poisoned-condition immune — gate receives the PASSED roster stats verbatim',
        setup: () => {
          harness();
          playerContext('Hero');
          automationImmunities.playerIsImmuneToCondition.mockReturnValue(true);
        },
        stats: { name: 'Hero', immunities: ['poisoned'] },
        targetOverride: 'Hero',
        extras: () => {
          expect(automationImmunities.playerIsImmuneToCondition).toHaveBeenCalledWith({
            conditionKey: 'poisoned',
            playerStats: { name: 'Hero', immunities: ['poisoned'] },
            getRuntimeValue: expect.any(Function),
            campaignName,
          });
        },
      },
    ])('skips the save entirely when $title — zero spends', async (c) => {
      c.setup();

      expect(await processStinkingCloudAreaSave(
        casterName, c.targetOverride || targetName, campaignName, mapName, c.stats,
      )).toBeNull();

      // exact-array read census: the tracking read (:104, 3-arg) is the ONLY
      // read on every skip leg — the lane has no condition/meta gate ahead of
      // the immunity answer, and the deleted `computedStats` bucket (Option A)
      // is never read.
      expect(useRuntimeState.getRuntimeValue.mock.calls).toEqual([
        [casterName, TRACKING_KEY, campaignName],
      ]);
      expect(useRuntimeState.getRuntimeValue.mock.calls.every(([, key]) => key !== 'computedStats')).toBe(true);
      c.extras();
      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
      expect(logService.addEntry).not.toHaveBeenCalled();
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('immunity contract (awaited async context)', () => {
    // LIVE pins (bug-zone-save-computedstats-bucket-has-no-producer): the
    // awaited ASYNC context resolves the PLAYER row so the immunity branch is
    // reachable exactly as in production, and playerStats is the targetStats
    // PARAMETER the expireStaleEffects sweep threads from the caller's roster
    // (`characters.find(...) → computedStats || character`) — never re-wrapped.
    it.each([
      ['roster-resolved stats', { name: 'Hero', immunities: [] }],
      ['absent roster target (undefined stats → the rule guard answers false)', undefined],
    ])('non-immune player with %s proceeds to the save — gate receives the param verbatim', async (_case, stats) => {
      harness();
      playerContext('Hero');
      mockSave(true);

      const result = await processStinkingCloudAreaSave(casterName, 'Hero', campaignName, mapName, stats);

      expect(result.type).toBe('popup');
      expect(automationImmunities.playerIsImmuneToCondition).toHaveBeenCalledWith({
        conditionKey: 'poisoned',
        playerStats: stats,
        getRuntimeValue: expect.any(Function),
        campaignName,
      });
      expect(savePrompt.createSaveListener).toHaveBeenCalledTimes(1);
    });

    it('immunity leg is player-only: monster row with an immunity-carrying stats arg still saves', async () => {
      // Awaited contract + defect-incompatible: the resolved MONSTER row keeps
      // the registry check out even when an immunity-carrying roster arg is
      // threaded AND the registry itself would answer true (roster lookup is
      // by cs-row TYPE, not by the passed stats).
      harness();
      monsterContext();
      automationImmunities.playerIsImmuneToCondition.mockReturnValue(true);
      mockSave(true);

      const result = await processStinkingCloudAreaSave(
        casterName, targetName, campaignName, mapName, { name: targetName, immunities: ['poisoned'] },
      );

      expect(result.type).toBe('popup');
      expect(automationImmunities.playerIsImmuneToCondition).not.toHaveBeenCalled();
      expect(savePrompt.createSaveListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('range-check bypasses', () => {
    it('skips the range check entirely when mapName is falsy (gridless) and still forces the save', async () => {
      harness({ tracking: { ...baseTracking, mapName: null } });
      monsterContext();
      mockSave(true);

      const result = await processStinkingCloudAreaSave(casterName, targetName, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.name).toBe('Stinking Cloud');
      expect(rangeCheck.isWithinRange).not.toHaveBeenCalled();
      expect(savePrompt.createSaveListener).toHaveBeenCalledTimes(1);
    });

    it('proceeds with the save when isWithinRange THROWS (map data unavailable, console.warn)', async () => {
      harness();
      monsterContext();
      rangeCheck.isWithinRange.mockRejectedValue(new Error('map not found'));
      mockSave(true);
      const warnSpy = vi.spyOn(console, 'warn').mockReturnValue();

      const result = await processStinkingCloudAreaSave(casterName, targetName, campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload.name).toBe('Stinking Cloud');
      expect(savePrompt.createSaveListener).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        '[stinkingCloudHandler] Map data unavailable, proceeding with save:',
        expect.any(Error),
      );
      warnSpy.mockRestore();
    });
  });

  describe('save outcome sequences', () => {
    it('failed save — exact request, popup, ordered log census (promptId-paired), ordered read/write censuses, zero-damage ledger, no handle-lane side effects', async () => {
      const store = harness({
        tes: [zoneTe],
        conditions: [],
        meta: {},
      });
      monsterContext();
      mockSave(false, { promptId: 'p-fail', roll: 2, total: 4 });

      const result = await processStinkingCloudAreaSave(casterName, targetName, campaignName, mapName);

      // Full-shape popup (composed INLINE in the handler, own bytes).
      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Stinking Cloud',
          description: "Thug 1 failed the CON save (DC 18) at turn start. Poisoned until the end of the current turn — can't take an Action or Bonus Action.",
        },
      });

      // Lane-distinct request: NO `disadvantage` key (cast-time handle() adds
      // it), saveType HARDCODED 'CON', saveDc from tracking — ONE listener.
      expect(savePrompt.createSaveListener).toHaveBeenCalledTimes(1);
      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName,
        saveType: 'CON',
        saveDc: 18,
        dcSuccess: 'none',
      });

      // ordered full-array log census: ability_use carries the SAME promptId
      // the listener returned (pairing — stray-prompt detector), then
      // save_result, then the frozen-clock condition row.
      expect(logService.addEntry.mock.calls).toEqual([
        [campaignName, {
          type: 'ability_use',
          characterName: casterName,
          abilityName: 'Stinking Cloud',
          description: "Thug 1 starts its turn in Stinking Cloud and must make a CON save (DC 18) or become Poisoned until the end of the current turn (can't take an Action or Bonus Action).",
          promptId: 'p-fail',
        }],
        [campaignName, {
          type: 'save_result',
          characterName: casterName,
          rollType: 'save-stinking-cloud',
          targetName,
          saveDc: 18,
          saveType: 'CON',
          success: false,
          description: "Thug 1 failed its turn-start CON save (DC 18) against Stinking Cloud and is Poisoned until the end of the current turn — can't take an Action or Bonus Action.",
        }],
        [campaignName, {
          type: 'condition',
          action: 'applied',
          characterName: targetName,
          condition: 'Poisoned',
          reason: 'Stinking Cloud (turn start)',
          note: "Thug 1 is Poisoned by Stinking Cloud. While Poisoned, the creature can't take an Action or Bonus Action.",
          timestamp: FROZEN_NOW,
        }],
      ]);

      // ordered full-array read census: tracking (:104), conditions re-read on
      // apply (:160), meta (:165), then the REAL registerTargetEffect read
      // (registry :1535) — nothing else.
      expect(useRuntimeState.getRuntimeValue.mock.calls).toEqual([
        [casterName, TRACKING_KEY, campaignName],
        [targetName, 'activeConditions', campaignName],
        [targetName, 'activeConditionMeta', campaignName],
        ['campaign', 'targetEffects', campaignName],
      ]);

      // ordered full-array write census: 4-arg condition + meta writes, then
      // the block te through the REAL registry as a 5-arg skipSync write (the
      // existing zone te survives untouched, block appended).
      expect(useRuntimeState.setRuntimeValue.mock.calls).toEqual([
        [targetName, 'activeConditions', ['poisoned'], campaignName],
        [targetName, 'activeConditionMeta', { poisoned: { dc: 18, ability: 'con', source: 'stinking_cloud' } }, campaignName],
        ['campaign', 'targetEffects', [zoneTe, blockTe], campaignName, true],
      ]);
      expect(store.store['campaign.targetEffects'][1]).toEqual(blockTe);

      // rollback ledger: ONE entry, failure shape, zero damage (no dice here).
      expect(damageRollback.addTargetResult).toHaveBeenCalledTimes(1);
      expect(damageRollback.addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName,
        saveResult: 'failure',
        roll: 2,
        total: 4,
        conditions: ['poisoned'],
        appliedDamage: 0,
      });

      // Lane-delta guards vs the handle lane (#1974): this recurring lane owns
      // no cast-time side effects.
      expect(expirations.addExpiration).not.toHaveBeenCalled();
      expect(damageRollback.storeSpellLastAttack).not.toHaveBeenCalled();
      expect(concentrationService.addConcentration).not.toHaveBeenCalled();
      expect(combatData.getCombatSummary).not.toHaveBeenCalled();
    });

    it('successful save — sheds Poisoned + block te, popup + logs only, 4-arg shed writes, zone marker survives', async () => {
      harness({ tes: [zoneTe, blockTe], conditions: ['poisoned'] });
      monsterContext();
      mockSave(true, { promptId: 'p-ok', roll: 19, total: 21 });

      const result = await processStinkingCloudAreaSave(casterName, targetName, campaignName, mapName);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Stinking Cloud',
          description: 'Thug 1 succeeded the CON save (DC 18) at turn start. Unaffected.',
        },
      });

      // ordered log census: ability_use (promptId-paired), the turn-start
      // SHED (reason distinguishes it from the turn-end shed lane), then the
      // success save_result. The shed fires only because poison was present.
      expect(logService.addEntry.mock.calls).toEqual([
        [campaignName, expect.objectContaining({
          type: 'ability_use',
          promptId: 'p-ok',
        })],
        [campaignName, {
          type: 'condition',
          action: 'removed',
          characterName: targetName,
          condition: 'Poisoned',
          reason: 'Stinking Cloud (turn-start save succeeded)',
          timestamp: FROZEN_NOW,
        }],
        [campaignName, {
          type: 'save_result',
          characterName: casterName,
          rollType: 'save-stinking-cloud',
          targetName,
          saveDc: 18,
          saveType: 'CON',
          success: true,
          description: 'Thug 1 succeeded on its turn-start CON save (DC 18) against Stinking Cloud.',
        }],
      ]);

      // reads: tracking, conditions, targetEffects — no meta read on this leg.
      expect(useRuntimeState.getRuntimeValue.mock.calls).toEqual([
        [casterName, TRACKING_KEY, campaignName],
        [targetName, 'activeConditions', campaignName],
        ['campaign', 'targetEffects', campaignName],
      ]);

      // writes: plain 4-arg sheds (NOT the registry's 5-arg skipSync shape);
      // the zone marker survives — the cloud persists with concentration.
      expect(useRuntimeState.setRuntimeValue.mock.calls).toEqual([
        [targetName, 'activeConditions', [], campaignName],
        ['campaign', 'targetEffects', [zoneTe], campaignName],
      ]);

      expect(damageRollback.addTargetResult).toHaveBeenCalledTimes(1);
      expect(damageRollback.addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName,
        saveResult: 'success',
        roll: 19,
        total: 21,
        conditions: [],
        appliedDamage: 0,
      });
    });

    it('already-Poisoned creature RE-SAVES (no already-poisoned skip gate) and refreshes to single condition + single in-place block te', async () => {
      // StinkingCloud-DISTINCT gate shape: unlike the grease/sleet twins'
      // already-prone skips, a poisoned carrier is re-forced every turn start.
      harness({ tes: [zoneTe, blockTe], conditions: ['poisoned'], meta: { poisoned: { dc: 18, ability: 'con' } } });
      monsterContext();
      mockSave(false, { promptId: 'p-refresh' });

      await processStinkingCloudAreaSave(casterName, targetName, campaignName, mapName);

      expect(savePrompt.createSaveListener).toHaveBeenCalledTimes(1);
      // exact write census: condition filter+append keeps ONE 'poisoned',
      // meta refreshes (source added to the existing stamp), and the REAL
      // registerTargetEffect replaces the existing block te IN PLACE (index 1,
      // array still length 2 — dedupe by target+effect+source).
      expect(useRuntimeState.setRuntimeValue.mock.calls).toEqual([
        [targetName, 'activeConditions', ['poisoned'], campaignName],
        [targetName, 'activeConditionMeta', { poisoned: { dc: 18, ability: 'con', source: 'stinking_cloud' } }, campaignName],
        ['campaign', 'targetEffects', [zoneTe, blockTe], campaignName, true],
      ]);
    });

    it.each([
      { label: 'forwards tracking.radius (30 → 30)', radius: 30, expectedRadius: 30 },
      { label: 'falls back to 20 when tracking.radius is missing', radius: undefined, expectedRadius: 20 },
    ])('consumes ONLY tracking.saveDc/radius — $label — while saveType stays hardcoded CON (honest bytes, latent-only vs the forwarding grease twin)', async (c) => {
      // HONEST BYTE: this lane reads tracking.saveDc + tracking.radius (with a
      // `|| 20` fallback) and HARDCODES 'CON' in the listener args and every
      // prose string — like the sleet twin ('DEX'), UNLIKE grease which
      // forwards tracking.saveType. The sole producer (handle :315) always
      // writes saveType:'CON', so a contradicted tracked saveType is a
      // latent-only quirk; re-pin if the lane ever parameterises.
      harness({ tracking: { ...baseTracking, saveType: 'DEX', radius: c.radius } });
      monsterContext();
      mockSave(false);

      const result = await processStinkingCloudAreaSave(casterName, targetName, campaignName, mapName);

      expect(rangeCheck.isWithinRange).toHaveBeenCalledWith(casterName, targetName, c.expectedRadius);
      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName,
        saveType: 'CON', // hardcoded, NOT the contradicted tracked 'DEX'
        saveDc: 18, // saveDc IS consumed from tracking
        dcSuccess: 'none',
      });
      expect(result.payload.description).toBe(
        "Thug 1 failed the CON save (DC 18) at turn start. Poisoned until the end of the current turn — can't take an Action or Bonus Action.",
      );
    });

    it('caster whitespace normalises into the tracking key (reader mirrors the writer)', async () => {
      const store = installStore(createStore({
        'Test Wizard._stinkingCloud_Test_Wizard': baseTracking,
      }));
      monsterContext();
      mockSave(true);

      const result = await processStinkingCloudAreaSave('Test Wizard', targetName, campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(store.store['Test Wizard._stinkingCloud_Test_Wizard']).toBe(baseTracking);
      expect(useRuntimeState.getRuntimeValue).toHaveBeenCalledWith(
        'Test Wizard', '_stinkingCloud_Test_Wizard', campaignName,
      );
    });
  });

  describe('error handling (floating addEntry catches, save promise)', () => {
    it('save promise rejects → PROPAGATES with only the paired ability_use logged and zero commits', async () => {
      // `await promise` (:141) sits outside any try — sleet-twin contract (the
      // grease twin swallows to null; family divergence pinned honestly).
      harness();
      monsterContext();
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'stink-reject',
        promise: Promise.reject(new Error('save cancelled')),
      });

      await expect(
        processStinkingCloudAreaSave(casterName, targetName, campaignName, mapName),
      ).rejects.toThrow('save cancelled');

      // exactly-1-log census: only the promptId-paired ability_use was posted.
      expect(logService.addEntry.mock.calls).toEqual([
        [campaignName, expect.objectContaining({ type: 'ability_use', promptId: 'stink-reject' })],
      ]);
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(damageRollback.addTargetResult).not.toHaveBeenCalled();
    });

    // No *Once chains: keyed impl targets the rejected call by entry.type,
    // immune to call-order drift.
    it.each([
      { outcome: 'failed', success: false, rejectType: 'ability_use', condWrites: 1 },
      { outcome: 'failed', success: false, rejectType: 'save_result', condWrites: 1 },
      { outcome: 'failed', success: false, rejectType: 'condition', condWrites: 1 },
      { outcome: 'successful', success: true, rejectType: 'save_result', condWrites: 0 },
    ])('addEntry rejection on $rejectType during a $outcome save is caught — exactly-1 console.error, commits complete independently', async (c) => {
      harness({ tes: [zoneTe], conditions: [], meta: {} });
      monsterContext();
      mockSave(c.success);
      logService.addEntry.mockImplementation((campaign, entry) =>
        entry.type === c.rejectType
          ? Promise.reject(new Error(`${c.rejectType} log error`))
          : Promise.resolve({}),
      );
      const consoleError = vi.spyOn(console, 'error').mockReturnValue();

      const result = await processStinkingCloudAreaSave(casterName, targetName, campaignName, mapName);

      expect(result.type).toBe('popup');
      // every log attempt still happened (full-array spend census)
      expect(logService.addEntry.mock.calls.map((e) => e[1].type)).toEqual(
        c.success ? ['ability_use', 'save_result'] : ['ability_use', 'save_result', 'condition'],
      );
      expect(consoleError).toHaveBeenCalledTimes(1);
      expect(consoleError).toHaveBeenCalledWith('[stinkingCloudAreaSave] Error:', expect.any(Error));
      // failure application completed before/independent of the log rejection;
      // the success leg commits no condition write
      const condWrites = useRuntimeState.setRuntimeValue.mock.calls.filter((w) => w[1] === 'activeConditions');
      expect(condWrites.length).toBe(c.condWrites);
      expect(damageRollback.addTargetResult).toHaveBeenCalledTimes(1);
      consoleError.mockRestore();
    });
  });
});

// ── applyStinkingCloudTurnEnd: "until the end of the current turn" ───
// LIVE seam at src/components/initiative/navigationHandlers.js:240 (end of the
// affected creature's own turn). Reads/writes/logs only — no save, no ledger.

describe('stinkingCloudHandler.applyStinkingCloudTurnEnd', () => {
  let nowSpy;

  beforeEach(() => {
    vi.resetAllMocks();
    nowSpy = vi.spyOn(Date, 'now').mockReturnValue(FROZEN_NOW);
  });

  afterEach(() => {
    nowSpy.mockRestore();
  });

  it.each([
    {
      title: 'the creature carries no stinking_cloud zone te (manual poison never auto-sheds)',
      name: targetName,
      seed: { 'campaign.targetEffects': [], 'Thug 1.activeConditions': ['poisoned'] },
      expectReads: [['campaign', 'targetEffects', campaignName]],
    },
    {
      title: 'state is already cleared (idempotent second pass)',
      name: targetName,
      seed: { 'campaign.targetEffects': [zoneTe], 'Thug 1.activeConditions': [] },
      expectReads: [
        ['campaign', 'targetEffects', campaignName],
        ['Thug 1', 'activeConditions', campaignName],
      ],
    },
    {
      title: 'targetName is missing',
      name: '',
      seed: { 'campaign.targetEffects': [zoneTe, blockTe], 'Thug 1.activeConditions': ['poisoned'] },
      expectReads: [],
    },
  ])('does nothing when $title — zero writes, zero logs', async (c) => {
    const store = installStore(createStore(c.seed));

    await applyStinkingCloudTurnEnd(campaignName, c.name);

    expect(useRuntimeState.getRuntimeValue.mock.calls).toEqual(c.expectReads);
    expect(store.setRuntimeValue).not.toHaveBeenCalled();
    expect(logService.addEntry).not.toHaveBeenCalled();
    // the seeded poison (when present) is untouched
    expect(store.store['Thug 1.activeConditions']).toEqual(c.seed['Thug 1.activeConditions']);
  });

  it('clears Poisoned + block te at end of turn — ordered read/write censuses + exactly-1 frozen-clock removal log', async () => {
    const store = installStore(createStore({
      'campaign.targetEffects': [zoneTe, blockTe],
      'Thug 1.activeConditions': ['poisoned'],
    }));

    await applyStinkingCloudTurnEnd(campaignName, targetName);

    // reads: campaign targetEffects (:44), then the creature's conditions (:54).
    expect(useRuntimeState.getRuntimeValue.mock.calls).toEqual([
      ['campaign', 'targetEffects', campaignName],
      [targetName, 'activeConditions', campaignName],
    ]);
    // writes (4-arg): block te stripped (zone marker survives for future turn
    // starts), poison shed case-insensitively.
    expect(useRuntimeState.setRuntimeValue.mock.calls).toEqual([
      ['campaign', 'targetEffects', [zoneTe], campaignName],
      [targetName, 'activeConditions', [], campaignName],
    ]);
    // exactly-1 log, full shape: the turn-end reason distinguishes this shed
    // from the turn-start save-success shed pinned above.
    expect(logService.addEntry.mock.calls).toEqual([
      [campaignName, {
        type: 'condition',
        action: 'removed',
        characterName: targetName,
        condition: 'Poisoned',
        reason: 'Stinking Cloud (end of current turn)',
        timestamp: FROZEN_NOW,
      }],
    ]);
    expect(store.store['Thug 1.activeConditions']).toEqual([]);
  });

  it('resilient to log failure: rejected removal log still clears state and logs exactly-1 console.error', async () => {
    // keyed impl (no *Once chain): the turn-end shed's only log is the
    // condition removal row.
    const store = installStore(createStore({
      'campaign.targetEffects': [zoneTe, blockTe],
      'Thug 1.activeConditions': ['poisoned'],
    }));
    logService.addEntry.mockImplementation((campaign, entry) =>
      entry.type === 'condition' ? Promise.reject(new Error('log error')) : Promise.resolve({}),
    );
    const consoleError = vi.spyOn(console, 'error').mockReturnValue();

    await applyStinkingCloudTurnEnd(campaignName, targetName);

    expect(store.store['Thug 1.activeConditions']).toEqual([]);
    expect(store.store['campaign.targetEffects']).toEqual([zoneTe]);
    expect(logService.addEntry).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith('[stinkingCloudTurnEnd] Error:', expect.any(Error));
    consoleError.mockRestore();
  });
});
