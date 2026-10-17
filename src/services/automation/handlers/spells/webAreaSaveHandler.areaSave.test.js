// @maintained-by-ai
// ── webAreaSave QUINTET seam map (shared subject: webAreaSaveHandler.js) ──
// lane (this file, .areaSave) — RECURRING area-save CONTENT:
//   processWebAreaSave ONLY (+ its private callees webTargetIsImmune,
//   restrainRecurringWebTarget, recordWebAreaSaveSuccess). The other four
//   quintet files import handle() only; this is the ONLY quintet file that
//   imports processWebAreaSave — split verified by CONTENT at arrival 2026-10-16.
// WIRED (verified live 2026-10-16, SP-111 Phase-5 pattern, SP-126 web):
//   expireStaleEffects.js:7 imports processWebAreaSave; :112 Phase 5 consumes
//   it via processZoneTurnStartSaves({ effectKey: 'web', trackingPrefix: 'web' })
//   at each carrier's turn-start initiative seam, invoking
//   processSave(te.source, activeName, campaignName, zoneTracking.mapName) —
//   4-arg arity matches this export's (casterName, targetName, campaignName,
//   mapName). In-area enumeration is consumer-side (targetEffects te.target ===
//   active creature + te.effect === 'web'); consumer routing pinned in
//   expireStaleEffects.web.test.js:76 (exact 4-arg call + negative legs).
//   CONTRAST grease pair: processGreaseAreaSave has ZERO production callers
//   (pending-wiring, flagged in its closed pair) — web is WIRED, like sleet
//   (expireStaleEffects.js:45 Phase 3) and stinkingCloud (:106 Phase 4).
// RAW check (verified honestly at webAreaSaveHandler.js source):
//   2024 Essentials Web — 60-ft range, 20-ft cube, Concentration ≤ 1 hour.
//   Cast-time: DEX save per creature in area (:213-236), Restrained on fail
//   (:88-142). Recurring (this lane): STR save (NOT DEX, :334-338) at each
//   turn start while zone persists, Restrained on fail; already-Restrained
//   creatures skip the recurring save (:328-330) — breaking free via a STR
//   (Athletics) ACTION is GM-adjudicated (header :23-24), NOT the recurring
//   save — so "DEX DC to break out" does not exist here; recurring break-out
//   is the STR save, cast restraint is DEX. NO fire mechanics implemented
//   (flammability / 2d4 burn-away is an accepted source gap, header :29) —
//   no burn/burn-away tests written. NO damage anywhere in the module:
//   appliedDamage: 0 on every addTargetResult (:40, :112, :274, :296).
// Siblings (exact split by filename-content, canonical homes decided at source):
//   #1990 .edgeCases — handle() guards/odd shapes: existing-restrained refresh,
//     empty selected-name matches, null combatSummary, missing spellAbilities/
//     proficiency fallback DCs, missing action.automation, roll-less saveResult.
//   #1991 .errors     — handle() console.error catch legs: ability_use,
//     save_result success/failure, condition log rejections ([web] prefix).
//   #1992 .test (main)— handle() cast orchestration: combat-context gate,
//     target selection, buildSaveDc, heightenTarget disadvantage, Restrained
//     apply + activeConditionMeta, expiration registrations, storeSpellLastAttack.
//   #1993 .zone      — handle() zone registration/tracking store: exact
//     `_web_<caster>` key content, web zone te for EVERY target, ONE merged
//     600-round zone expiration (CLA-334 hours→rounds ×600), registry 'web'
//     definition, no-racing double-write guard.
//   this file       — recurring turn-start STR-save lane, all pins below
//   (next in queue, #1994 superiorDefenseHandler.test.js, is a NEW subject).
// Liveness of handle(): automation/index.js:271 import, :557 dispatches
//   'web_area_save' → handle (grep-verified); fired by
//   useSimpleSpellHandlers.js:345 areaExecute('web_area_save','DEX').
// Arity class: every getRuntimeValue call reachable from this lane is 3-arg
//   (tracking read :312, activeConditions :328/:263, computedStats :252);
//   the 2-arg getRuntimeValue('campaign','targetEffects') :55 is handle-lane
//   only (pinned in #1993). setRuntimeValue writes are 4-arg, campaignName last.
// No timers (guard:no-timers compliant): this lane has zero setTimeout/
//   setInterval/Date.now; zone lifetime lives in handle-lane expiration rounds
//   (600 = CLA-334 ×600 hours encoding, round-counter matured at seams,
//   same pattern family as stinkingCloud rounds×10, flagged there — #1906
//   minutes×N family does not produce minutes×N in web; only hours×600).
// Lane-delta NO-side-effect guards vs handle lane: this lane never writes
//   targetEffects, never calls addExpiration/storeSpellLastAttack/
//   registerSpellConcentration/buildSaveDc, never writes activeConditionMeta
//   (restrainRecurringWebTarget omits it; cast lane :96-104 owns it).
// Flags (reported, not silently kept):
//   • PRODUCTION DEFECT (pre-existing, same class as sleetStorm :286):
//     webTargetIsImmune.js:249 calls async getCombatContext (damageUtils.js:40)
//     WITHOUT await → ?.creatures is undefined in prod → the player-immunity
//     branch is UNREACHABLE in prod. The immunity test below pins branch logic
//     via the sync-mock shape (what the un-awaited read expects) — documents
//     reachable intent, not current prod behavior. The non-player skip test
//     passes under both shapes (defect-compatible).
//   • accepted source gaps (no consumers in this engine, header :27-29):
//     Difficult Terrain / Lightly Obscured prose, STR (Athletics) break-free
//     modal, anchoring/collapse, flammability / 2d4 fire / burn-away.
// ──────────────────────────────────────────────────────────────────────────────
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────
// savePrompt factory omits buildSaveDc (handle-lane only — never called here;
// damageRollback factory omits storeSpellLastAttack, same reason).

