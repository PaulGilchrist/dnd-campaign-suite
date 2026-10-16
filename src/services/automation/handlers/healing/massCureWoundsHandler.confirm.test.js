// @maintained-by-ai
// Confirm lane of the massCureWounds pair: sibling massCureWoundsHandler.test.js owns
// handle() opener routing (expression/modifier resolution, modal-vs-popup dispatch).
// This file owns confirmMassCureWounds() application behaviour via massHealUtils.confirmFn:
// per-target clamp/apply, maxTargets slicing, hp_change logging, popup payload shape,
// maximization branch, CLA-038 post-cast caller gating. Fortified Health consumption
// (finalizePrayerPostCast) is owned by the prayerOfHealing latch lane — not re-pinned here.
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

vi.mock('../../../rules/spells/postCastHealService.js', () => ({
  triggerPostCastSelfHeals: vi.fn(() => Promise.resolve(null)),
}));

// ── Imports ────────────────────────────────────────────────────

import { confirmMassCureWounds } from './massCureWoundsHandler.js';
import { rollExpression, rollExpressionMaximized } from '../../../dice/diceRoller.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { applyHealingToTarget } from '../../../rules/combat/applyHealing.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { hasHealingMaximizationForTarget } from '../../../combat/automation/automationService.js';
import { triggerPostCastSelfHeals } from '../../../rules/spells/postCastHealService.js';

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

