// @maintained-by-ai
// ── sleetStorm QUARTET seam map (shared subject: sleetStormHandler.js) ──
// lane (this) — #1962 .handleResults — outcome-reporting of handle()'s body
//   (L25-158): storeSpellLastAttack, per-target ability_use entries, the
//   handle()-body SUCCESS block (addTargetResult-success + save_result
//   success), addEntry rejection on the save-success path, summary-popup
//   prose (full-string own-composition pins), mixed multi-target tallies.
// Canonical assignments carried from the #1961 handoff (REMOVED there as
//   cross-lane, load-bearing — pinned here against handle(), verified live):
//   • 'posts save_result entry with success=true'
//   • 'calls addTargetResult with success'
//   • 'handles addEntry rejection in successful save path'
//   storeSpellLastAttack positive pin is canonical HERE (corrects areaSave
//   header L33 claim of #1961 — recorded at .handle.test.js L18-22).
// Siblings (quartet split, verified by CONTENT 2026-10-16):
//   #1961 .handle      — cast-time application internals: applySleetStorm-
//     ProneTarget (activeConditionMeta, breakConcentration, targetEffects,
//     condition/concentration_lost + ITS failure save_result), tracking-key
//     write, duration→rounds parsing, addExpiration shapes,
//     registerSpellConcentration, success-path no-application guard
//   .areaSave          — processSleetStormAreaSave recurring-save internals incl
//     ITS OWN failure-path reporting; the IDENTICAL save_result/addTargetResult
//     success strings there are pinned against processSleetStormAreaSave —
//     this lane never absorbs that foreign lane.
//   #1963 .test (main) — handle() early returns, target selection, save-prompt
//     shape (heightenTarget disadvantage), isProneImmune + its ability_use
//     immunity-entry rejection
// Liveness (grep-verified 2026-10-16): LIVE — automation/index.js:585 dispatches
//   'sleet_storm' → handle(). (index.js:558 routes 'sleet_storm_area_save' to
//   handle() too, NOT to processSleetStormAreaSave — flagged upstream in the
//   areaSave header; not this lane to fix.)
// Full-string pin basis: resolveSelectedSpellTargets (areaSpellUtils.js:19-22)
//   PRESERVES cs.creatures order, so an unselected cast targets
//   [Goblin, Orc, TestWizard] — including the caster itself (RAW quirk,
//   pinned honestly, not sanitized).
// PROSE FLAG (pinned as-is, contract preservation): the summary hardcodes
//   'Sleet Storm' in the prose (sleetStormHandler.js:147-148) even when
//   action.name differs — 'uses the action name' pins name-field and the
//   hardcoded description together.
// Turn-based: zero timers — every captured save promise resolves immediately;
//   no setTimeout/setInterval in this lane.
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

import { handle } from './sleetStormHandler.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as logService from '../../../ui/logService.js';
import * as combatData from '../../../encounters/combatData.js';
import * as damageRollback from '../../common/damageRollback.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';

// ── Constants & Helpers ────────────────────────────────────────

const campaignName = 'TestCampaign';
const mapName = 'test-map';
const casterName = 'TestWizard';

function makePlayerStats(overrides = {}) {
  return {
    name: casterName,
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Intelligence', bonus: 3 }],
    spellAbilities: { saveDc: 15 },
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Sleet Storm',
    automation: {
      type: 'sleet_storm',
      saveType: 'DEX',
      saveDc: 15,
      ...automation,
    },
  };
}

