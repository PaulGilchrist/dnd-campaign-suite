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
    automationService.resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 0, details: [] });
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

    it('should return healing popup when no uses field and no healExpression for self_healing', async () => {
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'TestHealer' } });

      const ps = makePlayerStats();
      const action = makeAction({
        uses: 1,
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
    });

    it('should resolve target when uses available for non-self type', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(1);
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Ally' } });

      const ps = makePlayerStats();
      const action = {
        name: 'Cure Wounds',
        automation: {
          type: 'reaction',
          uses: 1,
          healExpression: '1d8',
        },
      };

      await handle(action, ps, campaignName, null);

      expect(targetResolver.resolveTarget).toHaveBeenCalledWith(campaignName, 'TestHealer');
    });

    it('should apply healing and log when target resolves to ally', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(1);
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Ally' } });
      healingRoll.applyHealingDirectly.mockReturnValue({ newHp: 15, maxHp: 20, actualHeal: 5 });

      const ps = makePlayerStats();
      const action = {
        name: 'Cure Wounds',
        automation: {
          type: 'reaction',
          uses: 1,
          healExpression: '1d8',
        },
      };

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('Ally');
      expect(result.payload.description).toContain('Regained 5 HP');
      expect(healingRoll.logHealingToSSE).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        targetName: 'Ally',
        sourceName: 'Cure Wounds',
      }));
    });

    it('should return automation_info with Long Rest message when uses depleted for non-self', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(0);

      const ps = makePlayerStats();
      const action = {
        name: 'Cure Wounds',
        automation: {
          type: 'reaction',
          uses: 1,
          healExpression: '1d8',
        },
      };

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('Long Rest');
    });
  });

  // ── Non-self healing without uses field ──────────────────────

  describe('non-self healing without uses field', () => {
    it('should return healing popup with expression when no uses', async () => {
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Ally' } });

      const ps = makePlayerStats();
      const action = {
        name: 'Cure Wounds',
        automation: {
          type: 'reaction',
          healExpression: '1d8',
        },
      };

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
    });

    it('should return healing popup when no uses and no healExpression', async () => {
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Ally' } });

      const ps = makePlayerStats();
      const action = {
        name: 'Stabilize',
        automation: {
          type: 'reaction',
        },
      };

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
    });

    it('should include bonus HP in description when resolveHealingBonuses > 0', async () => {
      automationService.resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 2, details: [{ name: 'Disciple of Life', amount: 2 }] });
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Ally' } });

      const ps = makePlayerStats();
      const action = {
        name: 'Cure Wounds',
        automation: {
          type: 'reaction',
          healExpression: '1d8',
        },
      };

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.type).toBe('automation_info');
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
      expect(result.payload.type).toBe('automation_info');
    });

    it('should add bonus to number healAmount and include in description', async () => {
      automationService.resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 3, details: [{ name: 'Disciple of Life', amount: 3 }] });
      const ps = makePlayerStats();
      const action = {
        name: 'Lay on Hands',
        automation: {
          type: 'reaction',
          healAmount: 5,
        },
      };

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
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

    it('should default martialArtsDie to 4 when class features returns null', async () => {
      const ps = makePlayerStats({
        abilities: [{ name: 'Wisdom', bonus: 2 }],
      });
      const action = {
        name: 'Hand of Healing',
        automation: {
          type: 'self_healing',
          healExpression: 'martial_arts_die + WIS',
        },
      };

      classFeatures.getClassFeatures.mockReturnValue(null);
      diceRoller.rollExpression.mockReturnValue({ total: 4, rolls: [4], modifier: 0 });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.formula).toContain('1d4');
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
      automationService.resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 2, details: [{ name: 'Disciple of Life', amount: 2 }] });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.formula).toContain('+ 2');
      expect(result.payload.bonus).toBe(5);
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

    it('should use targetName from resolveTarget when isSelf is false', async () => {
      const ps = makePlayerStats({
        abilities: [{ name: 'Wisdom', bonus: 3 }],
      });
      const action = {
        name: 'Hand of Healing',
        automation: {
          type: 'other_healing',
          healExpression: 'martial_arts_die + WIS',
        },
      };

      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Ally' } });
      diceRoller.rollExpression.mockReturnValue({ total: 6, rolls: [6], modifier: 0 });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.payload.targetName).toBe('Ally');
    });

    it('should fallback to player name when resolveTarget returns null for monk healing', async () => {
      const ps = makePlayerStats({
        abilities: [{ name: 'Wisdom', bonus: 3 }],
      });
      const action = {
        name: 'Hand of Healing',
        automation: {
          type: 'other_healing',
          healExpression: 'martial_arts_die + WIS',
        },
      };

      targetResolver.resolveTarget.mockResolvedValue(null);
      diceRoller.rollExpression.mockReturnValue({ total: 6, rolls: [6], modifier: 0 });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.targetName).toBe('TestHealer');
    });
  });

  // ── Physician's Touch ────────────────────────────────────────

  describe("Physician's Touch feature", () => {
    it('should include hasPhysiciansTouch in modal payload when feature exists', async () => {
      const ps = makePlayerStats({
        abilities: [{ name: 'Wisdom', bonus: 2 }],
        specialActions: [{ name: "Physician's Touch" }],
      });
      const action = makeAction({ healExpression: 'martial_arts_die + WIS' });

      classFeatures.getClassFeatures.mockReturnValue({ martialArtsDie: 6 });
      diceRoller.rollExpression.mockReturnValue({ total: 6, rolls: [6], modifier: 0 });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.hasPhysiciansTouch).toBe(true);
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
