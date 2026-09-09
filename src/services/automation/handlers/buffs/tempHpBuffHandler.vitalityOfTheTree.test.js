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

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
  rangeToFeet: vi.fn().mockReturnValue(10),
}));

import { handle, confirmVitalityOfTheTree } from './tempHpBuffHandler.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as combatData from '../../../encounters/combatData.js';
import * as automationService from '../../../combat/automation/automationService.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as rangeCheck from '../../../rules/combat/rangeCheck.js';
import { campaignName, makePlayerStats, makeAction } from './tempHpBuff.test-utils.js';

const RAGE_BUFF = [{ name: 'Rage', effect: 'stance' }];

function resetMocks() {
  useRuntimeState.getRuntimeValue.mockClear().mockReset();
  useRuntimeState.setRuntimeValue.mockClear().mockReset().mockResolvedValue(undefined);
  useRuntimeState.setRuntimeObject.mockClear().mockReset().mockResolvedValue(undefined);
  automationService.evaluateAutoExpression.mockClear().mockReset();
  logService.addEntry.mockClear().mockReset().mockResolvedValue({});
  damageUtils.getCombatContext.mockClear().mockReset();
  combatData.getCurrentCombatRound.mockClear().mockReset();
  rangeCheck.isWithinRange.mockClear().mockReset().mockResolvedValue(true);
}

function gateMocks({ rage = true, available = true, rageRound = 1 } = {}) {
  useRuntimeState.getRuntimeValue.mockImplementation((name, prop) => {
    if (prop === 'activeBuffs') return rage ? RAGE_BUFF : [];
    if (prop === 'vitalityOfTheTreeAvailable') return available;
    if (prop === 'vitalityOfTheTreeRageRound') return rageRound;
    if (prop === 'vitalityOfTheTreeGrantedTargets') return [];
    return 0;
  });
}

const vitalityAction = () => makeAction({
  ongoingHealingExpression: 'rage_damage_d6',
  healingStartOfTurn: true,
  healingRange: '10 ft',
});

// ────────────────────────────────────────────────────────────────
// Route detection — handle delegates to Vitality of the Tree path
// ────────────────────────────────────────────────────────────────

describe('route detection', () => {
  it('delegates to Vitality handler when ongoingHealingExpression and healingStartOfTurn are set', async () => {
    resetMocks();
    gateMocks({ rageRound: 1 });
    combatData.getCurrentCombatRound.mockReturnValue(3);
    automationService.evaluateAutoExpression.mockReturnValue(3);
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });

    const result = await handle(vitalityAction(), makePlayerStats(), campaignName);

    expect(result.type).toBe('modal');
    expect(result.modalName).toBe('vitalityOfTheTreeTarget');
  });

  it('does NOT delegate when only ongoingHealingExpression is set without healingStartOfTurn', async () => {
    resetMocks();
    const action = makeAction({
      ongoingHealingExpression: 'rage_damage_d6',
      healingStartOfTurn: false,
    });
    const ps = makePlayerStats();

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('No temp HP expression defined');
  });

  it('does NOT delegate when only healingStartOfTurn is set without ongoingHealingExpression', async () => {
    resetMocks();
    const action = makeAction({
      ongoingHealingExpression: '',
      healingStartOfTurn: true,
    });
    const ps = makePlayerStats();

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('No temp HP expression defined');
  });
});

// ────────────────────────────────────────────────────────────────
// CLA-378 offer gates — live Rage + vitalityOfTheTreeAvailable
// ────────────────────────────────────────────────────────────────

