// @maintained-by-ai
// ── webAreaSave QUINTET #1992 (main) — handle() CAST ORCHESTRATION canonical ──
// Full seam map: webAreaSaveHandler.areaSave.test.js header (#1989, owns the
// recurring processWebAreaSave lane). Liveness: automation/index.js:271 import,
// :557 'web_area_save' → handle; fired by useSimpleSpellHandlers.js:345
// areaExecute('web_area_save','DEX') — re-verified at source 2026-10-16.
// THIS FILE (lane, seam map :37-39): combat-context gate, target selection
//   (real areaSpellUtils.resolveSelectedSpellTargets :20 — default is ALL
//   creatures INCLUDING the caster, run honestly here), cast-time DEX save
//   flow per target via captured createSaveListener promise, Restrained apply
//   + activeConditionMeta (cast lane owns meta, recurring lane never writes it),
//   heightenTarget disadvantage, ability_use/condition/save_result cast-row
//   full-string composition, popup summary full-string canonical,
//   addConcentration happy branch (registerSpellConcentration → dc from
//   spellAbilities.saveDc 15, areaSpellUtils.js:28-29), storeSpellLastAttack
//   (composed at handle :161 — verified here).
// SHED (verified present at new home before removal 2026-10-16):
//   • zone tracking-store + expiration shapes → #1993 .zone:
//       'produces the _web_<caster> zone tracking key' (zone :105),
//       'registers ONE merged zone expiration (tracking clear + web te
//       removal) at 600 rounds' (zone :161) — canonical home of the old
//       weak 'adds expiration for initiative roll' pin (misnamed: prod has
//       NO initiative expiration; restrainWebTarget :118 registers ONE
//       concentration-scoped condition expiration),
//       'registers ONE Restrained condition expiration per failed target'
//       (zone :176) — canonical home of the old weak 'adds expiration for
//       concentration loss' pin.
//   • [web] console.error rejection legs → #1991 .errors (not re-pinned).
//   • guard shapes (null combatSummary, fallback DCs, no-match selection,
//     missing automation, roll-less saveResult) → #1990 .edgeCases.
// No range gating in the cast lane: handle() never calls isWithinRange
//   (mapName is only stored into the zone tracking key at :171-181, pinned
//   by #1993 zone :116 mapName: null); the recurring lane's range gate is
//   pinned in #1989 areaSave — negative guard pinned below.
// No timers: captured-promise awaits only; addExpiration runs unmocked and
//   writes pendingExpirations through the mocked setRuntimeValue (rounds are
//   seam-matured counters, not clocks).
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
import * as logService from '../../../ui/logService.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as rangeCheck from '../../../rules/combat/rangeCheck.js';
import * as concentrationService from '../../../combat/concentration/concentrationService.js';
import * as combatData from '../../../encounters/combatData.js';
import storage from '../../../ui/storage.js';
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

function makeAction(metaCtx = { targets: ['Goblin'] }) {
  return {
    name: 'Web',
    automation: { type: 'web_area_save', saveType: 'DEX', saveDc: 15 },
    metaCtx,
  };
}

const FAIL = { success: false, roll: 5, total: 5 };
const SAVE = { success: true, roll: 14, total: 14 };

// Captured-promise stub: per-target outcomes, default FAIL. promptId is
// deterministic so log-row pins can reference it.
function stubSaveListener(resultsByTarget = {}, defaultResult = FAIL) {
  savePrompt.createSaveListener.mockImplementation((_campaign, cfg) => ({
    promptId: `web-${cfg.targetName}`,
    promise: Promise.resolve(resultsByTarget[cfg.targetName] ?? defaultResult),
  }));
}

const castContext = () => ({
  creatures: [
    { name: 'Goblin', type: 'monster' },
    { name: 'Orc', type: 'monster' },
    { name: 'TestCaster', type: 'player' },
  ],
});

const logCallsOfType = type =>
  logService.addEntry.mock.calls.filter(c => c[1].type === type);

const conditionWritesFor = name =>
  useRuntimeState.setRuntimeValue.mock.calls.filter(
    c => c[0] === name && c[1] === 'activeConditions',
  );

// ── Tests ──────────────────────────────────────────────────────

