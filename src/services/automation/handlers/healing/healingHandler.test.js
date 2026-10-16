// @maintained-by-ai
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
//     seam (the `!isSelf &&` clause at healingHandler.js:617 — battleMedic
//     only pins the non-self side) + the automation_info popup envelope
//   - usesKeyFor resource keys: derived name-based 'healingtouchUses',
//     explicit resourceKey 'customUses' override, uninitialized `?? auto.uses`
//     default, and the 0-use refusal driven by a DERIVED-key runtime read
//     (secondWind t7 pins the Short-Rest message via explicit resourceKey;
//     the Long-Rest ternary branch is pinned ONLY here)
//   - 'fighter level' substitution missing-level default (`level || 1`);
//     the level-present substitution is pinned by secondWind t1 — not re-pinned
//   - hit_die_roll self path: gateHitDiceCost refusal (no roll/apply/write),
//     allow path with the ONE retained computeHitDieRecovery(roll, CON) args
//     pin (handoff (b) — secondWind t8 keeps the other CON variant at 23,5),
//     shortRestHitDice consumption with skipSync=true, and the no-generic-
//     uses-key-side-effect guard even when auto.uses is configured
//   - gateBloodied refusal text + exact-floor(maxHp/2) allow boundary (odd
//     maxHp); the even-half allow is subsumed by the same `<=` comparison
//   - rollHeal branch selection with SELF-scoped hasHealingMaximizationForTarget
//     (battleMedic pins the ALLY-scoped side only)
//
// NOT owned here (lane map in healingHandler.battleMedic.test.js):
//   - handleHealersKit kit seam → healingHandler.battleMedic.test.js
//   - handleMonkHealing / performMonkHeal picker → cla159.test.js, monk.test.js
//   - CLA-305 amount pins, full-HP gate text ('Already at full HP … No use
//     spent'), zero-delta race, 0-HP refusal, explicit-resourceKey 0-use
//     block, hit_die_roll no-double-add, evaluated-number expressions
//     → healingHandler.secondWind.test.js (#1812)
//   - triggerTacticalShift riders (hasTacticalShift hard-mocked false below)
//     → healingHandler.tacticalShift.test.js (#1813)
//   - handleUsesHealing / handleUsesExpressionHealing / handleFlatHeal
//     → healingHandler.targeted.test.js (#1814)
//
// REMOVED during trim (2026-10-15, subsumed coverage — do not re-add):
//   - 'should report "Already at full HP" when target is at max HP' →
//     secondWind t5 zero-delta race pins the full refusal string (handoff (a))
//   - 'should replace fighter level in expression' (level present) →
//     secondWind t1 pins rollExpression('1d10 + 18'), same substitution seam
//   - 'should use Constitution bonus for hit die recovery' → merged into the
//     single allow-path CON pin below (handoff (b))
//   - 'should allow when sufficient hit dice available' / 'should decrement
//     hit dice after healing' → merged into one allow-path test
//   - 'should allow multiple uses as long as hit dice remain' → the gate is
//     recomputed from runtime each call; covered by the insufficient-block and
//     allow-path pins' stored-hit-dice arithmetic
//   - 'should report Long Rest…' 0-use short-rest-message twin and
//     bloodied even-half allow → collapsed into the boundary pins described
//     above (identical message template / identical `<=` comparison)
//
// PROD FLAGS (test-only task, prod untouched):
//   - healingHandler.js exports only `handle` — no dead exports on this
//     module (applyPostDamageMasteryEffects orphan precedent checked).
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

function mockDefaultBehavior() {
  diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
  diceRoller.rollExpressionMaximized.mockReturnValue({ total: 8, rolls: [8], modifier: 0 });
  automationService.resolveHealingBonuses.mockReturnValue(0);
  automationService.resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 0, details: [] });
  healingRoll.applyHealingDirectly.mockReturnValue({ newHp: 15, maxHp: 20, actualHeal: 5 });
}

// Keyed runtime reads: only the named key carries a value, everything else
// stays uninitialized (exercises the `?? auto.uses` / `?? level` defaults
// honestly instead of leaking one value across every key lookup).
function runtimeMap(map) {
  runtimeState.getRuntimeValue.mockImplementation((name, key) => map[key]);
}

function setCallsForKeys(...keys) {
  return runtimeState.setRuntimeValue.mock.calls.filter(call => keys.includes(call[1]));
}

// ── Tests ──────────────────────────────────────────────────────

