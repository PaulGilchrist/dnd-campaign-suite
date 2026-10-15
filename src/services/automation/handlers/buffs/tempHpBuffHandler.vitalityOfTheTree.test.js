// @maintained-by-ai — deterministic contract tests for the Vitality of the Tree lane of tempHpBuffHandler:
// dispatch into handleVitalityOfTheTree, CLA-378 offer/round gates, modal payload, confirmVitalityOfTheTree.
// Generic-lane message copy ("No temp HP expression defined" / "Could not calculate temp HP") is owned SOLELY
// by tempHpBuffHandler.handle.test.js — falls-through cases here pin shape only (type==='popup', no modalName).
// replace-if-larger tempHp semantics are owned by tempHpBuffHandler.bolsteringTreats.test.js (REAL setTempHp).
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

  // AND-condition: each flag alone must NOT enter the vitality lane. Shape-only pins —
  // the fall-through popup copy is owned by the generic handle lane (handle.test.js).
  it.each([
    ['ongoingHealingExpression without healingStartOfTurn', { ongoingHealingExpression: 'rage_damage_d6', healingStartOfTurn: false }],
    ['healingStartOfTurn without ongoingHealingExpression', { ongoingHealingExpression: '', healingStartOfTurn: true }],
  ])('does NOT delegate when only %s is set', async (_label, automation) => {
    resetMocks();
    const action = makeAction(automation);

    const result = await handle(action, makePlayerStats(), campaignName);

    expect(result.type).toBe('popup');
    expect(result.modalName).toBeUndefined();
    // vitality lane never entered → no vitality refusal log either
    expect(logService.addEntry).not.toHaveBeenCalled();
  });
});

// ────────────────────────────────────────────────────────────────
// CLA-378 offer gates — live Rage + vitalityOfTheTreeAvailable
// (positive "both gates pass → modal" case is pinned in route detection)
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
});

// ────────────────────────────────────────────────────────────────
// handleVitalityOfTheTree — roundsElapsed <= 0 refusal guard
// ────────────────────────────────────────────────────────────────

describe('same round as rage', () => {
  beforeEach(() => {
    resetMocks();
    automationService.evaluateAutoExpression.mockReturnValue(3);
  });

  it.each([
    ['rage activated this round', 3],
    ['rage round in the future', 5],
  ])('refuses and logs when current round is 3 and %s', async (_label, rageRound) => {
    gateMocks({ rageRound });
    combatData.getCurrentCombatRound.mockReturnValue(3);
    damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });

    const result = await handle(vitalityAction(), makePlayerStats({ name: 'Barbarian1' }), campaignName);

    expect(result.type).toBe('popup');
    expect(result.modalName).toBeUndefined();
    expect(result.payload.description).toContain('same round');
    expect(result.payload.description).toContain('Rage activated');
    expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      automationType: 'vitality_of_the_tree_refused',
    }));
  });
});

// ────────────────────────────────────────────────────────────────
// handleVitalityOfTheTree — modal payload
// ────────────────────────────────────────────────────────────────

