// @maintained-by-ai 2026-11-27
//
// ── #1811 monk lane — healingHandler.js self_healing dispatch ─────────────
// SUBJECT: handleMonkHealing's isSelf=true routing (self_healing monk actions
// skip the armed-target/picker machinery entirely) + performMonkHeal's modal
// payload basics in healingHandler.js, reached via handle()'s isMonkHealing
// dispatch (healExpression includes 'martial_arts_die' && 'WIS').
// Production caller: src/services/automation/index.js `healing:` /
// `self_healing:` → handleHealing. LIVE, verified 2026-10-15.
// Authored 2024 Hand of Healing (public/data/2024/classes.json, type
// 'healing') is the cla159 lane; this lane pins the SELF-side half of the
// same seam — self_healing-type monk actions route straight to self, and the
// modal payload / martialArtsDie ladder / bonus weaving / Physician's Touch
// fields are pinned here.
//
// NOTE (HoH pre-spend-at-full-HP improve): isSelf no longer bypasses the
// commit — performMonkHeal is the SOLE Focus writer for this feature and the
// self path runs the same gateMonkHealCommit gate + 1-FP write. The positive
// self-path commit census (one focusPoints write, currentFP−1) is owned HERE;
// the refusal family around it is pinned stronger in full-hp-refusal.
//
// This lane owns:
//   - full self-path commit: exact modal result shape, exact ability_use log
//     row, single Focus spend census, one SSE heal row, applyHealingDirectly
//     to self with the pre-clamp healAmount
//   - self routing guard: resolveTarget / getCombatContext /
//     applyHealingToTarget NEVER touched on the isSelf=true dispatch
//   - martialArtsDie pass-through from class features + d4 default when
//     getClassFeatures returns null
//   - resolveHealingBonusesWithDetails weaving into formula/bonus/healAmount
//   - Fortified Health mark delegation (mocked; internals owned upstream)
//   - Physician's Touch presence/absence in payload
//
// NOT owned here (do NOT re-absorb — lane map in
// healingHandler.battleMedic.test.js):
//   - CLA-160 armed target, CLA-163 picker/confirmHeal, CLA-092 choke-args,
//     canonical d12 formula, picker-skip damaged self
//     → healingHandler.handOfHealing.cla159.test.js
//   - full-HP/pool-drained refusal family + zero-spend censuses + 5e/2024
//     focus/ki wording + out-of-combat self fallback refusal
//     → healingHandler.handOfHealing.full-hp-refusal.test.js
//   - payload.actualHeal clamped-face regression
//     → healingHandler.monk-actual-heal-payload.test.js
//   - handleHealersKit kit seam → healingHandler.battleMedic.test.js
//   - handleSelfHealing generic self branch → healingHandler.secondWind.test.js,
//     healingHandler.test.js (#1815 gates/uses/hit_die_roll, self
//     reroll/maximize on the generic path)
//   - triggerTacticalShift → healingHandler.tacticalShift.test.js
//   - handleUsesHealing / handleFlatHeal → healingHandler.targeted.test.js
//
// Deterministic: all seams mocked (incl. damageUtils/logService and the
// combatData live-cache read, so the no-cache-adopted precondition is
// explicit and no fetch is reachable), FROZEN Date.now, no timers. The
// applyHealingDirectly mock CLAMPS from its stats argument per fixture — no
// mirrored hardcoded amounts (run2#1844 mispaint class).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

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

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
  resolveHealingBonusesWithDetails: vi.fn(),
  markFortifiedHealthUsed: vi.fn(),
  hasHealingMaximizationForTarget: vi.fn(),
  hasRerollHealingOnes: vi.fn(),
  hasTacticalShift: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/restRules.js', () => ({
  getHitDieSize: vi.fn(),
  computeHitDieRecovery: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

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

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';
const FROZEN_NOW = 1700000000000;

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestHealer',
    level: 5,
    proficiency: 3,
    currentHitPoints: 10,
    maxHitPoints: 20,
    abilities: [{ name: 'Wisdom', bonus: 2 }],
    specialActions: [],
    ...overrides,
  };
}

