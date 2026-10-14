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
  addEntry: vi.fn(() => Promise.resolve()),
}));

// ── Imports ────────────────────────────────────────────────────────

import { handle } from './bardicInspirationDefenseHandler.js';

import * as diceRoller from '../../../dice/diceRoller.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import { addEntry } from '../../../ui/logService.js';

// ── Helpers ────────────────────────────────────────────────────────

const campaignName = 'TestCampaign';
const playerName = 'Bard';

function makePlayerStats(overrides = {}) {
  return {
    name: playerName,
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
    diceRoller.rollExpression.mockReset();
    logService.addEntry.mockResolvedValue({});
  });

  // ── No bardic inspiration die ──────────────────────────────────

  describe('no bardic inspiration die', () => {
    function mockNoDie() {
      useRuntimeState.getRuntimeValue.mockReturnValue(null);
    }

    it('returns info popup when bardicInspirationDie is falsy', async () => {
      mockNoDie();

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Defensive Inspiration');
      expect(result.payload.description).toBe('You do not have a Bardic Inspiration die.');
    });

    it('does not roll dice, set runtime state, or log when there is no die', async () => {
      mockNoDie();

      await handle(makeAction(), makePlayerStats(), campaignName);

      expect(diceRoller.rollExpression).not.toHaveBeenCalled();
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(logService.addEntry).not.toHaveBeenCalled();
    });
  });

  // ── Roll expression fails ──────────────────────────────────────

  describe('roll expression fails', () => {
    function mockWithDie(dieSize, grantedBy) {
      useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'bardicInspirationDie') return dieSize;
        if (key === 'bardicInspirationGrantedBy') return grantedBy;
        return null;
      });
      diceRoller.rollExpression.mockReturnValue(null);
    }

    it('returns info popup with "Roll failed." when rollExpression returns null', async () => {
      mockWithDie(8, undefined);

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Defensive Inspiration');
      expect(result.payload.description).toBe('Roll failed.');
    });

    it('does not clear runtime state or log when roll fails', async () => {
      mockWithDie(8, 'Ally Bard');

      await handle(makeAction(), makePlayerStats(), campaignName);

      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(logService.addEntry).not.toHaveBeenCalled();
    });
  });

  // ── Successful invocation ──────────────────────────────────────

  describe('successful invocation', () => {
    function mockSuccess(dieSize, grantedBy, rollResult) {
      useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'bardicInspirationDie') return dieSize;
        if (key === 'bardicInspirationGrantedBy') return grantedBy;
        return null;
      });
      diceRoller.rollExpression.mockReturnValue(rollResult);
    }

    it('rolls the correct die expression 1d{dieSize}', async () => {
      mockSuccess(8, undefined, makeRollResult(5));

      await handle(makeAction(), makePlayerStats(), campaignName);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d8');
    });

    it('logs an ability_use entry with correct details', async () => {
      mockSuccess(8, undefined, makeRollResult(3));

      await handle(makeAction(), makePlayerStats(), campaignName);

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'ability_use',
        characterName: playerName,
        abilityName: 'Defensive Inspiration',
        biDieRoll: 3,
        biDieSize: 8,
        timestamp: expect.any(Number),
      }));
    });

    it('includes description text in the log entry', async () => {
      mockSuccess(8, undefined, makeRollResult(7));

      await handle(makeAction(), makePlayerStats(), campaignName);

      const logCall = addEntry.mock.calls[0][1];
      expect(logCall.description).toContain('Defensive Inspiration');
      expect(logCall.description).toContain('1d8');
      expect(logCall.description).toContain('7');
      expect(logCall.description).toContain('Reaction');
    });

    it('returns popup with roll details in the description', async () => {
      mockSuccess(8, undefined, makeRollResult(6));

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Defensive Inspiration');
      expect(result.payload.description).toContain('Bardic Inspiration (1d8)');
      expect(result.payload.description).toContain('rolled **6**');
      expect(result.payload.description).toContain('Use your Reaction to add this to your AC');
    });

    it('includes individual roll components in the description', async () => {
      mockSuccess(8, undefined, makeRollResult(5, [3, 2]));

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.payload.description).toContain('**5**');
      expect(result.payload.description).toContain('3, 2');
    });

    it('includes grantedBy in the description when set', async () => {
      mockSuccess(8, 'Fellow Bard', makeRollResult(3));

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.payload.description).toContain('Die granted by Fellow Bard');
    });

    it('falls back to "unknown" when grantedBy is null or undefined', async () => {
      mockSuccess(8, null, makeRollResult(4));

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.payload.description).toContain('Die granted by unknown');
    });

    it('includes action.automation in the returned payload', async () => {
      mockSuccess(8, undefined, makeRollResult(4));

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.payload.automation).toEqual({ type: 'bardic_inspiration_defense' });
    });

    it('clears all three runtime keys in the correct order', async () => {
      mockSuccess(6, 'Party Bard', makeRollResult(2));

      await handle(makeAction(), makePlayerStats(), campaignName);

      const calls = useRuntimeState.setRuntimeValue.mock.calls;
      expect(calls).toHaveLength(3);
      expect(calls[0][1]).toBe('bardicInspirationDie');
      expect(calls[1][1]).toBe('bardicInspirationGrantedBy');
      expect(calls[2][1]).toBe('bardicInspirationCombatOptions');
    });

    it('works with different die sizes', async () => {
      mockSuccess(10, undefined, makeRollResult(7));

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d10');
      expect(result.payload.description).toContain('1d10');
      expect(result.payload.description).toContain('**7**');
    });
  });

  // ── Error resilience ───────────────────────────────────────────

  describe('error resilience', () => {
    function mockSuccess(dieSize, grantedBy, rollResult) {
      useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'bardicInspirationDie') return dieSize;
        if (key === 'bardicInspirationGrantedBy') return grantedBy;
        return null;
      });
      diceRoller.rollExpression.mockReturnValue(rollResult);
    }

    it('returns success popup even when addEntry rejects', async () => {
      mockSuccess(8, undefined, makeRollResult(5));
      logService.addEntry.mockImplementation(() => Promise.reject(new Error('log service failed')));

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('rolled **5**');
    });

    it('still clears runtime state when addEntry rejects', async () => {
      mockSuccess(8, undefined, makeRollResult(5));
      logService.addEntry.mockImplementation(() => Promise.reject(new Error('log service failed')));

      await handle(makeAction(), makePlayerStats(), campaignName);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        playerName,
        'bardicInspirationDie',
        null,
        campaignName,
      );
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        playerName,
        'bardicInspirationGrantedBy',
        null,
        campaignName,
      );
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        playerName,
        'bardicInspirationCombatOptions',
        null,
        campaignName,
      );
    });
  });
});
