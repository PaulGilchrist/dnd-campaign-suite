// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
  evaluateAutoExpression: vi.fn(),
}));

import { handle } from './tempHpBuffHandler.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as automationService from '../../../combat/automation/automationService.js';
import { campaignName, makePlayerStats, makeAction } from './tempHpBuffTestHelpers.js';

function resetMocks() {
  useRuntimeState.getRuntimeValue.mockClear();
  useRuntimeState.setRuntimeValue.mockClear();
  automationService.evaluateAutoExpression.mockClear();
}

// ────────────────────────────────────────────────────────────────
// handle() — Missing temp HP expression (early return)
// ────────────────────────────────────────────────────────────────

describe('handle — missing tempHpExpression', () => {
  beforeEach(() => resetMocks());

  it('returns popup when tempHpExpression is empty string', async () => {
    const action = makeAction({});
    const ps = makePlayerStats();

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.name).toBe('Second Wind');
    expect(result.payload.automationType).toBe('temp_hp_buff');
    expect(result.payload.description).toBe('Second Wind: No temp HP expression defined.');
    expect(result.payload.automation).toBe(action.automation);
    expect(automationService.evaluateAutoExpression).not.toHaveBeenCalled();
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('returns popup when tempHpExpression is undefined', async () => {
    const action = makeAction({ tempHpExpression: undefined });
    delete action.automation.tempHpExpression;
    const ps = makePlayerStats();

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.name).toBe('Second Wind');
    expect(result.payload.automationType).toBe('temp_hp_buff');
    expect(result.payload.description).toContain('No temp HP expression defined');
    expect(result.payload.automation).toBe(action.automation);
    expect(automationService.evaluateAutoExpression).not.toHaveBeenCalled();
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('uses the action name in the popup description', async () => {
    const action = makeAction({}, { name: 'Rage' });
    const ps = makePlayerStats();

    const result = await handle(action, ps, campaignName);

    expect(result.payload.description).toBe('Rage: No temp HP expression defined.');
  });
});

// ────────────────────────────────────────────────────────────────
// handle() — Invalid / zero / negative evaluation results
// ────────────────────────────────────────────────────────────────

describe('handle — invalid evaluation result', () => {
  beforeEach(() => resetMocks());

  function expectErrorPopup(result, expression, actionRef) {
    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.name).toBe('Second Wind');
    expect(result.payload.automationType).toBe('temp_hp_buff');
    expect(result.payload.description).toContain('Could not calculate temp HP');
    expect(result.payload.description).toContain(expression);
    expect(result.payload.automation).toBe(actionRef.automation);
  }

  it('returns popup when evaluateAutoExpression returns a string', async () => {
    const action = makeAction({ tempHpExpression: 'INVALID_EXPR' });
    const ps = makePlayerStats();
    automationService.evaluateAutoExpression.mockReturnValue('INVALID_EXPR');

    const result = await handle(action, ps, campaignName);

    expectErrorPopup(result, 'INVALID_EXPR', action);
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('returns popup when evaluateAutoExpression returns 0', async () => {
    const action = makeAction({ tempHpExpression: '0' });
    const ps = makePlayerStats();
    automationService.evaluateAutoExpression.mockReturnValue(0);

    const result = await handle(action, ps, campaignName);

    expectErrorPopup(result, '0', action);
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('returns popup when evaluateAutoExpression returns a negative number', async () => {
    const action = makeAction({ tempHpExpression: '-3' });
    const ps = makePlayerStats();
    automationService.evaluateAutoExpression.mockReturnValue(-3);

    const result = await handle(action, ps, campaignName);

    expectErrorPopup(result, '-3', action);
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('returns popup when evaluateAutoExpression returns null', async () => {
    const action = makeAction({ tempHpExpression: 'maybe_something' });
    const ps = makePlayerStats();
    automationService.evaluateAutoExpression.mockReturnValue(null);

    const result = await handle(action, ps, campaignName);

    expectErrorPopup(result, 'maybe_something', action);
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('returns popup when evaluateAutoExpression returns undefined', async () => {
    const action = makeAction({ tempHpExpression: 'undefined_expr' });
    const ps = makePlayerStats();
    automationService.evaluateAutoExpression.mockReturnValue(undefined);

    const result = await handle(action, ps, campaignName);

    expectErrorPopup(result, 'undefined_expr', action);
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('returns popup when evaluateAutoExpression returns a boolean', async () => {
    const action = makeAction({ tempHpExpression: 'true' });
    const ps = makePlayerStats();
    automationService.evaluateAutoExpression.mockReturnValue(true);

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Could not calculate temp HP');
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('returns popup when evaluateAutoExpression returns an object', async () => {
    const action = makeAction({ tempHpExpression: 'obj' });
    const ps = makePlayerStats();
    automationService.evaluateAutoExpression.mockReturnValue({ value: 5 });

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Could not calculate temp HP');
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  });
});

// ────────────────────────────────────────────────────────────────
// handle() — Successful temp HP setting (non-Mantle path)
// ────────────────────────────────────────────────────────────────

describe('handle — successful temp HP', () => {
  beforeEach(() => resetMocks());

  it('sets tempHp runtime value and returns popup with success description', async () => {
    const action = makeAction({ tempHpExpression: 'level + 5' });
    const ps = makePlayerStats();
    automationService.evaluateAutoExpression.mockReturnValue(8);

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.name).toBe('Second Wind');
    expect(result.payload.automationType).toBe('temp_hp_buff');
    expect(result.payload.description).toBe('Gained 8 temporary hit points from Second Wind.');
    expect(result.payload.automation).toBe(action.automation);
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Grog', 'tempHp', 8, campaignName,
    );
  });

  it('includes ongoing healing text when ongoingHealingExpression is set', async () => {
    const action = makeAction({
      tempHpExpression: 'level + 5',
      ongoingHealingExpression: '1d4',
    });
    const ps = makePlayerStats();
    automationService.evaluateAutoExpression.mockReturnValue(8);

    const result = await handle(action, ps, campaignName);

    expect(result.payload.description).toContain('Gained 8 temporary hit points');
    expect(result.payload.description).toContain('Second Wind');
    expect(result.payload.description).toContain('At the start of each turn while raging');
    expect(result.payload.description).toContain('can grant temp HP');
  });

  it('uses custom healingRange in description', async () => {
    const action = makeAction({
      tempHpExpression: 'level + 5',
      ongoingHealingExpression: '1d4',
      healingRange: '30 ft',
    });
    const ps = makePlayerStats();
    automationService.evaluateAutoExpression.mockReturnValue(8);

    const result = await handle(action, ps, campaignName);

    expect(result.payload.description).toContain('30 ft');
  });

  it('uses default 10 ft range when ongoingHealingExpression is set but healingRange is empty', async () => {
    const action = makeAction({
      tempHpExpression: 'level + 5',
      ongoingHealingExpression: '1d4',
      healingRange: '',
    });
    const ps = makePlayerStats();
    automationService.evaluateAutoExpression.mockReturnValue(8);

    const result = await handle(action, ps, campaignName);

    expect(result.payload.description).toContain('10 ft');
  });

  it('uses the player name from playerStats as the key for setRuntimeValue', async () => {
    const action = makeAction({ tempHpExpression: '10' });
    const ps = makePlayerStats({ name: 'Faldorn' });
    automationService.evaluateAutoExpression.mockReturnValue(10);

    await handle(action, ps, campaignName);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Faldorn', 'tempHp', 10, campaignName,
    );
  });

  it('passes campaignName through to setRuntimeValue', async () => {
    const action = makeAction({ tempHpExpression: '10' });
    const ps = makePlayerStats();
    automationService.evaluateAutoExpression.mockReturnValue(10);

    await handle(action, ps, 'OtherCampaign');

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Grog', 'tempHp', 10, 'OtherCampaign',
    );
  });

  it('sets tempHp to the evaluated numeric amount', async () => {
    const action = makeAction({ tempHpExpression: 'level * 2' });
    const ps = makePlayerStats();
    automationService.evaluateAutoExpression.mockReturnValue(6);

    await handle(action, ps, campaignName);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Grog', 'tempHp', 6, campaignName,
    );
  });
});
