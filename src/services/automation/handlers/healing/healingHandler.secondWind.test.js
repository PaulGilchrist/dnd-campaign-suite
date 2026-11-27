// @maintained-by-ai 2026-11-27
//
// ── #1812 secondWind lane — healingHandler.js handleSelfHealing ───────────
// SUBJECT: the generic self_healing branch of handleSelfHealing in
// healingHandler.js (CLA-305 regression: must heal rollTotal+bonus, must not
// consume a use when no HP is actually gained, must refuse at 0 HP).
// Real data: Second Wind '1d10 + fighter level' (public/data/classes.json:5557,
// public/data/2024/classes.json:4509). Production caller:
// src/services/automation/index.js `self_healing:` → handleHealing.
// LIVE, verified 2026-10-15.
//
// This lane owns (amount pins are UNIQUE here — sibling suites mock
// applyHealingDirectly to fixed returns; here the fixture clamps against the
// playerStats it is handed so actualHeal, description and the SSE row are
// honest per fixture — the old hardcoded-89/94 mirror fixture mispainted the
// hit-die description as 'Regained 5 HP' for a 40/94 target, purged 11-27):
//   - success commit census: roll args → apply amount (roll total + passive
//     bonus, no double-count) → exactly one skipSync use write → full SSE row
//     → full popup shape (ordered mock.calls censuses)
//   - Fortified Health marked when the heal lands; NOT marked on the
//     zero-delta race (self-path markFortifiedIfHealed both conditions)
//   - refusal family with zero-spend censuses (setRuntimeValue.mock.calls
//     === []): full-HP gate before any roll, 0-HP unconscious RAW refusal,
//     full-HP runtime bucket outranking a stale damaged snapshot, and the
//     0-use gate ordering before the HP gates
//   - zero-delta race (gate passes → rolls → actualHeal 0): no use spent,
//     '. No use spent' tail, row logs unchanged uses
//   - hit_die_roll branch: healAmount = computeHitDieRecovery total with
//     resolveHealingBonusesWithDetails NEVER called (CLA-305 no-double-add);
//     the dice-cost gate, decrement twin and CON-variant 6,3 stay in
//     healingHandler.test.js — this keeps the 23,5 variant per lane map
//   - evaluated-number expressions (3 * monk_level) route through the same
//     amount fix with their own resourceKey consumption
//
// NOT owned here (lane map in healingHandler.battleMedic.test.js):
//   - handleHealersKit kit seam → healingHandler.battleMedic.test.js
//   - handleMonkHealing / cla159 picker → monk.test.js, cla159.test.js
//   - triggerTacticalShift riders (hasTacticalShift mocked false below)
//     → healingHandler.tacticalShift.test.js
//   - generic self-path dispatch/gate/uses bookkeeping, hit-dice cost gate,
//     bloodiedOnly, maximize/reroll branch selection → healingHandler.test.js (#1815)
//   - handleUsesHealing / handleFlatHeal → healingHandler.targeted.test.js (#1814)
//
// Deterministic: all seams mocked, no timers, inert fetch from setup.
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

import { handle } from './healingHandler.js';
import * as diceRoller from '../../../dice/diceRoller.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as restRules from '../../../rules/effects/restRules.js';
import * as healingRoll from '../../common/healingRoll.js';
import * as automationService from '../../../combat/automation/automationService.js';

const campaignName = 'TestCampaign';

function makeFighterStats(overrides = {}) {
  return {
    name: 'EvasiveFighter',
    level: 18,
    proficiency: 6,
    currentHitPoints: 89,
    maxHitPoints: 94,
    hitPoints: 94,
    abilities: [{ name: 'Constitution', bonus: 5 }],
    ...overrides,
  };
}

function makeSecondWind(automation = {}) {
  return {
    name: 'Second Wind',
    automation: {
      type: 'self_healing',
      healExpression: '1d10 + fighter level',
      action: 'bonus_action',
      uses: 4,
      resourceKey: 'secondWindUses',
      recharge: 'short_rest',
      ...automation,
    },
  };
}

function runtimeMap(map) {
  runtimeState.getRuntimeValue.mockImplementation((name, key) => map[key]);
}

