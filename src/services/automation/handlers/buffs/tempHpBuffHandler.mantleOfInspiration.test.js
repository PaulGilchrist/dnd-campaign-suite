// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
  evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn().mockResolvedValue(undefined),
}));

import { handle, confirmMantleOfInspiration } from './tempHpBuffHandler.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as expirations from '../../../rules/effects/expirations.js';
import { campaignName, makePlayerStats, makeAction } from './tempHpBuff.test-utils.js';

function resetMocks() {
  useRuntimeState.getRuntimeValue.mockClear().mockReset();
  useRuntimeState.setRuntimeValue.mockClear().mockResolvedValue(undefined);
  logService.addEntry.mockClear().mockResolvedValue({});
  damageUtils.getCombatContext.mockClear().mockReset();
  expirations.addExpiration.mockClear().mockReset();
}

// ────────────────────────────────────────────────────────────────
// handle — MantleOfInspiration route detection
// ────────────────────────────────────────────────────────────────

describe('handle — MantleOfInspiration route detection', () => {
  beforeEach(() => resetMocks());

  it('returns mantleOfInspirationTarget modal when bonusMovement is true and expression contains bardic_inspiration_die', async () => {
    const action = makeAction({
      bonusMovement: true,
      tempHpExpression: '2 * bardic_inspiration_die',
    });
    const ps = makePlayerStats();
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('modal');
    expect(result.modalName).toBe('mantleOfInspirationTarget');
  });

  it('does NOT route to Mantle when bonusMovement is false', async () => {
    const action = makeAction({
      bonusMovement: false,
      tempHpExpression: 'bardic_inspiration_die',
    });
    const ps = makePlayerStats();
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Could not calculate temp HP');
  });

  it('does NOT route to Mantle when expression does not contain bardic_inspiration_die', async () => {
    const action = makeAction({
      bonusMovement: true,
      tempHpExpression: '1d6 + 2',
    });
    const ps = makePlayerStats();
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Could not calculate temp HP');
  });
});

// ────────────────────────────────────────────────────────────────
// handleMantleOfInspiration — exhausted uses
// ────────────────────────────────────────────────────────────────

