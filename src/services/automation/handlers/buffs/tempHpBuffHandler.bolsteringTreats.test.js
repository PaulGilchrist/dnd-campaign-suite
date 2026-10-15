// @maintained-by-ai
// Deterministic contract tests for the Bolstering Treats lane of tempHpBuffHandler
// (handleBolsteringTreats + craftBolsteringTreats). Runtime store and expression
// evaluation are mocked; tempHpService is intentionally REAL so the replace-if-larger
// temp HP contract is exercised here (no other suite covers it). No dice, no combat
// context, no timers — stable when the app changes.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
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
const TREATS_KEY = 'chefBolsteringTreats';

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

function mockTreatStore(treatCount, tempHp = null) {
  useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
    if (key === TREATS_KEY) return treatCount;
    if (key === 'tempHp') return tempHp;
    return null;
  });
}

function resetMocks() {
  vi.clearAllMocks();
  useRuntimeState.getRuntimeValue.mockReturnValue(null);
}

// ── Tests ──────────────────────────────────────────────────────

describe('handle — Bolstering Treats', () => {
  beforeEach(resetMocks);

  describe('dispatch', () => {
    it('routes to the treats lane when craftCount and tempHpExpression are present: consumes, writes store, returns popup', async () => {
      const action = makeBolsteringAction();
      const ps = makePlayerStats({ proficiency: 2 });
      mockTreatStore(2);

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Bolstering Treats');
      expect(result.payload.automationType).toBe('temp_hp_buff');
      // Exact match pins the full description, including singular "1 treat remaining".
      expect(result.payload.description).toBe(
        'Bolstering Treats: Ate a bolstering treat, gaining 2 temporary hit points. (1 treat remaining).',
      );
      // Treat decrement and temp HP write (via REAL setTempHp replace-if-larger).
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Chef', TREATS_KEY, 1, campaignName,
      );
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Chef', 'tempHp', 2, campaignName,
      );
    });

    it('does not enter the treats lane when craftCount is absent (generic lane lives in handle.test.js)', async () => {
      const action = {
        name: 'Second Wind',
        automation: { type: 'temp_hp_buff', tempHpExpression: '5' },
      };
      const ps = makePlayerStats();
      automationService.evaluateAutoExpression.mockReturnValue(5);

      const result = await handle(action, ps, campaignName);

      expect(result.payload.description).not.toContain('bolstering treat');
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith(
        'Chef', TREATS_KEY, expect.anything(), campaignName,
      );
    });
  });

  describe('no treats remaining', () => {
    it.each([0, -1])('returns error popup when treat count is %s, with zero store writes', async (treatCount) => {
      const action = makeBolsteringAction();
      const ps = makePlayerStats({ proficiency: 2 });
      mockTreatStore(treatCount);

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

  describe('temp HP amounts', () => {
    it('evaluates tempHpExpression when it is not proficiency_bonus', async () => {
      const action = makeBolsteringAction({ tempHpExpression: 'level + 5' });
      const ps = makePlayerStats({ level: 5, proficiency: 2 });
      mockTreatStore(3);
      automationService.evaluateAutoExpression.mockReturnValue(10);

      const result = await handle(action, ps, campaignName);

      expect(automationService.evaluateAutoExpression).toHaveBeenCalledWith('level + 5', ps);
      expect(result.payload.description).toBe(
        'Bolstering Treats: Ate a bolstering treat, gaining 10 temporary hit points. (2 treats remaining).',
      );
    });

    it('keeps existing temp HP when it is higher than the new amount (replace-if-larger)', async () => {
      const action = makeBolsteringAction();
      const ps = makePlayerStats({ proficiency: 2 });
      mockTreatStore(2, 5);

      const result = await handle(action, ps, campaignName);

      expect(result.payload.description).toContain('2 temporary hit points');
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Chef', 'tempHp', 5, campaignName,
      );
    });

    it('overwrites existing temp HP when the new amount is higher', async () => {
      const action = makeBolsteringAction();
      const ps = makePlayerStats({ proficiency: 3 });
      mockTreatStore(3, 1);

      const result = await handle(action, ps, campaignName);

      expect(result.payload.description).toContain('3 temporary hit points');
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Chef', 'tempHp', 3, campaignName,
      );
    });
  });

  describe('treat count from craftCount when the runtime store is unset', () => {
    it('seeds from proficiency_bonus craftCount', async () => {
      const action = makeBolsteringAction();
      const ps = makePlayerStats({ proficiency: 3 });
      useRuntimeState.getRuntimeValue.mockReturnValue(null);

      const result = await handle(action, ps, campaignName);

      expect(result.payload.description).toContain('(2 treats remaining)');
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Chef', TREATS_KEY, 2, campaignName,
      );
    });

    it('evaluates a non-proficiency craftCount expression', async () => {
      const action = makeBolsteringAction({ craftCount: 'level + 1' });
      const ps = makePlayerStats({ level: 5, proficiency: 2 });
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
      automationService.evaluateAutoExpression.mockReturnValue(6);

      const result = await handle(action, ps, campaignName);

      expect(automationService.evaluateAutoExpression).toHaveBeenCalledWith('level + 1', ps);
      expect(result.payload.description).toContain('(5 treats remaining)');
    });
  });

  describe('temp HP evaluation errors', () => {
    it.each([
      ['not-a-number', 'invalid_expr'],
      [0, '0'],
      [-5, '-1'],
      [undefined, 'undefined_expr'],
    ])('returns error popup when evaluateAutoExpression returns %p (expression: %s)', async (mockReturn, expression) => {
      const action = makeBolsteringAction({ tempHpExpression: expression });
      const ps = makePlayerStats({ proficiency: 2 });
      mockTreatStore(2);
      automationService.evaluateAutoExpression.mockReturnValue(mockReturn);

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe('Bolstering Treats: Could not calculate temp HP.');
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it.each([undefined, null])(
      'uses 0 for proficiency_bonus expression when proficiency is %s (never evaluates)',
      async (proficiency) => {
        const action = makeBolsteringAction();
        const ps = makePlayerStats({ proficiency });
        mockTreatStore(1);

        const result = await handle(action, ps, campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Could not calculate temp HP');
        expect(automationService.evaluateAutoExpression).not.toHaveBeenCalled();
        expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      },
    );
  });
});

describe('craftBolsteringTreats', () => {
  beforeEach(resetMocks);

  it.each([
    ['Chef', 2, 2],
    ['CustomName', 4, 4],
    ['NoProf', 0, 0],
    ['NoProf', undefined, 0],
  ])('stores proficiency count for %s (proficiency %s → %s treats)', (name, proficiency, expected) => {
    const ps = makePlayerStats({ name, proficiency });

    craftBolsteringTreats(ps, campaignName);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      name, TREATS_KEY, expected, campaignName,
    );
  });
});
