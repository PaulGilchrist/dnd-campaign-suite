// @maintained-by-ai
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
//     until you finish a Long Rest.' even when auto.recharge is 'short_rest'
//     (quirk vs the self lane's recharge-aware gateTrackedUses message in
//     healingHandler.test.js) — update here if prod fixes it
//   - handleUsesExpressionHealing: expression roll, bonus weaving, ally-
//     scoped maximization/rerollOnes, use consumption via 4-arg
//     setRuntimeValue (NO skipSync flag — unlike the self lane's 5-arg
//     writes), own-composition description incl. remaining-uses grammar
//   - handleFlatHeal: numeric healAmount + bonuses, uses-consume-before-flat
//     ordering (uses spent even when the target is at full HP)
//
// NOT pinned (prod triage flag): the Healer feat (feats.json, type 'healing',
// uses:null, healExpression '1d6 + 4 + healer_kit') lands on handleFlatHeal
// with the raw expression STRING passed as the amount to applyHealingDirectly
// (healingHandler.js:557, 562) — numeric-add math on a string is broken in
// prod; deliberately NOT pinned here.
//
// Sibling suites on this module (lane map in healingHandler.battleMedic.test.js):
//   #1810 healingHandler.handOfHealing.cla159.test.js → handleMonkHealing /
//         performMonkHeal armed-target + picker + confirm
//   #1811 healingHandler.monk.test.js                  → handleMonkHealing
//         self-path modal basics, martialArtsDie ladder, Physician's Touch
//   #1812 healingHandler.secondWind.test.js            → handleSelfHealing
//         generic self branch (CLA-305 amount pins, use gates)
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

// ── Tests ──────────────────────────────────────────────────────