describe('modal payload', () => {
  beforeEach(() => resetMocks());

  it('returns modal with creature targets, caller refs, and temp HP from the expression', async () => {
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

  it.each([
    ['no creatures key', {}],
    ['null combat context', null],
  ])('returns empty creatureTargets when combat context has %s', async (_label, combatContext) => {
    gateMocks({ rageRound: 1 });
    combatData.getCurrentCombatRound.mockReturnValue(3);
    automationService.evaluateAutoExpression.mockReturnValue(3);
    damageUtils.getCombatContext.mockResolvedValue(combatContext);

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

  it('rolls the temp HP amount when evaluation yields a parseable dice string', async () => {
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

  // Every failure arm of rollDiceExpression's guard (≤0 number, non-string,
  // unparseable string): shape-only pins per lane ownership — the error popup
  // copy lives with the generic handle lane. Ordering pin: the guard fires
  // before any combat-context read or store write.
  it.each([
    ['zero', 0],
    ['negative', -1],
    ['null', null],
    ['unparseable string', 'not_a_dice'],
  ])('returns popup with zero side effects when evaluation yields %p', async (_label, evalResult) => {
    gateMocks({ rageRound: 1 });
    combatData.getCurrentCombatRound.mockReturnValue(2);
    automationService.evaluateAutoExpression.mockReturnValue(evalResult);

    const result = await handle(makeAction({
      ongoingHealingExpression: 'bad_expression',
      healingStartOfTurn: true,
    }), makePlayerStats({ name: 'Barbarian1' }), campaignName);

    expect(result.type).toBe('popup');
    expect(result.modalName).toBeUndefined();
    expect(damageUtils.getCombatContext).not.toHaveBeenCalled();
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(useRuntimeState.setRuntimeObject).not.toHaveBeenCalled();
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

  it('applies temp HP to a single selected target and returns the info popup', async () => {
    const result = await confirmVitalityOfTheTree({
          action: vitalityAction(),
          playerStats: makePlayerStats({ name: 'Barbarian1' }),
          campaignName,
          selectedTargets: ['Ally1'],
          tempHp: 8,
      });

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.name).toBe('Second Wind');
    expect(result.payload.automationType).toBe('temp_hp_buff');
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
    await confirmVitalityOfTheTree({
          action: vitalityAction(),
          playerStats: makePlayerStats({ name: 'Barbarian1' }),
          campaignName,
          selectedTargets: ['Ally1'],
          tempHp: 8,
      });

    expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
      type: 'ability_use',
      characterName: 'Barbarian1',
      abilityName: 'Second Wind',
      description: expect.stringContaining('Ally1'),
      timestamp: expect.any(Number),
    });
  });

  it('CLA-378 clamps multi-target selections to 1 creature', async () => {
    await confirmVitalityOfTheTree({
          action: vitalityAction(),
          playerStats: makePlayerStats({ name: 'Barbarian1' }),
          campaignName,
          selectedTargets: ['Ally1', 'Ally2', 'Ally3', 'Ally4'],
          tempHp: 8,
      });

    const tempCalls = useRuntimeState.setRuntimeValue.mock.calls.filter(
      (c) => c[1] === 'tempHp',
    );
    expect(tempCalls.length).toBe(1);
    expect(tempCalls[0][0]).toBe('Ally1');
  });

  it.each([
    ['empty array', []],
    ['null', null],
    ['undefined', undefined],
  ])('grants nothing and returns the no-targets popup when selectedTargets is %s', async (_label, selectedTargets) => {
    const result = await confirmVitalityOfTheTree({
          action: vitalityAction(),
          playerStats: makePlayerStats({ name: 'Barbarian1' }),
          campaignName,
          selectedTargets,
          tempHp: 8,
      });

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('No targets granted');
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('CLA-378 refuses the grant without a live Rage buff, logging refusal and granting nothing', async () => {
    gateMocks({ rage: false });

    const result = await confirmVitalityOfTheTree({
          action: vitalityAction(),
          playerStats: makePlayerStats({ name: 'Barbarian1' }),
          campaignName,
          selectedTargets: ['Ally1'],
          tempHp: 8,
      });

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

    const result = await confirmVitalityOfTheTree({
          action: vitalityAction(),
          playerStats: makePlayerStats({ name: 'Barbarian1' }),
          campaignName,
          selectedTargets: ['Ally1'],
          tempHp: 8,
      });

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
    const result = await confirmVitalityOfTheTree({
          action: vitalityAction(),
          playerStats: makePlayerStats({ name: 'Barbarian1' }),
          campaignName,
          selectedTargets: ['Barbarian1'],
          tempHp: 8,
      });

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

    await confirmVitalityOfTheTree({
          action: vitalityAction(),
          playerStats: makePlayerStats({ name: 'Barbarian1' }),
          campaignName,
          selectedTargets: ['Ally1'],
          tempHp: 8,
      });

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

    await confirmVitalityOfTheTree({
          action: vitalityAction(),
          playerStats: makePlayerStats({ name: 'Barbarian1' }),
          campaignName,
          selectedTargets: ['Ally1'],
          tempHp: 8,
      });

    expect(useRuntimeState.setRuntimeObject).toHaveBeenCalledWith('Barbarian1', expect.objectContaining({
      vitalityOfTheTreeGrantedTargets: [
        { target: 'Ally0', amount: 6, round: 1 },
        { target: 'Ally1', amount: 8, round: 2 },
      ],
      vitalityOfTheTreeAvailable: false,
    }), campaignName);
  });
});
