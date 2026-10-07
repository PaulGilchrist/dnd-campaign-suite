// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
  setRuntimeObject: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
  evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

import { handle, confirmBolsteringPerformance } from './tempHpBuffHandler.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as automationService from '../../../combat/automation/automationService.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import { campaignName, makePlayerStats, makeAction } from './tempHpBuff.test-utils.js';

function resetMocks() {
  useRuntimeState.getRuntimeValue.mockClear().mockReset();
  useRuntimeState.setRuntimeValue.mockClear().mockResolvedValue(undefined);
  useRuntimeState.setRuntimeObject.mockClear().mockResolvedValue(undefined);
  automationService.evaluateAutoExpression.mockClear().mockReset();
  damageUtils.getCombatContext.mockClear().mockReset();
}

// ────────────────────────────────────────────────────────────────
// handleMultiTargetAllyTempHp — route detection & modal payload
// ────────────────────────────────────────────────────────────────

describe('handleMultiTargetAllyTempHp', () => {
  beforeEach(() => resetMocks());

  it('returns a modal with temp HP amount and combat creature targets', async () => {
    const ps = makePlayerStats({ level: 5, name: 'Leader' });
    const action = makeAction({
      tempHpExpression: 'level + 3',
      range: '30 ft',
      targets: 6,
      includesSelf: true,
      multiTargetAlly: true,
    });
    automationService.evaluateAutoExpression.mockReturnValue(8);

    damageUtils.getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'Leader' },
        { name: 'Ally1' },
        { name: 'Ally2' },
      ],
    });

    const result = await handle(action, ps, campaignName, 'test-map');

    expect(result.type).toBe('modal');
    expect(result.modalName).toBe('bolsteringPerformanceTarget');
    expect(result.payload.tempHp).toBe(8);
    expect(result.payload.maxTargets).toBe(6);
    expect(result.payload.creatureTargets).toEqual([
      { name: 'Leader' },
      { name: 'Ally1' },
      { name: 'Ally2' },
    ]);
    expect(result.payload.action).toBe(action);
    expect(result.payload.playerStats).toBe(ps);
    expect(result.payload.campaignName).toBe(campaignName);
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('defaults maxTargets to 6 when automation.targets is absent', async () => {
    const ps = makePlayerStats({ level: 5, name: 'Leader' });
    const action = makeAction({
      tempHpExpression: 'level + 3',
      multiTargetAlly: true,
    });
    automationService.evaluateAutoExpression.mockReturnValue(8);
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });

    const result = await handle(action, ps, campaignName, 'test-map');

    expect(result.type).toBe('modal');
    expect(result.payload.maxTargets).toBe(6);
  });

  it('uses ASI choice from featAbilityChoices (2024 object format)', async () => {
    const ps = makePlayerStats({
      level: 10,
      name: 'Leader',
      featAbilityChoices: {
        'Inspiring Leader-0': { assignment: 'Wisdom' },
      },
      abilities: [
        { name: 'Charisma', score: 14, bonus: 2 },
        { name: 'Wisdom', score: 16, bonus: 3 },
      ],
    });
    const action = makeAction({
      tempHpExpression: 'level + Math.max(CHA modifier, WIS modifier)',
      multiTargetAlly: true,
    });
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [{ name: 'Leader' }] });

    const result = await handle(action, ps, campaignName, 'test-map');

    expect(result.type).toBe('modal');
    expect(result.payload.tempHp).toBe(13);
  });

  it('uses ASI choice from featAbilityChoices (legacy string format)', async () => {
    const ps = makePlayerStats({
      level: 10,
      name: 'Leader',
      featAbilityChoices: {
        '0': 'Charisma',
      },
      abilities: [
        { name: 'Charisma', score: 18, bonus: 4 },
        { name: 'Wisdom', score: 12, bonus: 1 },
      ],
    });
    const action = makeAction({
      tempHpExpression: 'level + Math.max(CHA modifier, WIS modifier)',
      multiTargetAlly: true,
    });
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [{ name: 'Leader' }] });

    const result = await handle(action, ps, campaignName, 'test-map');

    expect(result.type).toBe('modal');
    expect(result.payload.tempHp).toBe(14);
  });

  it('falls back to Math.max(CHA, WIS) when no ASI choice found', async () => {
    const ps = makePlayerStats({
      level: 10,
      name: 'Leader',
      abilities: [
        { name: 'Charisma', score: 18, bonus: 4 },
        { name: 'Wisdom', score: 16, bonus: 3 },
      ],
    });
    const action = makeAction({
      tempHpExpression: 'level + Math.max(CHA modifier, WIS modifier)',
      multiTargetAlly: true,
    });
    automationService.evaluateAutoExpression.mockReturnValue(14);
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [{ name: 'Leader' }] });

    const result = await handle(action, ps, campaignName, 'test-map');

    expect(result.type).toBe('modal');
    expect(result.payload.tempHp).toBe(14);
  });

  it('falls back to Math.max(CHA, WIS) when expression evaluation returns invalid result', async () => {
    const ps = makePlayerStats({
      level: 10,
      name: 'Leader',
      abilities: [
        { name: 'Charisma', score: 18, bonus: 4 },
        { name: 'Wisdom', score: 14, bonus: 2 },
      ],
    });
    const action = makeAction({
      tempHpExpression: 'invalid_expr',
      multiTargetAlly: true,
    });
    automationService.evaluateAutoExpression.mockReturnValue('invalid_expr');
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [{ name: 'Leader' }] });

    const result = await handle(action, ps, campaignName, 'test-map');

    expect(result.type).toBe('modal');
    expect(result.payload.tempHp).toBe(14);
  });

  it('returns empty creatureTargets when combat context is null', async () => {
    const ps = makePlayerStats({ level: 5, name: 'Leader' });
    const action = makeAction({
      tempHpExpression: 'level + 3',
      multiTargetAlly: true,
    });
    automationService.evaluateAutoExpression.mockReturnValue(8);
    damageUtils.getCombatContext.mockResolvedValue(null);

    const result = await handle(action, ps, campaignName, 'test-map');

    expect(result.type).toBe('modal');
    expect(result.payload.creatureTargets).toEqual([]);
    expect(result.payload.tempHp).toBe(8);
  });



  it('uses level + chosen ability modifier when featAbilityChoices has a valid entry', async () => {
    const ps = makePlayerStats({
      level: 15,
      name: 'Leader',
      featAbilityChoices: {
        'Inspiring Leader-0': { assignment: 'Charisma' },
      },
      abilities: [{ name: 'Charisma', score: 20, bonus: 5 }],
    });
    const action = makeAction({
      tempHpExpression: 'level + Math.max(CHA modifier, WIS modifier)',
      multiTargetAlly: true,
    });
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });

    const result = await handle(action, ps, campaignName, 'test-map');

    // level 15 + CHA modifier 5 = 20
    expect(result.payload.tempHp).toBe(20);
  });

  it('returns creature names mapped to { name } shape from combat context', async () => {
    const ps = makePlayerStats({ level: 5, name: 'Leader' });
    const action = makeAction({
      tempHpExpression: 'level + 3',
      multiTargetAlly: true,
    });
    automationService.evaluateAutoExpression.mockReturnValue(8);
    damageUtils.getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'Ally1', someOtherProp: 'ignored' },
        { name: 'Ally2' },
      ],
    });

    const result = await handle(action, ps, campaignName, 'test-map');

    expect(result.payload.creatureTargets).toEqual([
      { name: 'Ally1' },
      { name: 'Ally2' },
    ]);
  });

  it('falls back to Math.max(CHA, WIS) when no abilities array exists', async () => {
    const ps = makePlayerStats({
      level: 10,
      name: 'Leader',
      abilities: undefined,
    });
    const action = makeAction({
      tempHpExpression: 'level + Math.max(CHA modifier, WIS modifier)',
      multiTargetAlly: true,
    });
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });

    const result = await handle(action, ps, campaignName, 'test-map');

    // CHA/WIS not found, both modifiers default to 0, so level + max(0, 0) = 10
    expect(result.payload.tempHp).toBe(10);
  });
});