describe('CLA-305 Second Wind generic self_healing branch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    diceRoller.rollExpression.mockReturnValue({ total: 23, rolls: [5], modifier: 0 });
    diceRoller.rollExpressionMaximized.mockReturnValue({ total: 28, rolls: [28], modifier: 0 });
    automationService.resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 0, details: [] });
    automationService.hasHealingMaximizationForTarget.mockReturnValue(false);
    automationService.hasRerollHealingOnes.mockReturnValue(false);
    // Clamp against the stats actually handed in — no hidden 89/94 constant.
    healingRoll.applyHealingDirectly.mockImplementation((ps, targetName, amount) => {
      const current = ps.currentHitPoints;
      const max = ps.maxHitPoints ?? ps.hitPoints;
      const newHp = Math.min(max, current + amount);
      return { newHp, maxHp: max, actualHeal: newHp - current };
    });
    runtimeMap({ secondWindUses: 4, currentHitPoints: 89 });
  });

  it('success commit census: rolls the substituted expression, heals the roll total, spends exactly one use with skipSync, logs the full row and popup', async () => {
    const ps = makeFighterStats();

    const result = await handle(makeSecondWind(), ps, campaignName, null);

    expect(diceRoller.rollExpression.mock.calls).toEqual([['1d10 + 18']]);
    expect(healingRoll.applyHealingDirectly.mock.calls).toEqual([
      [ps, 'EvasiveFighter', 23, campaignName],
    ]);
    expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
      ['EvasiveFighter', 'secondWindUses', 3, campaignName, true],
    ]);
    expect(healingRoll.logHealingToSSE.mock.calls).toEqual([[campaignName, {
      targetName: 'EvasiveFighter',
      sourceName: 'Second Wind',
      actualHeal: 5,
      newHp: 94,
      maxHp: 94,
      rollInfo: '1d10 + 18=23 (5)',
      maximize: false,
      healingName: 'Second Wind',
      remainingUses: 3,
      maxUses: 4,
      bonusDetails: [],
    }]]);
    expect(result).toEqual({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Second Wind',
        automationType: 'self_healing',
        description: 'Second Wind: 1d10 + 18=23 (5) — Regained 5 HP (3 uses remaining).',
      },
    });
  });

  it('weaves passive healing bonuses on top of the roll total without double-counting and marks Fortified Health when the heal lands', async () => {
    const ps = makeFighterStats();
    automationService.resolveHealingBonusesWithDetails.mockReturnValue({
      totalBonus: 2,
      details: [{ name: 'Fortified Health', amount: 2 }],
    });

    await handle(makeSecondWind(), ps, campaignName, null);

    expect(healingRoll.applyHealingDirectly.mock.calls).toEqual([
      [ps, 'EvasiveFighter', 25, campaignName],
    ]);
    expect(automationService.markFortifiedHealthUsed.mock.calls).toEqual([
      [ps, campaignName],
    ]);
  });

  it('zero-delta race: gate passes, roll lands, nothing heals — no use spent, no Fortified mark, row logs unchanged uses', async () => {
    // Dispatch snapshot already at max while the HP bucket still reads 89
    // (healed elsewhere between click and apply): the race the CLA-305
    // no-consumption law exists for.
    const ps = makeFighterStats({ currentHitPoints: 94 });
    automationService.resolveHealingBonusesWithDetails.mockReturnValue({
      totalBonus: 2,
      details: [{ name: 'Fortified Health', amount: 2 }],
    });

    const result = await handle(makeSecondWind(), ps, campaignName, null);

    expect(healingRoll.applyHealingDirectly.mock.calls).toEqual([
      [ps, 'EvasiveFighter', 25, campaignName],
    ]);
    expect(automationService.markFortifiedHealthUsed).not.toHaveBeenCalled();
    expect(runtimeState.setRuntimeValue.mock.calls).toEqual([]);
    expect(healingRoll.logHealingToSSE.mock.calls).toEqual([[campaignName, {
      targetName: 'EvasiveFighter',
      sourceName: 'Second Wind',
      actualHeal: 0,
      newHp: 94,
      maxHp: 94,
      rollInfo: '1d10 + 18=23 (5)',
      maximize: false,
      healingName: 'Second Wind',
      remainingUses: 4,
      maxUses: 4,
      bonusDetails: [{ name: 'Fortified Health', amount: 2 }],
    }]]);
    expect(result).toEqual({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Second Wind',
        automationType: 'self_healing',
        description: 'Second Wind: 1d10 + 18=23 (5) — Already at full HP (4 uses remaining). No use spent.',
      },
    });
  });

  it.each([
    {
      case: 'full HP',
      currentHitPoints: 94,
      description: 'Second Wind: Already at full HP (4 uses remaining). No use spent.',
    },
    {
      case: '0 HP (unconscious RAW refusal)',
      currentHitPoints: 0,
      description: "Second Wind can't be used while unconscious at 0 Hit Points.",
    },
  ])('refuses at $case before any roll with zero side effects', async ({ currentHitPoints, description }) => {
    runtimeMap({ secondWindUses: 4, currentHitPoints });

    const result = await handle(
      makeSecondWind(),
      makeFighterStats({ currentHitPoints }),
      campaignName,
      null,
    );

    expect(result).toEqual({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Second Wind',
        automationType: 'self_healing',
        description,
      },
    });
    expect(diceRoller.rollExpression).not.toHaveBeenCalled();
    expect(healingRoll.applyHealingDirectly).not.toHaveBeenCalled();
    expect(healingRoll.logHealingToSSE).not.toHaveBeenCalled();
    expect(runtimeState.setRuntimeValue.mock.calls).toEqual([]);
  });

  it('refuses on the full-HP runtime bucket even when the dispatch snapshot still reads damaged (bucket outranks snapshot)', async () => {
    runtimeMap({ secondWindUses: 4, currentHitPoints: 94 });

    const result = await handle(makeSecondWind(), makeFighterStats({ currentHitPoints: 89 }), campaignName, null);

    expect(result.payload.description).toBe('Second Wind: Already at full HP (4 uses remaining). No use spent.');
    expect(diceRoller.rollExpression).not.toHaveBeenCalled();
    expect(healingRoll.applyHealingDirectly).not.toHaveBeenCalled();
    expect(runtimeState.setRuntimeValue.mock.calls).toEqual([]);
  });

  it('blocks first on the 0-use gate before the HP gates', async () => {
    runtimeMap({ secondWindUses: 0, currentHitPoints: 0 });

    const result = await handle(makeSecondWind(), makeFighterStats({ currentHitPoints: 0 }), campaignName, null);

    expect(result.payload.description).toBe('Second Wind has no uses remaining. Recharges on a Short Rest.');
    expect(diceRoller.rollExpression).not.toHaveBeenCalled();
    expect(healingRoll.applyHealingDirectly).not.toHaveBeenCalled();
    expect(runtimeState.setRuntimeValue.mock.calls).toEqual([]);
  });

  it('hit_die_roll branch keeps computeHitDieRecovery total with no double-add of bonus', async () => {
    // Lane map: healingHandler.test.js owns the dice-cost gate, the
    // shortRestHitDice decrement twin and the CON-variant (6,3); this pins
    // the no-double-add law with the CON-variant (23,5).
    runtimeMap({ shortRestHitDice: 3, currentHitPoints: 40 });
    restRules.getHitDieSize.mockReturnValue(10);
    restRules.computeHitDieRecovery.mockReturnValue(12);
    automationService.resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 2, details: [] });

    const action = makeSecondWind({ healExpression: 'hit_die_roll', hitDiceCost: 1 });
    const result = await handle(action, makeFighterStats({ currentHitPoints: 40 }), campaignName, null);

    expect(restRules.computeHitDieRecovery).toHaveBeenCalledWith(23, 5);
    expect(healingRoll.applyHealingDirectly).toHaveBeenCalledWith(expect.anything(), 'EvasiveFighter', 12, campaignName);
    expect(automationService.resolveHealingBonusesWithDetails).not.toHaveBeenCalled();
    expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
      ['EvasiveFighter', 'shortRestHitDice', 2, campaignName, true],
    ]);
    expect(result.payload.description).toBe('Second Wind: 1d10=23 (5) — Regained 12 HP (2 hit dice remaining).');
  });

  it('flat-expression self heals (3 * monk_level) route roll total through the same fix', async () => {
    const action = {
      name: 'Wholeness of Body',
      automation: {
        type: 'self_healing',
        healExpression: '3 * monk_level',
        uses: 1,
        resourceKey: 'wholenessOfBodyUses',
        recharge: 'long_rest',
      },
    };
    runtimeMap({ wholenessOfBodyUses: 1, currentHitPoints: 89 });

    await handle(action, makeFighterStats(), campaignName, null);

    expect(healingRoll.applyHealingDirectly.mock.calls).toEqual([
      [expect.anything(), 'EvasiveFighter', 54, campaignName],
    ]);
    expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
      ['EvasiveFighter', 'wholenessOfBodyUses', 0, campaignName, true],
    ]);
  });
});
