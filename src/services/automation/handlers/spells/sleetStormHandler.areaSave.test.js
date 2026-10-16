// ── sleetStorm QUARTET seam map (shared subject: sleetStormHandler.js) ──
// lane (this) — .areaSave: processSleetStormAreaSave ONLY — the recurring
//   per-creature DEX-save lane, fired at the caster-turn initiative seam by
//   expireStaleEffects.js:45 (Phase 3). LIVE-wired — SP-111 precedent,
//   contrast grease's pending-wired tracking-store. In-area enumeration
//   itself lives in expireStaleEffects (targetEffects filter
//   effect==='sleet_storm' && source===caster → per-target re-force);
//   pinned over there in expirations_expireStaleEffects.test.js.
// RAW check (2024 Essentials, verified at sleetStormHandler.js:361-403):
//   weather area spell, 20-ft-radius / 40-ft-tall cylinder, heavily obscured,
//   difficult terrain, Concentration ≤ 1 minute. Save is DEX (NOT CON) and
//   there is NO damage — appliedDamage: 0 on every addTargetResult, no
//   damage dice in the module ("2d8 cold + 1d4 bludgeoning" is ice storm,
//   not sleet storm). Fail = Prone + concentration loss. Turn-based: the
//   area persists via runtime-store tracking + concentration, expired only
//   at round seams — no clocks here (grep-verified: zero timers in module).
// Siblings (split verified by CONTENT at arrival 2026-10-16, honest):
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
// Lane-delta guards (pinned here as NO-side-effects; their positive pins
// live in #1961 — applySleetAreaSaveFailure intentionally omits them):
//   no activeConditionMeta write, no targetEffects write, no addExpiration,
//   no breakConcentration/getCombatSummary, no 'condition'/'concentration_lost'
//   log entries, no storeSpellLastAttack.
// Flags (reported, not silently kept):
//   • PRODUCTION DEFECT (pre-existing, reported): shouldSkipSleetAreaSave
//     sleetStormHandler.js:286 calls async getCombatContext WITHOUT await,
//     so ?.creatures is undefined in prod → the playerIsImmuneToCondition
//     branch is UNREACHABLE in prod. The player-immunity test below pins the
//     branch logic via sync-mock shape (what the un-awaited read expects);
//     it documents reachable intent, not current prod behavior.
//   • PENDING-WIRING: remove_sleet_storm_area expiration effect (rounds:10)
//     is PRODUCED at sleetStormHandler.js:73-76 (handle lane) but consumed
//     NOWHERE in src (grep-verified) — tracking key never cleared by that
//     expiration; same category as grease tracking-store pending-wiring.
//     The recurring-save consumption itself IS live (expireStaleEffects:45).
//   • registry note: automation/index.js dispatches BOTH 'sleet_storm' and
//     'sleet_storm_area_save' to handle() (558/585) — not to this export.
// Related refs (distinct modules, no exact-name dupes): greaseAreaSave pair
//   (closed — area-save sibling pattern), freezingSphere #20 (modal-builder),
//   calmEmotions trio (sphere-math REAL-unmocked precedent), antimagicField
//   #18 (Q1 name-split pattern — verified: no name-split issue here, this
//   filename matches its content exactly).
// ──────────────────────────────────────────────────────────────────────────────
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn().mockResolvedValue(true),
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
  addTargetResult: vi.fn().mockResolvedValue({}),
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
const TRACKING_KEY = '_sleetStorm_TestWizard';
const CONCENTRATION_KEY = '_sleetStorm_concentration_TestWizard';

function makeTracking(overrides = {}) {
  return {
    caster: casterName,
    saveDc: 15,
    saveType: 'DEX',
    radius: 20,
    ...overrides,
  };
}

// getRuntimeValue router: tracking key vs concentration key vs conditions.
// Concentration key is checked FIRST — it also startsWith('_sleetStorm_').
function routeRuntime({ activeConditions = [], concentration = [], tracking = makeTracking(), computedStats = null } = {}) {
  useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
    if (key === CONCENTRATION_KEY) return concentration;
    if (key === TRACKING_KEY) return tracking;
    if (key === 'activeConditions') return activeConditions;
    if (key === 'computedStats') return computedStats;
    return null;
  });
}

// Monster combat-context in SYNC shape: the source reads
// getCombatContext(campaignName)?.creatures un-awaited (defect flag in
// header), so only a sync return reaches the creature lookup at all.
function monsterContext(targetName = 'Goblin') {
  damageUtils.getCombatContext.mockReturnValue({
    creatures: [{ name: targetName, type: 'monster' }],
  });
}

