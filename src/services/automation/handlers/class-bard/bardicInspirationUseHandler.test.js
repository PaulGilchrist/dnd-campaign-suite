// @cleaned-by-ai

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

// ── Tests ──────────────────────────────────────────────────────

describe('bardicInspirationUseHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('no bardic inspiration die', () => {
    it('should return info popup when die is falsy', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      runtimeState.getRuntimeValue.mockReturnValue(null);

      const result = await handle(action, ps, campaignName);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: action.name,
          description: 'You do not have a Bardic Inspiration die.',
        },
      });
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('roll failure', () => {
    it('should return info popup when rollExpression returns falsy', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const dieSize = 8;

      runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'bardicInspirationDie') return dieSize;
        return null;
      });
      diceRoller.rollExpression.mockReturnValue(null);

      const result = await handle(action, ps, campaignName);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: action.name,
          description: 'Roll failed.',
        },
      });
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('successful roll', () => {
    it('should consume the bardic inspiration die and return the roll result', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const dieSize = 8;
      const rollResult = { total: 5, rolls: [5] };
      const granter = 'Bard College Member';

      runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'bardicInspirationDie') return dieSize;
        if (key === 'bardicInspirationGrantedBy') return granter;
        return null;
      });
      diceRoller.rollExpression.mockReturnValue(rollResult);

      const result = await handle(action, ps, campaignName);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(playerName, 'bardicInspirationDie', null, campaignName);
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(playerName, 'bardicInspirationGrantedBy', null, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe(action.name);
      expect(result.payload.automation).toEqual(action.automation);
      expect(result.payload.description).toBe(
        `Bardic Inspiration (1d${dieSize}): rolled **${rollResult.total}** (${rollResult.rolls.join(', ')}). Add this to an ability check. Die granted by ${granter}.`,
      );
    });

    it('should use "unknown" when no granter is specified', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const dieSize = 10;
      const rollResult = { total: 7, rolls: [7] };

      runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'bardicInspirationDie') return dieSize;
        return null;
      });
      diceRoller.rollExpression.mockReturnValue(rollResult);

      const result = await handle(action, ps, campaignName);

      expect(result.payload.description).toContain('Die granted by unknown');
    });
  });
});
