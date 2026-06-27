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

describe('healingHandler - additional coverage', () => {
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

  // ── Non-self monk healing (resolveTarget path) ───────────────

  describe('non-self monk healing (resolveTarget path)', () => {
    it('should call resolveTarget when isSelf is false for monk healing', async () => {
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

      expect(targetResolver.resolveTarget).toHaveBeenCalledWith(campaignName, 'TestHealer');
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

    it('should call logHealingToSSE with non-self target name for monk healing', async () => {
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
      healingRoll.applyHealingDirectly.mockReturnValue({ newHp: 18, maxHp: 20, actualHeal: 9 });

      await handle(action, ps, campaignName, null);

      expect(healingRoll.logHealingToSSE).toHaveBeenCalledWith(campaignName, {
        targetName: 'Ally',
        sourceName: 'Hand of Healing',
        actualHeal: 9,
        newHp: 18,
        maxHp: 20,
      });
    });
  });

  // ── Long rest recharge message ───────────────────────────────

  describe('long rest recharge message', () => {
    it('should report Long Rest when recharge is long_rest on self_healing', async () => {
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

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('Long Rest');
      expect(result.payload.description).not.toContain('Short Rest');
    });
  });

  // ── Uses-based non-self healing with Long Rest recharge ──────

  describe('uses-based non-self healing (not self_healing type)', () => {
    it('should return automation_info with Long Rest message when uses depleted for non-self type', async () => {
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

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('Long Rest');
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

    it('should apply healing when target resolves to self with healExpression', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(1);
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'TestHealer' } });
      diceRoller.rollExpression.mockReturnValue({ total: 7, rolls: [7], modifier: 0 });

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

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('Regained 5 HP');
    });

    it('should decrement uses when target resolves to self with healExpression', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(2);
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'TestHealer' } });
      diceRoller.rollExpression.mockReturnValue({ total: 7, rolls: [7], modifier: 0 });

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

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestHealer',
        'curewoundsUses',
        1,
        campaignName,
      );
    });

    it('should return healing popup when target resolves to ally (not self)', async () => {
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

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('healing');
      expect(result.payload.healAmount).toBe('1d8');
    });

    it('should decrement uses when target resolves to ally', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(2);
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

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestHealer',
        'curewoundsUses',
        1,
        campaignName,
      );
    });

    it('should handle resolveTarget returning null (treat as self)', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(1);
      targetResolver.resolveTarget.mockResolvedValue(null);
      diceRoller.rollExpression.mockReturnValue({ total: 7, rolls: [7], modifier: 0 });

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

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
    });
  });

  // ── Non-self healing without uses field (final else branch) ──

  describe('non-self healing without uses field', () => {
    it('should return healing popup with expression when no uses and no healAmount number', async () => {
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
      expect(result.payload.type).toBe('healing');
      expect(result.payload.healAmount).toBe('1d8');
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
      expect(result.payload.type).toBe('healing');
      expect(result.payload.healAmount).toBe(undefined);
    });

    it('should include bonus HP in description when resolveHealingBonuses > 0 for no-uses path', async () => {
      automationService.resolveHealingBonuses.mockReturnValue(2);
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

      expect(result.payload.description).toContain('+ 2 bonus HP');
    });
  });

  // ── Missing field edge cases ─────────────────────────────────

  describe('missing field edge cases', () => {
    it('should use default level 1 when playerStats.level is missing', async () => {
      automationService.resolveHealingBonuses.mockReturnValue(0);
      const ps = makePlayerStats({ level: undefined });
      const action = makeAction({ healExpression: '1d4' });

      await handle(action, ps, campaignName, null);

      expect(automationService.resolveHealingBonuses).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        1,
        1,
      );
    });

    it('should use default proficiencyBonus 0 when missing', async () => {
      automationService.resolveHealingBonuses.mockReturnValue(0);
      const ps = makePlayerStats({ proficiencyBonus: undefined });
      const action = makeAction({ healExpression: '1d4' });

      await handle(action, ps, campaignName, null);

      expect(automationService.resolveHealingBonuses).toHaveBeenCalledWith(
        expect.anything(),
        0,
        5,
        1,
      );
    });

    it('should use default slotLevel 1 when not provided', async () => {
      automationService.resolveHealingBonuses.mockReturnValue(0);
      const ps = makePlayerStats();
      const action = makeAction({ healExpression: '1d4' });

      await handle(action, ps, campaignName, null);

      expect(automationService.resolveHealingBonuses).toHaveBeenCalledWith(
        expect.anything(),
        3,
        5,
        1,
      );
    });

    it('should handle empty abilities array for non-monk healing', async () => {
      const ps = makePlayerStats({ abilities: [] });
      const action = makeAction({ healExpression: '1d4' });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
    });

    it('should handle empty abilities array for hit_die_roll', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(2);
      classFeatures.getClassFeatures.mockReturnValue({ martialArtsDie: 6 });
      diceRoller.rollExpression.mockReturnValue({ total: 6, rolls: [6], modifier: 0 });
      automationService.resolveHealingBonuses.mockReturnValue(0);
      healingRoll.applyHealingDirectly.mockReturnValue({ newHp: 15, maxHp: 20, actualHeal: 5 });

      const ps = makePlayerStats({ abilities: [] });
      const action = makeAction({
        healExpression: 'hit_die_roll',
        hitDiceCost: 1,
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
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

    it('should handle string uses value from runtime', async () => {
      runtimeState.getRuntimeValue.mockReturnValue('2');
      const ps = makePlayerStats();
      const action = makeAction({ healExpression: '1d4', uses: 5 });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestHealer',
        'healingtouchUses',
        1,
        campaignName,
        true,
      );
    });

    it('should use usesMax from automation when no runtime value', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(undefined);
      const ps = makePlayerStats();
      const action = makeAction({ healExpression: '1d4', usesMax: 3 });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestHealer',
        'healingtouchUses',
        2,
        campaignName,
        true,
      );
    });

    it('should handle usesKey derived from action name with spaces', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(1);
      const ps = makePlayerStats();
      const action = {
        name: 'Healing Touch',
        automation: {
          type: 'self_healing',
          healExpression: '1d4',
        },
      };

      await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestHealer',
        'healingtouchUses',
        0,
        campaignName,
        true,
      );
    });

    it('should handle usesKey derived from action name with multiple spaces', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(1);
      const ps = makePlayerStats();
      const action = {
        name: 'Healing Touch Big',
        automation: {
          type: 'self_healing',
          healExpression: '1d4',
        },
      };

      await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestHealer',
        'healingtouchbigUses',
        0,
        campaignName,
        true,
      );
    });
  });

  // ── Expression resolution ────────────────────────────────────

  describe('expression resolution edge cases', () => {
    it('should replace fighter level with 1 when level is missing', async () => {
      const ps = makePlayerStats({ level: undefined });
      const action = makeAction({
        healExpression: '1d4 + fighter level',
      });

      await handle(action, ps, campaignName, null);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d4 + 1');
    });

    it('should handle healExpression with plus syntax', async () => {
      const ps = makePlayerStats();
      const action = makeAction({
        healExpression: '1d4 plus 2',
      });

      await handle(action, ps, campaignName, null);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d4 plus 2');
    });

    it('should return null when rollExpression returns null for self_healing', async () => {
      diceRoller.rollExpression.mockReturnValue(null);
      const ps = makePlayerStats();
      const action = makeAction({ healExpression: '1d4' });

      const result = await handle(action, ps, campaignName, null);

      expect(result).toBeNull();
    });

    it('should return null when rollExpressionMaximized returns null for self_healing', async () => {
      automationService.hasHealingMaximization.mockReturnValue(true);
      diceRoller.rollExpressionMaximized.mockReturnValue(null);
      const ps = makePlayerStats();
      const action = makeAction({ healExpression: '1d4' });

      const result = await handle(action, ps, campaignName, null);

      expect(result).toBeNull();
    });
  });

  // ── Hit dice edge cases ──────────────────────────────────────

  describe('hit dice edge cases', () => {
    it('should not decrement hit dice when hitDiceCost is 0 for hit_die_roll', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(undefined);
      restRules.getHitDieSize.mockReturnValue(8);
      restRules.computeHitDieRecovery.mockReturnValue(4);
      diceRoller.rollExpression.mockReturnValue({ total: 3, rolls: [3], modifier: 0 });

      const ps = makePlayerStats();
      const action = makeAction({
        healExpression: 'hit_die_roll',
        hitDiceCost: 0,
      });

      await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith(
        'TestHealer',
        'shortRestHitDice',
        expect.any(Number),
        campaignName,
        true,
      );
    });

    it('should floor maxHp/2 for bloodied check with odd max HP', async () => {
      const ps = makePlayerStats({ currentHitPoints: 8, maxHitPoints: 15 });
      const action = makeAction({
        healExpression: '1d4',
        bloodiedOnly: true,
      });

      const result = await handle(action, ps, campaignName, null);

      // 15/2 = 7.5, floor = 7, so 8 > 7 = not bloodied
      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Bloodied');
    });

    it('should allow when exactly at floor(maxHp/2)', async () => {
      const ps = makePlayerStats({ currentHitPoints: 7, maxHitPoints: 15 });
      const action = makeAction({
        healExpression: '1d4',
        bloodiedOnly: true,
      });

      const result = await handle(action, ps, campaignName, null);

      // floor(15/2) = 7, 7 <= 7 = bloodied
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
    });
  });

  // ── Popup description edge cases ─────────────────────────────

  describe('popup description edge cases', () => {
    it('should report singular "use" when 1 use remaining', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(2);
      const ps = makePlayerStats();
      const action = makeAction({ healExpression: '1d4', uses: 1 });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('1 use remaining');
      expect(result.payload.description).not.toContain('uses');
    });

    it('should report plural "uses" when more than 1 remaining', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(3);
      const ps = makePlayerStats();
      const action = makeAction({ healExpression: '1d4', uses: 1 });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('2 uses remaining');
    });
  });
});

  // ── Martial arts die fallback ──────────────────────────────────

  describe('martial arts die fallback', () => {
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

    it('should default martialArtsDie to 4 when class features returns empty object', async () => {
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

      classFeatures.getClassFeatures.mockReturnValue({});
      diceRoller.rollExpression.mockReturnValue({ total: 4, rolls: [4], modifier: 0 });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.formula).toContain('1d4');
    });
  });

  // ── Bloodied missing HP fields ─────────────────────────────────

  describe('bloodied missing HP fields', () => {
    it('should use 0 when currentHitPoints is null for bloodied check', async () => {
      const ps = makePlayerStats({ currentHitPoints: null, maxHitPoints: 20 });
      const action = makeAction({
        healExpression: '1d4',
        bloodiedOnly: true,
      });

      const result = await handle(action, ps, campaignName, null);

      // 0 is not > 0, so not bloodied
      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Bloodied');
    });

    it('should use 0 when maxHitPoints is null for bloodied check', async () => {
      const ps = makePlayerStats({ currentHitPoints: 5, maxHitPoints: null });
      const action = makeAction({
        healExpression: '1d4',
        bloodiedOnly: true,
      });

      const result = await handle(action, ps, campaignName, null);

      // null ?? 0 = 0, floor(0/2) = 0, 5 > 0 = not bloodied
      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Bloodied');
    });
  });

  // ── Hit dice runtime value fallback ────────────────────────────

  describe('hit dice runtime value fallback', () => {
    it('should use playerStats.level when runtime value is undefined for hit dice check', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(undefined);
      restRules.getHitDieSize.mockReturnValue(8);
      restRules.computeHitDieRecovery.mockReturnValue(5);
      diceRoller.rollExpression.mockReturnValue({ total: 6, rolls: [6], modifier: 0 });

      const ps = makePlayerStats({ level: 5 });
      const action = makeAction({
        healExpression: 'hit_die_roll',
        hitDiceCost: 3,
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
    });

    it('should use playerStats.level when runtime value is undefined for hit dice decrement', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(undefined);
      restRules.getHitDieSize.mockReturnValue(8);
      restRules.computeHitDieRecovery.mockReturnValue(5);
      diceRoller.rollExpression.mockReturnValue({ total: 6, rolls: [6], modifier: 0 });

      const ps = makePlayerStats({ level: 5 });
      const action = makeAction({
        healExpression: 'hit_die_roll',
        hitDiceCost: 2,
      });

      await handle(action, ps, campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestHealer',
        'shortRestHitDice',
        3,
        campaignName,
        true,
      );
    });
  });

  // ── Non-self uses-based with self-target and healExpression ────

  describe('non-self uses-based with self-target and healExpression', () => {
    it('should apply healing and return automation_info when target resolves to self', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(1);
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'TestHealer' } });
      diceRoller.rollExpression.mockReturnValue({ total: 7, rolls: [7], modifier: 0 });
      automationService.resolveHealingBonuses.mockReturnValue(0);
      healingRoll.applyHealingDirectly.mockReturnValue({ newHp: 17, maxHp: 20, actualHeal: 7 });

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

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('Regained 7 HP');
    });

    it('should include bonus HP in healing calculation for self-target path', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(1);
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'TestHealer' } });
      diceRoller.rollExpression.mockReturnValue({ total: 7, rolls: [7], modifier: 0 });
      automationService.resolveHealingBonuses.mockReturnValue(3);
      healingRoll.applyHealingDirectly.mockReturnValue({ newHp: 20, maxHp: 20, actualHeal: 10 });

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

      expect(result.payload.description).toContain('Regained 10 HP');
    });

    it('should call logHealingToSSE for self-target healing path', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(1);
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'TestHealer' } });
      diceRoller.rollExpression.mockReturnValue({ total: 7, rolls: [7], modifier: 0 });
      healingRoll.applyHealingDirectly.mockReturnValue({ newHp: 17, maxHp: 20, actualHeal: 7 });

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

      expect(healingRoll.logHealingToSSE).toHaveBeenCalledWith(campaignName, {
        targetName: 'TestHealer',
        sourceName: 'Cure Wounds',
        actualHeal: 7,
        newHp: 17,
        maxHp: 20,
      });
    });

    it('should return healing popup for non-self path when target is ally (no self-heal)', async () => {
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

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('healing');
    });

    it('should include bonus HP in non-self healing popup description', async () => {
      automationService.resolveHealingBonuses.mockReturnValue(2);
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

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.description).toContain('+ 2 bonus HP');
    });

    it('should return healing popup with healAmount number for non-self path with number healAmount', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(1);
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Ally' } });
      automationService.resolveHealingBonuses.mockReturnValue(0);

      const ps = makePlayerStats();
      const action = {
        name: 'Lay on Hands',
        automation: {
          type: 'reaction',
          uses: 1,
          healAmount: 5,
        },
      };

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.healAmount).toBe(5);
    });

    it('should add bonus to healAmount number for non-self path', async () => {
      automationService.resolveHealingBonuses.mockReturnValue(3);
      runtimeState.getRuntimeValue.mockReturnValue(1);
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Ally' } });

      const ps = makePlayerStats();
      const action = {
        name: 'Lay on Hands',
        automation: {
          type: 'reaction',
          uses: 1,
          healAmount: 5,
        },
      };

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.healAmount).toBe(8);
    });
  });

  // ── Final else branch (no uses, no self_healing) ───────────────

  describe('final else branch (no uses, no self_healing)', () => {
    it('should return healing popup with expression for non-self path without uses', async () => {
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
      expect(result.payload.type).toBe('healing');
      expect(result.payload.healAmount).toBe('1d8');
    });

    it('should return healing popup with number healAmount for non-self path without uses', async () => {
      automationService.resolveHealingBonuses.mockReturnValue(0);
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Ally' } });

      const ps = makePlayerStats();
      const action = {
        name: 'Lay on Hands',
        automation: {
          type: 'reaction',
          healAmount: 5,
        },
      };

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.healAmount).toBe(5);
    });

    it('should add bonus to number healAmount in final else branch', async () => {
      automationService.resolveHealingBonuses.mockReturnValue(3);
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Ally' } });

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

  // ── Helper imports needed for hit dice tests ───────────────────

import * as restRules from '../../../rules/effects/restRules.js';
