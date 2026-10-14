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

function makePlayerStats(overrides = {}) {
  return {
    name: playerName,
    ...overrides,
  };
}

function makeAction(overrides = {}) {
  return {
    name: 'Offensive Inspiration',
    automation: { type: 'bardic_inspiration_offense' },
    ...overrides,
  };
}

function makeLastAttack(attackerName, targetName, timestamp) {
  return {
    attackEvent: { timestamp: timestamp || Date.now(), targetName },
    attackerName: attackerName || null,
    targetName: targetName || null,
    primaryDamage: 0,
    secondaryDamage: 0,
    totalDamage: 0,
    damageTypes: [],
  };
}

// ── Tests ──────────────────────────────────────────────────────────

describe('bardicInspirationOffenseHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRuntimeState.getRuntimeValue.mockReset();
    diceRoller.rollExpression.mockReset();
    damageRollback.findLastAttack.mockReset();
  });

  // ── No bardic inspiration die ──────────────────────────────────

  describe('no bardic inspiration die', () => {
    it('returns info popup when bardicInspirationDie is null', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Offensive Inspiration');
      expect(result.payload.description).toBe('You do not have a Bardic Inspiration die.');
    });
  });

  // ── Roll expression fails ──────────────────────────────────────

  describe('roll expression fails', () => {
    it('returns info popup with "Roll failed." when rollExpression returns null', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'bardicInspirationDie') return 8;
        if (key === 'bardicInspirationGrantedBy') return undefined;
        return null;
      });
      diceRoller.rollExpression.mockReturnValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Offensive Inspiration');
      expect(result.payload.description).toBe('Roll failed.');
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
      damageRollback.findLastAttack.mockResolvedValue(null);
    }

    it('logs ability_use with die size, roll total, and no-damage message', async () => {
      mockSuccess(8, undefined, { total: 5, rolls: [5] });

      await handle(makeAction(), makePlayerStats(), campaignName);

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: 'Offensive Inspiration',
        description: expect.stringContaining('1d8'),
        biDieRoll: 5,
        biDieSize: 8,
        timestamp: expect.any(Number),
      });
    });

    it('returns popup with roll details and manual instruction', async () => {
      mockSuccess(8, undefined, { total: 5, rolls: [5] });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Offensive Inspiration');
      expect(result.payload.description).toContain('1d8');
      expect(result.payload.description).toContain('**5**');
      expect(result.payload.description).toContain("Add this to your attack's damage");
      expect(result.payload.description).toContain('No recent damage event found');
      expect(result.payload.automation).toEqual({ type: 'bardic_inspiration_offense' });
    });

    it('includes individual roll components in popup description', async () => {
      mockSuccess(8, undefined, { total: 5, rolls: [3, 2] });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.payload.description).toContain('**5**');
      expect(result.payload.description).toContain('3, 2');
    });

    it('includes grantedBy in popup description when set', async () => {
      mockSuccess(8, 'Goblin', { total: 5, rolls: [5] });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.payload.description).toContain('Die granted by Goblin');
    });

    it('falls back to "unknown" when grantedBy is null or undefined', async () => {
      mockSuccess(8, null, { total: 4, rolls: [4] });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.payload.description).toContain('Die granted by unknown');
    });

    it('works with different die sizes', async () => {
      mockSuccess(10, undefined, { total: 7, rolls: [7] });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.payload.description).toContain('1d10');
      expect(result.payload.description).toContain('**7**');
    });
  });

  // ── Damage application to matching attacker ────────────────────

  describe('damage application to matching attacker', () => {
    function mockWithMatchingAttack(dieSize, grantedBy, lastAttack) {
      useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'bardicInspirationDie') return dieSize;
        if (key === 'bardicInspirationGrantedBy') return grantedBy;
        return null;
      });
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5] });
      damageRollback.findLastAttack.mockResolvedValue(lastAttack);
    }

    it('returns popup with bonus damage message when attacker matches player', async () => {
      mockWithMatchingAttack(8, undefined, makeLastAttack(playerName, 'Goblin', Date.now()));

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.payload.description).toContain('Bonus damage applied to Goblin');
      expect(result.payload.description).not.toContain('No recent damage event found');
    });

    it('logs ability_use with bonus damage message when attacker matches', async () => {
      mockWithMatchingAttack(8, undefined, makeLastAttack(playerName, 'Goblin', Date.now()));

      await handle(makeAction(), makePlayerStats(), campaignName);

      const logCall = logService.addEntry.mock.calls[0][1];
      expect(logCall.description).toContain('Bonus damage applied to Goblin');
      expect(logCall.biDieRoll).toBe(5);
      expect(logCall.biDieSize).toBe(8);
    });

    it('falls back to no-damage message when lastAttack exists but targetName is falsy', async () => {
      mockWithMatchingAttack(8, undefined, makeLastAttack(playerName, null, Date.now()));

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.payload.description).toContain('No recent damage event found');
      expect(result.payload.description).not.toContain('Bonus damage applied to');
    });

    it('falls back to no-damage message when attacker does not match player', async () => {
      mockWithMatchingAttack(8, undefined, makeLastAttack('OtherPlayer', 'Goblin', Date.now()));

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.payload.description).toContain('No recent damage event found');
      expect(result.payload.description).not.toContain('Bonus damage applied to');
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
      damageRollback.findLastAttack.mockResolvedValue(null);
    }

    it('returns success popup even when addEntry rejects', async () => {
      mockSuccess(8, undefined, { total: 5, rolls: [5] });
      logService.addEntry.mockImplementation(() => Promise.reject(new Error('log service failed')));

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('rolled **5**');
    });
  });
});
