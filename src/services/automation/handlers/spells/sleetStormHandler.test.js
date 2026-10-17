// @maintained-by-ai
// ── sleetStorm QUARTET seam map (shared subject: sleetStormHandler.js) ──
// lane (this) — #1963 .test (main): handle() GATES + FRONT DOOR ONLY —
//   early returns (spellNoticePopup on empty/missing combat context, empty
//   selection), target selection (metaCtx.targets vs all-creatures fallback
//   via resolveSelectedSpellTargets), save-prompt SHAPE (exact createSave-
//   Listener options incl. the heightenTarget→disadvantage legs), and the
//   cast-time isProneImmune lane (weaknessesAndResistivities skip, immunity
//   ability_use entry full shape, its addEntry rejection).
// Canonical-home honors (zero shed — content audit at arrival 2026-10-16
//   found NO duplicate of the three closed lanes' canonical pins here):
//   #1961 .handle       — applySleetStormProneTarget internals, tracking-key
//     write, duration→rounds, addExpiration, registerSpellConcentration.
//     Other lanes' saves are captured but NEVER asserted below (failSave-
//     Listener exists only to let the loop run; zero prone/meta/targetEffects/
//     expiration/breakConcentration pins on this side).
//   #1960/areaSave      — processSleetStormAreaSave recurring-save content.
//     This file never imports it.
//   #1962 .handleResults— success-reporting trio: storeSpellLastAttack
//     positive, addTargetResult-success, save_result-success (+ rejection on
//     the save-success path), summary-popup prose. Below these appear ONLY as
//     NOT-called guards on early returns (no-side-effect pattern), never
//     positively. Immunity ability_use entry (L90-95) is canonical HERE per
//     handleResults header L25-26.
// Liveness (grep-verified 2026-10-16): LIVE — index.js:276 imports handle;
//   BOTH 'sleet_storm' (:585) and 'sleet_storm_area_save' (:558) dispatch to
//   handle() [registered≠dispatched note from areaSave header: the area_save
//   key does NOT reach processSleetStormAreaSave — flagged upstream, not this
//   lane's to fix]. Production feeds: selection leg LIVE via areaExecute
//   (useSimpleSpellHandlers.js:78-79,330) and useAreaEffectHandlers.js:135
//   metaCtx:{targets}; ALL-CREATURES leg LIVE via sleetStormService.
//   triggerSleetStorm (L3-19) which builds the action with NO metaCtx.
//   Arity: dispatch at index.js:743 passes 5 args; handle takes 4 — the 5th
//   (characters) is ignored, tests call the real 4-arg signature.
// DORMANT-CONTRACT FLAG (honest): no sleet-storm producer emits metaCtx.
//   heightenTarget (grep: producers are areaExecute/useAreaEffectHandlers
//   with targets only; contrast confusion/faerieFire services which DO emit
//   it). The key is shared across ~10 area handlers and triggerSpells
//   forwards it generically — both legs pinned as contract preservation,
//   disadvantage stays false on every currently-production shape.
// Quirk pinned honestly: unselected cast targets ALL cs.creatures INCLUDING
//   the caster (areaSpellUtils.js:19-22 preserves order; handleResults
//   header L31-34 same basis) — not sanitized.
// Dead exports (#1916 tally): none consumed by this lane — handle LIVE;
//   processSleetStormAreaSave LIVE via expireStaleEffects.js:35-45.
// Turn-based: zero timers — captured save promises resolve immediately.
// vi.clearAllMocks does NOT clear mockReturnValue (Vitest mockClear semantics
//   — implementation carryover across tests was a latent order-dependency in
//   the original file's immunity tests): every test that reaches the save
//   loop sets createSaveListener explicitly; rejections use
//   mockRejectedValueOnce at the exact call site.
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
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as damageRollback from '../../common/damageRollback.js';

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

// Merges INSIDE automation (production reads action.automation); metaCtx
// stays top-level — matches areaAction (useSimpleSpellHandlers.js:69-76).
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
};

// Captured save promise resolves immediately (no timers). Fresh object per
// call via mockImplementation(failSaveListener) — never a value carried over
// from another test.
function failSaveListener() {
  return {
    promptId: 'sleet-prompt',
    promise: Promise.resolve({ success: false, roll: 5, total: 5 }),
  };
}

function armPromptPath() {
  savePrompt.buildSaveDc.mockReturnValue(15);
  savePrompt.createSaveListener.mockImplementation(failSaveListener);
}

function targetNamesOfListenerCalls() {
  return savePrompt.createSaveListener.mock.calls.map(c => c[1].targetName);
}

// ── Tests: handle ──────────────────────────────────────────────

