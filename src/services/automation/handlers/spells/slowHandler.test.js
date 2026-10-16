// ── slow LANE seam map (subject: slowHandler.js — handle() cast-time lane) ──
// lane (this) — slowHandler.handle() end-to-end: DC → per-target WIS save
//   prompt → slow condition + activeConditionMeta stamp → targetEffects rewrite
//   → addExpiration → caster concentration → logs → summary popup.
// LIVE-wired (grep-verified 2026-10-16): automation/index.js:609 HANDLER_MAP
//   `slow: handleSlow` via executeHandler (index.js:702). Producers:
//   (1) spellCast lane — spellCastService/execution/index.js:289 →
//       triggerSpells.handleSlow:137 → rules/features/slowService.js:19
//       builds action WITHOUT metaCtx → aoe branch + all non-caster targets;
//   (2) metamagic target-confirm lane — useSimpleSpellHandlers.js:82 runSlow
//       stamps metaCtx.targets = confirm result, which is creatureTargets:
//       spellGateHelpers.js:15 `cs.creatures.map(c => c.name)` → STRINGS.
//       (Fixed 2026-10-16: the selected-target pins below previously fed
//       object targets and pinned targetName={name:'Goblin'} — a shape no
//       prod producer emits; `[object Object]` would leak into prompts/logs.)
//   automationRouter.js:192 'slow' is UI row routing only, NOT this handle().
//   spellCastService execution's identically-named handleSlow (triggerSpells
//   .js:137) is a DISTINCT module delegating here — not a dupe lane.
// RAW check (verified vs public/data/spells.json + data/2024/spells.json rows):
//   WIS save, dcSuccess none. Both repo rows: Speed halved, −2 AC penalty,
//   DEX-save disadvantage, no reactions, action OR bonus action, 1 attack max.
//   25% somatic failure = 2024 RAW ("25 percent chance the spell fails");
//   the 5e row uses the d20≥11 delay-cast text instead — handler implements
//   the 2024 chance model for both rulesets (house simplification, pinned).
//   Official-PHB initiative disadvantage: not in the repo data rows and not
//   implemented here (turn-order/speed consumers are processed lanes).
//   Speed halving itself is CONDITION-driven: conditionEffects.js:251 case
//   'slow' → speedHalved/acPenalty+2/slowNoReactions/slowActionLimit/
//   slowSingleAttackLimit/slowSomaticFailure/saveDisadvantage[dex]; the tes
//   written here are badge + cleanup-scope markers (savePromptUtils.js:20
//   dex fallback; cleanup slowEffects.js removeSlowEffectsForTarget).
// Policy (no-timers): awaited getCombatContext at :136 — the sleetStorm
//   :286 un-awaited-await defect class is ABSENT here (grep-verified).
//   addExpiration is called WITHOUT rounds (expirationQueue signature
//   expirationQueue.js:14; undefined rounds = "don't set expiration" per
//   durationParser.js:10) → concentration/combat-scoped, no rounds countdown,
//   no expiryRounds:600-style legacy. Zero setTimeout/setInterval in module.
//   Recurring end-of-turn save is consumed downstream at the initiative seam:
//   createRollConditionSaveHandler.js:237 key 'slow' → handleSlowSuccess →
//   removeSlowEffectsForTarget.
// Flags (reported, not fixed — test-only lane):
//   • targetEffectDefinitions.js registry lacks 'action_limit',
//     'single_attack_limit', 'somatic_failure_chance' (AGENTS.md registry
//     rule); mechanics ride the condition, tes are markers. Consolidation
//     candidate for the conditions lane.
//   • slowHandler.js:13 re-export of SLOW_TE_EFFECTS/removeSlowEffectsForTarget
//     has no prod importer (createRollConditionSaveHandler.js:6 imports
//     combat/conditions/slowEffects.js directly) — dead convenience export.
//   • heightenTarget save-disadvantage branch (:178) is prod-unreachable:
//     neither producer ever stamps metaCtx.heightenTarget (grep: only
//     handleAoeDamage/aoeService stamp it). The disadvantage:false pin below
//     documents the prod-reachable shape.
// damageRollback.js is REAL (unmocked): storeSpellLastAttack/addTargetResult
//   run for real; lastAttack stamp shape pinned below, targetResults-append
//   aggregation lives in the damageRollback lane (guard early-returns while
//   the mocked runtime store returns falsy for 'lastAttack').
// ──────────────────────────────────────────────────────────────────────────────
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn(),
}));

