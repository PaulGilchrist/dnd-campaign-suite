import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

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

function makeAction() {
  return {
    name: 'Use Bardic Inspiration',
    automation: {
      type: 'bardic_inspiration_use',
    },
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('bardicInspirationUseHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return an info popup if the player has no Bardic Inspiration die', async () => {
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
  });

  it('should return an info popup if the roll fails', async () => {
    const ps = makePlayerStats();
    const action = makeAction();

    runtimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'bardicInspirationDie') return 8;
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
  });

  it('should successfully consume Bardic Inspiration and return the roll result', async () => {
    const ps = makePlayerStats();
    const action = makeAction();
    const dieSize = 8;
    const rollResult = { total: 5, rolls: [5] };
    const granter = 'Bard College Member';

    runtimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'bardicInspirationDie') return dieSize;
      if (key === 'bardicInspirationGrantedBy') return granter;
      return null;
    });
    diceRoller.rollExpression.mockReturnValue(rollResult);

    const result = await handle(action, ps, campaignName);

    // Verify state was cleared
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(playerName, 'bardicInspirationDie', null, campaignName);
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(playerName, 'bardicInspirationGrantedBy', null, campaignName);

    // Verify result payload
    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain(`Bardic Inspiration (1d${dieSize})`);
    expect(result.payload.description).toContain(`rolled **${rollResult.total}** (${rollResult.rolls.join(', ')})`);
    expect(result.payload.description).toContain(`Die granted by ${granter}`);
    expect(result.payload.automation).toEqual(action.automation);
  });

  it('should use "unknown" if no granter is specified', async () => {
    const ps = makePlayerStats();
    const action = makeAction();
    const dieSize = 10;
    const rollResult = { total: 7, rolls: [7] };

    runtimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'bardicInspirationDie') return dieSize;
      if (key === 'bardicInspirationGrantedBy') return null; // No granter
      return null;
    });
    diceRoller.rollExpression.mockReturnValue(rollResult);

    const result = await handle(action, ps, campaignName);

    expect(result.payload.description).toContain('Die granted by unknown');
  });
});
