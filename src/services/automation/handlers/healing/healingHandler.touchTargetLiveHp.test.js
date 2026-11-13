// @maintained-by-ai
//
// ── EH 2026-11-13 cs-row-staleness fix — chooser HP source + unchanged gates ──
// SUBJECT: collectTouchTargets (healingHandler.js) as reached through the
// CLA-163 picker branch of handleMonkHealing. Locks:
//   - picker rows DISPLAY bucket currentHitPoints/hitPoints when available,
//     cs row values ONLY as fallback (bucket wins / row when bucket missing)
//   - eligibility gating UNCHANGED: isWithinRange 5 ft filter + self always
//     offered (short-circuit, no range call for self)
//   - write lane UNCHANGED: confirmHeal still applies through the CLA-092
//     applyHealingToTarget choke on the combatSummary, independent of the
//     displayed bucket numbers
// Lane map in healingHandler.handOfHealing.cla159.test.js (armed target,
// picker seam, canonical formula, focus spend) — do NOT duplicate those.

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
import * as applyHealing from '../../../rules/combat/applyHealing.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as rangeCheck from '../../../rules/combat/rangeCheck.js';
import * as automationService from '../../../combat/automation/automationService.js';
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

// Stale cs rows: the GET-proved drift face — the bucket has been healed ABOVE
// the row (row 100 vs bucket 134 in the EH ride).
const monkCsRow = { name: 'Disciplined_Monk', type: 'player', currentHp: 183, maxHp: 183 };
const fighterCsRow = { name: 'Fighting_Rogue', type: 'player', currentHp: 100, maxHp: 100 };

describe('collectTouchTargets — bucket-first displayed HP', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    classFeatures.getClassFeatures.mockReturnValue({ martialArtsDie: 12 });
    diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
    automationService.resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 0, details: [] });
    automationService.hasHealingMaximizationForTarget.mockReturnValue(false);
    automationService.hasRerollHealingOnes.mockReturnValue(false);
    rangeCheck.isWithinRange.mockImplementation(async () => true);
    applyHealing.applyHealingToTarget.mockReturnValue({ actualHeal: 5, oldHp: 100, newHp: 105, maxHp: 143 });
    targetResolver.resolveTarget.mockResolvedValue(null);
    getRuntimeValue.mockReturnValue(null);
  });

  it('picker offers the live bucket HP when the bucket has healed above the stale row', async () => {
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [monkCsRow, fighterCsRow] });
    getRuntimeValue.mockImplementation((name, key) => {
      if (name !== 'Fighting_Rogue') return null;
      if (key === 'currentHitPoints') return 134;
      if (key === 'hitPoints') return 143;
      return null;
    });

    const result = await handle(hohAction, monkStats, campaignName, null, []);

    expect(result.payload.pending).toBe(true);
    const fighter = result.payload.creatureTargets.find(t => t.name === 'Fighting_Rogue');
    // Bucket wins over the 100/100 row — the exact number the modal resolves
    // to one click later (no chooser-vs-modal contradiction).
    expect(fighter).toEqual({ name: 'Fighting_Rogue', type: 'player', currentHp: 134, maxHp: 143 });
  });

  it('falls back to the combatSummary row when the candidate has no bucket data', async () => {
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [monkCsRow, fighterCsRow] });
    getRuntimeValue.mockReturnValue(null);

    const result = await handle(hohAction, monkStats, campaignName, null, []);

    const fighter = result.payload.creatureTargets.find(t => t.name === 'Fighting_Rogue');
    expect(fighter).toEqual({ name: 'Fighting_Rogue', type: 'player', currentHp: 100, maxHp: 100 });
  });

  it('eligibility gating unchanged: 5 ft isWithinRange filter keeps excluding, self always offered', async () => {
    const farRogue = { name: 'Bandit 2', type: 'monster', currentHp: 9, maxHp: 11 };
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [monkCsRow, fighterCsRow, farRogue] });
    rangeCheck.isWithinRange.mockImplementation(async (_source, targetName) => targetName !== 'Bandit 2');

    const result = await handle(hohAction, monkStats, campaignName, null, []);

    expect(result.payload.creatureTargets.map(t => t.name)).toEqual(['Disciplined_Monk', 'Fighting_Rogue']);
    expect(rangeCheck.isWithinRange).toHaveBeenCalledWith('Disciplined_Monk', 'Bandit 2', 5);
    // self short-circuits the range gate (picker self-entry needs no token)
    expect(rangeCheck.isWithinRange).not.toHaveBeenCalledWith('Disciplined_Monk', 'Disciplined_Monk', 5);
  });

  it('write lane unchanged: picker confirm still applies via the CLA-092 cs choke', async () => {
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [monkCsRow, fighterCsRow] });
    getRuntimeValue.mockImplementation((name, key) => {
      if (name !== 'Fighting_Rogue') return null;
      if (key === 'currentHitPoints') return 134;
      if (key === 'hitPoints') return 143;
      return null;
    });

    const result = await handle(hohAction, monkStats, campaignName, null, []);
    const cs = await damageUtils.getCombatContext.mock.results[0].value;
    const payload = await result.payload.confirmHeal('Fighting_Rogue');

    expect(applyHealing.applyHealingToTarget).toHaveBeenCalledWith(cs, 'Fighting_Rogue', 12, campaignName);
    // The result modal reports the choke's post-heal numbers, not the chooser's.
    expect(payload.targetCurrentHp).toBe(105);
    expect(payload.targetMaxHp).toBe(143);
  });
});