// Overrides MERGE into nested spell/automation — never replace them wholesale.
function makeAction(overrides = {}) {
  const { spell: spellOverrides, automation: automationOverrides, ...rest } = overrides;
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
      ...spellOverrides,
    },
    automation: { type: 'mass_cure_wounds', ...automationOverrides },
    ...rest,
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
    applyHealingToTarget.mockReturnValue({ actualHeal: 18, oldHp: 20, newHp: 38 });
  });

  // ── Basic healing ──────────────────────────────────────────

  describe('basic healing', () => {
    it('caps healing at missing HP', async () => {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'currentHitPoints') {
          if (name === 'Fighter') return 44;
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

      // 45 max − 44 current = 1 missing: raw 18 clamps to exactly 1.
      expect(result.payload.results[0].healAmount).toBe(1);
      expect(applyHealingToTarget).toHaveBeenCalledWith(
        expect.any(Object),
        'Fighter',
        1,
        campaignName,
      );
    });

    it('respects maxTargets by slicing selected targets', async () => {
      const result = await confirmMassCureWounds({
          action: makeAction({ automation: { maxTargets: 2 } }),
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

    it('logs one hp_change entry per target with caster as source', async () => {
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
      expect(hpLogs.map((call) => call[1].targetName)).toEqual(['Fighter', 'Rogue', 'Barbarian']);
      for (const [, entry] of hpLogs) {
        expect(entry).toEqual(expect.objectContaining({
          isHealing: true,
          sourceName: 'TestCleric',
          note: 'Mass Cure Wounds',
        }));
        // No bonus details → formula is the bare heal expression.
        expect(entry.formula).toBe('3d8 + 3');
        expect(entry.bonusDetails).toBeUndefined();
      }
      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.any(Object));
      expect(addEntry).toHaveBeenCalledTimes(3);
    });

    it('logs formula including bonus details when present', async () => {
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

      const logEntry = addEntry.mock.calls.find((call) => call[1].type === 'hp_change')[1];
      expect(logEntry.formula).toBe('3d8 + 3 + (5 Disciple of Life)');
      expect(logEntry.bonusDetails).toEqual(bonusDetails);
    });

    it('applies healing via applyHealingToTarget for each target', async () => {
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

      // Fighter: 45−20 missing, full 18. Rogue: 30−20 missing, clamped to 10.
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
          return 20;
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

      // Only the damaged Rogue receives healing; the full-HP Fighter is untouched.
      expect(applyHealingToTarget).toHaveBeenCalledTimes(1);
      expect(applyHealingToTarget).toHaveBeenCalledWith(
        expect.any(Object),
        'Rogue',
        10,
        campaignName,
      );
    });

    it('dispatches combat-summary-updated event', async () => {
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

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

      expect(dispatchSpy).toHaveBeenCalledTimes(1);
      expect(dispatchSpy.mock.calls[0][0].type).toBe('combat-summary-updated');

      dispatchSpy.mockRestore();
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
    it('adds bonusHeal to the roll total and reports it in the popup', async () => {
      const result = await confirmMassCureWounds({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          selectedTargetNames: ['Fighter'],
          healExpression: '3d8 + 3',
          maximize: false,
          bonusHeal: 5,
          bonusDetails: [{ name: 'Disciple of Life', amount: 5 }],
          slotLevel: 5,
      });

      // totalHeal = rollResult.total (18) + bonusHeal (5) = 23, within missing HP.
      expect(applyHealingToTarget).toHaveBeenCalledWith(
        expect.any(Object),
        'Fighter',
        23,
        campaignName,
      );
      expect(result.payload.bonusHeal).toBe(5);
      expect(result.payload.bonusHealDetail).toBe('5 Disciple of Life');
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

      expect(result.payload.bonusHeal).toBe(0);
      expect(result.payload.bonusHealDetail).toBe('');
    });
  });

  // ── Popup payload structure ────────────────────────────────

  describe('popup payload structure', () => {
    it('returns exact heal_multi payload with per-target results and aggregated rolls', async () => {
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

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'heal_multi',
          name: 'Mass Cure Wounds',
          formula: '3d8 + 3',
          // Each target rolls once; rolls aggregate in target order.
          rolls: [6, 7, 5, 6, 7, 5],
          // rawTotal is internal-only — never surfaces on payload results.
          results: [
            { targetName: 'Fighter', healAmount: 18, rolls: [6, 7, 5] },
            { targetName: 'Rogue', healAmount: 10, rolls: [6, 7, 5] },
          ],
          totalHealed: 28,
          bonusHeal: 0,
          bonusHealDetail: '',
        },
      });
    });
  });

  // ── Edge cases ─────────────────────────────────────────────

  describe('edge cases', () => {
    it('skips targets whose roll returns null', async () => {
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

      expect(result.payload.results).toEqual([]);
      expect(result.payload.totalHealed).toBe(0);
      expect(applyHealingToTarget).not.toHaveBeenCalled();
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

    it('treats empty-string currentHp as max HP (no healing, no crash)', async () => {
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

      // '' → treated as full HP (45), so the roll clamps to zero, not Number('') = 0.
      expect(result.payload.results[0].healAmount).toBe(0);
      expect(applyHealingToTarget).not.toHaveBeenCalled();
    });

    it('treats null currentHp as max HP (no healing, no crash)', async () => {
      getRuntimeValue.mockImplementation(() => null);

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

      expect(result.payload.results[0].healAmount).toBe(0);
      expect(applyHealingToTarget).not.toHaveBeenCalled();
    });

    it('falls back to player hitPoints when combat-summary creature has no maxHp', async () => {
      getCombatContext.mockResolvedValue({
        players: [],
        creatures: [{ name: 'Fighter', type: 'player' }],
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

      // maxHp falls back to playerStats.hitPoints (50); missing 30 ≥ roll 18.
      expect(result.payload.results[0].healAmount).toBe(18);
      expect(applyHealingToTarget).toHaveBeenCalledWith(
        expect.any(Object),
        'Fighter',
        18,
        campaignName,
      );
    });

    it('survives log entry rejections (heals still applied)', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      addEntry.mockRejectedValueOnce(new Error('Log error'));

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

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(result.payload.results).toHaveLength(2);

      errorSpy.mockRestore();
    });
  });

  // ── CLA-038: Blessed Healer post-cast self-heal ─────────────
  describe('CLA-038 post-cast self-heal trigger', () => {
    it('triggers post-cast self-heals after healing others', async () => {
      const playerStats = makePlayerStats();
      await confirmMassCureWounds({
          action: makeAction(),
          playerStats,
          campaignName,
          selectedTargetNames: ['Fighter', 'Rogue'],
          healExpression: '3d8 + 3',
          maximize: false,
          bonusHeal: 0,
          bonusDetails: [],
          slotLevel: 5,
      });

      expect(triggerPostCastSelfHeals).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Mass Cure Wounds' }),
        { slotLevel: 5, targetNames: expect.arrayContaining(['Fighter', 'Rogue']) },
        playerStats,
        campaignName,
        undefined,
      );
    });

    it('does not trigger post-cast self-heals when caster is the only healed target', async () => {
      await confirmMassCureWounds({
          action: makeAction(),
          playerStats: makePlayerStats(),
          campaignName,
          selectedTargetNames: ['TestCleric'],
          healExpression: '3d8 + 3',
          maximize: false,
          bonusHeal: 0,
          bonusDetails: [],
          slotLevel: 5,
      });

      expect(triggerPostCastSelfHeals).not.toHaveBeenCalled();
    });

    it('does not trigger when no target was actually healed', async () => {
      getRuntimeValue.mockImplementation(() => null);

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

      expect(triggerPostCastSelfHeals).not.toHaveBeenCalled();
    });
  });
});