vi.mock('../../common/savePrompt.js', () => ({
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

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../../combat/automation/automationImmunities.js', () => ({
  playerIsImmuneToCondition: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
  addTargetResult: vi.fn().mockResolvedValue({}),
}));

// ── Imports ────────────────────────────────────────────────────

import { processWebAreaSave } from './webAreaSaveHandler.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as logService from '../../../ui/logService.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as rangeCheck from '../../../rules/combat/rangeCheck.js';
import * as automationImmunities from '../../../combat/automation/automationImmunities.js';
import * as damageRollback from '../../common/damageRollback.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'test-campaign';

const trackingImpl = (extra = {}) => (name, key) => {
  if (key === '_web_TestCaster') return { saveDc: 15, saveType: 'STR', ...extra };
  if (key === 'activeConditions') return [];
  return null;
};

// ── Tests ──────────────────────────────────────────────────────

describe('webAreaSaveHandler.processWebAreaSave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    logService.addEntry.mockClear();
  });

  describe('early returns', () => {
    it('returns null when no tracking data', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(null);

      const result = await processWebAreaSave('TestCaster', 'Goblin', campaignName, null);
      expect(result).toBeNull();
    });

    it('returns null when target is already restrained', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === '_web_TestCaster') return { saveDc: 15, saveType: 'STR' };
        if (key === 'activeConditions') return ['restrained'];
        return null;
      });

      const result = await processWebAreaSave('TestCaster', 'Goblin', campaignName, null);
      expect(result).toBeNull();
      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
    });
  });

  describe('recurring STR save processing', () => {
    it('triggers save listener with STR saveType', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation(trackingImpl());

      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-pws-save',
        promise: Promise.resolve({ success: false, roll: 8, total: 8 }),
      });

      await processWebAreaSave('TestCaster', 'Goblin', campaignName, null);

      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveType: 'STR',
        saveDc: 15,
      });
    });

    it('applies restrained on failed STR save', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation(trackingImpl());

      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-pws-cond',
        promise: Promise.resolve({ success: false, roll: 8, total: 8 }),
      });

      await processWebAreaSave('TestCaster', 'Goblin', campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        ['restrained'],
        campaignName,
      );
    });

    it('writes rollback ledger addTargetResult exact failure shape (zero damage)', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation(trackingImpl());

      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-pws-ledger-fail',
        promise: Promise.resolve({ success: false, roll: 8, total: 8 }),
      });

      await processWebAreaSave('TestCaster', 'Goblin', campaignName, null);

      expect(damageRollback.addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveResult: 'failure',
        roll: 8,
        total: 8,
        conditions: ['restrained'],
        appliedDamage: 0,
      });
    });

    it('writes rollback ledger addTargetResult exact success shape (no conditions)', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation(trackingImpl());

      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-pws-ledger-success',
        promise: Promise.resolve({ success: true, roll: 14, total: 14 }),
      });

      await processWebAreaSave('TestCaster', 'Goblin', campaignName, null);

      expect(damageRollback.addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveResult: 'success',
        roll: 14,
        total: 14,
        conditions: [],
        appliedDamage: 0,
      });
    });

    it('logs ability_use prompt row and STR save_result failure row', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation(trackingImpl());

      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-pws-logs',
        promise: Promise.resolve({ success: false, roll: 8, total: 8 }),
      });

      await processWebAreaSave('TestCaster', 'Goblin', campaignName, null);

      // Own-composition full-string pins; [webAreaSave] recurring-lane prefix.
      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'ability_use',
        characterName: 'TestCaster',
        abilityName: 'Web',
        promptId: 'web-pws-logs',
        description: 'Goblin must make a STR save (DC 15) or become Restrained (Web area).',
      }));
      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'save_result',
        characterName: 'TestCaster',
        rollType: 'save-web',
        targetName: 'Goblin',
        saveDc: 15,
        saveType: 'STR',
        success: false,
        description: 'Goblin failed STR save against Web. Becomes Restrained.',
      }));
    });

    it('returns popup with correct description', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation(trackingImpl());

      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-pws-popup',
        promise: Promise.resolve({ success: false, roll: 8, total: 8 }),
      });

      const result = await processWebAreaSave('TestCaster', 'Goblin', campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.name).toBe('Web');
      expect(result.payload.description).toContain('failed');
      expect(result.payload.description).toContain('Restrained');
    });
  });

  describe('range gating', () => {
    it('returns null when mapName provided but isWithinRange returns false', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation(trackingImpl());
      rangeCheck.isWithinRange.mockResolvedValue(false);

      const result = await processWebAreaSave('TestCaster', 'Goblin', campaignName, 'test-map');

      expect(result).toBeNull();
      expect(damageUtils.getCombatContext).not.toHaveBeenCalled();
    });

    it('does not call isWithinRange when mapName is null', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation(trackingImpl());

      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-pws-no-map',
        promise: Promise.resolve({ success: true, roll: 14, total: 14 }),
      });

      await processWebAreaSave('TestCaster', 'Goblin', campaignName, null);

      expect(rangeCheck.isWithinRange).not.toHaveBeenCalled();
    });

    it('proceeds with save when isWithinRange throws', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation(trackingImpl());
      rangeCheck.isWithinRange.mockRejectedValueOnce(new Error('Map error'));

      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-pws-map-error',
        promise: Promise.resolve({ success: true, roll: 14, total: 14 }),
      });

      await processWebAreaSave('TestCaster', 'Goblin', campaignName, 'test-map');

      expect(savePrompt.createSaveListener).toHaveBeenCalled();
    });
  });

  describe('immunity gates', () => {
    // Pins branch logic via SYNC-mock getCombatContext shape — prod defect
    // (missing await at webAreaSaveHandler.js:249) makes this branch
    // unreachable until fixed; see seam map flag.
    it('returns null when player is immune to restrained condition', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation(trackingImpl({ computedStats: { immunities: ['restrained'] } }));
      damageUtils.getCombatContext.mockReturnValue({
        creatures: [{ name: 'Goblin', type: 'player', gridX: 6, gridY: 10 }],
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
      });
      rangeCheck.isWithinRange.mockResolvedValue(true);
      automationImmunities.playerIsImmuneToCondition.mockReturnValue(true);

      const result = await processWebAreaSave('TestCaster', 'Goblin', campaignName, 'test-map');

      expect(result).toBeNull();
      expect(automationImmunities.playerIsImmuneToCondition).toHaveBeenCalledWith(expect.objectContaining({
        conditionKey: 'restrained',
        campaignName,
      }));
      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
    });

    it('skips immunity check for non-player targets', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation(trackingImpl());
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Goblin', type: 'monster', gridX: 6, gridY: 10 }],
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
      });
      rangeCheck.isWithinRange.mockResolvedValue(true);

      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-pws-monster',
        promise: Promise.resolve({ success: true, roll: 14, total: 14 }),
      });

      await processWebAreaSave('TestCaster', 'Goblin', campaignName, 'test-map');

      expect(automationImmunities.playerIsImmuneToCondition).not.toHaveBeenCalled();
      expect(savePrompt.createSaveListener).toHaveBeenCalled();
    });
  });

  describe('error handling - addEntry rejection', () => {
    // Recurring-lane catch legs ([webAreaSave] prefix). The identically
    // named cast-lane catches in #1991 .errors ([web] prefix, handle())
    // are a DIFFERENT source site — lane-qualified names, hand-off recorded
    // in seam map; canonical home of each leg stays with its own export.
    it('handles addEntry rejection in recurring ability_use log gracefully', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation(trackingImpl());
      logService.addEntry.mockRejectedValueOnce(new Error('Log error'));

      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-pws-catch1',
        promise: Promise.resolve({ success: false, roll: 8, total: 8 }),
      });

      const consoleSpy = vi.spyOn(console, 'error').mockReturnValue(undefined);

      await processWebAreaSave('TestCaster', 'Goblin', campaignName, null);

      expect(consoleSpy).toHaveBeenCalledWith('[webAreaSave] Error:', expect.any(Error));
      expect(savePrompt.createSaveListener).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('handles addEntry rejection in recurring save_result failure log gracefully', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation(trackingImpl());

      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-pws-catch2',
        promise: Promise.resolve({ success: false, roll: 8, total: 8 }),
      });

      logService.addEntry
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('Save result error'));

      const consoleSpy = vi.spyOn(console, 'error').mockReturnValue(undefined);

      await processWebAreaSave('TestCaster', 'Goblin', campaignName, null);

      expect(consoleSpy).toHaveBeenCalledWith('[webAreaSave] Error:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    it('handles addEntry rejection in recurring save_result success log gracefully', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation(trackingImpl());

      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-pws-catch3',
        promise: Promise.resolve({ success: true, roll: 14, total: 14 }),
      });

      logService.addEntry
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('Success log error'));

      const consoleSpy = vi.spyOn(console, 'error').mockReturnValue(undefined);

      await processWebAreaSave('TestCaster', 'Goblin', campaignName, null);

      expect(consoleSpy).toHaveBeenCalledWith('[webAreaSave] Error:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('filter callback coverage - existing conditions', () => {
    it('preserves unrelated conditions, appends restrained exactly once', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === '_web_TestCaster') return { saveDc: 15, saveType: 'STR' };
        if (key === 'activeConditions') return ['blinded'];
        return null;
      });

      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-pws-filter',
        promise: Promise.resolve({ success: false, roll: 8, total: 8 }),
      });

      await processWebAreaSave('TestCaster', 'Goblin', campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        ['blinded', 'restrained'],
        campaignName,
      );
    });

    it('returns null for mixed-case stored Restrained (case-insensitive guard)', async () => {
      // :329 uses String(c).toLowerCase() === 'restrained', so a stored
      // 'Restrained' is caught by the early return — the filter at :265
      // never sees it, and no save is prompted.
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === '_web_TestCaster') return { saveDc: 15, saveType: 'STR' };
        if (key === 'activeConditions') return ['Restrained'];
        return null;
      });

      const result = await processWebAreaSave('TestCaster', 'Goblin', campaignName, null);

      expect(result).toBeNull();
      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('processWebAreaSave return value', () => {
    it('returns popup with success description on successful save', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation(trackingImpl());

      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-pws-success-desc',
        promise: Promise.resolve({ success: true, roll: 14, total: 14 }),
      });

      const result = await processWebAreaSave('TestCaster', 'Goblin', campaignName, null);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Web',
          description: 'Goblin succeeded the STR save (DC 15). Unaffected.',
        },
      });
    });
  });
});