describe('handleMantleOfInspiration — exhausted uses', () => {
  beforeEach(() => resetMocks());

  function makeBardStats(uses, chaScore) {
    return makePlayerStats({
      level: 5,
      name: 'Bard',
      class: {
        name: 'Bard',
        class_levels: [
          { level: 1, bardic_inspiration_uses: 2 },
          { level: 2, bardic_inspiration_uses: 2 },
          { level: 3, bardic_inspiration_uses: 2 },
          { level: 4, bardic_inspiration_uses: 2 },
          { level: 5, bardic_inspiration_uses: uses },
        ],
      },
      ...(chaScore !== undefined ? { abilities: [{ name: 'Charisma', score: chaScore }] } : {}),
    });
  }

  it('returns popup with no-uses message when current uses is 0', async () => {
    const action = makeAction({
      bonusMovement: true,
      tempHpExpression: 'bardic_inspiration_die',
    });
    // usesMax = 2 (from class_levels[4].bardic_inspiration_uses), currentUses = 0
    const ps = makeBardStats(2);
    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('no uses remaining');
    expect(result.payload.description).toContain('Long Rest');
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('returns popup when uses are exhausted and runtime value is 0', async () => {
    const action = makeAction({
      bonusMovement: true,
      tempHpExpression: '2 * bardic_inspiration_die',
    });
    const ps = makeBardStats(3);
    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('no uses remaining');
  });
});

// ────────────────────────────────────────────────────────────────
// handleMantleOfInspiration — modal payload
// ────────────────────────────────────────────────────────────────

describe('handleMantleOfInspiration — modal payload', () => {
  beforeEach(() => resetMocks());

  function makeBardStats(level, bardicDie, uses) {
    const classLevels = [];
    for (let l = 1; l <= level; l++) {
      classLevels.push({
        level: l,
        bardic_inspiration_uses: uses ?? 2,
        ...(l === level && bardicDie !== undefined ? { bardic_die: bardicDie } : {}),
      });
    }
    return makePlayerStats({
      level,
      name: 'Bard',
      class: { name: 'Bard', class_levels: classLevels },
      abilities: bardicDie ? [{ name: 'Charisma', score: 16 }] : [],
    });
  }

  it('returns modal with creature targets from combat context', async () => {
    const action = makeAction({
      bonusMovement: true,
      tempHpExpression: '2 * bardic_inspiration_die',
    });
    const ps = makeBardStats(3, 6, 3);
    useRuntimeState.getRuntimeValue.mockReturnValue(3);
    damageUtils.getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'Bard' },
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
      { name: 'Bard' },
      { name: 'Ally1' },
      { name: 'Ally2' },
    ]);
  });

  it('includes self in creature targets when self is in combat context', async () => {
    const action = makeAction({
      bonusMovement: true,
      tempHpExpression: 'bardic_inspiration_die',
    });
    const ps = makeBardStats(1, 6, 2);
    useRuntimeState.getRuntimeValue.mockReturnValue(2);
    damageUtils.getCombatContext.mockResolvedValue({
      creatures: [{ name: 'Bard' }],
    });

    const result = await handle(action, ps, campaignName);

    expect(result.payload.creatureTargets).toEqual([{ name: 'Bard' }]);
  });

  it('returns empty creatureTargets when combat context has no creatures', async () => {
    const action = makeAction({
      bonusMovement: true,
      tempHpExpression: 'bardic_inspiration_die',
    });
    const ps = makeBardStats(1, 6, 2);
    useRuntimeState.getRuntimeValue.mockReturnValue(2);
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });

    const result = await handle(action, ps, campaignName);

    expect(result.payload.creatureTargets).toEqual([]);
  });

  it('computes maxTargets from CHA modifier with floor of 1', async () => {
    const action = makeAction({
      bonusMovement: true,
      tempHpExpression: 'bardic_inspiration_die',
    });

    useRuntimeState.getRuntimeValue.mockReturnValue(2);
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });

    const highChaPs = makeBardStats(1, 6, 2);
    highChaPs.abilities = [{ name: 'Charisma', score: 20 }];

    let result = await handle(action, highChaPs, campaignName);
    expect(result.payload.maxTargets).toBe(5);

    resetMocks();
    useRuntimeState.getRuntimeValue.mockReturnValue(2);

    const lowChaPs = makeBardStats(1, 6, 2);
    lowChaPs.abilities = [{ name: 'Charisma', score: 10 }];

    result = await handle(action, lowChaPs, campaignName);
    expect(result.payload.maxTargets).toBe(1);
  });

  it('resolves bardicDieSize from classLevels at current level with default fallback', async () => {
    const action = makeAction({
      bonusMovement: true,
      tempHpExpression: 'bardic_inspiration_die',
    });

    const level5Ps = makePlayerStats({
      level: 5,
      name: 'Bard',
      class: {
        name: 'Bard',
        class_levels: [
          { level: 1, bardic_die: 6, bardic_inspiration_uses: 2 },
          { level: 5, bardic_die: 8, bardic_inspiration_uses: 4 },
          { level: 10, bardic_die: 10, bardic_inspiration_uses: 4 },
        ],
      },
    });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });

    let result = await handle(action, level5Ps, campaignName);
    expect(result.payload.bardicDieSize).toBe(8);

    resetMocks();
    useRuntimeState.getRuntimeValue.mockReturnValue(2);

    const noEntryPs = makePlayerStats({
      level: 3,
      name: 'Bard',
      class: {
        name: 'Bard',
        class_levels: [
          { level: 1, bardic_inspiration_uses: 2 },
          { level: 5, bardic_inspiration_uses: 3 },
        ],
      },
      abilities: [{ name: 'Charisma', score: 16 }],
    });

    result = await handle(action, noEntryPs, campaignName);
    expect(result.payload.bardicDieSize).toBe(6);
  });

  it('decrements bardicInspirationUses on modal display', async () => {
    const action = makeAction({
      bonusMovement: true,
      tempHpExpression: 'bardic_inspiration_die',
    });
    const ps = makeBardStats(1, 6, 2);

    useRuntimeState.getRuntimeValue.mockReturnValue(2);
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });

    await handle(action, ps, campaignName);

    const setCalls = useRuntimeState.setRuntimeValue.mock.calls;
    const usesCall = setCalls.find(c => c[1] === 'bardicInspirationUses');
    expect(usesCall).toBeDefined();
    expect(usesCall[2]).toBe(1);
  });

  it('computes tempHp as 2 * dieRoll from the bardic die', async () => {
    const action = makeAction({
      bonusMovement: true,
      tempHpExpression: 'bardic_inspiration_die',
    });
    const ps = makeBardStats(3, 8, 3);

    useRuntimeState.getRuntimeValue.mockReturnValue(3);
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });

    const result = await handle(action, ps, campaignName);

    expect(result.payload.tempHp).toBe(result.payload.dieRoll * 2);
    expect(result.payload.bardicDieSize).toBe(8);
    expect(typeof result.payload.dieRoll).toBe('number');
    expect(result.payload.dieRoll).toBeGreaterThanOrEqual(1);
    expect(result.payload.dieRoll).toBeLessThanOrEqual(8);
  });

  it('uses cha modifier for maxTargets with floor of 1 — negative cha', async () => {
    const action = makeAction({
      bonusMovement: true,
      tempHpExpression: 'bardic_inspiration_die',
    });

    const negativeChaPs = makeBardStats(1, 6, 2);
    negativeChaPs.abilities = [{ name: 'Charisma', score: 3 }]; // -4 modifier -> maxTargets = 1

    useRuntimeState.getRuntimeValue.mockReturnValue(2);
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });

    const result = await handle(action, negativeChaPs, campaignName);
    expect(result.payload.maxTargets).toBe(1);
  });
});

