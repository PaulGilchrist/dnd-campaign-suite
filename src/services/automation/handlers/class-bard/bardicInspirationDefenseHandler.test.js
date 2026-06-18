import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports (hoisted by vitest) ─────────────────────

vi.mock('../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockImplementation(() => Promise.resolve()),
}));

// ── Imports (Vite returns mocked versions) ───────────────────────

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

function makeRollResult(total, rolls = [total]) {
  return { total, rolls };
}

// ── Tests ───────────────────────────────────────────────────────────

describe('bardicInspirationDefenseHandler.handle', () => {
  function resetMocks() {
    diceRoller.rollExpression.mockClear();
    useRuntimeState.getRuntimeValue.mockClear();
    useRuntimeState.setRuntimeValue.mockClear();
    logService.addEntry.mockClear();
   }

  beforeEach(() => {
    resetMocks();
  });

  // ── Early exit: no die ───────────────────────────────────────────

  describe('no bardic inspiration die', () => {
    it('returns popup when bardicInspirationDie is null', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValue(null);

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe('You do not have a Bardic Inspiration die.');
    });

    it('returns popup when bardicInspirationDie is undefined', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValue(undefined);

      const result = await handle(action, ps, campaignName);

      expect(result.payload.description).toBe('You do not have a Bardic Inspiration die.');
    });

    it('returns popup when bardicInspirationDie is 0', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValue(0);

      const result = await handle(action, ps, campaignName);

      expect(result.payload.description).toBe('You do not have a Bardic Inspiration die.');
    });

    it('does not call rollExpression when there is no die', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValue(null);

      await handle(action, ps, campaignName);

      expect(diceRoller.rollExpression).not.toHaveBeenCalled();
    });

    it('does not call setRuntimeValue or addEntry when there is no die', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValue(null);

      await handle(action, ps, campaignName);

      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('includes correct payload structure on no-die early exit', async () => {
      const ps = makePlayerStats({});
      const action = { name: 'My Ability', automation: { type: 'custom' } };
      useRuntimeState.getRuntimeValue.mockReturnValue(null);

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('My Ability');
    });
  });

  // ── Early exit: roll fails ───────────────────────────────────────

  describe('roll expression fails', () => {
    it('returns popup when rollExpression returns falsy value', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValue(8);
      diceRoller.rollExpression.mockReturnValue(null);

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('Roll failed.');
    });

    it('does not call setRuntimeValue or addEntry when roll fails', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValue(8);
      diceRoller.rollExpression.mockReturnValue(null);

      await handle(action, ps, campaignName);

      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(logService.addEntry).not.toHaveBeenCalled();
    });
  });

  // ── Success flow ─────────────────────────────────────────────────

  describe('successful invocation', () => {
    it('rolls correct die expression', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(6); // bardicInspirationDie
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined); // bardicInspirationGrantedBy
      diceRoller.rollExpression.mockReturnValue(makeRollResult(4, [4]));

      await handle(action, ps, campaignName);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d6');
    });

    it('rolls correct die expression for d12', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(12);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(7, [7]));

      await handle(action, ps, campaignName);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d12');
    });

    it('clears bardic inspiration runtime state on success', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(5, [5]));

      await handle(action, ps, campaignName);

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

    it('logs the ability use entry on success', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(3, [3]));

      await handle(action, ps, campaignName);

      expect(logService.addEntry).toHaveBeenCalled();
      const callArgs = logService.addEntry.mock.calls[0];
      expect(callArgs[0]).toBe(campaignName);
      expect(callArgs[1].type).toBe('ability_use');
      expect(callArgs[1].characterName).toBe('Bard');
      expect(callArgs[1].abilityName).toBe('Defensive Inspiration');
      expect(callArgs[1].biDieRoll).toBe(3);
      expect(callArgs[1].biDieSize).toBe(8);
    });

    it('log entry description contains roll total', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(6);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(4, [4]));

      await handle(action, ps, campaignName);

      const logDescription = logService.addEntry.mock.calls[0][1].description;
      expect(logDescription).toContain('rolled 1d6 (4)');
    });

    it('returns popup with roll details on success', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(6, [6]));

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Bardic Inspiration (1d8)');
      expect(result.payload.description).toContain('rolled **6**');
    });

    it('includes roll values in success description', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(10);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(7, [2, 5]));

      const result = await handle(action, ps, campaignName);

      expect(result.payload.description).toContain('2, 5');
    });

    it('includes grantedBy in success description', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce('Fellow Bard');
      diceRoller.rollExpression.mockReturnValue(makeRollResult(3, [3]));

      const result = await handle(action, ps, campaignName);

      expect(result.payload.description).toContain('Die granted by Fellow Bard');
    });

    it('uses "unknown" as grantedBy when not set', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(null);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(5, [5]));

      const result = await handle(action, ps, campaignName);

      expect(result.payload.description).toContain('Die granted by unknown');
    });

    it('includes action.automation in returned payload', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(4, [4]));

      const result = await handle(action, ps, campaignName);

      expect(result.payload.automation).toEqual(action.automation);
    });
  });

  // ── Edge cases ───────────────────────────────────────────────────

  describe('edge cases', () => {
    it('uses playerStats.name for runtime calls', async () => {
      const ps = makePlayerStats({ name: 'Valeria' });
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(6);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(2, [2]));

      await handle(action, ps, campaignName);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Valeria',
        'bardicInspirationDie',
        null,
        campaignName,
      );
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Valeria',
        'bardicInspirationGrantedBy',
        null,
        campaignName,
      );
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Valeria',
        'bardicInspirationCombatOptions',
        null,
        campaignName,
      );
    });

    it('includes player name in action.name popup payload', async () => {
      const ps = makePlayerStats({});
      const action = { name: 'Defend with Inspiration', automation: {} };
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(1, [1]));

      const result = await handle(action, ps, campaignName);

      expect(result.payload.name).toBe('Defend with Inspiration');
    });

    it('does not propagate addEntry rejection', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(5, [5]));
      logService.addEntry.mockImplementation(() => Promise.reject(new Error('log service failed')).catch(() => {}));

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      // Should still return success popup despite addEntry failure
      expect(result.payload.description).toContain('rolled **5**');
    });

    it('calls getRuntimeValue with correct key for bardicInspirationDie', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(3, [3]));

      await handle(action, ps, campaignName);

      expect(useRuntimeState.getRuntimeValue).toHaveBeenNthCalledWith(
        1,
        'Bard',
        'bardicInspirationDie',
        campaignName,
      );
    });

    it('calls getRuntimeValue with correct key for bardicInspirationGrantedBy', async () => {
      const ps = makePlayerStats({});
      const action = makeAction({});
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(8);
      useRuntimeState.getRuntimeValue.mockReturnValueOnce(undefined);
      diceRoller.rollExpression.mockReturnValue(makeRollResult(3, [3]));

      await handle(action, ps, campaignName);

      expect(useRuntimeState.getRuntimeValue).toHaveBeenNthCalledWith(
        2,
        'Bard',
        'bardicInspirationGrantedBy',
        campaignName,
      );
    });
  });
});
