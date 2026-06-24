// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
  evaluateAutoExpression: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle, craftBolsteringTreats } from './tempHpBuffHandler.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as automationService from '../../../combat/automation/automationService.js';

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

// ── Tests ──────────────────────────────────────────────────────

describe('handle — Bolstering Treats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRuntimeState.getRuntimeValue.mockReturnValue(null);
  });

  describe('dispatch logic', () => {
    it('should delegate to bolstering treats path when craftCount and tempHpExpression are present', async () => {
      const action = makeBolsteringAction();
      const ps = makePlayerStats({ proficiency: 2 });
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'chefBolsteringTreats') return 2;
        return null;
      });
      automationService.evaluateAutoExpression.mockReturnValue(2);

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Ate a bolstering treat');
    });

    it('should fall through to generic temp HP path when craftCount is absent', async () => {
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

    it('should fall through to generic temp HP path when tempHpExpression is absent', async () => {
      const action = {
        name: 'Bolstering Treats',
        automation: {
          type: 'temp_hp_buff',
          craftCount: 'proficiency_bonus',
        },
      };
      const ps = makePlayerStats();

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No temp HP expression defined');
    });
  });

  describe('no treats remaining', () => {
    it('should return error popup when treat count is 0', async () => {
      const action = makeBolsteringAction();
      const ps = makePlayerStats({ proficiency: 2 });
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'chefBolsteringTreats') return 0;
        return null;
      });

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Bolstering Treats');
      expect(result.payload.automationType).toBe('temp_hp_buff');
      expect(result.payload.description).toContain('No treats remaining');
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('should return error popup when treat count is negative', async () => {
      const action = makeBolsteringAction();
      const ps = makePlayerStats({ proficiency: 2 });
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'chefBolsteringTreats') return -1;
        return null;
      });

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No treats remaining');
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('should use craftCount as fallback when runtime value is undefined', async () => {
      const action = makeBolsteringAction({ craftCount: 'proficiency_bonus' });
      const ps = makePlayerStats({ proficiency: 3 });
      useRuntimeState.getRuntimeValue.mockReturnValue(undefined);
      automationService.evaluateAutoExpression.mockReturnValue(3);

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Ate a bolstering treat');
      expect(result.payload.description).toContain('3 temporary hit points');
      expect(result.payload.description).toContain('2 treats remaining');
    });
  });

  describe('successful treat consumption', () => {
    it('should decrement treat count after consuming one', async () => {
      const action = makeBolsteringAction();
      const ps = makePlayerStats({ proficiency: 2 });
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'chefBolsteringTreats') return 2;
        return null;
      });
      automationService.evaluateAutoExpression.mockReturnValue(2);

      await handle(action, ps, campaignName);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Chef', 'chefBolsteringTreats', 1, campaignName,
      );
    });

    it('should set temp HP to the proficiency_bonus value when tempHpExpression is proficiency_bonus', async () => {
      const action = makeBolsteringAction();
      const ps = makePlayerStats({ proficiency: 4 });
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'chefBolsteringTreats') return 4;
        return null;
      });

      await handle(action, ps, campaignName);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Chef', 'tempHp', 4, campaignName,
      );
    });

    it('should set temp HP using evaluated expression when tempHpExpression is not proficiency_bonus', async () => {
      const action = makeBolsteringAction({ tempHpExpression: 'level + 5' });
      const ps = makePlayerStats({ level: 5, proficiency: 2 });
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'chefBolsteringTreats') return 3;
        return null;
      });
      automationService.evaluateAutoExpression.mockReturnValue(10);

      await handle(action, ps, campaignName);

      expect(automationService.evaluateAutoExpression).toHaveBeenCalledWith('level + 5', ps);
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Chef', 'tempHp', 10, campaignName,
      );
    });

    it('should preserve existing temp HP when it is higher than the new amount', async () => {
      const action = makeBolsteringAction();
      const ps = makePlayerStats({ proficiency: 2 });
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'chefBolsteringTreats') return 2;
        if (key === 'tempHp') return 5;
        return null;
      });
      automationService.evaluateAutoExpression.mockReturnValue(2);

      await handle(action, ps, campaignName);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Chef', 'tempHp', 5, campaignName,
      );
    });

    it('should overwrite existing temp HP when new amount is higher', async () => {
      const action = makeBolsteringAction();
      const ps = makePlayerStats({ proficiency: 3 });
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'chefBolsteringTreats') return 3;
        if (key === 'tempHp') return 1;
        return null;
      });
      automationService.evaluateAutoExpression.mockReturnValue(3);

      await handle(action, ps, campaignName);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Chef', 'tempHp', 3, campaignName,
      );
    });

    it('should pluralize "treat" correctly for 1 remaining before consumption', async () => {
      const action = makeBolsteringAction();
      const ps = makePlayerStats({ proficiency: 2 });
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'chefBolsteringTreats') return 2;
        return null;
      });
      automationService.evaluateAutoExpression.mockReturnValue(2);

      const result = await handle(action, ps, campaignName);

      expect(result.payload.description).toContain('1 treat remaining');
      expect(result.payload.description).not.toContain('1 treats remaining');
    });

    it('should pluralize "treats" correctly for more than 1 remaining', async () => {
      const action = makeBolsteringAction();
      const ps = makePlayerStats({ proficiency: 3 });
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'chefBolsteringTreats') return 3;
        return null;
      });
      automationService.evaluateAutoExpression.mockReturnValue(3);

      const result = await handle(action, ps, campaignName);

      expect(result.payload.description).toContain('2 treats remaining');
    });
  });

  describe('error handling', () => {
    it('should return error popup when temp HP evaluates to non-number', async () => {
      const action = makeBolsteringAction({ tempHpExpression: 'invalid_expr' });
      const ps = makePlayerStats({ proficiency: 2 });
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'chefBolsteringTreats') return 2;
        return null;
      });
      automationService.evaluateAutoExpression.mockReturnValue('not-a-number');

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('Could not calculate temp HP');
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('should return error popup when temp HP evaluates to 0', async () => {
      const action = makeBolsteringAction({ tempHpExpression: '0' });
      const ps = makePlayerStats({ proficiency: 2 });
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'chefBolsteringTreats') return 2;
        return null;
      });
      automationService.evaluateAutoExpression.mockReturnValue(0);

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Could not calculate temp HP');
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('should return error popup when temp HP evaluates to negative', async () => {
      const action = makeBolsteringAction({ tempHpExpression: '-1' });
      const ps = makePlayerStats({ proficiency: 2 });
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'chefBolsteringTreats') return 2;
        return null;
      });
      automationService.evaluateAutoExpression.mockReturnValue(-5);

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Could not calculate temp HP');
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('should return error popup when temp HP evaluates to undefined', async () => {
      const action = makeBolsteringAction({ tempHpExpression: 'undefined_expr' });
      const ps = makePlayerStats({ proficiency: 2 });
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'chefBolsteringTreats') return 2;
        return null;
      });
      automationService.evaluateAutoExpression.mockReturnValue(undefined);

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Could not calculate temp HP');
    });
  });

  describe('return payload structure', () => {
    it('should return popup type with automation_info payload', async () => {
      const action = makeBolsteringAction();
      const ps = makePlayerStats({ proficiency: 2 });
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'chefBolsteringTreats') return 2;
        return null;
      });
      automationService.evaluateAutoExpression.mockReturnValue(2);

      const result = await handle(action, ps, campaignName);

      expect(result).toMatchObject({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Bolstering Treats',
          automationType: 'temp_hp_buff',
        },
      });
    });

    it('should include the automation object in the payload', async () => {
      const autoConfig = {
        type: 'temp_hp_buff',
        craftCount: 'proficiency_bonus',
        tempHpExpression: 'proficiency_bonus',
        action: 'bonus_action',
      };
      const action = makeBolsteringAction(autoConfig);
      const ps = makePlayerStats({ proficiency: 2 });
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'chefBolsteringTreats') return 2;
        return null;
      });
      automationService.evaluateAutoExpression.mockReturnValue(2);

      const result = await handle(action, ps, campaignName);

      expect(result.payload.automation).toEqual(autoConfig);
    });

    it('should include the action name in the payload', async () => {
      const action = makeBolsteringAction();
      action.name = 'Custom Treats';
      const ps = makePlayerStats({ proficiency: 2 });
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'chefBolsteringTreats') return 2;
        return null;
      });
      automationService.evaluateAutoExpression.mockReturnValue(2);

      const result = await handle(action, ps, campaignName);

      expect(result.payload.name).toBe('Custom Treats');
    });
  });
});

