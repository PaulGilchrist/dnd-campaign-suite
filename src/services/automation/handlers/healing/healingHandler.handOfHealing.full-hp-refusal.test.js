// @maintained-by-ai
//
// ── HoH pre-spend-at-full-HP improve — REFUSE PRE-SPEND (owner decision) ──
// SUBJECT: performMonkHeal's confirm-time capacity + Focus gates in
// healingHandler.js (picker confirmHeal closure, armed/self lanes), plus the
// moved spend seam: the COMMIT lane is now the SOLE Focus writer for standalone
// Hand of Healing (useCharActionsAutomation only gates pool exhaustion on the
// row click). Mirrors the Healing-Light noHealCapacity gate (d595cff2c) with
// bucket-first live HP via resolveLiveTargetHp (7dca2c6d3 chooser law applied
// to the commit itself).
//
// Locked faces:
//   - full-HP confirm = refusal note payload, ZERO roll / heal / FP write /
//     log row / SSE heal — and the refusal wins over a STALE damaged row
//     because the bucket is re-read at CONFIRM time (no stale-enable hole)
//   - render→commit race: target damaged when the picker payload was built,
//     healed to max before the confirm click → still refused
//   - inverse stale face: damaged bucket under a full cs row → NOT refused
//     (bucket-first, no false refusals)
//   - damaged leg unchanged: spend (storedFP − 1), choke heal, honest
//     ability_use row, modal payload
//   - pool drained while the picker dwelt open → zero-spend refusal
//   - out-of-combat self lanes (cs null): full → popup refusal; damaged →
//     CLA-092 applyHealingDirectly fallback intact
//
// Lane map in healingHandler.handOfHealing.cla159.test.js (armed target,
// picker seam, formula, skip/damaged self) — do NOT duplicate those.

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
const rogueCsRow = { name: 'Fighting_Rogue', type: 'player', currentHp: 60, maxHp: 143 };

// Picker fixture: monk + rogue, both in range (isWithinRange mock is always-true),
// no armed target → CLA-163 pending-picker branch.
async function openPicker(cs) {
  targetResolver.resolveTarget.mockResolvedValue(null);
  damageUtils.getCombatContext.mockResolvedValue(cs);
  const result = await handle(hohAction, monkStats, campaignName, null, []);
  expect(result.type).toBe('modal');
  expect(result.payload.pending).toBe(true);
  return result.payload;
}