describe('offer gates', () => {
  beforeEach(() => {
    resetMocks();
    automationService.evaluateAutoExpression.mockReturnValue(3);
    combatData.getCurrentCombatRound.mockReturnValue(3);
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });
  });

  it('refuses the row click without a live Rage buff and logs refusal', async () => {
    gateMocks({ rage: false, available: true, rageRound: 1 });

    const result = await handle(vitalityAction(), makePlayerStats({ name: 'Barbarian1' }), campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('requires Rage to be active');
    expect(result.modalName).toBeUndefined();
    expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'automation',
      automationType: 'vitality_of_the_tree_refused',
      characterName: 'Barbarian1',
    }));
  });

  it('refuses the row click when vitalityOfTheTreeAvailable is false and logs refusal', async () => {
    gateMocks({ rage: true, available: false, rageRound: 1 });

    const result = await handle(vitalityAction(), makePlayerStats({ name: 'Barbarian1' }), campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('start of your turns');
    expect(result.modalName).toBeUndefined();
    expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      automationType: 'vitality_of_the_tree_refused',
    }));
  });

  it('opens the modal when Rage is live and the offer flag is set', async () => {
    gateMocks({ rage: true, available: true, rageRound: 1 });

    const result = await handle(vitalityAction(), makePlayerStats({ name: 'Barbarian1' }), campaignName);

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
    automationService.evaluateAutoExpression.mockReturnValue(3);
  });

  it('returns popup and logs refusal when current round equals rage activation round', async () => {
    gateMocks({ rageRound: 3 });
    combatData.getCurrentCombatRound.mockReturnValue(3);
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });

    const result = await handle(vitalityAction(), makePlayerStats({ name: 'Barbarian1' }), campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('same round');
    expect(result.payload.description).toContain('Rage activated');
    expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      automationType: 'vitality_of_the_tree_refused',
    }));
  });

  it('returns popup when rage round is in the future relative to current round', async () => {
    gateMocks({ rageRound: 5 });
    combatData.getCurrentCombatRound.mockReturnValue(3);
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });

    const result = await handle(vitalityAction(), makePlayerStats({ name: 'Barbarian1' }), campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('same round');
  });
});

// ────────────────────────────────────────────────────────────────
// handleVitalityOfTheTree — modal payload
// ────────────────────────────────────────────────────────────────

