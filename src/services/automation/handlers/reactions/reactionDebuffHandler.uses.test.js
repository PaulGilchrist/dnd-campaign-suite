// @maintained-by-ai
// reactionDebuffHandler octet #8 (uses) — lane: USES/BUDGET ACCOUNTING on the
// DEFAULT (bardic) route: resolveUsesBudget → currentUsesFor → buildBardicStampPatch
// spend keys (automation/index.js:338 `reaction_debuff` → handle →
// DEFAULT_EFFECT_ROUTE; live from classes.json Cutting Words, feats.json,
// rules-fightingStyles.js). Full octet seam map in .attacksVsAlly.test.js header.
//
// THIS lane owns:
//  - the uses_expression → usesMax channels: numeric pass-through vs
//    evaluateAutoExpression(expr, playerStats) string eval — complementary to
//    .earlyExits.test.js (uses-exhausted refusal copy + rechargeLabel for the
//    same budget) and .cuttingWords.test.js:290 (bardicUsesMax budget early exit);
//  - effectiveUsesKey selection: 'bardicInspirationUses' when no uses_expression
//    but tracked bardic max > 0, else lowercase feature-name '<feature>Uses'
//    ('cuttingwordsUses' here; blesseddefenderUses / wardingflareUses are
//    pinned by the attacksVsAlly / wardingFlare lanes);
//  - currentUsesFor ?? fallback: undefined AND null stored values fall back to
//    the budget max (0 never does — that refuses at the front door, earlyExits);
//  - SINGLE-CHANNEL spend on this route. NOTE (correcting the .earlyExits lane's
//    cosmetic header note): what this lane pins is NOT the spendUse channel.
//    handleBardicRoll bakes latch + marker + uses into one stampPatch via
//    setRuntimeObject and returns { preSpent: true }, so handle()'s post-route
//    spendUse (setRuntimeValue) NEVER runs on the default route — true post-route
//    spendUse is owned on the attacksVsAlly and wardingFlare lanes. Every kept
//    test below therefore pins setRuntimeValue NOT called (zero double-spend).
//  - zero-budget contract: no uses_expression and no tracked max ⇒ the route
//    still stamps latch + marker but writes NO uses key at all (free reaction).
//
// NOT this lane: latch/marker key semantics + skipSync bake wording
// (.cuttingWords.latch.test.js), default-route ability_use tail
// (.cuttingWords.test.js:310), exhaustion refusal + rechargeLabel
// (.earlyExits.test.js), route-internal gates (attacksVsAlly / wardingFlare /
// defaultPath / branchesOfTheTree).
//
// Deterministic: runtime store, logs, ranges, rollback, healing, expression
// eval and infoPopup are fully mocked; the bardic/second d20 now roll through
// the mocked canonical diceRoller lane (fix#169 recipe) with a seeded default
// face, so popup numerals are exact by construction. Pure budget arithmetic —
// no churn expected when the app changes.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './reactionDebuffHandler.js';

vi.mock('../../common/targetResolver.js', () => ({
  resolveTarget: vi.fn(),
  resolveMapPositions: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
  setRuntimeObject: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
  rangeToFeet: vi.fn(),
  getDistanceFeet: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../rules/combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
  findLastAttack: vi.fn().mockResolvedValue({
    attackEvent: null,
    attackerName: null,
    targetName: null,
    primaryDamage: 0,
    secondaryDamage: 0,
    totalDamage: 0,
    damageTypes: [],
  }),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
  evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../common/infoPopup.js', () => ({
  infoPopup: vi.fn().mockImplementation((name, description, automation, extraProps) => {
    const result = {
      type: 'popup',
      payload: {
        type: 'automation_info',
        name,
        description,
        automation,
      },
    };
    if (extraProps) {
      Object.assign(result, extraProps);
    }
    return result;
  }),
}));

// Canonical dice lane mock (fix#169 recipe): BI/second-d20 dice arrive via
// diceRoller, never raw Math.random.
vi.mock('../../../dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
  rollDie: vi.fn(),
}));

