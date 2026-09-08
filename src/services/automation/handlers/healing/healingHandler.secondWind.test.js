// @improved-by-ai
// CLA-305 regression: generic self_healing expression branch must heal rollTotal+bonus,
// must not consume a use when no HP is actually gained, and must refuse at 0 HP.
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

import { handle } from './healingHandler.js';
import * as diceRoller from '../../../dice/diceRoller.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as restRules from '../../../rules/effects/restRules.js';
import * as healingRoll from '../../common/healingRoll.js';
import * as automationService from '../../../combat/automation/automationService.js';

const campaignName = 'TestCampaign';

function makeFighterStats(overrides = {}) {
  return {
    name: 'EvasiveFighter',
    level: 18,
    proficiency: 6,
    currentHitPoints: 89,
    maxHitPoints: 94,
    hitPoints: 94,
    abilities: [{ name: 'Constitution', bonus: 5 }],
    ...overrides,
  };
}

function makeSecondWind(automation = {}) {
  return {
    name: 'Second Wind',
    automation: {
      type: 'self_healing',
      healExpression: '1d10 + fighter level',
      action: 'bonus_action',
      uses: 4,
      resourceKey: 'secondWindUses',
      recharge: 'short_rest',
      ...automation,
    },
  };
}

function runtimeMap(map) {
  runtimeState.getRuntimeValue.mockImplementation((name, key) => map[key]);
}

