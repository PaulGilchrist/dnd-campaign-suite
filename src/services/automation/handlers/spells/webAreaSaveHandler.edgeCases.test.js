// ── webAreaSave QUINTET lane #1990 .edgeCases ──
// (full seam map: webAreaSaveHandler.areaSave.test.js header — that lane owns
// recurring STR-save content incl exact addTargetResult shapes; this file is
// the LAW-honored edge split)
// THIS lane: handle() guards / odd shapes — existing-Restrained refresh
//   (cast lane filters+re-apps at webAreaSaveHandler.js:92-93, never skips),
//   empty selected-name matches (:157-159 guard popup), null combatSummary
//   (concentration no-op), missing spellAbilities/proficiency → fallback
//   concentrationDc (areaSpellUtils.js:28, `saveDc || 8 + (proficiency || 2)`
//   → 12 with prof 4, 10 with prof absent), missing action.automation
//   (:145 `|| {}` guard), roll-less saveResult (`roll ?? 0` :109-110).
// OWNED ELSEWHERE (not pinned here): cast orchestration, target-selection
//   default, full cast-ledger shapes, activeConditionMeta (#1992 .main);
//   [web] console.error catch legs (#1991 .errors — zero console pins in
//   this file); `_web_<caster>` zone store + 600-round merged expiration
//   (#1993 .zone); recurring STR-save internals + webTargetIsImmune :249
//   un-awaited prod-defect flag (#1989 / .areaSave map flag — cross-ref).
// Note: no-metaCtx defaults to ALL creatures incl caster (areaSpellUtils.js:20)
//   — the missing-automation leg constrains metaCtx to one target so only the
//   :145 guard is exercised; selection mechanics stay in #1992.
// No dice (saves faked via createSaveListener promises) → no riggedRandom, no
// Math.random reads; no timers; setRuntimeValue writes 4-arg, campaignName last.
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

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../../combat/automation/automationImmunities.js', () => ({
  playerIsImmuneToCondition: vi.fn(),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
  getCurrentCombatRound: vi.fn().mockReturnValue(1),
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

import { handle } from './webAreaSaveHandler.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
// logService is mocked (handler addEntry calls need a resolved stub) but not
// asserted here — log pins live in #1991 .errors.
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

// ── Tests ──────────────────────────────────────────────────────

describe('webAreaSaveHandler.handle - edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRuntimeState.getRuntimeValue.mockReturnValue(null);
  });

  describe('filter callback coverage - existing conditions', () => {
    it('filters out existing restrained condition before re-applying', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeConditions') return ['restrained', 'blinded'];
        if (key === 'activeConditionMeta') return { restrained: { dc: 10 } };
        return null;
      });

      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-save-filter',
        promise: Promise.resolve({ success: false, roll: 5, total: 5 }),
      });

      await handle(
        { ...makeAction(), metaCtx: { targets: ['Goblin'] } },
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        ['blinded', 'restrained'],
        campaignName,
      );
    });
  });

  describe('edge cases', () => {
    it('returns popup with no targets when selectedTargetNames yields no matches', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);

      const result = await handle(
        { ...makeAction(), metaCtx: { targets: ['NonExistent'] } },
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.type).toBe('popup');
      // Own-composition full-string pin of the :158 guard popup.
      expect(result.payload.name).toBe('Web');
      expect(result.payload.description).toBe('No creatures selected for Web.');
    });

    it('returns popup when combatSummary is null (no concentration tracking)', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue(null);

      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-save-nconc',
        promise: Promise.resolve({ success: true, roll: 14, total: 14 }),
      });

      const result = await handle(
        { ...makeAction(), metaCtx: { targets: ['Goblin'] } },
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.type).toBe('popup');
      expect(concentrationService.addConcentration).not.toHaveBeenCalled();
      expect(storage.default.set).not.toHaveBeenCalled();
    });

    it('uses fallback DC when spellAbilities is missing', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      combatData.getCombatSummary.mockReturnValue({});

      const casterStats = {
        name: 'TestCaster',
        level: 10,
        proficiency: 4,
        abilities: [{ name: 'Charisma', bonus: 3 }],
      };

      savePrompt.buildSaveDc.mockReturnValue(15);
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-save-fallback',
        promise: Promise.resolve({ success: true, roll: 14, total: 14 }),
      });

      await handle(
        { ...makeAction(), metaCtx: { targets: ['Goblin'] } },
        casterStats,
        campaignName,
        null,
      );

      expect(concentrationService.addConcentration).toHaveBeenCalledWith(
        expect.any(Object),
        'TestCaster',
        'Web',
        12,
      );
    });

    it('uses fallback proficiency when both spellAbilities and proficiency are missing', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      combatData.getCombatSummary.mockReturnValue({});

      const casterStats = {
        name: 'TestCaster',
        level: 10,
        abilities: [{ name: 'Charisma', bonus: 3 }],
      };

      savePrompt.buildSaveDc.mockReturnValue(15);
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-save-fallback2',
        promise: Promise.resolve({ success: true, roll: 14, total: 14 }),
      });

      await handle(
        { ...makeAction(), metaCtx: { targets: ['Goblin'] } },
        casterStats,
        campaignName,
        null,
      );

      expect(concentrationService.addConcentration).toHaveBeenCalledWith(
        expect.any(Object),
        'TestCaster',
        'Web',
        10,
      );
    });

    it('handles action without automation property', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});

      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-save-no-automation',
        promise: Promise.resolve({ success: true, roll: 14, total: 14 }),
      });

      // metaCtx pinned to one target: no-metaCtx defaults to ALL creatures
      // incl the caster (areaSpellUtils.js:20) — selection mechanics belong
      // to #1992; this leg only exercises the :145 automation `|| {}` guard.
      await handle(
        { name: 'Web', metaCtx: { targets: ['Goblin'] } },
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(savePrompt.buildSaveDc).toHaveBeenCalledWith({}, makePlayerStats());
    });

    it('handles saveResult without roll/total properties', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      useRuntimeState.getRuntimeValue.mockReturnValue({});

      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-save-no-roll',
        promise: Promise.resolve({ success: false }),
      });

      await handle(
        { ...makeAction(), metaCtx: { targets: ['Goblin'] } },
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(damageRollback.addTargetResult).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          targetName: 'Goblin',
          roll: 0,
          total: 0,
        }),
      );
    });
  });
});
