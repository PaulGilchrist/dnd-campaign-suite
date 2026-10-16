// @maintained-by-ai
/**
 * confusion TRIO seam map — two modules, three lanes:
 *  - THIS LANE (#1889, saveResults) — confusionHandler.js save-result outcome side:
 *        the two per-target outcome helpers reached from handle()'s target loop —
 *        recordConfusionSaveSuccess (L24-43) and applyConfusionFailure (L45-102).
 *        Owns: save_result log + addTargetResult shape on SUCCESS (incl. the ?? 0
 *        roll/total fallback, the success no-write guard, and the addEntry .catch
 *        resilience), and on FAILURE: the charmed+speed_zero condition write
 *        (filter-then-append-at-end order, dedupe, survivor casing), the exact
 *        own-composition 'condition applied' log string, the strict 4-effect
 *        addExpiration tuple, and the campaign targetEffects te write
 *        ('campaign' owner-key, 4-arg arity, replace-in-place semantics).
 *        Production liveness verified 2026-10-16: handle dispatched via
 *        automation/index.js L257 import + L589 `confusion: handleConfusion`
 *        (automation type 'confusion').
 *  - #1890 confusionHandler.test.js (main) — SAME module, handle() orchestration:
 *        no-creatures popup, concentration registration + storage/event,
 *        storeSpellLastAttack, target selection (metaCtx / caster-exclusion /
 *        name-resolution), createSaveListener prompt params (WIS, dcSuccess 'none',
 *        heightenTarget→disadvantage), ability_use log CONTENT, and popup summary
 *        strings. Both lanes mock the same seams; ownership split by assertion
 *        target, not file — see overlap flags below.
 *  - #1891 confusionTurnStartHandler.test.js — DIFFERENT module
 *        (confusionTurnStartHandler.js): the turn-start 1d10 behavior table
 *        (handleConfusionTurnStart), end-of-turn save prompt assembly, and
 *        effect removal. Reached in production via turnStartEffects.js L181
 *        'confusion_turn_start' dispatcher → applyConfusionTurnStart L619.
 *        THE CAST-INITIATED HANDOFF FROM THIS LANE: the te my failure path writes
 *        ({target, effect:'confusion', source, dc, conditions, duration:
 *        'concentration'}) is the input handleConfusionTurnStart reads (te.dc)
 *        and the same te createRollConditionSaveHandler.handleConfusionSuccess
 *        (components/initiative/createRollConditionSaveHandler.js L97-122) uses
 *        to remove charmed+speed_zero + te on the initiative-reroll WIS save.
 *        #1891, your dc/source pins should agree with the shape pinned here.
 *
 * Overlap flags for later lanes (exact test names):
 *  - #1890 owns ability_use content; THIS lane only COUNTS ability_use beside
 *        save_result (test 'logs exactly one ability_use plus one save_result per
 *        target'). If per-target log entry counts change, re-sync #1890's
 *        'posts an ability_use entry for each target' (toHaveBeenCalledTimes(4)).
 *  - #1890 owns createSaveListener option pins ('applies disadvantage when target
 *        matches heightenTarget' etc.) and popup summary strings ('reports saved
 *        creature count in the summary', 'reports no creatures affected when all
 *        save', 'reports mixed success/failure across multiple targets'). This
 *        lane never re-pins prompt options or summary prose — the old test named
 *        'does not call buildSaveDc with advantage/disadvantage confusion
 *        (disadvantage via metaCtx)' did neither cleanly; renamed and repurposed
 *        to a DC-computed-once-per-cast pin.
 *  - #1891: applyEndOfTurnConfusionSave and removeConfusionEffect appear to have
 *        NO production callers outside their own module (grep of src/ finds only
 *        confusionTurnStartHandler.js + its test). Audit liveness before trimming
 *        — deletion needs evidence.
 *
 * Reassignment notes (verified at source 2026-10-16):
 *  - Old 'includes success description in target name' (toContain pairs) folded
 *        into 'posts a save_result log entry with exact own-composition fields'
 *        — full-object toEqual incl. the full description string.
 *  - Old 'deduplicates...' + 'preserves other conditions...' collapsed into one
 *        strict survivor-order pin (dedupe + preservation + append-at-end order in
 *        a single toEqual); old 'removes existing charmed and speed_zero before
 *        reapplying' kept as the empty-survivors exact case.
 *  - Old 'tracks confusion effect in targetEffects...' (find + field-by-field)
 *        upgraded to an exact 4-arg setRuntimeValue('campaign', ...) toEqual —
 *        pins the literal 'campaign' owner key, the full te shape, and the
 *        campaignName tail (registerTargetEffect/skipSync path NOT used here;
 *        registry internals owned by targetEffectDefinitions.test.js).
 *  - Old 'updates existing confusion effect...' strengthened to replace-IN-PLACE:
 *        a second unrelated te is seeded and pinned to survive at its index.
 *  - Old 'registers expirations...' upgraded arrayContaining → strict full tuple,
 *        pinning remove_target_effect's target+source (cleanup matchers) and the
 *        whole {attackerName, targetName, effects, campaignName} wrapper.
 *  - Old 'handles saveResult with missing roll/total fields' asserted only that
 *        nothing threw; now pins the ?? 0 fallback landing in addTargetResult.
 *  - Old 'handles non-array/undefined activeConditions' + 'non-array targetEffects'
 *        all used ONE global getRuntimeValue mock value, so each test hit BOTH
 *        reads — indistinguishable. Replaced with a mockRuntime key-router so each
 *        resilience test targets exactly one read ('|| []' vs Array.isArray are
 *        distinct guard branches, kept separate).
 *  - 'does not apply any conditions or expirations on save success' strengthened to
 *        a blanket no-setRuntimeValue + no-addExpiration guard.
 *  - Added addEntry mockRejectedValueOnce resilience pin for handle()'s ability_use
 *        .catch (cast must still complete and log the save_result).
 *
 * Turn-based: te.duration 'concentration' is a latch string cleared at the
 * concentration-break / expiration / reroll-save seams, never a wall-clock; the
 * 1d10 behavior roll lives at the turn-start seam (#1891). No timers in this
 * file — Date.now() is only a mocked log timestamp.
 */
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
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
  storeSpellLastAttack: vi.fn(),
  addTargetResult: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

