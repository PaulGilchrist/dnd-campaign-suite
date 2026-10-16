// @maintained-by-ai
//
// ── #1811 monk lane — healingHandler.js self_healing modal basics ────────
// SUBJECT: handleMonkHealing's isSelf=true shortcut + performMonkHeal modal
// payload basics in healingHandler.js, reached via handle()'s isMonkHealing
// dispatch (healExpression includes 'martial_arts_die' && 'WIS').
// Production caller: src/services/automation/index.js `healing:` /
// `self_healing:` → handleHealing. LIVE, verified 2026-10-15.
// Authored 2024 Hand of Healing (public/data/2024/classes.json, type
// 'healing') is the cla159 lane; this lane pins the SELF-side half of the
// same seam — self_healing-type monk actions short-circuit straight to
// self, and the modal payload / martialArtsDie ladder / bonus weaving /
// Physician's Touch fields are pinned here.
//
// This lane owns:
//   - full modal payload shape for the self-target path (healName, formula,
//     rolls, bonus, healAmount, monkName, targetName, targetCurrentHp,
//     targetMaxHp, rerollOnes, no pending)
//   - isSelf shortcut guard: resolveTarget / getCombatContext /
//     applyHealingToTarget NEVER touched; applyHealingDirectly to self
//   - martialArtsDie pass-through from class features + d4 default when
//     getClassFeatures returns null
//   - resolveHealingBonusesWithDetails weaving into formula/bonus/healAmount
//   - Fortified Health mark delegation (mocked; internals owned upstream)
//   - Physician's Touch presence/absence in payload
//
// NOT owned here (do NOT re-absorb — lane map in
// healingHandler.battleMedic.test.js):
//   - CLA-160 armed target, CLA-163 picker/confirmHeal, CLA-092 choke,
//     Focus Point spend log → healingHandler.handOfHealing.cla159.test.js
//   - handleHealersKit kit seam → healingHandler.battleMedic.test.js
//   - handleSelfHealing generic self branch → healingHandler.secondWind.test.js,
//     healingHandler.test.js (#1815 gates/uses/hit_die_roll, self
//     reroll/maximize on the generic path)
//   - triggerTacticalShift → healingHandler.tacticalShift.test.js
//   - handleUsesHealing / handleFlatHeal → healingHandler.targeted.test.js
//
// Deterministic: all seams mocked (incl. damageUtils/logService so the real
// fetch paths cannot load), no timers, inert fetch from setup.

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

vi.mock('../../../rules/combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
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

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './healingHandler.js';
import * as diceRoller from '../../../dice/diceRoller.js';
import * as classFeatures from '../../../character/classFeatures.js';
import * as targetResolver from '../../common/targetResolver.js';
import * as healingRoll from '../../common/healingRoll.js';
import * as applyHealing from '../../../rules/combat/applyHealing.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
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
    abilities: [{ name: 'Wisdom', bonus: 2 }],
    ...overrides,
  };
}

