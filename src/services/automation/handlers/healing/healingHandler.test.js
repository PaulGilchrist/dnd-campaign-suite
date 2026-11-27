// @maintained-by-ai 2026-11-27
//
// ── #1815 self lane — healingHandler.js handleSelfHealing gates, uses ─────
//    tracking, hit_die_roll, SELF-target reroll/maximize + handle() dispatch
// SUBJECT of this file: the generic self_healing branch of handleSelfHealing
// in healingHandler.js (gateTrackedUses / gateHitDiceCost / gateBloodied /
// selfHealingHpRefusal bookkeeping, usesKeyFor resource keys, fighter-level
// substitution tail, hit_die_roll consumption) plus the handle()-level routing
// guards visible from the self lane (the `!isSelf` clause of the kit guard).
// Production caller: src/services/automation/index.js `healing:` /
// `self_healing:` → handleHealing. LIVE, verified 2026-10-15. All fixtures
// here carry type 'self_healing' — a real index.js dispatch key (handoff (c)
// from #1814 verified: no reaction-type fixture fiction).
//
// This lane owns:
//   - handle() self dispatch: isSelf bypasses the requiresHealersKit kit
//     seam (the `!isSelf &&` clause at healingHandler.js:733 — battleMedic
//     only pins the non-self side) with the full popup/result commit census
//   - usesKeyFor resource keys (it.each family): derived name-based
//     'healingTouchUses', explicit resourceKey override, uninitialized
//     `?? auto.uses` default — each with an ordered full-array
//     setRuntimeValue census (the override case's census proves the derived
//     key is never written; secondWind t7 pins the Short-Rest message via
//     explicit resourceKey; the Long-Rest ternary branch is pinned ONLY here)
//   - 'fighter level' substitution missing-level default (`level || 1`);
//     the level-present substitution is pinned by secondWind t1 — not re-pinned
//   - hit_die_roll self path: refusal family (cost gate short of stored
//     dice, plus the `?? playerStats.level` stored-dice default), the ONE
//     allow-path with the retained computeHitDieRecovery(6, 3) CON variant
//     (handoff (b) — secondWind keeps the 23,5 variant), shortRestHitDice
//     decrement with skipSync=true, and the no-generic-uses-key-side-effect
//     law pinned INSIDE the allow-path full-array write census even when
//     auto.uses is configured
//   - gateBloodied refusal text + exact-floor(maxHp/2) allow boundary (odd
//     maxHp); the even-half allow is subsumed by the same `<=` comparison
//   - rollHeal branch-selection it.each (maximize / rerollOnes / plain) with
//     SELF-scoped hasHealingMaximizationForTarget + hasRerollHealingOnes
//     probe censuses (battleMedic pins the ALLY-scoped side only)
//
// Apply-fixture honesty (run2#1828 lesson, swept here 2026-11-27): the old
// fixed-return {newHp:15, maxHp:20, actualHeal:5} applyHealingDirectly mirror
// silently mispainted the odd-max bloodied fixture (maxHitPoints 15) as a
// 20-max target. The fixture now mirrors the real clamping reads — actual
// heal, newHp, description and the committed amount compute per fixture.
//
// NOT owned here (lane map in healingHandler.battleMedic.test.js):
//   - handleHealersKit kit seam → healingHandler.battleMedic.test.js
//   - handleMonkHealing / performMonkHeal picker → cla159.test.js, monk.test.js
//   - CLA-305 amount pins, full-HP gate text ('Already at full HP … No use
//     spent'), zero-delta race, 0-HP refusal, full-array success SSE-row
//     schema, explicit-resourceKey 0-use block, hit_die_roll no-double-add,
//     evaluated-number expressions, Fortified marking
//     → healingHandler.secondWind.test.js (#1812)
//   - triggerTacticalShift riders (hasTacticalShift hard-mocked false below)
//     → healingHandler.tacticalShift.test.js (#1813)
//   - handleUsesHealing / handleUsesExpressionHealing / handleFlatHeal
//     → healingHandler.targeted.test.js (#1814)
//
// REMOVED during trims (subsumed coverage — do not re-add):
//   - 2026-10-15: full-HP refusal (secondWind t5), level-present
//     substitution (secondWind t1), CON-pin merge, hit-die allow/decrement
//     twins, multi-use arithmetic, Long-Rest Short-Rest twin, bloodied
//     even-half allow.
//   - 2026-11-27 (#1815 sweep): 14 → 7 blocks (11 cases). Three separate
//     uses-tracking its collapsed into one it.each with full-array write
//     censuses; three separate refusals (0-use Long Rest, hit-die
//     insufficient, bloodied block) collapsed into one refusal it.each with
//     a widened zero-spend census (rollExpression, rollExpressionMaximized,
//     getHitDieSize, computeHitDieRecovery, applyHealingDirectly,
//     logHealingToSSE, setRuntimeValue === []); 'no generic uses key for
//     hit_die_roll' folded into the hit-die allow-path census (auto.uses 2
//     now configured there — the single shortRestHitDice write proves it);
//     three maximize/reroll/plain its collapsed into one branch it.each.
//     setCallsForKeys key-filter helper deleted (superseded by full-array
//     censuses). NEW pin: gateHitDiceCost `?? playerStats.level` default.
//
// PROD FLAGS (test-only task, prod untouched):
//   - healingHandler.js exports only `handle` — no dead exports on this
//     module (applyPostDamageMasteryEffects orphan precedent checked).
//   - known defects NOT laundered here (unreachable from the self lane;
//     pinned/flagged by siblings): ally heals clamp against HEALER max HP
//     (handleFlatHeal/handleUsesExpressionHealing → healingRoll.js), Healer
//     feat passes the raw expression STRING as apply amount — targeted lane.
//   - battleMedic's broken /api/data/classes fetch fallback flag stands;
//     unreachable from this lane (kit path only).
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
  resolveHealingBonusesWithDetails: vi.fn(),
  markFortifiedHealthUsed: vi.fn(),
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
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as restRules from '../../../rules/effects/restRules.js';
import * as healingRoll from '../../common/healingRoll.js';
import * as automationService from '../../../combat/automation/automationService.js';

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