import * as targetResolver from '../../common/targetResolver.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as damageRollback from '../../common/damageRollback.js';
import * as automationService from '../../../combat/automation/automationService.js';
import * as diceRoller from '../../../dice/diceRoller.js';

const campaignName = 'TestCampaign';
const mapName = 'DungeonMap';

function makePlayerStats(overrides = {}) {
  return {
    name: 'Bard',
    proficiency: 2,
    level: 3,
    class: {
      name: 'Bard',
      class_levels: [
        { level: 1, bardic_die: 6 },
        { level: 2, bardic_die: 6 },
        { level: 3, bardic_die: 8 },
      ],
    },
    abilities: [
      { name: 'Wisdom', bonus: 2 },
      { name: 'Charisma', bonus: 4 },
    ],
    characterAdvancement: [],
    _trackedResources: {
      bardicInspirationUses: { current: 4, max: 4 },
    },
    ...overrides,
  };
}

function freshAttackEvent(options = {}) {
  return {
    d20: 15,
    bonus: 5,
    targetName: 'Goblin',
    targetAc: 14,
    effectiveAc: null,
    hit: true,
    timestamp: Date.now(),
    ...options,
  };
}

// Reaches the DEFAULT_EFFECT_ROUTE with an in-range, fresh Goblin attack.
// MERGE-style overrides (never replace the automation object wholesale).
function setupDefaultPath({
  usesExpression,
  evaluateAutoExpressionReturn,
  getRuntimeValueReturn,
} = {}) {
  const action = {
    name: 'Cutting Words',
    automation: {
      type: 'reaction_debuff',
      range: '60_ft',
      effect: '',
      uses_expression: null,
      recharge: 'long_rest',
    },
  };
  if (usesExpression !== undefined) {
    action.automation.uses_expression = usesExpression;
  }

  automationService.evaluateAutoExpression.mockReturnValue(
    evaluateAutoExpressionReturn !== undefined ? evaluateAutoExpressionReturn : 1
  );
  useRuntimeState.getRuntimeValue.mockImplementation(
    typeof getRuntimeValueReturn === 'function'
      ? getRuntimeValueReturn
      : () => (getRuntimeValueReturn !== undefined ? getRuntimeValueReturn : undefined)
  );

  targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
  targetResolver.resolveMapPositions.mockResolvedValue(null);
  damageUtils.getCombatContext.mockResolvedValue({ round: 1, creatures: [] });
  damageRollback.findLastAttack.mockResolvedValue({
    attackEvent: freshAttackEvent(),
    attackerName: 'Goblin',
    targetName: 'Goblin',
    primaryDamage: 0,
    secondaryDamage: 0,
    totalDamage: 0,
    damageTypes: [],
  });

  return action;
}

// The store-only bake write (skipSync=true), ahead of the awaited flush.
function bakedPatch() {
  const call = useRuntimeState.setRuntimeObject.mock.calls.find(c => c[3] === true);
  expect(call, 'bake (skipSync=true) setRuntimeObject write').toBeTruthy();
  return call[1];
}

