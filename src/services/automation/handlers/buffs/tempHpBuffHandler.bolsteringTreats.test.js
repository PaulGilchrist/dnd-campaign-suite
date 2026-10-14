import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
  evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn().mockResolvedValue(true),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle, craftBolsteringTreats } from './tempHpBuffHandler.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as automationService from '../../../combat/automation/automationService.js';
import * as rangeCheck from '../../../rules/combat/rangeCheck.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'Chef',
    proficiency: 2,
    level: 5,
    ...overrides,
  };
}

function makeBolsteringAction(automationOverrides = {}) {
  return {
    name: 'Bolstering Treats',
    automation: {
      type: 'temp_hp_buff',
      craftCount: 'proficiency_bonus',
      tempHpExpression: 'proficiency_bonus',
      action: 'bonus_action',
      ...automationOverrides,
    },
  };
}

function resetMocks() {
  vi.clearAllMocks();
  useRuntimeState.getRuntimeValue.mockReturnValue(null);
  rangeCheck.isWithinRange.mockResolvedValue(true);
}

// ── Tests ──────────────────────────────────────────────────────

describe('handle — Bolstering Treats', () => {
  beforeEach(resetMocks);

  describe('dispatch logic', () => {
    it('delegates to bolstering treats path when craftCount and tempHpExpression are present', async () => {
      const action = makeBolsteringAction();
      const ps = makePlayerStats({ proficiency: 2 });
      useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'chefBolsteringTreats') return 2;
        return null;
      });
      automationService.evaluateAutoExpression.mockReturnValue(2);

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Bolstering Treats');
      expect(result.payload.automationType).toBe('temp_hp_buff');
      expect(result.payload.description).toContain('Ate a bolstering treat');
    });

    it('falls through to generic temp HP path when craftCount is absent', async () => {
      const action = {
        name: 'Second Wind',
        automation: {
          type: 'temp_hp_buff',
          tempHpExpression: '5',
        },
      };
      const ps = makePlayerStats();
      automationService.evaluateAutoExpression.mockReturnValue(5);

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Gained 5 temporary hit points');
    });
  });

  describe('no treats remaining', () => {
    it.each([0, -1])('returns error popup when treat count is %s', async (treatCount) => {
      const action = makeBolsteringAction();
      const ps = makePlayerStats({ proficiency: 2 });
      useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'chefBolsteringTreats') return treatCount;
        return null;
      });

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Bolstering Treats');
      expect(result.payload.automationType).toBe('temp_hp_buff');
      expect(result.payload.description).toContain('No treats remaining');
      expect(result.payload.description).toContain('Craft more with 1 hour of work or after a Long Rest');
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('successful treat consumption', () => {
    it('consumes a treat and grants temp HP with correct description', async () => {
      const action = makeBolsteringAction();
      const ps = makePlayerStats({ proficiency: 2 });
      useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'chefBolsteringTreats') return 2;
        return null;
      });
      automationService.evaluateAutoExpression.mockReturnValue(2);

      const result = await handle(action, ps, campaignName);

      expect(result.payload.description).toContain('Ate a bolstering treat');
      expect(result.payload.description).toContain('2 temporary hit points');
      expect(result.payload.description).toContain('1 treat remaining');
    });

    it('uses evaluated expression when tempHpExpression is not proficiency_bonus', async () => {
      const action = makeBolsteringAction({ tempHpExpression: 'level + 5' });
      const ps = makePlayerStats({ level: 5, proficiency: 2 });
      useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'chefBolsteringTreats') return 3;
        return null;
      });
      automationService.evaluateAutoExpression.mockReturnValue(10);

      const result = await handle(action, ps, campaignName);

      expect(result.payload.description).toContain('10 temporary hit points');
      expect(result.payload.description).toContain('2 treats remaining');
    });

    it('preserves existing temp HP when it is higher than the new amount', async () => {
      const action = makeBolsteringAction();
      const ps = makePlayerStats({ proficiency: 2 });
      useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'chefBolsteringTreats') return 2;
        if (key === 'tempHp') return 5;
        return null;
      });
      automationService.evaluateAutoExpression.mockReturnValue(2);

      const result = await handle(action, ps, campaignName);

      expect(result.payload.description).toContain('2 temporary hit points');
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Chef', 'tempHp', 5, campaignName,
      );
    });

    it('overwrites existing temp HP when new amount is higher', async () => {
      const action = makeBolsteringAction();
      const ps = makePlayerStats({ proficiency: 3 });
      useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'chefBolsteringTreats') return 3;
        if (key === 'tempHp') return 1;
        return null;
      });
      automationService.evaluateAutoExpression.mockReturnValue(3);

      const result = await handle(action, ps, campaignName);

      expect(result.payload.description).toContain('3 temporary hit points');
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Chef', 'tempHp', 3, campaignName,
      );
    });

    it('decrements treat count in the runtime store', async () => {
      const action = makeBolsteringAction();
      const ps = makePlayerStats({ proficiency: 2 });
      useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'chefBolsteringTreats') return 2;
        return null;
      });
      automationService.evaluateAutoExpression.mockReturnValue(2);

      await handle(action, ps, campaignName);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Chef', 'chefBolsteringTreats', 1, campaignName,
      );
    });

    it('pluralizes treat/treats correctly based on remaining count', async () => {
      // 2 before consumption => 1 remaining => singular "treat"
      const action1 = makeBolsteringAction();
      const ps1 = makePlayerStats({ proficiency: 2 });
      useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'chefBolsteringTreats') return 2;
        return null;
      });
      automationService.evaluateAutoExpression.mockReturnValue(2);

      let result = await handle(action1, ps1, campaignName);
      expect(result.payload.description).toContain('1 treat remaining');
      expect(result.payload.description).not.toContain('1 treats remaining');

      // 3 before consumption => 2 remaining => plural "treats"
      resetMocks();
      const action2 = makeBolsteringAction();
      const ps2 = makePlayerStats({ proficiency: 3 });
      useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'chefBolsteringTreats') return 3;
        return null;
      });
      automationService.evaluateAutoExpression.mockReturnValue(3);

      result = await handle(action2, ps2, campaignName);
      expect(result.payload.description).toContain('2 treats remaining');
    });

    it('uses craftCount expression when it is not proficiency_bonus', async () => {
      const action = makeBolsteringAction({ craftCount: 'level + 1' });
      const ps = makePlayerStats({ level: 5, proficiency: 2 });
      useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'chefBolsteringTreats') return 6;
        return null;
      });
      automationService.evaluateAutoExpression.mockReturnValue(6);

      const result = await handle(action, ps, campaignName);

      expect(result.payload.description).toContain('5 treats remaining');
    });
  });

  describe('temp HP evaluation errors', () => {
    it.each([
      ['not-a-number', 'invalid_expr'],
      [0, '0'],
      [-5, '-1'],
      [undefined, 'undefined_expr'],
    ])('returns error popup when temp HP evaluates to %p (expression: %s)', async (mockReturn, expression) => {
      const action = makeBolsteringAction({ tempHpExpression: expression });
      const ps = makePlayerStats({ proficiency: 2 });
      useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'chefBolsteringTreats') return 2;
        return null;
      });
      automationService.evaluateAutoExpression.mockReturnValue(mockReturn);

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('Could not calculate temp HP');
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('returns error when temp HP evaluates to a string that is not a number', async () => {
      const action = makeBolsteringAction({ tempHpExpression: '1d6' });
      const ps = makePlayerStats({ proficiency: 2 });
      useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'chefBolsteringTreats') return 2;
        return null;
      });
      automationService.evaluateAutoExpression.mockReturnValue('1d6');

      const result = await handle(action, ps, campaignName);

      expect(result.payload.description).toContain('Could not calculate temp HP');
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('proficiency_bonus as tempHpExpression with missing proficiency', () => {
    it('uses 0 when proficiency is undefined', async () => {
      const action = makeBolsteringAction();
      const ps = makePlayerStats({ proficiency: undefined });
      useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'chefBolsteringTreats') return 1;
        return null;
      });

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Could not calculate temp HP');
    });

    it('uses 0 when proficiency is null', async () => {
      const action = makeBolsteringAction();
      const ps = makePlayerStats({ proficiency: null });
      useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'chefBolsteringTreats') return 1;
        return null;
      });

      const result = await handle(action, ps, campaignName);

      expect(result.payload.description).toContain('Could not calculate temp HP');
    });
  });

  describe('treat count fallback to craftCount', () => {
    it('uses craftCount as initial treat count when runtime value is null', async () => {
      const action = makeBolsteringAction();
      const ps = makePlayerStats({ proficiency: 3 });
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      automationService.evaluateAutoExpression.mockReturnValue(3);

      const result = await handle(action, ps, campaignName);

      expect(result.payload.description).toContain('2 treats remaining');
    });
  });
});

describe('craftBolsteringTreats', () => {
  beforeEach(resetMocks);

  it('sets chefBolsteringTreats to proficiency value using player name', () => {
    const ps = makePlayerStats({ proficiency: 2, name: 'Chef' });

    craftBolsteringTreats(ps, campaignName);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Chef', 'chefBolsteringTreats', 2, campaignName,
    );
  });

  it('sets treat count to 0 when proficiency is 0 or undefined', () => {
    // proficiency 0
    let ps = makePlayerStats({ proficiency: 0, name: 'NoProf' });
    craftBolsteringTreats(ps, campaignName);
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'NoProf', 'chefBolsteringTreats', 0, campaignName,
    );

    // proficiency undefined
    ps = makePlayerStats({ proficiency: undefined, name: 'NoProf' });
    craftBolsteringTreats(ps, campaignName);
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'NoProf', 'chefBolsteringTreats', 0, campaignName,
    );
  });

  it('uses player name from playerStats for the runtime key', () => {
    const ps = makePlayerStats({ name: 'CustomName', proficiency: 4 });

    craftBolsteringTreats(ps, campaignName);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'CustomName', 'chefBolsteringTreats', 4, campaignName,
    );
  });
});
