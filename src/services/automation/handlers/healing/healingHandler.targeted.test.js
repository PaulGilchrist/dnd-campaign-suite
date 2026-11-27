// @maintained-by-ai 2026-11-27
//
// ── #1814 targeted lane — healingHandler.js handleUsesHealing / ───────────
//    handleUsesExpressionHealing / handleFlatHeal
// SUBJECT of this file: the non-self, non-monk, non-kit dispatch tail of
// handle() in healingHandler.js:
//   - `auto.uses !== undefined && auto.uses !== null` → handleUsesHealing
//     (exhaustion gate → handleUsesExpressionHealing, or flat uses-consume
//     → handleFlatHeal)
//   - else → handleFlatHeal
// Production caller: src/services/automation/index.js `healing:` /
// `self_healing:` → handleHealing. LIVE, verified 2026-10-15. Real data:
// public/data/2024/races.json Healing Hands ('proficiency_bonus_d4',
// uses:1, long_rest) is the flagship expression-lane shape.
//
// This lane owns (non-self ally-target resolution + application):
//   - resolveTarget(campaignName, healerName) with silent self-default
//     (targetInfo?.target?.name || playerStats.name) — quirk: the monk lane
//     removed this in CLA-159; the uses/flat lanes keep it today
//   - handleUsesHealing exhaustion gate: hardcoded '…cannot be used again
//     until you finish a Long Rest.' INDEPENDENT of auto.recharge (quirk vs
//     the self lane's recharge-aware gateTrackedUses message in
//     healingHandler.test.js) — pinned as a recharge-invariance it.each;
//     update here if prod fixes it
//   - handleUsesExpressionHealing: expression roll, bonus weaving, ally-
//     scoped maximization/rerollOnes branch selection, evaluated-number
//     expressions (2 * proficiency_bonus) skipping the roller entirely, use
//     consumption via 4-arg setRuntimeValue (NO skipSync flag — unlike the
//     self lane's 5-arg writes), own-composition description with the
//     remaining-uses grammar, and the THIS-LANE law that a use is spent even
//     when the heal lands 0 (the self lane's CLA-305 no-spend-on-zero law is
//     NOT mirrored here — Fortified-mark it.each pins both halves)
//   - handleFlatHeal: numeric healAmount + bonuses, full SSE-row schema
//     WITHOUT remainingUses/maxUses keys (divergence from the expression
//     lane pinned honestly), uses-consume-then-flat (the use is spent even
//     at full HP), and the double-resolveTarget quirk (handleUsesHealing
//     resolves the target, then handleFlatHeal resolves it AGAIN)
//
// Apply fixture honesty (run2#1828 lesson, swept here 11-27): the old fixed
// {newHp:15, actualHeal:5} mirror return silently mispainted a maximized 8
// and a rerolled 2 both as 'Regained 5 HP'. The fixture below now mirrors
// the REAL healingRoll.applyHealingDirectly reads — max from
// playerStats.hitPoints, current from the target's currentHitPoints runtime
// bucket — so actualHeal/description/SSE rows compute per fixture. NOTE the
// faithful quirk this exposes: the handler passes the HEALER's stats as the
// max source for an ally target (healingHandler.js:635/678 →
// healingRoll.js `maxHp = targetMaxHp ?? playerStats.hitPoints`).
//
// NOT pinned (prod triage flag): the Healer feat (feats.json, type 'healing',
// uses:null, healExpression '1d6 + 4 + healer_kit') lands on handleFlatHeal
// with the raw expression STRING passed as the amount to applyHealingDirectly
// (healingHandler.js:673, 678) — numeric-add math on a string is broken in
// prod; deliberately NOT pinned here.
//
// Sibling suites on this module (lane map in healingHandler.battleMedic.test.js):
//   #1810 healingHandler.handOfHealing.cla159.test.js → handleMonkHealing /
//         performMonkHeal armed-target + picker + confirm
//   #1811 healingHandler.monk.test.js                  → handleMonkHealing
//         self-path modal basics, martialArtsDie ladder, Physician's Touch
//   #1812 healingHandler.secondWind.test.js            → handleSelfHealing
//         generic self branch (CLA-305 amount pins, use gates, no-spend-on-
//         zero law, hit-die 23,5 CON variant)
//   #1813 healingHandler.tacticalShift.test.js         → triggerTacticalShift
//         on Second Wind activation
//   #1815 healingHandler.test.js                       → handleSelfHealing
//         gates, uses tracking, hit_die_roll, reroll/maximize on SELF target
//   healingHandler.battleMedic.test.js                 → handleHealersKit
//
// Deterministic: all seams mocked, no timers, inert fetch from setup.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../dice/diceRoller.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, rollExpression: vi.fn(), rollExpressionMaximized: vi.fn() }
});

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
  hasTacticalShift: vi.fn(() => false),
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

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestHealer',
    level: 5,
    proficiency: 3,
    currentHitPoints: 10,
    maxHitPoints: 20,
    hitPoints: 20,
    abilities: [{ name: 'Constitution', bonus: 2 }],
    ...overrides,
  };
}