describe('healingHandler self_healing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDefaultBehavior();
    runtimeState.getRuntimeValue.mockReturnValue(undefined);
  });

  // ── handle() self dispatch ─────────────────────────────────

  describe('handle() dispatch', () => {
    it('routes self_healing to the self path even when requiresHealersKit is set, returning the automation_info envelope', async () => {
      const ps = makePlayerStats();
      // isSelf=true must bypass the kit branch (`!isSelf &&` at healingHandler.js:617):
      // handleHealersKit would call resolveTarget; the self lane never does.
      const action = makeAction({
        healExpression: '1d4+2',
        requiresHealersKit: true,
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Healing Touch');
      expect(result.payload.automationType).toBe('self_healing');
      expect(result.payload.description).toContain('Regained 5 HP');
      expect(targetResolver.resolveTarget).not.toHaveBeenCalled();
      expect(healingRoll.applyHealingDirectly).toHaveBeenCalledWith(
        ps,
        'TestHealer',
        expect.any(Number),
        campaignName,
      );
    });
  });

  // ── Uses tracking: healingtouchUses / customUses resource keys ──

  describe('uses tracking', () => {
    it('should decrement derived name-based healingtouchUses with skipSync and report remaining uses', async () => {
      runtimeMap({ healingtouchUses: 3 });
      const ps = makePlayerStats();
      const action = makeAction({ healExpression: '1d4', uses: 3 });

      const result = await handle(action, ps, campaignName, null);

      expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith('TestHealer', 'healingtouchUses', campaignName);
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestHealer',
        'healingtouchUses',
        2,
        campaignName,
        true,
      );
      expect(result.payload.description).toContain('2 uses remaining');
    });

    it('should use explicit resourceKey over the derived name-based key', async () => {
      runtimeMap({ customUses: 2 });
      const ps = makePlayerStats();
      const action = makeAction({
        healExpression: '1d4',
        uses: 2,
        resourceKey: 'customUses',
      });

      await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestHealer',
        'customUses',
        1,
        campaignName,
        true,
      );
      expect(setCallsForKeys('healingtouchUses')).toHaveLength(0);
    });

    it('should default to auto.uses when no runtime value and no _trackedResources exist', async () => {
      runtimeMap({});
      const ps = makePlayerStats();
      const action = makeAction({ healExpression: '1d4', uses: 5 });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestHealer',
        'healingtouchUses',
        4,
        campaignName,
        true,
      );
    });

    it('should block when the derived-key runtime read is 0 and report the Long Rest recharge', async () => {
      // Long-Rest ternary branch (gateTrackedUses) + refusal driven off the
      // DERIVED key. Short-Rest twin text is pinned by secondWind t7 — not
      // re-pinned here.
      runtimeMap({ healingtouchUses: 0 });
      const ps = makePlayerStats();
      const action = makeAction({
        healExpression: '1d4',
        uses: 1,
        recharge: 'long_rest',
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('no uses remaining');
      expect(result.payload.description).toContain('Long Rest');
      expect(result.payload.description).not.toContain('Short Rest');
      expect(diceRoller.rollExpression).not.toHaveBeenCalled();
      expect(healingRoll.applyHealingDirectly).not.toHaveBeenCalled();
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  // ── Expression substitution ────────────────────────────────

  describe('healExpression substitution', () => {
    it('should replace fighter level with 1 when level is missing', async () => {
      // Level-present substitution ('1d10 + fighter level' → '1d10 + 18')
      // is owned by secondWind t1 — this pins only the `|| 1` default.
      const ps = makePlayerStats({ level: undefined });
      const action = makeAction({
        healExpression: '1d4 + fighter level',
      });

      await handle(action, ps, campaignName, null);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d4 + 1');
    });
  });

  // ── Hit die roll ───────────────────────────────────────────

  describe('hit_die_roll', () => {
    it('should block when insufficient hit dice, with no roll, no apply, and no write', async () => {
      runtimeMap({ shortRestHitDice: 1 });
      const ps = makePlayerStats();
      const action = makeAction({
        healExpression: 'hit_die_roll',
        hitDiceCost: 3,
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe(
        'Healing Touch requires 3 hit die(s) to use. You have 1 remaining.',
      );
      expect(diceRoller.rollExpression).not.toHaveBeenCalled();
      expect(restRules.computeHitDieRecovery).not.toHaveBeenCalled();
      expect(healingRoll.applyHealingDirectly).not.toHaveBeenCalled();
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('should heal computeHitDieRecovery(roll, CON), decrement shortRestHitDice with skipSync, and report remaining dice', async () => {
      runtimeMap({ shortRestHitDice: 3 });
      restRules.getHitDieSize.mockReturnValue(10);
      restRules.computeHitDieRecovery.mockReturnValue(7);
      diceRoller.rollExpression.mockReturnValue({ total: 6, rolls: [6], modifier: 0 });
      healingRoll.applyHealingDirectly.mockReturnValue({ newHp: 17, maxHp: 20, actualHeal: 7 });

      const ps = makePlayerStats({
        abilities: [{ name: 'Constitution', bonus: 3 }],
      });
      const action = makeAction({
        healExpression: 'hit_die_roll',
        hitDiceCost: 1,
      });

      const result = await handle(action, ps, campaignName, null);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d10');
      expect(restRules.computeHitDieRecovery).toHaveBeenCalledWith(6, 3);
      expect(healingRoll.applyHealingDirectly).toHaveBeenCalledWith(ps, 'TestHealer', 7, campaignName);
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestHealer',
        'shortRestHitDice',
        2,
        campaignName,
        true,
      );
      expect(result.payload.description).toBe(
        'Healing Touch: 1d10=6 (6) — Regained 7 HP (2 hit dice remaining).',
      );
    });

    it('should not touch a generic uses key for hit_die_roll even when auto.uses is configured', async () => {
      runtimeMap({ shortRestHitDice: 2 });
      restRules.getHitDieSize.mockReturnValue(8);
      restRules.computeHitDieRecovery.mockReturnValue(5);
      diceRoller.rollExpression.mockReturnValue({ total: 4, rolls: [4], modifier: 0 });

      const ps = makePlayerStats();
      const action = makeAction({
        healExpression: 'hit_die_roll',
        hitDiceCost: 1,
        uses: 2,
      });

      await handle(action, ps, campaignName, null);

      expect(setCallsForKeys('healingtouchUses', 'customUses')).toHaveLength(0);
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestHealer',
        'shortRestHitDice',
        1,
        campaignName,
        true,
      );
    });
  });

  // ── Bloodied only ──────────────────────────────────────────

  describe('bloodiedOnly', () => {
    it('should block when above half HP, touching nothing', async () => {
      const ps = makePlayerStats({ currentHitPoints: 15, maxHitPoints: 20 });
      const action = makeAction({
        healExpression: '1d4',
        bloodiedOnly: true,
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe(
        'Healing Touch can only be used when Bloodied (at half HP or less).',
      );
      expect(diceRoller.rollExpression).not.toHaveBeenCalled();
      expect(healingRoll.applyHealingDirectly).not.toHaveBeenCalled();
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('should allow when at exactly floor(maxHp/2) with an odd max', async () => {
      const ps = makePlayerStats({ currentHitPoints: 7, maxHitPoints: 15 });
      const action = makeAction({
        healExpression: '1d4',
        bloodiedOnly: true,
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('Regained 5 HP');
    });
  });

  // ── Maximization and reroll (SELF-scoped) ──────────────────

  describe('maximization and reroll', () => {
    beforeEach(() => {
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
      diceRoller.rollExpressionMaximized.mockReturnValue({ total: 8, rolls: [8], modifier: 0 });
      automationService.hasHealingMaximizationForTarget.mockReturnValue(false);
      automationService.hasRerollHealingOnes.mockReturnValue(false);
    });

    it('should use rollExpressionMaximized when hasHealingMaximization, scoped to the SELF target name', async () => {
      automationService.hasHealingMaximizationForTarget.mockReturnValue(true);

      const ps = makePlayerStats();
      const action = makeAction({ healExpression: '1d6' });

      await handle(action, ps, campaignName, null);

      expect(automationService.hasHealingMaximizationForTarget).toHaveBeenCalledWith(ps, 'TestHealer', campaignName);
      expect(diceRoller.rollExpressionMaximized).toHaveBeenCalledWith('1d6');
      expect(diceRoller.rollExpression).not.toHaveBeenCalled();
    });

    it('should use rollExpression with rerollOnes when hasRerollHealingOnes', async () => {
      automationService.hasRerollHealingOnes.mockReturnValue(true);

      const ps = makePlayerStats();
      const action = makeAction({ healExpression: '1d6' });

      await handle(action, ps, campaignName, null);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d6', { rerollOnes: true });
      expect(diceRoller.rollExpressionMaximized).not.toHaveBeenCalled();
    });

    it('should use normal rollExpression when neither flag is set', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ healExpression: '1d6' });

      await handle(action, ps, campaignName, null);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d6');
      expect(diceRoller.rollExpressionMaximized).not.toHaveBeenCalled();
    });
  });
});
