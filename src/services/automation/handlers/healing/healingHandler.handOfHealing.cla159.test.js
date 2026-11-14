// @maintained-by-ai
//
// ── CLA-159 standalone Hand of Healing lane — healingHandler.js seams ─────
// SUBJECT: handleMonkHealing / performMonkHeal / applyMonkHeal / collectTouchTargets
// in healingHandler.js, reached via handle()'s isMonkHealing dispatch
// (healExpression includes 'martial_arts_die' && 'WIS'; type 'healing' so
// isSelf=false). Production caller: src/services/automation/index.js
// `healing:` / `self_healing:` → handleHealing. LIVE, verified 2026-10-15.
//
// This lane owns:
//   - CLA-160 armed initiative-card target honored → CLA-092 canonical
//     applyHealingToTarget choke + canonical lv20 d12 formula (pinned exact)
//   - CLA-163 touch-range picker when unarmed: pending modal, NO roll or
//     heal before confirmHeal, self remains selectable, 5ft range filter via
//     isWithinRange
//   - picker confirm path: d12+WIS roll, choke application, SSE log, Focus
//     Point spend addEntry; full-HP targets REFUSED at confirm time with zero
//     spend/zero row (HoH pre-spend-at-full-HP improve — commit lane owns the
//     Focus write; the row-click lane only gates pool exhaustion)
//   - CLA-092 out-of-combat fallback (no combatSummary → applyHealingDirectly
//     to self, choke NOT called)
//
// Sibling suites on this module (lane map in healingHandler.battleMedic.test.js;
// do NOT duplicate their lanes):
//   #1811 monk.test.js         → modal payload basics, martialArtsDie defaults,
//                                 Physician's Touch (self_healing isSelf=true shortcuts)
//   #1812 secondWind.test.js   → handleSelfHealing generic self branch
//   #1813 tacticalShift.test.js→ triggerTacticalShift on Second Wind
//   #1814 targeted.test.js     → handleUsesHealing / handleFlatHeal
//   #1815 healingHandler.test.js → self-path gates, uses tracking, hit_die_roll
//   battleMedic.test.js        → handleHealersKit kit seam (retains the silent
//                                 self-default that CLA-159 removed from this monk
//                                 lane — quirk pinned there, NOT here)
//   bonusAttacksHandler.cla144 → MONK FEATURE lane flurry-of-healing, distinct
//                                 module; no shared seam with this file.
//
// Deterministic: all seams mocked, no timers, no fetch reachable from this
// lane (fetchTargetCharacterData lives on the kit path only).

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
import * as rangeCheck from '../../../rules/combat/rangeCheck.js';
import * as automationService from '../../../combat/automation/automationService.js';
import { addEntry } from '../../../ui/logService.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

