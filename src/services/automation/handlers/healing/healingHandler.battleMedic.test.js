// @maintained-by-ai
//
// ── HEALING LANE MAP — healingHandler.js seam coverage ──────────────────
// SUBJECT of this file: `handleHealersKit` in healingHandler.js (battleMedic
// seam): dispatched from handle() at the guard
// `!isSelf && auto.requiresHealersKit === true && auto.healExpression`.
// Real data: public/data/2024/feats.json Battle Medic
// (type 'healing', healExpression 'ally_hit_die + proficiency_bonus').
// Production caller: src/services/automation/index.js `healing:` /
// `self_healing:` → handleHealing. LIVE, verified 2026-10-15.
//
// This lane owns (only reachable via the requiresHealersKit branch):
//   - hasHealersKit inventory scan (equipped + backpack, string or {name})
//   - target-name resolution w/ silent self-default (targetInfo?.target?.name
//     || playerStats.name) — noted quirk: monk lane removed this in CLA-159,
//     kit lane keeps it today
//   - target hit-die resolution (characters[].computedStats → getHitDieSize;
//     d8 fallback floor)
//   - target shortRestHitDice gate + consumption (skipSync=true write)
//   - per-target maximization / rerollOnes via rollHeal
//   - own-composition description + logHealingToSSE payload shape
//
// Sibling suites on this same module (do NOT duplicate their lanes):
//   #1810 healingHandler.handOfHealing.cla159.test.js → handleMonkHealing /
//         performMonkHeal armed-target + picker + confirm
//   #1811 healingHandler.monk.test.js                  → handleMonkHealing
//         modal payload basics, martialArtsDie defaults, Physician's Touch
//   #1812 healingHandler.secondWind.test.js            → handleSelfHealing
//         generic self branch (bonus stacking, use gates)
//   #1813 healingHandler.tacticalShift.test.js         → triggerTacticalShift
//         on Second Wind activation
//   #1814 healingHandler.targeted.test.js              → handleUsesHealing /
//         handleUsesExpressionHealing / handleFlatHeal
//   #1815 healingHandler.test.js                       → handleSelfHealing
//         gates, uses tracking, hit_die_roll self path, and reroll/maximize
//         on the SELF target. This file's reroll/maximize tests below are the
//         ALLY-target lane: they pin hasHealingMaximizationForTarget scoped
//         to the ally name with the ally's hit die — complementary, not
//         duplicate.
//
// HANDOFF FLAGS (for later lanes / prod triage — test-only task, prod not
// touched):
//   - resolveTargetHitDieSize fetch fallback hits `/api/data/classes` and
//     `/api/data/classes2024` — NO server route serves either URL (server
//     serves public/ statically at /data/…; grep confirms these URLs appear
//     only in healingHandler.js:86). Broken in prod; deliberately NOT pinned
//     here. This file pins only the reachable d8-floor fallback instead.
//   - handleHealersKit logs a hardcoded `maximize: false` to SSE even when
//     the roll was maximized (healingHandler.js:135 quirk); the full SSE
//     pin below captures the current literal — update if prod fixes it.
//   - Hand of Healing ↔ reactionDamageHandler.handOfHarm (reactions/, later
//     queue): distinct modules, no shared seam.
//   - tempHpService has no dedicated suite (earlier flag, still open).
//
// Deterministic: all seams mocked, no timers, inert fetch from setup.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
  rollExpressionMaximized: vi.fn(),
}));

vi.mock('../../../character/classFeatures.js', () => ({
  getClassFeatures: vi.fn(),
}));

vi.mock('../../common/targetResolver.js', () => ({
  resolveTarget: vi.fn(),
}));