describe('webAreaSaveHandler.handle — cast orchestration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // null covers every `|| []` / `|| {}` fallback in the cast lane.
    useRuntimeState.getRuntimeValue.mockReturnValue(null);
    damageUtils.getCombatContext.mockResolvedValue(castContext());
    savePrompt.buildSaveDc.mockReturnValue(15);
    combatData.getCombatSummary.mockReturnValue({});
    logService.addEntry.mockResolvedValue({});
    damageRollback.addTargetResult.mockResolvedValue({});
    stubSaveListener();
  });

  describe('combat-context gate', () => {
    it('returns popup and touches nothing when no creatures in combat', async () => {
      damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Web',
          description: 'No creatures in combat. Web has no effect.',
        },
      });
      // Gate returns before :161 — no rollback, zone, concentration, or save work.
      expect(damageRollback.storeSpellLastAttack).not.toHaveBeenCalled();
      expect(concentrationService.addConcentration).not.toHaveBeenCalled();
      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
    });
  });

  describe('target selection', () => {
    it('prompts ONLY the metaCtx-selected targets', async () => {
      await handle(makeAction({ targets: ['Goblin'] }), makePlayerStats(), campaignName, null);

      expect(savePrompt.createSaveListener.mock.calls.map(c => c[1].targetName)).toEqual(['Goblin']);
      expect(conditionWritesFor('Orc')).toHaveLength(0);
      expect(conditionWritesFor('TestCaster')).toHaveLength(0);
    });

    it('defaults to ALL creatures INCLUDING the caster when no targets specified', async () => {
      // areaSpellUtils.js:20 — selectedTargetNames falls back to every
      // creature in combat; the caster is promptable too (honest run).
      stubSaveListener({ Orc: SAVE, TestCaster: SAVE });

      const result = await handle(makeAction(null), makePlayerStats(), campaignName, null);

      const configs = savePrompt.createSaveListener.mock.calls.map(c => c[1]);
      expect(configs.map(c => c.targetName)).toEqual(['Goblin', 'Orc', 'TestCaster']);
      expect(configs.every(c => c.saveType === 'DEX' && c.saveDc === 15)).toBe(true);
      expect(conditionWritesFor('Goblin')).toHaveLength(1);
      expect(conditionWritesFor('TestCaster')).toHaveLength(0);
      // Full-string own-composition canonical (1 affected / 2 saved).
      expect(result.payload.description).toBe(
        'Web affects 1 creature(s). Goblin is Restrained. 2 creature(s) saved. ' +
        'Affected creatures are Restrained (Speed 0, attack rolls against them have ' +
        'Advantage, their attacks have Disadvantage, Disadvantage on DEX saves). ' +
        'Restrained creatures can use their action to make a STR (Athletics) check vs DC 15 to break free.',
      );
      // Cast lane never range-gates (recurring-lane seam, #1989).
      expect(rangeCheck.isWithinRange).not.toHaveBeenCalled();
    });
  });

  describe('cast-time DEX save flow', () => {
    it('createSaveListener gets the exact cast-lane config (DEX, disadvantage false)', async () => {
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveType: 'DEX',
        saveDc: 15,
        dcSuccess: 'none',
        disadvantage: false,
      });
    });

    it('heightenTarget gets disadvantage: true', async () => {
      await handle(
        makeAction({ targets: ['Goblin'], heightenTarget: 'Goblin' }),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveType: 'DEX',
        saveDc: 15,
        dcSuccess: 'none',
        disadvantage: true,
      });
    });

    it('success leg: no Restrained writes, exact success ledger and save_result row', async () => {
      stubSaveListener({ Goblin: SAVE });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith(
        'Goblin', 'activeConditions', expect.anything(), campaignName,
      );
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith(
        'Goblin', 'activeConditionMeta', expect.anything(), campaignName,
      );
      expect(damageRollback.addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveResult: 'success',
        roll: 14,
        total: 14,
        conditions: [],
        appliedDamage: 0,
      });
      expect(logCallsOfType('save_result')).toHaveLength(1);
      expect(logCallsOfType('save_result')[0][1]).toEqual({
        type: 'save_result',
        characterName: 'TestCaster',
        rollType: 'save-web',
        targetName: 'Goblin',
        saveDc: 15,
        saveType: 'DEX',
        success: true,
        description: 'Goblin succeeded on DEX save against Web.',
      });
      // Full-string own-composition canonical (affected branch not taken).
      expect(result.payload.description).toBe('No creatures affected by Web. 1 creature(s) saved.');
    });
  });

  describe('failed save — Restrained application', () => {
    it('writes exact activeConditions and recurring-STR activeConditionMeta plus fail ledger', async () => {
      // Stored conditions null → filtered [] + append (exact array, not contains).
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin', 'activeConditions', ['restrained'], campaignName,
      );
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin', 'activeConditionMeta', { restrained: { dc: 15, ability: 'str' } }, campaignName,
      );
      expect(damageRollback.addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveResult: 'failure',
        roll: 5,
        total: 5,
        conditions: ['restrained'],
        appliedDamage: 0,
      });
    });

    it('logs ability_use, condition, and save_result rows in composition order', async () => {
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(logService.addEntry).toHaveBeenCalledTimes(3);
      expect(logService.addEntry.mock.calls.map(c => c[1].type)).toEqual([
        'ability_use', 'condition', 'save_result',
      ]);
      expect(logService.addEntry.mock.calls[0][1]).toEqual({
        type: 'ability_use',
        characterName: 'TestCaster',
        abilityName: 'Web',
        description: 'TestCaster casts Web! Goblin must make a DEX save (DC 15) or become Restrained by sticky webbing.',
        promptId: 'web-Goblin',
      });
      // condition row carries a prod timestamp — objectContaining, rest exact.
      expect(logService.addEntry.mock.calls[1][1]).toEqual(expect.objectContaining({
        type: 'condition',
        action: 'applied',
        characterName: 'Goblin',
        condition: 'Restrained',
        reason: 'Web spell',
        note: 'Goblin is Restrained by Web: Speed is 0, attack rolls against you have Advantage, your attack rolls have Disadvantage, and you have Disadvantage on Dexterity saving throws. STR save (DC 15) each turn or remain Restrained.',
      }));
      expect(logService.addEntry.mock.calls[2][1]).toEqual({
        type: 'save_result',
        characterName: 'TestCaster',
        rollType: 'save-web',
        targetName: 'Goblin',
        saveDc: 15,
        saveType: 'DEX',
        success: false,
        description: 'Goblin failed DEX save against Web. Becomes Restrained by sticky webbing.',
      });
    });
  });

  describe('multiple targets', () => {
    it('processes every selected target, one save each, mixed outcome summary full string', async () => {
      stubSaveListener({ Goblin: FAIL, Orc: SAVE });

      const result = await handle(
        makeAction({ targets: ['Goblin', 'Orc'] }),
        makePlayerStats(),
        campaignName,
        null,
      );

      const configs = savePrompt.createSaveListener.mock.calls.map(c => c[1]);
      expect(configs.map(c => c.targetName)).toEqual(['Goblin', 'Orc']);
      expect(configs.every(c => c.disadvantage === false)).toBe(true);
      expect(conditionWritesFor('Goblin')).toHaveLength(1);
      expect(conditionWritesFor('Orc')).toHaveLength(0);
      expect(logCallsOfType('save_result')).toHaveLength(2);
      expect(result.type).toBe('popup');
      // Replaces the old double toContain('1 creature') tautology.
      expect(result.payload.description).toBe(
        'Web affects 1 creature(s). Goblin is Restrained. 1 creature(s) saved. ' +
        'Affected creatures are Restrained (Speed 0, attack rolls against them have ' +
        'Advantage, their attacks have Disadvantage, Disadvantage on DEX saves). ' +
        'Restrained creatures can use their action to make a STR (Athletics) check vs DC 15 to break free.',
      );
    });
  });

  describe('registration happy branches', () => {
    it('registers concentration with saveDc 15 from spellAbilities and persists the summary', async () => {
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(concentrationService.addConcentration).toHaveBeenCalledWith(
        expect.any(Object), 'TestCaster', 'Web', 15,
      );
      expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.any(Object), campaignName);
    });

    it('stores spell last attack (aoe, DEX) before saves run', async () => {
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(damageRollback.storeSpellLastAttack).toHaveBeenCalledWith(campaignName, {
        casterName: 'TestCaster',
        spellName: 'Web',
        saveType: 'DEX',
        saveDc: 15,
        attackScope: 'aoe',
      });
    });
  });
});
