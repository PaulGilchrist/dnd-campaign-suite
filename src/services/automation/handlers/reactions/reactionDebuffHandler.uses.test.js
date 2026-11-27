// @maintained-by-ai 2026-11-27 — uses/budget-accounting lane over reactionDebuffHandler.js
// (default/bardic route: resolveUsesBudget → currentUsesFor → buildBardicStampPatch
// spend keys; automation/index.js:338 `reaction_debuff` → handle →
// DEFAULT_EFFECT_ROUTE; live from classes.json Cutting Words, feats.json,
// rules-fightingStyles.js). Family nine-lane seam map in .attacksVsAlly.test.js header.
//
// THIS lane owns:
//  - the uses_expression → usesMax channels: numeric pass-through vs
//    evaluateAutoExpression(string, playerStats) (the arg pin and the numeric
//    no-eval pin are CANONICAL in .earlyExits.test.js:271-275 — not restated);
//  - the currentUsesFor `?? max` fallback legs: stored undefined AND stored
//    null current both revert to the budget max (0 never does — that refuses
//    at the front door, earlyExits);
//  - effectiveUsesKey selection: 'bardicInspirationUses' when no
//    uses_expression but tracked bardic max > 0, else the feature-derived
//    '<feature>Uses' key. The exact-array bake toEqual below doubles as the
//    ABSENCE negative (no stray cuttingWordsUses on the bardic leg; no
//    bardicInspirationUses when uses_expression shadows the tracked budget) —
//    .cuttingWords.latch.test.js's superset stamp uses objectContaining and
//    cannot prove absence;
//  - the last-use boundary: stored 1 passes the >0 front-door gate and
//    stamps exactly 0;
//  - zero-budget contract: no uses_expression and no tracked max ⇒ the route
//    stamps latch + marker only, NO uses key at all (free reaction);
//  - SINGLE-channel spend on this route: handleBardicRoll bakes latch +
//    marker + uses into one stampPatch via setRuntimeObject and returns
//    { preSpent: true }, so handle()'s post-route spendUse NEVER runs here.
//    Every test pins the ordered exact-array two-write commit census
//    (skipSync=true store-only bake BEFORE dispatch, then awaited flush with
//    byte-identical economy keys + flushTs under the frozen clock) plus
//    setRuntimeValue.mock.calls === [] (zero double-spend). True post-route
//    spendUse (setRuntimeValue '<feature>Uses') is owned on the attacksVsAlly
//    and wardingFlare lanes.
//
// NOT this lane: exhaustion refusal copy + rechargeLabel + numeric no-eval
// gate (.earlyExits.test.js), no-combat-context refusal (CANONICAL there),
// latch/marker semantics + attack-identity fallback (.cuttingWords.latch),
// BI die-size + popup prose composition + null-heal defenderHp prose +
// generic ability_use tail row (.cuttingWords.test.js), route-internal gates
// (attacksVsAlly / wardingFlare / defaultPath / branchesOfTheTree).
//
// Deterministic: FROZEN Date.now in beforeEach + ALL lane defaults
// re-installed after resetAllMocks (bare vi.fn factories, no clearAllMocks
// residue); infoPopup is the REAL dependency-free builder (family-wide mirror-
// mock purge) so the popup envelope + automation echo stay honest — the
// description is pinned only as expect.any(String) because prose belongs to
// .cuttingWords.test.js. Runtime store reads route through a (charKey, key)
// router (never positional chains), the store-only heal seam gets a SYNC
// mockReturnValue (source calls it unawaited), and the BI/second d20 faces are
// seed-pinned through the mocked canonical diceRoller lane (fix#169). The rig
// is always an in-range still-hits attack-roll lane (resolveMapPositions
// resolves null ⇒ range skip; no heal tail), so budget arithmetic is the sole
// assertion focus. No churn expected.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './reactionDebuffHandler.js';

// ── Mocks BEFORE imports (bare vi.fn factories — every default is re-installed
//    in beforeEach, nothing here survives on factory-set impls) ──────────────

