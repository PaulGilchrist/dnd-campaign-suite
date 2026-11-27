// @maintained-by-ai 2026-11-27 — FRONT-DOOR GUARD lane over reactionDebuffHandler.js:
// the generic handle() early returns BEFORE EFFECT_ROUTES dispatch (automation/index.js:338
// `reaction_debuff` → handle). This file owns, in guard order:
//   1. requiresShield gate + hasShield/parseMagicItemName front-door entry
//      (:753-754): the $-titled refusal family (nothing equipped; equipped
//      item resolving to a non-shield) and the $-titled gate-release family
//      ('+1 Shield' bonus strip; malformed '+ Shield' — the shared fix#201
//      parser drops the dangling '+' and never eats the name) — the ONLY
//      positive pins of this handler's shield gate in the octet,
//   2. uses-exhausted gate via the uses_expression budget (:757-760) +
//      rechargeLabel (:720-722): $-titled family pinning the numeric
//      no-eval pass-through AND the evaluateAutoExpression(uses_expression,
//      playerStats) string-channel ARG PIN (CANONICAL here — .uses.test.js
//      header explicitly does not restate it), plus the 'Long Rest' vs
//      'Short or Long Rest' copy legs. The bardicUsesMax budget channel of
//      the same guard is owned by .cuttingWords.test.js; the stampPatch
//      decrement channels by .uses.test.js,
//   3. no-combat-context gate (:763-765) — CANONICAL family-wide: siblings
//      deliberately do not restate it,
//   4. no-target-resolved gate on the DEFAULT_EFFECT_ROUTE (handleBardicRoll
//      :627 'requires a target' refusal — CANONICAL full-string owner).
// Every refusal leg pins the full-shape popup toEqual through the REAL
// infoPopup builder + the exact own-composition string + a full-array
// zero-commit census (setRuntimeValue/setRuntimeObject/addEntry/
// applyHealingToTarget .mock.calls === []) plus guard ORDER: each exit proves
// the later seams never ran (ordered EXACT 2-arg getRuntimeValue read
// censuses; zero resolveTarget/resolveMapPositions/findLastAttack/
// isWithinRange calls; zero getCombatContext fetch where the gate precedes
// it). Exact literals subsume the old not.toContain negatives.
//
// NOT this lane (seam map in .attacksVsAlly.test.js header): route-internal
// findLastAttack/no-recent-roll gates (attacksVsAlly, wardingFlare,
// defaultPath), latch gates (cuttingWords.latch, attacksVsAlly,
// branchesOfTheTree), range gates (disadvantage, attacksVsAlly), rage gate
// (branchesOfTheTree). handle() itself has no no-attack-event or
// missing-automation guard — nothing pinned for those by design.
//
// Deterministic: vi.resetAllMocks + bare vi.fn factories with ALL lane
// defaults re-installed every beforeEach (no clearAllMocks residue, no
// factory-set impls, no *Once chains); infoPopup is the REAL
// dependency-free builder (family-wide mirror-mock purge); getDistanceFeet
// dropped from the rangeValidation mock (nothing in this handler's import
// graph consumes it). No FROZEN Date.now needed: every leg refuses at a gate
// before any timestamp is read, and zero addEntry calls is pinned everywhere.
// getRuntimeValue is the 2-param (charKey, key) function — read censuses pin
// the exact source arity (#1878). The resolveMapPositions 2-arg call defect
// (source :455/:497/:505, reported family-wide, never cemented) is
// UNREACHABLE on this lane: every kept leg pins zero calls. Static contract
// strings + guard order; no churn expected when the app changes.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './reactionDebuffHandler.js';

// ── Mocks BEFORE imports (bare vi.fn factories — every default is re-installed
//    in beforeEach; infoPopup is NOT mocked: real pure builder) ───────────────
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

