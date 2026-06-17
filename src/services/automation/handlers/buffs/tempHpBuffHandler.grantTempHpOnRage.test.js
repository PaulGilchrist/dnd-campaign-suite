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

import { grantTempHpOnRage } from './tempHpBuffHandler.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as automationService from '../../../combat/automation/automationService.js';
import { campaignName, makePlayerStats, makeAction, resetMocks } from './tempHpBuffTestHelpers.js';

// ────────────────────────────────────────────────────────────────
// grantTempHpOnRage — exported function
// ────────────────────────────────────────────────────────────────

describe('grantTempHpOnRage', () => {
  beforeEach(() => resetMocks());

  it('returns false when triggerOnRage is not set', () => {
    const action = makeAction({ triggerOnRage: false });
    const ps = makePlayerStats();

    const result = grantTempHpOnRage(action, ps, campaignName);

    expect(result).toBe(false);
  });

  it('returns false when tempHpExpression is empty', () => {
    const action = makeAction({ triggerOnRage: true, tempHpExpression: '' });
    const ps = makePlayerStats();

    const result = grantTempHpOnRage(action, ps, campaignName);

    expect(result).toBe(false);
  });

  it('returns false when tempHpExpression is undefined but triggerOnRage is set', () => {
    const action = makeAction({});
    action.automation.triggerOnRage = true;
    delete action.automation.tempHpExpression;

    const result = grantTempHpOnRage(action, makePlayerStats(), campaignName);

    expect(result).toBe(false);
  });

  it('returns false when evaluateAutoExpression returns non-number', () => {
    const action = makeAction({
      triggerOnRage: true,
      tempHpExpression: 'rage_damage_d6',
    });
    const ps = makePlayerStats();
    automationService.evaluateAutoExpression.mockReturnValue('2d6');

    const result = grantTempHpOnRage(action, ps, campaignName);

    expect(result).toBe(false);
  });

  it('returns false when evaluateAutoExpression returns 0', () => {
    const action = makeAction({
      triggerOnRage: true,
      tempHpExpression: 'level + 5',
    });
    const ps = makePlayerStats();
    automationService.evaluateAutoExpression.mockReturnValue(0);

    const result = grantTempHpOnRage(action, ps, campaignName);

    expect(result).toBe(false);
  });

  it('returns false when evaluateAutoExpression returns a negative number', () => {
    const action = makeAction({
      triggerOnRage: true,
      tempHpExpression: '-1',
    });
    const ps = makePlayerStats();
    automationService.evaluateAutoExpression.mockReturnValue(-5);

    const result = grantTempHpOnRage(action, ps, campaignName);

    expect(result).toBe(false);
  });

  it('returns true and sets tempHp when amount > existing', () => {
    const action = makeAction({
      triggerOnRage: true,
      tempHpExpression: 'rage_temp_hp',
    });
    const ps = makePlayerStats();

    useRuntimeState.getRuntimeValue.mockReturnValue(3);
    automationService.evaluateAutoExpression.mockReturnValue(10);

    const result = grantTempHpOnRage(action, ps, campaignName);

    expect(result).toBe(true);
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Grog', 'tempHp', 10, campaignName,
    );
  });

  it('keeps existing tempHp when amount <= existing', () => {
    const action = makeAction({
      triggerOnRage: true,
      tempHpExpression: 'rage_temp_hp',
    });
    const ps = makePlayerStats();

    useRuntimeState.getRuntimeValue.mockReturnValue(15);
    automationService.evaluateAutoExpression.mockReturnValue(10);

    const result = grantTempHpOnRage(action, ps, campaignName);

    expect(result).toBe(true);
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Grog', 'tempHp', 15, campaignName,
    );
  });

  it('treats null existing tempHp as 0', () => {
    const action = makeAction({
      triggerOnRage: true,
      tempHpExpression: 'rage_temp_hp',
    });
    useRuntimeState.getRuntimeValue.mockReturnValue(null);
    automationService.evaluateAutoExpression.mockReturnValue(5);

    const result = grantTempHpOnRage(action, makePlayerStats(), campaignName);

    expect(result).toBe(true);
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalled();
  });

  it('does not call setRuntimeValue when getRuntimeValue returns 0 and amount is same', () => {
    const action = makeAction({
      triggerOnRage: true,
      tempHpExpression: 'rage_temp_hp',
    });
    useRuntimeState.getRuntimeValue.mockReturnValue(0);
    automationService.evaluateAutoExpression.mockReturnValue(5);

    const result = grantTempHpOnRage(action, makePlayerStats(), campaignName);

    expect(result).toBe(true);
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Grog', 'tempHp', 5, campaignName,
    );
  });
});
