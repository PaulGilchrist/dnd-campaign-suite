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

import { handle, confirmMantleOfInspiration } from './tempHpBuffHandler.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as expirations from '../../../rules/effects/expirations.js';
import { campaignName, makePlayerStats, makeAction, resetMocks } from './tempHpBuffTestHelpers.js';

// ────────────────────────────────────────────────────────────────
// handle (route detection) — Mantle path
// ────────────────────────────────────────────────────────────────

describe('route detection', () => {
  beforeEach(() => resetMocks());

  it('delegates to Mantle handler when bonusMovement is true and expression contains bardic_inspiration_die', async () => {
    const action = makeAction({
      bonusMovement: true,
      tempHpExpression: '2 * bardic_inspiration_die',
    });
    const ps = makePlayerStats();
    useRuntimeState.getRuntimeValue.mockReturnValue(0);
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('modal');
    expect(result.modalName).toBe('mantleOfInspirationTarget');
  });

});

// ────────────────────────────────────────────────────────────────
// handleMantleOfInspiration — exhausted uses
// ────────────────────────────────────────────────────────────────

describe('exhausted bardic inspiration uses', () => {
  beforeEach(() => resetMocks());

  it('returns popup with no-uses message when current uses is 0', async () => {
    const action = makeAction({
      bonusMovement: true,
      tempHpExpression: 'bardic_inspiration_die',
    });
    const ps = makePlayerStats({
      level: 5,
      class: {
        name: 'Bard',
        class_levels: [
          { level: 1, bardic_inspiration_uses: 2 },
          { level: 2, bardic_inspiration_uses: 2 },
          { level: 3, bardic_inspiration_uses: 2 },
          { level: 4, bardic_inspiration_uses: 2 },
          { level: 5, bardic_inspiration_uses: 2 },
        ],
      },
    });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('no uses remaining');
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

});

// ────────────────────────────────────────────────────────────────
// handleMantleOfInspiration — modal payload
// ────────────────────────────────────────────────────────────────

describe('modal payload', () => {
  beforeEach(() => resetMocks());

  it('returns modal with creature targets from combat context', async () => {
    const action = makeAction({
      bonusMovement: true,
      tempHpExpression: '2 * bardic_inspiration_die',
    });
    const ps = makePlayerStats({
      name: 'Bard1',
      level: 3,
      class: {
        name: 'Bard',
        class_levels: [
          { level: 1, bardic_inspiration_uses: 2 },
          { level: 2, bardic_inspiration_uses: 3 },
          { level: 3, bardic_die: 6, bardic_inspiration_uses: 3 },
        ],
      },
      abilities: [{ name: 'Charisma', score: 16 }],
    });

    useRuntimeState.getRuntimeValue.mockReturnValue(3);
    damageUtils.getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'Bard1' },
        { name: 'Ally1' },
        { name: 'Ally2' },
      ],
    });

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('modal');
    expect(result.modalName).toBe('mantleOfInspirationTarget');
    expect(result.payload.action).toBe(action);
    expect(result.payload.playerStats).toBe(ps);
    expect(result.payload.campaignName).toBe(campaignName);
    expect(result.payload.creatureTargets).toEqual([
      { name: 'Bard1' },
      { name: 'Ally1' },
      { name: 'Ally2' },
    ]);
    expect(result.payload.maxTargets).toBe(3);
    expect(typeof result.payload.tempHp).toBe('number');
    expect(typeof result.payload.dieRoll).toBe('number');
    expect(result.payload.bardicDieSize).toBe(6);
  });

  it('includes self in creature targets when self is in combat context', async () => {
    const action = makeAction({
      bonusMovement: true,
      tempHpExpression: 'bardic_inspiration_die',
    });
    const ps = makePlayerStats({
      name: 'Bard1',
      level: 1,
      class: {
        name: 'Bard',
        class_levels: [{ level: 1, bardic_inspiration_uses: 2 }],
      },
    });

    useRuntimeState.getRuntimeValue.mockReturnValue(2);
    damageUtils.getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Bard1' }],
    });

    const result = await handle(action, ps, campaignName);

    expect(result.payload.creatureTargets).toEqual([
      { name: 'Bard1' },
    ]);
  });

  it('uses cha modifier for maxTargets with floor of 1', async () => {
    const action = makeAction({
      bonusMovement: true,
      tempHpExpression: 'bardic_inspiration_die',
    });

    // Test with high CHA (+5 modifier -> maxTargets = 5)
    const highChaPs = makePlayerStats({
      level: 1,
      class: {
        name: 'Bard',
        class_levels: [{ level: 1, bardic_inspiration_uses: 2 }],
      },
      abilities: [{ name: 'Charisma', score: 20 }],
    });

    useRuntimeState.getRuntimeValue.mockReturnValue(2);
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });

    let result = await handle(action, highChaPs, campaignName);
    expect(result.payload.maxTargets).toBe(5);

    // Reset for low CHA test (+0 modifier -> maxTargets = 1)
    resetMocks();
    useRuntimeState.getRuntimeValue.mockReturnValue(2);

    const lowChaPs = makePlayerStats({
      level: 1,
      class: {
        name: 'Bard',
        class_levels: [{ level: 1, bardic_inspiration_uses: 2 }],
      },
      abilities: [{ name: 'Charisma', score: 10 }],
    });

    result = await handle(action, lowChaPs, campaignName);
    expect(result.payload.maxTargets).toBe(1);
  });

  it('resolves bardic_die size from classLevels at current level with default fallback', async () => {
    const action = makeAction({
      bonusMovement: true,
      tempHpExpression: 'bardic_inspiration_die',
    });

    // Test with explicit bardic_die at current level
    const level5Ps = makePlayerStats({
      level: 5,
      class: {
        name: 'Bard',
        class_levels: [
          { level: 1, bardic_die: 6 },
          { level: 5, bardic_die: 8 },
          { level: 10, bardic_die: 10 },
        ],
      },
    });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });

    let result = await handle(action, level5Ps, campaignName);
    expect(result.payload.bardicDieSize).toBe(8);

    // Reset for default fallback test (no bardic_die at level 3)
    resetMocks();
    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const noEntryPs = makePlayerStats({
      level: 3,
      class: {
        name: 'Bard',
        class_levels: [
          { level: 1 },
          { level: 5 },
        ],
      },
    });

    result = await handle(action, noEntryPs, campaignName);
    expect(result.payload.bardicDieSize).toBe(6);
  });

  it('decrements bardicInspirationUses on modal display', async () => {
    const action = makeAction({
      bonusMovement: true,
      tempHpExpression: 'bardic_inspiration_die',
    });
    const ps = makePlayerStats({
      level: 1,
      class: {
        name: 'Bard',
        class_levels: [{ level: 1, bardic_inspiration_uses: 2 }],
      },
    });

    useRuntimeState.getRuntimeValue.mockReturnValue(2);
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });

    await handle(action, ps, campaignName);

    const setCall = useRuntimeState.setRuntimeValue.mock.calls.find(
      c => c[1] === 'bardicInspirationUses',
    );
    expect(setCall).toBeDefined();
    expect(setCall[2]).toBe(1);
  });
});