function makeHealingAction(name, automation = {}) {
  return {
    name,
    automation: {
      type: 'healing',
      ...automation,
    },
  };
}

// Runtime buckets the lane reads: 'currentHitPoints' (the apply fixture's
// target-HP truth) and the feature uses key (undefined → the gate falls back
// to maxUses, i.e. a fully-fresh day).
function runtimeMap(map) {
  runtimeState.getRuntimeValue.mockImplementation((name, key) => map[key]);
}

// ── Tests ──────────────────────────────────────────────────────

describe('healingHandler targeted lane (handleUsesHealing / handleFlatHeal)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
    diceRoller.rollExpressionMaximized.mockReturnValue({ total: 8, rolls: [8], modifier: 0 });
    automationService.resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 0, details: [] });
    automationService.hasHealingMaximizationForTarget.mockReturnValue(false);
    automationService.hasRerollHealingOnes.mockReturnValue(false);
    // Clamp against the stats and runtime bucket actually handed in —
    // mirrors the real healingRoll.applyHealingDirectly reads, no hidden
    // fixed actualHeal.
    healingRoll.applyHealingDirectly.mockImplementation((ps, targetName, amount) => {
      const maxHp = ps.hitPoints;
      const stored = runtimeState.getRuntimeValue(targetName, 'currentHitPoints', campaignName);
      const currentHp = stored != null && stored !== '' ? Number(stored) : maxHp;
      const newHp = Math.min(maxHp, currentHp + amount);
      return { newHp, maxHp, actualHeal: newHp - currentHp };
    });
    targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Ally' } });
    runtimeMap({ currentHitPoints: 10 });
  });

  // ── handle() dispatch + target resolution ──────────────────────

  describe('target resolution', () => {
    it('Healing Hands real data commit census: routes uses-dispatch, resolves the armed ally, rolls proficiency_bonus_d4, heals, spends the last use, logs full row and popup', async () => {
      // public/data/2024/races.json Healing Hands (prof 3 → 3d4).
      const ps = makePlayerStats();
      const action = makeHealingAction('Healing Hands', { healExpression: 'proficiency_bonus_d4', uses: 1, recharge: 'long_rest' });

      const result = await handle(action, ps, campaignName, null);

      expect(targetResolver.resolveTarget.mock.calls).toEqual([[campaignName, 'TestHealer']]);
      expect(diceRoller.rollExpression.mock.calls).toEqual([['3d4']]);
      expect(healingRoll.applyHealingDirectly.mock.calls).toEqual([
        [ps, 'Ally', 5, campaignName],
      ]);
      // Quirk: this lane writes uses WITHOUT the skipSync flag (the self
      // lane writes with skipSync=true — healingHandler.test.js).
      expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
        ['TestHealer', 'healingHandsUses', 0, campaignName],
      ]);
      expect(healingRoll.logHealingToSSE.mock.calls).toEqual([[campaignName, {
        targetName: 'Ally',
        sourceName: 'Healing Hands',
        actualHeal: 5,
        newHp: 15,
        maxHp: 20,
        rollInfo: '3d4=5 (5)',
        maximize: false,
        healingName: 'Healing Hands',
        remainingUses: 0,
        maxUses: 1,
        bonusDetails: [],
      }]]);
      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Healing Hands',
          automationType: 'healing',
          description: 'Healing Hands on Ally: 3d4=5 (5) — Regained 5 HP (no uses remaining).',
        },
      });
    });

    it('defaults silently to the healer when no target is armed (lane quirk)', async () => {
      targetResolver.resolveTarget.mockResolvedValue(null);
      const ps = makePlayerStats();
      const action = makeHealingAction('Cure Wounds', { healExpression: '1d8', uses: 1 });

      const result = await handle(action, ps, campaignName, null);

      // Quirk kept today by the uses/flat lanes (CLA-159 removed it only
      // from the monk lane): no picker, no refusal — heals self.
      expect(healingRoll.applyHealingDirectly.mock.calls).toEqual([
        [ps, 'TestHealer', 5, campaignName],
      ]);
      expect(result.payload.description).toBe('Cure Wounds on TestHealer: 1d8=5 (5) — Regained 5 HP (no uses remaining).');
    });

    it.each(['short_rest', 'long_rest'])(
      'refuses with the hardcoded Long Rest message when uses are exhausted regardless of recharge=$case, touching nothing',
      async (recharge) => {
        runtimeMap({ currentHitPoints: 10, cureWoundsUses: 0 });
        const ps = makePlayerStats();
        const action = makeHealingAction('Cure Wounds', { healExpression: '1d8', uses: 1, recharge });

        const result = await handle(action, ps, campaignName, null);

        // Quirk: gate is before target resolution and hardcodes Long Rest
        // regardless of auto.recharge (self lane's gateTrackedUses is
        // recharge-aware — healingHandler.test.js).
        expect(result).toEqual({
          type: 'popup',
          payload: {
            type: 'automation_info',
            name: 'Cure Wounds',
            automationType: 'healing',
            description: 'Cure Wounds has been used and cannot be used again until you finish a Long Rest.',
          },
        });
        expect(targetResolver.resolveTarget).not.toHaveBeenCalled();
        expect(diceRoller.rollExpression).not.toHaveBeenCalled();
        expect(healingRoll.applyHealingDirectly).not.toHaveBeenCalled();
        expect(healingRoll.logHealingToSSE).not.toHaveBeenCalled();
        expect(runtimeState.setRuntimeValue.mock.calls).toEqual([]);
      },
    );
  });

  // ── handleUsesExpressionHealing (expression rolled onto the target) ──

  describe('handleUsesExpressionHealing', () => {
    it('weaves passive healing bonuses into the amount and logs them, without marking Fortified Health', async () => {
      automationService.resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 2, details: [{ name: 'Disciple of Life', amount: 2 }] });
      const ps = makePlayerStats();
      const action = makeHealingAction('Cure Wounds', { healExpression: '1d8', uses: 1 });

      const result = await handle(action, ps, campaignName, null);

      expect(healingRoll.applyHealingDirectly.mock.calls).toEqual([
        [ps, 'Ally', 7, campaignName],
      ]);
      expect(automationService.hasHealingMaximizationForTarget).toHaveBeenCalledWith(ps, 'Ally', campaignName);
      expect(result.payload.description).toBe('Cure Wounds on Ally: 1d8=5 (5) — Regained 7 HP (no uses remaining).');
      expect(healingRoll.logHealingToSSE.mock.calls).toEqual([[campaignName, {
        targetName: 'Ally',
        sourceName: 'Cure Wounds',
        actualHeal: 7,
        newHp: 17,
        maxHp: 20,
        rollInfo: '1d8=5 (5)',
        maximize: false,
        healingName: 'Cure Wounds',
        remainingUses: 0,
        maxUses: 1,
        bonusDetails: [{ name: 'Disciple of Life', amount: 2 }],
      }]]);
      expect(automationService.markFortifiedHealthUsed.mock.calls).toEqual([]);
    });

    it.each([
      {
        case: 'ally actually healed — marked once, use spent',
        allyHp: 10,
        expectMarked: true,
        description: 'Cure Wounds on Ally: 1d8=5 (5) — Regained 5 HP (no uses remaining).',
      },
      {
        // THIS lane spends the use on a zero-delta heal — the self lane's
        // CLA-305 no-spend law is NOT mirrored here.
        case: 'zero-delta heal — NOT marked, use still spent',
        allyHp: 20,
        expectMarked: false,
        description: 'Cure Wounds on Ally: 1d8=5 (5) — Already at full HP (no uses remaining).',
      },
    ])('Fortified Health details: $case', async ({ allyHp, expectMarked, description }) => {
      automationService.resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 0, details: [{ name: 'Fortified Health' }] });
      runtimeMap({ currentHitPoints: allyHp });
      const ps = makePlayerStats();
      const action = makeHealingAction('Cure Wounds', { healExpression: '1d8', uses: 1 });

      const result = await handle(action, ps, campaignName, null);

      expect(automationService.markFortifiedHealthUsed.mock.calls).toEqual(
        expectMarked ? [[ps, campaignName]] : [],
      );
      expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
        ['TestHealer', 'cureWoundsUses', 0, campaignName],
      ]);
      expect(result.payload.description).toBe(description);
    });

    it('maximization is ally-scoped and replaces the roll entirely (rollExpression never touched)', async () => {
      automationService.hasHealingMaximizationForTarget.mockReturnValue(true);
      const ps = makePlayerStats();
      const action = makeHealingAction('Cure Wounds', { healExpression: '1d8', uses: 3 });

      const result = await handle(action, ps, campaignName, null);

      expect(automationService.hasHealingMaximizationForTarget.mock.calls).toEqual([
        [ps, 'Ally', campaignName],
      ]);
      expect(diceRoller.rollExpressionMaximized.mock.calls).toEqual([['1d8']]);
      expect(diceRoller.rollExpression).not.toHaveBeenCalled();
      expect(result.payload.description).toBe('Cure Wounds on Ally: 1d8=8 (maximized) — Regained 8 HP (2 uses remaining).');
      expect(healingRoll.logHealingToSSE).toHaveBeenCalledWith(campaignName, expect.objectContaining({ maximize: true }));
    });

    it('reroll-ones passes { rerollOnes: true } and pins the singular one-use grammar', async () => {
      automationService.hasRerollHealingOnes.mockReturnValue(true);
      diceRoller.rollExpression.mockReturnValue({ total: 2, rolls: [1, 1], modifier: 0 });
      const ps = makePlayerStats();
      const action = makeHealingAction('Cure Wounds', { healExpression: '1d8', uses: 2 });

      const result = await handle(action, ps, campaignName, null);

      expect(diceRoller.rollExpression.mock.calls).toEqual([['1d8', { rerollOnes: true }]]);
      expect(diceRoller.rollExpressionMaximized).not.toHaveBeenCalled();
      expect(result.payload.description).toBe('Cure Wounds on Ally: 1d8=2 (rerolled ones) — Regained 2 HP (1 use remaining).');
    });

    it('evaluated-number expressions resolve via the real expression helper and skip the dice roller', async () => {
      // Real pure helpers compute '2 * proficiency_bonus' → '2 * 3' → 6.
      const ps = makePlayerStats();
      const action = makeHealingAction('Cure Wounds', { healExpression: '2 * proficiency_bonus', uses: 3 });

      const result = await handle(action, ps, campaignName, null);

      expect(diceRoller.rollExpression).not.toHaveBeenCalled();
      expect(diceRoller.rollExpressionMaximized).not.toHaveBeenCalled();
      expect(healingRoll.applyHealingDirectly.mock.calls).toEqual([
        [ps, 'Ally', 6, campaignName],
      ]);
      expect(result.payload.description).toBe('Cure Wounds on Ally: 2 * 3=6 (6) — Regained 6 HP (2 uses remaining).');
    });

    it('returns null without healing, logging, or spending when the roll fails', async () => {
      diceRoller.rollExpression.mockReturnValue(null);
      const ps = makePlayerStats();
      const action = makeHealingAction('Cure Wounds', { healExpression: '1d8', uses: 1 });

      const result = await handle(action, ps, campaignName, null);

      expect(result).toBeNull();
      expect(healingRoll.applyHealingDirectly).not.toHaveBeenCalled();
      expect(healingRoll.logHealingToSSE).not.toHaveBeenCalled();
      expect(runtimeState.setRuntimeValue.mock.calls).toEqual([]);
    });
  });

  // ── handleFlatHeal (flat amounts, no roll) ─────────────────────

  describe('handleFlatHeal', () => {
    it('numeric healAmount plus bonuses: full commit census onto the resolved ally, writes no uses, SSE row schema carries no uses keys', async () => {
      automationService.resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 3, details: [{ name: 'Disciple of Life', amount: 3 }] });
      const ps = makePlayerStats();
      const action = makeHealingAction('Lay on Hands', { healAmount: 5 });

      const result = await handle(action, ps, campaignName, null);

      expect(targetResolver.resolveTarget.mock.calls).toEqual([[campaignName, 'TestHealer']]);
      expect(healingRoll.applyHealingDirectly.mock.calls).toEqual([
        [ps, 'Ally', 8, campaignName],
      ]);
      // Flat path never touches tracked uses.
      expect(runtimeState.setRuntimeValue.mock.calls).toEqual([]);
      // Schema divergence from the expression lane, pinned honestly: no
      // remainingUses/maxUses keys. Description omits the target name.
      expect(healingRoll.logHealingToSSE.mock.calls).toEqual([[campaignName, {
        targetName: 'Ally',
        sourceName: 'Lay on Hands',
        actualHeal: 8,
        newHp: 18,
        maxHp: 20,
        rollInfo: '5',
        maximize: false,
        healingName: 'Lay on Hands',
        bonusDetails: [{ name: 'Disciple of Life', amount: 3 }],
      }]]);
      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Lay on Hands',
          automationType: 'healing',
          description: 'Lay on Hands: 5 — Regained 8 HP',
        },
      });
    });

    it('uses-plus-flat: spends the tracked use even at full HP, and resolves the target twice (lane quirk)', async () => {
      runtimeMap({ currentHitPoints: 20 });
      const ps = makePlayerStats();
      const action = makeHealingAction('Stabilize', { uses: 1, healAmount: 1 });

      const result = await handle(action, ps, campaignName, null);

      // Quirk: handleUsesHealing resolves the target for the branch check,
      // then handleFlatHeal resolves it AGAIN for the apply.
      expect(targetResolver.resolveTarget.mock.calls).toEqual([
        [campaignName, 'TestHealer'],
        [campaignName, 'TestHealer'],
      ]);
      expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
        ['TestHealer', 'stabilizeUses', 0, campaignName],
      ]);
      expect(healingRoll.applyHealingDirectly.mock.calls).toEqual([
        [ps, 'Ally', 1, campaignName],
      ]);
      expect(result.payload.description).toBe('Stabilize: 1 — Already at full HP');
      expect(healingRoll.logHealingToSSE.mock.calls).toEqual([[campaignName, {
        targetName: 'Ally',
        sourceName: 'Stabilize',
        actualHeal: 0,
        newHp: 20,
        maxHp: 20,
        rollInfo: '1',
        maximize: false,
        healingName: 'Stabilize',
        bonusDetails: [],
      }]]);
    });
  });
});
