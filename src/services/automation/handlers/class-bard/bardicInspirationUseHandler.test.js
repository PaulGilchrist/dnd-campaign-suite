import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './bardicInspirationUseHandler.js';
import * as diceRoller from '../../../dice/diceRoller.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';
const playerName = 'TestHero';

function makePlayerStats(overrides = {}) {
  return {
    name: playerName,
    ...overrides,
  };
}

function makeAction(overrides = {}) {
  return {
    name: 'Use Bardic Inspiration',
    automation: {
      type: 'bardic_inspiration_use',
      ...overrides.automation,
    },
    ...overrides,
  };
}

function mockNoDie() {
  runtimeState.getRuntimeValue.mockReturnValue(null);
}

function mockWithDie(dieSize, grantedBy) {
  runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
    if (key === 'bardicInspirationDie') return dieSize;
    if (key === 'bardicInspirationGrantedBy') return grantedBy;
    return null;
  });
}

// ── Tests ──────────────────────────────────────────────────────

describe('bardicInspirationUseHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeState.getRuntimeValue.mockReset();
    diceRoller.rollExpression.mockReset();
  });

  // ── No bardic inspiration die ────────────────────────────────

  describe('no bardic inspiration die', () => {
    it('returns info popup when no die is available', async () => {
      mockNoDie();
      const action = makeAction();

      const result = await handle(action, makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe(action.name);
      expect(result.payload.description).toBe('You do not have a Bardic Inspiration die.');
    });

    it('does not roll dice or set runtime state when there is no die', async () => {
      mockNoDie();

      await handle(makeAction(), makePlayerStats(), campaignName);

      expect(diceRoller.rollExpression).not.toHaveBeenCalled();
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  // ── Roll expression fails ────────────────────────────────────

  describe('roll expression fails', () => {
    it('returns info popup when rollExpression returns null', async () => {
      mockWithDie(8, null);
      diceRoller.rollExpression.mockReturnValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Use Bardic Inspiration');
      expect(result.payload.description).toBe('Roll failed.');
    });

    it('does not clear runtime state when roll fails', async () => {
      mockWithDie(8, 'Ally Bard');
      diceRoller.rollExpression.mockReturnValue(null);

      await handle(makeAction(), makePlayerStats(), campaignName);

      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  // ── Successful roll ──────────────────────────────────────────

  describe('successful roll', () => {
    function mockSuccess(dieSize, grantedBy, rollResult) {
      mockWithDie(dieSize, grantedBy);
      diceRoller.rollExpression.mockReturnValue(rollResult);
    }

    it('reads both bardicInspirationDie and bardicInspirationGrantedBy from runtime state', async () => {
      mockSuccess(8, 'Bard NPC', { total: 5, rolls: [5] });

      await handle(makeAction(), makePlayerStats(), campaignName);

      expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith(
        playerName,
        'bardicInspirationDie',
        campaignName,
      );
      expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith(
        playerName,
        'bardicInspirationGrantedBy',
        campaignName,
      );
    });

    it('clears both runtime state values after a successful roll', async () => {
      mockSuccess(8, 'Bard NPC', { total: 5, rolls: [5] });

      await handle(makeAction(), makePlayerStats(), campaignName);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        playerName,
        'bardicInspirationDie',
        null,
        campaignName,
      );
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        playerName,
        'bardicInspirationGrantedBy',
        null,
        campaignName,
      );
    });

    it('includes action.automation in the returned payload', async () => {
      mockSuccess(8, null, { total: 5, rolls: [5] });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.payload.automation).toEqual({ type: 'bardic_inspiration_use' });
    });

    it('returns a description with roll details and grantedBy', async () => {
      mockSuccess(8, 'Bard College Member', { total: 5, rolls: [3, 2] });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.payload.description).toContain('1d8');
      expect(result.payload.description).toContain('**5**');
      expect(result.payload.description).toContain('3, 2');
      expect(result.payload.description).toContain('Add this to an ability check');
      expect(result.payload.description).toContain('Die granted by Bard College Member');
    });

    it('falls back to "unknown" when grantedBy is null or undefined', async () => {
      mockSuccess(8, null, { total: 4, rolls: [4] });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.payload.description).toContain('Die granted by unknown');
    });

    it('works with different die sizes (d6, d10, d12)', async () => {
      const dice = [
        { size: 6, total: 3 },
        { size: 10, total: 7 },
        { size: 12, total: 10 },
      ];

      for (const { size, total } of dice) {
        vi.clearAllMocks();
        mockSuccess(size, null, { total, rolls: [total] });

        const result = await handle(makeAction(), makePlayerStats(), campaignName);

        expect(diceRoller.rollExpression).toHaveBeenCalledWith(`1d${size}`);
        expect(result.payload.description).toContain(`1d${size}`);
        expect(result.payload.description).toContain(`**${total}**`);
      }
    });
  });
});
