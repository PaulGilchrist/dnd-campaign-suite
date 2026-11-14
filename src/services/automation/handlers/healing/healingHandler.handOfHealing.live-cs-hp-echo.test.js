// @maintained-by-ai
//
// ── LC 2026-11-14 improve (picker-stage echo) — GATE leg ──
// SUBJECT: monkHealTargetAtFullHp (healingHandler.js, reached through the
// CLA-163 picker payload's confirmHeal closure) resolving its row from the
// SSE-adopted combatData cache FIRST, the picker-open captured `cs` board only
// as fallback. The picker holds `cs` from the moment the sheet row was clicked;
// a mid-dwell combatSummary.creatures write left the gate on the open-moment
// rows — a stale full row REFUSED a legitimate heal (and a stale damaged row
// waved through a target the live board now calls full). The cache read mirrors
// the result-stage wake order (App.jsx syncCombatSummaryCache refreshes the
// cache before the store notify, so the cache is fresh by confirm time).
//
// Bucket-first precedence is UNCHANGED: currentHitPoints stays canonical, this
// file proves only the row-FALLBACK source is now live. No-cache and
// bucket-side faces are pinned in healingHandler.handOfHealing.full-hp-refusal
// .test.js (unchanged) — do NOT duplicate those.

import { describe, it, expect, vi, beforeEach } from 'vitest';

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

vi.mock('../../../rules/combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

// The live combatData cache — the SSE-adoption lane the picker tab wakes on.
vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
  getCombatContext: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn(async () => true),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
  resolveHealingBonusesWithDetails: vi.fn(),
  markFortifiedHealthUsed: vi.fn(),
  hasHealingMaximizationForTarget: vi.fn(),
  hasRerollHealingOnes: vi.fn(),
  hasTacticalShift: vi.fn(() => false),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../rules/effects/restRules.js', () => ({
  getHitDieSize: vi.fn(),
  computeHitDieRecovery: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

import { handle } from './healingHandler.js';
import * as diceRoller from '../../../dice/diceRoller.js';
import * as classFeatures from '../../../character/classFeatures.js';
import * as targetResolver from '../../common/targetResolver.js';
import * as healingRoll from '../../common/healingRoll.js';
import * as applyHealing from '../../../rules/combat/applyHealing.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as combatData from '../../../encounters/combatData.js';
import * as automationService from '../../../combat/automation/automationService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

const campaignName = 'test-campaign';

const monkStats = {
  name: 'Disciplined_Monk',
  rules: '2024',
  level: 20,
  proficiency: 6,
  currentHitPoints: 150,
  maxHitPoints: 183,
  abilities: [{ name: 'Wisdom', bonus: 7 }],
  specialActions: [],
};

const hohAction = {
  name: 'Hand of Healing',
  automation: {
    type: 'healing',
    healExpression: 'martial_arts_die + WIS modifier',
    action: 'bonus_action',
    resourceCost: 'focus_point',
  },
};

const monkCsRow = { name: 'Disciplined_Monk', type: 'player', currentHp: 150, maxHp: 183 };
const banditRow = (currentHp, maxHp = 11) => ({ name: 'Bandit 1', type: 'monster', currentHp, maxHp });

// Picker fixture: open the CLA-163 pending picker against the OPEN-MOMENT
// board; the live cache is then swapped mid-dwell to simulate the echo.
async function openPicker(capturedCs) {
  targetResolver.resolveTarget.mockResolvedValue(null);
  damageUtils.getCombatContext.mockResolvedValue(capturedCs);
  const result = await handle(hohAction, monkStats, campaignName, null, []);
  expect(result.type).toBe('modal');
  expect(result.payload.pending).toBe(true);
  return result.payload;
}

const midDwellEcho = (board) => combatData.getCombatSummary.mockReturnValue(board);

describe('HoH confirm-time full-HP gate — live combatSummary cache adoption', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    classFeatures.getClassFeatures.mockReturnValue({ martialArtsDie: 12 });
    diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
    automationService.resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 0, details: [] });
    automationService.hasHealingMaximizationForTarget.mockReturnValue(false);
    automationService.hasRerollHealingOnes.mockReturnValue(false);
    applyHealing.applyHealingToTarget.mockReturnValue({ actualHeal: 5, oldHp: 4, newHp: 9, maxHp: 11 });
    getRuntimeValue.mockImplementation((_name, key) => (key === 'focusPoints' ? 3 : null));
    // No adopted cache by default → every caller keeps its pre-fix captured-cs bytes.
    combatData.getCombatSummary.mockReturnValue(null);
  });

  it('mid-dwell cs ECHO damaging a mount-full row makes the heal land — the stale full row no longer refuses', async () => {
    const payload = await openPicker({ creatures: [monkCsRow, banditRow(11)] });
    // Foreign board write damages the monster mid-dwell (bucketless row — the
    // cs row is its entire HP truth).
    midDwellEcho({ creatures: [monkCsRow, banditRow(4)] });

    const result = await payload.confirmHeal('Bandit 1');

    expect(result.refusal).toBeUndefined();
    expect(result.targetName).toBe('Bandit 1');
    // Honest spend laws hold on the now-legitimate heal: 1 Focus, choke heal,
    // ability_use row.
    expect(setRuntimeValue).toHaveBeenCalledWith('Disciplined_Monk', 'focusPoints', 2, campaignName);
    expect(applyHealing.applyHealingToTarget).toHaveBeenCalled();
    expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({ type: 'ability_use' }));
  });

  it('mid-dwell cs ECHO healing a mount-damaged row to full refuses with the verbatim copy — zero spend, roll, heal, row', async () => {
    const payload = await openPicker({ creatures: [monkCsRow, banditRow(4)] });
    midDwellEcho({ creatures: [monkCsRow, banditRow(11)] });

    const result = await payload.confirmHeal('Bandit 1');

    expect(result).toEqual({ refusal: 'Bandit 1 is already at full HP. No focus spent.' });
    expect(diceRoller.rollExpression).not.toHaveBeenCalled();
    expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
    expect(healingRoll.logHealingToSSE).not.toHaveBeenCalled();
  });

  it('bucket stays canonical: a full bucket under a live damaged row still refuses (no stale-enable hole)', async () => {
    const fullRogueRow = { name: 'Fighting_Rogue', type: 'player', currentHp: 143, maxHp: 143 };
    const payload = await openPicker({ creatures: [monkCsRow, fullRogueRow] });
    midDwellEcho({ creatures: [monkCsRow, { ...fullRogueRow, currentHp: 40 }] });
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'focusPoints') return 3;
      if (name === 'Fighting_Rogue' && key === 'currentHitPoints') return 143;
      if (name === 'Fighting_Rogue' && key === 'hitPoints') return 143;
      return null;
    });

    const result = await payload.confirmHeal('Fighting_Rogue');

    expect(result).toEqual({ refusal: 'Fighting_Rogue is already at full HP. No focus spent.' });
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('no cache adopted (never-loaded / out-of-combat lane): the gate keeps its captured-cs bytes', async () => {
    const payload = await openPicker({ creatures: [monkCsRow, banditRow(11)] });
    // getCombatSummary stays null → fallback to the captured board, unchanged.

    const result = await payload.confirmHeal('Bandit 1');

    expect(result).toEqual({ refusal: 'Bandit 1 is already at full HP. No focus spent.' });
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });
});