vi.mock('../../common/healingRoll.js', () => ({
  applyHealingDirectly: vi.fn(),
  logHealingToSSE: vi.fn(),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
  resolveHealingBonuses: vi.fn(),
  resolveHealingBonusesWithDetails: vi.fn(),
  markFortifiedHealthUsed: vi.fn(),
  hasHealingMaximization: vi.fn(),
  hasHealingMaximizationForTarget: vi.fn(),
  hasRerollHealingOnes: vi.fn(),
  hasTacticalShift: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../rules/effects/restRules.js', () => ({
  getHitDieSize: vi.fn(),
  computeHitDieRecovery: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './healingHandler.js';
import * as diceRoller from '../../../dice/diceRoller.js';
import * as targetResolver from '../../common/targetResolver.js';
import * as healingRoll from '../../common/healingRoll.js';
import * as automationService from '../../../combat/automation/automationService.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as restRules from '../../../rules/effects/restRules.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestHealer',
    level: 5,
    proficiency: 3,
    currentHitPoints: 10,
    maxHitPoints: 20,
    abilities: [{ name: 'Constitution', bonus: 2 }],
    ...overrides,
  };
}

function makeBattleMedicAction(overrides = {}) {
  return {
    name: 'Battle Medic',
    automation: {
      type: 'healing',
      healExpression: 'ally_hit_die + proficiency_bonus',
      action: 'action',
      range: '5 ft',
      requiresHealersKit: true,
      ...overrides,
    },
  };
}

function makeCharacters(targetName, hitDieSize) {
  return [
    {
      name: targetName,
      computedStats: {
        class: { hit_point_die: `d${hitDieSize}` },
        level: 5,
      },
    },
  ];
}

// ── Tests ──────────────────────────────────────────────────────

describe('healingHandler battle medic (handleHealersKit seam)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
    diceRoller.rollExpressionMaximized.mockReturnValue({ total: 8, rolls: [8], modifier: 0 });
    automationService.resolveHealingBonuses.mockReturnValue(0);
    automationService.resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 0, details: [] });
    automationService.hasHealingMaximization.mockReturnValue(false);
    automationService.hasHealingMaximizationForTarget.mockReturnValue(false);
    automationService.hasRerollHealingOnes.mockReturnValue(false);
    healingRoll.applyHealingDirectly.mockReturnValue({ newHp: 15, maxHp: 20, actualHeal: 5 });
    targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Ally' } });
    runtimeState.getRuntimeValue.mockReturnValue(2);
    restRules.getHitDieSize.mockReturnValue(8);
  });

  describe('Healer\'s Kit gate', () => {
    it('refuses with no kit anywhere in inventory and touches nothing', async () => {
      const ps = makePlayerStats({
        inventory: { equipped: ['Longsword'], backpack: ['Scrolls'] },
      });
      const action = makeBattleMedicAction();

      const result = await handle(action, ps, campaignName, null, makeCharacters('Ally', 8));

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe("Battle Medic requires a Healer's Kit.");
      // gate runs before target resolution — no side effects at all
      expect(targetResolver.resolveTarget).not.toHaveBeenCalled();
      expect(diceRoller.rollExpression).not.toHaveBeenCalled();
      expect(healingRoll.applyHealingDirectly).not.toHaveBeenCalled();
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('accepts a kit found in backpack and consumes the target\'s last hit die', async () => {
      const ps = makePlayerStats({
        inventory: { equipped: [], backpack: ["Healer's Kit"] },
      });
      const action = makeBattleMedicAction();
      runtimeState.getRuntimeValue.mockReturnValue(1);
      restRules.getHitDieSize.mockReturnValue(6);
      healingRoll.applyHealingDirectly.mockReturnValue({ newHp: 12, maxHp: 20, actualHeal: 8 });

      await handle(action, ps, campaignName, null, makeCharacters('Ally', 6));

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d6');
      expect(healingRoll.applyHealingDirectly).toHaveBeenCalledWith(ps, 'Ally', 8, campaignName);
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Ally',
        'shortRestHitDice',
        0,
        campaignName,
        true,
      );
    });

    it('refuses when target has no hit dice remaining, with no roll and no spend', async () => {
      const ps = makePlayerStats({
        inventory: { equipped: ["Healer's Kit"], backpack: [] },
      });
      const action = makeBattleMedicAction();
      runtimeState.getRuntimeValue.mockReturnValue(0);

      const result = await handle(action, ps, campaignName, null, makeCharacters('Ally', 8));

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('Ally has no hit dice remaining.');
      expect(diceRoller.rollExpression).not.toHaveBeenCalled();
      expect(diceRoller.rollExpressionMaximized).not.toHaveBeenCalled();
      expect(healingRoll.applyHealingDirectly).not.toHaveBeenCalled();
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('successful heal on an ally', () => {
    it('rolls the ally hit die + proficiency and reports the full description', async () => {
      const ps = makePlayerStats({
        inventory: { equipped: ["Healer's Kit"], backpack: [] },
        proficiency: 4,
      });
      const action = makeBattleMedicAction();
      diceRoller.rollExpression.mockReturnValue({ total: 6, rolls: [6], modifier: 0 });
      healingRoll.applyHealingDirectly.mockReturnValue({ newHp: 16, maxHp: 20, actualHeal: 10 });

      const result = await handle(action, ps, campaignName, null, makeCharacters('Ally', 8));

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe(
        'Battle Medic on Ally: 1d8 + 4 = 10 — Regained 10 HP (1 hit dice remaining).'
      );
      // prof applied once, no passive healing bonuses on this lane
      expect(healingRoll.applyHealingDirectly).toHaveBeenCalledWith(ps, 'Ally', 10, campaignName);
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Ally',
        'shortRestHitDice',
        1,
        campaignName,
        true,
      );
    });

    it('uses the target\'s hit die size from the characters array, not the healer\'s', async () => {
      const ps = makePlayerStats({
        inventory: { equipped: ["Healer's Kit"], backpack: [] },
      });
      const action = makeBattleMedicAction();
      restRules.getHitDieSize.mockReturnValue(10);
      diceRoller.rollExpression.mockReturnValue({ total: 7, rolls: [7], modifier: 0 });
      healingRoll.applyHealingDirectly.mockReturnValue({ newHp: 20, maxHp: 20, actualHeal: 10 });

      const characters = makeCharacters('Ally', 10);
      await handle(action, ps, campaignName, null, characters);

      expect(restRules.getHitDieSize).toHaveBeenCalledWith(characters[0].computedStats);
      expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d10');
    });

    it('falls back to a d8 floor when target stats carry no hit die', async () => {
      const ps = makePlayerStats({
        inventory: { equipped: ["Healer's Kit"], backpack: [] },
      });
      const action = makeBattleMedicAction();
      restRules.getHitDieSize.mockReturnValue(null);

      await handle(action, ps, campaignName, null, [
        { name: 'Ally', computedStats: { level: 5 } },
      ]);

      // character-fetch fallback is broken in prod (no /api/data/classes route —
      // see header flag); the reachable contract is the d8 floor.
      expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d8');
      expect(healingRoll.applyHealingDirectly).toHaveBeenCalled();
    });

    it('consumes the hit die even when the target is already at full HP', async () => {
      const ps = makePlayerStats({
        inventory: { equipped: ["Healer's Kit"], backpack: [] },
        proficiency: 3,
      });
      const action = makeBattleMedicAction();
      runtimeState.getRuntimeValue.mockReturnValue(1);
      diceRoller.rollExpression.mockReturnValue({ total: 4, rolls: [4], modifier: 0 });
      healingRoll.applyHealingDirectly.mockReturnValue({ newHp: 20, maxHp: 20, actualHeal: 0 });

      const result = await handle(action, ps, campaignName, null, makeCharacters('Ally', 8));

      // RAW: the hit die is spent regardless of overheal — distinct from the
      // self_healing lane's "No use spent" refusal contract (#1815/#1812).
      expect(result.payload.description).toContain('Already at full HP');
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Ally',
        'shortRestHitDice',
        0,
        campaignName,
        true,
      );
    });
  });

  describe('roll modifiers (ally-target lane)', () => {
    // Complementary to #1815's reroll/maximize tests, which pin the SELF
    // target. Here maximization is scoped to the ALLY name via
    // hasHealingMaximizationForTarget(playerStats, 'Ally', campaignName).
    it('rerolls ones when hasRerollHealingOnes is true', async () => {
      const ps = makePlayerStats({
        inventory: { equipped: ["Healer's Kit"], backpack: [] },
      });
      const action = makeBattleMedicAction();
      automationService.hasRerollHealingOnes.mockReturnValue(true);
      diceRoller.rollExpression.mockReturnValue({ total: 7, rolls: [7], modifier: 0 });

      await handle(action, ps, campaignName, null, makeCharacters('Ally', 8));

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d8', { rerollOnes: true });
      expect(diceRoller.rollExpressionMaximized).not.toHaveBeenCalled();
    });

    it('maximizes when the ALLY target has healing maximization', async () => {
      const ps = makePlayerStats({
        inventory: { equipped: ["Healer's Kit"], backpack: [] },
      });
      const action = makeBattleMedicAction();
      automationService.hasHealingMaximizationForTarget.mockReturnValue(true);
      diceRoller.rollExpressionMaximized.mockReturnValue({ total: 8, rolls: [8], modifier: 0 });
      healingRoll.applyHealingDirectly.mockReturnValue({ newHp: 11, maxHp: 20, actualHeal: 11 });

      await handle(action, ps, campaignName, null, makeCharacters('Ally', 8));

      expect(automationService.hasHealingMaximizationForTarget).toHaveBeenCalledWith(ps, 'Ally', campaignName);
      expect(diceRoller.rollExpressionMaximized).toHaveBeenCalledWith('1d8');
      expect(diceRoller.rollExpression).not.toHaveBeenCalled();
    });

    it('returns null without healing or spending when the roll fails', async () => {
      const ps = makePlayerStats({
        inventory: { equipped: ["Healer's Kit"], backpack: [] },
      });
      const action = makeBattleMedicAction();
      diceRoller.rollExpression.mockReturnValue(null);

      const result = await handle(action, ps, campaignName, null, makeCharacters('Ally', 8));

      expect(result).toBeNull();
      expect(healingRoll.applyHealingDirectly).not.toHaveBeenCalled();
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(healingRoll.logHealingToSSE).not.toHaveBeenCalled();
    });
  });

  describe('SSE log payload', () => {
    it('logs the full own-composition payload to SSE', async () => {
      const ps = makePlayerStats({
        inventory: { equipped: ["Healer's Kit"], backpack: [] },
        proficiency: 3,
      });
      const action = makeBattleMedicAction();
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
      healingRoll.applyHealingDirectly.mockReturnValue({ newHp: 13, maxHp: 20, actualHeal: 8 });

      await handle(action, ps, campaignName, null, makeCharacters('Ally', 8));

      // Full exact-object pin (own composition). Includes the hardcoded
      // `maximize: false` quirk at healingHandler.js:135 — update deliberately
      // if prod starts forwarding the real flag.
      expect(healingRoll.logHealingToSSE).toHaveBeenCalledWith(campaignName, {
        targetName: 'Ally',
        sourceName: 'Battle Medic',
        actualHeal: 8,
        newHp: 13,
        maxHp: 20,
        rollInfo: '1d8=5 (5)',
        maximize: false,
        healingName: 'Battle Medic',
        bonusDetails: [],
        skipPopup: true,
      });
    });
  });
});
