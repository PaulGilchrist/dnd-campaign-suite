// @maintained-by-ai
// Confirm lane of the massHealingWord trio (#1820; siblings: integration #1821, main #1822).
// massHealingWordHandler.js is a thin config wrapper around massHealUtils.createMassHealHandler —
// confirmMassHealingWord IS the factory confirmFn, the same code path as confirmMassCureWounds.
// The shared confirmFn contract (missing-HP clamp, per-target apply, maxTargets slicing, one
// hp_change per target, full-HP skip, combat-summary-updated dispatch, maximize branch selection,
// exact heal_multi payload shape, CLA-038 post-cast caller gate) is canonically pinned in
// massCureWoundsHandler.confirm.test.js. Fortified Health consumption via finalizePrayerPostCast
// is owned by the prayerOfHealing latch lane (prayerOfHealingHandler.test.js,
// prayerOfHealingService.results.test.js) — the FH quartet here was removed under the carried
// flag. What remains are Mass Healing Word deltas only: spell config flowing through confirm —
// exact payload ('Mass Healing Word' / '2d6 + 3'; rawTotal never surfaces on payload results),
// exact bonus composition on the spell's own dice, and per-target maximization landing real
// numbers.
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
import { hasHealingMaximizationForTarget } from '../../../combat/automation/automationService.js';

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
      ...spellOverrides,
    },
    automation: { type: 'mass_healing_word', ...automationOverrides },
    ...rest,
  };
}

function confirm(input = {}) {
  return confirmMassHealingWord({
    action: makeAction(),
    playerStats: makePlayerStats(),
    campaignName,
    selectedTargetNames: ['Fighter'],
    healExpression: '2d6 + 3',
    maximize: false,
    bonusHeal: 0,
    bonusDetails: [],
    slotLevel: 3,
    ...input,
  });
}

// ── Tests ──────────────────────────────────────────────────────

describe('confirmMassHealingWord — Mass Healing Word deltas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rollExpression.mockReturnValue({ total: 12, rolls: [5, 4, 3], modifier: 0 });
    rollExpressionMaximized.mockReturnValue({ total: 18, rolls: [6, 6, 6], modifier: 0 });
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
  });

  it('casts bare on two targets: exact heal_multi payload and one hp_change log per target', async () => {
    const result = await confirm({ selectedTargetNames: ['Fighter', 'Rogue'] });

    // rawTotal is internal-only — the exact toEqual below pins that it never
    // surfaces on payload results, alongside rolls/results/totalHealed shape.
    expect(result).toEqual({
      type: 'popup',
      payload: {
        type: 'heal_multi',
        name: 'Mass Healing Word',
        formula: '2d6 + 3',
        // Each target rolls once; rolls aggregate in target order.
        rolls: [5, 4, 3, 5, 4, 3],
        results: [
          { targetName: 'Fighter', healAmount: 12, rolls: [5, 4, 3] },
          // Rogue missing 30−20 = 10: full 12 clamps to 10.
          { targetName: 'Rogue', healAmount: 10, rolls: [5, 4, 3] },
        ],
        totalHealed: 22,
        bonusHeal: 0,
        bonusHealDetail: '',
      },
    });

    // No bonus details → bare spell formula on the spell's own dice; caster is source.
    expect(addEntry.mock.calls).toEqual([
      [campaignName, expect.objectContaining({
        type: 'hp_change',
        targetName: 'Fighter',
        delta: 12,
        currentHp: 32,
        maxHp: 45,
        isHealing: true,
        sourceName: 'TestCleric',
        note: 'Mass Healing Word',
        formula: '2d6 + 3',
        bonusDetails: undefined,
        timestamp: expect.any(Number),
      })],
      [campaignName, expect.objectContaining({
        type: 'hp_change',
        targetName: 'Rogue',
        delta: 10,
        currentHp: 30,
        maxHp: 30,
        isHealing: true,
        sourceName: 'TestCleric',
        note: 'Mass Healing Word',
        formula: '2d6 + 3',
        bonusDetails: undefined,
        timestamp: expect.any(Number),
      })],
    ]);
  });

  it('applies and logs bonus healing on the spell dice: full formula "2d6 + 3 + (5 Disciple of Life)"', async () => {
    const bonusDetails = [{ name: 'Disciple of Life', amount: 5 }];

    const result = await confirm({ bonusHeal: 5, bonusDetails });

    // roll 12 + bonus 5 = 17, within Fighter's missing 25.
    expect(applyHealingToTarget).toHaveBeenCalledWith(
      expect.any(Object),
      'Fighter',
      17,
      campaignName,
    );
    expect(result.payload.bonusHeal).toBe(5);
    expect(result.payload.bonusHealDetail).toBe('5 Disciple of Life');

    const [, logEntry] = addEntry.mock.calls[0];
    expect(logEntry.formula).toBe('2d6 + 3 + (5 Disciple of Life)');
    expect(logEntry.delta).toBe(17);
    expect(logEntry.currentHp).toBe(37);
    expect(logEntry.bonusDetails).toEqual(bonusDetails);
  });

  it('prioritizes per-target maximization over global maximize and lands the maximized roll', async () => {
    hasHealingMaximizationForTarget.mockReturnValue(true);

    const result = await confirm({ maximize: false });

    expect(rollExpressionMaximized).toHaveBeenCalledWith('2d6 + 3');
    expect(rollExpression).not.toHaveBeenCalled();
    // Maximized total 18 (vs normal 12) lands in the heal and the payload.
    expect(result.payload.results[0].healAmount).toBe(18);
    expect(result.payload.results[0].rolls).toEqual([6, 6, 6]);
    expect(applyHealingToTarget).toHaveBeenCalledWith(
      expect.any(Object),
      'Fighter',
      18,
      campaignName,
    );
  });
});
