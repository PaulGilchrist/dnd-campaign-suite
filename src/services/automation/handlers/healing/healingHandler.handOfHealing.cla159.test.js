// @maintained-by-ai 2026-11-27
//
// ── CLA-159 standalone Hand of Healing lane — healingHandler.js seams ─────
// SUBJECT: handleMonkHealing / performMonkHeal / applyMonkHeal / collectTouchTargets
// in healingHandler.js, reached via handle()'s isMonkHealing dispatch
// (healExpression includes 'martial_arts_die' && 'WIS'; type 'healing' so
// isSelf=false). Production caller: src/services/automation/index.js
// `healing:` / `self_healing:` → handleHealing. LIVE, verified 2026-10-15.
//
// This lane owns (the trio the sibling headers all point back here for):
//   - CLA-160 armed initiative-card target honored → CLA-092 canonical
//     applyHealingToTarget choke + canonical lv20 d12 formula (full-shape
//     result modal, SSE heal row, exact-string log row, single-FP census)
//   - CLA-163 picker seam: unarmed dispatch presents the pending picker with
//     its exact payload shape and ZERO side effects before confirmHeal
//   - picker-skip damaged self confirms through the same choke with the
//     canonical d12+WIS formula and the Focus Point spend row
//
// NOT owned here (sibling lanes pin these STRONGER — do NOT re-absorb;
// lane map in healingHandler.battleMedic.test.js):
//   full-hp-refusal.test.js  → confirm-time refusal family (full-HP/drain
//                              gates, zero-spend censuses, 5e ki wording,
//                              out-of-combat self lanes incl. the CLA-092
//                              applyHealingDirectly fallback)
//   touchTargetLiveHp.test.js→ picker row DISPLAY bucket-first + the 5ft
//                              isWithinRange eligibility filter + self
//                              short-circuit + ally write-lane via confirm
//   live-cs-hp-echo / stale-snapshot-apply-leg → gate/application row-source
//                              under mid-dwell board echoes
//   monk.test.js (#1811)     → isSelf=true shortcut, martialArtsDie ladder,
//                              bonus weaving, Physician's Touch presence
//   secondWind (#1812) / tacticalShift (#1813) / targeted (#1814) /
//   healingHandler.test.js (#1815) / battleMedic (kit silent self-default)
//
// Deterministic: all seams mocked (incl. the combatData live-cache read, so
// the no-cache-adopted precondition is explicit), FROZEN Date.now, no timers,
// no fetch reachable from this lane. The applyHealingToTarget mock CLAMPS
// from its board argument per fixture — no mirrored hardcoded amounts
// (run2#1828-#1831 mispaint class).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

// Choke stand-in: clamps against the row in the board it is PASSED, so every
// fixture's actualHeal/newHp are computed, never hardcoded (the real choke's
// clamp semantics; the clamp row-source is owned by stale-snapshot-apply-leg).
vi.mock('../../../rules/combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn((board, targetName, healAmount) => {
    const row = board.creatures.find(c => c.name === targetName);
    const oldHp = row.currentHp;
    const newHp = Math.min(oldHp + healAmount, row.maxHp);
    return { actualHeal: newHp - oldHp, oldHp, newHp, maxHp: row.maxHp };
  }),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

// This lane never adopts a live cache: the gate/application fall back to the
// captured cs (the cache-adoption faces belong to live-cs-hp-echo /
// stale-snapshot-apply-leg).
vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
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
import * as rangeCheck from '../../../rules/combat/rangeCheck.js';
import * as automationService from '../../../combat/automation/automationService.js';
import { addEntry } from '../../../ui/logService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

const campaignName = 'test-campaign';
const FROZEN_NOW = 1750000000000;

