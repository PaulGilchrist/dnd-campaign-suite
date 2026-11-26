// @maintained-by-ai 2026-11-14
// Audit hygiene (2026-11-14 MM bullet, follow-up to bug-hoh-negative-heal-stale-
// snapshot-clamp): the sign of the written delta is the truth for the isHealing
// stamp (healingRoll.js:88 law). massHealUtils.healMassTarget clamps
// actualHeal = min(roll + bonus, maxHp - currentHp) — a full-HP target lands on
// 0 (an over-cap stored row even below 0) and its hp_change row must NEVER
// stamp isHealing:true. The delta-0 over-log itself stays (renderer 'No HP
// Change' fourth arm, LogHpHealingEntry.jsx #880).
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports (scaffolding mirrored from
// massCureWoundsHandler.confirm.test.js) ────────────────────────

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
import { rollExpression } from '../../../dice/diceRoller.js';
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

function makeAction() {
  return {
    name: 'Mass Cure Wounds',
    spell: { name: 'Mass Cure Wounds', level: 5, heal_at_slot_level: { '5': '3d8 + MOD' } },
    automation: { type: 'mass_cure_wounds' },
  };
}

const hpRows = () => addEntry.mock.calls.filter(call => call[1].type === 'hp_change');

// ── Tests ──────────────────────────────────────────────────────

describe('massHealUtils isHealing sign-stamp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rollExpression.mockReturnValue({ total: 18, rolls: [6, 7, 5], modifier: 0 });
    getCombatContext.mockResolvedValue({
      players: [{ name: 'TestCleric', gridX: 1, gridY: 1 }],
      creatures: [
        { name: 'Fighter', maxHp: 45, currentHp: 20, type: 'player' },
        { name: 'Rogue', maxHp: 30, currentHp: 10, type: 'player' },
      ],
    });
    hasHealingMaximizationForTarget.mockReturnValue(false);
    applyHealingToTarget.mockReturnValue({ actualHeal: 18, oldHp: 20, newHp: 38 });
  });

  it('full-HP target: honest delta-0 row with isHealing:false, zero apply; positive twin keeps isHealing:true', async () => {
    getRuntimeValue.mockImplementation((name, prop) => {
      if (prop === 'currentHitPoints') return name === 'Fighter' ? 45 : 10;
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

    const rows = hpRows();
    expect(rows).toHaveLength(2);
    const fullRow = rows.find(r => r[1].targetName === 'Fighter')[1];
    expect(fullRow).toMatchObject({ delta: 0, currentHp: 45, maxHp: 45, isHealing: false });
    expect(applyHealingToTarget).not.toHaveBeenCalledWith(expect.anything(), 'Fighter', expect.anything(), campaignName);

    const healedRow = rows.find(r => r[1].targetName === 'Rogue')[1];
    expect(healedRow).toMatchObject({ delta: 18, isHealing: true });
  });

  it('over-cap stored row (negative headroom): delta is signed-honest, never claims healing', async () => {
    getRuntimeValue.mockImplementation((_name, prop) => {
      if (prop === 'currentHitPoints') return 50; // stored 50 > row max 45
      return null;
    });

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

    const row = hpRows()[0][1];
    expect(row.delta).toBeLessThanOrEqual(0);
    expect(row.isHealing).toBe(false);
    expect(applyHealingToTarget).not.toHaveBeenCalled();
  });
});
