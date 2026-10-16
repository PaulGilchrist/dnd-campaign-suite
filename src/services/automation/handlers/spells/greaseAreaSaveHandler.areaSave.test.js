import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── PAIR seam map (greaseAreaSaveHandler.js — this file + handle.test.js) ─
// THIS file (#1921) — processGreaseAreaSave lane, area-save CONTENT:
//   tracking guards (exact-key `_grease_<caster>` lookup), in-area check
//   (isWithinRange at tracking.radius), player-immunity + already-prone skip
//   gates, per-creature DEX save via createSaveListener, prone-on-fail via
//   REAL addCondition (conditionSaveService owns its internals), rollback
//   ledger write (addTargetResult), ability_use/save_result logs, popup prose.
// SIBLING greaseAreaSaveHandler.handle.test.js (#1922) — handle()
//   orchestration: buildSaveDc, caster map position (loadMapData), cast log,
//   _grease_<caster> tracking STORE, addExpiration(remove_grease_area),
//   setCondition modal payload.
// Liveness (verified 2026-10-16): handle() is LIVE — index.js:556 registers
//   'grease_area_save' (5e spells.json grease automation[1]). processGreaseAreaSave
//   has ZERO production callers: expireStaleEffects.js wires sleet (Phase 3),
//   stinking_cloud (SP-111) and web (SP-126) recurring turn-start lanes but NOT
//   grease, and 'remove_grease_area' has no consumer in the expiration-clearing
//   lane (grep-zero). RAW SP-056 expects enter/turn-end re-saves — flag this
//   unwired recurring lane (SP-126 precedent) rather than deleting the contract;
//   these tests pin it honest until it is wired or retired.
// Notes: processGreaseAreaSave never touches placedItems/players or loadMapData
//   (position lives behind isWithinRange); the mapsService mock remains only to
//   isolate module-import side effects of the paired handle() module graph.

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
  addEntry: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isDistanceInRange: vi.fn((dist, rangeFt) => rangeFt == null || dist == null || dist <= rangeFt),
  isWithinRange: vi.fn().mockResolvedValue(true),
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
function setupRuntime({ tracking = makeGreaseTracking(), conditions = [], computedStats = null, lastAttack = null } = {}) {
  useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
    if (key === TRACKING_KEY) return tracking;
    if (key === 'activeConditions') return conditions;
    if (key === 'computedStats') return computedStats;
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
  rangeCheck.isWithinRange.mockResolvedValue(true);
  mockSaveOutcome(success, rollExtras);
}

// ── Tests ──────────────────────────────────────────────────────

