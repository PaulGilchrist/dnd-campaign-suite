// @maintained-by-ai
// Rage-gated temp-HP grant contract (called by combatStanceHandler rage stances).
// grantTempHpOnRage is a small self-contained guard chain: rage gate → expression
// guard → evaluate → positive-finite guard → delegate to setTempHp → return amount.
// All collaborators mocked and deterministic — update only if this contract changes.
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

describe('grantTempHpOnRage', () => {
  beforeEach(() => {
    useRuntimeState.getRuntimeValue.mockClear();
    useRuntimeState.setRuntimeValue.mockClear();
    // mockReset (not mockClear) so mockReturnValue impls never leak across tests.
    automationService.evaluateAutoExpression.mockClear().mockReset();
    tempHpService.setTempHp.mockClear().mockReset();
  });

  describe('early exits (returns 0, no grant)', () => {
    it.each([false, undefined])(
      'returns 0 when triggerOnRage is %p, even with a valid expression',
      async (triggerOnRage) => {
        const action = makeAction({ triggerOnRage, tempHpExpression: '2 + 3' });
        automationService.evaluateAutoExpression.mockReturnValue(5);

        const result = await grantTempHpOnRage(action, makePlayerStats(), campaignName);

        expect(result).toBe(0);
        expect(automationService.evaluateAutoExpression).not.toHaveBeenCalled();
        expect(tempHpService.setTempHp).not.toHaveBeenCalled();
      }
    );

    it.each(['', null, undefined])(
      'returns 0 when tempHpExpression is %p',
      async (tempHpExpression) => {
        const action = makeAction({ triggerOnRage: true, tempHpExpression });

        const result = await grantTempHpOnRage(action, makePlayerStats(), campaignName);

        expect(result).toBe(0);
        expect(automationService.evaluateAutoExpression).not.toHaveBeenCalled();
        expect(tempHpService.setTempHp).not.toHaveBeenCalled();
      }
    );

    // One guard line: typeof / Number.isFinite / <= 0 — a representative per clause.
    it.each([0, -5, NaN, Infinity, 'not-a-number', null])(
      'returns 0 when evaluated amount is %p',
      async (amount) => {
        const action = makeAction({ triggerOnRage: true, tempHpExpression: 'rage_temp_hp' });
        automationService.evaluateAutoExpression.mockReturnValue(amount);

        const result = await grantTempHpOnRage(action, makePlayerStats(), campaignName);

        expect(result).toBe(0);
        expect(tempHpService.setTempHp).not.toHaveBeenCalled();
      }
    );
  });

  describe('successful grant', () => {
    it('evaluates the expression, delegates the grant, and returns the evaluated amount', async () => {
      const action = makeAction({ triggerOnRage: true, tempHpExpression: 'level + 5' });
      const ps = makePlayerStats({ level: 7 });

      automationService.evaluateAutoExpression.mockReturnValue(12);
      // setTempHp owns max/replace logic and returns its own value —
      // grantTempHpOnRage must return the evaluated amount, not that.
      tempHpService.setTempHp.mockReturnValue(99);

      const result = await grantTempHpOnRage(action, ps, campaignName);

      expect(result).toBe(12);
      expect(automationService.evaluateAutoExpression).toHaveBeenCalledWith('level + 5', ps);
      expect(tempHpService.setTempHp).toHaveBeenCalledTimes(1);
      expect(tempHpService.setTempHp).toHaveBeenCalledWith('Grog', 12, campaignName);
    });
  });
});
