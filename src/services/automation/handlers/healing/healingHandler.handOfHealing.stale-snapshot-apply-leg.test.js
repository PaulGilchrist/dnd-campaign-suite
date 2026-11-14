// @maintained-by-ai
//
// ── MM 2026-11-14 fix (bug-hoh-negative-heal-stale-snapshot-clamp) ──
// SUBJECT: applyMonkHeal (healingHandler.js, reached through the CLA-163 picker
// payload's confirmHeal closure) — the APPLICATION leg must clamp against the
// SAME row the commit gate resolved (resolveMonkHealGateRow: SSE-adopted
// combatData cache first, dispatch snapshot fallback). The 9c3ec68ea echo made
// the GATE live-first but the application still clamped on the dispatch-
// captured board: a divergent dwell (snapshot row max 1 < bucket current 60 <
// live row max 112 — a fan-out placeholder under a seeded bucket, then a
// mid-dwell scoped PATCH /combatSummary) let the gate honestly allow the heal,
// after which min(bucket + roll, staleMax) = 1 wrote a NEGATIVE "heal" delta
// (live-proved 2026-11-14: EF drained 60→1, Focus 20→19, ability_use
// "(Already at full HP)", hp_change delta:-59 isHealing:true).
//
// The GATE-leg faces (stale-full refusal, raised-max allow, no-cache gate
// fallback) are pinned in healingHandler.handOfHealing.live-cs-hp-echo.test.js
// and .full-hp-refusal.test.js — do NOT duplicate those here; this file pins
// only the row the APPLICATION clamps on, the spend it buys, and the audit
// honesty.

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
const victimRow = (currentHp, maxHp) => ({ name: 'EvasiveFighter', type: 'player', currentHp, maxHp });
const banditRow = (currentHp, maxHp = 11) => ({ name: 'Bandit 1', type: 'monster', currentHp, maxHp });

// Divergent-dwell bucket mirror (live-proved 2026-11-14): bucket current 60,
// NO bucket max (the full-store POST /EvasiveFighter {value:{currentHitPoints:60}}
// replaced the whole bucket) — the row is the only max truth either leg reads.
const divergentBucket = () => getRuntimeValue.mockImplementation((name, key) => {
  if (key === 'focusPoints') return 20;
  if (name === 'EvasiveFighter' && key === 'currentHitPoints') return 60;
  return null;
});

async function openPicker(capturedCs) {
  targetResolver.resolveTarget.mockResolvedValue(null);
  damageUtils.getCombatContext.mockResolvedValue(capturedCs);
  const result = await handle(hohAction, monkStats, campaignName, null, []);
  expect(result.type).toBe('modal');
  expect(result.payload.pending).toBe(true);
  return result.payload;
}

const midDwellEcho = (board) => combatData.getCombatSummary.mockReturnValue(board);

describe('HoH application leg — clamps on the live row the gate resolved', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    classFeatures.getClassFeatures.mockReturnValue({ martialArtsDie: 12 });
    diceRoller.rollExpression.mockReturnValue({ total: 9, rolls: [9], modifier: 0 });
    automationService.resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 2, details: [] });
    automationService.hasHealingMaximizationForTarget.mockReturnValue(false);
    automationService.hasRerollHealingOnes.mockReturnValue(false);
    divergentBucket();
    // No adopted cache by default → the application keeps its captured-cs bytes.
    combatData.getCombatSummary.mockReturnValue(null);
    // The live-headroom honest outcome the fixed row choice makes possible
    // (bucket 60 + roll 9+7+2 = 18 → 78 of 112).
    applyHealing.applyHealingToTarget.mockReturnValue({ actualHeal: 18, oldHp: 60, newHp: 78, maxHp: 112 });
  });

  it('divergent dwell (snapshot max 1 < bucket 60 < live max 112): the clamp reads the LIVE row, never the stale snapshot', async () => {
    const capturedCs = { creatures: [monkCsRow, victimRow(1, 1)] };
    const payload = await openPicker(capturedCs);
    midDwellEcho({ creatures: [monkCsRow, victimRow(60, 112)] });

    const result = await payload.confirmHeal('EvasiveFighter');

    expect(result.refusal).toBeUndefined();
    expect(applyHealing.applyHealingToTarget).toHaveBeenCalledTimes(1);
    const [board, target, healAmount] = applyHealing.applyHealingToTarget.mock.calls[0];
    expect(target).toBe('EvasiveFighter');
    expect(healAmount).toBe(18); // 1d12(9) + WIS 7 + bonus 2 — roll math unchanged by the fix
    const appliedRow = board.creatures.find(c => c.name === 'EvasiveFighter');
    // THE regression pin: the row handed to the CLA-092 choke is the live cache
    // row (max 112 ≥ bucket 60) — clamping on the stale max 1 is what drained
    // the target 60→1 in the filed run.
    expect(appliedRow.maxHp).toBe(112);
    expect(appliedRow.currentHp).toBe(60);
    // Non-target rows keep the dispatch board.
    expect(board.creatures.find(c => c.name === 'Disciplined_Monk')).toBe(monkCsRow);
  });

  it('the divergent-dwell heal spends honestly: 1 Focus, positive audit, no "(Already at full HP)" contradiction', async () => {
    const payload = await openPicker({ creatures: [monkCsRow, victimRow(1, 1)] });
    midDwellEcho({ creatures: [monkCsRow, victimRow(60, 112)] });

    const result = await payload.confirmHeal('EvasiveFighter');

    // Focus: 20 → 19 — spent FOR a real heal (the filed run spent it on a −59 drain).
    expect(setRuntimeValue).toHaveBeenCalledWith('Disciplined_Monk', 'focusPoints', 19, campaignName);
    // hp_change flows through logHealingToSSE with the clamped positive heal.
    expect(healingRoll.logHealingToSSE).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      targetName: 'EvasiveFighter',
      actualHeal: 18,
      newHp: 78,
      maxHp: 112,
    }));
    // ability_use audit: "Regained 18 HP", never "(Already at full HP)" beside a spend.
    const abilityUse = addEntry.mock.calls.find(([, entry]) => entry.type === 'ability_use');
    expect(abilityUse[1].description).toContain('1d12 + 7 + 2 = 18 (Regained 18 HP)');
    expect(abilityUse[1].description).not.toContain('Already at full HP');
    // Result-stage payload face: (78 / 112 HP), +18 restored.
    expect(result).toMatchObject({ targetName: 'EvasiveFighter', actualHeal: 18, targetCurrentHp: 78, targetMaxHp: 112 });
  });

  it('no cache adopted (never-loaded / out-of-combat lane): the application keeps its captured-cs bytes', async () => {
    const capturedCs = { creatures: [monkCsRow, banditRow(4)] };
    const payload = await openPicker(capturedCs);
    // getCombatSummary stays null → resolveMonkHealGateRow answers the cs row
    // itself, so the re-anchored board deep-equals the captured one (pre-fix
    // bytes, mirroring the gate's documented fallback).
    applyHealing.applyHealingToTarget.mockReturnValue({ actualHeal: 7, oldHp: 4, newHp: 11, maxHp: 11 });

    const result = await payload.confirmHeal('Bandit 1');

    expect(result.refusal).toBeUndefined();
    expect(applyHealing.applyHealingToTarget).toHaveBeenCalledWith(capturedCs, 'Bandit 1', 18, campaignName);
  });
});
