// @maintained-by-ai 2026-11-27 — IMPROVE-AND-TRIM pass (#1990): fallback-DC pair consolidated into a 2-leg it.each $-family (12/10 only — the concentration dc-15 positive leg is owned by #1992 .test.js:373, not re-added); roll-less face widened to a BOTH-legs it.each covering the cast lane's TWO ??0 ledger sites (saveSuccess :37-38 success + restrainWebTarget :109-110 failure — the recurring lane's ??0 legs belong to #1989 .areaSave per its carried note, untouched here) with full-shape toEqual payloads and a success-leg zero-condition-write census; no-match popup upgraded to full-shape toEqual + early-return zero-spend census; buildSaveDc({}, stats) pin gained a times(1) detector; resetAllMocks-safe bare mock factories with base return values re-established in beforeEach (old inline mockResolvedValue/mockReturnValue chains survived clearAllMocks = leak class — the null-combatSummary return previously bled sideways); header line cites re-verified vs current bytes. Zero Date.now pins needed: the handle-lane timestamps (:129/:179) sit only in addEntry rows (log pins = #1991) and the tracking-store write (#1993) — no assertion here touches them, so no freeze.
// ── webAreaSave QUINTET lane #1990 .edgeCases ──
// (full seam map: webAreaSaveHandler.areaSave.test.js header — that lane owns
// recurring STR-save content incl exact addTargetResult shapes; this file is
// the LAW-honored edge split)
// THIS lane: handle() guards / odd shapes — existing-Restrained refresh
//   (cast lane filters+re-apps at webAreaSaveHandler.js:92-93, never skips),
//   empty selected-name matches (:157-158 guard popup), null combatSummary
//   (concentration no-op at areaSpellUtils.js:27), missing spellAbilities/
//   proficiency → fallback concentrationDc (areaSpellUtils.js:28,
//   `saveDc || 8 + (proficiency || 2)` → 12 with prof 4, 10 with prof absent;
//   the dc-15 positive leg lives in #1992), missing action.automation
//   (:145 `|| {}` guard), roll-less saveResult on BOTH cast-ledger faces
//   (`roll ?? 0` / `total ?? 0` at :37-38 success and :109-110 failure).
// OWNED ELSEWHERE (not pinned here): cast orchestration, target-selection
//   default, full cast-ledger shapes with real rolls, popup summary prose,
//   activeConditionMeta happy content, concentration dc-15 leg (#1992 .main);
//   [web] console.error catch legs (#1991 .errors — zero console pins in
//   this file); `_web_<caster>` zone store + 600-round merged expiration
//   (#1993 .zone); recurring STR-save internals incl its own roll-less ??0
//   legs + webTargetIsImmune (await FIXED 2026-11-23 — see #1989 / .areaSave
//   map flag, cross-ref).
// Note: no-metaCtx defaults to ALL creatures incl caster (areaSpellUtils.js:20)
//   — the missing-automation leg constrains metaCtx to one target so only the
//   :145 guard is exercised; selection mechanics stay in #1992.
// No dice (saves faked via createSaveListener promises) → no riggedRandom, no
//   Math.random reads; no timers; setRuntimeValue writes 4-arg, campaignName
//   last; getRuntimeValue is 2-PARAM (per #1878) — the 3rd campaignName arg at
//   source READ sites is inert and the mocks never assert it.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports (bare factories; base returns set in beforeEach) ──

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

// rangeCheck/immunities/combatData.getCurrentCombatRound are never called by
// the cast lane — mocked for import-graph honesty only.
vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn(),
}));

vi.mock('../../../combat/automation/automationImmunities.js', () => ({
  playerIsImmuneToCondition: vi.fn(),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
  getCurrentCombatRound: vi.fn(),
}));

vi.mock('../../../ui/storage.js', () => ({
  __esModule: true,
  default: {
    set: vi.fn(),
  },
}));