describe('healingHandler targeted lane (handleUsesHealing / handleFlatHeal)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
    diceRoller.rollExpressionMaximized.mockReturnValue({ total: 8, rolls: [8], modifier: 0 });
    automationService.resolveHealingBonuses.mockReturnValue(0);
    automationService.resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 0, details: [] });
    automationService.hasHealingMaximizationForTarget.mockReturnValue(false);
    automationService.hasRerollHealingOnes.mockReturnValue(false);
    healingRoll.applyHealingDirectly.mockReturnValue({ newHp: 15, maxHp: 20, actualHeal: 5 });
    targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Ally' } });
    runtimeState.getRuntimeValue.mockReturnValue(undefined);
  });

  // ── handle() dispatch + target resolution ──────────────────────

  describe('target resolution', () => {
    it('routes non-self healing with uses through the uses gate and resolves the armed target', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(1);
      const ps = makePlayerStats();
      const action = makeHealingAction('Cure Wounds', { healExpression: '1d8', uses: 1 });

      const result = await handle(action, ps, campaignName, null);

      expect(targetResolver.resolveTarget).toHaveBeenCalledWith(campaignName, 'TestHealer');
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.automationType).toBe('healing');
    });

    it('defaults silently to the healer when no target is armed (lane quirk)', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(1);
      targetResolver.resolveTarget.mockResolvedValue(null);
      const ps = makePlayerStats();
      const action = makeHealingAction('Cure Wounds', { healExpression: '1d8', uses: 1 });

      const result = await handle(action, ps, campaignName, null);

      // Quirk kept today by the uses/flat lanes (CLA-159 removed it only
      // from the monk lane): no picker, no refusal — heals self.
      expect(healingRoll.applyHealingDirectly).toHaveBeenCalledWith(ps, 'TestHealer', 5, campaignName);
      expect(result.payload.description).toBe('Cure Wounds on TestHealer: 1d8=5 (5) — Regained 5 HP (no uses remaining).');
    });

    it('refuses with the hardcoded Long Rest message when uses are exhausted, touching nothing', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(0);
      const ps = makePlayerStats();
      const action = makeHealingAction('Cure Wounds', { healExpression: '1d8', uses: 1, recharge: 'short_rest' });

      const result = await handle(action, ps, campaignName, null);

      // Quirk: gate is before target resolution and hardcodes Long Rest
      // regardless of auto.recharge (self lane's gateTrackedUses is
      // recharge-aware — healingHandler.test.js).
      expect(result.payload.description).toBe('Cure Wounds has been used and cannot be used again until you finish a Long Rest.');
      expect(targetResolver.resolveTarget).not.toHaveBeenCalled();
      expect(diceRoller.rollExpression).not.toHaveBeenCalled();
      expect(healingRoll.applyHealingDirectly).not.toHaveBeenCalled();
      expect(healingRoll.logHealingToSSE).not.toHaveBeenCalled();
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  // ── handleUsesExpressionHealing (expression rolled onto the target) ──

  describe('handleUsesExpressionHealing', () => {
    it('Healing Hands real data: resolves proficiency_bonus_d4, heals the ally, consumes the last use, logs the full payload', async () => {
      // public/data/2024/races.json Healing Hands (prof 3 → 3d4).
      const ps = makePlayerStats();
      const action = makeHealingAction('Healing Hands', { healExpression: 'proficiency_bonus_d4', uses: 1, recharge: 'long_rest' });

      const result = await handle(action, ps, campaignName, null);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('3d4');
      expect(healingRoll.applyHealingDirectly).toHaveBeenCalledWith(ps, 'Ally', 5, campaignName);
      // Quirk: this lane writes uses WITHOUT the skipSync flag (the self
      // lane writes with skipSync=true — healingHandler.test.js).
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('TestHealer', 'healinghandsUses', 0, campaignName);
      expect(result.payload.description).toBe('Healing Hands on Ally: 3d4=5 (5) — Regained 5 HP (no uses remaining).');
      expect(healingRoll.logHealingToSSE).toHaveBeenCalledWith(campaignName, {
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
      });
    });

    it('reports plural remaining uses and consumes exactly one tracked use', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(3);
      const ps = makePlayerStats();
      const action = makeHealingAction('Restorative Touch', { healExpression: '1d8', uses: 3 });

      const result = await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledTimes(1);
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('TestHealer', 'restorativetouchUses', 2, campaignName);
      expect(result.payload.description).toBe('Restorative Touch on Ally: 1d8=5 (5) — Regained 5 HP (2 uses remaining).');
    });

    it('weaves passive healing bonuses into the amount and logs them, without marking Fortified Health', async () => {
      automationService.resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 2, details: [{ name: 'Disciple of Life', amount: 2 }] });
      const ps = makePlayerStats();
      const action = makeHealingAction('Cure Wounds', { healExpression: '1d8', uses: 1 });

      const result = await handle(action, ps, campaignName, null);

      expect(healingRoll.applyHealingDirectly).toHaveBeenCalledWith(ps, 'Ally', 7, campaignName);
      expect(automationService.hasHealingMaximizationForTarget).toHaveBeenCalledWith(ps, 'Ally', campaignName);
      expect(result.payload.description).toBe('Cure Wounds on Ally: 1d8=5 (5) — Regained 5 HP (no uses remaining).');
      expect(healingRoll.logHealingToSSE).toHaveBeenCalledWith(campaignName, expect.objectContaining({ bonusDetails: [{ name: 'Disciple of Life', amount: 2 }] }));
      expect(automationService.markFortifiedHealthUsed).not.toHaveBeenCalled();
    });

    it('delegates Fortified Health marking when details carry it and the ally actually healed', async () => {
      automationService.resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 0, details: [{ name: 'Fortified Health' }] });
      const ps = makePlayerStats();
      const action = makeHealingAction('Cure Wounds', { healExpression: '1d8', uses: 1 });

      await handle(action, ps, campaignName, null);

      expect(automationService.markFortifiedHealthUsed).toHaveBeenCalledWith(ps, campaignName);
    });

    it('applies ally-scoped maximization and reroll-ones modifiers', async () => {
      const ps = makePlayerStats();
      const action = makeHealingAction('Cure Wounds', { healExpression: '1d8', uses: 3 });

      automationService.hasHealingMaximizationForTarget.mockReturnValue(true);
      const maxResult = await handle(action, ps, campaignName, null);

      expect(automationService.hasHealingMaximizationForTarget).toHaveBeenCalledWith(ps, 'Ally', campaignName);
      expect(diceRoller.rollExpressionMaximized).toHaveBeenCalledWith('1d8');
      expect(diceRoller.rollExpression).not.toHaveBeenCalled();
      expect(maxResult.payload.description).toBe('Cure Wounds on Ally: 1d8=8 (maximized) — Regained 5 HP (2 uses remaining).');
      expect(healingRoll.logHealingToSSE).toHaveBeenCalledWith(campaignName, expect.objectContaining({ maximize: true }));

      automationService.hasHealingMaximizationForTarget.mockReturnValue(false);
      automationService.hasRerollHealingOnes.mockReturnValue(true);
      runtimeState.getRuntimeValue.mockReturnValue(2);
      diceRoller.rollExpression.mockReturnValue({ total: 2, rolls: [1, 1], modifier: 0 });
      const rerollResult = await handle(action, ps, campaignName, null);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d8', { rerollOnes: true });
      expect(rerollResult.payload.description).toBe('Cure Wounds on Ally: 1d8=2 (rerolled ones) — Regained 5 HP (1 use remaining).');
    });

    it('returns null without healing, logging, or spending when the roll fails', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(1);
      diceRoller.rollExpression.mockReturnValue(null);
      const ps = makePlayerStats();
      const action = makeHealingAction('Cure Wounds', { healExpression: '1d8', uses: 1 });

      const result = await handle(action, ps, campaignName, null);

      expect(result).toBeNull();
      expect(healingRoll.applyHealingDirectly).not.toHaveBeenCalled();
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(healingRoll.logHealingToSSE).not.toHaveBeenCalled();
    });
  });

  // ── handleFlatHeal (flat amounts, no roll) ─────────────────────

  describe('handleFlatHeal', () => {
    it('applies a numeric healAmount plus bonuses to the resolved ally and writes no uses', async () => {
      automationService.resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 3, details: [{ name: 'Disciple of Life', amount: 3 }] });
      const ps = makePlayerStats();
      const action = makeHealingAction('Lay on Hands', { healAmount: 5 });

      const result = await handle(action, ps, campaignName, null);

      expect(targetResolver.resolveTarget).toHaveBeenCalledWith(campaignName, 'TestHealer');
      expect(healingRoll.applyHealingDirectly).toHaveBeenCalledWith(ps, 'Ally', 8, campaignName);
      expect(result.payload.description).toBe('Lay on Hands: 5 — Regained 5 HP');
      expect(healingRoll.logHealingToSSE).toHaveBeenCalledWith(campaignName, {
        targetName: 'Ally',
        sourceName: 'Lay on Hands',
        actualHeal: 5,
        newHp: 15,
        maxHp: 20,
        rollInfo: '5',
        maximize: false,
        healingName: 'Lay on Hands',
        bonusDetails: [{ name: 'Disciple of Life', amount: 3 }],
      });
      // Flat path never touches tracked uses.
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('uses-plus-flat: consumes the tracked use BEFORE the flat heal, even at full HP', async () => {
      healingRoll.applyHealingDirectly.mockReturnValue({ newHp: 20, maxHp: 20, actualHeal: 0 });
      runtimeState.getRuntimeValue.mockReturnValue(1);
      const ps = makePlayerStats();
      const action = makeHealingAction('Stabilize', { uses: 1, healAmount: 1 });

      const result = await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('TestHealer', 'stabilizeUses', 0, campaignName);
      expect(healingRoll.applyHealingDirectly).toHaveBeenCalledWith(ps, 'Ally', 1, campaignName);
      expect(result.payload.description).toBe('Stabilize: 1 — Already at full HP');
      expect(healingRoll.logHealingToSSE).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        targetName: 'Ally',
        actualHeal: 0,
        rollInfo: '1',
      }));
    });
  });
});