vi.mock('../../common/targetResolver.js', () => ({
  resolveTarget: vi.fn(),
  resolveMapPositions: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  setRuntimeObject: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
  rangeToFeet: vi.fn(),
  getDistanceFeet: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../rules/combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
  findLastAttack: vi.fn(),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
  evaluateAutoExpression: vi.fn(),
}));

// Canonical dice lane mock (fix#169 recipe): BI/second-d20 dice arrive via
// diceRoller, never raw Math.random.
vi.mock('../../../dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
  rollDie: vi.fn(),
}));

// infoPopup deliberately NOT mocked: it is a dependency-free pure builder, so
// the REAL one keeps every popup-envelope toEqual below honest about the
// actual production shape (mirror mock purged family-wide).

import * as targetResolver from '../../common/targetResolver.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as rangeCheck from '../../../rules/combat/rangeCheck.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as applyHealing from '../../../rules/combat/applyHealing.js';
import * as damageRollback from '../../common/damageRollback.js';
import * as automationService from '../../../combat/automation/automationService.js';
import * as diceRoller from '../../../dice/diceRoller.js';

const campaignName = 'TestCampaign';
const mapName = 'DungeonMap';
const playerName = 'Bard';

// FROZEN clock: bake round-stamp, attack identity and flushTs are exact.
const FROZEN_NOW = 1735689600000;

// Latch + attack-instance identity stamped on every successful default-route
// pass (key semantics owned by .cuttingWords.latch — reused here only as the
// census envelope around the uses key this lane owns).
const STAMP_BASE = {
  _Cutting_Words_usedRound: 1,
  _Cutting_Words_appliedAttack: String(FROZEN_NOW),
};

function makePlayerStats(overrides = {}) {
  return {
    name: playerName,
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
    abilities: [{ name: 'Charisma', bonus: 4 }],
    characterAdvancement: [],
    _trackedResources: {
      bardicInspirationUses: { current: 4, max: 4 },
    },
    ...overrides,
  };
}

// (charKey, key)-keyed router: 'Uses'-suffixed budget keys (cuttingWordsUses /
// bardicInspirationUses) return the stored current; latch + marker reads fall
// through to undefined so they never gate. NOT a positional chain — adding
// internal getRuntimeValue reads elsewhere cannot shift these values.
function routeRuntimeValue(storedUses) {
  useRuntimeState.getRuntimeValue.mockImplementation((charKey, key) =>
    key.endsWith('Uses') ? storedUses : undefined
  );
}

// Default ROUTE action (merge, never replace wholesale).
function setupDefaultPath({ usesExpression, evaluatedMax, storedUses } = {}) {
  automationService.evaluateAutoExpression.mockReturnValue(evaluatedMax);
  routeRuntimeValue(storedUses);
  return {
    name: 'Cutting Words',
    automation: {
      type: 'reaction_debuff',
      range: '60_ft',
      effect: '',
      uses_expression: usesExpression ?? null,
      recharge: 'long_rest',
    },
  };
}

// Ordered two-write commit census: store-only bake ahead of dispatch,
// awaited flush after it with byte-identical economy keys + flushTs.
function expectStampCensus(usesPatch) {
  const stamp = { ...STAMP_BASE, ...usesPatch };
  expect(useRuntimeState.setRuntimeObject.mock.calls).toEqual([
    [playerName, stamp, campaignName, true],
    [playerName, { ...stamp, _Cutting_Words_flushTs: FROZEN_NOW }, campaignName],
  ]);
  // preSpent route: the post-route spendUse channel never fires.
  expect(useRuntimeState.setRuntimeValue.mock.calls).toEqual([]);
}

