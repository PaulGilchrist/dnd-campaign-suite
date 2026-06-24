// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────

vi.mock('../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────────

import { handle } from './bardicInspirationDefenseHandler.js';

import * as diceRoller from '../../../dice/diceRoller.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';

// ── Helpers ────────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'Bard',
    ...overrides,
  };
}

function makeAction(overrides = {}) {
  return {
    name: 'Defensive Inspiration',
    automation: { type: 'bardic_inspiration_defense' },
    ...overrides,
  };
}

function makeRollResult(total, rolls) {
  return { total, rolls: rolls ?? [total] };
}

// ── Tests ──────────────────────────────────────────────────────────

describe('bardicInspirationDefenseHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRuntimeState.getRuntimeValue.mockReset();
    logService.addEntry.mockResolvedValue({});
  });

  // ── No bardic inspiration die ──────────────────────────────────

  describe('no bardic inspiration die', () => {
    const falsyValues = [null, undefined, 0, ''];

    for (const dieValue of falsyValues) {
      it(`returns info popup when bardicInspirationDie is ${JSON.stringify(dieValue)}`, async () => {
        useRuntimeState.getRuntimeValue.mockReturnValue(dieValue);

        const result = await handle(makeAction(), makePlayerStats(), campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toBe('You do not have a Bardic Inspiration die.');
        expect(result.payload.name).toBe('Defensive Inspiration');
      });
    }

    it('does not roll dice or modify state when there is no die', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(null);

      await handle(makeAction(), makePlayerStats(), campaignName);

      expect(diceRoller.rollExpression).not.toHaveBeenCalled();
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('respects custom action name in the popup payload', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(null);

      const result = await handle(
        { name: 'Defend with Inspiration', automation: { type: 'custom' } },
        makePlayerStats(),
        campaignName,
      );

      expect(result.payload.name).toBe('Defend with Inspiration');
    });
  });

  // ── Roll expression fails ──────────────────────────────────────

  describe('roll expression fails', () => {
    const failureValues = [null, undefined, 0];

    for (const failureValue of failureValues) {
      it(`returns error popup when rollExpression returns ${JSON.stringify(failureValue)}`, async () => {
        useRuntimeState.getRuntimeValue.mockReturnValueOnce(8).mockReturnValueOnce(undefined);
        diceRoller.rollExpression.mockReturnValue(failureValue);

        const result = await handle(makeAction(), makePlayerStats(), campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toBe('Roll failed.');
      });
    }

    it('does not modify state or log when roll fails', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8).mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(null);

      await handle(makeAction(), makePlayerStats(), campaignName);

      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(logService.addEntry).not.toHaveBeenCalled();
    });
  });

  // ── Successful invocation ──────────────────────────────────────

  describe('successful invocation', () => {
    it('clears all bardic inspiration runtime state', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8).mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(5));

      await handle(makeAction(), makePlayerStats(), campaignName);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenNthCalledWith(
        1,
        'Bard',
        'bardicInspirationDie',
        null,
        campaignName,
      );
      expect(useRuntimeState.setRuntimeValue).toHaveBeenNthCalledWith(
        2,
        'Bard',
        'bardicInspirationGrantedBy',
        null,
        campaignName,
      );
      expect(useRuntimeState.setRuntimeValue).toHaveBeenNthCalledWith(
        3,
        'Bard',
        'bardicInspirationCombatOptions',
        null,
        campaignName,
      );
    });

    it('logs an ability_use entry with correct details', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8).mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(3));

      await handle(makeAction(), makePlayerStats(), campaignName);

      const entry = logService.addEntry.mock.calls[0][1];
      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, entry);
      expect(entry.type).toBe('ability_use');
      expect(entry.characterName).toBe('Bard');
      expect(entry.abilityName).toBe('Defensive Inspiration');
      expect(entry.biDieRoll).toBe(3);
      expect(entry.biDieSize).toBe(8);
      expect(entry.timestamp).toBeTypeOf('number');
    });

    it('includes die roll info in the log description', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(6).mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(4));

      await handle(makeAction(), makePlayerStats(), campaignName);

      const logDescription = logService.addEntry.mock.calls[0][1].description;
      expect(logDescription).toContain('rolled 1d6 (4)');
    });

    it('returns popup with roll details', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8).mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(6));

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Defensive Inspiration');
      expect(result.payload.description).toContain('Bardic Inspiration (1d8)');
      expect(result.payload.description).toContain('rolled **6**');
      expect(result.payload.description).toContain('Use your Reaction to add this to your AC');
    });

    it('includes individual roll values in the description', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(10).mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(7, [2, 5]));

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.payload.description).toContain('2, 5');
    });

    it('includes grantedBy in the description when set', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8).mockReturnValueOnce('Fellow Bard');
      diceRoller.rollExpression.mockReturnValue(makeRollResult(3));

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.payload.description).toContain('Die granted by Fellow Bard');
    });

    it('uses "unknown" as grantedBy when falsy', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8).mockReturnValueOnce(null);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(5));

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.payload.description).toContain('Die granted by unknown');
    });

    it('includes action.automation in the returned payload', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8).mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(4));

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.payload.automation).toEqual({ type: 'bardic_inspiration_defense' });
    });
  });

  // ── Player name propagation ────────────────────────────────────

  describe('player name propagation', () => {
    it('uses playerStats.name for runtime state clearing', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(6).mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(2));

      await handle(makeAction(), makePlayerStats({ name: 'Valeria' }), campaignName);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenNthCalledWith(
        1,
        'Valeria',
        'bardicInspirationDie',
        null,
        campaignName,
      );
      expect(useRuntimeState.setRuntimeValue).toHaveBeenNthCalledWith(
        2,
        'Valeria',
        'bardicInspirationGrantedBy',
        null,
        campaignName,
      );
      expect(useRuntimeState.setRuntimeValue).toHaveBeenNthCalledWith(
        3,
        'Valeria',
        'bardicInspirationCombatOptions',
        null,
        campaignName,
      );
    });

    it('includes player name in log entry', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8).mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(5));

      await handle(makeAction(), makePlayerStats({ name: 'Valeria' }), campaignName);

      const entry = logService.addEntry.mock.calls[0][1];
      expect(entry.characterName).toBe('Valeria');
      expect(entry.description).toContain('Valeria used Defensive Inspiration');
    });

    it('uses custom action name in log entry', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8).mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(5));

      await handle({ name: 'Defend with Inspiration', automation: {} }, makePlayerStats(), campaignName);

      const entry = logService.addEntry.mock.calls[0][1];
      expect(entry.abilityName).toBe('Defend with Inspiration');
    });
  });

  // ── Error resilience ───────────────────────────────────────────

  describe('error resilience', () => {
    it('returns success popup even when addEntry rejects', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8).mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(5));
      const rejectionError = new Error('log service failed');
      logService.addEntry.mockImplementation(() => Promise.reject(rejectionError));

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('rolled **5**');
    });
  });
});