const monkStats = {
  name: 'Disciplined_Monk',
  rules: '2024',
  level: 20,
  proficiency: 6,
  currentHitPoints: 183,
  maxHitPoints: 183,
  abilities: [{ name: 'Wisdom', bonus: 7 }],
  specialActions: [{ name: 'Flurry of Healing and Harm' }, { name: "Physician's Touch" }],
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

const woundedBandit = { name: 'Bandit 1', type: 'monster', currentHp: 1, maxHp: 11 };
const monkCsEntry = { name: 'Disciplined_Monk', type: 'player', currentHp: 183, maxHp: 183 };
const combatCs = { creatures: [monkCsEntry, woundedBandit], round: 1, activeCreatureName: 'Disciplined_Monk' };

describe('CLA-159 standalone Hand of Healing lane', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // audit rows pin timestamp: Date.now() exactly
    vi.spyOn(Date, 'now').mockReturnValue(FROZEN_NOW);
    // Focus pool readable (the commit lane is the sole FP writer now); every
    // other bucket reads null → cs-row fallback (bucket-first law's no-bucket
    // face; bucket-wins faces belong to touchTargetLiveHp/full-hp-refusal).
    getRuntimeValue.mockImplementation((_name, key) => (key === 'focusPoints' ? 3 : null));
    // 2024 lv20 Martial Arts die is d12 (classes.json ladder verified)
    classFeatures.getClassFeatures.mockReturnValue({ martialArtsDie: 12 });
    diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
    automationService.resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 0, details: [] });
    automationService.hasHealingMaximizationForTarget.mockReturnValue(false);
    automationService.hasRerollHealingOnes.mockReturnValue(false);
    rangeCheck.isWithinRange.mockImplementation(async () => true);
    combatData.getCombatSummary.mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('honors the initiative-armed target (CLA-160): full commit via the CLA-092 choke with the canonical lv20 d12 formula', async () => {
    targetResolver.resolveTarget.mockResolvedValue({ target: woundedBandit, cs: combatCs });
    damageUtils.getCombatContext.mockResolvedValue(combatCs);

    const result = await handle(hohAction, monkStats, campaignName, null, []);

    // Roll 5 + WIS 7 = 12; bandit clamps 1/11 → 11 (choke computes per board).
    expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d12');
    expect(applyHealing.applyHealingToTarget).toHaveBeenCalledWith(combatCs, 'Bandit 1', 12, campaignName);
    expect(result).toEqual({
      type: 'modal',
      modalName: 'handOfHealing',
      payload: {
        healName: 'Hand of Healing',
        formula: '1d12 + 7',
        rolls: [5],
        bonus: 7,
        healAmount: 12,
        actualHeal: 10,
        monkName: 'Disciplined_Monk',
        targetName: 'Bandit 1',
        targetCurrentHp: 11,
        targetMaxHp: 11,
        hasPhysiciansTouch: true,
        rerollOnes: false,
      },
    });
    expect(healingRoll.logHealingToSSE).toHaveBeenCalledWith(campaignName, {
      targetName: 'Bandit 1',
      sourceName: 'Hand of Healing',
      actualHeal: 10,
      newHp: 11,
      maxHp: 11,
      rollInfo: '1d12=5 (5)',
      maximize: false,
      healingName: 'Hand of Healing',
      skipPopup: true,
      bonusDetails: [],
    });
    expect(addEntry).toHaveBeenCalledWith(campaignName, {
      type: 'ability_use',
      characterName: 'Disciplined_Monk',
      abilityName: 'Hand of Healing',
      description: 'Disciplined_Monk expended 1 Focus Point to use Hand of Healing on Bandit 1: 1d12 + 7 = 12 (Regained 10 HP).',
      timestamp: FROZEN_NOW,
    });
    // Sole Focus write for the commit: storedFP 3 → 2, nothing else written.
    expect(setRuntimeValue.mock.calls).toEqual([
      ['Disciplined_Monk', 'focusPoints', 2, campaignName],
    ]);
  });

  it('presents the pending picker when unarmed (CLA-163), exact payload shape and zero side effects before confirmHeal', async () => {
    targetResolver.resolveTarget.mockResolvedValue(null);
    damageUtils.getCombatContext.mockResolvedValue(combatCs);

    const result = await handle(hohAction, monkStats, campaignName, null, []);

    expect(result).toEqual({
      type: 'modal',
      modalName: 'handOfHealing',
      payload: {
        pending: true,
        healName: 'Hand of Healing',
        monkName: 'Disciplined_Monk',
        creatureTargets: [
          // no bucket data → cs-row fallback; self offered alongside
          { name: 'Disciplined_Monk', type: 'player', currentHp: 183, maxHp: 183 },
          { name: 'Bandit 1', type: 'monster', currentHp: 1, maxHp: 11 },
        ],
        hasPhysiciansTouch: true,
        confirmHeal: expect.any(Function),
      },
    });
    // The picker itself commits NOTHING: no roll, no heal, no FP write, no row.
    expect(diceRoller.rollExpression).not.toHaveBeenCalled();
    expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled();
    expect(healingRoll.applyHealingDirectly).not.toHaveBeenCalled();
    expect(healingRoll.logHealingToSSE).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
    expect(setRuntimeValue.mock.calls).toEqual([]);
  });

  it('picker-skip on a DAMAGED self confirms through the choke with the canonical d12+WIS formula and the Focus spend row', async () => {
    targetResolver.resolveTarget.mockResolvedValue(null);
    const damagedCs = {
      ...combatCs,
      creatures: [{ ...monkCsEntry, currentHp: 150 }, woundedBandit],
    };
    damageUtils.getCombatContext.mockResolvedValue(damagedCs);

    const result = await handle(hohAction, monkStats, campaignName, null, []);
    const payload = await result.payload.confirmHeal('Disciplined_Monk');

    expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d12');
    // Self-selection takes the SAME cs choke lane (applyHealingDirectly stays
    // owned by the isSelf shortcut in monk.test.js and out-of-combat in
    // full-hp-refusal).
    expect(applyHealing.applyHealingToTarget).toHaveBeenCalledWith(damagedCs, 'Disciplined_Monk', 12, campaignName);
    expect(healingRoll.applyHealingDirectly).not.toHaveBeenCalled();
    // confirmHeal unwraps the result modal payload for the picker.
    expect(payload).toEqual({
      healName: 'Hand of Healing',
      formula: '1d12 + 7',
      rolls: [5],
      bonus: 7,
      healAmount: 12,
      actualHeal: 12,
      monkName: 'Disciplined_Monk',
      targetName: 'Disciplined_Monk',
      targetCurrentHp: 162,
      targetMaxHp: 183,
      hasPhysiciansTouch: true,
      rerollOnes: false,
    });
    expect(addEntry).toHaveBeenCalledWith(campaignName, {
      type: 'ability_use',
      characterName: 'Disciplined_Monk',
      abilityName: 'Hand of Healing',
      description: 'Disciplined_Monk expended 1 Focus Point to use Hand of Healing on Disciplined_Monk: 1d12 + 7 = 12 (Regained 12 HP).',
      timestamp: FROZEN_NOW,
    });
    expect(setRuntimeValue.mock.calls).toEqual([
      ['Disciplined_Monk', 'focusPoints', 2, campaignName],
    ]);
  });
});