describe('reactionDebuffHandler — uses/budget accounting (default route)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(FROZEN_NOW);

    // Lane defaults re-installed EVERY test (no impl residue between tests).
    routeRuntimeValue(undefined);
    useRuntimeState.setRuntimeValue.mockResolvedValue(undefined);
    useRuntimeState.setRuntimeObject.mockResolvedValue(undefined);
    logService.addEntry.mockResolvedValue({});
    damageUtils.getCombatContext.mockResolvedValue({ round: 1, creatures: [] });
    // SYNCHRONOUS source seam (reactionDebuffHandler.js:27 — no await): a
    // mockResolvedValue here would hand the code a Promise; this rig stays a
    // still-hits lane so the heal never fires, but the sync shape is honest.
    applyHealing.applyHealingToTarget.mockReturnValue({ newHp: null, actualHeal: 0 });
    targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
    targetResolver.resolveMapPositions.mockResolvedValue(null);
    rangeCheck.isWithinRange.mockResolvedValue(true);
    damageRollback.findLastAttack.mockResolvedValue({
      attackEvent: {
        d20: 15,
        bonus: 5,
        targetName: 'Goblin',
        targetAc: 14,
        effectiveAc: null,
        hit: true,
        timestamp: FROZEN_NOW,
      },
      attackerName: 'Goblin',
      targetName: 'Goblin',
      primaryDamage: 0,
      secondaryDamage: 0,
      totalDamage: 0,
      damageTypes: [],
    });
    // Seed pin (fix#169 idiom): BI d8 face 4 ⇒ reduced 15−4=11, 11+5=16 ≥ 14
    // ⇒ still-hits attack-roll lane — numeral-free for this lane's census.
    diceRoller.rollDie.mockReturnValue(4);
    diceRoller.rollD20.mockReturnValue(10);
  });

  describe('uses budget channels + currentUsesFor ?? fallback (stampPatch spend)', () => {
    const BUDGET_CASES = [
      {
        title: 'string uses_expression: evaluated max IS the budget, unset current falls back to it (2→1)',
        usesExpression: 'proficiency_bonus',
        evaluatedMax: 2,
        storedUses: undefined,
        expectedUses: 1,
      },
      {
        title: 'numeric uses_expression shadows the tracked bardic max 4, decrementing stored current under the feature key (2→1)',
        usesExpression: 3,
        storedUses: 2,
        expectedUses: 1,
      },
      {
        title: 'stored null current falls back to the max, not to zero (3→2)',
        usesExpression: 3,
        storedUses: null,
        expectedUses: 2,
      },
      {
        title: 'the last use spends exactly to zero and the route still resolves',
        usesExpression: 2,
        storedUses: 1,
        expectedUses: 0,
      },
    ];

    it.each(BUDGET_CASES)('%title', async ({ usesExpression, evaluatedMax, storedUses, expectedUses }) => {
      const action = setupDefaultPath({ usesExpression, evaluatedMax, storedUses });

      const result = await handle(action, makePlayerStats(), campaignName, mapName);

      // Full popup envelope via the REAL builder: automation echoes the live
      // object; description prose is .cuttingWords.test.js's ownership.
      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Cutting Words',
          description: expect.any(String),
          automation: action.automation,
        },
        defenderHp: null,
      });
      // Exact-array bake census: the uses key + value, and the ABSENCE of any
      // other budget key, in one toEqual.
      expectStampCensus({ cuttingWordsUses: expectedUses });
    });
  });

  describe('effectiveUsesKey selection (resolveUsesBudget)', () => {
    it('no uses_expression + tracked bardic max > 0: spend lands on bardicInspirationUses (unset current → 4−1=3), never the feature key', async () => {
      const action = setupDefaultPath();

      const result = await handle(action, makePlayerStats(), campaignName, mapName);

      expect(result.type).toBe('popup');
      expectStampCensus({ bardicInspirationUses: 3 });
    });

    it('zero budget (no expression, no tracked max): only latch + marker stamp, NO uses key — the reaction is free', async () => {
      const action = setupDefaultPath();

      const result = await handle(action, makePlayerStats({ _trackedResources: {} }), campaignName, mapName);

      // Reaction still runs — it just costs nothing.
      expect(result.type).toBe('popup');
      expectStampCensus({});
    });
  });
});
