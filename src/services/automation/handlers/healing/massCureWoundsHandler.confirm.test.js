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
  markFortifiedHealthUsed: vi.fn(),
  hasHealingMaximization: vi.fn(),
  hasHealingMaximizationForTarget: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { confirmMassCureWounds } from './massCureWoundsHandler.js';
import { rollExpression, rollExpressionMaximized } from '../../../dice/diceRoller.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { applyHealingToTarget } from '../../../rules/combat/applyHealing.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import {
  resolveHealingBonusesWithDetails,
  markFortifiedHealthUsed,
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
    name: 'Mass Cure Wounds',
    spell: {
      name: 'Mass Cure Wounds',
      level: 5,
      heal_at_slot_level: {
        '5': '3d8 + MOD',
        '6': '4d8 + MOD',
        '7': '5d8 + MOD',
        '8': '6d8 + MOD',
        '9': '7d8 + MOD',
      },
      ...overrides.spell,
    },
    automation: { type: 'mass_cure_wounds', ...overrides.automation },
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('confirmMassCureWounds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rollExpression.mockReturnValue({ total: 18, rolls: [6, 7, 5], modifier: 0 });
    rollExpressionMaximized.mockReturnValue({ total: 24, rolls: [8, 8, 8], modifier: 0 });
    getCombatContext.mockResolvedValue({
      players: [{ name: 'TestCleric', gridX: 1, gridY: 1 }],
      creatures: [
        { name: 'Fighter', maxHp: 45, currentHp: 20, type: 'player' },
        { name: 'Rogue', maxHp: 30, currentHp: 10, type: 'player' },
        { name: 'Barbarian', maxHp: 60, currentHp: 30, type: 'npc' },
      ],
    });
    getRuntimeValue.mockImplementation((_name, prop) => {
      if (prop === 'currentHitPoints') return 20;
      return null;
    });
    hasHealingMaximizationForTarget.mockReturnValue(false);
    resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 0, details: [] });
    applyHealingToTarget.mockReturnValue({ actualHeal: 18, oldHp: 20, newHp: 38 });
  });

  // ── Basic healing ──────────────────────────────────────────

  describe('basic healing', () => {
    it('heals each target up to max HP', async () => {
      const result = await confirmMassCureWounds({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          selectedTargetNames: ['Fighter', 'Rogue'],
          healExpression: '3d8 + 3',
          maximize: false,
          bonusHeal: 0,
          bonusDetails: [],
          slotLevel: 5,
      });

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('heal_multi');
      expect(result.payload.results).toHaveLength(2);
      expect(result.payload.totalHealed).toBeGreaterThan(0);
    });

    it('caps healing at missing HP', async () => {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'currentHitPoints') {
          if (name === 'Fighter') return 44;
          if (name === 'Rogue') return 10;
        }
        return null;
      });

      const result = await confirmMassCureWounds({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          selectedTargetNames: ['Fighter'],
          healExpression: '3d8 + 3',
          maximize: false,
          bonusHeal: 0,
          bonusDetails: [],
          slotLevel: 5,
      });

      expect(result.payload.results[0].healAmount).toBeLessThanOrEqual(1);
    });

    it('respects maxTargets by slicing selected targets', async () => {
      getRuntimeValue.mockImplementation((_name, prop) => {
        if (prop === 'currentHitPoints') return 20;
        return null;
      });

      const action = {
        ...makeAction(),
        automation: { type: 'mass_cure_wounds', maxTargets: 2 },
      };
      const result = await confirmMassCureWounds({
          action,
          playerStats: makePlayerStats(),
          campaignName,
          selectedTargetNames: ['Fighter', 'Rogue', 'Barbarian'],
          healExpression: '3d8 + 3',
          maximize: false,
          bonusHeal: 0,
          bonusDetails: [],
          slotLevel: 5,
      });

      expect(result.payload.results).toHaveLength(2);
      expect(result.payload.results[0].targetName).toBe('Fighter');
      expect(result.payload.results[1].targetName).toBe('Rogue');
    });

    it('uses player name as sourceName in log entries', async () => {
      await confirmMassCureWounds({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          selectedTargetNames: ['Fighter'],
          healExpression: '3d8 + 3',
          maximize: false,
          bonusHeal: 0,
          bonusDetails: [],
          slotLevel: 5,
      });

      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'hp_change',
          targetName: 'Fighter',
          isHealing: true,
          sourceName: 'TestCleric',
          note: 'Mass Cure Wounds',
        }),
      );
    });

    it('logs with formula including bonus details when present', async () => {
      const bonusDetails = [{ name: 'Disciple of Life', amount: 5 }];
      resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 5, details: bonusDetails });

      await confirmMassCureWounds({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          selectedTargetNames: ['Fighter'],
          healExpression: '3d8 + 3',
          maximize: false,
          bonusHeal: 5,
          bonusDetails,
          slotLevel: 5,
      });

      const logEntry = addEntry.mock.calls[0][1];
      expect(logEntry.formula).toContain('Disciple of Life');
      expect(logEntry.bonusDetails).toEqual(bonusDetails);
    });

    it('logs hp_change for each target', async () => {
      await confirmMassCureWounds({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          selectedTargetNames: ['Fighter', 'Rogue', 'Barbarian'],
          healExpression: '3d8 + 3',
          maximize: false,
          bonusHeal: 0,
          bonusDetails: [],
          slotLevel: 5,
      });

      const hpLogs = addEntry.mock.calls.filter((call) => call[1].type === 'hp_change');
      expect(hpLogs).toHaveLength(3);
    });

    it('applies healing via applyHealingToTarget for each target', async () => {
      applyHealingToTarget.mockReturnValue({ actualHeal: 18, oldHp: 20, newHp: 38 });

      await confirmMassCureWounds({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          selectedTargetNames: ['Fighter', 'Rogue'],
          healExpression: '3d8 + 3',
          maximize: false,
          bonusHeal: 0,
          bonusDetails: [],
          slotLevel: 5,
      });

      expect(applyHealingToTarget).toHaveBeenCalledWith(
        expect.any(Object),
        'Fighter',
        18,
        campaignName,
      );
      expect(applyHealingToTarget).toHaveBeenCalledWith(
        expect.any(Object),
        'Rogue',
        10,
        campaignName,
      );
    });

    it('skips healing when actualHeal is 0 (target at full HP)', async () => {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'currentHitPoints') {
          if (name === 'Fighter') return 45;
          if (name === 'Rogue') return 10;
        }
        return null;
      });

      await confirmMassCureWounds({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          selectedTargetNames: ['Fighter', 'Rogue'],
          healExpression: '3d8 + 3',
          maximize: false,
          bonusHeal: 0,
          bonusDetails: [],
          slotLevel: 5,
      });

      // Fighter should not receive healing (already at max HP)
      const fighterCalls = applyHealingToTarget.mock.calls.filter(
        (call) => call[1] === 'Fighter',
      );
      expect(fighterCalls).toHaveLength(0);
    });

    it('dispatches combat-summary-updated event', async () => {
      const originalDispatch = window.dispatchEvent;
      const mockDispatch = vi.fn();
      window.dispatchEvent = mockDispatch;

      await confirmMassCureWounds({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          selectedTargetNames: ['Fighter'],
          healExpression: '3d8 + 3',
          maximize: false,
          bonusHeal: 0,
          bonusDetails: [],
          slotLevel: 5,
      });

      expect(mockDispatch).toHaveBeenCalled();
      expect(mockDispatch.mock.calls[0][0].type).toBe('combat-summary-updated');

      window.dispatchEvent = originalDispatch;
    });
  });

  // ── Maximization ───────────────────────────────────────────

  describe('maximization behavior', () => {
    it('uses rollExpressionMaximized when maximize is true', async () => {
      await confirmMassCureWounds({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          selectedTargetNames: ['Fighter'],
          healExpression: '3d8 + 3',
          maximize: true,
          bonusHeal: 0,
          bonusDetails: [],
          slotLevel: 5,
      });

      expect(rollExpressionMaximized).toHaveBeenCalledWith('3d8 + 3');
      expect(rollExpression).not.toHaveBeenCalled();
    });

    it('uses rollExpressionMaximized when hasHealingMaximizationForTarget is true', async () => {
      hasHealingMaximizationForTarget.mockReturnValue(true);

      await confirmMassCureWounds({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          selectedTargetNames: ['Fighter'],
          healExpression: '3d8 + 3',
          maximize: false,
          bonusHeal: 0,
          bonusDetails: [],
          slotLevel: 5,
      });

      expect(rollExpressionMaximized).toHaveBeenCalledWith('3d8 + 3');
      expect(rollExpression).not.toHaveBeenCalled();
    });

    it('uses normal rollExpression when neither maximization flag is set', async () => {
      await confirmMassCureWounds({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          selectedTargetNames: ['Fighter'],
          healExpression: '3d8 + 3',
          maximize: false,
          bonusHeal: 0,
          bonusDetails: [],
          slotLevel: 5,
      });

      expect(rollExpression).toHaveBeenCalledWith('3d8 + 3');
      expect(rollExpressionMaximized).not.toHaveBeenCalled();
    });
  });

  // ── Bonus healing ──────────────────────────────────────────

  describe('bonus healing', () => {
    it('adds bonusHeal to the roll total', async () => {
      const bonusHeal = 5;
      const bonusDetails = [{ name: 'Disciple of Life', amount: 5 }];
      const rollResult = { total: 18, rolls: [6, 7, 5] };
      rollExpression.mockReturnValue(rollResult);

      await confirmMassCureWounds({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          selectedTargetNames: ['Fighter'],
          healExpression: '3d8 + 3',
          maximize: false,
          bonusHeal,
          bonusDetails,
          slotLevel: 5,
      });

      // totalHeal = rollResult.total (18) + bonusHeal (5) = 23
      expect(applyHealingToTarget).toHaveBeenCalledWith(
        expect.any(Object),
        'Fighter',
        23,
        campaignName,
      );
    });

    it('includes bonusHeal in popup result', async () => {
      const bonusHeal = 5;
      const bonusDetails = [{ name: 'Disciple of Life', amount: 5 }];

      const result = await confirmMassCureWounds({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          selectedTargetNames: ['Fighter'],
          healExpression: '3d8 + 3',
          maximize: false,
          bonusHeal,
          bonusDetails,
          slotLevel: 5,
      });

      expect(result.payload.bonusHeal).toBe(5);
      expect(result.payload.bonusHealDetail).toContain('Disciple of Life');
    });

    it('returns empty bonusHealDetail when no bonus details', async () => {
      const result = await confirmMassCureWounds({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          selectedTargetNames: ['Fighter'],
          healExpression: '3d8 + 3',
          maximize: false,
          bonusHeal: 0,
          bonusDetails: [],
          slotLevel: 5,
      });

      expect(result.payload.bonusHealDetail).toBe('');
    });
  });

  // ── Fortified Health ───────────────────────────────────────

  describe('Fortified Health tracking', () => {
    it('calls markFortifiedHealthUsed when healing occurred and Fortified Health bonus is present', async () => {
      const bonusDetails = [{ name: 'Fortified Health', amount: 5 }];

      await confirmMassCureWounds({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          selectedTargetNames: ['Fighter'],
          healExpression: '3d8 + 3',
          maximize: false,
          bonusHeal: 5,
          bonusDetails,
          slotLevel: 5,
      });

      expect(markFortifiedHealthUsed).toHaveBeenCalledWith(
        makePlayerStats(),
        campaignName,
      );
    });

    it('does not call markFortifiedHealthUsed when no healing occurred', async () => {
      const bonusDetails = [{ name: 'Fortified Health', amount: 5 }];
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'currentHitPoints') {
          if (name === 'Fighter') return 45;
        }
        return null;
      });

      await confirmMassCureWounds({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          selectedTargetNames: ['Fighter'],
          healExpression: '3d8 + 3',
          maximize: false,
          bonusHeal: 5,
          bonusDetails,
          slotLevel: 5,
      });

      expect(markFortifiedHealthUsed).not.toHaveBeenCalled();
    });

    it('does not call markFortifiedHealthUsed when bonus is not Fortified Health', async () => {
      const bonusDetails = [{ name: 'Disciple of Life', amount: 5 }];

      await confirmMassCureWounds({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          selectedTargetNames: ['Fighter'],
          healExpression: '3d8 + 3',
          maximize: false,
          bonusHeal: 5,
          bonusDetails,
          slotLevel: 5,
      });

      expect(markFortifiedHealthUsed).not.toHaveBeenCalled();
    });
  });

  // ── Popup payload structure ────────────────────────────────

  describe('popup payload structure', () => {
    it('returns correct popup payload structure', async () => {
      const result = await confirmMassCureWounds({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          selectedTargetNames: ['Fighter', 'Rogue'],
          healExpression: '3d8 + 3',
          maximize: false,
          bonusHeal: 0,
          bonusDetails: [],
          slotLevel: 5,
      });

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('heal_multi');
      expect(result.payload.name).toBe('Mass Cure Wounds');
      expect(result.payload.formula).toBe('3d8 + 3');
      expect(Array.isArray(result.payload.rolls)).toBe(true);
      expect(Array.isArray(result.payload.results)).toBe(true);
      expect(typeof result.payload.totalHealed).toBe('number');
    });

    it('includes roll details in each result', async () => {
      const result = await confirmMassCureWounds({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          selectedTargetNames: ['Fighter'],
          healExpression: '3d8 + 3',
          maximize: false,
          bonusHeal: 0,
          bonusDetails: [],
          slotLevel: 5,
      });

      expect(result.payload.results[0].targetName).toBe('Fighter');
      expect(Array.isArray(result.payload.results[0].rolls)).toBe(true);
    });

    it('aggregates all rolls into payload.rolls', async () => {
      const result = await confirmMassCureWounds({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          selectedTargetNames: ['Fighter', 'Rogue'],
          healExpression: '3d8 + 3',
          maximize: false,
          bonusHeal: 0,
          bonusDetails: [],
          slotLevel: 5,
      });

      expect(result.payload.rolls.length).toBeGreaterThan(0);
    });
  });

  // ── Edge cases ─────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles rollExpression returning null (skips target)', async () => {
      rollExpression.mockReturnValue(null);

      const result = await confirmMassCureWounds({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          selectedTargetNames: ['Fighter', 'Rogue'],
          healExpression: '3d8 + 3',
          maximize: false,
          bonusHeal: 0,
          bonusDetails: [],
          slotLevel: 5,
      });

      // Should still return results but skip the target with null roll
      expect(result.payload.results).toBeDefined();
    });

    it('handles empty target list gracefully', async () => {
      const result = await confirmMassCureWounds({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          selectedTargetNames: [],
          healExpression: '3d8 + 3',
          maximize: false,
          bonusHeal: 0,
          bonusDetails: [],
          slotLevel: 5,
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

      const result = await confirmMassCureWounds({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          selectedTargetNames: ['Fighter'],
          healExpression: '3d8 + 3',
          maximize: false,
          bonusHeal: 0,
          bonusDetails: [],
          slotLevel: 5,
      });

      expect(result.payload.results[0].targetName).toBe('Fighter');
    });

    it('handles currentHp as null (treats as maxHp)', async () => {
      getRuntimeValue.mockImplementation((_name, prop) => {
        if (prop === 'currentHitPoints') return null;
        return null;
      });

      const result = await confirmMassCureWounds({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          selectedTargetNames: ['Fighter'],
          healExpression: '3d8 + 3',
          maximize: false,
          bonusHeal: 0,
          bonusDetails: [],
          slotLevel: 5,
      });

      expect(result.payload.results[0].targetName).toBe('Fighter');
    });

    it('handles combat summary with no maxHp on creature (falls back to player hitPoints)', async () => {
      getCombatContext.mockResolvedValue(
        {
          players: [],
          creatures: [
            { name: 'Fighter', type: 'player' },
          ],
        },
      );

      const result = await confirmMassCureWounds({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          selectedTargetNames: ['Fighter'],
          healExpression: '3d8 + 3',
          maximize: false,
          bonusHeal: 0,
          bonusDetails: [],
          slotLevel: 5,
      });

      expect(result.payload.results[0].targetName).toBe('Fighter');
    });

    it('handles log entry errors gracefully (catches and continues)', async () => {
      const originalConsoleError = console.error;
      const mockError = vi.fn();
      console.error = mockError;

      addEntry.mockRejectedValue(new Error('Log error'));

      const result = await confirmMassCureWounds({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          selectedTargetNames: ['Fighter', 'Rogue'],
          healExpression: '3d8 + 3',
          maximize: false,
          bonusHeal: 0,
          bonusDetails: [],
          slotLevel: 5,
      });

      expect(mockError).toHaveBeenCalled();
      expect(result.payload.results).toHaveLength(2);

      console.error = originalConsoleError;
    });

    it('uses automation.maxTargets from action in confirmMassCureWounds', async () => {
      const action = {
        ...makeAction(),
        automation: { type: 'mass_cure_wounds', maxTargets: 2 },
      };
      const result = await confirmMassCureWounds({
          action,
          playerStats: makePlayerStats(),
          campaignName,
          selectedTargetNames: ['Fighter', 'Rogue', 'Barbarian'],
          healExpression: '3d8 + 3',
          maximize: false,
          bonusHeal: 0,
          bonusDetails: [],
          slotLevel: 5,
      });

      expect(result.payload.results).toHaveLength(2);
    });
  });
});
