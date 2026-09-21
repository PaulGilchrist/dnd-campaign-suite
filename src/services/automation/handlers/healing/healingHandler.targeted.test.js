// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
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

// ── Tests ──────────────────────────────────────────────────────

describe('healingHandler targeted healing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
    diceRoller.rollExpressionMaximized.mockReturnValue({ total: 8, rolls: [8], modifier: 0 });
    automationService.resolveHealingBonuses.mockReturnValue(0);
    automationService.resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 0, details: [] });
    healingRoll.applyHealingDirectly.mockReturnValue({ newHp: 15, maxHp: 20, actualHeal: 5 });
    targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'TestHealer' } });
  });

  // ── Uses-based non-self healing ──────────────────────────────

  describe('uses-based non-self healing', () => {
    it('should resolve target and return automation_info when uses available', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(1);
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Ally' } });

      const ps = makePlayerStats();
      const action = {
        name: 'Healing Touch',
        automation: {
          type: 'self_healing',
          uses: 1,
          healExpression: '2d4',
        },
      };

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
    });

    it('should return healing popup when no uses field and no healExpression for self_healing', async () => {
      targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'TestHealer' } });

      const ps = makePlayerStats();
      const action = {
        name: 'Healing Touch',
        automation: {
          type: 'self_healing',
          uses: 1,
        },
      };

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
});