describe('HoH confirm-time full-HP refusal (REFUSE PRE-SPEND)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    classFeatures.getClassFeatures.mockReturnValue({ martialArtsDie: 12 });
    diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
    automationService.resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 0, details: [] });
    automationService.hasHealingMaximizationForTarget.mockReturnValue(false);
    automationService.hasRerollHealingOnes.mockReturnValue(false);
    applyHealing.applyHealingToTarget.mockReturnValue({ actualHeal: 5, oldHp: 60, newHp: 65, maxHp: 143 });
    healingRoll.applyHealingDirectly.mockReturnValue({ newHp: 160, maxHp: 183, actualHeal: 10 });
    // readable Focus pool; no bucket HP truth by default (cs-row fallback).
    getRuntimeValue.mockImplementation((_name, key) => (key === 'focusPoints' ? 3 : null));
  });

  it('refuses a target the bucket says is at max over a STALE damaged cs row — zero roll, heal, spend, and log', async () => {
    const payload = await openPicker({ creatures: [monkCsRow, rogueCsRow] });
    // Confirm-time re-read (no stale-enable): the bucket has been healed to max
    // even though the cs row still reads 60/143.
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'focusPoints') return 3;
      if (name === 'Fighting_Rogue' && key === 'currentHitPoints') return 143;
      if (name === 'Fighting_Rogue' && key === 'hitPoints') return 143;
      return null;
    });

    const result = await payload.confirmHeal('Fighting_Rogue');

    expect(result).toEqual({ refusal: 'Fighting_Rogue is already at full HP. No focus spent.' });
    expect(diceRoller.rollExpression).not.toHaveBeenCalled();
    expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled();
    expect(healingRoll.applyHealingDirectly).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
    expect(healingRoll.logHealingToSSE).not.toHaveBeenCalled();
  });

  it('render→commit race: damaged when the picker opened, healed to max before the confirm click → still refused', async () => {
    const payload = await openPicker({ creatures: [monkCsRow, rogueCsRow] });
    // Picker rows were collected against the damaged bucket (60/143)…
    expect(payload.creatureTargets.find(t => t.name === 'Fighting_Rogue')).toMatchObject({ currentHp: 60, maxHp: 143 });
    // …then ANOTHER writer fills the target before the click.
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'focusPoints') return 3;
      if (name === 'Fighting_Rogue' && key === 'currentHitPoints') return 143;
      return null;
    });

    const result = await payload.confirmHeal('Fighting_Rogue');

    expect(result).toEqual({ refusal: 'Fighting_Rogue is already at full HP. No focus spent.' });
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('does NOT false-refuse a damaged bucket under a full cs row (bucket-first, inverse face)', async () => {
    const fullRow = { name: 'Fighting_Rogue', type: 'player', currentHp: 143, maxHp: 143 };
    const payload = await openPicker({ creatures: [monkCsRow, fullRow] });
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'focusPoints') return 3;
      if (name === 'Fighting_Rogue' && key === 'currentHitPoints') return 100;
      if (name === 'Fighting_Rogue' && key === 'hitPoints') return 143;
      return null;
    });

    const result = await payload.confirmHeal('Fighting_Rogue');

    expect(result.refusal).toBeUndefined();
    expect(result.targetName).toBe('Fighting_Rogue');
  });

  it('refuses a monster cs row at max on the row values alone (no bucket for monsters)', async () => {
    const fullBandit = { name: 'Bandit 1', type: 'monster', currentHp: 11, maxHp: 11 };
    const payload = await openPicker({ creatures: [monkCsRow, fullBandit] });

    const result = await payload.confirmHeal('Bandit 1');

    expect(result).toEqual({ refusal: 'Bandit 1 is already at full HP. No focus spent.' });
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('damaged leg unchanged: spends 1 Focus at commit, heals via the choke, logs the ability_use row', async () => {
    const payload = await openPicker({ creatures: [monkCsRow, rogueCsRow] });

    const result = await payload.confirmHeal('Fighting_Rogue');

    expect(result.refusal).toBeUndefined();
    expect(result.targetName).toBe('Fighting_Rogue');
    expect(setRuntimeValue).toHaveBeenCalledWith('Disciplined_Monk', 'focusPoints', 2, campaignName);
    expect(applyHealing.applyHealingToTarget).toHaveBeenCalled();
    expect(healingRoll.logHealingToSSE).toHaveBeenCalled();
    expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'ability_use',
      description: expect.stringContaining('expended 1 Focus Point to use Hand of Healing on Fighting_Rogue'),
    }));
  });

  it('pool drained while the picker dwelt open: commit refuses with zero spend, zero heal, zero row', async () => {
    const payload = await openPicker({ creatures: [monkCsRow, rogueCsRow] });
    getRuntimeValue.mockImplementation((_name, key) => (key === 'focusPoints' ? 0 : null));

    const result = await payload.confirmHeal('Fighting_Rogue');

    expect(result).toEqual({ refusal: 'No Focus Points remaining.' });
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('out-of-combat self at max is refused before any spend; damaged self keeps the CLA-092 direct-write fallback', async () => {
    targetResolver.resolveTarget.mockResolvedValue(null);
    damageUtils.getCombatContext.mockResolvedValue(null);

    const full = await handle(hohAction, { ...monkStats, currentHitPoints: 183 }, campaignName, null, []);
    expect(full.type).toBe('popup');
    expect(full.payload.description).toBe('Disciplined_Monk is already at full HP. No focus spent.');
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();

    const damaged = await handle(hohAction, monkStats, campaignName, null, []);
    expect(damaged.type).toBe('modal');
    expect(healingRoll.applyHealingDirectly).toHaveBeenCalled();
    expect(setRuntimeValue).toHaveBeenCalledWith('Disciplined_Monk', 'focusPoints', 2, campaignName);
  });

  it('5e wording face: the refusal reports the ki pool (dual-ruleset label branch)', async () => {
    const fullBandit = { name: 'Bandit 1', type: 'monster', currentHp: 11, maxHp: 11 };
    targetResolver.resolveTarget.mockResolvedValue(null);
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [monkCsRow, fullBandit] });
    const result = await handle(hohAction, { ...monkStats, rules: '5e' }, campaignName, null, []);
    const confirmed = await result.payload.confirmHeal('Bandit 1');

    expect(confirmed).toEqual({ refusal: 'Bandit 1 is already at full HP. No ki spent.' });
  });
});
