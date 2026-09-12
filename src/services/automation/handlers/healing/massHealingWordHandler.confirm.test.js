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

import { confirmMassHealingWord } from './massHealingWordHandler.js';
import { rollExpression, rollExpressionMaximized } from '../../../dice/diceRoller.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { applyHealingToTarget } from '../../../rules/combat/applyHealing.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import {
  resolveHealingBonusesWithDetails,
  markFortifiedHealthUsed,
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

describe('confirmMassHealingWord', () => {
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

  // ── confirmMassHealingWord: basic healing ───────────────────

  describe('basic healing', () => {
    it('heals each target up to max HP', async () => {
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

      expect(result.payload.results[0].healAmount).toBeLessThanOrEqual(1);
    });

    it('respects maxTargets by slicing selected targets', async () => {
      getRuntimeValue.mockImplementation((_name, prop) => {
        if (prop === 'currentHitPoints') return 20;
        return null;
      });

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
      expect(result.payload.results[0].targetName).toBe('Fighter');
      expect(result.payload.results[1].targetName).toBe('Rogue');
    });

    it('uses player name as sourceName in log entries', async () => {
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

      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'hp_change',
          targetName: 'Fighter',
          isHealing: true,
          sourceName: 'TestCleric',
          note: 'Mass Healing Word',
        }),
      );
    });

    it('logs with formula including bonus details when present', async () => {
      const bonusDetails = [{ name: 'Disciple of Life', amount: 5 }];
      resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 5, details: bonusDetails });

      await confirmMassHealingWord({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          selectedTargetNames: ['Fighter'],
          healExpression: '2d6 + 3',
          maximize: false,
          bonusHeal: 5,
          bonusDetails,
          slotLevel: 3,
      });

      const logEntry = addEntry.mock.calls[0][1];
      expect(logEntry.formula).toContain('Disciple of Life');
      expect(logEntry.bonusDetails).toEqual(bonusDetails);
    });

    it('logs hp_change for each target', async () => {
      await confirmMassHealingWord({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          selectedTargetNames: ['Fighter', 'Rogue', 'Barbarian'],
          healExpression: '2d6 + 3',
          maximize: false,
          bonusHeal: 0,
          bonusDetails: [],
          slotLevel: 3,
      });

      const hpLogs = addEntry.mock.calls.filter((call) => call[1].type === 'hp_change');
      expect(hpLogs).toHaveLength(3);
    });

    it('applies healing via applyHealingToTarget for each target when actualHeal > 0', async () => {
      applyHealingToTarget.mockReturnValue({ actualHeal: 12, oldHp: 20, newHp: 32 });

      await confirmMassHealingWord({
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

      expect(applyHealingToTarget).toHaveBeenCalledWith(
        expect.any(Object),
        'Fighter',
        12,
        campaignName,
      );
      expect(applyHealingToTarget).toHaveBeenCalledWith(
        expect.any(Object),
        'Rogue',
        expect.any(Number),
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

      await confirmMassHealingWord({
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

      expect(mockDispatch).toHaveBeenCalled();
      expect(mockDispatch.mock.calls[0][0].type).toBe('combat-summary-updated');

      window.dispatchEvent = originalDispatch;
    });

    it('includes formula in popup result', async () => {
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

      expect(result.payload.formula).toBe('2d6 + 3');
    });

    it('includes name "Mass Healing Word" in popup result', async () => {
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

      expect(result.payload.name).toBe('Mass Healing Word');
    });
  });

  // ── confirmMassHealingWord: maximization ────────────────────

  describe('maximization behavior', () => {
    it('uses rollExpressionMaximized when maximize is true', async () => {
      await confirmMassHealingWord({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          selectedTargetNames: ['Fighter'],
          healExpression: '2d6 + 3',
          maximize: true,
          bonusHeal: 0,
          bonusDetails: [],
          slotLevel: 3,
      });

      expect(rollExpressionMaximized).toHaveBeenCalledWith('2d6 + 3');
      expect(rollExpression).not.toHaveBeenCalled();
    });

    it('uses rollExpressionMaximized when hasHealingMaximizationForTarget is true', async () => {
      hasHealingMaximizationForTarget.mockReturnValue(true);

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

      expect(rollExpressionMaximized).toHaveBeenCalledWith('2d6 + 3');
      expect(rollExpression).not.toHaveBeenCalled();
    });

    it('uses normal rollExpression when neither maximization flag is set', async () => {
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

      expect(rollExpression).toHaveBeenCalledWith('2d6 + 3');
      expect(rollExpressionMaximized).not.toHaveBeenCalled();
    });

    it('prioritizes per-target maximization over global maximize', async () => {
      hasHealingMaximization.mockReturnValue(false);
      hasHealingMaximizationForTarget.mockReturnValue(true);

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

      expect(rollExpressionMaximized).toHaveBeenCalledWith('2d6 + 3');
    });
  });

  // ── confirmMassHealingWord: bonus healing ───────────────────

  describe('bonus healing', () => {
    it('adds bonusHeal to the roll total', async () => {
      const bonusHeal = 5;
      const bonusDetails = [{ name: 'Disciple of Life', amount: 5 }];
      const rollResult = { total: 12, rolls: [5, 4, 3] };
      rollExpression.mockReturnValue(rollResult);

      await confirmMassHealingWord({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          selectedTargetNames: ['Fighter'],
          healExpression: '2d6 + 3',
          maximize: false,
          bonusHeal,
          bonusDetails,
          slotLevel: 3,
      });

      // totalHeal = rollResult.total (12) + bonusHeal (5) = 17
      expect(applyHealingToTarget).toHaveBeenCalledWith(
        expect.any(Object),
        'Fighter',
        17,
        campaignName,
      );
    });

    it('includes bonusHeal in popup result', async () => {
      const bonusHeal = 5;
      const bonusDetails = [{ name: 'Disciple of Life', amount: 5 }];

      const result = await confirmMassHealingWord({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          selectedTargetNames: ['Fighter'],
          healExpression: '2d6 + 3',
          maximize: false,
          bonusHeal,
          bonusDetails,
          slotLevel: 3,
      });

      expect(result.payload.bonusHeal).toBe(5);
      expect(result.payload.bonusHealDetail).toContain('Disciple of Life');
    });

    it('returns empty bonusHealDetail when no bonus details', async () => {
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

      expect(result.payload.bonusHealDetail).toBe('');
    });

    it('includes bonus details in log formula', async () => {
      const bonusDetails = [{ name: 'Disciple of Life', amount: 5 }];
      resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 5, details: bonusDetails });

      await confirmMassHealingWord({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          selectedTargetNames: ['Fighter'],
          healExpression: '2d6 + 3',
          maximize: false,
          bonusHeal: 5,
          bonusDetails,
          slotLevel: 3,
      });

      const logEntry = addEntry.mock.calls[0][1];
      // formula should contain the base expression + bonus details
      expect(logEntry.formula).toContain('2d6 + 3');
      expect(logEntry.formula).toContain('Disciple of Life');
    });
  });

  // ── confirmMassHealingWord: Fortified Health ────────────────

  describe('Fortified Health tracking', () => {
    it('calls markFortifiedHealthUsed when healing occurred and Fortified Health bonus is present', async () => {
      const bonusDetails = [{ name: 'Fortified Health', amount: 5 }];

      await confirmMassHealingWord({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          selectedTargetNames: ['Fighter'],
          healExpression: '2d6 + 3',
          maximize: false,
          bonusHeal: 5,
          bonusDetails,
          slotLevel: 3,
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

      await confirmMassHealingWord({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          selectedTargetNames: ['Fighter'],
          healExpression: '2d6 + 3',
          maximize: false,
          bonusHeal: 5,
          bonusDetails,
          slotLevel: 3,
      });

      expect(markFortifiedHealthUsed).not.toHaveBeenCalled();
    });

    it('does not call markFortifiedHealthUsed when bonus is not Fortified Health', async () => {
      const bonusDetails = [{ name: 'Disciple of Life', amount: 5 }];

      await confirmMassHealingWord({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          selectedTargetNames: ['Fighter'],
          healExpression: '2d6 + 3',
          maximize: false,
          bonusHeal: 5,
          bonusDetails,
          slotLevel: 3,
      });

      expect(markFortifiedHealthUsed).not.toHaveBeenCalled();
    });

    it('does not call markFortifiedHealthUsed when no bonus details at all', async () => {
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

      expect(markFortifiedHealthUsed).not.toHaveBeenCalled();
    });
  });

  // ── confirmMassHealingWord: popup payload structure ─────────

  describe('popup payload structure', () => {
    it('returns correct popup payload structure', async () => {
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

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('heal_multi');
      expect(result.payload.name).toBe('Mass Healing Word');
      expect(result.payload.formula).toBe('2d6 + 3');
      expect(Array.isArray(result.payload.rolls)).toBe(true);
      expect(Array.isArray(result.payload.results)).toBe(true);
      expect(typeof result.payload.totalHealed).toBe('number');
    });

    it('includes roll details in each result', async () => {
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
      expect(Array.isArray(result.payload.results[0].rolls)).toBe(true);
    });

    it('aggregates all rolls into payload.rolls', async () => {
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

      expect(result.payload.rolls.length).toBeGreaterThan(0);
    });

    it('excludes rawTotal from payload result (only internal)', async () => {
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

      expect(result.payload.results[0].rawTotal).toBeUndefined();
      expect(result.payload.results[0].targetName).toBe('Fighter');
      expect(typeof result.payload.results[0].healAmount).toBe('number');
      expect(Array.isArray(result.payload.results[0].rolls)).toBe(true);
    });
  });
});
