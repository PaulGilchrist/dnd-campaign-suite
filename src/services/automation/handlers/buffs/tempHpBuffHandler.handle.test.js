// @maintained-by-ai — deterministic contract tests for handle()'s GENERIC temp_hp_buff lane
// (missing expression, failed evaluation, grant + popup copy). Fixed lanes are owned by sibling
// suites: bolsteringTreats (incl. the dispatch-boundary "treat lane not entered" pin),
// mantleOfInspiration, multiTargetAlly, vitalityOfTheTree, grantTempHpOnRage.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
  evaluateAutoExpression: vi.fn(),
}));

vi.mock('./tempHpService.js', () => ({
  setTempHp: vi.fn(),
}));

import { handle } from './tempHpBuffHandler.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as automationService from '../../../combat/automation/automationService.js';
import * as tempHpService from './tempHpService.js';
import { campaignName, makePlayerStats, makeAction } from './tempHpBuff.test-utils.js';

function resetMocks() {
  useRuntimeState.getRuntimeValue.mockClear();
  useRuntimeState.setRuntimeValue.mockClear();
  automationService.evaluateAutoExpression.mockClear();
  tempHpService.setTempHp.mockClear();
}

describe('handle — missing tempHpExpression', () => {
  beforeEach(() => resetMocks());

  it.each([[''], [null], [undefined]])(
    'returns info popup with correct metadata and zero side effects when tempHpExpression is %s',
    async (tempHpExpression) => {
      const ps = makePlayerStats();
      const action = makeAction({ tempHpExpression });

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Second Wind');
      expect(result.payload.automationType).toBe('temp_hp_buff');
      expect(result.payload.description).toBe('Second Wind: No temp HP expression defined.');
      expect(automationService.evaluateAutoExpression).not.toHaveBeenCalled();
      expect(tempHpService.setTempHp).not.toHaveBeenCalled();
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    },
  );
});

describe('handle — invalid evaluation result', () => {
  beforeEach(() => resetMocks());

  // Covers both failure arms of the `typeof amount !== 'number' || amount <= 0` guard:
  // non-number returns (string, null) and non-positive numbers (0, negative).
  it.each([
    ['not-a-number', 'INVALID_EXPR'],
    [null, 'null_expr'],
    [0, '0'],
    [-3, '-3'],
  ])('returns popup when evaluateAutoExpression returns %p (expression: %s)', async (mockReturn, expression) => {
    const action = makeAction({ tempHpExpression: expression });
    const ps = makePlayerStats();
    automationService.evaluateAutoExpression.mockReturnValue(mockReturn);

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.name).toBe('Second Wind');
    expect(result.payload.description).toContain('Could not calculate temp HP');
    expect(result.payload.description).toContain(String(expression));
    expect(tempHpService.setTempHp).not.toHaveBeenCalled();
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  });
});

describe('handle — successful temp HP', () => {
  beforeEach(() => resetMocks());

  it('calls setTempHp, returns popup with success description, and omits ongoing healing text', async () => {
    const action = makeAction({ tempHpExpression: 'level + 5' });
    const ps = makePlayerStats();
    automationService.evaluateAutoExpression.mockReturnValue(8);

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.name).toBe('Second Wind');
    expect(result.payload.automationType).toBe('temp_hp_buff');
    // Exact pin doubles as the "no ongoing healing text" negative when ongoingHealingExpression is empty.
    expect(result.payload.description).toBe('Gained 8 temporary hit points from Second Wind.');
    expect(result.payload.description).not.toContain('At the start of each turn');
    expect(tempHpService.setTempHp).toHaveBeenCalledWith('Grog', 8, campaignName);
  });

  it.each([
    ['explicit range', '30 ft', 'within 30 ft.'],
    ['default range (empty string)', '', 'within 10 ft.'],
    ['default range (undefined)', undefined, 'within 10 ft.'],
  ])(
    'appends ongoing healing text with %s when ongoingHealingExpression is set',
    async (_label, healingRange, expectedRangeFragment) => {
      const action = makeAction({
        tempHpExpression: 'level + 5',
        ongoingHealingExpression: '1d4',
        healingRange,
      });
      const ps = makePlayerStats();
      automationService.evaluateAutoExpression.mockReturnValue(8);

      const result = await handle(action, ps, campaignName);

      expect(result.payload.description).toBe(
        `Gained 8 temporary hit points from Second Wind. At the start of each turn while raging, can grant temp HP to a creature ${expectedRangeFragment}`,
      );
      expect(tempHpService.setTempHp).toHaveBeenCalledWith('Grog', 8, campaignName);
    },
  );
});
