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

describe('healingHandler battle medic', () => {
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
    targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'TestHealer' } });
    runtimeState.getRuntimeValue.mockReturnValue(undefined);
    restRules.getHitDieSize.mockReturnValue(8);
  });

  describe('requiresHealersKit', () => {
    it('should return popup error when no Healer\'s Kit in inventory', async () => {
      const ps = makePlayerStats({
        inventory: { equipped: ['Longsword'], backpack: ['Scrolls'] },
      });
      const action = makeBattleMedicAction();
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Ally' } });

      const result = await handle(action, ps, campaignName, null, []);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain("Healer's Kit");
    });

    it('should succeed when Healer\'s Kit is in equipped', async () => {
      const ps = makePlayerStats({
        inventory: { equipped: ["Healer's Kit"], backpack: [] },
      });
      const action = makeBattleMedicAction();
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Ally' } });
      runtimeState.getRuntimeValue.mockReturnValue(2);
      restRules.getHitDieSize.mockReturnValue(8);
      diceRoller.rollExpression.mockReturnValue({ total: 8, rolls: [8], modifier: 0 });
      healingRoll.applyHealingDirectly.mockReturnValue({ newHp: 18, maxHp: 20, actualHeal: 11 });

      const result = await handle(action, ps, campaignName, null, [
        { name: 'Ally', computedStats: { class: { hit_point_die: 'd8' } } },
      ]);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('1d8');
      expect(result.payload.description).toContain('= 11');
    });

    it('should succeed when Healer\'s Kit is in backpack', async () => {
      const ps = makePlayerStats({
        inventory: { equipped: [], backpack: ["Healer's Kit"] },
      });
      const action = makeBattleMedicAction();
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Ally' } });
      runtimeState.getRuntimeValue.mockReturnValue(1);
      healingRoll.applyHealingDirectly.mockReturnValue({ newHp: 12, maxHp: 20, actualHeal: 9 });

      await handle(action, ps, campaignName, null, [
        { name: 'Ally', computedStats: { class: { hit_point_die: 'd6' } } },
      ]);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Ally',
        'shortRestHitDice',
        0,
        campaignName,
        true,
      );
    });

    it('should return popup error when target has no hit dice remaining', async () => {
      const ps = makePlayerStats({
        inventory: { equipped: ["Healer's Kit"], backpack: [] },
      });
      const action = makeBattleMedicAction();
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Ally' } });
      runtimeState.getRuntimeValue.mockReturnValue(0);

      const result = await handle(action, ps, campaignName, null, [
        { name: 'Ally', computedStats: { class: { hit_point_die: 'd8' } } },
      ]);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('no hit dice remaining');
    });

    it('should use target\'s hit die size from characters array', async () => {
      const ps = makePlayerStats({
        inventory: { equipped: ["Healer's Kit"], backpack: [] },
      });
      const action = makeBattleMedicAction();
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Ally' } });
      runtimeState.getRuntimeValue.mockReturnValue(3);
      restRules.getHitDieSize.mockReturnValue(10);
      diceRoller.rollExpression.mockReturnValue({ total: 7, rolls: [7], modifier: 0 });
      healingRoll.applyHealingDirectly.mockReturnValue({ newHp: 20, maxHp: 20, actualHeal: 10 });

      const characters = makeCharacters('Ally', 10);
      await handle(action, ps, campaignName, null, characters);

      expect(restRules.getHitDieSize).toHaveBeenCalledWith(characters[0].computedStats);
      expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d10');
    });

    it('should apply roll + proficiency_bonus without extra healing bonuses', async () => {
      const ps = makePlayerStats({
        inventory: { equipped: ["Healer's Kit"], backpack: [] },
        proficiency: 4,
      });
      const action = makeBattleMedicAction();
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Ally' } });
      runtimeState.getRuntimeValue.mockReturnValue(2);
      diceRoller.rollExpression.mockReturnValue({ total: 6, rolls: [6], modifier: 0 });
      healingRoll.applyHealingDirectly.mockReturnValue({ newHp: 16, maxHp: 20, actualHeal: 10 });

      const result = await handle(action, ps, campaignName, null, [
        { name: 'Ally', computedStats: { class: { hit_point_die: 'd8' } } },
      ]);

      expect(result.payload.description).toContain('= 10');
      expect(result.payload.description).toContain('1d8 + 4');
    });

    it('should consume target\'s hit die and report remaining', async () => {
      const ps = makePlayerStats({
        inventory: { equipped: ["Healer's Kit"], backpack: [] },
        proficiency: 3,
      });
      const action = makeBattleMedicAction();
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Ally' } });
      runtimeState.getRuntimeValue.mockReturnValue(2);
      restRules.getHitDieSize.mockReturnValue(8);
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
      healingRoll.applyHealingDirectly.mockReturnValue({ newHp: 13, maxHp: 20, actualHeal: 8 });

      const result = await handle(action, ps, campaignName, null, [
        { name: 'Ally', computedStats: { class: { hit_point_die: 'd8' } } },
      ]);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Ally',
        'shortRestHitDice',
        1,
        campaignName,
        true,
      );
      expect(result.payload.description).toContain('1 hit dice remaining');
    });

    it('should use rerollOnes when hasRerollHealingOnes is true', async () => {
      const ps = makePlayerStats({
        inventory: { equipped: ["Healer's Kit"], backpack: [] },
      });
      const action = makeBattleMedicAction();
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Ally' } });
      runtimeState.getRuntimeValue.mockReturnValue(1);
      restRules.getHitDieSize.mockReturnValue(8);
      automationService.hasRerollHealingOnes.mockReturnValue(true);
      diceRoller.rollExpression.mockReturnValue({ total: 7, rolls: [7], modifier: 0 });
      healingRoll.applyHealingDirectly.mockReturnValue({ newHp: 10, maxHp: 20, actualHeal: 10 });

      await handle(action, ps, campaignName, null, [
        { name: 'Ally', computedStats: { class: { hit_point_die: 'd8' } } },
      ]);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d8', { rerollOnes: true });
      expect(diceRoller.rollExpressionMaximized).not.toHaveBeenCalled();
    });

    it('should use rollExpressionMaximized when hasHealingMaximization is true', async () => {
      const ps = makePlayerStats({
        inventory: { equipped: ["Healer's Kit"], backpack: [] },
      });
      const action = makeBattleMedicAction();
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Ally' } });
      runtimeState.getRuntimeValue.mockReturnValue(1);
      automationService.hasHealingMaximizationForTarget.mockReturnValue(true);
      diceRoller.rollExpressionMaximized.mockReturnValue({ total: 8, rolls: [8], modifier: 0 });
      healingRoll.applyHealingDirectly.mockReturnValue({ newHp: 11, maxHp: 20, actualHeal: 11 });

      await handle(action, ps, campaignName, null, [
        { name: 'Ally', computedStats: { class: { hit_point_die: 'd8' } } },
      ]);

      expect(diceRoller.rollExpressionMaximized).toHaveBeenCalledWith('1d8');
      expect(diceRoller.rollExpression).not.toHaveBeenCalled();
    });

    it('should handle already at full HP', async () => {
      const ps = makePlayerStats({
        inventory: { equipped: ["Healer's Kit"], backpack: [] },
        proficiency: 3,
      });
      const action = makeBattleMedicAction();
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Ally' } });
      runtimeState.getRuntimeValue.mockReturnValue(1);
      diceRoller.rollExpression.mockReturnValue({ total: 4, rolls: [4], modifier: 0 });
      healingRoll.applyHealingDirectly.mockReturnValue({ newHp: 20, maxHp: 20, actualHeal: 0 });

      const result = await handle(action, ps, campaignName, null, [
        { name: 'Ally', computedStats: { class: { hit_point_die: 'd8' } } },
      ]);

      expect(result.payload.description).toContain('Already at full HP');
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Ally',
        'shortRestHitDice',
        0,
        campaignName,
        true,
      );
    });

    it('should log to SSE with correct details', async () => {
      const ps = makePlayerStats({
        inventory: { equipped: ["Healer's Kit"], backpack: [] },
        proficiency: 3,
      });
      const action = makeBattleMedicAction();
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Ally' } });
      runtimeState.getRuntimeValue.mockReturnValue(2);
      restRules.getHitDieSize.mockReturnValue(8);
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
      healingRoll.applyHealingDirectly.mockReturnValue({ newHp: 13, maxHp: 20, actualHeal: 8 });

      await handle(action, ps, campaignName, null, [
        { name: 'Ally', computedStats: { class: { hit_point_die: 'd8' } } },
      ]);

      expect(healingRoll.logHealingToSSE).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        targetName: 'Ally',
        sourceName: 'Battle Medic',
        actualHeal: 8,
        newHp: 13,
        maxHp: 20,
        rollInfo: '1d8=5 (5)',
        bonusDetails: [],
      }));
    });
  });
});