function setupAreaSave(saveOutcome = { success: false, roll: 5, total: 5 }) {
  routeRuntime();
  monsterContext();
  rangeCheck.isWithinRange.mockResolvedValue(true);
  savePrompt.createSaveListener.mockReturnValue({
    promptId: 'sleet-area-prompt',
    promise: Promise.resolve(saveOutcome),
  });
}

// ── Tests: processSleetStormAreaSave ───────────────────────────

describe('sleetStormHandler.processSleetStormAreaSave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Deterministic baseline: clear any leaked Once-queues from prior tests,
    // restore resolved defaults for the two awaited/floating promises.
    logService.addEntry.mockReset().mockResolvedValue({});
    damageRollback.addTargetResult.mockReset().mockResolvedValue({});
    rangeCheck.isWithinRange.mockReset().mockResolvedValue(true);
    damageUtils.getCombatContext.mockReset();
    savePrompt.createSaveListener.mockReset();
    useRuntimeState.getRuntimeValue.mockReturnValue(null);
  });

  describe('tracking early returns', () => {
    it('returns null and touches nothing when no tracking data', async () => {
      const result = await processSleetStormAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(result).toBeNull();
      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
      expect(logService.addEntry).not.toHaveBeenCalled();
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('returns null when tracking has no saveDc', async () => {
      routeRuntime({ tracking: { caster: casterName } });

      const result = await processSleetStormAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(result).toBeNull();
      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
    });
  });

  describe('skip checks (shouldSkipSleetAreaSave)', () => {
    it('returns null when target is already prone (case-insensitive)', async () => {
      routeRuntime({ activeConditions: ['prone'] });
      monsterContext();
      rangeCheck.isWithinRange.mockResolvedValue(true);

      const result = await processSleetStormAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(result).toBeNull();
      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
    });

    it('returns null when target is already Prone (mixed case)', async () => {
      routeRuntime({ activeConditions: ['PrOnE'] });
      monsterContext();
      rangeCheck.isWithinRange.mockResolvedValue(true);

      const result = await processSleetStormAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(result).toBeNull();
      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
    });

    it('returns null when target is outside the area radius', async () => {
      routeRuntime({ tracking: makeTracking({ radius: 20 }) });
      monsterContext();
      rangeCheck.isWithinRange.mockResolvedValue(false);

      const result = await processSleetStormAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(result).toBeNull();
      expect(rangeCheck.isWithinRange).toHaveBeenCalledWith(casterName, 'Goblin', 20);
      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
    });

    it('skips the range check when mapName is null (proceeds with save)', async () => {
      routeRuntime();
      monsterContext();
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'sleet-area-no-map',
        promise: Promise.resolve({ success: true, roll: 14, total: 14 }),
      });

      const result = await processSleetStormAreaSave(casterName, 'Goblin', campaignName, null);

      expect(result.type).toBe('popup');
      expect(rangeCheck.isWithinRange).not.toHaveBeenCalled();
    });

    it('proceeds with save when isWithinRange throws (map data unavailable)', async () => {
      routeRuntime();
      monsterContext();
      rangeCheck.isWithinRange.mockRejectedValue(new Error('map not found'));
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'sleet-area-fallback',
        promise: Promise.resolve({ success: true, roll: 14, total: 14 }),
      });
      const consoleWarn = vi.spyOn(console, 'warn').mockReturnValue();

      const result = await processSleetStormAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(consoleWarn).toHaveBeenCalledWith(
        '[sleetStormHandler] Map data unavailable, proceeding with save:',
        expect.any(Error),
      );
      consoleWarn.mockRestore();
    });

    it('returns null when player is immune to prone condition', async () => {
      // SYNC getCombatContext shape is required to hit this branch at all —
      // prod is async-un-awaited, so the branch is UNREACHABLE in prod
      // (defect flag in header). Pins branch logic for the await-fix.
      routeRuntime({ computedStats: { immunities: ['prone'] } });
      damageUtils.getCombatContext.mockReturnValue({
        creatures: [{ name: 'Goblin', type: 'player' }],
      });
      automationImmunities.playerIsImmuneToCondition.mockReturnValue(true);
      rangeCheck.isWithinRange.mockResolvedValue(true);

      const result = await processSleetStormAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(result).toBeNull();
      expect(automationImmunities.playerIsImmuneToCondition).toHaveBeenCalledWith({
        conditionKey: 'prone',
        playerStats: { computedStats: { immunities: ['prone'] } },
        getRuntimeValue: expect.any(Function),
        campaignName,
      });
      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
    });

    it('skips the immunity check for non-player targets', async () => {
      setupAreaSave({ success: true, roll: 14, total: 14 });

      const result = await processSleetStormAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(automationImmunities.playerIsImmuneToCondition).not.toHaveBeenCalled();
    });
  });

  describe('save prompt and ability_use log', () => {
    it('creates save listener with exact params (tracking extras not forwarded)', async () => {
      setupAreaSave();

      await processSleetStormAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveType: 'DEX',
        saveDc: 15,
      });
    });

    it('posts ability_use entry with full composed description and promptId', async () => {
      setupAreaSave();

      await processSleetStormAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: casterName,
        abilityName: 'Sleet Storm',
        description: 'Goblin must make a DEX save (DC 15) or become Prone and lose Concentration (Sleet Storm area).',
        promptId: 'sleet-area-prompt',
      });
    });
  });

  describe('outcome — failed save', () => {
    it('returns popup with own full-string description', async () => {
      setupAreaSave({ success: false, roll: 5, total: 5 });

      const result = await processSleetStormAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Sleet Storm',
          description: 'Goblin failed the DEX save (DC 15). Becomes Prone and loses Concentration.',
        },
      });
    });

    it('applies prone with exact write (fresh conditions)', async () => {
      setupAreaSave({ success: false, roll: 5, total: 5 });

      await processSleetStormAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        ['prone'],
        campaignName,
      );
    });

    it('deduplicates existing conditions before appending prone', async () => {
      routeRuntime({ activeConditions: ['blinded', 'restrained'] });
      monsterContext();
      rangeCheck.isWithinRange.mockResolvedValue(true);
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'sleet-area-dedup',
        promise: Promise.resolve({ success: false, roll: 5, total: 5 }),
      });

      await processSleetStormAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        ['blinded', 'restrained', 'prone'],
        campaignName,
      );
    });

    it('calls addTargetResult with exact failure shape (zero damage)', async () => {
      setupAreaSave({ success: false, roll: 5, total: 5 });

      await processSleetStormAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(damageRollback.addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveResult: 'failure',
        roll: 5,
        total: 5,
        conditions: ['prone'],
        appliedDamage: 0,
      });
    });

    it('tracks concentration loss on failed save', async () => {
      setupAreaSave({ success: false, roll: 5, total: 5 });

      await processSleetStormAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        casterName,
        CONCENTRATION_KEY,
        ['Goblin'],
        campaignName,
      );
    });

    it('appends to existing concentration-loss list without duplicating', async () => {
      routeRuntime({ concentration: ['Orc'] });
      monsterContext();
      rangeCheck.isWithinRange.mockResolvedValue(true);
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'sleet-area-conc-append',
        promise: Promise.resolve({ success: false, roll: 5, total: 5 }),
      });

      await processSleetStormAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        casterName,
        CONCENTRATION_KEY,
        ['Orc', 'Goblin'],
        campaignName,
      );
    });

    it('does not rewrite concentration-loss list when target already tracked', async () => {
      routeRuntime({ concentration: ['Goblin'] });
      monsterContext();
      rangeCheck.isWithinRange.mockResolvedValue(true);
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'sleet-area-conc-dedup',
        promise: Promise.resolve({ success: false, roll: 5, total: 5 }),
      });

      await processSleetStormAreaSave(casterName, 'Goblin', campaignName, mapName);

      const concWrites = useRuntimeState.setRuntimeValue.mock.calls.filter((c) => c[1] === CONCENTRATION_KEY);
      expect(concWrites.length).toBe(0);
    });

    it('posts save_result failure entry with full-string description', async () => {
      setupAreaSave({ success: false, roll: 5, total: 5 });

      await processSleetStormAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'save_result',
        characterName: casterName,
        rollType: 'save-sleet-storm',
        targetName: 'Goblin',
        saveDc: 15,
        saveType: 'DEX',
        success: false,
        description: 'Goblin failed DEX save against Sleet Storm. Becomes Prone and loses Concentration.',
      });
    });

    it('lane-delta guard: area failure does NOT run handle-lane side effects', async () => {
      setupAreaSave({ success: false, roll: 5, total: 5 });

      await processSleetStormAreaSave(casterName, 'Goblin', campaignName, mapName);

      // Positive pins for all of these live in #1961 (applySleetStormProneTarget);
      // applySleetAreaSaveFailure must stay free of them.
      const keys = useRuntimeState.setRuntimeValue.mock.calls.map((c) => c[1]);
      expect(keys).not.toContain('activeConditionMeta');
      expect(keys).not.toContain('targetEffects');
      expect(expirations.addExpiration).not.toHaveBeenCalled();
      expect(concentrationService.breakConcentration).not.toHaveBeenCalled();
      expect(combatData.getCombatSummary).not.toHaveBeenCalled();
      expect(damageRollback.storeSpellLastAttack).not.toHaveBeenCalled();
      const logTypes = logService.addEntry.mock.calls.map((c) => c[1].type);
      expect(logTypes).not.toContain('condition');
      expect(logTypes).not.toContain('concentration_lost');
    });
  });

  describe('outcome — successful save', () => {
    it('returns popup with own full-string description', async () => {
      setupAreaSave({ success: true, roll: 14, total: 14 });

      const result = await processSleetStormAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Sleet Storm',
          description: 'Goblin succeeded the DEX save (DC 15). Unaffected.',
        },
      });
    });

    it('writes no prone and no concentration loss on successful save', async () => {
      setupAreaSave({ success: true, roll: 14, total: 14 });

      await processSleetStormAreaSave(casterName, 'Goblin', campaignName, mapName);

      const conditionWrites = useRuntimeState.setRuntimeValue.mock.calls.filter(
        (c) => c[1] === 'activeConditions' || c[1] === CONCENTRATION_KEY,
      );
      expect(conditionWrites.length).toBe(0);
    });

    it('calls addTargetResult with exact success shape', async () => {
      setupAreaSave({ success: true, roll: 14, total: 14 });

      await processSleetStormAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(damageRollback.addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveResult: 'success',
        roll: 14,
        total: 14,
        conditions: [],
        appliedDamage: 0,
      });
    });

    it('posts save_result success entry with full-string description', async () => {
      setupAreaSave({ success: true, roll: 14, total: 14 });

      await processSleetStormAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'save_result',
        characterName: casterName,
        rollType: 'save-sleet-storm',
        targetName: 'Goblin',
        saveDc: 15,
        saveType: 'DEX',
        success: true,
        description: 'Goblin succeeded on DEX save against Sleet Storm.',
      });
    });
  });

  describe('error handling (.catch on floating addEntry, save promise)', () => {
    it('addEntry rejection on ability_use (call #1) does not derail the save', async () => {
      setupAreaSave({ success: false, roll: 5, total: 5 });
      logService.addEntry.mockRejectedValueOnce(new Error('log error'));
      const consoleError = vi.spyOn(console, 'error').mockReturnValue();

      const result = await processSleetStormAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(logService.addEntry).toHaveBeenCalledTimes(2); // ability_use + save_result
      expect(damageRollback.addTargetResult).toHaveBeenCalled(); // save still processed
      expect(consoleError).toHaveBeenCalledTimes(1);
      expect(consoleError).toHaveBeenCalledWith('[sleetStormAreaSave] Error:', expect.any(Error));
      consoleError.mockRestore();
    });

    it('addEntry rejection on save_result failure path (call #2) is caught', async () => {
      setupAreaSave({ success: false, roll: 5, total: 5 });
      // Once-queue fires in call order: #1 ability_use resolves, #2 save_result rejects.
      logService.addEntry
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('save_result log error'));
      const consoleError = vi.spyOn(console, 'error').mockReturnValue();

      const result = await processSleetStormAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(consoleError).toHaveBeenCalledTimes(1);
      expect(consoleError).toHaveBeenCalledWith('[sleetStormAreaSave] Error:', expect.any(Error));
      // Failure application completed before/independent of the log rejection
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        ['prone'],
        campaignName,
      );
      consoleError.mockRestore();
    });

    it('addEntry rejection on save_result success path (call #2) is caught', async () => {
      setupAreaSave({ success: true, roll: 14, total: 14 });
      logService.addEntry
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('save_result log error'));
      const consoleError = vi.spyOn(console, 'error').mockReturnValue();

      const result = await processSleetStormAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(consoleError).toHaveBeenCalledTimes(1);
      expect(consoleError).toHaveBeenCalledWith('[sleetStormAreaSave] Error:', expect.any(Error));
      consoleError.mockRestore();
    });

    it('rejects without side effects when the save prompt promise rejects', async () => {
      setupAreaSave();
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'sleet-area-reject',
        promise: Promise.reject(new Error('save cancelled')),
      });

      await expect(
        processSleetStormAreaSave(casterName, 'Goblin', campaignName, mapName),
      ).rejects.toThrow('save cancelled');

      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(damageRollback.addTargetResult).not.toHaveBeenCalled();
    });
  });
});