// ────────────────────────────────────────────────────────────────
// confirmBolsteringPerformance
// ────────────────────────────────────────────────────────────────

describe('confirmBolsteringPerformance', () => {
  beforeEach(resetMocks);

  it('applies temp HP to selected targets and returns success popup', async () => {
    const action = makeAction({
      type: 'temp_hp_buff',
      targets: 6,
    });
    const ps = makePlayerStats({ name: 'Leader' });

    const result = await confirmBolsteringPerformance(
      action, ps, campaignName, ['Ally1', 'Ally2'], 10,
    );

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.description).toContain('10 temporary hit points');
    expect(result.payload.description).toContain('2 creatures');
    expect(result.payload.description).toContain('Ally1, Ally2');

    const tempHpCalls = useRuntimeState.setRuntimeValue.mock.calls.filter(
      (c) => c[1] === 'tempHp',
    );
    expect(tempHpCalls.length).toBe(2);
    expect(tempHpCalls[0][2]).toBe(10);
    expect(tempHpCalls[1][2]).toBe(10);
  });

  it('preserves higher existing temp HP using Math.max', async () => {
    const action = makeAction({
      type: 'temp_hp_buff',
      targets: 6,
    });
    const ps = makePlayerStats({ name: 'Leader' });

    useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'tempHp') {
        if (_name === 'Ally1') return 20;
        if (_name === 'Ally2') return 0;
      }
      return 0;
    });

    await confirmBolsteringPerformance(
      action, ps, campaignName, ['Ally1', 'Ally2'], 10,
    );

    const tempHpCalls = useRuntimeState.setRuntimeValue.mock.calls.filter(
      (c) => c[1] === 'tempHp',
    );
    const ally1Call = tempHpCalls.find((c) => c[0] === 'Ally1');
    expect(ally1Call[2]).toBe(20);

    const ally2Call = tempHpCalls.find((c) => c[0] === 'Ally2');
    expect(ally2Call[2]).toBe(10);
  });

  it('respects max targets from automation config', async () => {
    const action = makeAction({
      type: 'temp_hp_buff',
      targets: 2,
    });
    const ps = makePlayerStats({ name: 'Leader' });

    await confirmBolsteringPerformance(
      action, ps, campaignName, ['A', 'B', 'C', 'D'], 10,
    );

    const tempHpCalls = useRuntimeState.setRuntimeValue.mock.calls.filter(
      (c) => c[1] === 'tempHp',
    );
    expect(tempHpCalls.length).toBe(2);
    expect(tempHpCalls[0][0]).toBe('A');
    expect(tempHpCalls[1][0]).toBe('B');
  });

  it('logs to campaign log with correct metadata', async () => {
    const action = makeAction({
      type: 'temp_hp_buff',
      targets: 6,
    });
    const ps = makePlayerStats({ name: 'Leader' });

    await confirmBolsteringPerformance(
      action, ps, campaignName, ['Ally1'], 10,
    );

    const { addEntry } = await import('../../../ui/logService.js');
    expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'ability_use',
      characterName: 'Leader',
      abilityName: 'Second Wind',
      description: expect.stringContaining('10 temporary hit points'),
    }));
  });

  it('handles empty selected targets', async () => {
    const action = makeAction({
      type: 'temp_hp_buff',
      targets: 6,
    });
    const ps = makePlayerStats({ name: 'Leader' });

    const result = await confirmBolsteringPerformance(
      action, ps, campaignName, [], 10,
    );

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('no targets selected');
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('handles null selected targets', async () => {
    const action = makeAction({
      type: 'temp_hp_buff',
      targets: 6,
    });
    const ps = makePlayerStats({ name: 'Leader' });

    const result = await confirmBolsteringPerformance(
      action, ps, campaignName, null, 10,
    );

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('no targets selected');
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('handles undefined selected targets', async () => {
    const action = makeAction({
      type: 'temp_hp_buff',
      targets: 6,
    });
    const ps = makePlayerStats({ name: 'Leader' });

    const result = await confirmBolsteringPerformance(
      action, ps, campaignName, undefined, 10,
    );

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('no targets selected');
  });

  it('uses singular "creature" when exactly one target', async () => {
    const action = makeAction({
      type: 'temp_hp_buff',
      targets: 6,
    });
    const ps = makePlayerStats({ name: 'Leader' });

    const result = await confirmBolsteringPerformance(
      action, ps, campaignName, ['Ally1'], 5,
    );

    expect(result.payload.description).toContain('1 creature');
    expect(result.payload.description).not.toContain('1 creatures');
  });

  it('uses plural "creatures" when more than one target', async () => {
    const action = makeAction({
      type: 'temp_hp_buff',
      targets: 6,
    });
    const ps = makePlayerStats({ name: 'Leader' });

    const result = await confirmBolsteringPerformance(
      action, ps, campaignName, ['A', 'B', 'C'], 5,
    );

    expect(result.payload.description).toMatch(/3 creatures/);
    expect(result.payload.description).not.toMatch(/\b3 creature\b/);
  });

  it('defaults maxTargets to 6 when automation.targets is absent', async () => {
    const action = makeAction({
      type: 'temp_hp_buff',
    });
    const ps = makePlayerStats({ name: 'Leader' });

    await confirmBolsteringPerformance(
      action, ps, campaignName, ['A', 'B', 'C', 'D', 'E', 'F', 'G'], 10,
    );

    const tempHpCalls = useRuntimeState.setRuntimeValue.mock.calls.filter(
      (c) => c[1] === 'tempHp',
    );
    expect(tempHpCalls.length).toBe(6);
  });

  it('includes action and automationType in popup payload', async () => {
    const action = makeAction({
      type: 'temp_hp_buff',
      targets: 3,
    });
    const ps = makePlayerStats({ name: 'Leader' });

    const result = await confirmBolsteringPerformance(
      action, ps, campaignName, ['Ally1'], 10,
    );

    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.name).toBe('Second Wind');
    expect(result.payload.automationType).toBe('temp_hp_buff');
  });

  it('only applies to first N targets when more are selected than allowed', async () => {
    const action = makeAction({
      type: 'temp_hp_buff',
      targets: 1,
    });
    const ps = makePlayerStats({ name: 'Leader' });

    await confirmBolsteringPerformance(
      action, ps, campaignName, ['First', 'Second', 'Third'], 10,
    );

    const tempHpCalls = useRuntimeState.setRuntimeValue.mock.calls.filter(
      (c) => c[1] === 'tempHp',
    );
    expect(tempHpCalls.length).toBe(1);
    expect(tempHpCalls[0][0]).toBe('First');
  });
});

// ────────────────────────────────────────────────────────────────
// FT-046: featName threading (amount) + once-per-rest latch
// ────────────────────────────────────────────────────────────────

function makeInspiringLeaderSetup() {
  const ps = makePlayerStats({
    level: 20,
    name: 'HeroesFeastBard',
    featAbilityChoices: {
      'Inspiring Leader-0': { assignment: 'Wisdom' },
    },
    abilities: [
      { name: 'Charisma', score: 21, bonus: 5 },
      { name: 'Wisdom', score: 10, bonus: 0 },
    ],
  });
  const action = makeAction({
    tempHpExpression: 'level + Math.max(CHA modifier, WIS modifier)',
    targets: 6,
    includesSelf: true,
    multiTargetAlly: true,
  }, { name: 'Bolstering Performance', featName: 'Inspiring Leader' });
  return { ps, action };
}

describe('FT-046 Inspiring Leader — featName resolves chosen ability', () => {
  beforeEach(() => resetMocks());

  it('uses featName (not benefit name) for featAbilityChoices lookup: level 20 + WIS +0 = 20', async () => {
    const { ps, action } = makeInspiringLeaderSetup();
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });

    const result = await handle(action, ps, campaignName, 'test-map');

    expect(result.type).toBe('modal');
    expect(result.payload.tempHp).toBe(20);
  });

  it('documents the fingerprint: without featName the fallback yields level + max(CHA,WIS) = 25', async () => {
    const { ps, action } = makeInspiringLeaderSetup();
    delete action.featName;
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });

    const result = await handle(action, ps, campaignName, 'test-map');

    expect(result.type).toBe('modal');
    expect(result.payload.tempHp).toBe(25);
  });
});

