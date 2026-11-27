// @maintained-by-ai 2026-11-27 — IMPROVE-AND-TRIM pass (#1921): 17→13 cases; full-sequence commit/log censuses merged per outcome; real addCondition meta-stamp + gate-order + key-normalisation pins added; resetAllMocks-safe factories; header claims re-verified vs current bytes
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── PAIR seam map (greaseAreaSaveHandler.js — this file + handle.test.js) ─
// THIS file (#1921) — processGreaseAreaSave lane, area-save CONTENT:
//   tracking guards (exact-key `_grease_<caster>` lookup incl. whitespace
//   normalisation), in-area check (isWithinRange at tracking.radius), gate
//   ORDER (area → immunity → prone), player-immunity + already-prone skip
//   gates, per-creature DEX save via createSaveListener, prone-on-fail via
//   REAL addCondition (conditionSaveService owns its internals: key dedupe,
//   lowercase map, activeConditionMeta dc/ability stamp), rollback ledger
//   write (addTargetResult), ability_use/save_result log census, popup prose.
// SIBLING greaseAreaSaveHandler.handle.test.js (#1922) — handle()
//   orchestration: buildSaveDc, caster map position (loadMapData), cast log,
//   _grease_<caster> tracking STORE, addExpiration(remove_grease_area),
//   setCondition modal payload.
// Liveness (re-verified 2026-11-27 against current bytes; WIRED 2026-11-19
//   per owner "WIRE IT"):
//   handle() is LIVE — index.js:556 registers 'grease_area_save' (both
//   rulesets' spells.json after the 2024 parity entry; trio discrimination
//   L556-558 is owned by index.webDispatch.test.js, not re-pinned here).
//   processGreaseAreaSave is dispatched by expireStaleEffects.js Phase 6
//   (:8 import, :131 processZoneTurnStartSaves effectKey 'grease',
//   trackingPrefix 'grease') at each grease-te carrier's turn start
//   (SP-111/SP-126 zone pattern, pinned by expireStaleEffects.grease.test.js),
//   and 'remove_grease_area' has a clearExpirationEffects.js EXPIRATION_HANDLERS
//   consumer (:590) that nulls the tracking key and strips the caster's grease
//   tes (pinned by clearExpirationEffects.grease-sleet-zone-expiry.test.js).
//   RAW SP-056 enter/turn re-saves are served by the turn-start seam; these
//   tests own the recurring-save CONTENT behind that seam.
// Family twins (areaSave .areaSave lanes): sleet/web/stinkingCloud share the
//   guard skeleton (tracking → map → in-area → immunity → already-condition →
//   save). Every assertion below pins grease-DISTINCT bytes ('_grease_<caster>'
//   key, 'save-grease' rollType, Grease popup/log prose, hardcoded 'Prone').
//   Where a sibling's assertion is identical except the handler name, a
//   family-wide it.each consolidation is a REPORT-ONLY recommendation
//   (cross-file, never implemented here).
// Arity (per #1878): every getRuntimeValue CALL this lane makes is 3-arg in
//   source bytes (:211 tracking, :158 activeConditions) while the real
//   getRuntimeValue is 2-param (read-side campaignName is inert) — pins match
//   the source call, not the signature. setRuntimeValue writes ARE 4-arg with
//   campaignName threaded (write-side threading is real); the real addCondition
//   callee's 2-arg activeConditions read routes through the same mocked getter.
// Duration policy: this lane stores NO durations/expirations (handle-lane
//   owns those). Divergence noted cross-file only: handle's '1_minute'→10
//   rounds minutes×10 encoding (greaseAreaSaveHandler.js:106-112) predates the
//   ≥1min-combat-scoped canon — handle.test.js should cite #1822 precedent.
// Notes: processGreaseAreaSave never touches placedItems/players or loadMapData
//   (position lives behind isWithinRange); the mapsService/expirations mocks
//   remain only to isolate module-import side effects of the paired handle()
//   graph. savePrompt.buildSaveDc is import-graph-only (process lane never
//   calls it). Mock factories carry BASE implementations inline (vi.fn(async…))
//   so they survive vi.resetAllMocks() — no *Once chains, no mid-test
//   re-harness beyond the exact-key runtime router.

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(async () => ({})),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(async () => {}),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isDistanceInRange: vi.fn((dist, rangeFt) => rangeFt == null || dist == null || dist <= rangeFt),
  isWithinRange: vi.fn(async () => true),
}));