vi.mock('../../../ui/storage.js', () => ({
  default: { set: vi.fn() },
}));

import { handle } from './slowHandler.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';
import storage from '../../../ui/storage.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';

const campaignName = 'test-campaign';
const casterName = 'Wizard1';
const targetName = 'Goblin';
const saveDc = 15;

function makePlayerStats(overrides = {}) {
  return {
    name: casterName,
    level: 5,
    proficiency: 3,
    abilities: [{ name: 'Intelligence', bonus: 3 }],
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Slow',
    automation: { type: 'slow', ...automation },
  };
}

const baseCombatContext = {
  creatures: [
    { name: casterName, type: 'player', gridX: 5, gridY: 10 },
    { name: targetName, type: 'npc', currentHp: 7, maxHp: 7 },
  ],
  players: [{ name: casterName, gridX: 5, gridY: 10 }],
  placedItems: [],
};

// Effect list written on every fail (source order; SP-109: no ac_penalty te).
function ownSlowTes(target) {
  const base = { source: casterName, duration: 'concentration', condition: 'slow' };
  return [
    { target, effect: 'no_reactions', ...base },
    { target, effect: 'dex_save_disadvantage', ...base },
    { target, effect: 'action_limit', ...base },
    { target, effect: 'single_attack_limit', ...base },
    { target, effect: 'somatic_failure_chance', ...base, chance: 25 },
  ];
}

function resolveSave(success, promptId = 'prompt') {
  createSaveListener.mockReturnValue({
    promptId,
    promise: Promise.resolve({ success }),
  });
}

// ─── handle ───

