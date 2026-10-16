// @maintained-by-ai
//
// ── #1813 tacticalShift lane — healingHandler.js triggerTacticalShift ─────
// SUBJECT: the CLA-353 rider in healingHandler.js — maybeTriggerTacticalShift /
// triggerTacticalShift (2024 Fighter lv5, passive_rule tactical_shift_no_oa).
// Fires ONLY on a successful Second Wind activation (self_healing, resourceKey
// secondWindUses, actualHeal > 0): appends a self-target no_opportunity_attacks
// te (source 'Tactical Shift', until_start_of_next_turn) to the campaign
// targetEffects + addExpiration + an ability_use log, and echoes the half-Speed
// wording in the popup. Non-holders, full-HP refusals, and non-Second-Wind
// self-heals write nothing.
// Production caller: src/services/automation/index.js `self_healing:` →
// handleHealing; hasTacticalShift from automationPassives.js:252 (its own
// truth table lives in automationPassives.test.js — NOT re-pinned here).
// LIVE, verified 2026-10-15: prod Second Wind data (public/data/{,2024/}classes.json)
// ships healExpression '1d10 + fighter level' + resourceKey 'secondWindUses';
// manifest CLA-353 verified 2026-10-09 host EvasiveFighter "rider rides
// healingHandler only actualHeal>0" with this exact te + anchor-clock shape.
//
// This lane owns (each test pins a DISTINCT production gate):
//   - happy path: exact te shape written via setRuntimeValue('campaign',
//     'targetEffects', …), exact addExpiration args, ability_use log, popup echo
//   - hasTacticalShift false → zero te writes / expirations / TS logs (siblings
//     hard-mock this false, so the no-side-effect guard is pinned ONLY here)
//   - full-HP refusal (actualHeal 0, gate before consume) → rider silent even
//     for a holder (refusal *text* is owned by #1812, not re-pinned)
//   - usesKey gate: rider must NOT ride other self_healing resources
//   - append semantics: existing campaign targetEffects preserved (merge, not
//     replace)
//
// NOT owned here (lane map in healingHandler.battleMedic.test.js):
//   - handleSelfHealing generic branch / refusals text → #1812 secondWind
//   - self-path dispatch & gates → #1815 healingHandler.test.js
//   - handleUsesHealing / handleFlatHeal → #1814 targeted
//   - handleHealersKit → battleMedic; monk lanes → #1810/#1811
//
// HANDOFF FLAGS (test-only task, prod untouched):
//   - consumeSelfHealingUse early-returns for isHitDieRoll before
//     maybeTriggerTacticalShift, so a hit_die_roll-configured Second Wind
//     would NOT fire the rider — RAW says "whenever you activate Second Wind".
//     Prod data today is '1d10 + fighter level' so this is unreachable; NOT
//     pinned deliberately. Triage if prod data ever flips to hit_die_roll.
//   - fixture uses:4 mirrors the verified manifest host (runtime/tracked value);
//     classes.json literal uses:2 is not pinned on this lane.
//
// Deterministic: all seams mocked, no timers, inert fetch from setup.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../dice/diceRoller.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, rollExpression: vi.fn(), rollExpressionMaximized: vi.fn() }
});

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