describe('FT-046 Inspiring Leader — once-per-rest latch', () => {
  beforeEach(() => resetMocks());

  it('refuses while latched: popup not modal, inspiring_leader_refused log, zero runtime writes', async () => {
    const { ps, action } = makeInspiringLeaderSetup();
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) =>
      (name === 'HeroesFeastBard' && key === 'inspiringLeaderUsedSinceRest') ? true : undefined,
    );

    const result = await handle(action, ps, campaignName, 'test-map');

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Already used this rest');
    const { addEntry } = await import('../../../ui/logService.js');
    expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'automation',
      automationType: 'inspiring_leader_refused',
      characterName: 'HeroesFeastBard',
    }));
    expect(damageUtils.getCombatContext).not.toHaveBeenCalled();
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(useRuntimeState.setRuntimeObject).not.toHaveBeenCalled();
  });

  it('opens the chooser when not latched', async () => {
    const { ps, action } = makeInspiringLeaderSetup();
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [{ name: 'HeroesFeastBard' }] });

    const result = await handle(action, ps, campaignName, 'test-map');

    expect(result.type).toBe('modal');
    expect(result.payload.tempHp).toBe(20);
  });

  it('stamps the latch merged with self tempHp in one awaited write when bard included', async () => {
    const { ps, action } = makeInspiringLeaderSetup();
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) =>
      (name === 'HeroesFeastBard' && key === 'tempHp') ? 5 : 0,
    );

    await confirmBolsteringPerformance(
      action, ps, campaignName, ['HeroesFeastBard', 'Ally1'], 20,
    );

    expect(useRuntimeState.setRuntimeObject).toHaveBeenCalledTimes(1);
    expect(useRuntimeState.setRuntimeObject).toHaveBeenCalledWith(
      'HeroesFeastBard',
      { inspiringLeaderUsedSinceRest: true, tempHp: 20 },
      campaignName,
    );
    const tempHpCalls = useRuntimeState.setRuntimeValue.mock.calls.filter(
      (c) => c[1] === 'tempHp',
    );
    expect(tempHpCalls.length).toBe(1);
    expect(tempHpCalls[0][0]).toBe('Ally1');
    expect(tempHpCalls[0][2]).toBe(20);
  });

  it('keeps higher existing self tempHp (replace-if-larger) while stamping the latch', async () => {
    const { ps, action } = makeInspiringLeaderSetup();
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) =>
      (name === 'HeroesFeastBard' && key === 'tempHp') ? 30 : 0,
    );

    await confirmBolsteringPerformance(
      action, ps, campaignName, ['HeroesFeastBard'], 20,
    );

    expect(useRuntimeState.setRuntimeObject).toHaveBeenCalledWith(
      'HeroesFeastBard',
      { inspiringLeaderUsedSinceRest: true, tempHp: 30 },
      campaignName,
    );
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('stamps the latch on allies-only grants too', async () => {
    const { ps, action } = makeInspiringLeaderSetup();

    await confirmBolsteringPerformance(
      action, ps, campaignName, ['Ally1', 'Ally2'], 20,
    );

    expect(useRuntimeState.setRuntimeObject).toHaveBeenCalledTimes(1);
    expect(useRuntimeState.setRuntimeObject).toHaveBeenCalledWith(
      'HeroesFeastBard',
      { inspiringLeaderUsedSinceRest: true },
      campaignName,
    );
  });

  it('does NOT stamp the latch when nothing is granted (empty selection)', async () => {
    const { ps, action } = makeInspiringLeaderSetup();

    const result = await confirmBolsteringPerformance(
      action, ps, campaignName, [], 20,
    );

    expect(result.payload.description).toContain('no targets selected');
    expect(useRuntimeState.setRuntimeObject).not.toHaveBeenCalled();
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  });
});