describe('modal payload', () => {
  beforeEach(() => resetMocks());

  it('returns modal with creature targets from combat context', async () => {
    gateMocks({ rageRound: 1 });
    combatData.getCurrentCombatRound.mockReturnValue(3);
    automationService.evaluateAutoExpression.mockReturnValue(3);
    damageUtils.getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'Barbarian1' },
        { name: 'Ally1' },
        { name: 'Enemy1' },
      ],
    });

    const ps = makePlayerStats({ name: 'Barbarian1', level: 5 });
    const action = vitalityAction();
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
  });

  it('returns empty creatureTargets when combat context has no creatures key', async () => {
    gateMocks({ rageRound: 1 });
    combatData.getCurrentCombatRound.mockReturnValue(3);
    automationService.evaluateAutoExpression.mockReturnValue(3);
    damageUtils.getCombatContext.mockResolvedValue({});

    const result = await handle(vitalityAction(), makePlayerStats({ name: 'Barbarian1' }), campaignName);

    expect(result.type).toBe('modal');
    expect(result.payload.creatureTargets).toEqual([]);
  });

  it('returns empty creatureTargets when combat context is null', async () => {
    gateMocks({ rageRound: 1 });
    combatData.getCurrentCombatRound.mockReturnValue(3);
    automationService.evaluateAutoExpression.mockReturnValue(3);
    damageUtils.getCombatContext.mockResolvedValue(null);

    const result = await handle(vitalityAction(), makePlayerStats({ name: 'Barbarian1' }), campaignName);

    expect(result.type).toBe('modal');
    expect(result.payload.creatureTargets).toEqual([]);
  });

  it('CLA-378 clamps maxTargets to 1 regardless of rounds elapsed', async () => {
    gateMocks({ rageRound: 1 });
    combatData.getCurrentCombatRound.mockReturnValue(5);
    automationService.evaluateAutoExpression.mockReturnValue(5);
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });

    const result = await handle(vitalityAction(), makePlayerStats({ name: 'Barbarian1' }), campaignName);

    expect(result.type).toBe('modal');
    expect(result.payload.maxTargets).toBe(1);
  });

  it('calculates temp HP from ongoingHealingExpression', async () => {
    gateMocks({ rageRound: 1 });
    combatData.getCurrentCombatRound.mockReturnValue(2);
    automationService.evaluateAutoExpression.mockReturnValue(7);
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });

    const result = await handle(vitalityAction(), makePlayerStats({ name: 'Barbarian1' }), campaignName);

    expect(result.payload.tempHp).toBe(7);
  });

  it('returns popup when temp HP calculation yields a non-positive value', async () => {
    gateMocks({ rageRound: 1 });
    combatData.getCurrentCombatRound.mockReturnValue(2);
    automationService.evaluateAutoExpression.mockReturnValue(-1);
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });

    const result = await handle(makeAction({
      ongoingHealingExpression: 'invalid_expr',
      healingStartOfTurn: true,
    }), makePlayerStats({ name: 'Barbarian1' }), campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Could not calculate temp HP');
  });

  it('returns popup when temp HP calculation yields zero', async () => {
    gateMocks({ rageRound: 1 });
    combatData.getCurrentCombatRound.mockReturnValue(2);
    automationService.evaluateAutoExpression.mockReturnValue(0);
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });

    const result = await handle(makeAction({
      ongoingHealingExpression: '0',
      healingStartOfTurn: true,
    }), makePlayerStats({ name: 'Barbarian1' }), campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Could not calculate temp HP');
  });

  it('includes the expression in the error message when calculation fails', async () => {
    gateMocks({ rageRound: 1 });
    combatData.getCurrentCombatRound.mockReturnValue(2);
    automationService.evaluateAutoExpression.mockReturnValue(null);
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });

    const result = await handle(makeAction({
      ongoingHealingExpression: 'bad_expression',
      healingStartOfTurn: true,
    }), makePlayerStats({ name: 'Barbarian1' }), campaignName);

    expect(result.payload.description).toContain('bad_expression');
  });

  it('returns modal when evaluation yields a parseable dice string like 1d6', async () => {
    gateMocks({ rageRound: 1 });
    combatData.getCurrentCombatRound.mockReturnValue(2);
    automationService.evaluateAutoExpression.mockReturnValue('1d6');
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });

    const result = await handle(makeAction({
      ongoingHealingExpression: '1d6',
      healingStartOfTurn: true,
    }), makePlayerStats({ name: 'Barbarian1' }), campaignName);

    expect(result.type).toBe('modal');
    expect(typeof result.payload.tempHp).toBe('number');
    expect(result.payload.tempHp).toBeGreaterThanOrEqual(1);
    expect(result.payload.tempHp).toBeLessThanOrEqual(6);
  });

  it('returns popup when evaluation yields an unparseable string', async () => {
    gateMocks({ rageRound: 1 });
    combatData.getCurrentCombatRound.mockReturnValue(2);
    automationService.evaluateAutoExpression.mockReturnValue('not_a_dice');
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });

    const result = await handle(makeAction({
      ongoingHealingExpression: 'not_a_dice',
      healingStartOfTurn: true,
    }), makePlayerStats({ name: 'Barbarian1' }), campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Could not calculate temp HP');
  });

  it('includes action name and automationType in error popup', async () => {
    gateMocks({ rageRound: 1 });
    combatData.getCurrentCombatRound.mockReturnValue(2);
    automationService.evaluateAutoExpression.mockReturnValue(-1);
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });

    const result = await handle(makeAction({
      ongoingHealingExpression: 'bad',
      healingStartOfTurn: true,
    }), makePlayerStats({ name: 'Barbarian1' }), campaignName);

    expect(result.payload.name).toBe('Second Wind');
    expect(result.payload.automationType).toBe('temp_hp_buff');
  });
});

// ────────────────────────────────────────────────────────────────
// confirmVitalityOfTheTree
// ────────────────────────────────────────────────────────────────