describe('CLA-305 Second Wind generic self_healing branch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    diceRoller.rollExpression.mockReturnValue({ total: 23, rolls: [5], modifier: 0 });
    diceRoller.rollExpressionMaximized.mockReturnValue({ total: 28, rolls: [28], modifier: 0 });
    automationService.resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 0, details: [] });
    automationService.hasHealingMaximizationForTarget.mockReturnValue(false);
    automationService.hasRerollHealingOnes.mockReturnValue(false);
    healingRoll.applyHealingDirectly.mockImplementation((ps, targetName, amount) => {
      const current = 89;
      const max = 94;
      const newHp = Math.min(max, current + amount);
      return { newHp, maxHp: max, actualHeal: newHp - current };
    });
    runtimeMap({ secondWindUses: 4, currentHitPoints: 89 });
  });

  it('heals roll total plus healing bonus, not just the bonus', async () => {
    const result = await handle(makeSecondWind(), makeFighterStats(), campaignName, null);

    expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d10 + 18');
    expect(healingRoll.applyHealingDirectly).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'EvasiveFighter' }),
      'EvasiveFighter',
      23,
      campaignName,
    );
    expect(result.payload.description).toContain('Regained 5 HP');
  });

  it('adds passive healing bonuses on top of the roll total without double-counting', async () => {
    automationService.resolveHealingBonusesWithDetails.mockReturnValue({
      totalBonus: 2,
      details: [{ name: 'Fortified Health', amount: 2 }],
    });

    await handle(makeSecondWind(), makeFighterStats(), campaignName, null);

    expect(healingRoll.applyHealingDirectly).toHaveBeenCalledWith(
      expect.anything(),
      'EvasiveFighter',
      25,
      campaignName,
    );
  });

  it('consumes exactly one use when healing succeeds', async () => {
    await handle(makeSecondWind(), makeFighterStats(), campaignName, null);

    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'EvasiveFighter',
      'secondWindUses',
      3,
      campaignName,
      true,
    );
    expect(healingRoll.logHealingToSSE).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      actualHeal: 5,
      remainingUses: 3,
      rollInfo: '1d10 + 18=23 (5)',
    }));
  });

  it('refuses at full HP with no roll, no log, and no use spent', async () => {
    runtimeMap({ secondWindUses: 4, currentHitPoints: 94 });

    const result = await handle(makeSecondWind(), makeFighterStats({ currentHitPoints: 94 }), campaignName, null);

    expect(result.payload.description).toContain('Already at full HP');
    expect(result.payload.description).toContain('No use spent');
    expect(result.payload.description).toContain('4 uses remaining');
    expect(diceRoller.rollExpression).not.toHaveBeenCalled();
    expect(healingRoll.applyHealingDirectly).not.toHaveBeenCalled();
    expect(healingRoll.logHealingToSSE).not.toHaveBeenCalled();
    const usesCalls = runtimeState.setRuntimeValue.mock.calls.filter(c => c[1] === 'secondWindUses');
    expect(usesCalls).toHaveLength(0);
  });

  it('does not consume a use when applied heal yields zero (race at full HP)', async () => {
    healingRoll.applyHealingDirectly.mockReturnValue({ newHp: 94, maxHp: 94, actualHeal: 0 });

    const result = await handle(makeSecondWind(), makeFighterStats(), campaignName, null);

    expect(result.payload.description).toContain('Already at full HP');
    expect(result.payload.description).toContain('No use spent');
    expect(result.payload.description).toContain('4 uses remaining');
    const usesCalls = runtimeState.setRuntimeValue.mock.calls.filter(c => c[1] === 'secondWindUses');
    expect(usesCalls).toHaveLength(0);
    expect(healingRoll.logHealingToSSE).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      remainingUses: 4,
    }));
  });

  it('refuses at 0 HP with no roll and no use spent (RAW unconscious)', async () => {
    runtimeMap({ secondWindUses: 4, currentHitPoints: 0 });

    const result = await handle(makeSecondWind(), makeFighterStats({ currentHitPoints: 0 }), campaignName, null);

    expect(result.payload.description).toContain("can't be used while unconscious at 0 Hit Points");
    expect(diceRoller.rollExpression).not.toHaveBeenCalled();
    expect(healingRoll.applyHealingDirectly).not.toHaveBeenCalled();
    const usesCalls = runtimeState.setRuntimeValue.mock.calls.filter(c => c[1] === 'secondWindUses');
    expect(usesCalls).toHaveLength(0);
  });

  it('still blocks first on the 0-use gate before HP gates', async () => {
    runtimeMap({ secondWindUses: 0, currentHitPoints: 0 });

    const result = await handle(makeSecondWind(), makeFighterStats({ currentHitPoints: 0 }), campaignName, null);

    expect(result.payload.description).toContain('no uses remaining');
  });

  it('hit_die_roll branch keeps computeHitDieRecovery total with no double-add of bonus', async () => {
    runtimeMap({ shortRestHitDice: 3, currentHitPoints: 40 });
    restRules.getHitDieSize.mockReturnValue(10);
    restRules.computeHitDieRecovery.mockReturnValue(12);
    automationService.resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 2, details: [] });

    const action = makeSecondWind({ healExpression: 'hit_die_roll', hitDiceCost: 1 });
    const result = await handle(action, makeFighterStats({ currentHitPoints: 40 }), campaignName, null);

    expect(restRules.computeHitDieRecovery).toHaveBeenCalledWith(23, 5);
    expect(healingRoll.applyHealingDirectly).toHaveBeenCalledWith(expect.anything(), 'EvasiveFighter', 12, campaignName);
    expect(automationService.resolveHealingBonusesWithDetails).not.toHaveBeenCalled();
    expect(result.payload.description).toContain('2 hit dice remaining');
  });

  it('flat-expression self heals (3 * monk_level) route roll total through the same fix', async () => {
    const action = {
      name: 'Wholeness of Body',
      automation: {
        type: 'self_healing',
        healExpression: '3 * monk_level',
        uses: 1,
        resourceKey: 'wholenessofbodyUses',
        recharge: 'long_rest',
      },
    };
    runtimeMap({ wholenessofbodyUses: 1, currentHitPoints: 89 });

    await handle(action, makeFighterStats(), campaignName, null);

    expect(healingRoll.applyHealingDirectly).toHaveBeenCalledWith(expect.anything(), 'EvasiveFighter', 54, campaignName);
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('EvasiveFighter', 'wholenessofbodyUses', 0, campaignName, true);
  });
});
