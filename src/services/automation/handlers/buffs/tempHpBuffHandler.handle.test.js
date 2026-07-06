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

describe('handle — missing tempHpExpression', () => {
  beforeEach(() => resetMocks());

  it('returns popup with info type when tempHpExpression is empty, undefined, or missing', async () => {
    const ps = makePlayerStats();

    let result = await handle(makeAction({}), ps, campaignName);
    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.description).toBe('Second Wind: No temp HP expression defined.');
    expect(automationService.evaluateAutoExpression).not.toHaveBeenCalled();
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();

    result = await handle(makeAction({ tempHpExpression: undefined }), ps, campaignName);
    expect(result.payload.description).toBe('Second Wind: No temp HP expression defined.');

    const action3 = makeAction({}, { name: 'Rage' });
    result = await handle(action3, ps, campaignName);
    expect(result.payload.description).toBe('Rage: No temp HP expression defined.');
  });
});

describe('handle — invalid evaluation result', () => {
  beforeEach(() => resetMocks());

  it.each([
    ['not-a-number', 'INVALID_EXPR'],
    [0, '0'],
    [-3, '-3'],
  ])('returns popup when evaluateAutoExpression returns %p (expression: %s)', async (mockReturn, expression) => {
    const action = makeAction({ tempHpExpression: expression });
    const ps = makePlayerStats();
    automationService.evaluateAutoExpression.mockReturnValue(mockReturn);

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Could not calculate temp HP');
    expect(result.payload.description).toContain(expression);
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  });
});

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

  it('includes ongoing healing text and range when ongoingHealingExpression is set', async () => {
    const action = makeAction({
      tempHpExpression: 'level + 5',
      ongoingHealingExpression: '1d4',
      healingRange: '30 ft',
    });
    const ps = makePlayerStats();
    automationService.evaluateAutoExpression.mockReturnValue(8);

    const result = await handle(action, ps, campaignName);

    expect(result.payload.description).toContain('Gained 8 temporary hit points');
    expect(result.payload.description).toContain('Second Wind');
    expect(result.payload.description).toContain('At the start of each turn while raging');
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

  it('uses the player name from playerStats and campaignName for setRuntimeValue', async () => {
    const action = makeAction({ tempHpExpression: '10' });
    const ps = makePlayerStats({ name: 'Faldorn' });
    automationService.evaluateAutoExpression.mockReturnValue(10);

    await handle(action, ps, 'OtherCampaign');

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Faldorn', 'tempHp', 10, 'OtherCampaign',
    );
  });
});
