// @cleaned-by-ai
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
    it('returns info popup when bardicInspirationDie is falsy', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe('You do not have a Bardic Inspiration die.');
      expect(result.payload.name).toBe('Defensive Inspiration');
      expect(diceRoller.rollExpression).not.toHaveBeenCalled();
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(logService.addEntry).not.toHaveBeenCalled();
    });
  });

  // ── Roll expression fails ──────────────────────────────────────

  describe('roll expression fails', () => {
    it('returns error popup when rollExpression returns null', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8).mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe('Roll failed.');
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(logService.addEntry).not.toHaveBeenCalled();
    });
  });

  // ── Successful invocation ──────────────────────────────────────

  describe('successful invocation', () => {
    it('clears bardic inspiration runtime state', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8).mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(5));

      await handle(makeAction(), makePlayerStats(), campaignName);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Bard',
        'bardicInspirationDie',
        null,
        campaignName,
      );
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Bard',
        'bardicInspirationGrantedBy',
        null,
        campaignName,
      );
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
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

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'ability_use',
        characterName: 'Bard',
        abilityName: 'Defensive Inspiration',
        biDieRoll: 3,
        biDieSize: 8,
        timestamp: expect.any(Number),
      }));
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

    it('includes grantedBy in the description when set or falls back to unknown', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8).mockReturnValueOnce('Fellow Bard');
      diceRoller.rollExpression.mockReturnValue(makeRollResult(3));

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.payload.description).toContain('Die granted by Fellow Bard');
    });

    it('includes action.automation in the returned payload', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8).mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(4));

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.payload.automation).toEqual({ type: 'bardic_inspiration_defense' });
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