describe('greaseAreaSaveHandler.processGreaseAreaSave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('tracking + map guards', () => {
    it('reads tracking by exact key and returns null when tracking or map is missing', async () => {
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

      // valid tracking but no map → guard fires BEFORE any range check
      setupRuntime();
      expect(await processGreaseAreaSave(casterName, 'Goblin', campaignName, undefined)).toBeNull();
      expect(rangeCheck.isWithinRange).not.toHaveBeenCalled();
      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
    });
  });

  describe('area membership', () => {
    it('checks the target against tracking.radius and skips the save when out of area', async () => {
      setupRuntime();
      setMonsterContext();
      rangeCheck.isWithinRange.mockResolvedValue(false);

      expect(await processGreaseAreaSave(casterName, 'Goblin', campaignName, mapName)).toBeNull();
      expect(rangeCheck.isWithinRange).toHaveBeenCalledWith(casterName, 'Goblin', 10);
      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
    });
  });

  describe('skip gates', () => {
    it('returns null for already-prone targets, case-insensitively, without prompting', async () => {
      setupRuntime({ conditions: ['prone'] });
      setMonsterContext();
      rangeCheck.isWithinRange.mockResolvedValue(true);
      expect(await processGreaseAreaSave(casterName, 'Goblin', campaignName, mapName)).toBeNull();

      // mixed case still skips
      setupRuntime({ conditions: ['PrOnE'] });
      expect(await processGreaseAreaSave(casterName, 'Goblin', campaignName, mapName)).toBeNull();

      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
    });

    it('returns null for immune players and skips the immunity check for monsters', async () => {
      // immune player → null, no save prompt
      setupRuntime({ computedStats: { immunities: ['prone'] } });
      setPlayerContext();
      rangeCheck.isWithinRange.mockResolvedValue(true);
      automationImmunities.playerIsImmuneToCondition.mockReturnValue(true);

      expect(await processGreaseAreaSave(casterName, 'Goblin', campaignName, mapName)).toBeNull();
      expect(automationImmunities.playerIsImmuneToCondition).toHaveBeenCalledWith({
        conditionKey: 'prone',
        playerStats: { computedStats: { immunities: ['prone'] } },
        getRuntimeValue: expect.any(Function),
        campaignName,
      });
      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();

      // monster → immunity check skipped entirely, save proceeds
      setupRuntime();
      setMonsterContext();
      automationImmunities.playerIsImmuneToCondition.mockClear();
      mockSaveOutcome(true);

      const result = await processGreaseAreaSave(casterName, 'Goblin', campaignName, mapName);
      expect(result.type).toBe('popup');
      expect(automationImmunities.playerIsImmuneToCondition).not.toHaveBeenCalled();
    });
  });

  describe('save processing', () => {
    it('requests a DEX save at the tracked DC via createSaveListener', async () => {
      setupInAreaMonsterSave(false);

      await processGreaseAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveType: 'DEX',
        saveDc: 13,
      });
    });

    it('returns the exact popup contract for failed and successful saves', async () => {
      setupInAreaMonsterSave(false);
      expect(await processGreaseAreaSave(casterName, 'Goblin', campaignName, mapName)).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Grease',
          description: 'Goblin failed the DEX save (DC 13). Becomes Prone.',
        },
      });

      setupInAreaMonsterSave(true);
      expect(await processGreaseAreaSave(casterName, 'Goblin', campaignName, mapName)).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Grease',
          description: 'Goblin succeeded the DEX save (DC 13). Unaffected.',
        },
      });
    });

    it('writes the prone condition on a failed save only', async () => {
      setupInAreaMonsterSave(false);
      await processGreaseAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        ['prone'],
        campaignName,
      );

      setupInAreaMonsterSave(true);
      useRuntimeState.setRuntimeValue.mockClear();
      await processGreaseAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        expect.anything(),
        campaignName,
      );
    });

    it('maps tracking.condition to a lowercase, deduplicated condition key', async () => {
      // addCondition (real callee) dedupes by conditionDef.key — this pins
      // the handler's tracking.condition → key mapping, not callee internals.
      setupRuntime({ tracking: makeGreaseTracking({ condition: 'Blinded' }), conditions: ['blinded', 'frightened'] });
      setMonsterContext();
      rangeCheck.isWithinRange.mockResolvedValue(true);
      mockSaveOutcome(false);

      await processGreaseAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        ['frightened', 'blinded'],
        campaignName,
      );
    });

    it('records the save outcome on the spell-save rollback ledger', async () => {
      // addTargetResult no-ops unless campaign lastAttack is a spell-save;
      // seed it, then pin the handler-written entry shape exactly.
      setupInAreaMonsterSave(false, { roll: 4, total: 7, promptId: 'fb' });
      setupRuntime({ lastAttack: { rollType: 'spell-save', targetResults: [] } });

      await processGreaseAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'campaign',
        'lastAttack',
        expect.objectContaining({
          targetResults: [{ targetName: 'Goblin', saveResult: 'failure', roll: 4, total: 7, conditions: ['prone'], appliedDamage: 0 }],
          affectedTargets: ['Goblin'],
          statusEffects: ['prone'],
          damageApplied: false,
        }),
        campaignName,
      );

      setupInAreaMonsterSave(true, { roll: 15, total: 18, promptId: 'ok' });
      setupRuntime({ lastAttack: { rollType: 'spell-save', targetResults: [] } });
      useRuntimeState.setRuntimeValue.mockClear();

      await processGreaseAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'campaign',
        'lastAttack',
        expect.objectContaining({
          targetResults: [{ targetName: 'Goblin', saveResult: 'success', roll: 15, total: 18, conditions: [], appliedDamage: 0 }],
        }),
        campaignName,
      );
    });
  });

  describe('logs', () => {
    it('logs the ability_use prompt trigger with full description and promptId', async () => {
      setupInAreaMonsterSave(false, { promptId: 'p1' });

      await processGreaseAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: casterName,
        abilityName: 'Grease',
        description: 'Goblin must make a DEX save (DC 13) or become Prone (Grease area).',
        promptId: 'p1',
      });
    });

    it('logs save_result with exact descriptions on failed and successful saves', async () => {
      setupInAreaMonsterSave(false);
      await processGreaseAreaSave(casterName, 'Goblin', campaignName, mapName);

      let saveResultCall = logService.addEntry.mock.calls.find(([, e]) => e.type === 'save_result');
      expect(saveResultCall[1]).toEqual({
        type: 'save_result',
        characterName: casterName,
        rollType: 'save-grease',
        targetName: 'Goblin',
        saveDc: 13,
        saveType: 'DEX',
        success: false,
        description: 'Goblin failed DEX save against Grease. Becomes Prone.',
      });

      logService.addEntry.mockClear();
      setupInAreaMonsterSave(true);
      await processGreaseAreaSave(casterName, 'Goblin', campaignName, mapName);

      saveResultCall = logService.addEntry.mock.calls.find(([, e]) => e.type === 'save_result');
      expect(saveResultCall[1]).toEqual({
        type: 'save_result',
        characterName: casterName,
        rollType: 'save-grease',
        targetName: 'Goblin',
        saveDc: 13,
        saveType: 'DEX',
        success: true,
        description: 'Goblin succeeded on DEX save against Grease.',
      });
    });
  });

  describe('error handling', () => {
    it('returns null when the area check rejects', async () => {
      setupRuntime();
      setMonsterContext();
      rangeCheck.isWithinRange.mockRejectedValue(new Error('range lookup failed'));

      expect(await processGreaseAreaSave(casterName, 'Goblin', campaignName, mapName)).toBeNull();
      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
    });

    it('returns null and applies nothing when the save promise rejects', async () => {
      setupRuntime();
      setMonsterContext();
      rangeCheck.isWithinRange.mockResolvedValue(true);
      vi.mocked(savePrompt.createSaveListener).mockReturnValue({
        promptId: 'grease-reject',
        promise: Promise.reject(new Error('prompt lost')),
      });

      expect(await processGreaseAreaSave(casterName, 'Goblin', campaignName, mapName)).toBeNull();
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        expect.anything(),
        campaignName,
      );
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
