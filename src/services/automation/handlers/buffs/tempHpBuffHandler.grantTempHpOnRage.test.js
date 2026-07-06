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

  describe('early exits (returns false)', () => {
    it('returns false when triggerOnRage is not set', () => {
      const action = makeAction({ triggerOnRage: false });
      const ps = makePlayerStats();

      const result = grantTempHpOnRage(action, ps, campaignName);

      expect(result).toBe(false);
      expect(automationService.evaluateAutoExpression).not.toHaveBeenCalled();
      expect(useRuntimeState.getRuntimeValue).not.toHaveBeenCalled();
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('returns false when tempHpExpression is empty', () => {
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

    it('returns false when evaluated amount is not a positive number', () => {
      const action = makeAction({
        triggerOnRage: true,
        tempHpExpression: 'invalid_expr',
      });
      automationService.evaluateAutoExpression.mockReturnValue(-5);

      const result = grantTempHpOnRage(action, makePlayerStats(), campaignName);

      expect(result).toBe(false);
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('sets tempHp and returns true', () => {
    it('uses player name and campaignName from arguments in setRuntimeValue call', () => {
      const action = makeAction({
        triggerOnRage: true,
        tempHpExpression: 'rage_temp_hp',
      });
      const ps = makePlayerStats({ name: 'CustomPlayer' });

      useRuntimeState.getRuntimeValue.mockReturnValue(0);
      automationService.evaluateAutoExpression.mockReturnValue(7);

      grantTempHpOnRage(action, ps, 'MyCampaign');

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('CustomPlayer', 'tempHp', 7, 'MyCampaign');
    });

    it('sets tempHp when amount exceeds existing', () => {
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
  });
});