// MERGES automation overrides onto the self_healing monk base — do not
// replace wholesale.
function makeMonkAction(automation = {}) {
  return {
    name: 'Hand of Healing',
    automation: {
      type: 'self_healing',
      healExpression: 'martial_arts_die + WIS',
      ...automation,
    },
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('healingHandler monk lane (self_healing martial_arts_die + WIS)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(FROZEN_NOW);
    // The commit lane (performMonkHeal) is the sole Focus writer — the lane
    // needs a readable pool; no bucket HP truth (null) keeps the full-HP gate
    // on the makePlayerStats 10/20 face, and no adopted combat cache keeps
    // the self path on the applyHealingDirectly fallback.
    getRuntimeValue.mockImplementation((_name, key) => (key === 'focusPoints' ? 4 : null));
    setRuntimeValue.mockResolvedValue(undefined);
    combatData.getCombatSummary.mockReturnValue(null);
    diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
    diceRoller.rollExpressionMaximized.mockReturnValue({ total: 8, rolls: [8], modifier: 0 });
    classFeatures.getClassFeatures.mockReturnValue({ martialArtsDie: 6 });
    automationService.resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 0, details: [] });
    automationService.hasHealingMaximizationForTarget.mockReturnValue(false);
    automationService.hasRerollHealingOnes.mockReturnValue(false);
    automationService.hasTacticalShift.mockReturnValue(false);
    automationService.markFortifiedHealthUsed.mockResolvedValue(undefined);
    addEntry.mockResolvedValue(undefined);
    // Arg-derived clamp mirror of the direct-write contract: actualHeal is the
    // heal clamped at the stats face's max (never a hardcoded amount).
    healingRoll.applyHealingDirectly.mockImplementation((stats, _target, amount) => {
      const actualHeal = Math.max(0, Math.min(amount, stats.maxHitPoints - stats.currentHitPoints));
      return { newHp: stats.currentHitPoints + actualHeal, maxHp: stats.maxHitPoints, actualHeal };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('self_healing dispatch routes to self and commits: full modal shape, one Focus spend, exact audit row, armed/picker/choke machinery untouched', async () => {
    const ps = makePlayerStats({ abilities: [{ name: 'Wisdom', bonus: 3 }] });

    const result = await handle(makeMonkAction(), ps, campaignName, null);

    // Full-shape modal result (roll 5 + WIS 3; clamp-derived direct write:
    // 8 into a 10/20 face → actualHeal 8, newHp 18).
    expect(result).toEqual({
      type: 'modal',
      modalName: 'handOfHealing',
      payload: {
        healName: 'Hand of Healing',
        formula: '1d6 + 3',
        rolls: [5],
        bonus: 3,
        healAmount: 8,
        actualHeal: 8,
        monkName: 'TestHealer',
        targetName: 'TestHealer',
        targetCurrentHp: 18,
        targetMaxHp: 20,
        hasPhysiciansTouch: false,
        rerollOnes: false,
      },
    });

    // Commit census: exactly one Focus write at currentFP−1 and one SSE heal
    // row, one ability_use row.
    expect(setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(setRuntimeValue).toHaveBeenCalledWith('TestHealer', 'focusPoints', 3, campaignName);
    expect(healingRoll.logHealingToSSE).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledWith(campaignName, {
      type: 'ability_use',
      characterName: 'TestHealer',
      abilityName: 'Hand of Healing',
      description: 'TestHealer expended 1 ki point to use Hand of Healing on TestHealer: 1d6 + 3 = 8 (Regained 8 HP).',
      timestamp: FROZEN_NOW,
    });

    // Self-routing guard: the isSelf=true dispatch never enters the
    // armed-target/picker/choke machinery; the heal lands directly on self
    // with the PRE-CLAMP healAmount.
    expect(targetResolver.resolveTarget).not.toHaveBeenCalled();
    expect(damageUtils.getCombatContext).not.toHaveBeenCalled();
    expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled();
    expect(healingRoll.applyHealingDirectly).toHaveBeenCalledWith(ps, 'TestHealer', 8, campaignName);
  });

  it('martialArtsDie ladder: uses the class-feature die, defaulting to d4 when class features return null', async () => {
    classFeatures.getClassFeatures.mockReturnValue({ martialArtsDie: 8 });
    const ladder = await handle(makeMonkAction(), makePlayerStats(), campaignName, null);
    expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d8');
    expect(ladder.payload.formula).toBe('1d8 + 2');

    classFeatures.getClassFeatures.mockReturnValue(null);
    const fallback = await handle(makeMonkAction(), makePlayerStats(), campaignName, null);
    expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d4');
    expect(fallback.payload.formula).toBe('1d4 + 2');
  });

  it('weaves resolveHealingBonusesWithDetails into formula, bonus and healAmount', async () => {
    const ps = makePlayerStats({ abilities: [{ name: 'Wisdom', bonus: 3 }] });
    automationService.resolveHealingBonusesWithDetails.mockReturnValue({
      totalBonus: 2,
      details: [{ name: 'Disciple of Life', amount: 2 }],
    });

    const result = await handle(makeMonkAction(), ps, campaignName, null);

    expect(result.payload.formula).toBe('1d6 + 3 + 2');
    expect(result.payload.bonus).toBe(5);
    expect(result.payload.healAmount).toBe(10); // roll 5 + WIS 3 + bonus 2
  });

  it('delegates Fortified Health marking when details carry it, and only then', async () => {
    const ps = makePlayerStats();

    await handle(makeMonkAction(), ps, campaignName, null);
    expect(automationService.markFortifiedHealthUsed).not.toHaveBeenCalled();

    automationService.resolveHealingBonusesWithDetails.mockReturnValue({
      totalBonus: 0,
      details: [{ name: 'Fortified Health' }],
    });
    await handle(makeMonkAction(), ps, campaignName, null);
    expect(automationService.markFortifiedHealthUsed).toHaveBeenCalledWith(ps, campaignName);
  });

  it("flags hasPhysiciansTouch by the feature's presence in specialActions", async () => {
    const present = await handle(
      makeMonkAction(),
      makePlayerStats({ specialActions: [{ name: "Physician's Touch" }] }),
      campaignName,
      null,
    );
    expect(present.payload.hasPhysiciansTouch).toBe(true);

    const absent = await handle(
      makeMonkAction(),
      makePlayerStats({ specialActions: [{ name: 'Step of the Wind' }] }),
      campaignName,
      null,
    );
    expect(absent.payload.hasPhysiciansTouch).toBe(false);
  });
});