// MERGES automation overrides onto the self_healing monk base — do not
// replace wholesale.
function makeMonkAction(automation = {}) {
  return {
    name: 'Hand of Healing',
    automation: {
      type: 'self_healing',
      healExpression: 'martial_arts_die + WIS',
      ...automation,
    },
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('healingHandler monk lane (self_healing martial_arts_die + WIS)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
    diceRoller.rollExpressionMaximized.mockReturnValue({ total: 8, rolls: [8], modifier: 0 });
    classFeatures.getClassFeatures.mockReturnValue({ martialArtsDie: 6 });
    automationService.resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 0, details: [] });
    automationService.hasHealingMaximizationForTarget.mockReturnValue(false);
    automationService.hasRerollHealingOnes.mockReturnValue(false);
    healingRoll.applyHealingDirectly.mockReturnValue({ newHp: 15, maxHp: 20, actualHeal: 5 });
  });

  it('returns full handOfHealing modal payload basics on the self path', async () => {
    const ps = makePlayerStats({ abilities: [{ name: 'Wisdom', bonus: 3 }] });

    const result = await handle(makeMonkAction(), ps, campaignName, null);

    expect(result.type).toBe('modal');
    expect(result.modalName).toBe('handOfHealing');
    const { payload } = result;
    expect(payload.pending).toBeUndefined();
    expect(payload.healName).toBe('Hand of Healing');
    expect(payload.monkName).toBe('TestHealer');
    expect(payload.targetName).toBe('TestHealer');
    expect(payload.formula).toBe('1d6 + 3');
    expect(payload.rolls).toEqual([5]);
    expect(payload.bonus).toBe(3);
    expect(payload.healAmount).toBe(8); // roll 5 + WIS 3
    expect(payload.targetCurrentHp).toBe(15); // flows from application result
    expect(payload.targetMaxHp).toBe(20);
    expect(payload.rerollOnes).toBe(false);
  });

  it('isSelf=true short-circuits to self: armed-target/picker/choke machinery untouched', async () => {
    const ps = makePlayerStats({ abilities: [{ name: 'Wisdom', bonus: 3 }] });

    const result = await handle(makeMonkAction(), ps, campaignName, null);

    expect(result.payload.targetName).toBe('TestHealer');
    expect(targetResolver.resolveTarget).not.toHaveBeenCalled();
    expect(damageUtils.getCombatContext).not.toHaveBeenCalled();
    expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled();
    expect(healingRoll.applyHealingDirectly).toHaveBeenCalledWith(ps, 'TestHealer', 8, campaignName);
  });

  describe('martialArtsDie ladder', () => {
    it('uses martialArtsDie from class features', async () => {
      const ps = makePlayerStats();
      classFeatures.getClassFeatures.mockReturnValue({ martialArtsDie: 8 });

      const result = await handle(makeMonkAction(), ps, campaignName, null);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d8');
      expect(result.payload.formula).toBe('1d8 + 2');
    });

    it('defaults to d4 when class features returns null', async () => {
      const ps = makePlayerStats();
      classFeatures.getClassFeatures.mockReturnValue(null);

      const result = await handle(makeMonkAction(), ps, campaignName, null);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d4');
      expect(result.payload.formula).toBe('1d4 + 2');
    });
  });

  describe('healing bonus weaving', () => {
    it('weaves resolveHealingBonusesWithDetails into formula, bonus and healAmount', async () => {
      const ps = makePlayerStats({ abilities: [{ name: 'Wisdom', bonus: 3 }] });
      automationService.resolveHealingBonusesWithDetails.mockReturnValue({
        totalBonus: 2,
        details: [{ name: 'Disciple of Life', amount: 2 }],
      });

      const result = await handle(makeMonkAction(), ps, campaignName, null);

      expect(result.payload.formula).toBe('1d6 + 3 + 2');
      expect(result.payload.bonus).toBe(5);
      expect(result.payload.healAmount).toBe(10); // roll 5 + WIS 3 + bonus 2
    });

    it('delegates Fortified Health marking when details carry it, and only then', async () => {
      const ps = makePlayerStats();

      await handle(makeMonkAction(), ps, campaignName, null);
      expect(automationService.markFortifiedHealthUsed).not.toHaveBeenCalled();

      automationService.resolveHealingBonusesWithDetails.mockReturnValue({
        totalBonus: 0,
        details: [{ name: 'Fortified Health' }],
      });
      await handle(makeMonkAction(), ps, campaignName, null);
      expect(automationService.markFortifiedHealthUsed).toHaveBeenCalledWith(ps, campaignName);
    });
  });

  describe("Physician's Touch", () => {
    it('flags hasPhysiciansTouch true when the feature is present', async () => {
      const ps = makePlayerStats({ specialActions: [{ name: "Physician's Touch" }] });

      const result = await handle(makeMonkAction(), ps, campaignName, null);

      expect(result.payload.hasPhysiciansTouch).toBe(true);
    });

    it('flags hasPhysiciansTouch false when the feature is absent', async () => {
      const ps = makePlayerStats({ specialActions: [{ name: 'Step of the Wind' }] });

      const result = await handle(makeMonkAction(), ps, campaignName, null);

      expect(result.payload.hasPhysiciansTouch).toBe(false);
    });
  });
});
