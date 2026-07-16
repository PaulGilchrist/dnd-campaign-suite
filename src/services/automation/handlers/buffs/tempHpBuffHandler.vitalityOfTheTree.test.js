// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
  evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../../maps/mapsService.js', () => ({
  loadMapData: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(),
  rangeToFeet: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn().mockResolvedValue(true),
}));

import { handle, confirmVitalityOfTheTree } from './tempHpBuffHandler.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as combatData from '../../../encounters/combatData.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationService.js';
import { campaignName, makePlayerStats, makeAction, resetMocks } from './tempHpBuffTestHelpers.js';

// ────────────────────────────────────────────────────────────────
// handle (route detection) — Vitality of the Tree path
// ────────────────────────────────────────────────────────────────

describe('route detection', () => {
  it('delegates to Vitality handler when ongoingHealingExpression and healingStartOfTurn are set', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(0);
    combatData.getCurrentCombatRound.mockReturnValue(3);
    evaluateAutoExpression.mockReturnValue(3);
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });

    const action = makeAction({
      ongoingHealingExpression: 'rage_damage_d6',
      healingStartOfTurn: true,
      healingRange: '10 ft',
    });
    const ps = makePlayerStats();

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('modal');
    expect(result.modalName).toBe('vitalityOfTheTreeTarget');
  });

});

// ────────────────────────────────────────────────────────────────
// handleVitalityOfTheTree — same round as rage (no creatures)
// ────────────────────────────────────────────────────────────────

describe('same round as rage', () => {
  beforeEach(() => {
    resetMocks();
    evaluateAutoExpression.mockReturnValue(3);
  });

  it('returns popup when current round equals rage activation round', async () => {
    const action = makeAction({
      ongoingHealingExpression: 'rage_damage_d6',
      healingStartOfTurn: true,
    });
    const ps = makePlayerStats({
      name: 'Barbarian1',
    });

    useRuntimeState.getRuntimeValue.mockReturnValue(3);
    combatData.getCurrentCombatRound.mockReturnValue(3);
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('same round');
    expect(result.payload.description).toContain('Rage activated');
  });
});

// ────────────────────────────────────────────────────────────────
// handleVitalityOfTheTree — modal payload
// ────────────────────────────────────────────────────────────────

describe('modal payload', () => {
  beforeEach(() => resetMocks());

  it('returns modal with creature targets from combat context', async () => {
    const action = makeAction({
      ongoingHealingExpression: 'rage_damage_d6',
      healingStartOfTurn: true,
      healingRange: '10 ft',
    });
    const ps = makePlayerStats({
      name: 'Barbarian1',
      level: 5,
    });

    useRuntimeState.getRuntimeValue.mockReturnValue(1);
    combatData.getCurrentCombatRound.mockReturnValue(3);
    evaluateAutoExpression.mockReturnValue(3);
    damageUtils.getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'Barbarian1' },
        { name: 'Ally1' },
        { name: 'Enemy1' },
      ],
    });

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('modal');
    expect(result.modalName).toBe('vitalityOfTheTreeTarget');
    expect(result.payload.action).toBe(action);
    expect(result.payload.playerStats).toBe(ps);
    expect(result.payload.campaignName).toBe(campaignName);
    expect(result.payload.creatureTargets).toEqual([
      { name: 'Barbarian1' },
      { name: 'Ally1' },
      { name: 'Enemy1' },
    ]);
    expect(result.payload.tempHp).toBe(3);
    expect(result.payload.maxTargets).toBe(2);
  });

  it('calculates maxTargets as roundsElapsed', async () => {
    const action = makeAction({
      ongoingHealingExpression: 'rage_damage_d6',
      healingStartOfTurn: true,
    });
    const ps = makePlayerStats({ name: 'Barbarian1' });

    // Rage activated round 1, current round 5 → 4 rounds elapsed → 4 targets
    useRuntimeState.getRuntimeValue.mockReturnValue(1);
    combatData.getCurrentCombatRound.mockReturnValue(5);
    evaluateAutoExpression.mockReturnValue(5);
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });

    const result = await handle(action, ps, campaignName);
    expect(result.payload.maxTargets).toBe(4);
  });

  it('uses default maxTargets of 1 when roundsElapsed is 0 or negative', async () => {
    const action = makeAction({
      ongoingHealingExpression: 'rage_damage_d6',
      healingStartOfTurn: true,
    });
    const ps = makePlayerStats({ name: 'Barbarian1' });

    // Rage activated round 3, current round 3 → 0 rounds elapsed
    useRuntimeState.getRuntimeValue.mockReturnValue(3);
    combatData.getCurrentCombatRound.mockReturnValue(3);
    evaluateAutoExpression.mockReturnValue(2);
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });

    const result = await handle(action, ps, campaignName);
    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('same round');
  });

  it('calculates temp HP from ongoingHealingExpression', async () => {
    const action = makeAction({
      ongoingHealingExpression: '2d6',
      healingStartOfTurn: true,
    });
    const ps = makePlayerStats({ name: 'Barbarian1' });

    useRuntimeState.getRuntimeValue.mockReturnValue(1);
    combatData.getCurrentCombatRound.mockReturnValue(2);
    evaluateAutoExpression.mockReturnValue(7);
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });

    const result = await handle(action, ps, campaignName);
    expect(result.payload.tempHp).toBe(7);
  });

  it('returns popup when temp HP calculation fails', async () => {
    const action = makeAction({
      ongoingHealingExpression: 'invalid_expr',
      healingStartOfTurn: true,
    });
    const ps = makePlayerStats({ name: 'Barbarian1' });

    useRuntimeState.getRuntimeValue.mockReturnValue(1);
    combatData.getCurrentCombatRound.mockReturnValue(2);
    evaluateAutoExpression.mockReturnValue(-1);
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Could not calculate temp HP');
  });
});