function makeAction(automation = {}) {
  return {
    name: 'Healing Touch',
    automation: {
      type: 'self_healing',
      ...automation,
    },
  };
}

// Keyed runtime reads: only the named keys carry values, everything else
// stays uninitialized (exercises the `?? auto.uses` / `?? level` defaults
// honestly instead of leaking one value across every key lookup).
function runtimeMap(map) {
  runtimeState.getRuntimeValue.mockImplementation((name, key) => map[key]);
}

// ── Tests ──────────────────────────────────────────────────────

describe('healingHandler self_healing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
    diceRoller.rollExpressionMaximized.mockReturnValue({ total: 8, rolls: [8], modifier: 0 });
    automationService.resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 0, details: [] });
    automationService.hasHealingMaximizationForTarget.mockReturnValue(false);
    automationService.hasRerollHealingOnes.mockReturnValue(false);
    runtimeState.getRuntimeValue.mockReturnValue(undefined);
    // Clamp against the stats actually handed in — no hidden 15/20 mirror
    // constant (run2#1828 lesson): actualHeal/description compute per fixture.
    healingRoll.applyHealingDirectly.mockImplementation((ps, targetName, amount) => {
      const current = ps.currentHitPoints;
      const max = ps.maxHitPoints ?? ps.hitPoints;
      const newHp = Math.min(max, current + amount);
      return { newHp, maxHp: max, actualHeal: newHp - current };
    });
  });

  // ── handle() self dispatch ─────────────────────────────────

  it('routes self_healing past the requiresHealersKit guard to the self path — no resolveTarget, exactly one skipSync use write, full popup', async () => {
    // isSelf=true must bypass the kit branch (`!isSelf &&` at healingHandler.js:733):
    // handleHealersKit would call resolveTarget; the self lane never does.
    const ps = makePlayerStats();
    const action = makeAction({
      healExpression: '1d4+2',
      requiresHealersKit: true,
    });

    const result = await handle(action, ps, campaignName, null);

    expect(targetResolver.resolveTarget.mock.calls).toEqual([]);
    expect(diceRoller.rollExpression.mock.calls).toEqual([['1d4+2']]);
    expect(healingRoll.applyHealingDirectly.mock.calls).toEqual([
      [ps, 'TestHealer', 5, campaignName],
    ]);
    expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
      ['TestHealer', 'healingTouchUses', 0, campaignName, true],
    ]);
    expect(result).toEqual({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Healing Touch',
        automationType: 'self_healing',
        description: 'Healing Touch: 1d4+2=5 (5) — Regained 5 HP (0 uses remaining).',
      },
    });
  });

  // ── Uses tracking: usesKeyFor resource keys ───────────────

  it.each([
    {
      case: 'derived name-based key',
      automation: { uses: 3 },
      runtime: { healingTouchUses: 3 },
      key: 'healingTouchUses',
      remaining: 2,
    },
    {
      case: 'explicit resourceKey override',
      automation: { uses: 2, resourceKey: 'customUses' },
      runtime: { customUses: 2 },
      key: 'customUses',
      remaining: 1,
    },
    {
      case: 'uninitialized read defaults to auto.uses',
      automation: { uses: 5 },
      runtime: {},
      key: 'healingTouchUses',
      remaining: 4,
    },
  ])('uses bookkeeping — $case: reads the resolved key, commits exactly one decrement with skipSync', async ({ automation, runtime, key, remaining }) => {
    runtimeMap(runtime);
    const ps = makePlayerStats();

    const result = await handle(
      makeAction({ healExpression: '1d4', ...automation }),
      ps,
      campaignName,
      null,
    );

    expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith('TestHealer', key, campaignName);
    // Full-array census: the override case proves the derived key is never
    // written; the default case proves `?? auto.uses` seeds the countdown.
    expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
      ['TestHealer', key, remaining, campaignName, true],
    ]);
    expect(result.payload.description).toBe(
      `Healing Touch: 1d4=5 (5) — Regained 5 HP (${remaining} ${remaining === 1 ? 'use' : 'uses'} remaining).`,
    );
  });

  // ── Refusal family: zero-spend censuses ────────────────────

  it.each([
    {
      case: 'tracked uses exhausted, reporting the Long-Rest recharge ternary off the derived key',
      automation: { healExpression: '1d4', uses: 1, recharge: 'long_rest' },
      psOverrides: {},
      runtime: { healingTouchUses: 0 },
      // Short-Rest twin text is pinned by secondWind — not re-pinned here.
      description: 'Healing Touch has no uses remaining. Recharges on a Long Rest.',
    },
    {
      case: 'hit-dice cost gate short of the stored pool',
      automation: { healExpression: 'hit_die_roll', hitDiceCost: 3 },
      psOverrides: {},
      runtime: { shortRestHitDice: 1 },
      description: 'Healing Touch requires 3 hit die(s) to use. You have 1 remaining.',
    },
    {
      case: 'stored hit dice default to character level when uninitialized',
      automation: { healExpression: 'hit_die_roll', hitDiceCost: 6 },
      psOverrides: {},
      runtime: {},
      description: 'Healing Touch requires 6 hit die(s) to use. You have 5 remaining.',
    },
    {
      case: 'bloodiedOnly while above half HP',
      automation: { healExpression: '1d4', bloodiedOnly: true },
      psOverrides: { currentHitPoints: 15, maxHitPoints: 20 },
      runtime: {},
      description: 'Healing Touch can only be used when Bloodied (at half HP or less).',
    },
  ])('refusal — $case touches nothing', async ({ automation, psOverrides, runtime, description }) => {
    runtimeMap(runtime);

    const result = await handle(makeAction(automation), makePlayerStats(psOverrides), campaignName, null);

    expect(result).toEqual({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Healing Touch',
        automationType: 'self_healing',
        description,
      },
    });
    expect(diceRoller.rollExpression.mock.calls).toEqual([]);
    expect(diceRoller.rollExpressionMaximized.mock.calls).toEqual([]);
    expect(restRules.getHitDieSize.mock.calls).toEqual([]);
    expect(restRules.computeHitDieRecovery.mock.calls).toEqual([]);
    expect(healingRoll.applyHealingDirectly.mock.calls).toEqual([]);
    expect(healingRoll.logHealingToSSE.mock.calls).toEqual([]);
    expect(runtimeState.setRuntimeValue.mock.calls).toEqual([]);
  });

  // ── Expression substitution ────────────────────────────────

  it("substitutes 'fighter level' with the 1 fallback when level is missing", async () => {
    // Level-present substitution ('1d10 + fighter level' → '1d10 + 18')
    // is owned by secondWind t1 — this pins only the `|| 1` default.
    const ps = makePlayerStats({ level: undefined });
    const action = makeAction({ healExpression: '1d4 + fighter level' });

    await handle(action, ps, campaignName, null);

    expect(diceRoller.rollExpression.mock.calls).toEqual([['1d4 + 1']]);
  });

  // ── Hit die roll: allow path ───────────────────────────────

  it('hit_die_roll allow path: rolls the hit die, heals computeHitDieRecovery(6, 3), commits only the shortRestHitDice decrement even with auto.uses configured', async () => {
    // The full-array write census is the no-generic-uses-key-side-effect law:
    // uses: 2 is configured yet only the dice bucket moves. CON-variant
    // (6, 3) is this lane's handoff pin; secondWind keeps (23, 5).
    runtimeMap({ shortRestHitDice: 3 });
    restRules.getHitDieSize.mockReturnValue(10);
    restRules.computeHitDieRecovery.mockReturnValue(7);
    diceRoller.rollExpression.mockReturnValue({ total: 6, rolls: [6], modifier: 0 });

    const ps = makePlayerStats({
      abilities: [{ name: 'Constitution', bonus: 3 }],
    });
    const action = makeAction({
      healExpression: 'hit_die_roll',
      hitDiceCost: 1,
      uses: 2,
    });

    const result = await handle(action, ps, campaignName, null);

    expect(restRules.getHitDieSize.mock.calls).toEqual([[ps]]);
    expect(diceRoller.rollExpression.mock.calls).toEqual([['1d10']]);
    expect(restRules.computeHitDieRecovery.mock.calls).toEqual([[6, 3]]);
    expect(healingRoll.applyHealingDirectly.mock.calls).toEqual([
      [ps, 'TestHealer', 7, campaignName],
    ]);
    expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
      ['TestHealer', 'shortRestHitDice', 2, campaignName, true],
    ]);
    expect(result).toEqual({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Healing Touch',
        automationType: 'self_healing',
        description: 'Healing Touch: 1d10=6 (6) — Regained 7 HP (2 hit dice remaining).',
      },
    });
  });

  // ── Bloodied only: allow boundary ──────────────────────────

  it('bloodiedOnly allows at exactly floor(maxHp/2) on an odd max, clamping the heal honestly', async () => {
    const ps = makePlayerStats({ currentHitPoints: 7, maxHitPoints: 15 });
    const action = makeAction({ healExpression: '1d4', bloodiedOnly: true });

    const result = await handle(action, ps, campaignName, null);

    expect(healingRoll.applyHealingDirectly.mock.calls).toEqual([
      [ps, 'TestHealer', 5, campaignName],
    ]);
    expect(result).toEqual({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Healing Touch',
        automationType: 'self_healing',
        description: 'Healing Touch: 1d4=5 (5) — Regained 5 HP (0 uses remaining).',
      },
    });
  });

  // ── rollHeal branch selection (SELF-scoped probes) ─────────

  it.each([
    {
      case: 'maximization',
      maximize: true,
      rerollOnes: false,
      rollCalls: [],
      maximizedCalls: [['1d6']],
    },
    {
      case: 'reroll-ones',
      maximize: false,
      rerollOnes: true,
      rollCalls: [['1d6', { rerollOnes: true }]],
      maximizedCalls: [],
    },
    {
      case: 'neither flag',
      maximize: false,
      rerollOnes: false,
      rollCalls: [['1d6']],
      maximizedCalls: [],
    },
  ])('rollHeal selects the $case branch after probing maximization scoped to the SELF target', async ({ maximize, rerollOnes, rollCalls, maximizedCalls }) => {
    automationService.hasHealingMaximizationForTarget.mockReturnValue(maximize);
    automationService.hasRerollHealingOnes.mockReturnValue(rerollOnes);
    const ps = makePlayerStats();

    await handle(makeAction({ healExpression: '1d6' }), ps, campaignName, null);

    expect(automationService.hasHealingMaximizationForTarget.mock.calls).toEqual([
      [ps, 'TestHealer', campaignName],
    ]);
    expect(automationService.hasRerollHealingOnes.mock.calls).toEqual([[ps]]);
    expect(diceRoller.rollExpression.mock.calls).toEqual(rollCalls);
    expect(diceRoller.rollExpressionMaximized.mock.calls).toEqual(maximizedCalls);
  });
});