// getDistanceFeet dropped: nothing in this handler's import graph consumes it.
vi.mock('../../../rules/combat/rangeValidation.js', () => ({
  rangeToFeet: vi.fn(),
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

import * as targetResolver from '../../common/targetResolver.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as rangeCheck from '../../../rules/combat/rangeCheck.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as damageRollback from '../../common/damageRollback.js';
import * as applyHealing from '../../../rules/combat/applyHealing.js';
import * as automationService from '../../../combat/automation/automationService.js';

const campaignName = 'TestCampaign';
const mapName = 'DungeonMap';
const PLAYER = 'Bard';

// An in-range combat summary is needed only to PAST the combat-context gate;
// every refusal below happens before anything reads it.
const SUMMARY = { round: 1, creatures: [] };

const EMPTY_RESULT = {
  attackEvent: null,
  attackerName: null,
  targetName: null,
  primaryDamage: 0,
  secondaryDamage: 0,
  totalDamage: 0,
  damageTypes: [],
};

function makePlayerStats(overrides = {}) {
  return {
    name: PLAYER,
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

// MERGES overrides onto the defaults (never replaces wholesale).
function makeAction(automation = {}) {
  return {
    name: 'Cutting Words',
    automation: {
      type: 'reaction_debuff',
      range: '60_ft',
      effect: '',
      uses_expression: null,
      recharge: 'long_rest',
      ...automation,
    },
  };
}

// Full own-composition refusal strings (handle() :754/:760/:765,
// handleBardicRoll :627) — the exact literals this lane canonicalises.
const SHIELD_REFUSAL = 'Cutting Words: You must be holding a Shield to use this Reaction.';
const TARGET_REFUSAL = 'Cutting Words requires a target. Select a creature in combat and try again.';
const COMBAT_REFUSAL = 'No combat context found. Cannot apply Cutting Words.';
const noUsesRefusal = (label) => `Cutting Words has no uses remaining. Recharges on a ${label}.`;

// REAL infoPopup envelope: full-shape equality pins the popup/automation_info
// envelope, the feature name, the exact refusal copy, and the automation
// object echo in ONE assertion.
const refusalPopup = (description, action) => ({
  type: 'popup',
  payload: {
    type: 'automation_info',
    name: 'Cutting Words',
    description,
    automation: action.automation,
  },
});

// Refusal touched nothing: no store write, no spend stamp, no log row, no heal.
function expectZeroCommit() {
  expect(useRuntimeState.setRuntimeValue.mock.calls).toEqual([]);
  expect(useRuntimeState.setRuntimeObject.mock.calls).toEqual([]);
  expect(logService.addEntry.mock.calls).toEqual([]);
  expect(applyHealing.applyHealingToTarget.mock.calls).toEqual([]);
}

// Gate-ORDER pin shared by every exit BEFORE route dispatch: nothing the
// routes consult was touched (zero range reads, zero target lookups, zero
// attack-history fetches) and no spend/log row exists.
function expectRouteSeamsUntouched() {
  expect(targetResolver.resolveTarget).not.toHaveBeenCalled();
  expect(targetResolver.resolveMapPositions).not.toHaveBeenCalled();
  expect(damageRollback.findLastAttack).not.toHaveBeenCalled();
  expect(rangeCheck.isWithinRange).not.toHaveBeenCalled();
}

describe('reactionDebuffHandler — handle() front-door guards (before route dispatch)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // ALL lane defaults re-installed every test (no impl residue).
    useRuntimeState.getRuntimeValue.mockReturnValue(undefined);
    useRuntimeState.setRuntimeValue.mockResolvedValue(undefined);
    useRuntimeState.setRuntimeObject.mockResolvedValue(undefined);
    logService.addEntry.mockResolvedValue({});
    rangeCheck.isWithinRange.mockResolvedValue(true);
    damageRollback.findLastAttack.mockResolvedValue(EMPTY_RESULT);
    // getCombatContext resolves undefined by default: if a gate ever regressed
    // past its seam, the leg lands on the no-combat-context refusal, never a
    // route.
  });

  describe('early exit 1: requiresShield', () => {
    it.each([
      { title: 'nothing is equipped', equipped: [], equipment: [] },
      {
        title: 'the equipped item resolves to a non-shield (Longsword)',
        equipped: ['Longsword'],
        equipment: [{ name: 'Longsword', weapon_category: 'martial_melee' }],
      },
    ])('refuses with the exact shield copy when $title: zero commits, every later gate unreferenced', async ({ equipped, equipment }) => {
      const ps = makePlayerStats({ inventory: { equipped }, equipment });
      const action = makeAction({ requiresShield: true });

      const result = await handle(action, ps, campaignName, mapName);

      expect(result).toEqual(refusalPopup(SHIELD_REFUSAL, action));
      expectZeroCommit();
      // Guard order: the uses-budget channel was never READ and the combat
      // context never fetched.
      expect(useRuntimeState.getRuntimeValue.mock.calls).toEqual([]);
      expect(damageUtils.getCombatContext).not.toHaveBeenCalled();
      expectRouteSeamsUntouched();
    });

    it.each([
      { title: 'equipped "+1 Shield" (parseMagicItemName strips the bonus)', equipped: '+1 Shield' },
      { title: 'malformed "+ Shield" (shared fix#201 parser drops the dangling \'+\', never eats the name)', equipped: '+ Shield' },
    ])('releases the gate for $title: flow reaches the NEXT guard (exact no-combat copy; the old substring(3) parser yielded \'+ Shield\'→\'hield\' catalog miss)', async ({ equipped }) => {
      const ps = makePlayerStats({
        inventory: { equipped: [equipped] },
        equipment: [{ name: 'Shield', armor_category: 'Shield' }],
      });
      const action = makeAction({ requiresShield: true });

      const result = await handle(action, ps, campaignName, mapName);

      // Gate released: the uses gate READ the bardic budget channel exactly
      // once (ordered exact 2-arg census), then the combat-context gate
      // refused — the shield refusal never fired (the exact literal above
      // subsumes it).
      expect(damageUtils.getCombatContext).toHaveBeenCalledWith(campaignName);
      expect(result).toEqual(refusalPopup(COMBAT_REFUSAL, action));
      expect(useRuntimeState.getRuntimeValue.mock.calls).toEqual([[PLAYER, 'bardicInspirationUses']]);
      expectZeroCommit();
      expectRouteSeamsUntouched();
    });
  });

  describe('early exit 2: uses exhausted (uses_expression budget) + recharge label', () => {
    it.each([
      { title: 'numeric uses_expression passes through unevaluated', expr: 3, recharge: 'long_rest', label: 'Long Rest' },
      { title: 'string uses_expression routes through evaluateAutoExpression', expr: 'proficiency_bonus', recharge: 'long_rest', label: 'Long Rest' },
      { title: 'short_rest recharges on a Short or Long Rest', expr: 3, recharge: 'short_rest', label: 'Short or Long Rest' },
    ])('refuses with the exact uses copy when exhausted via $title: zero commits, combat fetch unreferenced', async ({ expr, recharge, label }) => {
      const ps = makePlayerStats({});
      const action = makeAction({ uses_expression: expr, recharge });
      // Per-case fixture: budget max 2, stored current 0 ⇒ exhausted.
      automationService.evaluateAutoExpression.mockReturnValue(2);
      useRuntimeState.getRuntimeValue.mockReturnValue(0);

      const result = await handle(action, ps, campaignName, mapName);

      expect(result).toEqual(refusalPopup(noUsesRefusal(label), action));
      expectZeroCommit();
      // Guard order: refusal short-circuits before the combat-context fetch.
      expect(damageUtils.getCombatContext).not.toHaveBeenCalled();
      expectRouteSeamsUntouched();
      // CANONICAL uses_expression channel pins (uses.test.js defers to this
      // file): numeric never evaluates; the string channel pins the exact
      // evaluateAutoExpression(uses_expression, playerStats) args.
      if (typeof expr === 'number') {
        expect(automationService.evaluateAutoExpression).not.toHaveBeenCalled();
      } else {
        expect(automationService.evaluateAutoExpression).toHaveBeenCalledWith(expr, ps);
      }
      // Exactly one budget READ on the feature-derived key (uses_expression
      // shadows the tracked bardic budget) — ordered exact 2-arg census.
      expect(useRuntimeState.getRuntimeValue.mock.calls).toEqual([[PLAYER, 'cuttingWordsUses']]);
    });
  });

  describe('early exit 3: no combat context (CANONICAL full-string owner)', () => {
    it('refuses with the exact no-combat-context copy before any route dispatch: zero commits, every route seam untouched', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ uses_expression: 3 });
      // Per-case fixture: current 2 > 0 ⇒ the uses gate passes.
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      // getCombatContext default-resolves undefined ⇒ this gate refuses.

      const result = await handle(action, ps, campaignName, mapName);

      expect(damageUtils.getCombatContext).toHaveBeenCalledWith(campaignName);
      expect(result).toEqual(refusalPopup(COMBAT_REFUSAL, action));
      expectRouteSeamsUntouched();
      expect(useRuntimeState.getRuntimeValue.mock.calls).toEqual([[PLAYER, 'cuttingWordsUses']]);
      expectZeroCommit();
    });
  });

  describe('early exit 4: no target resolved on the default route (CANONICAL full-string owner)', () => {
    it('refuses with the exact requires-a-target copy when resolveTarget returns null: route first seam, every later seam untouched', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      // Per-case fixtures: past the uses gate (stored undefined ⇒ bardic max
      // 4) and the combat gate, so the DEFAULT route actually dispatches.
      damageUtils.getCombatContext.mockResolvedValue(SUMMARY);
      targetResolver.resolveTarget.mockResolvedValue(null);

      const result = await handle(action, ps, campaignName, mapName);

      expect(result).toEqual(refusalPopup(TARGET_REFUSAL, action));
      expect(targetResolver.resolveTarget).toHaveBeenCalledWith(campaignName, PLAYER);
      // Gate order INSIDE the route: the refusal at :627 precedes the range
      // seam, the attack-history fetch, and every latch/marker READ — only
      // the front-door budget read happened all test.
      expect(targetResolver.resolveMapPositions).not.toHaveBeenCalled();
      expect(damageRollback.findLastAttack).not.toHaveBeenCalled();
      expect(rangeCheck.isWithinRange).not.toHaveBeenCalled();
      expect(useRuntimeState.getRuntimeValue.mock.calls).toEqual([[PLAYER, 'bardicInspirationUses']]);
      expectZeroCommit();
    });
  });
});
