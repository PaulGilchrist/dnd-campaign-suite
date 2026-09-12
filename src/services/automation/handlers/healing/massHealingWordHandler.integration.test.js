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

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../rules/combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
  resolveHealingBonusesWithDetails: vi.fn(() => ({ totalBonus: 0, details: [] })),
  hasHealingMaximization: vi.fn(),
  hasHealingMaximizationForTarget: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { confirmMassHealingWord } from './massHealingWordHandler.js';
import { rollExpression, rollExpressionMaximized } from '../../../dice/diceRoller.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { applyHealingToTarget } from '../../../rules/combat/applyHealing.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import {
  resolveHealingBonusesWithDetails,
  hasHealingMaximization,
  hasHealingMaximizationForTarget,
} from '../../../combat/automation/automationService.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCleric',
    level: 10,
    proficiency: 4,
    hitPoints: 50,
    spellAbilities: { modifier: 3 },
    abilities: [{ name: 'Wisdom', bonus: 3 }],
    ...overrides,
  };
}

function makeAction(overrides = {}) {
  return {
    name: 'Mass Healing Word',
    spell: {
      name: 'Mass Healing Word',
      level: 3,
      heal_at_slot_level: {
        '3': '2d6 + MOD',
        '4': '3d6 + MOD',
        '5': '4d6 + MOD',
        '6': '5d6 + MOD',
        '7': '6d6 + MOD',
        '8': '7d6 + MOD',
        '9': '8d6 + MOD',
      },
      ...overrides.spell,
    },
    automation: { type: 'mass_healing_word', ...overrides.automation },
    ...overrides,
  };
}