// ────────────────────────────────────────────────────────────────
// confirmMantleOfInspiration
// ────────────────────────────────────────────────────────────────

describe('confirmMantleOfInspiration', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('applies temp HP to selected targets using max of existing', async () => {
    useRuntimeState.getRuntimeValue
      .mockReturnValueOnce(2)
      .mockReturnValueOnce(5);

    const action = makeAction({
      bonusMovement: true,
      tempHpExpression: 'bardic_inspiration_die',
    });
    const ps = makePlayerStats({
      name: 'Bard1',
      abilities: [{ name: 'Charisma', score: 16 }],
    });

    const result = await confirmMantleOfInspiration(
      action, ps, campaignName,
      ['Ally1', 'Ally2'],
      4, 6, 8
    );

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Ally1, Ally2');
    expect(result.payload.description).toContain('8 temporary hit points');

    // Should set tempHp to 8 for each target (max of existing 5 and 8)
    const tempCalls = useRuntimeState.setRuntimeValue.mock.calls.filter(
      c => c[1] === 'tempHp'
    );
    expect(tempCalls.length).toBe(2);
    expect(tempCalls[0][2]).toBe(8);
    expect(tempCalls[1][2]).toBe(8);
  });

  it('sets inspiringMovementNoOA for each target', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const action = makeAction({
      bonusMovement: true,
      tempHpExpression: 'bardic_inspiration_die',
    });
    const ps = makePlayerStats({
      name: 'Bard1',
      abilities: [{ name: 'Charisma', score: 16 }],
    });

    await confirmMantleOfInspiration(
      action, ps, campaignName,
      ['Ally1'],
      4, 6, 8
    );

    const movementCalls = useRuntimeState.setRuntimeValue.mock.calls.filter(
      c => c[1] === 'inspiringMovementNoOA'
    );
    expect(movementCalls.length).toBe(1);
    expect(movementCalls[0][2]).toBe(true);
  });

  it('adds expiration for inspiring_movement_no_oa on each target', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const action = makeAction({
      bonusMovement: true,
      tempHpExpression: 'bardic_inspiration_die',
    });
    const ps = makePlayerStats({
      name: 'Bard1',
      abilities: [{ name: 'Charisma', score: 16 }],
    });

    await confirmMantleOfInspiration(
      action, ps, campaignName,
      ['Ally1', 'Ally2'],
      4, 6, 8
    );

    expect(expirations.addExpiration).toHaveBeenCalledWith(
      'Bard1',
      'Ally1',
      [{ type: 'inspiring_movement_no_oa' }],
      campaignName,
      1
    );
    expect(expirations.addExpiration).toHaveBeenCalledWith(
      'Bard1',
      'Ally2',
      [{ type: 'inspiring_movement_no_oa' }],
      campaignName,
      1
    );
  });

  it('logs to campaign log', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const action = makeAction({
      bonusMovement: true,
      tempHpExpression: 'bardic_inspiration_die',
    });
    const ps = makePlayerStats({
      name: 'Bard1',
    });

    await confirmMantleOfInspiration(
      action, ps, campaignName,
      ['Ally1'],
      4, 6, 8
    );

    expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
      type: 'ability_use',
      characterName: 'Bard1',
      abilityName: 'Second Wind',
      description: expect.stringContaining('Ally1'),
    });
  });

  it('clamps targets to max allowed by CHA modifier', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const action = makeAction({
      bonusMovement: true,
      tempHpExpression: 'bardic_inspiration_die',
    });
    const ps = makePlayerStats({
      name: 'Bard1',
      abilities: [{ name: 'Charisma', score: 12 }], // +1 modifier
    });

    await confirmMantleOfInspiration(
      action, ps, campaignName,
      ['Ally1', 'Ally2', 'Ally3'],
      4, 6, 8
    );

    // Should only apply to 1 target (maxTargets = Math.max(1, 1) = 1)
    const tempCalls = useRuntimeState.setRuntimeValue.mock.calls.filter(
      c => c[1] === 'tempHp'
    );
    expect(tempCalls.length).toBe(1);
    expect(tempCalls[0][0]).toBe('Ally1');
  });

  it('handles empty or null selected targets', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const action = makeAction({
      bonusMovement: true,
      tempHpExpression: 'bardic_inspiration_die',
    });
    const ps = makePlayerStats({
      name: 'Bard1',
    });

    let result = await confirmMantleOfInspiration(
      action, ps, campaignName,
      [],
      4, 6, 8
    );

    expect(result.payload.description).toContain('no targets selected');
    expect(result.payload.description).not.toContain('Reaction');

    result = await confirmMantleOfInspiration(
      action, ps, campaignName,
      null,
      4, 6, 8
    );

    expect(result.payload.description).toContain('no targets selected');
  });
});