const baseCombatContext = {
  creatures: [
    { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
    { name: 'Orc', type: 'monster', currentHp: 15, maxHp: 22 },
    { name: casterName, type: 'player', gridX: 5, gridY: 10 },
  ],
  players: [{ name: casterName, gridX: 5, gridY: 10 }],
  placedItems: [],
};

function failSaveListener() {
  return {
    promptId: 'sleet-prompt',
    promise: Promise.resolve({ success: false, roll: 5, total: 5 }),
  };
}

function successSaveListener() {
  return {
    promptId: 'sleet-prompt',
    promise: Promise.resolve({ success: true, roll: 14, total: 14 }),
  };
}

function setupCast(listener = failSaveListener()) {
  damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
  savePrompt.buildSaveDc.mockReturnValue(15);
  combatData.getCombatSummary.mockReturnValue({});
  savePrompt.createSaveListener.mockReturnValue(listener);
}

function castOn(targets, automation = {}, stats = makePlayerStats()) {
  return handle(
    { ...makeAction(automation), metaCtx: { targets } },
    stats,
    campaignName,
    mapName,
  );
}

function abilityEntries() {
  return logService.addEntry.mock.calls.filter((c) => c[1].type === 'ability_use');
}

function saveResultEntries() {
  return logService.addEntry.mock.calls.filter((c) => c[1].type === 'save_result');
}

// ── Tests: handle — storeSpellLastAttack, log entries, summary ─

describe('sleetStormHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // clearAllMocks keeps implementations — reset the floating-promise mocks
    // explicitly so an unconsumed Once-queue can never leak into the next test.
    logService.addEntry.mockReset().mockResolvedValue({});
    damageRollback.addTargetResult.mockReset().mockResolvedValue({});
    useRuntimeState.getRuntimeValue.mockReturnValue(null);
  });

  describe('storeSpellLastAttack', () => {
    it('calls storeSpellLastAttack with correct parameters', async () => {
      setupCast(successSaveListener());

      await castOn(['Goblin']);

      expect(damageRollback.storeSpellLastAttack).toHaveBeenCalledWith(campaignName, {
        casterName,
        spellName: 'Sleet Storm',
        saveType: 'DEX',
        saveDc: 15,
        attackScope: 'aoe',
      });
    });
  });

  describe('ability_use log entries', () => {
    it('posts ability_use entry for each target', async () => {
      setupCast(failSaveListener());

      // No metaCtx → resolveSelectedSpellTargets hits ALL creatures in
      // context order, caster included (header quirk note).
      await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      const entries = abilityEntries();
      expect(entries.length).toBe(3);
      expect(entries.map((c) => c[1].description)).toEqual([
        'TestWizard casts Sleet Storm! Goblin must make a DEX save (DC 15) or become Prone and lose Concentration.',
        'TestWizard casts Sleet Storm! Orc must make a DEX save (DC 15) or become Prone and lose Concentration.',
        'TestWizard casts Sleet Storm! TestWizard must make a DEX save (DC 15) or become Prone and lose Concentration.',
      ]);
      // Exact full entry shape (abilityName = action.name, promptId forwarded).
      expect(entries[0][1]).toEqual({
        type: 'ability_use',
        characterName: casterName,
        abilityName: 'Sleet Storm',
        description: 'TestWizard casts Sleet Storm! Goblin must make a DEX save (DC 15) or become Prone and lose Concentration.',
        promptId: 'sleet-prompt',
      });
    });

    it('includes promptId in ability_use entry', async () => {
      setupCast();
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'sleet-test-prompt',
        promise: Promise.resolve({ success: false, roll: 5, total: 5 }),
      });

      await castOn(['Goblin']);

      const abilityEntry = abilityEntries()[0];
      expect(abilityEntry[1].promptId).toBe('sleet-test-prompt');
      expect(abilityEntries().length).toBe(1);
    });
  });

  describe('summary popup — own-composition full strings', () => {
    it('reports affected creature count when some fail', async () => {
      setupCast(failSaveListener());

      const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Sleet Storm',
          description: 'Sleet Storm affects 3 creature(s). Goblin is Prone and loses Concentration. Orc is Prone and loses Concentration. TestWizard is Prone and loses Concentration. 0 creature(s) saved. Affected creatures are Prone and lose Concentration.',
        },
      });
    });

    it('reports saved creature count in the summary', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      // Per-target queue by call order: Goblin saves, Orc + caster fail.
      let callCount = 0;
      savePrompt.createSaveListener.mockImplementation(() => {
        callCount++;
        return {
          promptId: 'sleet-prompt',
          promise: Promise.resolve({ success: callCount === 1 }),
        };
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      expect(result.payload.description).toBe(
        'Sleet Storm affects 2 creature(s). Orc is Prone and loses Concentration. TestWizard is Prone and loses Concentration. 1 creature(s) saved. Affected creatures are Prone and lose Concentration.',
      );
      // Roll-free save outcomes normalize via ?? 0 (sleetStormHandler.js:124-125).
      expect(damageRollback.addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveResult: 'success',
        roll: 0,
        total: 0,
        conditions: [],
        appliedDamage: 0,
      });
    });

    it('reports no creatures affected when all save', async () => {
      setupCast(successSaveListener());

      const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      expect(result.payload.description).toBe(
        'No creatures affected by Sleet Storm. 3 creature(s) saved.',
      );
    });

    it('uses the action name in the popup payload', async () => {
      setupCast(successSaveListener());

      const result = await handle(
        { name: 'Custom Sleet Storm', automation: makeAction().automation },
        makePlayerStats(),
        campaignName,
        mapName,
      );

      // name field is action.name; the summary PROSE keeps its hardcoded
      // 'Sleet Storm' (L147-148 — prose flag in header, contract pin).
      expect(result.payload.name).toBe('Custom Sleet Storm');
      expect(result.payload.description).toBe(
        'No creatures affected by Sleet Storm. 3 creature(s) saved.',
      );
    });
  });

  describe('success-path reporting (canonical home #1962, handed off from #1961)', () => {
    it('calls addTargetResult with success', async () => {
      setupCast(successSaveListener());

      await castOn(['Goblin']);

      // handle()-body success block (L121-128); the area-save lane's
      // identical shape is pinned in .areaSave against
      // processSleetStormAreaSave — never merged here.
      expect(damageRollback.addTargetResult).toHaveBeenCalledTimes(1);
      expect(damageRollback.addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveResult: 'success',
        roll: 14,
        total: 14,
        conditions: [],
        appliedDamage: 0,
      });
    });

    it('posts save_result entry with success=true', async () => {
      setupCast(successSaveListener());

      await castOn(['Goblin']);

      const entries = saveResultEntries();
      expect(entries.length).toBe(1);
      expect(entries[0][1]).toEqual({
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

    it('handles addEntry rejection in successful save path', async () => {
      setupCast(successSaveListener());
      // Once-queue by call site: #1 ability_use resolves, #2 save_result
      // success entry (L129-138) rejects.
      logService.addEntry
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('save_result log error'));
      const consoleError = vi.spyOn(console, 'error').mockReturnValue();

      const result = await castOn(['Goblin']);

      expect(result.type).toBe('popup');
      expect(consoleError).toHaveBeenCalledTimes(1);
      // handle()-body tag — distinct from the areaSave lane's
      // '[sleetStormAreaSave] Error:' fallback.
      expect(consoleError).toHaveBeenCalledWith('[sleetStorm] Error:', expect.any(Error));
      // The awaited addTargetResult completed before/independent of the
      // rejected log — reporting continues, popup still returned.
      expect(damageRollback.addTargetResult).toHaveBeenCalledTimes(1);
      consoleError.mockRestore();
    });
  });

  describe('multiple targets mixed results', () => {
    it('processes all targets with mixed save results', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      // Per-target queue: Goblin fails, Orc saves.
      savePrompt.createSaveListener
        .mockReturnValueOnce(failSaveListener())
        .mockReturnValueOnce(successSaveListener());

      const result = await castOn(['Goblin', 'Orc']);

      expect(result.payload.description).toBe(
        'Sleet Storm affects 1 creature(s). Goblin is Prone and loses Concentration. 1 creature(s) saved. Affected creatures are Prone and lose Concentration.',
      );
      // One failure + one success record, both reported.
      expect(damageRollback.addTargetResult).toHaveBeenCalledTimes(2);
      expect(saveResultEntries().map((c) => c[1].success)).toEqual([false, true]);
    });
  });
});