describe('craftBolsteringTreats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should set chefBolsteringTreats to proficiency_bonus value', () => {
    const ps = makePlayerStats({ proficiency: 2, name: 'Chef' });

    craftBolsteringTreats(ps, campaignName);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Chef', 'chefBolsteringTreats', 2, campaignName,
    );
  });

  it('should use the proficiency from playerStats', () => {
    const ps = makePlayerStats({ proficiency: 6, name: 'TestChar' });

    craftBolsteringTreats(ps, campaignName);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestChar', 'chefBolsteringTreats', 6, campaignName,
    );
  });

  it('should set treat count to 0 when proficiency is 0', () => {
    const ps = makePlayerStats({ proficiency: 0, name: 'NoProf' });

    craftBolsteringTreats(ps, campaignName);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'NoProf', 'chefBolsteringTreats', 0, campaignName,
    );
  });

  it('should set treat count to 0 when proficiency is undefined', () => {
    const ps = makePlayerStats({ proficiency: undefined, name: 'NoProf' });

    craftBolsteringTreats(ps, campaignName);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'NoProf', 'chefBolsteringTreats', 0, campaignName,
    );
  });

  it('should use player name from playerStats', () => {
    const ps = makePlayerStats({ name: 'UniqueName' });

    craftBolsteringTreats(ps, campaignName);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'UniqueName', 'chefBolsteringTreats', 2, campaignName,
    );
  });
});
