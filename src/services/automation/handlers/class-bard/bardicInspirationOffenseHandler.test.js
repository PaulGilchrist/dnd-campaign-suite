// @maintained-by-ai
// Deterministic unit tests for bardicInspirationOffenseHandler.handle — the sole
// execution coverage for the 'bardic_inspiration_offense' automation (dispatched via
// src/services/automation/index.js registry; damageRollback lane). All deps are mocked:
// this pins refusal side-effect guards, die-roll reporting, full log-entry shape,
// findLastAttack attacker/target matching, and inspiration consumption (the three
// runtime-store null clears). No app churn should require rework beyond message-string
// updates.
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

vi.mock('../../common/damageRollback.js', () => ({
  findLastAttack: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────────

import { handle } from './bardicInspirationOffenseHandler.js';

import * as diceRoller from '../../../dice/diceRoller.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as damageRollback from '../../common/damageRollback.js';

// ── Helpers ────────────────────────────────────────────────────────

const campaignName = 'test-campaign';
const playerName = 'Bard';

function makeAction() {
  return {
    name: 'Offensive Inspiration',
    automation: { type: 'bardic_inspiration_offense' },
  };
}

function playerStats() {
  return { name: playerName };
}

function mockRuntime(dieSize, grantedBy) {
  useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
    if (key === 'bardicInspirationDie') return dieSize;
    if (key === 'bardicInspirationGrantedBy') return grantedBy;
    return null;
  });
}

// findLastAttack resolves null: no recent damage event, manual-add fallback path.
function mockSuccess(dieSize, grantedBy, rollResult) {
  mockRuntime(dieSize, grantedBy);
  diceRoller.rollExpression.mockReturnValue(rollResult);
  damageRollback.findLastAttack.mockResolvedValue(null);
}

// The handler only reads attackerName and targetName off the lastAttack record.
function makeLastAttack(attackerName, targetName) {
  return { attackerName, targetName };
}

// ── Tests ──────────────────────────────────────────────────────────

describe('bardicInspirationOffenseHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    logService.addEntry.mockResolvedValue(undefined);
  });

  describe('no bardic inspiration die', () => {
    it('returns info popup and performs no side effects', async () => {
      mockRuntime(null, null);

      const result = await handle(makeAction(), playerStats(), campaignName);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Offensive Inspiration',
          description: 'You do not have a Bardic Inspiration die.',
        },
      });
      expect(diceRoller.rollExpression).not.toHaveBeenCalled();
      expect(damageRollback.findLastAttack).not.toHaveBeenCalled();
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(logService.addEntry).not.toHaveBeenCalled();
    });
  });

  describe('roll expression fails', () => {
    it('returns "Roll failed." popup without consuming the die or logging', async () => {
      mockRuntime(8, 'Ally Bard');
      diceRoller.rollExpression.mockReturnValue(null);

      const result = await handle(makeAction(), playerStats(), campaignName);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Offensive Inspiration',
          description: 'Roll failed.',
        },
      });
      expect(damageRollback.findLastAttack).not.toHaveBeenCalled();
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(logService.addEntry).not.toHaveBeenCalled();
    });
  });

  describe('successful invocation (no recent damage event)', () => {
    it.each([8, 10])('rolls 1d%x, logs the exact entry, and reports the die size and manual-add fallback', async (dieSize) => {
      mockSuccess(dieSize, undefined, { total: 5, rolls: [3, 2] });

      const result = await handle(makeAction(), playerStats(), campaignName);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith(`1d${dieSize}`);
      expect(damageRollback.findLastAttack).toHaveBeenCalledWith(campaignName);
      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: 'Offensive Inspiration',
        description: `${playerName} used Offensive Inspiration: rolled 1d${dieSize} (5). No recent damage event found. Add 5 damage to your last hit manually.`,
        biDieRoll: 5,
        biDieSize: dieSize,
        timestamp: expect.any(Number),
      });

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Offensive Inspiration');
      expect(result.payload.description).toContain(`Bardic Inspiration (1d${dieSize})`);
      expect(result.payload.description).toContain('rolled **5**');
      expect(result.payload.description).toContain('3, 2');
      expect(result.payload.description).toContain("Add this to your attack's damage");
      expect(result.payload.description).toContain('No recent damage event found');
      expect(result.payload.automation).toEqual({ type: 'bardic_inspiration_offense' });
    });

    it.each([
      { grantedBy: 'Goblin', expected: 'Die granted by Goblin' },
      { grantedBy: null, expected: 'Die granted by unknown' },
    ])('describes grantor as "$expected"', async ({ grantedBy, expected }) => {
      mockSuccess(8, grantedBy, { total: 5, rolls: [5] });

      const result = await handle(makeAction(), playerStats(), campaignName);

      expect(result.payload.description).toContain(expected);
    });

    it('consumes the inspiration by clearing die, grantedBy, and combat options', async () => {
      mockSuccess(8, 'Goblin', { total: 5, rolls: [5] });

      await handle(makeAction(), playerStats(), campaignName);

      const calls = useRuntimeState.setRuntimeValue.mock.calls;
      expect(calls).toHaveLength(3);
      expect(calls[0]).toEqual([playerName, 'bardicInspirationDie', null, campaignName]);
      expect(calls[1]).toEqual([playerName, 'bardicInspirationGrantedBy', null, campaignName]);
      expect(calls[2]).toEqual([playerName, 'bardicInspirationCombatOptions', null, campaignName]);
    });
  });

  describe('recent damage event matching', () => {
    beforeEach(() => {
      mockRuntime(8, undefined);
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5] });
    });

    it('reports bonus damage applied to the target in popup and log when attacker matches', async () => {
      damageRollback.findLastAttack.mockResolvedValue(makeLastAttack(playerName, 'Goblin'));

      const result = await handle(makeAction(), playerStats(), campaignName);

      expect(result.payload.description).toContain('Bonus damage applied to Goblin');
      expect(result.payload.description).not.toContain('No recent damage event found');
      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'ability_use',
        description: `${playerName} used Offensive Inspiration: rolled 1d8 (5). Bonus damage applied to Goblin.`,
        biDieRoll: 5,
        biDieSize: 8,
      }));
    });

    it.each([
      { name: 'attacker does not match player', attack: makeLastAttack('OtherPlayer', 'Goblin') },
      { name: 'targetName is falsy', attack: makeLastAttack(playerName, null) },
    ])('falls back to no-damage message when $name', async ({ attack }) => {
      damageRollback.findLastAttack.mockResolvedValue(attack);

      const result = await handle(makeAction(), playerStats(), campaignName);

      expect(result.payload.description).toContain('No recent damage event found');
      expect(result.payload.description).not.toContain('Bonus damage applied to');
    });
  });

  describe('error resilience', () => {
    it('returns success popup even when addEntry rejects', async () => {
      mockSuccess(8, undefined, { total: 5, rolls: [5] });
      logService.addEntry.mockRejectedValue(new Error('log service failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await handle(makeAction(), playerStats(), campaignName);
      await Promise.resolve(); // flush the handler's un-logged addEntry().catch() microtask

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('rolled **5**');
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