vi.mock('../../../ui/storage.js', () => ({
  __esModule: true,
  default: {
    set: vi.fn(() => Promise.resolve()),
  },
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './confusionHandler.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { addEntry } from '../../../ui/logService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { addTargetResult } from '../../common/damageRollback.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';
const casterName = 'TestCaster';

function makePlayerStats(overrides = {}) {
  return {
    name: casterName,
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Intelligence', bonus: 3 }],
    spellAbilities: { saveDc: 13 },
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Confusion',
    automation: {
      type: 'confusion',
      saveType: 'WIS',
      saveDc: 13,
      ...automation,
    },
  };
}

function makeCombatContext(creatures) {
  return {
    creatures,
    players: [],
    placedItems: [],
  };
}

function failSaveListener() {
  return {
    promptId: 'confusion-prompt',
    promise: Promise.resolve({ success: false, roll: 5, total: 7 }),
  };
}

function successSaveListener() {
  return {
    promptId: 'confusion-prompt',
    promise: Promise.resolve({ success: true, roll: 18, total: 20 }),
  };
}

// Key-router: handler reads getRuntimeValue(target, 'activeConditions', campaign)
// and getRuntimeValue('campaign', 'targetEffects') — route by the runtime key
// (2nd arg) so resilience tests exercise ONE read each.
function mockRuntime(reads = {}) {
  getRuntimeValue.mockImplementation((_owner, key) => {
    if (key === 'activeConditions') return reads.activeConditions ?? [];
    if (key === 'targetEffects') return reads.targetEffects ?? [];
    return undefined;
  });
}

function setCallsForKey(runtimeKey) {
  return setRuntimeValue.mock.calls.filter(call => call[1] === runtimeKey);
}

// ── Tests ──────────────────────────────────────────────────────

describe('confusionHandler - save results', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRuntime();
  });

  describe('on successful save', () => {
    it('posts a save_result log entry with exact own-composition fields', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([{ name: 'Goblin' }]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(20);
      createSaveListener.mockReturnValue(successSaveListener());

      await handle(action, ps, campaignName, null);

      const saveResultEntries = addEntry.mock.calls.filter(
        call => call[1].type === 'save_result',
      );
      expect(saveResultEntries.length).toBe(1);
      expect(saveResultEntries[0][1]).toEqual({
        type: 'save_result',
        characterName: casterName,
        rollType: 'save-confusion',
        targetName: 'Goblin',
        saveDc: 20,
        saveType: 'WIS',
        success: true,
        description: 'Goblin succeeded on WIS save against Confusion.',
      });
    });

    it('posts a save_result entry for each target that saves', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([
        { name: 'Goblin' },
        { name: 'Orc' },
      ]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(20);
      createSaveListener.mockReturnValue(successSaveListener());

      await handle(action, ps, campaignName, null);

      const saveResultEntries = addEntry.mock.calls.filter(
        call => call[1].type === 'save_result',
      );
      expect(saveResultEntries.length).toBe(2);
      expect(saveResultEntries.map(c => c[1].targetName)).toEqual(['Goblin', 'Orc']);
    });

    it('posts a save_result via addTargetResult with correct params', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([{ name: 'Goblin' }]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(20);
      createSaveListener.mockReturnValue(successSaveListener());

      await handle(action, ps, campaignName, null);

      expect(addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveResult: 'success',
        roll: 18,
        total: 20,
        conditions: [],
        appliedDamage: 0,
      });
    });

    it('falls back to roll/total 0 in addTargetResult when the save result omits them', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([{ name: 'Goblin' }]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(10);
      createSaveListener.mockReturnValue({
        promptId: 'confusion-prompt',
        promise: Promise.resolve({ success: true }),
      });

      await handle(action, ps, campaignName, null);

      // ?? 0 fallback (confusionHandler.js L28-29) must land in the rollback record
      expect(addTargetResult).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        targetName: 'Goblin',
        saveResult: 'success',
        roll: 0,
        total: 0,
      }));
      const saveEntries = addEntry.mock.calls.filter(c => c[1].type === 'save_result');
      expect(saveEntries.length).toBe(1);
    });

    it('does not write conditions, targetEffects, or expirations on save success', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([{ name: 'Goblin' }]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(20);
      createSaveListener.mockReturnValue(successSaveListener());

      await handle(action, ps, campaignName, null);

      expect(addExpiration).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('logs exactly one ability_use plus one save_result per target', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([{ name: 'Goblin' }]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(20);
      createSaveListener.mockReturnValue(successSaveListener());

      await handle(action, ps, campaignName, null);

      expect(addEntry).toHaveBeenCalledTimes(2);
      const abilityEntries = addEntry.mock.calls.filter(call => call[1].type === 'ability_use');
      const saveEntries = addEntry.mock.calls.filter(call => call[1].type === 'save_result');
      expect(abilityEntries.length).toBe(1);
      expect(saveEntries.length).toBe(1);
    });

    it('completes the cast and still logs the save_result when the ability_use log rejects', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([{ name: 'Goblin' }]);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(20);
      createSaveListener.mockReturnValue(successSaveListener());
      addEntry.mockRejectedValueOnce(new Error('log down'));

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(addEntry).toHaveBeenCalledTimes(2);
      expect(addEntry.mock.calls[1][1].type).toBe('save_result');
      expect(addTargetResult).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('on failed save', () => {
    it('writes charmed and speed_zero to activeConditions with the exact 4-arg call', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([{ name: 'Goblin' }]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(10);
      mockRuntime({ activeConditions: [] });
      createSaveListener.mockReturnValue(failSaveListener());

      await handle(action, ps, campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin', 'activeConditions', ['charmed', 'speed_zero'], campaignName,
      );
    });

    it('deduplicates, preserves survivor order and casing, and appends charmed + speed_zero at the end', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([{ name: 'Goblin' }]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(10);
      mockRuntime({ activeConditions: ['charmed', 'frightened', 'speed_zero', 'blinded'] });
      createSaveListener.mockReturnValue(failSaveListener());

      await handle(action, ps, campaignName, null);

      const conditionsArg = setCallsForKey('activeConditions')[0][2];
      expect(conditionsArg).toEqual(['frightened', 'blinded', 'charmed', 'speed_zero']);
    });

    it('replaces a same-target activeConditions list that held only confusion conditions', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([{ name: 'Goblin' }]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(10);
      mockRuntime({ activeConditions: ['charmed', 'speed_zero'] });
      createSaveListener.mockReturnValue(failSaveListener());

      await handle(action, ps, campaignName, null);

      const conditionsArg = setCallsForKey('activeConditions')[0][2];
      expect(conditionsArg).toEqual(['charmed', 'speed_zero']);
    });

    it('tolerates non-array activeConditions via the Array.isArray guard', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([{ name: 'Goblin' }]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(10);
      mockRuntime({ activeConditions: 'not-an-array' });
      createSaveListener.mockReturnValue(failSaveListener());

      await handle(action, ps, campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin', 'activeConditions', ['charmed', 'speed_zero'], campaignName,
      );
    });

    it('tolerates undefined activeConditions via the || [] guard', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([{ name: 'Goblin' }]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(10);
      getRuntimeValue.mockImplementation((_owner, key) =>
        key === 'activeConditions' ? undefined : []);
      createSaveListener.mockReturnValue(failSaveListener());

      await handle(action, ps, campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin', 'activeConditions', ['charmed', 'speed_zero'], campaignName,
      );
    });

    it('tracks the confusion targetEffect via the exact campaign-owner write', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([{ name: 'Goblin' }]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(10);
      mockRuntime();
      createSaveListener.mockReturnValue(failSaveListener());

      await handle(action, ps, campaignName, null);

      // 'campaign' owner key + campaignName tail: direct write, NOT the
      // registerTargetEffect skipSync path (registry owned by
      // targetEffectDefinitions.test.js).
      expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [{
        target: 'Goblin',
        effect: 'confusion',
        source: casterName,
        conditions: ['charmed', 'speed_zero'],
        dc: 10,
        duration: 'concentration',
      }], campaignName);
    });

    it('replaces an existing same-target confusion effect in place, preserving other effects', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([{ name: 'Goblin' }]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(10);
      const orcEffect = { target: 'Orc', effect: 'confusion', source: 'OldCaster', dc: 12 };
      mockRuntime({
        targetEffects: [
          { target: 'Goblin', effect: 'confusion', source: 'OldCaster', dc: 12 },
          orcEffect,
        ],
      });
      createSaveListener.mockReturnValue(failSaveListener());

      await handle(action, ps, campaignName, null);

      const effectCalls = setCallsForKey('targetEffects');
      const effects = effectCalls[effectCalls.length - 1][2];
      // replace-IN-PLACE at index 0 (not pop-and-push): Orc's te survives untouched
      expect(effects).toEqual([{
        target: 'Goblin',
        effect: 'confusion',
        source: casterName,
        conditions: ['charmed', 'speed_zero'],
        dc: 10,
        duration: 'concentration',
      }, orcEffect]);
    });

    it('tolerates non-array targetEffects by rebuilding a fresh array', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([{ name: 'Goblin' }]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(10);
      mockRuntime({ targetEffects: 'not-an-array' });
      createSaveListener.mockReturnValue(failSaveListener());

      await handle(action, ps, campaignName, null);

      const effectCalls = setCallsForKey('targetEffects');
      expect(effectCalls.length).toBe(1);
      expect(effectCalls[0][2]).toEqual([expect.objectContaining({
        target: 'Goblin',
        effect: 'confusion',
        source: casterName,
        dc: 10,
      })]);
    });

    it('posts a condition log entry with exact own-composition fields', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([{ name: 'Goblin' }]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(10);
      mockRuntime();
      createSaveListener.mockReturnValue(failSaveListener());

      await handle(action, ps, campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: 'Goblin',
        condition: 'Confused',
        reason: 'Confusion spell',
        note: "Goblin is Confused. Can't take Bonus Actions or Reactions. At start of each turn, rolls 1d10 for behavior. End of turn: repeat WIS save (DC 10) to end effect.",
        timestamp: expect.any(Number),
      });
    });

    it('registers the exact four expiration effects including cleanup matchers', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([{ name: 'Goblin' }]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(10);
      mockRuntime();
      createSaveListener.mockReturnValue(failSaveListener());

      await handle(action, ps, campaignName, null);

      // Strict tuple: remove_target_effect carries the target+source cleanup
      // matchers, and confusion_turn_start is the dispatch key
      // turnStartEffects.js L181 hands to confusionTurnStartHandler (#1891).
      expect(addExpiration).toHaveBeenCalledWith({
        attackerName: casterName,
        targetName: 'Goblin',
        effects: [
          { type: 'charmed', condition: 'charmed' },
          { type: 'speed_zero', condition: 'speed_zero' },
          { type: 'remove_target_effect', effectKey: 'confusion', target: 'Goblin', source: casterName },
          { type: 'confusion_turn_start', name: 'Confusion' },
        ],
        campaignName,
      });
    });

    it('posts save_result via addTargetResult with failure params', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([{ name: 'Goblin' }]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(10);
      mockRuntime();
      createSaveListener.mockReturnValue(failSaveListener());

      await handle(action, ps, campaignName, null);

      expect(addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveResult: 'failure',
        roll: 5,
        total: 7,
        conditions: ['charmed', 'speed_zero'],
        appliedDamage: 0,
      });
    });

    it('computes the save DC once per cast, not per target', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([{ name: 'Goblin' }, { name: 'Orc' }]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(10);
      mockRuntime();
      createSaveListener.mockReturnValue(failSaveListener());

      await handle(action, ps, campaignName, null);

      // Two targets processed, DC built once up-front (L112).
      expect(createSaveListener).toHaveBeenCalledTimes(2);
      expect(buildSaveDc).toHaveBeenCalledTimes(1);
      expect(buildSaveDc).toHaveBeenCalledWith(action.automation, ps);
    });
  });
});
