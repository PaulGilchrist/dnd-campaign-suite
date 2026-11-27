// @maintained-by-ai 2026-11-27 — cast-lane handle() ownership: gate refusals,
// zone-placement commits, per-creature save-driven effect application, and the
// ordered commit/read censuses. Siblings own the adjacent lanes:
// stinkingCloudHandler.areaSave.test.js (turn-start sweep + turn-end shed),
// stinkingCloudHandler.cast-immunity.test.js (cast-time immunity gate),
// stinkingCloudHandler.results-payload.test.js (results records + envelope).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn(),
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

import { handle } from './stinkingCloudHandler.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import storage from '../../../ui/storage.js';

const campaignName = 'test-campaign';
// Frozen wall clock: Date.now() here is write-metadata only (log/tracking
// timestamps), never a game timer — freezing pins the honest full bytes.
const FROZEN_NOW = 1700000000000;

function makePlayerStats(overrides = {}) {
  return { name: 'TestWizard', level: 10, ...overrides };
}

function makeAction(automation = {}, metaCtx = {}, spell) {
  return {
    name: 'Stinking Cloud',
    ...(spell ? { spell } : {}),
    automation: { type: 'stinking_cloud', ...automation },
    metaCtx,
  };
}

const singleTargetCombat = { creatures: [{ name: 'EnemyGoblin' }] };
const multiTargetCombat = { creatures: [{ name: 'EnemyGoblin' }, { name: 'EnemyOrc' }] };

// ── Expected commit rows (this lane's own bytes, pinned exactly) ──────────
const zoneExpiration = (rounds) => ({
  attackerName: 'TestWizard',
  targetName: 'TestWizard',
  effects: [
    { type: 'clear_runtime_value', creatureName: 'TestWizard', key: '_stinkingCloud_TestWizard' },
    { type: 'remove_target_effect', effectKey: 'stinking_cloud', source: 'TestWizard' },
    { type: 'remove_target_effect', effectKey: 'no_action_and_bonus_action', source: 'TestWizard' },
  ],
  campaignName,
  rounds,
});

const concentrationExpiration = {
  attackerName: 'TestWizard',
  targetName: 'EnemyGoblin',
  effects: [{ type: 'condition', condition: 'poisoned' }],
  campaignName,
};

const stinkingTe = {
  target: 'EnemyGoblin',
  effect: 'stinking_cloud',
  source: 'TestWizard',
  conditions: ['poisoned'],
  dc: 13,
  duration: 'concentration',
};

const blockTe = {
  target: 'EnemyGoblin',
  effect: 'no_action_and_bonus_action',
  source: 'TestWizard',
  duration: 'until_end_of_current_turn',
  reason: "Poisoned by Stinking Cloud (can't take an Action or Bonus Action)",
};

// Full spell-save stamp storeSpellLastAttack commits before the target loop
// (real damageRollback through the mocked store) — the rollback consumer's
// contract, pinned here so the cast's commit census stays honest.
const lastAttackStamp = {
  attackerName: 'TestWizard',
  attackName: 'Stinking Cloud',
  rollType: 'spell-save',
  spellSchool: null,
  saveType: 'CON',
  saveDc: 13,
  attackScope: 'aoe',
  damageFormula: null,
  damageType: null,
  damageOnSuccess: 0,
  damageOnFailure: 0,
  targetResults: [],
  affectedTargets: [],
  statusEffects: [],
  rawDamage: 0,
  primaryDamage: 0,
  actualDamage: 0,
  damageApplied: false,
  timestamp: FROZEN_NOW,
};

const castAbilityUse = (target, promptId) => [campaignName, {
  type: 'ability_use',
  characterName: 'TestWizard',
  abilityName: 'Stinking Cloud',
  description: `TestWizard casts Stinking Cloud! ${target} must make a CON save (DC 13) or become Poisoned.`,
  promptId,
}];

const conditionApplied = (target) => [campaignName, {
  type: 'condition',
  action: 'applied',
  characterName: target,
  condition: 'Poisoned',
  reason: 'Stinking Cloud spell',
  note: `${target} is Poisoned by Stinking Cloud. While Poisoned, the creature can't take an Action or Bonus Action.`,
  timestamp: FROZEN_NOW,
}];

const saveResultLog = (target, success) => [campaignName, {
  type: 'save_result',
  characterName: 'TestWizard',
  rollType: 'save-stinking-cloud',
  targetName: target,
  saveDc: 13,
  saveType: 'CON',
  success,
  description: success
    ? `${target} succeeded on CON save against Stinking Cloud.`
    : `${target} failed CON save against Stinking Cloud and is Poisoned.`,
}];

const savePrompt = (target, disadvantage = false) => [campaignName, {
  targetName: target,
  saveType: 'CON',
  saveDc: 13,
  dcSuccess: 'none',
  disadvantage,
}];