const campaignName = 'test-campaign';

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
    // Focus pool readable (the commit lane is the sole FP writer now): stored
    // focusPoints wins, everything else falls through to the cs-row/HP-truth
    // precedence the bucket-first law pins.
    getRuntimeValue.mockImplementation((_name, key) => (key === 'focusPoints' ? 3 : null));
    // 2024 lv20 Martial Arts die is d12 (classes.json ladder verified)
    classFeatures.getClassFeatures.mockReturnValue({ martialArtsDie: 12 });
    diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
    automationService.resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 0, details: [] });
    automationService.hasHealingMaximizationForTarget.mockReturnValue(false);
    automationService.hasRerollHealingOnes.mockReturnValue(false);
    rangeCheck.isWithinRange.mockImplementation(async () => true);
    healingRoll.applyHealingDirectly.mockReturnValue({ newHp: 100, maxHp: 183, actualHeal: 5 });
    applyHealing.applyHealingToTarget.mockReturnValue({ actualHeal: 5, oldHp: 1, newHp: 6, maxHp: 11 });
  });

  it('honors the initiative-armed target (CLA-160 lane): heals it via applyHealingToTarget choke', async () => {
    targetResolver.resolveTarget.mockResolvedValue({ target: woundedBandit, cs: combatCs });
    damageUtils.getCombatContext.mockResolvedValue(combatCs);

    const result = await handle(hohAction, monkStats, campaignName, null, []);

    expect(result.type).toBe('modal');
    expect(result.payload.pending).toBeUndefined();
    expect(result.payload.targetName).toBe('Bandit 1');
    // Canonical lv20 d12 die axis (roll 5 + WIS 7 = 12 on the choke);
    // 1d10 ladder regression disproved by the exact-string pin below and
    // by the picker-confirm test's identical formula.
    expect(result.payload.formula).toBe('1d12 + 7');
    expect(applyHealing.applyHealingToTarget).toHaveBeenCalledWith(combatCs, 'Bandit 1', 12, campaignName);
    expect(healingRoll.logHealingToSSE).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      targetName: 'Bandit 1',
      actualHeal: 5,
    }));
  });

  it('presents a target picker when no armed target (CLA-163 seam): no roll, no heal before confirm', async () => {
    targetResolver.resolveTarget.mockResolvedValue(null);
    damageUtils.getCombatContext.mockResolvedValue(combatCs);

    const result = await handle(hohAction, monkStats, campaignName, null, []);

    expect(result.type).toBe('modal');
    expect(result.payload.pending).toBe(true);
    expect(result.payload.creatureTargets.map(t => t.name)).toEqual(expect.arrayContaining(['Disciplined_Monk', 'Bandit 1']));
    expect(diceRoller.rollExpression).not.toHaveBeenCalled();
    expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled();
    expect(healingRoll.applyHealingDirectly).not.toHaveBeenCalled();
  });

  it('picker filters to touch range (5ft): far creature excluded, in-range and self offered', async () => {
    const farBandit = { name: 'Bandit 2', type: 'monster', currentHp: 9, maxHp: 11 };
    const wideCs = { creatures: [monkCsEntry, woundedBandit, farBandit], round: 1, activeCreatureName: 'Disciplined_Monk' };
    targetResolver.resolveTarget.mockResolvedValue(null);
    damageUtils.getCombatContext.mockResolvedValue(wideCs);
    rangeCheck.isWithinRange.mockImplementation(async (_attacker, targetName) => targetName !== 'Bandit 2');

    const result = await handle(hohAction, monkStats, campaignName, null, []);

    expect(result.payload.pending).toBe(true);
    expect(result.payload.creatureTargets.map(t => t.name)).toEqual(['Disciplined_Monk', 'Bandit 1']);
    expect(rangeCheck.isWithinRange).toHaveBeenCalledWith('Disciplined_Monk', 'Bandit 1', 5);
    expect(rangeCheck.isWithinRange).toHaveBeenCalledWith('Disciplined_Monk', 'Bandit 2', 5);
  });

  it('picker confirm heals the chosen wounded target with canonical d12+WIS and logs the Focus Point spend', async () => {
    targetResolver.resolveTarget.mockResolvedValue(null);
    damageUtils.getCombatContext.mockResolvedValue(combatCs);

    const result = await handle(hohAction, monkStats, campaignName, null, []);
    const payload = await result.payload.confirmHeal('Bandit 1');

    expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d12');
    expect(applyHealing.applyHealingToTarget).toHaveBeenCalledWith(combatCs, 'Bandit 1', 12, campaignName);
    expect(payload.targetName).toBe('Bandit 1');
    expect(payload.formula).toBe('1d12 + 7');
    expect(healingRoll.logHealingToSSE).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      targetName: 'Bandit 1',
      actualHeal: 5,
    }));
    expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'ability_use',
      characterName: 'Disciplined_Monk',
      abilityName: 'Hand of Healing',
      description: expect.stringContaining('expended 1 Focus Point to use Hand of Healing on Bandit 1'),
    }));
  });

  // HoH pre-spend-at-full-HP improve: the pre-fix face ("skip spends 1 Focus and
  // logs '= 12 (Already at full HP)'") is DEAD. A target resolved at max HP at
  // CONFIRM time is refused with zero spend/zero roll/zero row; the skip lane only
  // heals when the monk is actually damaged.
  it('picker skip on a full-HP self is REFUSED before spend: zero roll, zero row, refusal note payload', async () => {
    targetResolver.resolveTarget.mockResolvedValue(null);
    damageUtils.getCombatContext.mockResolvedValue(combatCs);

    const result = await handle(hohAction, monkStats, campaignName, null, []);
    const payload = await result.payload.confirmHeal('Disciplined_Monk');

    expect(payload).toEqual({ refusal: 'Disciplined_Monk is already at full HP. No focus spent.' });
    expect(diceRoller.rollExpression).not.toHaveBeenCalled();
    expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled();
    expect(healingRoll.logHealingToSSE).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('picker skip self-heals the damaged monk: spend + choke + honest row', async () => {
    targetResolver.resolveTarget.mockResolvedValue(null);
    const damagedCs = {
      ...combatCs,
      creatures: [{ ...monkCsEntry, currentHp: 150 }, woundedBandit],
    };
    damageUtils.getCombatContext.mockResolvedValue(damagedCs);

    const result = await handle(hohAction, monkStats, campaignName, null, []);
    const payload = await result.payload.confirmHeal('Disciplined_Monk');

    expect(payload.targetName).toBe('Disciplined_Monk');
    expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'ability_use',
      description: expect.stringContaining('expended 1 Focus Point to use Hand of Healing on Disciplined_Monk'),
    }));
  });

  it('outside combat (no combat context) falls back to the damaged self via applyHealingDirectly', async () => {
    targetResolver.resolveTarget.mockResolvedValue(null);
    damageUtils.getCombatContext.mockResolvedValue(null);

    const result = await handle(hohAction, { ...monkStats, currentHitPoints: 150 }, campaignName, null, []);

    expect(result.type).toBe('modal');
    expect(result.payload.pending).toBeUndefined();
    expect(result.payload.targetName).toBe('Disciplined_Monk');
    expect(healingRoll.applyHealingDirectly).toHaveBeenCalled();
    expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled();
  });
});
