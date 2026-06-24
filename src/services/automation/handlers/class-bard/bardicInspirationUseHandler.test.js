// @improved-by-ai
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
    const falsyValues = [null, undefined, 0, '', false];

    it.each(falsyValues)('should return info popup when bardicInspirationDie is %p', async (dieSize) => {
      const ps = makePlayerStats();
      const action = makeAction();

      runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'bardicInspirationDie') return dieSize;
        return null;
      });

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

    it('should use the player name from playerStats when checking runtime value', async () => {
      const ps = makePlayerStats({ name: 'DifferentPlayer' });
      const action = makeAction();

      runtimeState.getRuntimeValue.mockReturnValue(null);

      await handle(action, ps, campaignName);

      expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith('DifferentPlayer', 'bardicInspirationDie', campaignName);
    });
  });

  describe('roll failure', () => {
    const failureValues = [null, undefined];

    it.each(failureValues)('should return info popup when rollExpression returns %p', async (rollResult) => {
      const ps = makePlayerStats();
      const action = makeAction();
      const dieSize = 8;

      runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'bardicInspirationDie') return dieSize;
        return null;
      });
      diceRoller.rollExpression.mockReturnValue(rollResult);

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

    it('should construct the correct dice expression from the die size', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const dieSize = 12;

      runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'bardicInspirationDie') return dieSize;
        return null;
      });
      diceRoller.rollExpression.mockReturnValue(null);

      await handle(action, ps, campaignName);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d12');
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

      expect(runtimeState.setRuntimeValue).toHaveBeenNthCalledWith(
        1,
        playerName,
        'bardicInspirationDie',
        null,
        campaignName,
      );
      expect(runtimeState.setRuntimeValue).toHaveBeenNthCalledWith(
        2,
        playerName,
        'bardicInspirationGrantedBy',
        null,
        campaignName,
      );
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledTimes(2);

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
        if (key === 'bardicInspirationGrantedBy') return null;
        return null;
      });
      diceRoller.rollExpression.mockReturnValue(rollResult);

      const result = await handle(action, ps, campaignName);

      expect(result.payload.description).toContain('Die granted by unknown');
    });

    it('should use "unknown" when granter is an empty string', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const dieSize = 6;
      const rollResult = { total: 3, rolls: [3] };

      runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'bardicInspirationDie') return dieSize;
        if (key === 'bardicInspirationGrantedBy') return '';
        return null;
      });
      diceRoller.rollExpression.mockReturnValue(rollResult);

      const result = await handle(action, ps, campaignName);

      expect(result.payload.description).toContain('Die granted by unknown');
    });

    it('should pass the action name through to the payload', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ name: 'Custom Action Name' });
      const dieSize = 6;
      const rollResult = { total: 4, rolls: [4] };

      runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'bardicInspirationDie') return dieSize;
        return null;
      });
      diceRoller.rollExpression.mockReturnValue(rollResult);

      const result = await handle(action, ps, campaignName);

      expect(result.payload.name).toBe('Custom Action Name');
    });

    it('should pass the automation object through to the payload', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ automation: { type: 'bardic_inspiration_use', extra: true } });
      const dieSize = 6;
      const rollResult = { total: 4, rolls: [4] };

      runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'bardicInspirationDie') return dieSize;
        return null;
      });
      diceRoller.rollExpression.mockReturnValue(rollResult);

      const result = await handle(action, ps, campaignName);

      expect(result.payload.automation).toEqual({ type: 'bardic_inspiration_use', extra: true });
    });

    it('should handle an empty rolls array from rollExpression', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const dieSize = 6;
      const rollResult = { total: 0, rolls: [] };

      runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'bardicInspirationDie') return dieSize;
        return null;
      });
      diceRoller.rollExpression.mockReturnValue(rollResult);

      const result = await handle(action, ps, campaignName);

      expect(result.payload.description).toContain('rolled **0** ()');
    });

    it('should use different die sizes in the expression and description', async () => {
      const ps = makePlayerStats();
      const action = makeAction();
      const dieSize = 20;
      const rollResult = { total: 15, rolls: [15] };

      runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'bardicInspirationDie') return dieSize;
        return null;
      });
      diceRoller.rollExpression.mockReturnValue(rollResult);

      const result = await handle(action, ps, campaignName);

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d20');
      expect(result.payload.description).toContain('Bardic Inspiration (1d20)');
    });
  });
});