describe('confirmVitalityOfTheTree', () => {
  beforeEach(() => {
    resetMocks();
    gateMocks({ rageRound: 1 });
  });

  it('applies temp HP to a single selected target', async () => {
    const result = await confirmVitalityOfTheTree(
      vitalityAction(), makePlayerStats({ name: 'Barbarian1' }), campaignName,
      ['Ally1'],
      8,
      1,
    );

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Ally1');
    expect(result.payload.description).toContain('8 temporary hit points');

    const tempCalls = useRuntimeState.setRuntimeValue.mock.calls.filter(
      (c) => c[1] === 'tempHp',
    );
    expect(tempCalls.length).toBe(1);
    expect(tempCalls[0][0]).toBe('Ally1');
    expect(tempCalls[0][2]).toBe(8);
  });

  it('logs to campaign log with correct metadata', async () => {
    await confirmVitalityOfTheTree(
      vitalityAction(), makePlayerStats({ name: 'Barbarian1' }), campaignName,
      ['Ally1'],
      8,
      1,
    );

    expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
      type: 'ability_use',
      characterName: 'Barbarian1',
      abilityName: 'Second Wind',
      description: expect.stringContaining('Ally1'),
      timestamp: expect.any(Number),
    });
  });

  it('CLA-378 clamps multi-target selections to 1 creature', async () => {
    await confirmVitalityOfTheTree(
      vitalityAction(), makePlayerStats({ name: 'Barbarian1' }), campaignName,
      ['Ally1', 'Ally2', 'Ally3', 'Ally4'],
      8,
      4,
    );

    const tempCalls = useRuntimeState.setRuntimeValue.mock.calls.filter(
      (c) => c[1] === 'tempHp',
    );
    expect(tempCalls.length).toBe(1);
    expect(tempCalls[0][0]).toBe('Ally1');
  });

  it('CLA-378 clamps to 1 creature even when maxTargets is falsy', async () => {
    await confirmVitalityOfTheTree(
      vitalityAction(), makePlayerStats({ name: 'Barbarian1' }), campaignName,
      ['A', 'B', 'C', 'D', 'E'],
      8,
      0,
    );

    const tempCalls = useRuntimeState.setRuntimeValue.mock.calls.filter(
      (c) => c[1] === 'tempHp',
    );
    expect(tempCalls.length).toBe(1);
    expect(tempCalls[0][0]).toBe('A');
  });

  it('handles empty selected targets array', async () => {
    const result = await confirmVitalityOfTheTree(
      vitalityAction(), makePlayerStats({ name: 'Barbarian1' }), campaignName,
      [],
      8,
      1,
    );

    expect(result.payload.description).toContain('No targets granted');
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('handles null selected targets', async () => {
    const result = await confirmVitalityOfTheTree(
      vitalityAction(), makePlayerStats({ name: 'Barbarian1' }), campaignName,
      null,
      8,
      1,
    );

    expect(result.payload.description).toContain('No targets granted');
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('handles undefined selected targets', async () => {
    const result = await confirmVitalityOfTheTree(
      vitalityAction(), makePlayerStats({ name: 'Barbarian1' }), campaignName,
      undefined,
      8,
      1,
    );

    expect(result.payload.description).toContain('No targets granted');
  });

  it('returns popup with automation_info type and correct metadata', async () => {
    const result = await confirmVitalityOfTheTree(
      vitalityAction(), makePlayerStats({ name: 'Barbarian1' }), campaignName,
      ['Ally1'],
      8,
      1,
    );

    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.name).toBe('Second Wind');
    expect(result.payload.automationType).toBe('temp_hp_buff');
  });

  it('uses max of existing temp HP when existing is higher than granted amount', async () => {
    useRuntimeState.getRuntimeValue.mockImplementation((name, prop) => {
      if (prop === 'activeBuffs') return RAGE_BUFF;
      if (prop === 'tempHp') return 15;
      if (prop === 'vitalityOfTheTreeGrantedTargets') return [];
      return 0;
    });

    await confirmVitalityOfTheTree(
      vitalityAction(), makePlayerStats({ name: 'Barbarian1' }), campaignName,
      ['Ally1'],
      8,
      1,
    );

    const tempCalls = useRuntimeState.setRuntimeValue.mock.calls.filter(
      (c) => c[1] === 'tempHp',
    );
    expect(tempCalls[0][2]).toBe(15);
  });

  it('uses the new amount when it exceeds existing temp HP', async () => {
    useRuntimeState.getRuntimeValue.mockImplementation((name, prop) => {
      if (prop === 'activeBuffs') return RAGE_BUFF;
      if (prop === 'tempHp') return 3;
      if (prop === 'vitalityOfTheTreeGrantedTargets') return [];
      return 0;
    });

    await confirmVitalityOfTheTree(
      vitalityAction(), makePlayerStats({ name: 'Barbarian1' }), campaignName,
      ['Ally1'],
      10,
      1,
    );

    const tempCalls = useRuntimeState.setRuntimeValue.mock.calls.filter(
      (c) => c[1] === 'tempHp',
    );
    expect(tempCalls[0][2]).toBe(10);
  });

  it('CLA-378 refuses the grant without a live Rage buff, logging refusal and granting nothing', async () => {
    gateMocks({ rage: false });

    const result = await confirmVitalityOfTheTree(
      vitalityAction(), makePlayerStats({ name: 'Barbarian1' }), campaignName,
      ['Ally1'],
      8,
      1,
    );

    expect(result.payload.description).toContain('Requires Rage');
    const tempCalls = useRuntimeState.setRuntimeValue.mock.calls.filter(
      (c) => c[1] === 'tempHp',
    );
    expect(tempCalls.length).toBe(0);
    expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      automationType: 'vitality_of_the_tree_refused',
    }));
  });

  it('CLA-378 refuses an out-of-range target with a refusal log', async () => {
    rangeCheck.isWithinRange.mockResolvedValue(false);

    const result = await confirmVitalityOfTheTree(
      vitalityAction(), makePlayerStats({ name: 'Barbarian1' }), campaignName,
      ['Ally1'],
      8,
      1,
    );

    expect(result.payload.description).toContain('No targets granted');
    expect(rangeCheck.isWithinRange).toHaveBeenCalledWith('Barbarian1', 'Ally1', 10);
    const tempCalls = useRuntimeState.setRuntimeValue.mock.calls.filter(
      (c) => c[1] === 'tempHp',
    );
    expect(tempCalls.length).toBe(0);
    expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      automationType: 'vitality_of_the_tree_refused',
    }));
  });

  it('CLA-378 refuses self-targeting with a refusal log', async () => {
    const result = await confirmVitalityOfTheTree(
      vitalityAction(), makePlayerStats({ name: 'Barbarian1' }), campaignName,
      ['Barbarian1'],
      8,
      1,
    );

    expect(result.payload.description).toContain('No targets granted');
    const tempCalls = useRuntimeState.setRuntimeValue.mock.calls.filter(
      (c) => c[1] === 'tempHp',
    );
    expect(tempCalls.length).toBe(0);
    expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      automationType: 'vitality_of_the_tree_refused',
    }));
  });

  it('CLA-378 records attribution on the rage anchor and spends availability', async () => {
    combatData.getCurrentCombatRound.mockReturnValue(2);

    await confirmVitalityOfTheTree(
      vitalityAction(), makePlayerStats({ name: 'Barbarian1' }), campaignName,
      ['Ally1'],
      8,
      1,
    );

    expect(useRuntimeState.setRuntimeObject).toHaveBeenCalledWith('Barbarian1', {
      vitalityOfTheTreeGrantedTargets: [{ target: 'Ally1', amount: 8, round: 2 }],
      vitalityOfTheTreeAvailable: false,
    }, campaignName);
  });

  it('CLA-378 appends attribution to prior grants within the same rage', async () => {
    useRuntimeState.getRuntimeValue.mockImplementation((name, prop) => {
      if (prop === 'activeBuffs') return RAGE_BUFF;
      if (prop === 'vitalityOfTheTreeGrantedTargets') return [{ target: 'Ally0', amount: 6, round: 1 }];
      return 0;
    });
    combatData.getCurrentCombatRound.mockReturnValue(2);

    await confirmVitalityOfTheTree(
      vitalityAction(), makePlayerStats({ name: 'Barbarian1' }), campaignName,
      ['Ally1'],
      8,
      1,
    );

    expect(useRuntimeState.setRuntimeObject).toHaveBeenCalledWith('Barbarian1', expect.objectContaining({
      vitalityOfTheTreeGrantedTargets: [
        { target: 'Ally0', amount: 6, round: 1 },
        { target: 'Ally1', amount: 8, round: 2 },
      ],
      vitalityOfTheTreeAvailable: false,
    }), campaignName);
  });
});
