// @improved-by-ai
// @cleaned-by-ai
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

import { grantTempHpOnRage } from './tempHpBuffHandler.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as automationService from '../../../combat/automation/automationService.js';
import * as tempHpService from './tempHpService.js';
import { campaignName, makePlayerStats, makeAction } from './tempHpBuff.test-utils.js';

describe('grantTempHpOnRage', async () => {
  beforeEach(() => {
    useRuntimeState.getRuntimeValue.mockClear();
    useRuntimeState.setRuntimeValue.mockClear();
    automationService.evaluateAutoExpression.mockClear();
    tempHpService.setTempHp.mockClear();
  });

  describe('early exits (returns false)', async () => {
    it('returns false when triggerOnRage is not set', async () => {
      const action = makeAction({ triggerOnRage: false });
      const ps = makePlayerStats();

      const result = await grantTempHpOnRage(action, ps, campaignName);

      expect(result).toBe(0);
      expect(automationService.evaluateAutoExpression).not.toHaveBeenCalled();
      expect(tempHpService.setTempHp).not.toHaveBeenCalled();
    });

    it('returns false when triggerOnRage is missing entirely', async () => {
      const action = makeAction({ triggerOnRage: undefined });
      const ps = makePlayerStats();

      const result = await grantTempHpOnRage(action, ps, campaignName);

      expect(result).toBe(0);
      expect(automationService.evaluateAutoExpression).not.toHaveBeenCalled();
    });

    it('returns false when tempHpExpression is empty string', async () => {
      const action = makeAction({ triggerOnRage: true, tempHpExpression: '' });
      const ps = makePlayerStats();

      const result = await grantTempHpOnRage(action, ps, campaignName);

      expect(result).toBe(0);
      expect(automationService.evaluateAutoExpression).not.toHaveBeenCalled();
      expect(tempHpService.setTempHp).not.toHaveBeenCalled();
    });

    it('returns false when tempHpExpression is null', async () => {
      const action = makeAction({ triggerOnRage: true, tempHpExpression: null });
      const ps = makePlayerStats();

      const result = await grantTempHpOnRage(action, ps, campaignName);

      expect(result).toBe(0);
      expect(automationService.evaluateAutoExpression).not.toHaveBeenCalled();
    });

    it('returns false when evaluated amount is zero', async () => {
      const action = makeAction({ triggerOnRage: true, tempHpExpression: '0' });
      automationService.evaluateAutoExpression.mockReturnValue(0);

      const result = await grantTempHpOnRage(action, makePlayerStats(), campaignName);

      expect(result).toBe(0);
      expect(tempHpService.setTempHp).not.toHaveBeenCalled();
    });

    it('returns false when evaluated amount is negative', async () => {
      const action = makeAction({ triggerOnRage: true, tempHpExpression: '-5' });
      automationService.evaluateAutoExpression.mockReturnValue(-5);

      const result = await grantTempHpOnRage(action, makePlayerStats(), campaignName);

      expect(result).toBe(0);
      expect(tempHpService.setTempHp).not.toHaveBeenCalled();
    });

    it('returns false when evaluated amount is NaN', async () => {
      const action = makeAction({ triggerOnRage: true, tempHpExpression: 'invalid_expr' });
      automationService.evaluateAutoExpression.mockReturnValue(NaN);

      const result = await grantTempHpOnRage(action, makePlayerStats(), campaignName);

      expect(result).toBe(0);
      expect(tempHpService.setTempHp).not.toHaveBeenCalled();
    });

    it('returns false when evaluated amount is a non-number string', async () => {
      const action = makeAction({ triggerOnRage: true, tempHpExpression: 'abc' });
      automationService.evaluateAutoExpression.mockReturnValue('not-a-number');

      const result = await grantTempHpOnRage(action, makePlayerStats(), campaignName);

      expect(result).toBe(0);
      expect(tempHpService.setTempHp).not.toHaveBeenCalled();
    });

    it('returns false when evaluated amount is null', async () => {
      const action = makeAction({ triggerOnRage: true, tempHpExpression: 'null_expr' });
      automationService.evaluateAutoExpression.mockReturnValue(null);

      const result = await grantTempHpOnRage(action, makePlayerStats(), campaignName);

      expect(result).toBe(0);
      expect(tempHpService.setTempHp).not.toHaveBeenCalled();
    });
  });

  describe('sets tempHp and returns true', async () => {
    it('grants tempHp using evaluated amount when it exceeds existing', async () => {
      const action = makeAction({
        triggerOnRage: true,
        tempHpExpression: 'rage_temp_hp',
      });
      const ps = makePlayerStats();

      automationService.evaluateAutoExpression.mockReturnValue(10);

      const result = await grantTempHpOnRage(action, ps, campaignName);

      expect(result).toBe(10);
      expect(automationService.evaluateAutoExpression).toHaveBeenCalledWith('rage_temp_hp', ps);
      expect(tempHpService.setTempHp).toHaveBeenCalledWith('Grog', 10, campaignName);
    });

    it('passes evaluated amount directly to setTempHp', async () => {
      const action = makeAction({
        triggerOnRage: true,
        tempHpExpression: 'level + 5',
      });
      const ps = makePlayerStats({ level: 7 });

      automationService.evaluateAutoExpression.mockReturnValue(12);

      grantTempHpOnRage(action, ps, campaignName);

      expect(automationService.evaluateAutoExpression).toHaveBeenCalledWith('level + 5', ps);
      expect(tempHpService.setTempHp).toHaveBeenCalledWith('Grog', 12, campaignName);
    });

    it('calls setTempHp with the exact evaluated number', async () => {
      const action = makeAction({
        triggerOnRage: true,
        tempHpExpression: '1d12 + 3',
      });
      const ps = makePlayerStats();

      automationService.evaluateAutoExpression.mockReturnValue(9);

      grantTempHpOnRage(action, ps, campaignName);

      expect(tempHpService.setTempHp).toHaveBeenCalledWith('Grog', 9, campaignName);
    });
  });

  describe('integration with setTempHp', async () => {
    it('delegates max logic to setTempHp for existing tempHp comparison', async () => {
      const action = makeAction({
        triggerOnRage: true,
        tempHpExpression: 'rage_temp_hp',
      });
      const ps = makePlayerStats();

      tempHpService.setTempHp.mockReturnValue(15);

      const result = await grantTempHpOnRage(action, ps, campaignName);

      expect(result).toBe(9);
      expect(tempHpService.setTempHp).toHaveBeenCalledTimes(1);
      expect(tempHpService.setTempHp).toHaveBeenCalledWith('Grog', 9, campaignName);
    });
  });
});
