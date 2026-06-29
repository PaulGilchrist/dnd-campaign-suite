// @improved-by-ai
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
    targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'TestHealer' } });
    runtimeState.getRuntimeValue.mockReturnValue(undefined);
  });

  // ── Self healing with expression ─────────────────────────────

  describe('self_healing with healExpression', () => {
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

    it('should return automation_info when already at full HP', async () => {
      healingRoll.applyHealingDirectly.mockReturnValue({ newHp: 20, maxHp: 20, actualHeal: 0 });
      const ps = makePlayerStats();
      const action = makeAction({ healExpression: '1d4' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
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

    // Fix: capture result for assertion in next test
    it('should decrement uses and report no uses remaining when depleted', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(1);
      const ps = makePlayerStats();
      const action = makeAction({ healExpression: '1d4', uses: 1 });

      const result = await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestHealer',
        'healingtouchUses',
        0,
        campaignName,
        true,
      );
      expect(result.payload.description).toContain('no uses remaining');
    });

    it('should return automation_info when no uses remaining', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(0);
      const ps = makePlayerStats();
      const action = makeAction({ healExpression: '1d4', uses: 1 });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('no uses remaining');
      expect(result.payload.description).toContain('Short Rest');
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

    it('should use _trackedResources max when available', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(5);
      const ps = makePlayerStats({
        _trackedResources: {
          HealingTouchUses: { max: 5 },
        },
      });
      const action = makeAction({ healExpression: '1d4', uses: 1 });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('4 uses remaining');
    });

    it('should use usesMax when provided', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(2);
      const ps = makePlayerStats();
      const action = makeAction({
        healExpression: '1d4',
        usesMax: 3,
      });

      await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestHealer',
        'healingtouchUses',
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

    it('should pass slotLevel to resolveHealingBonuses', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        healExpression: '1d4',
        slotLevel: 3,
      });

      await handle(action, ps, campaignName, null);

      expect(automationService.resolveHealingBonuses).toHaveBeenCalledWith(
        expect.objectContaining({ level: 5 }),
        3,
        5,
        3,
      );
    });
  });

  // ── Hit die roll ─────────────────────────────────────────────

  describe('self_healing with hit_die_roll', () => {
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

    it('should skip hit dice balance check when hitDiceCost is 0', async () => {
      restRules.getHitDieSize.mockReturnValue(8);
      restRules.computeHitDieRecovery.mockReturnValue(4);
      diceRoller.rollExpression.mockReturnValue({ total: 3, rolls: [3], modifier: 0 });

      const ps = makePlayerStats();
      const action = makeAction({
        healExpression: 'hit_die_roll',
        hitDiceCost: 0,
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(restRules.getHitDieSize).toHaveBeenCalledWith(
        expect.objectContaining({ level: 5 }),
      );
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith(
        'TestHealer',
        'shortRestHitDice',
        expect.any(Number),
        campaignName,
        true,
      );
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

    it('should default CON bonus to 0 when no Constitution ability', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(2);
      restRules.getHitDieSize.mockReturnValue(8);
      restRules.computeHitDieRecovery.mockReturnValue(4);
      diceRoller.rollExpression.mockReturnValue({ total: 3, rolls: [3], modifier: 0 });

      const ps = makePlayerStats({ abilities: [] });
      const action = makeAction({
        healExpression: 'hit_die_roll',
        hitDiceCost: 1,
      });

      await handle(action, ps, campaignName, null);

      expect(restRules.computeHitDieRecovery).toHaveBeenCalledWith(3, 0);
    });
  });

  // ── Bloodied only ────────────────────────────────────────────

  describe('self_healing with bloodiedOnly', () => {
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

    it('should allow when at exactly half HP', async () => {
      const ps = makePlayerStats({ currentHitPoints: 10, maxHitPoints: 20 });
      const action = makeAction({
        healExpression: '1d4',
        bloodiedOnly: true,
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
    });

    it('should allow when below half HP', async () => {
      const ps = makePlayerStats({ currentHitPoints: 5, maxHitPoints: 20 });
      const action = makeAction({
        healExpression: '1d4',
        bloodiedOnly: true,
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
    });

    it('should block when HP is zero', async () => {
      const ps = makePlayerStats({ currentHitPoints: 0, maxHitPoints: 20 });
      const action = makeAction({
        healExpression: '1d4',
        bloodiedOnly: true,
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Bloodied');
    });

    it('should block when HP exceeds max (edge case)', async () => {
      const ps = makePlayerStats({ currentHitPoints: 25, maxHitPoints: 20 });
      const action = makeAction({
        healExpression: '1d4',
        bloodiedOnly: true,
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Bloodied');
    });
  });

  // ── Maximization and reroll ──────────────────────────────────

  describe('maximization and reroll behavior', () => {
    it('should use rollExpressionMaximized when hasHealingMaximization', async () => {
      automationService.hasHealingMaximization.mockReturnValue(true);
      diceRoller.rollExpressionMaximized.mockReturnValue({ total: 8, rolls: [8], modifier: 0 });

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

    it('should prefer maximize over rerollOnes when both are true', async () => {
      automationService.hasHealingMaximization.mockReturnValue(true);
      automationService.hasRerollHealingOnes.mockReturnValue(true);
      diceRoller.rollExpressionMaximized.mockReturnValue({ total: 8, rolls: [8], modifier: 0 });

      const ps = makePlayerStats();
      const action = makeAction({ healExpression: '1d6' });

      await handle(action, ps, campaignName, null);

      expect(diceRoller.rollExpressionMaximized).toHaveBeenCalledWith('1d6');
      expect(diceRoller.rollExpression).not.toHaveBeenCalled();
    });

    it('should use normal rollExpression when neither flag is set', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ healExpression: '1d6' });

      await handle(action, ps, campaignName, null);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d6');
      expect(diceRoller.rollExpressionMaximized).not.toHaveBeenCalled();
    });
  });

  // ── Uses-based non-self healing ──────────────────────────────

  describe('uses-based non-self healing', () => {
    it('should resolve target and return automation_info when uses available', async () => {
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

    it('should return automation_info when uses depleted', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(0);

      const ps = makePlayerStats();
      const action = makeAction({
        uses: 1,
        healExpression: '2d4',
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('no uses remaining');
    });

    it('should return healing popup when no uses field and no healExpression for self_healing', async () => {
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'TestHealer' } });

      const ps = makePlayerStats();
      const action = makeAction({
        uses: 1,
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('healing');
    });

    it('should report Short Rest recharge for self_healing when uses depleted', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(0);

      const ps = makePlayerStats();
      const action = makeAction({
        uses: 1,
        healExpression: '2d4',
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('Short Rest');
    });
  });

  // ── healAmount number path (no uses field) ───────────────────

  describe('healAmount number (no uses)', () => {
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

    it('should include bonus HP in description when resolveHealingBonuses > 0', async () => {
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

    it('should return expression string when healAmount is not a number and no uses', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Cure Wounds',
        automation: {
          type: 'reaction',
          healAmount: '1d8',
          healExpression: '1d8',
        },
      };

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.type).toBe('healing');
      expect(result.payload.healAmount).toBe('1d8');
    });

    it('should add bonus to number healAmount', async () => {
      automationService.resolveHealingBonuses.mockReturnValue(3);
      const ps = makePlayerStats();
      const action = {
        name: 'Lay on Hands',
        automation: {
          type: 'reaction',
          healAmount: 5,
        },
      };

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.healAmount).toBe(8);
      expect(result.payload.description).toContain('+ 3 bonus HP');
    });
  });

  // ── Monk healing ─────────────────────────────────────────────

  describe('monk healing (martial_arts_die + WIS)', () => {
    it('should return handOfHealing modal when expression includes martial_arts_die and WIS', async () => {
      const ps = makePlayerStats({
        abilities: [{ name: 'Wisdom', bonus: 3 }],
      });
      const action = makeAction({
        healExpression: 'martial_arts_die + WIS',
      });

      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('handOfHealing');
      expect(result.payload.monkName).toBe('TestHealer');
      expect(result.payload.bonus).toBe(3);
    });

    it('should default Wisdom modifier to 0 when no WIS ability', async () => {
      const ps = makePlayerStats({ abilities: [] });
      const action = makeAction({
        healExpression: 'martial_arts_die + WIS',
      });

      diceRoller.rollExpression.mockReturnValue({ total: 4, rolls: [4], modifier: 0 });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.payload.bonus).toBe(0);
    });

    it('should use martialArtsDie from class features or default to 4', async () => {
      const ps = makePlayerStats({
        abilities: [{ name: 'Wisdom', bonus: 2 }],
      });
      const action = makeAction({
        healExpression: 'martial_arts_die + WIS',
      });

      classFeatures.getClassFeatures.mockReturnValue({ martialArtsDie: 8 });
      diceRoller.rollExpression.mockReturnValue({ total: 8, rolls: [8], modifier: 0 });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.formula).toContain('1d8');
    });

    it('should return null when rollExpression returns null', async () => {
      const ps = makePlayerStats({
        abilities: [{ name: 'Wisdom', bonus: 2 }],
      });
      const action = makeAction({
        healExpression: 'martial_arts_die + WIS',
      });

      diceRoller.rollExpression.mockReturnValue(null);

      const result = await handle(action, ps, campaignName, null);

      expect(result).toBeNull();
    });

    it('should include bonus in formula when resolveHealingBonuses > 0', async () => {
      const ps = makePlayerStats({
        abilities: [{ name: 'Wisdom', bonus: 3 }],
      });
      const action = makeAction({
        healExpression: 'martial_arts_die + WIS',
      });

      classFeatures.getClassFeatures.mockReturnValue({ martialArtsDie: 6 });
      diceRoller.rollExpression.mockReturnValue({ total: 6, rolls: [6], modifier: 0 });
      automationService.resolveHealingBonuses.mockReturnValue(2);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.formula).toContain('+ 2');
      expect(result.payload.bonus).toBe(5);
    });

    it('should pass rerollOnes to modal payload when set and not maximizing', async () => {
      const ps = makePlayerStats({
        abilities: [{ name: 'Wisdom', bonus: 2 }],
      });
      const action = makeAction({
        healExpression: 'martial_arts_die + WIS',
      });

      classFeatures.getClassFeatures.mockReturnValue({ martialArtsDie: 6 });
      diceRoller.rollExpression.mockReturnValue({ total: 6, rolls: [6], modifier: 0 });
      automationService.hasRerollHealingOnes.mockReturnValue(true);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.rerollOnes).toBe(true);
    });

    it('should set rerollOnes to false when maximizing', async () => {
      const ps = makePlayerStats({
        abilities: [{ name: 'Wisdom', bonus: 2 }],
      });
      const action = makeAction({
        healExpression: 'martial_arts_die + WIS',
      });

      classFeatures.getClassFeatures.mockReturnValue({ martialArtsDie: 6 });
      diceRoller.rollExpressionMaximized.mockReturnValue({ total: 6, rolls: [6], modifier: 0 });
      automationService.hasHealingMaximization.mockReturnValue(true);
      automationService.hasRerollHealingOnes.mockReturnValue(true);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.rerollOnes).toBe(false);
    });

    it('should include targetName and HP info in modal payload', async () => {
      const ps = makePlayerStats({
        abilities: [{ name: 'Wisdom', bonus: 2 }],
      });
      const action = makeAction({
        healExpression: 'martial_arts_die + WIS',
      });

      classFeatures.getClassFeatures.mockReturnValue({ martialArtsDie: 6 });
      diceRoller.rollExpression.mockReturnValue({ total: 6, rolls: [6], modifier: 0 });
      healingRoll.applyHealingDirectly.mockReturnValue({ newHp: 18, maxHp: 20, actualHeal: 8 });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.targetName).toBe('TestHealer');
      expect(result.payload.targetCurrentHp).toBe(18);
      expect(result.payload.targetMaxHp).toBe(20);
    });
  });

  // ── Logging ──────────────────────────────────────────────────

  describe('SSE logging', () => {
    it('should call logHealingToSSE with correct payload for self_healing', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ healExpression: '1d4' });

      await handle(action, ps, campaignName, null);

      expect(healingRoll.logHealingToSSE).toHaveBeenCalledWith(campaignName, {
        targetName: 'TestHealer',
        sourceName: 'Healing Touch',
        actualHeal: 5,
        newHp: 15,
        maxHp: 20,
        rollInfo: '1d4=5 (5)',
        maximize: false,
        healingName: 'Healing Touch',
        remainingUses: 0,
        maxUses: 1,
      });
    });

    it('should call logHealingToSSE with correct payload for monk healing', async () => {
      const ps = makePlayerStats({
        abilities: [{ name: 'Wisdom', bonus: 2 }],
      });
      const action = makeAction({ healExpression: 'martial_arts_die + WIS' });

      classFeatures.getClassFeatures.mockReturnValue({ martialArtsDie: 6 });
      diceRoller.rollExpression.mockReturnValue({ total: 6, rolls: [6], modifier: 0 });
      healingRoll.applyHealingDirectly.mockReturnValue({ newHp: 16, maxHp: 20, actualHeal: 8 });

      await handle(action, ps, campaignName, null);

      expect(healingRoll.logHealingToSSE).toHaveBeenCalledWith(campaignName, {
        targetName: 'TestHealer',
        sourceName: 'Healing Touch',
        actualHeal: 8,
        newHp: 16,
        maxHp: 20,
        rollInfo: '1d6=6 (6)',
        maximize: false,
        healingName: 'Healing Touch',
      });
    });
  });

  // ── Physician's Touch ────────────────────────────────────────

  describe("Physician's Touch feature", () => {
    it('should include hasPhysiciansTouch in modal payload when feature exists', async () => {
      const ps = makePlayerStats({
        abilities: [{ name: 'Wisdom', bonus: 2 }],
        characterAdvancement: [{ name: "Physician's Touch" }],
      });
      const action = makeAction({ healExpression: 'martial_arts_die + WIS' });

      classFeatures.getClassFeatures.mockReturnValue({ martialArtsDie: 6 });
      diceRoller.rollExpression.mockReturnValue({ total: 6, rolls: [6], modifier: 0 });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.hasPhysiciansTouch).toBe(true);
    });

    it('should set hasPhysiciansTouch to false when feature absent', async () => {
      const ps = makePlayerStats({
        abilities: [{ name: 'Wisdom', bonus: 2 }],
        characterAdvancement: [{ name: 'Other Feature' }],
      });
      const action = makeAction({ healExpression: 'martial_arts_die + WIS' });

      classFeatures.getClassFeatures.mockReturnValue({ martialArtsDie: 6 });
      diceRoller.rollExpression.mockReturnValue({ total: 6, rolls: [6], modifier: 0 });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.hasPhysiciansTouch).toBe(false);
    });
  });
});
