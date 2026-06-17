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

import { handle } from './tempHpBuffHandler.js';
import * as automationService from '../../../combat/automation/automationService.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import { campaignName, makePlayerStats, makeAction, resetMocks } from './tempHpBuffTestHelpers.js';

// ────────────────────────────────────────────────────────────────
// handle() — No tempHpExpression path
// ────────────────────────────────────────────────────────────────

describe('handle — no tempHpExpression', () => {
  beforeEach(() => resetMocks());

  it('returns popup when tempHpExpression is empty string', async () => {
    const action = makeAction({});
    const ps = makePlayerStats();

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.description).toBe('Second Wind: No temp HP expression defined.');
    expect(result.payload.name).toBe('Second Wind');
    expect(result.payload.automationType).toBe('temp_hp_buff');
  });

  it('returns popup when automation.tempHpExpression is undefined', async () => {
    const action = makeAction({ tempHpExpression: undefined });
    const ps = makePlayerStats();

    delete action.automation.tempHpExpression;

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('No temp HP expression defined');
  });

  it('does not call evaluateAutoExpression when tempHpExpression is empty', async () => {
    const action = makeAction({});
    const ps = makePlayerStats();

    await handle(action, ps, campaignName);

    expect(automationService.evaluateAutoExpression).not.toHaveBeenCalled();
  });
});

// ────────────────────────────────────────────────────────────────
// handle() — Invalid / zero / negative evaluation
// ────────────────────────────────────────────────────────────────

describe('handle — invalid evaluation result', () => {
  beforeEach(() => resetMocks());

  it('returns popup when evaluateAutoExpression returns a string', async () => {
    const action = makeAction({ tempHpExpression: 'INVALID_EXPR' });
    const ps = makePlayerStats();
    automationService.evaluateAutoExpression.mockReturnValue('INVALID_EXPR');

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Could not calculate temp HP');
  });

  it('returns popup when evaluateAutoExpression returns 0', async () => {
    const action = makeAction({ tempHpExpression: '0' });
    const ps = makePlayerStats();
    automationService.evaluateAutoExpression.mockReturnValue(0);

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Could not calculate temp HP');
  });

  it('returns popup when evaluateAutoExpression returns a negative number', async () => {
    const action = makeAction({ tempHpExpression: '-3' });
    const ps = makePlayerStats();
    automationService.evaluateAutoExpression.mockReturnValue(-3);

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Could not calculate temp HP');
  });

  it('returns popup when evaluateAutoExpression returns null', async () => {
    const action = makeAction({ tempHpExpression: 'maybe_something' });
    const ps = makePlayerStats();
    automationService.evaluateAutoExpression.mockReturnValue(null);

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Could not calculate temp HP');
  });
});

// ────────────────────────────────────────────────────────────────
// handle() — Successful temp HP setting (non-Mantle path)
// ────────────────────────────────────────────────────────────────

describe('handle — successful temp HP', () => {
  beforeEach(() => resetMocks());

  it('sets tempHp runtime value and returns popup with success description', async () => {
    const action = makeAction({ tempHpExpression: 'level + 5' });
    const ps = makePlayerStats();
    automationService.evaluateAutoExpression.mockReturnValue(8);

    const result = await handle(action, ps, campaignName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('Gained 8 temporary hit points from Second Wind.');
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Grog', 'tempHp', 8, campaignName,
    );
  });

  it('includes ongoing healing text when ongoingHealingExpression is set', async () => {
    const action = makeAction({
      tempHpExpression: 'level + 5',
      ongoingHealingExpression: '1d4',
    });
    const ps = makePlayerStats();
    automationService.evaluateAutoExpression.mockReturnValue(8);

    const result = await handle(action, ps, campaignName);

    expect(result.payload.description).toBe(
      'Gained 8 temporary hit points from Second Wind. At the start of each turn while raging, can grant temp HP to a creature within 10 ft.',
    );
  });

  it('uses custom healingRange in description', async () => {
    const action = makeAction({
      tempHpExpression: 'level + 5',
      ongoingHealingExpression: '1d4',
      healingRange: '30 ft',
    });
    const ps = makePlayerStats();
    automationService.evaluateAutoExpression.mockReturnValue(8);

    const result = await handle(action, ps, campaignName);

    expect(result.payload.description).toContain('within 30 ft');
  });

  it('payload contains correct structure', async () => {
    const action = makeAction({ tempHpExpression: 'level + 5' });
    const ps = makePlayerStats();
    automationService.evaluateAutoExpression.mockReturnValue(8);

    const result = await handle(action, ps, campaignName);

    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.name).toBe('Second Wind');
    expect(result.payload.automationType).toBe('temp_hp_buff');
    expect(result.payload.automation).toBe(action.automation);
  });

  it('calls setRuntimeValue with player name from playerStats', async () => {
    const action = makeAction({ tempHpExpression: '10' });
    const ps = makePlayerStats({ name: 'Faldorn' });
    automationService.evaluateAutoExpression.mockReturnValue(10);

    await handle(action, ps, campaignName);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Faldorn', 'tempHp', 10, campaignName,
    );
  });
});
