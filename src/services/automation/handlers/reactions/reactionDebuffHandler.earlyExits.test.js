// @maintained-by-ai
// reactionDebuffHandler octet — lane: handle() FRONT-DOOR GUARDS (the generic
// early returns BEFORE EFFECT_ROUTES dispatch; automation/index.js:338
// `reaction_debuff` → handle). This file owns, in guard order:
//   1. requiresShield gate + hasShield/parseMagicItemName front-door entry
//      (exact refusal copy, positive '+1 Shield' pass — the ONLY positive pin
//      of this handler's shield gate in the octet),
//   2. uses-exhausted gate via the uses_expression budget (numeric and
//      evaluateAutoExpression channels) + rechargeLabel 'Long Rest' /
//      'Short or Long Rest' — the bardicUsesMax budget channel of the same
//      guard is owned by .cuttingWords.test.js; the stampPatch decrement
//      channels by .uses.test.js,
//   3. no-combat-context gate (CANONICAL — .cuttingWords.test.js shed this
//      and 'no target selected' here as the full-string owner),
//   4. no-target-resolved gate on the DEFAULT_EFFECT_ROUTE (handleBardicRoll
//      'requires a target' refusal — CANONICAL, same shed).
// Every refusal pins the full own-composition string and a zero-side-effect
// guard (no setRuntimeValue, no setRuntimeObject, no addEntry) plus guard
// ORDER (earlier gates prove later seams never ran).
//
// NOT this lane (seam map in .attacksVsAlly.test.js header): route-internal
// findLastAttack/no-recent-roll gates (attacksVsAlly, wardingFlare,
// defaultPath), latch gates (cuttingWords.latch, attacksVsAlly,
// branchesOfTheTree), range gates (disadvantage, attacksVsAlly), rage gate
// (branchesOfTheTree). handle() itself has no no-attack-event or
// missing-automation guard — nothing pinned for those by design.
//
// Deterministic: every nondeterministic seam (runtime store, logs, ranges,
// rollback, healing, expressions, second-d20 lanes) is mocked and every kept
// test refuses at a gate — no random roll is ever reached. Static contract
// strings + guard order; no churn expected when the app changes.
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

import * as targetResolver from '../../common/targetResolver.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as rangeCheck from '../../../rules/combat/rangeCheck.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as automationService from '../../../combat/automation/automationService.js';

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

function makeCombatSummary(creatures = []) {
  return { round: 1, creatures };
}

const campaignName = 'TestCampaign';
const mapName = 'DungeonMap';

// Full own-composition refusal strings (handle() :760/:766/:771,
// handleBardicRoll :635) — the exact literals this lane canonicalises.
const SHIELD_REFUSAL = 'Cutting Words: You must be holding a Shield to use this Reaction.';
const USES_REFUSAL_LONG = 'Cutting Words has no uses remaining. Recharges on a Long Rest.';
const USES_REFUSAL_SHORT = 'Cutting Words has no uses remaining. Recharges on a Short or Long Rest.';
const TARGET_REFUSAL = 'Cutting Words requires a target. Select a creature in combat and try again.';
const COMBAT_REFUSAL = 'No combat context found. Cannot apply Cutting Words.';

function expectPopupShape(result, action) {
  expect(result.type).toBe('popup');
  expect(result.payload.type).toBe('automation_info');
  expect(result.payload.name).toBe('Cutting Words');
  expect(result.payload.automation).toBe(action.automation);
}

// Refusal touched nothing: no store write, no spend stamp, no log row.
function expectZeroSideEffects() {
  expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  expect(useRuntimeState.setRuntimeObject).not.toHaveBeenCalled();
  expect(logService.addEntry).not.toHaveBeenCalled();
}