const writesFor = (key, field) =>
  setRuntimeValue.mock.calls.filter((call) => call[0] === key && call[1] === field);

const POISONED_SUMMARY_TAIL =
  " Affected creatures are Poisoned (can't take Actions or Bonus Actions) until the end of their current turn.";

describe('stinkingCloudHandler cast lane (handle)', () => {
  let promptSeq;

  beforeEach(() => {
    // resetAllMocks drops EVERY prior implementation (clearAllMocks leaks
    // getRuntimeValue.mockImplementation across tests); ALL defaults are
    // re-installed here.
    vi.resetAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(FROZEN_NOW);
    buildSaveDc.mockReturnValue(13);
    getCombatContext.mockResolvedValue(singleTargetCombat);
    getCombatSummary.mockReturnValue(null);
    addEntry.mockResolvedValue(undefined);
    getRuntimeValue.mockReturnValue(undefined);
    promptSeq = 0;
    // Distinct promptId per arming (constant-promptId stray-drain detector).
    createSaveListener.mockImplementation(() => ({
      promptId: `prompt-${++promptSeq}`,
      promise: Promise.resolve({ success: true }),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('cast-gate refusals', () => {
    it.each([
      ['missing combat context', null, makeAction(), 'No creatures in combat. Stinking Cloud has no effect.'],
      ['empty combat roster', { creatures: [] }, makeAction(), 'No creatures in combat. Stinking Cloud has no effect.'],
      ['empty target selection', multiTargetCombat, makeAction({}, { targets: [] }), 'No creatures selected for Stinking Cloud.'],
    ])('%s: plain automation_info refusal with a full zero-spend census', async (_label, combat, action, description) => {
      getCombatContext.mockResolvedValue(combat);

      const result = await handle(action, makePlayerStats(), campaignName, null);

      // REAL spellNoticePopup bytes (areaSpellUtils, unmocked).
      expect(result).toEqual({
        type: 'popup',
        payload: { type: 'automation_info', name: 'Stinking Cloud', description },
      });
      // Gate-order: refusals return BEFORE storeSpellLastAttack / zone commit.
      expect(createSaveListener.mock.calls).toEqual([]);
      expect(setRuntimeValue.mock.calls).toEqual([]);
      expect(addExpiration.mock.calls).toEqual([]);
      expect(addConcentration.mock.calls).toEqual([]);
      expect(addEntry.mock.calls).toEqual([]);
    });
  });

  describe('target selection', () => {
    it('arms one CON save per creature, in roster order, when metaCtx selects nothing', async () => {
      getCombatContext.mockResolvedValue(multiTargetCombat);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(createSaveListener.mock.calls).toEqual([
        savePrompt('EnemyGoblin'),
        savePrompt('EnemyOrc'),
      ]);
    });

    it('arms saves ONLY for the metaCtx-selected subset, with the exact CON config', async () => {
      getCombatContext.mockResolvedValue(multiTargetCombat);

      await handle(makeAction({}, { targets: ['EnemyGoblin'] }), makePlayerStats(), campaignName, null);

      expect(createSaveListener.mock.calls).toEqual([savePrompt('EnemyGoblin')]);
    });
  });

  describe('commit censuses', () => {
    it('successful saves: zone + lastAttack commits, concentration registration, ordered logs, zero effect writes, full results popup', async () => {
      const combatSummary = { creatures: [{ name: 'TestWizard' }] };
      getCombatSummary.mockReturnValue(combatSummary);
      createSaveListener.mockReturnValue({
        promptId: 'goblin-prompt',
        promise: Promise.resolve({ success: true }),
      });

      const result = await handle(makeAction(), makePlayerStats({ spellAbilities: { saveDc: 13 } }), campaignName, 'test-map');

      // Zone-placement commit: the _stinkingCloud_<caster> tracking store the
      // turn-start sweep (areaSave lane) reads at every turn start.
      expect(writesFor('TestWizard', '_stinkingCloud_TestWizard')).toEqual([[
        'TestWizard',
        '_stinkingCloud_TestWizard',
        {
          caster: 'TestWizard',
          mapName: 'test-map',
          campaignName,
          saveDc: 13,
          saveType: 'CON',
          radius: 20,
          timestamp: FROZEN_NOW,
          duration: 'Concentration, up to 1 minute',
        },
        campaignName,
      ]]);
      expect(writesFor('campaign', 'lastAttack')).toEqual([[
        'campaign', 'lastAttack', lastAttackStamp, campaignName,
      ]]);
      // Positive save leg: nothing applied to the target.
      expect(writesFor('EnemyGoblin', 'activeConditions')).toEqual([]);
      expect(writesFor('EnemyGoblin', 'activeConditionMeta')).toEqual([]);
      expect(writesFor('campaign', 'targetEffects')).toEqual([]);
      // Success path arms ONLY the zone expiration (round counter, never a
      // wall-clock timer — CLA-334 1 minute → 10 rounds).
      expect(addExpiration.mock.calls).toEqual([[zoneExpiration(10)]]);
      // registerSpellConcentration real chain (areaSpellUtils is unmocked).
      expect(getCombatSummary).toHaveBeenCalledWith(campaignName);
      expect(addConcentration.mock.calls).toEqual([[combatSummary, 'TestWizard', 'Stinking Cloud', 13]]);
      expect(storage.set.mock.calls).toEqual([['combatSummary', combatSummary, campaignName]]);
      expect(addEntry.mock.calls).toEqual([
        castAbilityUse('EnemyGoblin', 'goblin-prompt'),
        saveResultLog('EnemyGoblin', true),
      ]);
      expect(getRuntimeValue.mock.calls).toEqual([
        ['campaign', 'lastAttack', campaignName],
      ]);
      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'aoe_condition_results',
          name: 'Stinking Cloud',
          // Full-string own-composition pin — empty immune slot leaves a trailing space.
          description: 'No creatures affected by Stinking Cloud. 1 creature(s) saved. ',
          conditionLabel: 'Poisoned',
          saveDc: 13,
          results: [{ targetName: 'EnemyGoblin', success: true, roll: 0, total: 0, saveBonus: 0, conditionApplied: false }],
        },
      });
    });

    it('failed save: ordered condition/meta/te commits, both expirations, three logs, real 5-arg skipSync block-te write', async () => {
      getRuntimeValue.mockImplementation((key, field) => {
        if (key === 'campaign' && field === 'targetEffects') return [];
        return undefined;
      });
      createSaveListener.mockReturnValue({
        promptId: 'goblin-prompt',
        promise: Promise.resolve({ success: false }),
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, 'test-map');

      expect(writesFor('EnemyGoblin', 'activeConditions')).toEqual([[
        'EnemyGoblin', 'activeConditions', ['poisoned'], campaignName,
      ]]);
      expect(writesFor('EnemyGoblin', 'activeConditionMeta')).toEqual([[
        'EnemyGoblin', 'activeConditionMeta', { poisoned: { dc: 13, ability: 'con' } }, campaignName,
      ]]);
      // Exactly two te commits: this lane's 4-arg stinking_cloud marker write
      // then the REAL registerTargetEffect write (targetEffectDefinitions.js,
      // skipSync=true — SSE-echo safe, shed by applyStinkingCloudTurnEnd).
      // The 5-arg pin distinguishes it from the 4-arg marker write.
      expect(writesFor('campaign', 'targetEffects')).toEqual([
        ['campaign', 'targetEffects', [stinkingTe], campaignName],
        ['campaign', 'targetEffects', [blockTe], campaignName, true],
      ]);
      // Zone expiry commits first (pre-loop), then the poisoned/concentration
      // expiry for the failing creature.
      expect(addExpiration.mock.calls).toEqual([[zoneExpiration(10)], [concentrationExpiration]]);
      expect(addEntry.mock.calls).toEqual([
        castAbilityUse('EnemyGoblin', 'goblin-prompt'),
        conditionApplied('EnemyGoblin'),
        saveResultLog('EnemyGoblin', false),
      ]);
      // Ordered read census with EXACT source arity: the lane's own te read
      // is 2-arg (stinkingCloudHandler.js:513; getRuntimeValue's signature is
      // 2-param, extra campaignName args elsewhere are silently ignored).
      expect(getRuntimeValue.mock.calls).toEqual([
        ['EnemyGoblin', 'activeConditions', campaignName],
        ['EnemyGoblin', 'activeConditionMeta', campaignName],
        ['campaign', 'lastAttack', campaignName],
        ['campaign', 'targetEffects'],
        ['campaign', 'targetEffects', campaignName],
      ]);
      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'aoe_condition_results',
          name: 'Stinking Cloud',
          // Full-string own-composition pin: the empty immune slot renders as
          // the double space before "Affected".
          description: `Stinking Cloud affects 1 creature(s). EnemyGoblin is Poisoned. 0 creature(s) saved. ${POISONED_SUMMARY_TAIL}`,
          conditionLabel: 'Poisoned',
          saveDc: 13,
          results: [{ targetName: 'EnemyGoblin', success: false, roll: 0, total: 0, saveBonus: 0, conditionApplied: true }],
        },
      });
    });

    it('re-poisoning a target rewrites activeConditions poisoned-last without duplicating it', async () => {
      getRuntimeValue.mockImplementation((key, field) => {
        if (field === 'activeConditions') return ['poisoned', 'stunned'];
        return undefined;
      });
      createSaveListener.mockReturnValue({
        promptId: 'goblin-prompt',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(writesFor('EnemyGoblin', 'activeConditions')).toEqual([[
        'EnemyGoblin', 'activeConditions', ['stunned', 'poisoned'], campaignName,
      ]]);
    });

    it('a re-cast on a clouded target REPLACES its stinking_cloud te row instead of pushing a duplicate', async () => {
      getRuntimeValue.mockImplementation((key, field) => {
        if (key === 'campaign' && field === 'targetEffects') {
          return [{ target: 'EnemyGoblin', effect: 'stinking_cloud', source: 'OldCaster', dc: 10 }];
        }
        return undefined;
      });
      createSaveListener.mockReturnValue({
        promptId: 'goblin-prompt',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      // The lane's own 4-arg marker write: exactly one row, OldCaster gone.
      const markerWrite = writesFor('campaign', 'targetEffects')[0];
      expect(markerWrite).toEqual(['campaign', 'targetEffects', [stinkingTe], campaignName]);
    });
  });

  describe('zone duration policy (rounds only, never a countdown)', () => {
    it.each([
      ['2_minutes', 20],
      ['3_rounds', 3],
    ])('encodes automation.duration %s as the zone expiry rounds:%i', async (duration, rounds) => {
      await handle(makeAction({ duration }), makePlayerStats(), campaignName, null);

      expect(addExpiration.mock.calls).toEqual([[zoneExpiration(rounds)]]);
    });

    it('falls back to action.spell.duration when automation omits one', async () => {
      await handle(makeAction({}, {}, { duration: '4_minutes' }), makePlayerStats(), campaignName, null);

      expect(addExpiration.mock.calls).toEqual([[zoneExpiration(40)]]);
    });

    it('an unmatched duration string arms no zone expiration', async () => {
      await handle(makeAction({ duration: 'until dispelled' }), makePlayerStats(), campaignName, null);

      expect(addExpiration.mock.calls).toEqual([]);
    });
  });

  describe('multi-target adjudication', () => {
    it('heightened target saves with disadvantage and fails while the plain target saves clean (per-target pairing)', async () => {
      getCombatContext.mockResolvedValue(multiTargetCombat);
      createSaveListener.mockImplementation((campaign, opts) => ({
        promptId: `prompt-${++promptSeq}`,
        promise: Promise.resolve({ success: opts.targetName === 'EnemyOrc' }),
      }));

      const result = await handle(
        makeAction({}, { heightenTarget: 'EnemyGoblin' }),
        makePlayerStats(),
        campaignName,
        null
      );

      // Both legs of the heightenTarget ternary, in arming order.
      expect(createSaveListener.mock.calls).toEqual([
        savePrompt('EnemyGoblin', true),
        savePrompt('EnemyOrc'),
      ]);
      // Only the failing goblin receives writes — and its rows carry its OWN
      // prompt pairing (no cross-target drain).
      expect(writesFor('EnemyGoblin', 'activeConditions')).toEqual([[
        'EnemyGoblin', 'activeConditions', ['poisoned'], campaignName,
      ]]);
      expect(writesFor('EnemyOrc', 'activeConditions')).toEqual([]);
      expect(writesFor('campaign', 'targetEffects')).toEqual([
        ['campaign', 'targetEffects', [stinkingTe], campaignName],
        ['campaign', 'targetEffects', [blockTe], campaignName, true],
      ]);
      expect(addExpiration.mock.calls).toEqual([[zoneExpiration(10)], [concentrationExpiration]]);
      expect(addEntry.mock.calls).toEqual([
        castAbilityUse('EnemyGoblin', 'prompt-1'),
        conditionApplied('EnemyGoblin'),
        saveResultLog('EnemyGoblin', false),
        castAbilityUse('EnemyOrc', 'prompt-2'),
        saveResultLog('EnemyOrc', true),
      ]);
      expect(result.payload.description).toBe(
        `Stinking Cloud affects 1 creature(s). EnemyGoblin is Poisoned. 1 creature(s) saved. ${POISONED_SUMMARY_TAIL}`
      );
    });
  });

  describe('resilience', () => {
    it('rejected log writes never abort the cast: effects commit and each catch logs', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      addEntry.mockRejectedValue(new Error('log down'));
      createSaveListener.mockReturnValue({
        promptId: 'goblin-prompt',
        promise: Promise.resolve({ success: false }),
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(writesFor('EnemyGoblin', 'activeConditions')).toEqual([[
        'EnemyGoblin', 'activeConditions', ['poisoned'], campaignName,
      ]]);
      expect(result.payload.description).toContain('EnemyGoblin is Poisoned');
      // Three log rows armed for the failed save, each .catch logs once.
      expect(spy).toHaveBeenCalledTimes(3);
      expect(spy).toHaveBeenCalledWith('[stinkingCloud] Error:', expect.any(Error));
    });
  });
});
