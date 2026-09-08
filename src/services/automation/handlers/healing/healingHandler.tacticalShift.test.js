// CLA-353 regression: Tactical Shift (2024 Fighter lv5 passive_rule tactical_shift_no_oa)
// triggers ONLY on a successful Second Wind activation (self_healing, resourceKey
// secondWindUses): writes a self-target no_opportunity_attacks te (source 'Tactical Shift',
// until_start_of_next_turn) + addExpiration + an ability_use log, and echoes the half-Speed
// wording in the popup. Non-Second-Wind self-heals, non-holders, and full-HP refusals
// write nothing.
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
        duration: 'until_start_of_next_turn',
      })],
      campaignName,
    );
    expect(expirations.addExpiration).toHaveBeenCalledWith(
      'EvasiveFighter',
      'EvasiveFighter',
      [{ type: 'remove_target_effect', effectKey: 'no_opportunity_attacks', source: 'Tactical Shift', target: 'EvasiveFighter' }],
      campaignName,
      undefined,
      'EvasiveFighter',
    );
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

    const result = await handle(makeSecondWind(), { ...makeFighterStats([TACTICAL_SHIFT_PASSIVE]), currentHitPoints: 94 }, campaignName, null);

    expect(result.payload.description).toContain('Already at full HP');
    expect(result.payload.description).toContain('No use spent');
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