describe('reactionDebuffHandler — handle() front-door guards (before route dispatch)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRuntimeState.getRuntimeValue.mockReturnValue(undefined);
    rangeCheck.isWithinRange.mockReset().mockResolvedValue(true);
  });

  describe('early exit 1: requiresShield', () => {
    it('refuses with the exact shield copy when nothing is equipped: zero side effects, combat context never fetched', async () => {
      const ps = makePlayerStats({ inventory: { equipped: [] } });
      const action = makeAction({ requiresShield: true });

      const result = await handle(action, ps, campaignName, mapName);

      expectPopupShape(result, action);
      expect(result.payload.description).toBe(SHIELD_REFUSAL);
      expectZeroSideEffects();
      expect(damageUtils.getCombatContext).not.toHaveBeenCalled();
    });

    it('refuses when the equipped item resolves to a non-shield (Longsword): exact copy, zero side effects', async () => {
      const ps = makePlayerStats({
        inventory: { equipped: ['Longsword'] },
        equipment: [{ name: 'Longsword', weapon_category: 'martial_melee' }],
      });
      const action = makeAction({ requiresShield: true });

      const result = await handle(action, ps, campaignName, mapName);

      expectPopupShape(result, action);
      expect(result.payload.description).toBe(SHIELD_REFUSAL);
      expectZeroSideEffects();
      expect(damageUtils.getCombatContext).not.toHaveBeenCalled();
    });

    it('passes the gate for an equipped "+1 Shield" (parseMagicItemName strips the bonus): never the shield refusal', async () => {
      const ps = makePlayerStats({
        inventory: { equipped: ['+1 Shield'] },
        equipment: [{ name: 'Shield', armor_category: 'Shield' }],
      });
      const action = makeAction({ requiresShield: true });
      damageUtils.getCombatContext.mockResolvedValue(null);

      const result = await handle(action, ps, campaignName, mapName);

      // Gate released: flow reached the NEXT guard (combat context) — the
      // shield refusal never fired.
      expect(damageUtils.getCombatContext).toHaveBeenCalledWith(campaignName);
      expect(result.payload.description).toBe(COMBAT_REFUSAL);
      expect(result.payload.description).not.toContain('holding a Shield');
      expectZeroSideEffects();
    });
  });

  describe('early exit 2: uses exhausted (uses_expression budget) + recharge label', () => {
    function setupExhausted(usesExpression, recharge) {
      const ps = makePlayerStats({});
      const action = makeAction({ uses_expression: usesExpression, recharge });
      automationService.evaluateAutoExpression.mockReturnValue(2);
      useRuntimeState.getRuntimeValue.mockReturnValue(0);
      return { ps, action };
    }

    it.each`
      usesExpression
      ${3}
      ${'proficiency_bonus'}
    `('refuses with the exact uses copy when uses are exhausted ($usesExpression): zero side effects, gate runs before combat fetch', async ({ usesExpression }) => {
      const { ps, action } = setupExhausted(usesExpression, 'long_rest');

      const result = await handle(action, ps, campaignName, mapName);

      expectPopupShape(result, action);
      expect(result.payload.description).toBe(USES_REFUSAL_LONG);
      expectZeroSideEffects();
      expect(damageUtils.getCombatContext).not.toHaveBeenCalled();
      if (typeof usesExpression === 'number') {
        expect(automationService.evaluateAutoExpression).not.toHaveBeenCalled();
      } else {
        expect(automationService.evaluateAutoExpression).toHaveBeenCalledWith(usesExpression, ps);
      }
    });

    it('labels recharge "Short or Long Rest" when recharge is short_rest', async () => {
      const { ps, action } = setupExhausted(3, 'short_rest');

      const result = await handle(action, ps, campaignName, mapName);

      expectPopupShape(result, action);
      expect(result.payload.description).toBe(USES_REFUSAL_SHORT);
      expectZeroSideEffects();
    });
  });

  describe('early exit 3: no combat context (CANONICAL full-string owner)', () => {
    it('refuses with the exact no-combat-context copy before any route dispatch: resolveTarget untouched, zero side effects', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({ uses_expression: 3 });
      automationService.evaluateAutoExpression.mockReturnValue(3);
      useRuntimeState.getRuntimeValue.mockReturnValue(2);
      damageUtils.getCombatContext.mockResolvedValue(null);

      const result = await handle(action, ps, campaignName, mapName);

      expectPopupShape(result, action);
      expect(result.payload.description).toBe(COMBAT_REFUSAL);
      expect(targetResolver.resolveTarget).not.toHaveBeenCalled();
      expectZeroSideEffects();
    });
  });

  describe('early exit 4: no target resolved on the default route (CANONICAL full-string owner)', () => {
    it('refuses with the exact requires-a-target copy when resolveTarget returns null: zero side effects', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary());
      targetResolver.resolveTarget.mockResolvedValue(null);

      const result = await handle(action, ps, campaignName, mapName);

      expectPopupShape(result, action);
      expect(result.payload.description).toBe(TARGET_REFUSAL);
      expect(targetResolver.resolveTarget).toHaveBeenCalledWith(campaignName, 'Bard');
      expectZeroSideEffects();
    });
  });
});