describe('sleetStormHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRuntimeState.getRuntimeValue.mockReturnValue(null);
  });

  describe('early returns', () => {
    it('returns notice popup, prompting and writing nothing, on missing/empty combat context', async () => {
      for (const cs of [null, {}, { creatures: [] }]) {
        vi.clearAllMocks();
        damageUtils.getCombatContext.mockResolvedValue(cs);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Sleet Storm');
        expect(result.payload.description).toBe(
          'No creatures in combat. Sleet Storm has no effect.'
        );
        // no-side-effect guard: selection, rollback store, tracking store,
        // expiration and all prompts stay untouched
        expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
        expect(damageRollback.storeSpellLastAttack).not.toHaveBeenCalled();
        expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
        expect(expirations.addExpiration).not.toHaveBeenCalled();
      }
    });
  });

  describe('target selection', () => {
    it('no metaCtx targets → prompts ALL cs.creatures in store order, caster included (RAW quirk)', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      armPromptPath();

      await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      expect(savePrompt.createSaveListener).toHaveBeenCalledTimes(3);
      expect(targetNamesOfListenerCalls()).toEqual(['Goblin', 'Orc', casterName]);
    });

    it('metaCtx.targets selects ONLY the named creature', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      armPromptPath();

      await handle(
        { ...makeAction(), metaCtx: { targets: ['Goblin'] } },
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(savePrompt.createSaveListener).toHaveBeenCalledTimes(1);
      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({ targetName: 'Goblin' }),
      );
    });

    it('empty metaCtx.targets array is truthy at the resolver → notice popup, no prompts', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);

      const result = await handle(
        { ...makeAction(), metaCtx: { targets: [] } },
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.name).toBe('Sleet Storm');
      expect(result.payload.description).toBe('No creatures selected for Sleet Storm.');
      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
      expect(damageRollback.storeSpellLastAttack).not.toHaveBeenCalled();
    });
  });

  describe('save prompt shape', () => {
    it('exact prompt options: buildSaveDc(auto, playerStats) → DEX/DC 15/dcSuccess none/disadvantage false', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      armPromptPath();
      const playerStats = makePlayerStats();
      const action = { ...makeAction(), metaCtx: { targets: ['Goblin'] } };

      await handle(action, playerStats, campaignName, mapName);

      expect(savePrompt.buildSaveDc).toHaveBeenCalledTimes(1);
      expect(savePrompt.buildSaveDc).toHaveBeenCalledWith(action.automation, playerStats);
      // exact-key pin — catches any missing OR extra option
      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveType: 'DEX',
        saveDc: 15,
        dcSuccess: 'none',
        disadvantage: false,
      });
    });

    it('heightenTarget MATCH flips disadvantage true (DORMANT contract: no sleet producer emits it — pinned as-is)', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      armPromptPath();

      await handle(
        { ...makeAction(), metaCtx: { targets: ['Goblin'], heightenTarget: 'Goblin' } },
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({ targetName: 'Goblin', disadvantage: true }),
      );
    });

    it('heightenTarget applies ONLY to the matched target — strict two-row table', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      armPromptPath();

      await handle(
        { ...makeAction(), metaCtx: { targets: ['Goblin', 'Orc'], heightenTarget: 'Orc' } },
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(savePrompt.createSaveListener).toHaveBeenCalledTimes(2);
      expect(targetNamesOfListenerCalls()).toEqual(['Goblin', 'Orc']);
      expect(savePrompt.createSaveListener).toHaveBeenNthCalledWith(
        1,
        campaignName,
        expect.objectContaining({ targetName: 'Goblin', disadvantage: false }),
      );
      expect(savePrompt.createSaveListener).toHaveBeenNthCalledWith(
        2,
        campaignName,
        expect.objectContaining({ targetName: 'Orc', disadvantage: true }),
      );
    });
  });

  describe('prone immunity (isProneImmune, cast-time lane)', () => {
    it('any immunities spelling of prone skips the save prompt — strict spelling table', async () => {
      for (const spelling of ['Prone', 'prone', 'PRONE']) {
        vi.clearAllMocks();
        useRuntimeState.getRuntimeValue.mockReturnValue(null);
        damageUtils.getCombatContext.mockResolvedValue({
          creatures: [
            { name: 'Goblin', type: 'monster', weaknessesAndResistivities: { immunities: [spelling] } },
            { name: 'Orc', type: 'monster' },
            { name: casterName, type: 'player', gridX: 5, gridY: 10 },
          ],
        });
        armPromptPath();

        await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(targetNamesOfListenerCalls()).toEqual(['Orc', casterName]);
      }
    });

    it('immune target logs ability_use with exact full shape and gets no save prompt', async () => {
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Goblin', type: 'monster', weaknessesAndResistivities: { immunities: ['prone'] } },
        ],
      });
      savePrompt.buildSaveDc.mockReturnValue(15);

      await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
      expect(logService.addEntry).toHaveBeenCalledTimes(1);
      // exact-key pin of the immunity entry (canonical home: this lane)
      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: casterName,
        abilityName: 'Sleet Storm',
        description: 'Goblin is immune to Sleet Storm (Prone immunity).',
      });
    });

    it('addEntry rejection on the immunity entry (call #1) is caught: console.error once, popup returned', async () => {
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Goblin', type: 'monster', weaknessesAndResistivities: { immunities: ['Prone'] } },
        ],
      });
      savePrompt.buildSaveDc.mockReturnValue(15);
      const err = new Error('log error');
      logService.addEntry.mockRejectedValueOnce(err);
      const consoleError = vi.spyOn(console, 'error').mockReturnValue();

      try {
        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(consoleError).toHaveBeenCalledTimes(1);
        expect(consoleError).toHaveBeenCalledWith('[sleetStorm] Error:', err);
        expect(result.type).toBe('popup');
      } finally {
        consoleError.mockRestore();
      }
    });
  });
});
