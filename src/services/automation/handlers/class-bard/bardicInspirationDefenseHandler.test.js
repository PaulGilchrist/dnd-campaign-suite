// @maintained-by-ai
// Deterministic unit tests for bardicInspirationDefenseHandler.handle — the sole
// execution coverage for the 'bardic_inspiration_defense' automation (dispatched via
// src/services/automation/index.js registry). All deps are mocked; no app churn
// should require rework beyond message-string updates.
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

// ── Helpers ────────────────────────────────────────────────────────

const campaignName = 'TestCampaign';
const playerName = 'Bard';

function makeAction(overrides = {}) {
  return {
    name: 'Defensive Inspiration',
    automation: { type: 'bardic_inspiration_defense' },
    ...overrides,
  };
}

function mockRuntime(dieSize, grantedBy) {
  useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
    if (key === 'bardicInspirationDie') return dieSize;
    if (key === 'bardicInspirationGrantedBy') return grantedBy;
    return null;
  });
}

function mockSuccess(dieSize, grantedBy, rollResult) {
  mockRuntime(dieSize, grantedBy);
  diceRoller.rollExpression.mockReturnValue(rollResult);
}

const DEFAULT_ROLL = { total: 5, rolls: [5] };

// ── Tests ──────────────────────────────────────────────────────────

describe('bardicInspirationDefenseHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    logService.addEntry.mockResolvedValue({});
  });

  describe('no bardic inspiration die', () => {
    it('returns info popup and performs no side effects', async () => {
      mockRuntime(null, null);

      const result = await handle(makeAction(), { name: playerName }, campaignName);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Defensive Inspiration',
          description: 'You do not have a Bardic Inspiration die.',
        },
      });
      expect(diceRoller.rollExpression).not.toHaveBeenCalled();
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(logService.addEntry).not.toHaveBeenCalled();
    });
  });

  describe('roll expression fails', () => {
    it('returns "Roll failed." popup without clearing runtime state or logging', async () => {
      mockRuntime(8, 'Ally Bard');
      diceRoller.rollExpression.mockReturnValue(null);

      const result = await handle(makeAction(), { name: playerName }, campaignName);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Defensive Inspiration',
          description: 'Roll failed.',
        },
      });
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(logService.addEntry).not.toHaveBeenCalled();
    });
  });

  describe('successful invocation', () => {
    it.each([8, 10])('rolls 1d%x and reports that die size everywhere', async (dieSize) => {
      mockSuccess(dieSize, undefined, DEFAULT_ROLL);

      const result = await handle(makeAction(), { name: playerName }, campaignName);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith(`1d${dieSize}`);
      expect(result.payload.description).toContain(`1d${dieSize}`);
      expect(result.payload.description).toContain(`**${DEFAULT_ROLL.total}**`);
      const logCall = logService.addEntry.mock.calls[0][1];
      expect(logCall.description).toContain(`1d${dieSize}`);
    });

    it('consumes the inspiration by clearing die, grantedBy, and combat options', async () => {
      mockSuccess(6, 'Party Bard', { total: 2, rolls: [2] });

      await handle(makeAction(), { name: playerName }, campaignName);

      const calls = useRuntimeState.setRuntimeValue.mock.calls;
      expect(calls).toHaveLength(3);
      expect(calls[0]).toEqual([playerName, 'bardicInspirationDie', null, campaignName]);
      expect(calls[1]).toEqual([playerName, 'bardicInspirationGrantedBy', null, campaignName]);
      expect(calls[2]).toEqual([playerName, 'bardicInspirationCombatOptions', null, campaignName]);
    });

    it('logs an ability_use entry with roll details and reaction description', async () => {
      mockSuccess(8, undefined, { total: 3, rolls: [3] });

      await handle(makeAction(), { name: playerName }, campaignName);

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'ability_use',
        characterName: playerName,
        abilityName: 'Defensive Inspiration',
        description: expect.stringContaining('Reaction'),
        biDieRoll: 3,
        biDieSize: 8,
        timestamp: expect.any(Number),
      }));
    });

    it('returns popup with roll components, AC reaction instruction, and automation passthrough', async () => {
      mockSuccess(8, undefined, { total: 5, rolls: [3, 2] });

      const result = await handle(makeAction(), { name: playerName }, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Defensive Inspiration');
      expect(result.payload.description).toContain('Bardic Inspiration (1d8)');
      expect(result.payload.description).toContain('rolled **5**');
      expect(result.payload.description).toContain('3, 2');
      expect(result.payload.description).toContain('Use your Reaction to add this to your AC');
      expect(result.payload.automation).toEqual({ type: 'bardic_inspiration_defense' });
    });

    it.each([
      { grantedBy: 'Fellow Bard', expected: 'Die granted by Fellow Bard' },
      { grantedBy: null, expected: 'Die granted by unknown' },
      { grantedBy: undefined, expected: 'Die granted by unknown' },
    ])('describes grantor as "$expected"', ({ grantedBy, expected }) => {
      mockSuccess(8, grantedBy, DEFAULT_ROLL);

      return handle(makeAction(), { name: playerName }, campaignName).then((result) => {
        expect(result.payload.description).toContain(expected);
      });
    });
  });

  describe('error resilience', () => {
    it('returns success popup even when addEntry rejects', async () => {
      mockSuccess(8, undefined, DEFAULT_ROLL);
      logService.addEntry.mockImplementation(() => Promise.reject(new Error('log service failed')));

      const result = await handle(makeAction(), { name: playerName }, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('rolled **5**');
    });
  });
});
