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

import { handle, craftBolsteringTreats } from './tempHpBuffHandler.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as automationService from '../../../combat/automation/automationService.js';
import { campaignName, makePlayerStats, makeAction, resetMocks } from './tempHpBuffTestHelpers.js';

// ────────────────────────────────────────────────────────────────
// handleBolsteringTreats — detects craftCount path
// ────────────────────────────────────────────────────────────────

describe('handle — Bolstering Treats detection', () => {
  beforeEach(() => resetMocks());

  it('delegates to Bolstering Treats when craftCount is present', async () => {
    const action = {
      name: 'Bolstering Treats',
      automation: {
        type: 'temp_hp_buff',
        craftCount: 'proficiency_bonus',
        tempHpExpression: 'proficiency_bonus',
        action: 'bonus_action',
      },
    };
    const ps = makePlayerStats({ proficiency: 2 });
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'chefBolsteringTreats') return 2;
      return null;
    });

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Ate a bolstering treat');
  });

  it('does NOT delegate when craftCount is absent', async () => {
    const action = makeAction({ tempHpExpression: '5' });
    const ps = makePlayerStats();
    automationService.evaluateAutoExpression.mockReturnValue(5);

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Gained 5 temporary hit points');
  });
});

// ────────────────────────────────────────────────────────────────
// handleBolsteringTreats — no treats remaining
// ────────────────────────────────────────────────────────────────

describe('handleBolsteringTreats — no treats remaining', () => {
  beforeEach(() => resetMocks());

  it('returns popup when treat count is 0', async () => {
    const action = {
      name: 'Bolstering Treats',
      automation: {
        type: 'temp_hp_buff',
        craftCount: 'proficiency_bonus',
        tempHpExpression: 'proficiency_bonus',
      },
    };
    const ps = makePlayerStats({ proficiency: 2 });
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'chefBolsteringTreats') return 0;
      return null;
    });

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('No treats remaining');
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('returns popup when treat count is negative', async () => {
    const action = {
      name: 'Bolstering Treats',
      automation: {
        type: 'temp_hp_buff',
        craftCount: 'proficiency_bonus',
        tempHpExpression: 'proficiency_bonus',
      },
    };
    const ps = makePlayerStats({ proficiency: 2 });
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'chefBolsteringTreats') return -1;
      return null;
    });

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('No treats remaining');
  });
});

// ────────────────────────────────────────────────────────────────
// handleBolsteringTreats — successful treat consumption
// ────────────────────────────────────────────────────────────────

describe('handleBolsteringTreats — successful consumption', () => {
  beforeEach(() => resetMocks());

  it('decrements treat count and sets temp HP', async () => {
    const action = {
      name: 'Bolstering Treats',
      automation: {
        type: 'temp_hp_buff',
        craftCount: 'proficiency_bonus',
        tempHpExpression: 'proficiency_bonus',
      },
    };
    const ps = makePlayerStats({ proficiency: 2 });
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'chefBolsteringTreats') return 2;
      return null;
    });

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('2 temporary hit points');
    expect(result.payload.description).toContain('1 treat');
    const setCalls = useRuntimeState.setRuntimeValue.mock.calls;
    const treatCall = setCalls.find(c => c[1] === 'chefBolsteringTreats');
    expect(treatCall).toBeDefined();
    expect(treatCall[2]).toBe(1);
    const tempHpCall = setCalls.find(c => c[1] === 'tempHp');
    expect(tempHpCall).toBeDefined();
    expect(tempHpCall[2]).toBe(2);
  });

  it('uses proficiency_bonus for temp HP when tempHpExpression is "proficiency_bonus"', async () => {
    const action = {
      name: 'Bolstering Treats',
      automation: {
        type: 'temp_hp_buff',
        craftCount: 'proficiency_bonus',
        tempHpExpression: 'proficiency_bonus',
      },
    };
    const ps = makePlayerStats({ proficiency: 3 });
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'chefBolsteringTreats') return 3;
      return null;
    });

    const result = await handle(action, ps, campaignName);

    expect(result.payload.description).toContain('3 temporary hit points');
  });

  it('uses evaluated expression when tempHpExpression is not "proficiency_bonus"', async () => {
    const action = {
      name: 'Bolstering Treats',
      automation: {
        type: 'temp_hp_buff',
        craftCount: 'proficiency_bonus',
        tempHpExpression: 'level + 5',
      },
    };
    const ps = makePlayerStats({ level: 5, proficiency: 2 });
    useRuntimeState.getRuntimeValue.mockReturnValue(2);
    automationService.evaluateAutoExpression.mockReturnValue(10);

    const result = await handle(action, ps, campaignName);

    expect(result.payload.description).toContain('10 temporary hit points');
  });

  it('pluralizes "treats" correctly', async () => {
    const action = {
      name: 'Bolstering Treats',
      automation: {
        type: 'temp_hp_buff',
        craftCount: 'proficiency_bonus',
        tempHpExpression: 'proficiency_bonus',
      },
    };
    const ps = makePlayerStats({ proficiency: 3 });
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'chefBolsteringTreats') return 3;
      return null;
    });

    const result = await handle(action, ps, campaignName);

    expect(result.payload.description).toContain('2 treats remaining');
  });

  it('returns popup when temp HP evaluates to non-number', async () => {
    const action = {
      name: 'Bolstering Treats',
      automation: {
        type: 'temp_hp_buff',
        craftCount: 'proficiency_bonus',
        tempHpExpression: 'invalid_expr',
      },
    };
    const ps = makePlayerStats({ proficiency: 2 });
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'chefBolsteringTreats') return 2;
      return null;
    });
    automationService.evaluateAutoExpression.mockReturnValue('not-a-number');

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Could not calculate temp HP');
  });

  it('returns popup when temp HP evaluates to 0', async () => {
    const action = {
      name: 'Bolstering Treats',
      automation: {
        type: 'temp_hp_buff',
        craftCount: 'proficiency_bonus',
        tempHpExpression: '0',
      },
    };
    const ps = makePlayerStats({ proficiency: 2 });
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'chefBolsteringTreats') return 2;
      return null;
    });
    automationService.evaluateAutoExpression.mockReturnValue(0);

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Could not calculate temp HP');
  });
});

// ────────────────────────────────────────────────────────────────
// craftBolsteringTreats — exported function
// ────────────────────────────────────────────────────────────────

describe('craftBolsteringTreats', () => {
  beforeEach(() => resetMocks());

  it('sets chefBolsteringTreats to proficiency_bonus', () => {
    const ps = makePlayerStats({ proficiency: 2, name: 'Chef' });

    craftBolsteringTreats(ps, campaignName);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Chef', 'chefBolsteringTreats', 2, campaignName,
    );
  });

  it('uses proficiency from playerStats', () => {
    const ps = makePlayerStats({ proficiency: 6, name: 'TestChar' });

    craftBolsteringTreats(ps, campaignName);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestChar', 'chefBolsteringTreats', 6, campaignName,
    );
  });
});