describe('reactionDebuffHandler — uses/budget accounting (default route)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Seed pin (fix#169 idiom): seeded faces for the now-mocked dice seams —
    // budget arithmetic stays the assertion focus, popup numerals are exact.
    diceRoller.rollDie.mockReturnValue(4);
    diceRoller.rollD20.mockReturnValue(10);
  });

  describe('uses decrement via the preSpent stampPatch', () => {
    const DECREMENT_CASES = [
      {
        title: 'string uses_expression evaluates the max; unset current falls back to it (2→1)',
        usesExpression: 'proficiency_bonus',
        evaluateAutoExpressionReturn: 2,
        getRuntimeValueReturn: undefined,
        expected: 1,
      },
      {
        title: 'numeric uses_expression with a stored current decrements from current (2→1)',
        usesExpression: 3,
        getRuntimeValueReturn: 2,
        expected: 1,
      },
      {
        title: 'stored null current falls back to the max, not to zero (3→2)',
        usesExpression: 3,
        getRuntimeValueReturn: null,
        expected: 2,
      },
    ];

    it.each(DECREMENT_CASES)('%title', async ({ usesExpression, evaluateAutoExpressionReturn, getRuntimeValueReturn, expected }) => {
      const playerStats = makePlayerStats();
      const action = setupDefaultPath({ usesExpression, evaluateAutoExpressionReturn, getRuntimeValueReturn });

      const result = await handle(action, playerStats, campaignName, mapName);

      expect(result.type).toBe('popup');
      // spend baked into the stampPatch under the feature-derived key...
      expect(bakedPatch()).toEqual(expect.objectContaining({ cuttingwordsUses: expected }));
      // ...and re-flashed byte-identical after dispatch (single economy value across both writes)
      expect(useRuntimeState.setRuntimeObject).toHaveBeenCalledTimes(2);
      const flush = useRuntimeState.setRuntimeObject.mock.calls.find(c => c[3] === undefined);
      expect(flush[1]).toEqual(expect.objectContaining({ cuttingwordsUses: expected }));
      // preSpent route: the post-route spendUse channel never fires (no double-spend)
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('evaluates string uses_expression against the live playerStats', async () => {
      const playerStats = makePlayerStats();
      const action = setupDefaultPath({
        usesExpression: 'proficiency_bonus',
        evaluateAutoExpressionReturn: 2,
      });

      await handle(action, playerStats, campaignName, mapName);

      expect(automationService.evaluateAutoExpression).toHaveBeenCalledWith('proficiency_bonus', playerStats);
    });

    it('spends the last use exactly to zero and still resolves the debuff', async () => {
      // current 1 passes the front-door exhaustion gate (>0) and stamps 0.
      const action = setupDefaultPath({
        usesExpression: 2,
        getRuntimeValueReturn: (charKey, key) => (key === 'cuttingwordsUses' ? 1 : undefined),
      });

      const result = await handle(action, makePlayerStats(), campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Bardic Inspiration die');
      expect(bakedPatch()).toEqual(expect.objectContaining({ cuttingwordsUses: 0 }));
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('effectiveUsesKey selection (resolveUsesBudget)', () => {
    it('spends bardicInspirationUses, not the feature-derived key, when no uses_expression is set', async () => {
      const action = setupDefaultPath({});

      const result = await handle(action, makePlayerStats(), campaignName, mapName);

      expect(result.type).toBe('popup');
      // tracked max 4, unset runtime current → 4−1=3, under the BARDIC key
      const patch = bakedPatch();
      expect(patch).toEqual(expect.objectContaining({ bardicInspirationUses: 3 }));
      expect(patch).not.toHaveProperty('cuttingwordsUses');
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('prefers the uses_expression budget over the tracked bardic fallback', async () => {
      // tracked bardic max 4 is present but must be shadowed by uses_expression 2.
      const action = setupDefaultPath({ usesExpression: 2 });

      const result = await handle(action, makePlayerStats(), campaignName, mapName);

      expect(result.type).toBe('popup');
      // exact bake shape: latch + marker + the uses key, no bardic spend
      expect(bakedPatch()).toEqual({
        _Cutting_Words_usedRound: expect.any(Number),
        _Cutting_Words_appliedAttack: expect.any(String),
        cuttingwordsUses: 1,
      });
      expect(useRuntimeState.setRuntimeObject).toHaveBeenCalledTimes(2);
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('writes no uses key at all when there is no budget (no expression, no tracked max)', async () => {
      const action = setupDefaultPath({});
      const playerStats = makePlayerStats({ _trackedResources: {} });

      const result = await handle(action, playerStats, campaignName, mapName);

      // reaction still runs — it is just free
      expect(result.type).toBe('popup');
      expect(bakedPatch()).toEqual({
        _Cutting_Words_usedRound: expect.any(Number),
        _Cutting_Words_appliedAttack: expect.any(String),
      });
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });
  });
});
