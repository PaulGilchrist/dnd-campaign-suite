// fearHandler.handle lane (#1911) — closes the fear pair with
// fearHandler.saveDc.test.js (#1910); PAIR seam map lives in that file's
// header. #1910 runs the REAL buildSaveDc and owns DC derivation, sourcing
// discrimination, and DC propagation-to-sinks. buildSaveDc is STUBBED here —
// this lane owns the rest of handle():
//   • target resolution (caster excluded, survivors prompted in order)
//   • WIS prompt shape (exact-key createSaveListener payload; stub DC is a
//     passthrough, not a derivation pin)
//   • frightened condition write (lowercase dedupe + append, exact array)
//   • te producer 'fear_end_on_los' full shape incl. duration:'concentration'
//     (handler:69 — te CONTENT seam here; te.dc VALUE derivation is #1910)
//   • storeSpellLastAttack record, caster concentration registration,
//     combatSummary persistence, combat-summary-updated dispatch
//   • save-outcome sinks (addTargetResult, save_result/condition/ability_use
//     log entries) — full own-composition strings
//   • popup summaries (both branches, full-string pins), heightenTarget
//     disadvantage, no-combat early return, addEntry-reject catch sites
// Turn-based only: no timers here or in the handler (conditions expire via
// addExpiration round seams). Liveness: registered at automation/index.js:530
// (`fear: handleFear`), dispatched from type:'fear' in both spells.json.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
  storeSpellLastAttack: vi.fn(),
  addTargetResult: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn(),
  breakConcentration: vi.fn(),
}));

