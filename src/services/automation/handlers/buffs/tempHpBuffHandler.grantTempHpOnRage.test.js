// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
  evaluateAutoExpression: vi.fn(),
}));

import { grantTempHpOnRage } from './tempHpBuffHandler.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as automationService from '../../../combat/automation/automationService.js';
import { campaignName, makePlayerStats, makeAction } from './tempHpBuffTestHelpers.js';

describe('grantTempHpOnRage', () => {
  beforeEach(() => {
    useRuntimeState.getRuntimeValue.mockClear();
    useRuntimeState.setRuntimeValue.mockClear();
    automationService.evaluateAutoExpression.mockClear();
  });

  it('returns false when triggerOnRage is not set', () => {
    const action = makeAction({ triggerOnRage: false });
    const ps = makePlayerStats();

    const result = grantTempHpOnRage(action, ps, campaignName);

    expect(result).toBe(false);
    expect(automationService.evaluateAutoExpression).not.toHaveBeenCalled();
    expect(useRuntimeState.getRuntimeValue).not.toHaveBeenCalled();
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('returns false when tempHpExpression is empty string', () => {
    const action = makeAction({ triggerOnRage: true, tempHpExpression: '' });
    const ps = makePlayerStats();

    const result = grantTempHpOnRage(action, ps, campaignName);

    expect(result).toBe(false);
    expect(automationService.evaluateAutoExpression).not.toHaveBeenCalled();
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('returns false when tempHpExpression is undefined', () => {
    const action = makeAction({ triggerOnRage: true });
    delete action.automation.tempHpExpression;

    const result = grantTempHpOnRage(action, makePlayerStats(), campaignName);

    expect(result).toBe(false);
    expect(automationService.evaluateAutoExpression).not.toHaveBeenCalled();
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('returns false when evaluateAutoExpression returns a non-number string', () => {
    const action = makeAction({
      triggerOnRage: true,
      tempHpExpression: 'rage_damage_d6',
    });
    automationService.evaluateAutoExpression.mockReturnValue('2d6');

    const result = grantTempHpOnRage(action, makePlayerStats(), campaignName);

    expect(result).toBe(false);
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('returns false when evaluateAutoExpression returns undefined', () => {
    const action = makeAction({
      triggerOnRage: true,
      tempHpExpression: 'undefined_expr',
    });
    automationService.evaluateAutoExpression.mockReturnValue(undefined);

    const result = grantTempHpOnRage(action, makePlayerStats(), campaignName);

    expect(result).toBe(false);
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('returns false when evaluateAutoExpression returns 0', () => {
    const action = makeAction({
      triggerOnRage: true,
      tempHpExpression: 'level - level',
    });
    automationService.evaluateAutoExpression.mockReturnValue(0);

    const result = grantTempHpOnRage(action, makePlayerStats(), campaignName);

    expect(result).toBe(false);
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('returns false when evaluateAutoExpression returns a negative number', () => {
    const action = makeAction({
      triggerOnRage: true,
      tempHpExpression: '-1',
    });
    automationService.evaluateAutoExpression.mockReturnValue(-5);

    const result = grantTempHpOnRage(action, makePlayerStats(), campaignName);

    expect(result).toBe(false);
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('returns true and sets tempHp when amount exceeds existing', () => {
    const action = makeAction({
      triggerOnRage: true,
      tempHpExpression: 'rage_temp_hp',
    });
    const ps = makePlayerStats();

    useRuntimeState.getRuntimeValue.mockReturnValue(3);
    automationService.evaluateAutoExpression.mockReturnValue(10);

    const result = grantTempHpOnRage(action, ps, campaignName);

    expect(result).toBe(true);
    expect(useRuntimeState.getRuntimeValue).toHaveBeenCalledWith('Grog', 'tempHp', campaignName);
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('Grog', 'tempHp', 10, campaignName);
  });

  it('keeps existing tempHp when new amount is lower', () => {
    const action = makeAction({
      triggerOnRage: true,
      tempHpExpression: 'rage_temp_hp',
    });
    const ps = makePlayerStats();

    useRuntimeState.getRuntimeValue.mockReturnValue(15);
    automationService.evaluateAutoExpression.mockReturnValue(10);

    const result = grantTempHpOnRage(action, ps, campaignName);

    expect(result).toBe(true);
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('Grog', 'tempHp', 15, campaignName);
  });

  it('keeps existing tempHp when new amount equals existing', () => {
    const action = makeAction({
      triggerOnRage: true,
      tempHpExpression: 'rage_temp_hp',
    });
    const ps = makePlayerStats();

    useRuntimeState.getRuntimeValue.mockReturnValue(10);
    automationService.evaluateAutoExpression.mockReturnValue(10);

    const result = grantTempHpOnRage(action, ps, campaignName);

    expect(result).toBe(true);
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('Grog', 'tempHp', 10, campaignName);
  });

  it('treats null existing tempHp as 0 and sets the new amount', () => {
    const action = makeAction({
      triggerOnRage: true,
      tempHpExpression: 'rage_temp_hp',
    });

    useRuntimeState.getRuntimeValue.mockReturnValue(null);
    automationService.evaluateAutoExpression.mockReturnValue(5);

    const result = grantTempHpOnRage(action, makePlayerStats(), campaignName);

    expect(result).toBe(true);
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('Grog', 'tempHp', 5, campaignName);
  });

  it('treats undefined existing tempHp as 0 and sets the new amount', () => {
    const action = makeAction({
      triggerOnRage: true,
      tempHpExpression: 'rage_temp_hp',
    });

    useRuntimeState.getRuntimeValue.mockReturnValue(undefined);
    automationService.evaluateAutoExpression.mockReturnValue(5);

    const result = grantTempHpOnRage(action, makePlayerStats(), campaignName);

    expect(result).toBe(true);
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('Grog', 'tempHp', 5, campaignName);
  });

  it('sets tempHp when existing is 0 and new amount is positive', () => {
    const action = makeAction({
      triggerOnRage: true,
      tempHpExpression: 'rage_temp_hp',
    });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);
    automationService.evaluateAutoExpression.mockReturnValue(5);

    const result = grantTempHpOnRage(action, makePlayerStats(), campaignName);

    expect(result).toBe(true);
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('Grog', 'tempHp', 5, campaignName);
  });

  it('uses the player name from playerStats as the character key', () => {
    const action = makeAction({
      triggerOnRage: true,
      tempHpExpression: 'rage_temp_hp',
    });
    const ps = makePlayerStats({ name: 'CustomPlayer' });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);
    automationService.evaluateAutoExpression.mockReturnValue(7);

    grantTempHpOnRage(action, ps, campaignName);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('CustomPlayer', 'tempHp', 7, campaignName);
  });

  it('passes campaignName through to setRuntimeValue', () => {
    const action = makeAction({
      triggerOnRage: true,
      tempHpExpression: 'rage_temp_hp',
    });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);
    automationService.evaluateAutoExpression.mockReturnValue(8);

    grantTempHpOnRage(action, makePlayerStats(), 'MyCampaign');

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('Grog', 'tempHp', 8, 'MyCampaign');
  });
});
