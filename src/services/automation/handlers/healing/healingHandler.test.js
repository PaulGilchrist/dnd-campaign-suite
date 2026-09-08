// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
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

// ── Tests ──────────────────────────────────────────────────────

describe('healingHandler self_healing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDefaultBehavior();
    runtimeState.getRuntimeValue.mockReturnValue(undefined);
  });

  // ── Self healing with expression ─────────────────────────────

  describe('healExpression', () => {
    it('should return automation_info popup with healing result', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        healExpression: '1d4+2',
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Healing Touch');
      expect(result.payload.automationType).toBe('self_healing');
      expect(result.payload.description).toContain('Regained 5 HP');
    });

    it('should report "Already at full HP" when target is at max HP', async () => {
      healingRoll.applyHealingDirectly.mockReturnValue({ newHp: 20, maxHp: 20, actualHeal: 0 });
      const ps = makePlayerStats();
      const action = makeAction({ healExpression: '1d4' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('Already at full HP');
    });

    it('should decrement uses and report remaining uses', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(3);
      const ps = makePlayerStats();
      const action = makeAction({ healExpression: '1d4', uses: 3 });

      const result = await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestHealer',
        'healingtouchUses',
        2,
        campaignName,
        true,
      );
      expect(result.payload.description).toContain('2 uses remaining');
    });

    it('should block when no uses remaining and report recharge type', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(0);
      const ps = makePlayerStats();
      const action = makeAction({ healExpression: '1d4', uses: 1 });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('no uses remaining');
      expect(result.payload.description).toContain('Short Rest');
    });

    it('should report Long Rest when recharge is long_rest', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(0);
      const ps = makePlayerStats();
      const action = {
        name: 'Lay on Hands',
        automation: {
          type: 'self_healing',
          healExpression: '1d4',
          uses: 1,
          recharge: 'long_rest',
        },
      };

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('Long Rest');
      expect(result.payload.description).not.toContain('Short Rest');
    });

    it('should use resourceKey when provided', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(2);
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
    });

    it('should replace fighter level in expression', async () => {
      const ps = makePlayerStats({ level: 7 });
      const action = makeAction({
        healExpression: '1d4 + fighter level',
      });

      await handle(action, ps, campaignName, null);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d4 + 7');
    });

    it('should replace fighter level with 1 when level is missing', async () => {
      const ps = makePlayerStats({ level: undefined });
      const action = makeAction({
        healExpression: '1d4 + fighter level',
      });

      await handle(action, ps, campaignName, null);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d4 + 1');
    });
  });

  // ── Hit die roll ─────────────────────────────────────────────

  describe('hit_die_roll', () => {
    it('should block when insufficient hit dice', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(1);
      restRules.getHitDieSize.mockReturnValue(8);
      restRules.computeHitDieRecovery.mockReturnValue(5);

      const ps = makePlayerStats();
      const action = makeAction({
        healExpression: 'hit_die_roll',
        hitDiceCost: 3,
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('requires 3 hit die');
      expect(result.payload.description).toContain('1 remaining');
    });

    it('should allow when sufficient hit dice available', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(3);
      restRules.getHitDieSize.mockReturnValue(8);
      restRules.computeHitDieRecovery.mockReturnValue(5);
      diceRoller.rollExpression.mockReturnValue({ total: 6, rolls: [6], modifier: 0 });

      const ps = makePlayerStats({
        abilities: [{ name: 'Constitution', bonus: 2 }],
      });
      const action = makeAction({
        healExpression: 'hit_die_roll',
        hitDiceCost: 1,
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(restRules.computeHitDieRecovery).toHaveBeenCalledWith(6, 2);
      expect(result.payload.description).toContain('2 hit dice');
    });

    it('should decrement hit dice after healing', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(2);
      restRules.getHitDieSize.mockReturnValue(8);
      restRules.computeHitDieRecovery.mockReturnValue(5);
      diceRoller.rollExpression.mockReturnValue({ total: 4, rolls: [4], modifier: 0 });

      const ps = makePlayerStats();
      const action = makeAction({
        healExpression: 'hit_die_roll',
        hitDiceCost: 1,
      });

      await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestHealer',
        'shortRestHitDice',
        1,
        campaignName,
        true,
      );
    });

    it('should not decrement a generic uses key for hit_die_roll', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(2);
      restRules.getHitDieSize.mockReturnValue(8);
      restRules.computeHitDieRecovery.mockReturnValue(5);
      diceRoller.rollExpression.mockReturnValue({ total: 4, rolls: [4], modifier: 0 });

      const ps = makePlayerStats();
      const action = makeAction({
        healExpression: 'hit_die_roll',
        hitDiceCost: 1,
      });

      await handle(action, ps, campaignName, null);

      const setRuntimeCalls = runtimeState.setRuntimeValue.mock.calls;
      const usesKeyCalls = setRuntimeCalls.filter(call => call[1] !== 'shortRestHitDice');
      expect(usesKeyCalls).toHaveLength(0);
    });

    it('should use Constitution bonus for hit die recovery', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(2);
      restRules.getHitDieSize.mockReturnValue(10);
      restRules.computeHitDieRecovery.mockReturnValue(7);
      diceRoller.rollExpression.mockReturnValue({ total: 6, rolls: [6], modifier: 0 });

      const ps = makePlayerStats({
        abilities: [{ name: 'Constitution', bonus: 3 }],
      });
      const action = makeAction({
        healExpression: 'hit_die_roll',
        hitDiceCost: 1,
      });

      await handle(action, ps, campaignName, null);

      expect(restRules.computeHitDieRecovery).toHaveBeenCalledWith(6, 3);
    });

    it('should allow multiple uses as long as hit dice remain', async () => {
      restRules.getHitDieSize.mockReturnValue(8);
      restRules.computeHitDieRecovery.mockReturnValue(5);
      diceRoller.rollExpression.mockReturnValue({ total: 4, rolls: [4], modifier: 0 });

      const ps = makePlayerStats();
      const action = makeAction({
        healExpression: 'hit_die_roll',
        hitDiceCost: 1,
      });

      runtimeState.getRuntimeValue.mockImplementation((playerName, key) => {
        if (key === 'shortRestHitDice') return 2;
        return undefined;
      });

      const result1 = await handle(action, ps, campaignName, null);
      expect(result1.type).toBe('popup');
      expect(result1.payload.description).toContain('1 hit dice');

      runtimeState.getRuntimeValue.mockImplementation((playerName, key) => {
        if (key === 'shortRestHitDice') return 1;
        return undefined;
      });

      const result2 = await handle(action, ps, campaignName, null);
      expect(result2.type).toBe('popup');
      expect(result2.payload.description).toContain('0 hit dice');
    });
  });

  // ── Bloodied only ────────────────────────────────────────────

  describe('bloodiedOnly', () => {
    it('should block when above half HP', async () => {
      const ps = makePlayerStats({ currentHitPoints: 15, maxHitPoints: 20 });
      const action = makeAction({
        healExpression: '1d4',
        bloodiedOnly: true,
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Bloodied');
    });

    it('should allow when at or below half HP', async () => {
      const ps = makePlayerStats({ currentHitPoints: 10, maxHitPoints: 20 });
      const action = makeAction({
        healExpression: '1d4',
        bloodiedOnly: true,
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
    });

    it('should allow when at exactly floor(maxHp/2)', async () => {
      const ps = makePlayerStats({ currentHitPoints: 7, maxHitPoints: 15 });
      const action = makeAction({
        healExpression: '1d4',
        bloodiedOnly: true,
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
    });
  });

  // ── Maximization and reroll ──────────────────────────────────

  describe('maximization and reroll', () => {
    beforeEach(() => {
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
      diceRoller.rollExpressionMaximized.mockReturnValue({ total: 8, rolls: [8], modifier: 0 });
      automationService.hasHealingMaximizationForTarget.mockReturnValue(false);
      automationService.hasRerollHealingOnes.mockReturnValue(false);
    });

    it('should use rollExpressionMaximized when hasHealingMaximization', async () => {
      automationService.hasHealingMaximizationForTarget.mockReturnValue(true);

      const ps = makePlayerStats();
      const action = makeAction({ healExpression: '1d6' });

      await handle(action, ps, campaignName, null);

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

  // ── Uses tracking edge cases ─────────────────────────────────

  describe('uses tracking edge cases', () => {
    it('should use auto.uses as default when no runtime value and no _trackedResources', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(undefined);
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
  });
});