describe('slowHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('cast-time setup', () => {
    it('returns popup when no creatures in combat', async () => {
      getCombatContext.mockResolvedValue(null);
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Slow');
      expect(result.payload.description).toBe('No creatures in combat. Slow has no effect.');
    });

    it('defaults the automation argument to {} and forwards stats to buildSaveDc', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(saveDc);
      resolveSave(true);
      await handle({ name: 'Slow' }, makePlayerStats(), campaignName, null);
      expect(buildSaveDc).toHaveBeenCalledOnce();
      const [auto] = buildSaveDc.mock.calls[0];
      expect(auto).toEqual({});
    });

    it('forwards automation.saveDc (prod cast lane stamps the real DC) through buildSaveDc', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(16);
      resolveSave(true);
      await handle(makeAction({ saveDc: 16 }), makePlayerStats(), campaignName, null);
      const [auto, stats] = buildSaveDc.mock.calls[0];
      expect(auto.type).toBe('slow');
      expect(auto.saveDc).toBe(16);
      expect(stats.name).toBe(casterName);
    });
  });

  describe('target selection and save prompts', () => {
    it('prompts once per non-caster creature when untargeted', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: casterName, type: 'player', gridX: 5, gridY: 10 },
          { name: 'Goblin', type: 'npc' },
          { name: 'Orc', type: 'npc' },
          { name: 'Skeleton', type: 'npc' },
        ],
        players: [{ name: casterName, gridX: 5, gridY: 10 }],
        placedItems: [],
      });
      buildSaveDc.mockReturnValue(saveDc);
      resolveSave(true);
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(createSaveListener).toHaveBeenCalledTimes(3);
    });

    it('opens the WIS prompt with the exact prod config', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(17);
      resolveSave(true, 'prompt-config');
      await handle(makeAction({ saveDc: 17 }), makePlayerStats(), campaignName, null);
      // disadvantage:false is the prod shape — metaCtx.heightenTarget is never
      // stamped for slow by either producer (see seam map; prod-unreachable branch).
      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName,
        saveType: 'WIS',
        saveDc: 17,
        dcSuccess: 'none',
        disadvantage: false,
      });
    });

    it('logs ability_use with the full cast composition', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(saveDc);
      resolveSave(true, 'prompt-ability');
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'ability_use',
          characterName: casterName,
          abilityName: 'Slow',
          description: 'Wizard1 casts Slow! Goblin must make a WIS save (DC 15) or be slowed.',
          promptId: 'prompt-ability',
        }),
      );
    });

    it('stamps lastAttack aoe scope when untargeted', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(saveDc);
      resolveSave(true);
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'campaign', 'lastAttack',
        expect.objectContaining({
          attackerName: casterName,
          attackName: 'Slow',
          rollType: 'spell-save',
          saveType: 'WIS',
          saveDc: saveDc,
          attackScope: 'aoe',
          damageFormula: null,
          damageType: null,
          damageOnSuccess: 0,
          damageOnFailure: 0,
          targetResults: [],
        }),
        campaignName,
      );
    });

    it('selects metaCtx.targets (prod confirm lane emits STRINGS) and stamps single scope', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: casterName, type: 'player', gridX: 5, gridY: 10 },
          { name: 'Goblin', type: 'npc' },
          { name: 'Orc', type: 'npc' },
          { name: 'Skeleton', type: 'npc' },
        ],
        players: [{ name: casterName, gridX: 5, gridY: 10 }],
        placedItems: [],
      });
      buildSaveDc.mockReturnValue(saveDc);
      resolveSave(true);
      await handle(
        { name: 'Slow', automation: { type: 'slow' }, metaCtx: { targets: ['Goblin', 'Orc'] } },
        makePlayerStats(), campaignName, null,
      );
      expect(createSaveListener).toHaveBeenCalledTimes(2);
      expect(createSaveListener.mock.calls[0][1].targetName).toBe('Goblin');
      expect(createSaveListener.mock.calls[1][1].targetName).toBe('Orc');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'campaign', 'lastAttack',
        expect.objectContaining({ attackScope: 'single' }),
        campaignName,
      );
    });
  });

  describe('failed save - slow applied', () => {
    function setupFailedSave(existingConditions = [], existingEffects = []) {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(saveDc);
      getRuntimeValue.mockImplementation((_entity, keyOrProp, _camp) => {
        if (keyOrProp === 'activeConditions') return existingConditions;
        if (keyOrProp === 'activeConditionMeta') return {};
        if (keyOrProp === 'targetEffects') return existingEffects;
        return null;
      });
      resolveSave(false, 'prompt-fail');
    }

    it('returns the full composed summary popup', async () => {
      setupFailedSave();
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Slow');
      expect(result.payload.description).toBe(
        'Slow affects 1 creature(s). Goblin is slowed. 0 creature(s) saved. ' +
        'Affected creatures have Speed halved, -2 AC penalty, disadvantage on ' +
        'DEX saves, no reactions, action or bonus action (not both), one attack ' +
        'max, and 25% somatic spell failure chance.'
      );
    });

    it('writes slow exactly once, preserving existing conditions (lowercase dedup)', async () => {
      setupFailedSave(['poisoned', 'Slow']);
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(setRuntimeValue).toHaveBeenCalledWith(
        targetName, 'activeConditions', ['poisoned', 'slow'], campaignName,
      );
    });

    it('registers condition expiration WITHOUT rounds — concentration-scoped, no rounds countdown (no-timers policy)', async () => {
      setupFailedSave();
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(addExpiration).toHaveBeenCalledWith({
        attackerName: casterName,
        targetName,
        effects: [{ type: 'condition', condition: 'slow' }],
        campaignName,
      });
    });

    it('posts condition-applied and failed save_result logs with full compositions', async () => {
      setupFailedSave();
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'condition', action: 'applied', characterName: targetName,
          condition: 'Slow', reason: 'Slow spell',
        }),
      );
      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'save_result', rollType: 'save-slow',
          characterName: casterName, targetName,
          saveDc, saveType: 'WIS', success: false,
          description: 'Goblin failed WIS save against Slow. Speed halved, -2 AC, disadvantage on DEX saves, no reactions, action/bonus action (not both), one attack max, and 25% somatic spell failure chance.',
        }),
      );
    });

    it('rewrites targetEffects: strips same-source slow keys (incl. ac_penalty), keeps foreign rows, appends exactly five fresh tes', async () => {
      setupFailedSave([], [
        { target: 'Other', effect: 'no_reactions', source: 'OtherCaster' },
        { target: targetName, effect: 'ac_penalty', source: casterName },
        { target: targetName, effect: 'no_reactions', source: 'SomeOtherCaster' },
      ]);
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      const teWrites = setRuntimeValue.mock.calls.filter(c => c[1] === 'targetEffects');
      expect(teWrites).toHaveLength(1);
      // Triple-scoped filter (target+source+SLOW_TE_EFFECTS key): the
      // caster's own ac_penalty te is stripped even though the handler no
      // longer writes it (SP-109: the CONDITION carries -2 AC — te would
      // double-count); foreign rows survive byte-identical; five fresh
      // condition-linked tes appended in source order.
      expect(teWrites[0][2]).toEqual([
        { target: 'Other', effect: 'no_reactions', source: 'OtherCaster' },
        { target: targetName, effect: 'no_reactions', source: 'SomeOtherCaster' },
        ...ownSlowTes(targetName),
      ]);
    });
  });

  describe('failed save - runtime store coercion guards', () => {
    function setupFailingWithStores(activeConditions, targetEffects) {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(saveDc);
      getRuntimeValue.mockImplementation((_entity, keyOrProp, _camp) => {
        if (keyOrProp === 'activeConditions') return activeConditions;
        if (keyOrProp === 'activeConditionMeta') return null;
        if (keyOrProp === 'targetEffects') return targetEffects;
        return null;
      });
      resolveSave(false, 'prompt-coerce');
    }

    it('coerces null stores to arrays', async () => {
      setupFailingWithStores(null, null);
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(setRuntimeValue).toHaveBeenCalledWith(
        targetName, 'activeConditions', ['slow'], campaignName,
      );
      const teWrite = setRuntimeValue.mock.calls.find(c => c[1] === 'targetEffects');
      expect(teWrite[2]).toEqual(ownSlowTes(targetName));
    });

    it('coerces non-array stores to arrays', async () => {
      setupFailingWithStores('not-an-array', 'not-an-array');
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(setRuntimeValue).toHaveBeenCalledWith(
        targetName, 'activeConditions', ['slow'], campaignName,
      );
      const teWrite = setRuntimeValue.mock.calls.find(c => c[1] === 'targetEffects');
      expect(teWrite[2]).toEqual(ownSlowTes(targetName));
    });
  });

  describe('successful save - target resists', () => {
    function setupSuccessfulSave() {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(saveDc);
      resolveSave(true, 'prompt-success');
    }

    it('returns the saved popup and applies zero slow state', async () => {
      setupSuccessfulSave();
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.payload.description).toBe('No creatures affected by Slow. 1 creature(s) saved.');
      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        targetName, 'activeConditions', expect.anything(), campaignName,
      );
      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        'campaign', 'targetEffects', expect.anything(), campaignName,
      );
      expect(addExpiration).not.toHaveBeenCalled();
      expect(addConcentration).not.toHaveBeenCalled();
      expect(storage.set).not.toHaveBeenCalled();
    });

    it('logs the successful save_result against the real DC', async () => {
      setupSuccessfulSave();
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'save_result', rollType: 'save-slow',
          characterName: casterName, targetName,
          saveDc, saveType: 'WIS', success: true,
          description: 'Goblin succeeded on WIS save against Slow.',
        }),
      );
    });
  });

  describe('multiple targets', () => {
    const multiContext = {
      creatures: [
        { name: casterName, type: 'player', gridX: 5, gridY: 10 },
        { name: 'Goblin', type: 'npc' },
        { name: 'Orc', type: 'npc' },
      ],
      players: [{ name: casterName, gridX: 5, gridY: 10 }],
      placedItems: [],
    };

    it('reports mixed outcomes with exact counts in the summary', async () => {
      getCombatContext.mockResolvedValue(multiContext);
      buildSaveDc.mockReturnValue(saveDc);
      getRuntimeValue.mockReturnValue(null);
      let callCount = 0;
      createSaveListener.mockImplementation(() => {
        callCount++;
        return {
          promptId: `prompt-mixed-${callCount}`,
          promise: Promise.resolve({ success: callCount > 1 }),
        };
      });
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.payload.description).toBe(
        'Slow affects 1 creature(s). Goblin is slowed. 1 creature(s) saved. ' +
        'Affected creatures have Speed halved, -2 AC penalty, disadvantage on ' +
        'DEX saves, no reactions, action or bonus action (not both), one attack ' +
        'max, and 25% somatic spell failure chance.'
      );
    });

    it('joins every affected name when all fail', async () => {
      getCombatContext.mockResolvedValue(multiContext);
      buildSaveDc.mockReturnValue(saveDc);
      getRuntimeValue.mockReturnValue(null);
      resolveSave(false, 'prompt-all-fail');
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.payload.description).toBe(
        'Slow affects 2 creature(s). Goblin is slowed. Orc is slowed. ' +
        '0 creature(s) saved. Affected creatures have Speed halved, -2 AC penalty, ' +
        'disadvantage on DEX saves, no reactions, action or bonus action (not both), ' +
        'one attack max, and 25% somatic spell failure chance.'
      );
    });
  });

  describe('edge cases', () => {
    it('handles caster-only combat without prompting', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [{ name: casterName, gridX: 5, gridY: 10 }],
        players: [{ name: casterName, gridX: 5, gridY: 10 }],
        placedItems: [],
      });
      buildSaveDc.mockReturnValue(saveDc);
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(createSaveListener).not.toHaveBeenCalled();
      expect(result.payload.description).toBe('No creatures affected by Slow. 0 creature(s) saved.');
    });

    it('survives addEntry rejections on every log seam', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(saveDc);
      getRuntimeValue.mockReturnValue(null);
      addEntry.mockImplementation((_camp, entry) => {
        if (entry.type === 'condition' || entry.type === 'save_result') {
          return Promise.reject(new Error('log error'));
        }
        return Promise.resolve();
      });

      resolveSave(true, 'prompt-catch-success');
      await expect(
        handle(makeAction(), makePlayerStats(), campaignName, null),
      ).resolves.toBeDefined();

      resolveSave(false, 'prompt-catch-fail');
      await expect(
        handle(makeAction(), makePlayerStats(), campaignName, null),
      ).resolves.toBeDefined();
      expect(addEntry).toHaveBeenCalled();
    });
  });

  describe('SP-109: real save DC, ac_penalty te, concentration persistence', () => {
    function setupFailedSaveWithDc(dc) {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(dc);
      getCombatSummary.mockReturnValue({
        creatures: [
          { name: casterName, type: 'player' },
          { name: targetName, type: 'npc' },
        ],
      });
      getRuntimeValue.mockImplementation((_entity, keyOrProp) => {
        if (keyOrProp === 'activeConditions') return [];
        if (keyOrProp === 'activeConditionMeta') return {};
        if (keyOrProp === 'targetEffects') return [];
        return null;
      });
      resolveSave(false, 'prompt-sp109');
    }

    it('stamps the forwarded real DC into the prompt and activeConditionMeta', async () => {
      setupFailedSaveWithDc(17);
      await handle(makeAction({ saveDc: 17 }), makePlayerStats(), campaignName, null);
      const [, listenerCfg] = createSaveListener.mock.calls[0];
      expect(listenerCfg.saveDc).toBe(17);
      expect(setRuntimeValue).toHaveBeenCalledWith(
        targetName, 'activeConditionMeta',
        expect.objectContaining({ slow: expect.objectContaining({ dc: 17, ability: 'wis' }) }),
        campaignName,
      );
    });

    it('persists caster concentration with the real DC and stores combatSummary', async () => {
      setupFailedSaveWithDc(17);
      await handle(makeAction({ saveDc: 17 }), makePlayerStats(), campaignName, null);
      expect(addConcentration).toHaveBeenCalledWith(
        expect.objectContaining({ creatures: expect.any(Array) }),
        casterName, 'Slow', 17,
      );
      expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.objectContaining({ creatures: expect.any(Array) }), campaignName);
    });

    it('does not overwrite an existing concentration record for the same spell', async () => {
      setupFailedSaveWithDc(17);
      getCombatSummary.mockReturnValue({
        creatures: [
          { name: casterName, type: 'player', concentration: { spell: 'Slow', dc: 17 } },
          { name: targetName, type: 'npc' },
        ],
      });
      await handle(makeAction({ saveDc: 17 }), makePlayerStats(), campaignName, null);
      expect(addConcentration).not.toHaveBeenCalled();
      expect(storage.set).not.toHaveBeenCalled();
      // The slow condition itself still lands — only the concentration write is skipped.
      expect(setRuntimeValue).toHaveBeenCalledWith(
        targetName, 'activeConditions', ['slow'], campaignName,
      );
    });
  });
});
