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

vi.mock('../../../combat/automationService.js', () => ({
  resolveHealingBonuses: vi.fn(),
  hasHealingMaximization: vi.fn(),
  hasRerollHealingOnes: vi.fn(),
}));

vi.mock('../../../../hooks/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './healingHandler.js';
import * as diceRoller from '../../../dice/diceRoller.js';
import * as classFeatures from '../../../character/classFeatures.js';
import * as targetResolver from '../../common/targetResolver.js';
import * as healingRoll from '../../common/healingRoll.js';
import * as automationService from '../../../combat/automationService.js';
import * as useRuntimeState from '../../../../hooks/useRuntimeState.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestHero',
    level: 3,
    proficiencyBonus: 2,
    abilities: [
      { name: 'Wisdom', bonus: 2 },
    ],
    characterAdvancement: [],
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Healing Touch',
    automation: {
      ...automation,
    },
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('healingHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Monk Healing (martial_arts_die + WIS)', () => {
    const monkAutomation = {
      healExpression: '1d martial_arts_die + WIS',
    };

    it('should handle basic self-healing correctly', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ 
        ...monkAutomation, 
        type: 'self_healing' 
      });

      classFeatures.getClassFeatures.mockReturnValue({ martialArtsDie: 6 });
      diceRoller.rollExpression.mockReturnValue({ total: 4, rolls: [4] });
      automationService.resolveHealingBonuses.mockReturnValue(2); // e.g., some bonus
      automationService.hasHealingMaximization.mockReturnValue(false);
      healingRoll.applyHealingDirectly.mockReturnValue({ newHp: 15, maxHp: 20, actualHeal: 7 });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('handOfHealing');
      // Base (4) + WIS (2) + Bonus (2) = 8
      expect(result.payload.healAmount).toBe(8);
      expect(result.payload.targetName).toBe(ps.name);
      expect(healingRoll.logHealingToSSE).toHaveBeenCalledWith(campaignName, {
        targetName: ps.name,
        sourceName: action.name,
        actualHeal: 7,
        newHp: 15,
        maxHp: 20,
      });
    });

    it('should resolve target for non-self healing', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ ...monkAutomation }); // Not self_healing
      
      classFeatures.getClassFeatures.mockReturnValue({ martialArtsDie: 6 });
      diceRoller.rollExpression.mockReturnValue({ total: 4, rolls: [4] });
      automationService.resolveHealingBonuses.mockReturnValue(0);
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Ally' } });
      healingRoll.applyHealingDirectly.mockReturnValue({ newHp: 10, maxHp: 10, actualHeal: 0 });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.targetName).toBe('Ally');
      expect(healingRoll.applyHealingDirectly).toHaveBeenCalledWith(ps, 'Ally', 6, campaignName); // roll(4) + WIS(2)
    });

    it('should fallback to self if target resolution fails', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ ...monkAutomation });
      
      classFeatures.getClassFeatures.mockReturnValue({ martialArtsDie: 6 });
      diceRoller.rollExpression.mockReturnValue({ total: 4, rolls: [4] });
      targetResolver.resolveTarget.mockResolvedValue(null); // fails
      healingRoll.applyHealingDirectly.mockReturnValue({ newHp: 15, maxHp: 20, actualHeal: 7 });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.targetName).toBe(ps.name);
    });

    it('should use rollExpressionMaximized when maximization is active', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ ...monkAutomation });

      classFeatures.getClassFeatures.mockReturnValue({ martialArtsDie: 6 });
      automationService.hasHealingMaximization.mockReturnValue(true);
      diceRoller.rollExpressionMaximized.mockReturnValue({ total: 6, rolls: [6] });
      healingRoll.applyHealingDirectly.mockReturnValue({ newHp: 15, maxHp: 20, actualHeal: 8 });

      await handle(action, ps, campaignName, null);

      expect(diceRoller.rollExpressionMaximized).toHaveBeenCalledWith('1d6');
      expect(diceRoller.rollExpression).not.toHaveBeenCalled();
    });

    it('should return null if roll fails', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ ...monkAutomation });

      classFeatures.getClassFeatures.mockReturnValue({ martialArtsDie: 6 });
      automationService.hasHealingMaximization.mockReturnValue(false);
      diceRoller.rollExpression.mockReturnValue(null);

      const result = await handle(action, ps, campaignName, null);

      expect(result).toBeNull();
    });

    it('should use default martial arts die (4) if not found in class features', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ ...monkAutomation });

      classFeatures.getClassFeatures.mockReturnValue({}); // No die defined
      automationService.hasHealingMaximization.mockReturnValue(false);
      diceRoller.rollExpression.mockReturnValue({ total: 3, rolls: [3] });
      healingRoll.applyHealingDirectly.mockReturnValue({ newHp: 15, maxHp: 20, actualHeal: 5 });

      await handle(action, ps, campaignName, null);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d4');
    });

    it('should use modifier 0 if Wisdom ability is missing', async () => {
      const ps = makePlayerStats({ abilities: [] });
      const action = makeAction({ ...monkAutomation });

      classFeatures.getClassFeatures.mockReturnValue({ martialArtsDie: 6 });
      automationService.hasHealingMaximization.mockReturnValue(false);
      diceRoller.rollExpression.mockReturnValue({ total: 4, rolls: [4] });
      automationService.resolveHealingBonuses.mockReturnValue(0);
      healingRoll.applyHealingDirectly.mockReturnValue({ newHp: 15, maxHp: 20, actualHeal: 4 });

      const result = await handle(action, ps, campaignName, null);

      // Roll (4) + Mod (0) + Bonus (0) = 4
      expect(result.payload.healAmount).toBe(4);
    });

    it('should correctly identify Physician\'s Touch advancement', async () => {
      const ps = makePlayerStats({ 
        characterAdvancement: [{ name: "Physician's Touch" }]
      });
      const action = makeAction({ ...monkAutomation });

      classFeatures.getClassFeatures.mockReturnValue({ martialArtsDie: 6 });
      diceRoller.rollExpression.mockReturnValue({ total: 4, rolls: [4] });
      healingRoll.applyHealingDirectly.mockReturnValue({ newHp: 15, maxHp: 20, actualHeal: 7 });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.hasPhysiciansTouch).toBe(true);
    });

    it('should set hasPhysiciansTouch to false when not present', async () => {
      const ps = makePlayerStats({ characterAdvancement: [] });
      const action = makeAction({ ...monkAutomation });

      classFeatures.getClassFeatures.mockReturnValue({ martialArtsDie: 6 });
      diceRoller.rollExpression.mockReturnValue({ total: 4, rolls: [4] });
      healingRoll.applyHealingDirectly.mockReturnValue({ newHp: 15, maxHp: 20, actualHeal: 7 });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.hasPhysiciansTouch).toBe(false);
    });
  });

  describe('Self Healing with Expression (Second Wind)', () => {
    function makeFighterStats(overrides = {}) {
      return {
        name: 'TestFighter',
        level: 3,
        proficiencyBonus: 2,
        abilities: [],
        characterAdvancement: [],
        class: {
          name: 'Fighter',
          class_levels: [
            { level: 1, second_wind: 2 },
            { level: 2, second_wind: 2 },
            { level: 3, second_wind: 2 },
            { level: 4, second_wind: 3 },
          ],
        },
        ...overrides,
      };
    }

    it('should roll dice, apply healing, and decrement uses', async () => {
      const ps = makeFighterStats();
      const action = {
        name: 'Second Wind',
        automation: {
          type: 'self_healing',
          healExpression: '1d10 + fighter level',
        },
      };

      diceRoller.rollExpression.mockReturnValue({ total: 7, rolls: [7] });
      automationService.resolveHealingBonuses.mockReturnValue(0);
      automationService.hasHealingMaximization.mockReturnValue(false);
      healingRoll.applyHealingDirectly.mockReturnValue({ newHp: 22, maxHp: 30, actualHeal: 7 });
      useRuntimeState.getRuntimeValue.mockReturnValue(2);

      const result = await handle(action, ps, campaignName, null);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d10 + 3');
      expect(healingRoll.applyHealingDirectly).toHaveBeenCalledWith(ps, ps.name, 7, campaignName);
      expect(healingRoll.logHealingToSSE).toHaveBeenCalledWith(campaignName, {
        targetName: ps.name,
        sourceName: action.name,
        actualHeal: 7,
        newHp: 22,
        maxHp: 30,
      });
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(ps.name, 'secondwindUses', 1, campaignName, true);
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('Regained 7 HP');
      expect(result.payload.description).toContain('1 use remaining');
    });

    it('should return null when roll fails', async () => {
      const ps = makeFighterStats();
      const action = {
        name: 'Second Wind',
        automation: {
          type: 'self_healing',
          healExpression: '1d10 + fighter level',
        },
      };

      diceRoller.rollExpression.mockReturnValue(null);
      automationService.hasHealingMaximization.mockReturnValue(false);

      const result = await handle(action, ps, campaignName, null);

      expect(result).toBeNull();
    });

    it('should use rollExpressionMaximized when maximization active', async () => {
      const ps = makeFighterStats();
      const action = {
        name: 'Second Wind',
        automation: {
          type: 'self_healing',
          healExpression: '1d10 + fighter level',
        },
      };

      diceRoller.rollExpressionMaximized.mockReturnValue({ total: 13, rolls: [10, 3] });
      automationService.hasHealingMaximization.mockReturnValue(true);
      healingRoll.applyHealingDirectly.mockReturnValue({ newHp: 28, maxHp: 30, actualHeal: 13 });
      useRuntimeState.getRuntimeValue.mockReturnValue(2);

      await handle(action, ps, campaignName, null);

      expect(diceRoller.rollExpressionMaximized).toHaveBeenCalledWith('1d10 + 3');
      expect(diceRoller.rollExpression).not.toHaveBeenCalled();
    });

    it('should show no uses remaining when last use consumed', async () => {
      const ps = makeFighterStats();
      const action = {
        name: 'Second Wind',
        automation: {
          type: 'self_healing',
          healExpression: '1d10',
        },
      };

      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5] });
      automationService.resolveHealingBonuses.mockReturnValue(0);
      automationService.hasHealingMaximization.mockReturnValue(false);
      healingRoll.applyHealingDirectly.mockReturnValue({ newHp: 20, maxHp: 30, actualHeal: 5 });
      useRuntimeState.getRuntimeValue.mockReturnValue(0);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('no uses remaining');
    });

    it('should include bonus healing in total', async () => {
      const ps = makeFighterStats();
      const action = {
        name: 'Second Wind',
        automation: {
          type: 'self_healing',
          healExpression: '1d10 + fighter level',
        },
      };

      diceRoller.rollExpression.mockReturnValue({ total: 7, rolls: [7] });
      automationService.resolveHealingBonuses.mockReturnValue(3);
      automationService.hasHealingMaximization.mockReturnValue(false);
      healingRoll.applyHealingDirectly.mockReturnValue({ newHp: 25, maxHp: 30, actualHeal: 10 });
      useRuntimeState.getRuntimeValue.mockReturnValue(2);

      await handle(action, ps, campaignName, null);

      expect(healingRoll.applyHealingDirectly).toHaveBeenCalledWith(ps, ps.name, 10, campaignName);
    });
  });

  describe('General Healing', () => {
    it('should handle simple healAmount number without bonus', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ 
        healAmount: 10,
        healExpression: '10'
      });

      automationService.resolveHealingBonuses.mockReturnValue(0);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('healing');
      expect(result.payload.healAmount).toBe(10);
      expect(result.payload.description).toBe(`${action.name}: Restores 10 HP`);
    });

    it('should handle healAmount number with bonus', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ 
        healAmount: 10,
        healExpression: '2d6'
      });

      automationService.resolveHealingBonuses.mockReturnValue(4);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.healAmount).toBe(14);
      expect(result.payload.description).toContain('Restores 2d6 + 4 bonus HP');
    });

    it('should fallback to healExpression if healAmount is not a number', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ 
        healExpression: '1d8+3'
      });

      automationService.resolveHealingBonuses.mockReturnValue(0);

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.healAmount).toBe('1d8+3');
    });

    it('should use slotLevel from automation if provided', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ 
        healAmount: 5,
        slotLevel: 3 
      });

      await handle(action, ps, campaignName, null);
      expect(automationService.resolveHealingBonuses).toHaveBeenCalledWith(ps, 2, 3, 3);
    });
  });

  describe('Reroll Healing Ones', () => {
    it('should use rollExpression with rerollOnes option when hasRerollHealingOnes is true', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Second Wind',
        automation: {
          type: 'self_healing',
          healExpression: '1d10',
        },
      };

      diceRoller.rollExpression.mockReturnValue({ total: 8, rolls: [8] });
      automationService.resolveHealingBonuses.mockReturnValue(0);
      automationService.hasHealingMaximization.mockReturnValue(false);
      automationService.hasRerollHealingOnes.mockReturnValue(true);
      healingRoll.applyHealingDirectly.mockReturnValue({ newHp: 22, maxHp: 30, actualHeal: 8 });
      useRuntimeState.getRuntimeValue.mockReturnValue(2);

      await handle(action, ps, campaignName, null);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d10', { rerollOnes: true });
      expect(diceRoller.rollExpressionMaximized).not.toHaveBeenCalled();
    });

    it('should prefer maximize over rerollOnes when both are true', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Second Wind',
        automation: {
          type: 'self_healing',
          healExpression: '1d10',
        },
      };

      diceRoller.rollExpressionMaximized.mockReturnValue({ total: 10, rolls: [10] });
      automationService.hasHealingMaximization.mockReturnValue(true);
      automationService.hasRerollHealingOnes.mockReturnValue(true);
      healingRoll.applyHealingDirectly.mockReturnValue({ newHp: 25, maxHp: 30, actualHeal: 10 });
      useRuntimeState.getRuntimeValue.mockReturnValue(2);

      await handle(action, ps, campaignName, null);

      expect(diceRoller.rollExpressionMaximized).toHaveBeenCalledWith('1d10');
      expect(diceRoller.rollExpression).not.toHaveBeenCalled();
    });

    it('should use normal rollExpression when neither maximize nor rerollOnes is true', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Second Wind',
        automation: {
          type: 'self_healing',
          healExpression: '1d10',
        },
      };

      diceRoller.rollExpression.mockReturnValue({ total: 6, rolls: [6] });
      automationService.resolveHealingBonuses.mockReturnValue(0);
      automationService.hasHealingMaximization.mockReturnValue(false);
      automationService.hasRerollHealingOnes.mockReturnValue(false);
      healingRoll.applyHealingDirectly.mockReturnValue({ newHp: 20, maxHp: 30, actualHeal: 6 });
      useRuntimeState.getRuntimeValue.mockReturnValue(2);

      await handle(action, ps, campaignName, null);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d10');
      expect(diceRoller.rollExpressionMaximized).not.toHaveBeenCalled();
    });
  });
});