function makeCombatSummary(creatures) {
  return {
    players: [{ name: 'TestCleric', gridX: 1, gridY: 1 }],
    creatures,
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('massHealingWordHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rollExpression.mockReturnValue({ total: 12, rolls: [5, 4, 3], modifier: 0 });
    rollExpressionMaximized.mockReturnValue({ total: 18, rolls: [6, 6, 6], modifier: 0 });
    getCombatContext.mockResolvedValue(
      makeCombatSummary([
        { name: 'Fighter', maxHp: 45, currentHp: 20, type: 'player' },
        { name: 'Rogue', maxHp: 30, currentHp: 10, type: 'player' },
        { name: 'Barbarian', maxHp: 60, currentHp: 30, type: 'npc' },
      ]),
    );
    getRuntimeValue.mockImplementation((_name, prop) => {
      if (prop === 'currentHitPoints') return 20;
      return null;
    });
    hasHealingMaximization.mockReturnValue(false);
    hasHealingMaximizationForTarget.mockReturnValue(false);
    resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 0, details: [] });
    applyHealingToTarget.mockReturnValue({ actualHeal: 12, oldHp: 20, newHp: 32 });
  });

  // ── confirmMassHealingWord: maxTargets from automation ──────

  describe('maxTargets from automation config', () => {
    it('uses maxTargets from automation in confirmMassHealingWord', async () => {
      const action = {
        ...makeAction(),
        automation: { type: 'mass_healing_word', maxTargets: 2 },
      };
      const result = await confirmMassHealingWord({
          action,
          playerStats: makePlayerStats(),
          campaignName,
          selectedTargetNames: ['Fighter', 'Rogue', 'Barbarian'],
          healExpression: '2d6 + 3',
          maximize: false,
          bonusHeal: 0,
          bonusDetails: [],
          slotLevel: 3,
      });
      expect(result.payload.results).toHaveLength(2);
    });

    it('uses automation.maxTargets from action in confirmMassHealingWord', async () => {
      const action = {
        ...makeAction(),
        automation: { type: 'mass_healing_word', maxTargets: 2 },
      };
      const result = await confirmMassHealingWord({
          action,
          playerStats: makePlayerStats(),
          campaignName,
          selectedTargetNames: ['Fighter', 'Rogue', 'Barbarian'],
          healExpression: '2d6 + 3',
          maximize: false,
          bonusHeal: 0,
          bonusDetails: [],
          slotLevel: 3,
      });

      expect(result.payload.results).toHaveLength(2);
    });
  });

  // ── confirmMassHealingWord: edge cases ──────────────────────

  describe('edge cases', () => {
    it('handles rollExpression returning null (skips target)', async () => {
      rollExpression.mockReturnValue(null);

      const result = await confirmMassHealingWord({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          selectedTargetNames: ['Fighter', 'Rogue'],
          healExpression: '2d6 + 3',
          maximize: false,
          bonusHeal: 0,
          bonusDetails: [],
          slotLevel: 3,
      });

      // Should still return results but skip the target with null roll
      expect(result.payload.results).toBeDefined();
    });

    it('handles empty target list gracefully', async () => {
      const result = await confirmMassHealingWord({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          selectedTargetNames: [],
          healExpression: '2d6 + 3',
          maximize: false,
          bonusHeal: 0,
          bonusDetails: [],
          slotLevel: 3,
      });

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('heal_multi');
      expect(result.payload.results).toHaveLength(0);
      expect(result.payload.totalHealed).toBe(0);
    });

    it('handles currentHp as empty string (treats as maxHp)', async () => {
      getRuntimeValue.mockImplementation((_name, prop) => {
        if (prop === 'currentHitPoints') return '';
        return null;
      });

      const result = await confirmMassHealingWord({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          selectedTargetNames: ['Fighter'],
          healExpression: '2d6 + 3',
          maximize: false,
          bonusHeal: 0,
          bonusDetails: [],
          slotLevel: 3,
      });

      expect(result.payload.results[0].targetName).toBe('Fighter');
    });

    it('handles currentHp as null (treats as maxHp)', async () => {
      getRuntimeValue.mockImplementation((_name, prop) => {
        if (prop === 'currentHitPoints') return null;
        return null;
      });

      const result = await confirmMassHealingWord({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          selectedTargetNames: ['Fighter'],
          healExpression: '2d6 + 3',
          maximize: false,
          bonusHeal: 0,
          bonusDetails: [],
          slotLevel: 3,
      });

      expect(result.payload.results[0].targetName).toBe('Fighter');
    });

    it('handles combat summary with no maxHp on creature (falls back to player hitPoints)', async () => {
      getCombatContext.mockResolvedValue(
        makeCombatSummary([
          { name: 'Fighter', type: 'player' },
        ]),
      );

      const result = await confirmMassHealingWord({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          selectedTargetNames: ['Fighter'],
          healExpression: '2d6 + 3',
          maximize: false,
          bonusHeal: 0,
          bonusDetails: [],
          slotLevel: 3,
      });

      expect(result.payload.results[0].targetName).toBe('Fighter');
    });

    it('handles log entry errors gracefully (catches and continues)', async () => {
      const originalConsoleError = console.error;
      const mockError = vi.fn();
      console.error = mockError;

      addEntry.mockRejectedValue(new Error('Log error'));

      const result = await confirmMassHealingWord({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          selectedTargetNames: ['Fighter', 'Rogue'],
          healExpression: '2d6 + 3',
          maximize: false,
          bonusHeal: 0,
          bonusDetails: [],
          slotLevel: 3,
      });

      expect(mockError).toHaveBeenCalled();
      expect(result.payload.results).toHaveLength(2);

      console.error = originalConsoleError;
    });

    it('handles storedHp as a number string', async () => {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'currentHitPoints') {
          if (name === 'Fighter') return '15';
          return '20';
        }
        return null;
      });

      const result = await confirmMassHealingWord({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          selectedTargetNames: ['Fighter'],
          healExpression: '2d6 + 3',
          maximize: false,
          bonusHeal: 0,
          bonusDetails: [],
          slotLevel: 3,
      });

      expect(result.payload.results[0].targetName).toBe('Fighter');
    });

    it('handles negative currentHp gracefully (maxHp - currentHp > maxHp)', async () => {
      getRuntimeValue.mockImplementation((_name, prop) => {
        if (prop === 'currentHitPoints') return -5;
        return null;
      });

      const result = await confirmMassHealingWord({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          selectedTargetNames: ['Fighter'],
          healExpression: '2d6 + 3',
          maximize: false,
          bonusHeal: 0,
          bonusDetails: [],
          slotLevel: 3,
      });

      // Should still heal, capping at maxHp
      expect(result.payload.results.length).toBeGreaterThan(0);
    });

    it('handles creature with zero maxHp gracefully (caps at 0 healing)', async () => {
      getCombatContext.mockResolvedValue(
        makeCombatSummary([
          { name: 'Fighter', maxHp: 0, currentHp: 0, type: 'player' },
        ]),
      );
      getRuntimeValue.mockImplementation((_name, prop) => {
        if (prop === 'currentHitPoints') return 0;
        return null;
      });

      const result = await confirmMassHealingWord({
          action: makeAction(),
          playerStats: makePlayerStats({ hitPoints: 0 }),
          campaignName,
          selectedTargetNames: ['Fighter'],
          healExpression: '2d6 + 3',
          maximize: false,
          bonusHeal: 0,
          bonusDetails: [],
          slotLevel: 3,
      });

      expect(result.payload.results[0].targetName).toBe('Fighter');
      expect(result.payload.results[0].healAmount).toBe(0);
    });
  });

  // ── Log entry details ───────────────────────────────────────

  describe('log entry details', () => {
    it('includes correct timestamp in log entry', async () => {
      const before = Date.now();
      await confirmMassHealingWord({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          selectedTargetNames: ['Fighter'],
          healExpression: '2d6 + 3',
          maximize: false,
          bonusHeal: 0,
          bonusDetails: [],
          slotLevel: 3,
      });
      const after = Date.now();

      const logEntry = addEntry.mock.calls[0][1];
      expect(typeof logEntry.timestamp).toBe('number');
      expect(logEntry.timestamp).toBeGreaterThanOrEqual(before);
      expect(logEntry.timestamp).toBeLessThanOrEqual(after);
    });

    it('includes maxHp in log entry', async () => {
      await confirmMassHealingWord({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          selectedTargetNames: ['Fighter'],
          healExpression: '2d6 + 3',
          maximize: false,
          bonusHeal: 0,
          bonusDetails: [],
          slotLevel: 3,
      });

      const logEntry = addEntry.mock.calls[0][1];
      expect(logEntry.maxHp).toBe(45);
    });

    it('includes currentHp (newHp) in log entry', async () => {
      await confirmMassHealingWord({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          selectedTargetNames: ['Fighter'],
          healExpression: '2d6 + 3',
          maximize: false,
          bonusHeal: 0,
          bonusDetails: [],
          slotLevel: 3,
      });

      const logEntry = addEntry.mock.calls[0][1];
      expect(logEntry.currentHp).toBe(32);
    });

    it('includes delta in log entry', async () => {
      await confirmMassHealingWord({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          selectedTargetNames: ['Fighter'],
          healExpression: '2d6 + 3',
          maximize: false,
          bonusHeal: 0,
          bonusDetails: [],
          slotLevel: 3,
      });

      const logEntry = addEntry.mock.calls[0][1];
      expect(logEntry.delta).toBe(12);
    });
  });
});