// ────────────────────────────────────────────────────────────────
// confirmVitalityOfTheTree
// ────────────────────────────────────────────────────────────────

describe('confirmVitalityOfTheTree', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('applies temp HP to selected targets using max of existing', async () => {
    useRuntimeState.getRuntimeValue
      .mockReturnValueOnce(2)
      .mockReturnValueOnce(5);

    const action = makeAction({
      ongoingHealingExpression: 'rage_damage_d6',
      healingStartOfTurn: true,
    });
    const ps = makePlayerStats({
      name: 'Barbarian1',
    });

    const result = await confirmVitalityOfTheTree(
      action, ps, campaignName,
      ['Ally1', 'Ally2'],
      8,
      3
    );

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Ally1, Ally2');
    expect(result.payload.description).toContain('8 temporary hit points');

    const tempCalls = useRuntimeState.setRuntimeValue.mock.calls.filter(
      c => c[1] === 'tempHp'
    );
    expect(tempCalls.length).toBe(2);
    expect(tempCalls[0][2]).toBe(8);
    expect(tempCalls[1][2]).toBe(8);
  });

  it('logs to campaign log', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const action = makeAction({
      ongoingHealingExpression: 'rage_damage_d6',
      healingStartOfTurn: true,
    });
    const ps = makePlayerStats({
      name: 'Barbarian1',
    });

    await confirmVitalityOfTheTree(
      action, ps, campaignName,
      ['Ally1'],
      8,
      3
    );

    expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
      type: 'ability_use',
      characterName: 'Barbarian1',
      abilityName: 'Second Wind',
      description: expect.stringContaining('Ally1'),
      timestamp: expect.any(Number),
    });
  });

  it('clamps targets to maxTargets', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const action = makeAction({
      ongoingHealingExpression: 'rage_damage_d6',
      healingStartOfTurn: true,
    });
    const ps = makePlayerStats({
      name: 'Barbarian1',
    });

    await confirmVitalityOfTheTree(
      action, ps, campaignName,
      ['Ally1', 'Ally2', 'Ally3', 'Ally4'],
      8,
      2
    );

    const tempCalls = useRuntimeState.setRuntimeValue.mock.calls.filter(
      c => c[1] === 'tempHp'
    );
    expect(tempCalls.length).toBe(2);
    expect(tempCalls[0][0]).toBe('Ally1');
    expect(tempCalls[1][0]).toBe('Ally2');
  });

  it('handles empty or null selected targets', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const action = makeAction({
      ongoingHealingExpression: 'rage_damage_d6',
      healingStartOfTurn: true,
    });
    const ps = makePlayerStats({
      name: 'Barbarian1',
    });

    let result = await confirmVitalityOfTheTree(
      action, ps, campaignName,
      [],
      8,
      3
    );

    expect(result.payload.description).toContain('no targets selected');

    result = await confirmVitalityOfTheTree(
      action, ps, campaignName,
      null,
      8,
      3
    );

    expect(result.payload.description).toContain('no targets selected');
  });
});