vi.mock('../../../combat/automation/automationService.js', () => ({
  resolveHealingBonuses: vi.fn(),
  resolveHealingBonusesWithDetails: vi.fn(),
  markFortifiedHealthUsed: vi.fn(),
  hasHealingMaximization: vi.fn(),
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
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

import { handle } from './healingHandler.js';
import * as diceRoller from '../../../dice/diceRoller.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as healingRoll from '../../common/healingRoll.js';
import * as automationService from '../../../combat/automation/automationService.js';
import * as logService from '../../../ui/logService.js';
import * as expirations from '../../../rules/effects/expirations.js';

const campaignName = 'TestCampaign';

function makeFighterStats(passives = []) {
  return {
    name: 'EvasiveFighter',
    level: 18,
    proficiency: 6,
    currentHitPoints: 89,
    maxHitPoints: 94,
    hitPoints: 94,
    abilities: [{ name: 'Constitution', bonus: 5 }],
    automation: { passives },
  };
}

const TACTICAL_SHIFT_PASSIVE = { type: 'passive_rule', effect: 'tactical_shift_no_oa' };

function makeSecondWind() {
  return {
    name: 'Second Wind',
    automation: {
      type: 'self_healing',
      healExpression: '1d10 + fighter level',
      action: 'bonus_action',
      uses: 4,
      resourceKey: 'secondWindUses',
      recharge: 'short_rest',
      casting_time: '1 bonus action',
    },
  };
}

function runtimeMap(map) {
  runtimeState.getRuntimeValue.mockImplementation((name, key) => map[key]);
}

describe('CLA-353 Tactical Shift fires on Second Wind activation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    automationService.hasTacticalShift.mockReturnValue(false);
    diceRoller.rollExpression.mockReturnValue({ total: 23, rolls: [5], modifier: 0 });
    automationService.resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 0, details: [] });
    automationService.hasHealingMaximizationForTarget.mockReturnValue(false);
    automationService.hasRerollHealingOnes.mockReturnValue(false);
    healingRoll.applyHealingDirectly.mockImplementation((ps, targetName, amount) => {
      const current = 89;
      const max = 94;
      const newHp = Math.min(max, current + amount);
      return { newHp, maxHp: max, actualHeal: newHp - current };
    });
    runtimeMap({ secondWindUses: 4, currentHitPoints: 89, targetEffects: [] });
  });

  it('writes self no_opportunity_attacks te, expiration, and ability_use log on successful Second Wind', async () => {
    automationService.hasTacticalShift.mockReturnValue(true);

    const result = await handle(makeSecondWind(), makeFighterStats([TACTICAL_SHIFT_PASSIVE]), campaignName, null);

    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'campaign',
      'targetEffects',
      [expect.objectContaining({
        target: 'EvasiveFighter',
        source: 'Tactical Shift',
        effect: 'no_opportunity_attacks',
        value: null,
        duration: 'until_start_of_next_turn',
      })],
      campaignName,
    );
    expect(expirations.addExpiration).toHaveBeenCalledWith({ attackerName: 'EvasiveFighter', targetName: 'EvasiveFighter', effects: [{ type: 'remove_target_effect', effectKey: 'no_opportunity_attacks', source: 'Tactical Shift', target: 'EvasiveFighter' }], campaignName, rounds: undefined, expireOnCreatureName: 'EvasiveFighter' });
    expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'ability_use',
      characterName: 'EvasiveFighter',
      abilityName: 'Tactical Shift',
      description: expect.stringContaining('half Speed'),
    }));
    expect(result.payload.description).toContain('half your Speed without provoking Opportunity Attacks');
    expect(result.payload.description).toContain('Tactical Shift');
  });

  it('does NOT trigger for a holder without the tactical_shift_no_oa passive', async () => {
    automationService.hasTacticalShift.mockReturnValue(false);

    const result = await handle(makeSecondWind(), makeFighterStats([]), campaignName, null);

    expect(healingRoll.applyHealingDirectly).toHaveBeenCalled();
    const teCalls = runtimeState.setRuntimeValue.mock.calls.filter(c => c[1] === 'targetEffects');
    expect(teCalls).toHaveLength(0);
    expect(expirations.addExpiration).not.toHaveBeenCalled();
    const tsLogs = logService.addEntry.mock.calls.filter(c => c[1]?.abilityName === 'Tactical Shift');
    expect(tsLogs).toHaveLength(0);
    expect(result.payload.description).not.toContain('Tactical Shift');
  });

  it('does NOT trigger when Second Wind is refused at full HP (no activation, no use spent)', async () => {
    automationService.hasTacticalShift.mockReturnValue(true);
    runtimeMap({ secondWindUses: 4, currentHitPoints: 94, targetEffects: [] });

    await handle(makeSecondWind(), { ...makeFighterStats([TACTICAL_SHIFT_PASSIVE]), currentHitPoints: 94 }, campaignName, null);

    // Refusal happens before consumeSelfHealingUse → rider never rides a
    // non-activation. Refusal *text* is pinned by #1812 secondWind lane.
    const teCalls = runtimeState.setRuntimeValue.mock.calls.filter(c => c[1] === 'targetEffects');
    expect(teCalls).toHaveLength(0);
    expect(expirations.addExpiration).not.toHaveBeenCalled();
    const tsLogs = logService.addEntry.mock.calls.filter(c => c[1]?.abilityName === 'Tactical Shift');
    expect(tsLogs).toHaveLength(0);
  });

  it('does NOT trigger for non-Second-Wind self-healing features held by a Tactical Shift fighter', async () => {
    automationService.hasTacticalShift.mockReturnValue(true);

    const action = {
      name: 'Bouncy Castle',
      automation: {
        type: 'self_healing',
        healExpression: '1d4',
        action: 'bonus_action',
        uses: 5,
        resourceKey: 'bouncyCastleUses',
        recharge: 'short_rest',
      },
    };
    runtimeMap({ bouncyCastleUses: 5, currentHitPoints: 89, targetEffects: [] });

    await handle(action, makeFighterStats([TACTICAL_SHIFT_PASSIVE]), campaignName, null);

    const teCalls = runtimeState.setRuntimeValue.mock.calls.filter(c => c[1] === 'targetEffects');
    expect(teCalls).toHaveLength(0);
    expect(expirations.addExpiration).not.toHaveBeenCalled();
    const tsLogs = logService.addEntry.mock.calls.filter(c => c[1]?.abilityName === 'Tactical Shift');
    expect(tsLogs).toHaveLength(0);
  });

  it('preserves existing campaign targetEffects when appending the Tactical Shift te', async () => {
    automationService.hasTacticalShift.mockReturnValue(true);
    const existing = [{ target: 'SomeoneElse', source: 'Step of the Wind', effect: 'no_opportunity_attacks', duration: 'until_start_of_next_turn' }];
    runtimeMap({ secondWindUses: 4, currentHitPoints: 89, targetEffects: existing });

    await handle(makeSecondWind(), makeFighterStats([TACTICAL_SHIFT_PASSIVE]), campaignName, null);

    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'campaign',
      'targetEffects',
      [existing[0], expect.objectContaining({ target: 'EvasiveFighter', source: 'Tactical Shift' })],
      campaignName,
    );
  });
});