// Import-side-effect isolation only — processGreaseAreaSave never calls loadMapData.
vi.mock('../../../maps/mapsService.js', () => ({
  loadMapData: vi.fn(),
}));

vi.mock('../../../combat/automation/automationImmunities.js', () => ({
  playerIsImmuneToCondition: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { processGreaseAreaSave } from './greaseAreaSaveHandler.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as rangeCheck from '../../../rules/combat/rangeCheck.js';
import * as automationImmunities from '../../../combat/automation/automationImmunities.js';

// ── Constants & Helpers ────────────────────────────────────────

const campaignName = 'TestCampaign';
const mapName = 'test-map';
const casterName = 'TestWizard';
const TRACKING_KEY = '_grease_TestWizard';

function makeGreaseTracking(overrides = {}) {
  return {
    caster: casterName,
    center: { gridX: 5, gridY: 10 },
    saveDc: 13,
    saveType: 'DEX',
    condition: 'Prone',
    radius: 10,
    ...overrides,
  };
}

// Exact-key router over the mocked runtime store. Fresh objects per read so
// addTargetResult's spread of `existing` can't leak across assertions.
// NOTE (Option A landing): there is NO `computedStats` bucket key any more —
// the immunity gates receive the roster-resolved stats as the processXxxAreaSave
// targetStats PARAMETER (bug-zone-save-computedstats-bucket-has-no-producer).
function setupRuntime({ tracking = makeGreaseTracking(), conditions = [], lastAttack = null } = {}) {
  useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
    if (key === TRACKING_KEY) return tracking;
    if (key === 'activeConditions') return conditions;
    if (key === 'lastAttack') return lastAttack ?? { rollType: null };
    return null;
  });
}

function setMonsterContext() {
  damageUtils.getCombatContext.mockResolvedValue({
    creatures: [{ name: 'Goblin', type: 'monster' }],
  });
}

function setPlayerContext() {
  damageUtils.getCombatContext.mockResolvedValue({
    creatures: [{ name: 'Goblin', type: 'player' }],
  });
}

function mockSaveOutcome(success, { promptId, ...rollExtras } = {}) {
  vi.mocked(savePrompt.createSaveListener).mockReturnValue({
    promptId: promptId ?? `grease-${success ? 'ok' : 'fail'}`,
    promise: Promise.resolve({ success, ...rollExtras }),
  });
}

// Happy-path base: in-area monster, valid tracking, save resolves `success`.
function setupInAreaMonsterSave(success, rollExtras = {}) {
  setupRuntime();
  setMonsterContext();
  mockSaveOutcome(success, rollExtras);
}

// ── Tests ──────────────────────────────────────────────────────

describe('greaseAreaSaveHandler.processGreaseAreaSave', () => {
  beforeEach(() => {
    vi.resetAllMocks(); // factories carry inline base impls — nothing to reinstall
  });

  describe('tracking + map guards', () => {
    it('returns null for missing/invalid tracking or missing map before touching any later channel, and normalises whitespace in the caster-key', async () => {
      setupRuntime({ tracking: null });
      expect(await processGreaseAreaSave(casterName, 'Goblin', campaignName, mapName)).toBeNull();
      expect(useRuntimeState.getRuntimeValue).toHaveBeenCalledWith(casterName, TRACKING_KEY, campaignName);
      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();

      // tracking without center → guard
      setupRuntime({ tracking: makeGreaseTracking({ center: null }) });
      expect(await processGreaseAreaSave(casterName, 'Goblin', campaignName, mapName)).toBeNull();

      // tracking without saveDc → guard
      setupRuntime({ tracking: makeGreaseTracking({ saveDc: undefined }) });
      expect(await processGreaseAreaSave(casterName, 'Goblin', campaignName, mapName)).toBeNull();

      // valid tracking but no map → guard fires BEFORE any range check or spend
      setupRuntime();
      expect(await processGreaseAreaSave(casterName, 'Goblin', campaignName, undefined)).toBeNull();
      expect(rangeCheck.isWithinRange).not.toHaveBeenCalled();
      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
      expect(logService.addEntry).not.toHaveBeenCalled();
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();

      // reader mirrors the writer's key normalisation (handle stores
      // `_grease_${caster.replace(/\s+/g,'_')}`): 'Test Wizard' → _grease_Test_Wizard
      setupRuntime();
      expect(await processGreaseAreaSave('Test Wizard', 'Goblin', campaignName, mapName)).toBeNull();
      expect(useRuntimeState.getRuntimeValue).toHaveBeenLastCalledWith('Test Wizard', '_grease_Test_Wizard', campaignName);
    });
  });

  describe('area membership', () => {
    it.each([
      ['resolves false (target left the area)', async () => false],
      ['rejects (area lookup failed)', async () => { throw new Error('range lookup failed'); }],
    ])('skips the save entirely when the in-area check %s — gate-order pins: immunity context never fetched, zero spends', async (_case, impl) => {
      setupRuntime();
      rangeCheck.isWithinRange.mockImplementation(impl);

      expect(await processGreaseAreaSave(casterName, 'Goblin', campaignName, mapName)).toBeNull();
      expect(rangeCheck.isWithinRange).toHaveBeenCalledWith(casterName, 'Goblin', 10);
      // gate ORDER: the immunity gate (behind isWithinRange) is never reached
      expect(damageUtils.getCombatContext).not.toHaveBeenCalled();
      expect(automationImmunities.playerIsImmuneToCondition).not.toHaveBeenCalled();
      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
      expect(logService.addEntry).not.toHaveBeenCalled();
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('skip gates', () => {
    it('already-prone target is skipped case-insensitively — no prompt, no logs, no writes', async () => {
      setupRuntime({ conditions: ['prone'] });
      setMonsterContext();
      expect(await processGreaseAreaSave(casterName, 'Goblin', campaignName, mapName)).toBeNull();

      // mixed case still skips
      setupRuntime({ conditions: ['PrOnE'] });
      expect(await processGreaseAreaSave(casterName, 'Goblin', campaignName, mapName)).toBeNull();

      // prone check reads the exact 3-arg key source uses (:158)
      expect(useRuntimeState.getRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', campaignName);
      // monster row → immunity gate short-circuits on type, never consults the rule
      expect(automationImmunities.playerIsImmuneToCondition).not.toHaveBeenCalled();
      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
      expect(logService.addEntry).not.toHaveBeenCalled();
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('immune player is SKIPPED: gate receives the PASSED roster stats verbatim and immune=true short-circuits BEFORE the prone read', async () => {
      // LIVE PIN (Option A landing, bug-zone-save-computedstats-bucket-has-no-producer):
      // the awaited ASYNC combat context resolves the PLAYER row so the immunity
      // branch is reachable exactly as in production, and the stats object is the
      // targetStats PARAMETER the expireStaleEffects sweep threads from the caller's
      // roster (`characters.find(...) → computedStats || character`) — never a
      // runtime `computedStats` bucket (which has NO producer). The exact-array
      // read census below pins BOTH: no computedStats key read AND the immune
      // return pre-empts the later activeConditions (prone) read — a re-ordered
      // gate fails the census.
      const rosterStats = { name: 'Goblin', immunities: ['prone'] };
      setupRuntime();
      setPlayerContext();
      automationImmunities.playerIsImmuneToCondition.mockReturnValue(true);

      expect(await processGreaseAreaSave(casterName, 'Goblin', campaignName, mapName, rosterStats)).toBeNull();
      expect(automationImmunities.playerIsImmuneToCondition).toHaveBeenCalledWith({
        conditionKey: 'prone',
        playerStats: rosterStats,
        getRuntimeValue: expect.any(Function),
        campaignName,
      });
      expect(useRuntimeState.getRuntimeValue.mock.calls).toEqual([
        [casterName, TRACKING_KEY, campaignName],
      ]);
      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
      expect(logService.addEntry).not.toHaveBeenCalled();
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it.each([
      ['roster-resolved stats', { name: 'Goblin', immunities: [] }],
      ['absent roster target (undefined stats → the rule guard answers false)', undefined],
    ])('non-immune player with %s proceeds to the save — gate receives the param verbatim, success applies nothing', async (_case, stats) => {
      setupRuntime();
      setPlayerContext();
      automationImmunities.playerIsImmuneToCondition.mockReturnValue(false);
      mockSaveOutcome(true);

      const result = await processGreaseAreaSave(casterName, 'Goblin', campaignName, mapName, stats);

      expect(result.type).toBe('popup');
      expect(automationImmunities.playerIsImmuneToCondition).toHaveBeenCalledWith({
        conditionKey: 'prone',
        playerStats: stats,
        getRuntimeValue: expect.any(Function),
        campaignName,
      });
      expect(savePrompt.createSaveListener).toHaveBeenCalledTimes(1);
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('immunity leg is player-only: monster row with an immunity-carrying stats arg still saves', async () => {
      setupRuntime();
      setMonsterContext();
      automationImmunities.playerIsImmuneToCondition.mockReturnValue(true);
      mockSaveOutcome(true);

      const result = await processGreaseAreaSave(casterName, 'Goblin', campaignName, mapName, { name: 'Goblin', immunities: ['prone'] });
      expect(result.type).toBe('popup');
      expect(automationImmunities.playerIsImmuneToCondition).not.toHaveBeenCalled();
    });
  });

  describe('save outcome sequences', () => {
    it('failed save — exact request, ordered log census (promptId-paired), popup, and ordered write census condition→meta→ledger', async () => {
      setupInAreaMonsterSave(false, { roll: 4, total: 7, promptId: 'p-fail' });
      setupRuntime({ lastAttack: { rollType: 'spell-save', targetResults: [] } });

      const result = await processGreaseAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Grease',
          description: 'Goblin failed the DEX save (DC 13). Becomes Prone.',
        },
      });

      // re-forced at the turn-start seam: DEX save at the tracked DC, ONE listener
      expect(savePrompt.createSaveListener).toHaveBeenCalledTimes(1);
      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveType: 'DEX',
        saveDc: 13,
      });

      // ordered full-array log census: ability_use carries the SAME promptId the
      // listener returned (pairing), then the save_result outcome entry.
      expect(logService.addEntry.mock.calls).toEqual([
        [campaignName, {
          type: 'ability_use',
          characterName: casterName,
          abilityName: 'Grease',
          description: 'Goblin must make a DEX save (DC 13) or become Prone (Grease area).',
          promptId: 'p-fail',
        }],
        [campaignName, {
          type: 'save_result',
          characterName: casterName,
          rollType: 'save-grease',
          targetName: 'Goblin',
          saveDc: 13,
          saveType: 'DEX',
          success: false,
          description: 'Goblin failed DEX save against Grease. Becomes Prone.',
        }],
      ]);

      // ordered full-array write census (4-arg, campaignName threaded):
      // real addCondition writes the condition, stamps meta from the TRACKED
      // dc/ability, then the handler writes the rollback-ledger entry.
      expect(useRuntimeState.setRuntimeValue.mock.calls).toEqual([
        ['Goblin', 'activeConditions', ['prone'], campaignName],
        ['Goblin', 'activeConditionMeta', { prone: { dc: 13, ability: 'DEX' } }, campaignName],
        ['campaign', 'lastAttack', expect.objectContaining({
          targetResults: [{ targetName: 'Goblin', saveResult: 'failure', roll: 4, total: 7, conditions: ['prone'], appliedDamage: 0 }],
          affectedTargets: ['Goblin'],
          statusEffects: ['prone'],
          damageApplied: false,
        }), campaignName],
      ]);
    });

    it('successful save — popup + logs only; condition/meta write census is EXACTLY the ledger entry (empty conditions)', async () => {
      setupInAreaMonsterSave(true, { roll: 15, total: 18, promptId: 'p-ok' });
      setupRuntime({ lastAttack: { rollType: 'spell-save', targetResults: [] } });

      const result = await processGreaseAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Grease',
          description: 'Goblin succeeded the DEX save (DC 13). Unaffected.',
        },
      });

      expect(logService.addEntry.mock.calls).toEqual([
        [campaignName, {
          type: 'ability_use',
          characterName: casterName,
          abilityName: 'Grease',
          description: 'Goblin must make a DEX save (DC 13) or become Prone (Grease area).',
          promptId: 'p-ok',
        }],
        [campaignName, {
          type: 'save_result',
          characterName: casterName,
          rollType: 'save-grease',
          targetName: 'Goblin',
          saveDc: 13,
          saveType: 'DEX',
          success: true,
          description: 'Goblin succeeded on DEX save against Grease.',
        }],
      ]);

      // success leg: NO addCondition ran — the ledger write is the ONLY write
      expect(useRuntimeState.setRuntimeValue.mock.calls).toEqual([
        ['campaign', 'lastAttack', expect.objectContaining({
          targetResults: [{ targetName: 'Goblin', saveResult: 'success', roll: 15, total: 18, conditions: [], appliedDamage: 0 }],
          affectedTargets: ['Goblin'],
          statusEffects: [],
          damageApplied: false,
        }), campaignName],
      ]);
    });

    it('tracking.condition/saveType/saveDc drive the key mapping, meta stamp and request (prose stays grease-hardcoded, pinned honestly)', async () => {
      // addCondition (real callee) dedupes by conditionDef.key — this pins the
      // handler's tracking→{key,dc,ability} mapping, not callee internals.
      setupRuntime({
        tracking: makeGreaseTracking({ condition: 'Blinded', saveType: 'CON', saveDc: 15 }),
        conditions: ['blinded', 'frightened'],
      });
      setMonsterContext();
      mockSaveOutcome(false);

      const result = await processGreaseAreaSave(casterName, 'Goblin', campaignName, mapName);

      // 'blinded' ≠ 'prone' → the already-prone gate does NOT skip this target
      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveType: 'CON',
        saveDc: 15,
      });
      // HONEST BYTE: the popup prose hardcodes 'Becomes Prone.' regardless of
      // tracking.condition — grease's rules JSON only ever inflicts Prone, so
      // this is a latent-only quirk; re-pin if conditionInflicted is parameterised.
      expect(result.payload.description).toBe('Goblin failed the CON save (DC 15). Becomes Prone.');

      // lowercase + dedupe reorder, meta stamped from tracked dc/ability;
      // lastAttack is rollType:null here → addTargetResult no-ops (no 3rd write)
      expect(useRuntimeState.setRuntimeValue.mock.calls).toEqual([
        ['Goblin', 'activeConditions', ['frightened', 'blinded'], campaignName],
        ['Goblin', 'activeConditionMeta', { blinded: { dc: 15, ability: 'CON' } }, campaignName],
      ]);
    });
  });

  describe('error handling', () => {
    it('save promise rejects → null with zero writes and no save_result log (only the paired ability_use was logged)', async () => {
      setupRuntime();
      setMonsterContext();
      vi.mocked(savePrompt.createSaveListener).mockReturnValue({
        promptId: 'grease-reject',
        promise: Promise.reject(new Error('prompt lost')),
      });

      expect(await processGreaseAreaSave(casterName, 'Goblin', campaignName, mapName)).toBeNull();
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(logService.addEntry).toHaveBeenCalledTimes(1);
      expect(logService.addEntry.mock.calls[0][1].type).toBe('ability_use');
    });

    it('propagates errors thrown by the tracking lookup (guard sits outside the try)', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation(() => {
        throw new Error('runtime error');
      });

      await expect(
        processGreaseAreaSave(casterName, 'Goblin', campaignName, mapName),
      ).rejects.toThrow('runtime error');
    });
  });
});
