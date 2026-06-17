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
  hasHealingMaximization: vi.fn(),
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
import * as classFeatures from '../../../character/classFeatures.js';
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
    proficiencyBonus: 3,
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

// ── Tests ──────────────────────────────────────────────────────

describe('healingHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
    diceRoller.rollExpressionMaximized.mockReturnValue({ total: 8, rolls: [8], modifier: 0 });
    automationService.resolveHealingBonuses.mockReturnValue(0);
    automationService.hasHealingMaximization.mockReturnValue(false);
    automationService.hasRerollHealingOnes.mockReturnValue(false);
    healingRoll.applyHealingDirectly.mockReturnValue({ newHp: 15, maxHp: 20, actualHeal: 5 });
    classFeatures.getClassFeatures.mockReturnValue({ martialArtsDie: 6 });
    targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Ally' } });
  });

  describe('Self healing - basic', () => {
    it('should return popup with automation_info for self healing', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        type: 'self_healing',
        healExpression: '1d4+2',
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('Regained 5 HP');
    });

    it('should decrement uses after healing', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(1);
      const ps = makePlayerStats();
      const action = makeAction({
        type: 'self_healing',
        healExpression: '1d4',
        uses: 1,
      });

      await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestHealer',
        'healingtouchUses',
        0,
        campaignName,
        true,
      );
    });

    it('should return popup when no uses remaining', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(0);
      const ps = makePlayerStats();
      const action = makeAction({
        type: 'self_healing',
        healExpression: '1d4',
        uses: 1,
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('no uses remaining');
    });
  });

  describe('Self healing - hit die roll', () => {
    it('should check hit dice cost before rolling', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(1);
      restRules.getHitDieSize.mockReturnValue(8);
      restRules.computeHitDieRecovery.mockReturnValue(5);

      const ps = makePlayerStats();
      const action = makeAction({
        type: 'self_healing',
        healExpression: 'hit_die_roll',
        hitDiceCost: 3,
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('requires 3 hit die');
    });

    it('should use hit die size and CON bonus for healing', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(2);
      restRules.getHitDieSize.mockReturnValue(10);
      restRules.computeHitDieRecovery.mockReturnValue(7);
      diceRoller.rollExpression.mockReturnValue({ total: 6, rolls: [6], modifier: 0 });

      const ps = makePlayerStats({
        abilities: [{ name: 'Constitution', bonus: 1 }],
      });
      const action = makeAction({
        type: 'self_healing',
        healExpression: 'hit_die_roll',
        hitDiceCost: 1,
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(restRules.computeHitDieRecovery).toHaveBeenCalledWith(6, 1);
    });

    it('should decrement hit dice after healing', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(2);
      restRules.getHitDieSize.mockReturnValue(8);
      restRules.computeHitDieRecovery.mockReturnValue(5);
      diceRoller.rollExpression.mockReturnValue({ total: 4, rolls: [4], modifier: 0 });

      const ps = makePlayerStats();
      const action = makeAction({
        type: 'self_healing',
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
  });

  describe('Self healing - bloodied only', () => {
    it('should return popup when not bloodied', async () => {
      const ps = makePlayerStats({ currentHitPoints: 15, maxHitPoints: 20 });
      const action = makeAction({
        type: 'self_healing',
        healExpression: '1d4',
        bloodiedOnly: true,
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Bloodied');
    });

    it('should proceed when bloodied (at half HP or less)', async () => {
      const ps = makePlayerStats({ currentHitPoints: 10, maxHitPoints: 20 });
      const action = makeAction({
        type: 'self_healing',
        healExpression: '1d4',
        bloodiedOnly: true,
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
    });

    it('should proceed when below half HP', async () => {
      const ps = makePlayerStats({ currentHitPoints: 5, maxHitPoints: 20 });
      const action = makeAction({
        type: 'self_healing',
        healExpression: '1d4',
        bloodiedOnly: true,
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
    });
  });

  describe('Self healing - maximize and reroll', () => {
    it('should use rollExpressionMaximized when hasHealingMaximization', async () => {
      automationService.hasHealingMaximization.mockReturnValue(true);
      diceRoller.rollExpressionMaximized.mockReturnValue({ total: 8, rolls: [8], modifier: 0 });

      const ps = makePlayerStats();
      const action = makeAction({
        type: 'self_healing',
        healExpression: '1d6',
      });

      await handle(action, ps, campaignName, null);

      expect(diceRoller.rollExpressionMaximized).toHaveBeenCalledWith('1d6');
    });

    it('should use rollExpression with rerollOnes when hasRerollHealingOnes', async () => {
      automationService.hasRerollHealingOnes.mockReturnValue(true);
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });

      const ps = makePlayerStats();
      const action = makeAction({
        type: 'self_healing',
        healExpression: '1d6',
      });

      await handle(action, ps, campaignName, null);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d6', { rerollOnes: true });
    });
  });

  describe('Uses-based healing (non-self)', () => {
    it('should resolve target and heal when uses available', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(1);
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Ally' } });

      const ps = makePlayerStats();
      const action = makeAction({
        uses: 1,
        healExpression: '2d4',
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
    });

    it('should return popup when uses depleted', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(0);

      const ps = makePlayerStats();
      const action = makeAction({
        uses: 1,
        healExpression: '2d4',
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('no uses remaining');
    });

    it('should return healing popup when no uses field and no healExpression for self', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        uses: 1,
      });

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'TestHealer' } });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
    });
  });



  describe('Non-healing popup (healAmount number)', () => {
    it('should return healing popup with healAmount number', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Stabilize',
        automation: {
          type: 'reaction',
          healAmount: 1,
        },
      };

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('healing');
      expect(result.payload.healAmount).toBe(1);
    });

    it('should include bonus HP in description when bonusHeal > 0', async () => {
      automationService.resolveHealingBonuses.mockReturnValue(2);
      const ps = makePlayerStats();
      const action = {
        name: 'Stabilize',
        automation: {
          type: 'reaction',
          healAmount: 1,
        },
      };

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('+ 2 bonus HP');
    });
  });

  describe('Monk healing', () => {
    it('should handle monk healing when expression includes martial_arts_die and WIS', async () => {
      const ps = makePlayerStats({
        abilities: [{ name: 'Wisdom', bonus: 3 }],
      });
      const action = makeAction({
        type: 'self_healing',
        healExpression: 'martial_arts_die + WIS',
      });

      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('handOfHealing');
      expect(result.payload.monkName).toBe('TestHealer');
    });
  });
});