vi.mock('../../../ui/storage.js', () => ({
  default: { set: vi.fn(() => Promise.resolve()) },
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './fearHandler.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { storeSpellLastAttack, addTargetResult } from '../../common/damageRollback.js';
import { addEntry } from '../../../ui/logService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';
import storage from '../../../ui/storage.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'test-campaign';
const casterName = 'TestCaster';
// Stub DC — pure passthrough here; real derivation is #1910's lane.
const STUB_DC = 13;

function makePlayerStats(overrides = {}) {
  return {
    name: casterName,
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Charisma', bonus: 3 }],
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Fear',
    automation: {
      type: 'fear',
      ...automation,
    },
  };
}

function makeCombatContext(...names) {
  return {
    creatures: names.map(name => ({ name })),
    players: [{ name: casterName }],
    placedItems: [],
  };
}

// Stub the pre-flight: combat context + stubbed buildSaveDc + per-target
// save outcome decided by prompt config (order-independent).
function stubCast(ctx, saveOutcome = () => false) {
  getCombatContext.mockResolvedValue(ctx);
  buildSaveDc.mockReturnValue(STUB_DC);
  createSaveListener.mockImplementation((_campaign, cfg) => ({
    promptId: 'fear-prompt',
    promise: Promise.resolve({
      success: saveOutcome(cfg.targetName),
      roll: 8,
      total: saveOutcome(cfg.targetName) ? 18 : 5,
    }),
  }));
}

const savedAll = () => true;
const failedAll = () => false;

// ── Tests ──────────────────────────────────────────────────────

describe('fearHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default runtime reads are empty; keyed by the runtime key (2nd arg).
    getRuntimeValue.mockImplementation(() => []);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('when no combat context exists', () => {
    it.each([
      ['null context', null],
      ['empty creatures', { creatures: [] }],
    ])('returns no-effect popup and touches no state: %s', async (_label, ctx) => {
      getCombatContext.mockResolvedValue(ctx);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Fear',
          description: 'No creatures in combat. Fear has no effect.',
        },
      });
      // Early return happens before concentration/rollback/prompt setup.
      expect(addConcentration).not.toHaveBeenCalled();
      expect(storage.set).not.toHaveBeenCalled();
      expect(storeSpellLastAttack).not.toHaveBeenCalled();
      expect(createSaveListener).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('target resolution', () => {
    it('prompts every non-caster creature once, in context order, excluding the caster', async () => {
      const ctx = makeCombatContext('Goblin', 'Orc', casterName);
      stubCast(ctx, failedAll);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const targetNames = createSaveListener.mock.calls.map(c => c[1].targetName);
      expect(targetNames).toEqual(['Goblin', 'Orc']);
    });
  });

  describe('save prompt shape', () => {
    it('builds the DC from automation+stats and prompts with the exact WIS/frightened shape', async () => {
      const action = makeAction();
      const ctx = makeCombatContext('Goblin');
      stubCast(ctx, failedAll);

      await handle(action, makePlayerStats(), campaignName, null);

      expect(buildSaveDc).toHaveBeenCalledWith(action.automation, expect.objectContaining({ name: casterName }));
      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveType: 'WIS',
        saveDc: STUB_DC,
        dcSuccess: 'none',
        disadvantage: false,
        condition: 'frightened',
      });
    });

    it('applies disadvantage only to the heightened target', async () => {
      const action = {
        ...makeAction(),
        metaCtx: { heightenTarget: 'Orc' },
      };
      const ctx = makeCombatContext('Goblin', 'Orc');
      stubCast(ctx, failedAll);

      await handle(action, makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledTimes(2);
      const promptFor = name => createSaveListener.mock.calls.find(c => c[1].targetName === name)[1];
      expect(promptFor('Orc')).toEqual({
        targetName: 'Orc',
        saveType: 'WIS',
        saveDc: STUB_DC,
        dcSuccess: 'none',
        disadvantage: true,
        condition: 'frightened',
      });
      expect(promptFor('Goblin')).toEqual({
        targetName: 'Goblin',
        saveType: 'WIS',
        saveDc: STUB_DC,
        dcSuccess: 'none',
        disadvantage: false,
        condition: 'frightened',
      });
    });

    it('falls back to an empty automation object when the action has none', async () => {
      const ps = makePlayerStats();
      const ctx = makeCombatContext('Goblin');
      stubCast(ctx, failedAll);

      await handle({ name: 'Fear' }, ps, campaignName, null);

      expect(buildSaveDc).toHaveBeenCalledWith({}, ps);
      expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        saveType: 'WIS',
        saveDc: STUB_DC,
      }));
    });
  });

  describe('caster concentration and rollback registration', () => {
    it('registers caster concentration, persists combatSummary, and dispatches combat-summary-updated once', async () => {
      const ctx = makeCombatContext('Goblin', casterName);
      stubCast(ctx, failedAll);
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addConcentration).toHaveBeenCalledWith(ctx, casterName, 'Fear', STUB_DC);
      expect(storage.set).toHaveBeenCalledWith('combatSummary', ctx, campaignName);
      expect(dispatchSpy).toHaveBeenCalledTimes(1);
      expect(dispatchSpy).toHaveBeenCalledWith(new CustomEvent('combat-summary-updated'));
    });

    it('records the AoE spell last-attack for rollback', async () => {
      const ctx = makeCombatContext('Goblin');
      stubCast(ctx, failedAll);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(storeSpellLastAttack).toHaveBeenCalledWith(campaignName, {
        casterName,
        spellName: 'Fear',
        saveType: 'WIS',
        saveDc: STUB_DC,
        attackScope: 'aoe',
      });
    });
  });

  describe('log entries on cast', () => {
    it('posts one exact ability_use entry per target with the promptId link', async () => {
      const ctx = makeCombatContext('Goblin', 'Orc');
      stubCast(ctx, failedAll);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const abilityEntries = addEntry.mock.calls.filter(c => c[1].type === 'ability_use');
      expect(abilityEntries.length).toBe(2);
      expect(abilityEntries.map(c => c[1])).toEqual([
        {
          type: 'ability_use',
          characterName: casterName,
          abilityName: 'Fear',
          description: `${casterName} casts Fear! Goblin must make a WIS save (DC ${STUB_DC}) or drop what it's holding and become Frightened.`,
          promptId: 'fear-prompt',
        },
        {
          type: 'ability_use',
          characterName: casterName,
          abilityName: 'Fear',
          description: `${casterName} casts Fear! Orc must make a WIS save (DC ${STUB_DC}) or drop what it's holding and become Frightened.`,
          promptId: 'fear-prompt',
        },
      ]);
    });
  });

  describe('on successful save', () => {
    it('records a clean rollback result and posts an exact save_result entry', async () => {
      const ctx = makeCombatContext('Goblin');
      stubCast(ctx, savedAll);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveResult: 'success',
        roll: 8,
        total: 18,
        conditions: [],
        appliedDamage: 0,
      });
      const saveEntries = addEntry.mock.calls.filter(c => c[1].type === 'save_result');
      expect(saveEntries.map(c => c[1])).toEqual([{
        type: 'save_result',
        characterName: casterName,
        rollType: 'save-fear',
        targetName: 'Goblin',
        saveDc: STUB_DC,
        saveType: 'WIS',
        success: true,
        description: 'Goblin succeeded on WIS save against Fear.',
      }]);
    });

    it('applies no conditions, targetEffects, or expirations', async () => {
      const ctx = makeCombatContext('Goblin');
      stubCast(ctx, savedAll);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledTimes(2);
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(addExpiration).not.toHaveBeenCalled();
    });
  });

  describe('on failed save', () => {
    it('appends frightened with lowercase dedupe and records the condition in rollback', async () => {
      const ctx = makeCombatContext('Goblin');
      stubCast(ctx, failedAll);
      getRuntimeValue.mockImplementation((_characterKey, runtimeKey) =>
        (runtimeKey === 'activeConditions' ? ['frightened', 'Stunned'] : []));

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin', 'activeConditions', ['Stunned', 'frightened'], campaignName,
      );
      expect(addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveResult: 'failure',
        roll: 8,
        total: 5,
        conditions: ['frightened'],
        appliedDamage: 0,
      });
    });

    it('posts an exact condition log entry with the dash-and-drop note', async () => {
      const ctx = makeCombatContext('Goblin');
      stubCast(ctx, failedAll);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const conditionEntries = addEntry.mock.calls.filter(c => c[1].type === 'condition');
      expect(conditionEntries.map(c => c[1])).toEqual([{
        type: 'condition',
        action: 'applied',
        characterName: 'Goblin',
        condition: 'Frightened',
        reason: 'Fear spell',
        note: 'Goblin drops what it was holding, becomes Frightened, and must take the Dash action to move away from TestCaster on each of its turns.',
        timestamp: expect.any(Number),
      }]);
    });

    it('registers a frightened condition expiration at the round seam', async () => {
      const ctx = makeCombatContext('Goblin');
      stubCast(ctx, failedAll);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addExpiration).toHaveBeenCalledWith({
        attackerName: casterName,
        targetName: 'Goblin',
        effects: [{ type: 'condition', condition: 'frightened' }],
        campaignName,
      });
    });

    it('pushes the exact fear_end_on_los te (duration: concentration, handler:69)', async () => {
      const ctx = makeCombatContext('Goblin');
      stubCast(ctx, failedAll);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [{
        target: 'Goblin',
        effect: 'fear_end_on_los',
        source: casterName,
        condition: 'frightened',
        dc: STUB_DC,
        duration: 'concentration',
      }], campaignName);
    });

    it('replaces the same-target fear te in place, leaving other targets untouched', async () => {
      const ctx = makeCombatContext('Goblin');
      stubCast(ctx, failedAll);
      const staleGoblinTe = { target: 'Goblin', effect: 'fear_end_on_los', source: 'OldCaster', condition: 'frightened', dc: 12, duration: '1 minute' };
      const orcTe = { target: 'Orc', effect: 'fear_end_on_los', source: 'OldCaster', condition: 'frightened', dc: 12, duration: '1 minute' };
      getRuntimeValue.mockImplementation((_characterKey, runtimeKey) =>
        (runtimeKey === 'targetEffects' ? [staleGoblinTe, orcTe] : []));

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [
        {
          target: 'Goblin',
          effect: 'fear_end_on_los',
          source: casterName,
          condition: 'frightened',
          dc: STUB_DC,
          duration: 'concentration',
        },
        orcTe,
      ], campaignName);
    });
  });

  describe('summary popup', () => {
    it('full-string pin: affected branch (mixed fail/save) with per-target results, saved count, and LOS repeat-save rule', async () => {
      const ctx = makeCombatContext('Goblin', 'Orc');
      stubCast(ctx, (targetName) => targetName === 'Orc');

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload).toEqual({
        type: 'automation_info',
        name: 'Fear',
        description: `Fear affects 1 creature(s). Goblin drops what it's holding and is Frightened. 1 creature(s) saved. Affected creatures drop what they're holding, are Frightened, and must use the Dash action to move away on each of their turns. An affected creature can repeat the save if it ends its turn without line of sight to you.`,
      });
    });

    it('full-string pin: none-affected branch counts saves only', async () => {
      const ctx = makeCombatContext('Goblin');
      stubCast(ctx, savedAll);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload).toEqual({
        type: 'automation_info',
        name: 'Fear',
        description: 'No creatures affected by Fear. 1 creature(s) saved.',
      });
    });

    it('uses the action name (not the spell text) in the popup payload', async () => {
      const ctx = makeCombatContext('Goblin');
      stubCast(ctx, failedAll);

      const result = await handle(
        { name: 'Terror', automation: { type: 'fear' } },
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.name).toBe('Terror');
    });
  });

  describe('when every creature in combat is the caster', () => {
    it('skips prompts and logging entirely but still registers concentration', async () => {
      const ctx = makeCombatContext(casterName);
      stubCast(ctx);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(createSaveListener).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(addExpiration).not.toHaveBeenCalled();
      expect(addConcentration).toHaveBeenCalledTimes(1);
      expect(result.payload.description).toBe('No creatures affected by Fear. 0 creature(s) saved.');
    });
  });

  describe('when addEntry rejects', () => {
    it('catches ability_use log failures without crashing the cast', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
      const ctx = makeCombatContext('Goblin');
      stubCast(ctx, failedAll);
      addEntry.mockRejectedValueOnce(new Error('log error'));

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(consoleSpy).toHaveBeenCalledWith('[fear] Error:', expect.any(Error));
      // Cast flow continued despite the lost cast log.
      expect(addTargetResult).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        saveResult: 'failure',
      }));
    });

    it('catches save_result log failures without crashing the cast', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
      const ctx = makeCombatContext('Goblin');
      stubCast(ctx, savedAll);
      addEntry
        .mockReturnValueOnce(Promise.resolve({}))
        .mockRejectedValueOnce(new Error('save result log error'));

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(consoleSpy).toHaveBeenCalledWith('[fear] Error:', expect.any(Error));
      expect(addTargetResult).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        saveResult: 'success',
      }));
    });
  });
});
