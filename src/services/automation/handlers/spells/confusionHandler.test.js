// @maintained-by-ai
/**
 * confusion TRIO seam map — two modules, three lanes (full map header:
 * confusionHandler.saveResults.test.js #1889):
 *  - THIS LANE (#1890, main) — confusionHandler.js handle() ORCHESTRATION:
 *        no-creatures early-return popup (+ no-side-effect guard),
 *        concentration registration (DC resolution branches, storage.set +
 *        combat-summary-updated dispatch), storeSpellLastAttack wiring,
 *        target selection (metaCtx / empty-metaCtx / caster-exclusion fallback /
 *        name-resolution skip), createSaveListener prompt options (exact object:
 *        WIS, dcSuccess 'none', condition 'charmed', heightenTarget→disadvantage),
 *        ability_use log CONTENT (exact own-composition entry incl. promptId),
 *        action-name flow-through, and popup summary strings (full own-composition
 *        pins: all-fail / all-save / mixed).
 *        Production liveness verified 2026-10-16: dispatched via automation/
 *        index.js L257 import + L589 `confusion: handleConfusion`. handle() calls
 *        NO applyEndOfTurnConfusionSave/removeConfusionEffect — those live only
 *        in confusionTurnStartHandler.js (#1891's module); their zero-prod-caller
 *        audit stays with #1891, untouched here.
 *  - #1889 saveResults (CLOSED) — SAME module, save-outcome helpers
 *        (recordConfusionSaveSuccess/applyConfusionFailure): save_result/
 *        addTargetResult shapes, ?? 0 fallback, condition append order, strict
 *        expiration tuple, campaign-te exact writes. NOT re-pinned here.
 *        Log-count coupling kept honest: their 1-target-success cast counts 2
 *        addEntry (1 ability_use + 1 save_result); this lane's 2-target-fail
 *        cast counts 4 (2 ability_use + 2 condition) — both agree with the
 *        handler's per-target log map (fail logs condition, not save_result).
 *  - #1891 confusionTurnStartHandler.test.js — DIFFERENT module (turn-start
 *        1d10 table, end-of-turn save prompt, effect removal).
 *
 * Reassignment notes (verified at source 2026-10-16):
 *  - 'reports individual affected creatures' + 'mentions confused behavior' +
 *        affected-count fragments folded into full-string summary pins
 *        ('summarises an all-fail cast...' covers joined results + behavior tail).
 *  - 'reports saved creature count in the summary' folded into the mixed +
 *        all-save full-string pins.
 *  - 'includes promptId...' folded into the exact ability_use object pin.
 *  - 'uses action.name...' + 'uses the action name in the popup payload' merged
 *        into 'custom action name flows through ability_use and popup'.
 *  - 'uses custom playerStats name...' deleted — the ability_use description is
 *        now pinned as a full literal, so the caster-name slot is proven.
 *  - 'targets all non-caster creatures when no metaCtx.targets' deleted —
 *        same fallback branch as 'excludes caster when falling back...' (kept).
 *  - 'handles targets passed as string array in metaCtx' deleted — exact
 *        duplicate of 'uses metaCtx.targets when provided'.
 *  - 'handles single non-caster target' deleted — call-count covered by
 *        target-selection pins, count-1 prose shares the pinned template.
 *  - 'does not apply disadvantage when target does not match heightenTarget'
 *        folded into 'applies disadvantage only to the heightenTarget' (pins
 *        true AND false in one cast); disadvantage:false default also pinned by
 *        the exact createSaveListener options object.
 *  - 'dispatches combat-summary-updated' + 'stores combatSummary via storage'
 *        merged — same concentration-added seam.
 *  - 'uses WIS save type and computed DC' + 'passes condition as charmed'
 *        merged into one exact full-options toHaveBeenCalledWith; its
 *        buildSaveDc(auto, ps) pin lives in #1889 (DC-computed-once seam).
 *  - Scattered positional getRuntimeValue.mockReturnValue([]) replaced with a
 *        mockRuntime key-router default (reads are incidental to this lane;
 *        read-targeting resilience lives in #1889).
 *
 * Turn-based only: no timers in this file; concentration is a latch, the 1d10
 * behavior roll belongs to the turn-start seam (#1891).
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
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { storeSpellLastAttack } from '../../common/damageRollback.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import storage from '../../../ui/storage.js';

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

// Key-router default: handle()'s failure path incidentally reads
// getRuntimeValue(target, 'activeConditions') and ('campaign', 'targetEffects').
// Route by runtime key so reads never return undefined mid-loop; read-precision
// resilience pins belong to #1889.
function mockRuntime(reads = {}) {
  getRuntimeValue.mockImplementation((_owner, key) => {
    if (key === 'activeConditions') return reads.activeConditions ?? [];
    if (key === 'targetEffects') return reads.targetEffects ?? [];
    return undefined;
  });
}

// ── Tests ──────────────────────────────────────────────────────

describe('confusionHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRuntime();
  });

  describe('when no combat context exists', () => {
    it('returns a popup indicating no creatures in combat when context is null', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      getCombatContext.mockResolvedValue(null);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe('No creatures in combat. Confusion has no effect.');
      // Early-return seam (L115-124): nothing downstream may fire.
      expect(addConcentration).not.toHaveBeenCalled();
      expect(storeSpellLastAttack).not.toHaveBeenCalled();
      expect(createSaveListener).not.toHaveBeenCalled();
    });

    it('returns a popup when combat context has no creatures', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      getCombatContext.mockResolvedValue({ creatures: [] });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe('No creatures in combat. Confusion has no effect.');
    });
  });

  describe('concentration registration', () => {
    it('registers concentration when combat summary exists', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([{ name: 'Goblin' }]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(13);
      createSaveListener.mockReturnValue(successSaveListener());
      getCombatSummary.mockReturnValue({ creatures: [{ name: casterName }] });

      await handle(action, ps, campaignName, null);

      expect(addConcentration).toHaveBeenCalledWith(
        expect.objectContaining({ creatures: [{ name: casterName }] }),
        casterName,
        'Confusion',
        13,
      );
    });

    it('uses spellAbilities.saveDc when available', async () => {
      const ps = makePlayerStats({ spellAbilities: { saveDc: 15 } });
      const action = makeAction();
      const ctx = makeCombatContext([{ name: 'Goblin' }]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(13); // differs — concentration DC must come from spellAbilities
      createSaveListener.mockReturnValue(successSaveListener());
      getCombatSummary.mockReturnValue({ creatures: [{ name: casterName }] });

      await handle(action, ps, campaignName, null);

      expect(addConcentration).toHaveBeenCalledWith(
        expect.any(Object),
        casterName,
        'Confusion',
        15,
      );
    });

    it('falls back to 8 + proficiency when spellAbilities.saveDc is missing', async () => {
      const ps = makePlayerStats({ spellAbilities: null });
      const action = makeAction();
      const ctx = makeCombatContext([{ name: 'Goblin' }]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(13);
      createSaveListener.mockReturnValue(successSaveListener());
      getCombatSummary.mockReturnValue({ creatures: [{ name: casterName }] });

      await handle(action, ps, campaignName, null);

      expect(addConcentration).toHaveBeenCalledWith(
        expect.any(Object),
        casterName,
        'Confusion',
        8 + 4, // 8 + proficiency
      );
    });

    it('skips concentration when combat summary is null', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([{ name: 'Goblin' }]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(13);
      createSaveListener.mockReturnValue(successSaveListener());
      getCombatSummary.mockReturnValue(null);

      await handle(action, ps, campaignName, null);

      expect(addConcentration).not.toHaveBeenCalled();
    });

    it('dispatches combat-summary-updated and stores combatSummary via storage when concentration is added', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([{ name: 'Goblin' }]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(13);
      createSaveListener.mockReturnValue(successSaveListener());
      const cs = { creatures: [{ name: casterName }] };
      getCombatSummary.mockReturnValue(cs);

      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

      await handle(action, ps, campaignName, null);

      expect(dispatchSpy).toHaveBeenCalledWith(new CustomEvent('combat-summary-updated'));
      expect(storage.set).toHaveBeenCalledWith('combatSummary', cs, campaignName);
      dispatchSpy.mockRestore();
    });
  });

  describe('spell last attack tracking', () => {
    it('stores last attack info with correct parameters', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([{ name: 'Goblin' }]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue(successSaveListener());

      await handle(action, ps, campaignName, null);

      expect(storeSpellLastAttack).toHaveBeenCalledWith(campaignName, {
        casterName,
        spellName: 'Confusion',
        saveType: 'WIS',
        saveDc: 15,
        attackScope: 'aoe',
      });
    });
  });

  describe('target selection', () => {
    it('uses metaCtx.targets when provided', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([
        { name: 'Goblin' },
        { name: 'Orc' },
        { name: 'Giant Spider' },
      ]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(13);
      createSaveListener.mockReturnValue(successSaveListener());

      action.metaCtx = { targets: ['Goblin', 'Orc'] };

      await handle(action, ps, campaignName, null);

      expect(createSaveListener).toHaveBeenCalledTimes(2);
      const targetNames = createSaveListener.mock.calls.map(c => c[1].targetName);
      expect(targetNames).toEqual(['Goblin', 'Orc']);
    });

    it('excludes caster when falling back to all creatures', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([
        { name: 'Goblin' },
        { name: casterName },
        { name: 'Orc' },
      ]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(13);
      createSaveListener.mockReturnValue(successSaveListener());

      await handle(action, ps, campaignName, null);

      expect(createSaveListener).toHaveBeenCalledTimes(2);
      const targetNames = createSaveListener.mock.calls.map(c => c[1].targetName);
      expect(targetNames).toEqual(['Goblin', 'Orc']);
    });

    it('handles empty metaCtx.targets by falling back to all non-caster creatures', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([
        { name: casterName },
        { name: 'Goblin' },
        { name: 'Orc' },
      ]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(13);
      createSaveListener.mockReturnValue(successSaveListener());

      action.metaCtx = { targets: [] };

      await handle(action, ps, campaignName, null);

      expect(createSaveListener).toHaveBeenCalledTimes(2);
      const targetNames = createSaveListener.mock.calls.map(c => c[1].targetName);
      expect(targetNames).not.toContain(casterName);
    });

    it('skips targets not found in combat context', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([{ name: 'Goblin' }]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(13);
      createSaveListener.mockReturnValue(successSaveListener());

      action.metaCtx = { targets: ['Goblin', 'NonExistent'] };

      await handle(action, ps, campaignName, null);

      expect(createSaveListener).toHaveBeenCalledTimes(1);
      expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        targetName: 'Goblin',
      }));
    });

    it('handles all creatures being the caster (no enemies)', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([{ name: casterName }]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(13);
      createSaveListener.mockReturnValue(successSaveListener());

      const result = await handle(action, ps, campaignName, null);

      expect(createSaveListener).not.toHaveBeenCalled();
      expect(result.payload.description).toBe('No creatures affected by Confusion. 0 creature(s) saved.');
    });
  });

  describe('save prompt options', () => {
    it('passes the exact prompt options to createSaveListener', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([{ name: 'Goblin' }]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue(failSaveListener());

      await handle(action, ps, campaignName, null);

      // Exact full options object — WIS type, DC from buildSaveDc,
      // dcSuccess 'none', condition charmed, no heightenTarget → disadvantage false.
      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveType: 'WIS',
        saveDc: 15,
        dcSuccess: 'none',
        disadvantage: false,
        condition: 'charmed',
      });
    });

    it('applies disadvantage only to the heightenTarget', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([{ name: 'Goblin' }, { name: 'Orc' }]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(13);
      createSaveListener.mockReturnValue(successSaveListener());

      action.metaCtx = { targets: ['Goblin', 'Orc'], heightenTarget: 'Goblin' };

      await handle(action, ps, campaignName, null);

      const calls = createSaveListener.mock.calls.map(c => ({
        targetName: c[1].targetName,
        disadvantage: c[1].disadvantage,
      }));
      expect(calls).toEqual([
        { targetName: 'Goblin', disadvantage: true },
        { targetName: 'Orc', disadvantage: false },
      ]);
    });
  });

  describe('ability_use log entry', () => {
    it('posts an ability_use entry for each target', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([
        { name: 'Goblin' },
        { name: 'Orc' },
      ]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(13);
      createSaveListener.mockReturnValue(failSaveListener());

      await handle(action, ps, campaignName, null);

      // Coupled with #1889's per-target counts: fail path logs
      // ability_use + condition per target (no save_result addEntry on failure).
      expect(addEntry).toHaveBeenCalledTimes(4);
      const abilityEntries = addEntry.mock.calls.filter(
        call => call[1].type === 'ability_use',
      );
      expect(abilityEntries.length).toBe(2);
    });

    it('logs an ability_use entry with exact own-composition fields', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([{ name: 'Goblin' }]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue(failSaveListener());

      await handle(action, ps, campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: casterName,
        abilityName: 'Confusion',
        description: 'TestCaster casts Confusion! Goblin must make a WIS save (DC 15) or become Confused (can\'t take Bonus Actions or Reactions, subject to 1d10 behavior each turn).',
        promptId: 'confusion-prompt',
      });
    });

    it('flows the custom action name through ability_use and popup', async () => {
      const ps = makePlayerStats();
      const action = { name: "Tasha's Confusion", automation: { type: 'confusion', saveType: 'WIS', saveDc: 13 } };
      const ctx = makeCombatContext([{ name: 'Goblin' }]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(10);
      createSaveListener.mockReturnValue(failSaveListener());

      const result = await handle(action, ps, campaignName, null);

      const abilityEntry = addEntry.mock.calls.find(c => c[1].type === 'ability_use')[1];
      expect(abilityEntry.abilityName).toBe("Tasha's Confusion");
      expect(abilityEntry.characterName).toBe(casterName);
      expect(result.payload.name).toBe("Tasha's Confusion");
    });
  });

  describe('summary popup', () => {
    it('summarises an all-fail cast with the exact own-composition description', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([
        { name: 'Goblin' },
        { name: 'Orc' },
      ]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(10);
      createSaveListener.mockReturnValue(failSaveListener());

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Confusion');
      // Full string: affected count + joined per-target results + saved count
      // + behavior tail (folds the old fragment pins).
      expect(result.payload.description).toBe(
        "Confusion affects 2 creature(s). Goblin is Confused. Orc is Confused. 0 creature(s) saved. Affected creatures can't take Bonus Actions or Reactions and are subject to confused behavior each turn."
      );
    });

    it('summarises mixed results with exact counts in the full description', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([
        { name: 'Goblin' },
        { name: 'Orc' },
        { name: 'Giant Spider' },
      ]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(10);

      let callCount = 0;
      createSaveListener.mockImplementation(() => {
        callCount++;
        // First two succeed, third fails
        return {
          promptId: 'confusion-prompt',
          promise: Promise.resolve({ success: callCount <= 2 }),
        };
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toBe(
        "Confusion affects 1 creature(s). Giant Spider is Confused. 2 creature(s) saved. Affected creatures can't take Bonus Actions or Reactions and are subject to confused behavior each turn."
      );
    });

    it('reports no creatures affected when all save', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const ctx = makeCombatContext([
        { name: 'Goblin' },
        { name: 'Orc' },
      ]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(20);
      createSaveListener.mockReturnValue(successSaveListener());

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('No creatures affected by Confusion. 2 creature(s) saved.');
    });
  });

  describe('edge cases', () => {
    it('handles missing automation property by defaulting to empty object', async () => {
      const ps = makePlayerStats();
      const ctx = makeCombatContext([{ name: 'Goblin' }]);
      getCombatContext.mockResolvedValue(ctx);
      buildSaveDc.mockReturnValue(10);
      createSaveListener.mockReturnValue(failSaveListener());

      const result = await handle({ name: 'Confusion' }, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(buildSaveDc).toHaveBeenCalledWith({}, ps);
    });
  });
});