// ────────────────────────────────────────────────────────────────
// confirmMantleOfInspiration
// ────────────────────────────────────────────────────────────────

describe('confirmMantleOfInspiration', () => {
  beforeEach(() => {
    resetMocks();
  });

  function makeMantleAction() {
    return makeAction({
      bonusMovement: true,
      tempHpExpression: 'bardic_inspiration_die',
    });
  }

  function makeBardStats(name, chaScore) {
    return makePlayerStats({
      name,
      abilities: chaScore !== undefined ? [{ name: 'Charisma', score: chaScore }] : [],
    });
  }

  it('applies temp HP to selected targets using max of existing', async () => {
    useRuntimeState.getRuntimeValue
      .mockReturnValueOnce(2)
      .mockReturnValueOnce(5);

    const action = makeMantleAction();
    const ps = makeBardStats('Bard1', 16);

    const result = await confirmMantleOfInspiration({
      action, playerStats: ps, campaignName,
      selectedTargets: ['Ally1', 'Ally2'],
      dieRoll: 4, bardicDieSize: 6, tempHp: 8
    })

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Ally1, Ally2');
    expect(result.payload.description).toContain('8 temporary hit points');
    expect(result.payload.description).toContain('Reaction');
    expect(result.payload.description).toContain('Opportunity Attacks');

    const tempCalls = useRuntimeState.setRuntimeValue.mock.calls.filter(
      c => c[1] === 'tempHp'
    );
    expect(tempCalls.length).toBe(2);
    expect(tempCalls[0][2]).toBe(8);
    expect(tempCalls[1][2]).toBe(8);
  });

  it('sets inspiringMovementNoOA for each target', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const action = makeMantleAction();
    const ps = makeBardStats('Bard1', 16);

    await confirmMantleOfInspiration({
      action, playerStats: ps, campaignName,
      selectedTargets: ['Ally1', 'Ally2', 'Ally3'],
      dieRoll: 4, bardicDieSize: 6, tempHp: 8
    })

    const movementCalls = useRuntimeState.setRuntimeValue.mock.calls.filter(
      c => c[1] === 'inspiringMovementNoOA'
    );
    expect(movementCalls.length).toBe(3);
    const targets = movementCalls.map(c => c[0]);
    expect(targets).toContain('Ally1');
    expect(targets).toContain('Ally2');
    expect(targets).toContain('Ally3');
    movementCalls.forEach(c => expect(c[2]).toBe(true));
  });

  it('adds expiration for inspiring_movement_no_oa on each target', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const action = makeMantleAction();
    const ps = makeBardStats('Bard1', 16);

    await confirmMantleOfInspiration({
      action, playerStats: ps, campaignName,
      selectedTargets: ['Ally1', 'Ally2'],
      dieRoll: 4, bardicDieSize: 6, tempHp: 8
    })

    expect(expirations.addExpiration).toHaveBeenCalledWith(
      'Bard1',
      'Ally1',
      [{ type: 'inspiring_movement_no_oa' }],
      campaignName,
      undefined,
      'Bard1'
    );
    expect(expirations.addExpiration).toHaveBeenCalledWith(
      'Bard1',
      'Ally2',
      [{ type: 'inspiring_movement_no_oa' }],
      campaignName,
      undefined,
      'Bard1'
    );
  });

  it('logs to campaign log with correct details', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const action = makeAction({}, { name: 'Mantle of Inspiration' });
    const ps = makeBardStats('Bard1');

    await confirmMantleOfInspiration({
      action, playerStats: ps, campaignName,
      selectedTargets: ['Ally1'],
      dieRoll: 4, bardicDieSize: 6, tempHp: 8
    })

    expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
      type: 'ability_use',
      characterName: 'Bard1',
      abilityName: 'Mantle of Inspiration',
      description: expect.stringContaining('Ally1'),
    });
  });

  it('logs die roll and bardic die size in the log description', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const action = makeMantleAction();
    const ps = makeBardStats('Bard1');

    await confirmMantleOfInspiration({
      action, playerStats: ps, campaignName,
      selectedTargets: ['Ally1'],
      dieRoll: 5, bardicDieSize: 8, tempHp: 10
    })

    const logCall = logService.addEntry.mock.calls[0][1];
    expect(logCall.description).toContain('rolled 5');
    expect(logCall.description).toContain('1d8');
    expect(logCall.description).toContain('10 temp HP');
  });

  it('clamps targets to max allowed by CHA modifier', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const action = makeMantleAction();
    const ps = makeBardStats('Bard1', 12); // +1 modifier

    await confirmMantleOfInspiration({
      action, playerStats: ps, campaignName,
      selectedTargets: ['Ally1', 'Ally2', 'Ally3'],
      dieRoll: 4, bardicDieSize: 6, tempHp: 8
    })

    const tempCalls = useRuntimeState.setRuntimeValue.mock.calls.filter(
      c => c[1] === 'tempHp'
    );
    expect(tempCalls.length).toBe(1);
    expect(tempCalls[0][0]).toBe('Ally1');
  });

  it('handles empty selected targets array', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const action = makeMantleAction();
    const ps = makeBardStats('Bard1');

    const result = await confirmMantleOfInspiration({
      action, playerStats: ps, campaignName,
      selectedTargets: [],
      dieRoll: 4, bardicDieSize: 6, tempHp: 8
    })

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('no targets selected');
    expect(result.payload.description).not.toContain('Reaction');
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('handles null selected targets', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const action = makeMantleAction();
    const ps = makeBardStats('Bard1');

    const result = await confirmMantleOfInspiration({
      action, playerStats: ps, campaignName,
      selectedTargets: null,
      dieRoll: 4, bardicDieSize: 6, tempHp: 8
    })

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('no targets selected');
  });

  it('handles undefined selected targets', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const action = makeMantleAction();
    const ps = makeBardStats('Bard1');

    const result = await confirmMantleOfInspiration({
      action, playerStats: ps, campaignName,
      selectedTargets: undefined,
      dieRoll: 4, bardicDieSize: 6, tempHp: 8
    })

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('no targets selected');
  });

  it('returns popup type with automation_info payload', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const action = makeMantleAction();
    const ps = makeBardStats('Bard1');

    const result = await confirmMantleOfInspiration({
      action, playerStats: ps, campaignName,
      selectedTargets: ['Ally1'],
      dieRoll: 4, bardicDieSize: 6, tempHp: 8
    })

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.name).toBe('Second Wind');
    expect(result.payload.automationType).toBe('temp_hp_buff');
  });

  it('applies temp HP to at least 1 target even with negative CHA modifier', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const action = makeMantleAction();
    const ps = makeBardStats('Bard1', 1); // CHA score 1 -> modifier -5 -> Math.max(1, -5) = 1

    const result = await confirmMantleOfInspiration({
      action, playerStats: ps, campaignName,
      selectedTargets: ['Ally1', 'Ally2'],
      dieRoll: 4, bardicDieSize: 6, tempHp: 8
    })

    // Even with CHA 1 (modifier -5), Math.max(1, -5) = 1 so at least 1 target is selected
    expect(result.payload.description).toContain('Ally1');
    expect(result.payload.description).not.toContain('no targets selected');
    const tempCalls = useRuntimeState.setRuntimeValue.mock.calls.filter(
      c => c[1] === 'tempHp'
    );
    expect(tempCalls.length).toBe(1);
    expect(tempCalls[0][0]).toBe('Ally1');
  });
});