vi.mock('../../common/damageRollback.js', () => ({
  storeSpellLastAttack: vi.fn(),
  addTargetResult: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './webAreaSaveHandler.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as logService from '../../../ui/logService.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as concentrationService from '../../../combat/concentration/concentrationService.js';
import * as combatData from '../../../encounters/combatData.js';
import * as storage from '../../../ui/storage.js';
import * as damageRollback from '../../common/damageRollback.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'test-campaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCaster',
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Charisma', bonus: 3 }],
    spellAbilities: { saveDc: 15 },
    ...overrides,
  };
}

function statsWithout(keys) {
  const stats = makePlayerStats();
  for (const key of keys) delete stats[key];
  return stats;
}

function makeAction(automation = {}) {
  return {
    name: 'Web',
    automation: { type: 'web_area_save', saveType: 'DEX', saveDc: 15, ...automation },
  };
}

const baseCombatContext = {
  creatures: [
    { name: 'Goblin', type: 'monster' },
    { name: 'Orc', type: 'monster' },
    { name: 'TestCaster', type: 'player' },
  ],
};

// One-target fixture: resolve the faked save with `saveResult`.
async function runOneTarget(action, stats, saveResult) {
  savePrompt.createSaveListener.mockReturnValue({
    promptId: 'web-save-edge',
    promise: Promise.resolve(saveResult),
  });
  return handle({ ...action, metaCtx: { targets: ['Goblin'] } }, stats, campaignName, null);
}

// ── Tests ──────────────────────────────────────────────────────

describe('webAreaSaveHandler.handle - edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Base returns re-set AFTER clearing (clearAllMocks keeps prior
    // mockReturnValue — setting them here is the resetAllMocks-safe pattern).
    useRuntimeState.getRuntimeValue.mockReturnValue(null);
    savePrompt.buildSaveDc.mockReturnValue(15);
    combatData.getCombatSummary.mockReturnValue({});
    logService.addEntry.mockResolvedValue({});
    damageRollback.addTargetResult.mockResolvedValue({});
    damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
  });

  it('refreshes an existing Restrained condition: filters then re-apps last, never skips', async () => {
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeConditions') return ['restrained', 'blinded'];
      if (key === 'activeConditionMeta') return { restrained: { dc: 10 } };
      return null;
    });

    await runOneTarget(makeAction(), makePlayerStats(), { success: false, roll: 5, total: 5 });

    // :92-93 — stale 'restrained' dropped, re-appended last, other conditions
    // preserved; 4-arg write with campaignName threaded.
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Goblin',
      'activeConditions',
      ['blinded', 'restrained'],
      campaignName,
    );
  });

  it('returns the :158 no-match popup and spends nothing when selected names match no creature', async () => {
    const result = await handle(
      { ...makeAction(), metaCtx: { targets: ['NonExistent'] } },
      makePlayerStats(),
      campaignName,
      null,
    );

    // Real spellNoticePopup builder — full-shape pin of the guard return.
    expect(result).toEqual({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Web',
        description: 'No creatures selected for Web.',
      },
    });
    // Early-return census: the whole cast pipeline stays unspent.
    expect(damageRollback.storeSpellLastAttack).not.toHaveBeenCalled();
    expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(concentrationService.addConcentration).not.toHaveBeenCalled();
    expect(logService.addEntry).not.toHaveBeenCalled();
    expect(damageRollback.addTargetResult).not.toHaveBeenCalled();
  });

  it('skips concentration tracking entirely when combatSummary is null', async () => {
    combatData.getCombatSummary.mockReturnValue(null);

    const result = await runOneTarget(makeAction(), makePlayerStats(), { success: true, roll: 14, total: 14 });

    expect(result.type).toBe('popup');
    // areaSpellUtils.js:27 early return: no register, no persist.
    expect(concentrationService.addConcentration).not.toHaveBeenCalled();
    expect(storage.default.set).not.toHaveBeenCalled();
  });

  it.each([
    { label: 'spellAbilities missing', drop: ['spellAbilities'], expectedDc: 12 },
    { label: 'spellAbilities and proficiency missing', drop: ['spellAbilities', 'proficiency'], expectedDc: 10 },
  ])('fallback concentrationDc — $label → DC $expectedDc (areaSpellUtils.js:28)', async ({ drop, expectedDc }) => {
    const summary = {};
    combatData.getCombatSummary.mockReturnValue(summary);

    await runOneTarget(makeAction(), statsWithout(drop), { success: true, roll: 14, total: 14 });

    expect(concentrationService.addConcentration).toHaveBeenCalledTimes(1);
    expect(concentrationService.addConcentration).toHaveBeenCalledWith(
      summary,
      'TestCaster',
      'Web',
      expectedDc,
    );
    expect(storage.default.set).toHaveBeenCalledWith('combatSummary', summary, campaignName);
  });

  it('defaults missing action.automation to {} before buildSaveDc (:145)', async () => {
    // metaCtx pinned to one target: no-metaCtx defaults to ALL creatures
    // incl the caster (areaSpellUtils.js:20) — selection mechanics belong
    // to #1992; this leg only exercises the :145 `|| {}` guard.
    await runOneTarget({ name: 'Web', metaCtx: { targets: ['Goblin'] } }, makePlayerStats(), {
      success: true,
      roll: 14,
      total: 14,
    });

    expect(savePrompt.buildSaveDc).toHaveBeenCalledTimes(1);
    expect(savePrompt.buildSaveDc).toHaveBeenCalledWith({}, makePlayerStats());
  });

  it.each([
    {
      label: 'failed save',
      saveResult: { success: false },
      ledger: {
        targetName: 'Goblin',
        saveResult: 'failure',
        roll: 0,
        total: 0,
        conditions: ['restrained'],
        appliedDamage: 0,
      },
    },
    {
      label: 'succeeded save',
      saveResult: { success: true },
      ledger: {
        targetName: 'Goblin',
        saveResult: 'success',
        roll: 0,
        total: 0,
        conditions: [],
        appliedDamage: 0,
      },
    },
  ])('roll-less saveResult — $label ledger pins roll:0/total:0 via ??0', async ({ saveResult, ledger }) => {
    if (saveResult.success) {
      // Success leg runs on the beforeEach null-store default.
      await runOneTarget(makeAction(), makePlayerStats(), saveResult);
    } else {
      // Failure leg doubles as the non-array-store guard: every read returns
      // a truthy non-array {}, exercising Array.isArray at :56/:91 while the
      // `|| {}` spread at :96 stays safe.
      useRuntimeState.getRuntimeValue.mockReturnValue({});
      await runOneTarget(makeAction(), makePlayerStats(), saveResult);
    }

    expect(damageRollback.addTargetResult).toHaveBeenCalledTimes(1);
    expect(damageRollback.addTargetResult).toHaveBeenCalledWith(campaignName, ledger);

    if (saveResult.success) {
      // A saved creature is never condition-touched: no target condition
      // writes at all (tracking/zone writes still happen — #1993's content).
      const conditionWrites = useRuntimeState.setRuntimeValue.mock.calls.filter(
        ([, key]) => key === 'activeConditions' || key === 'activeConditionMeta',
      );
      expect(conditionWrites).toEqual([]);
    }
  });
});
