import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../hooks/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../ui/utils.js', () => ({
  default: {
    getName: vi.fn(),
  },
}));

vi.mock('../ui/storage.js', () => ({
  default: {
    set: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(),
  getActiveCreatureName: vi.fn(),
  getCombatSummary: vi.fn(),
}));

import { addExpiration } from './expirations.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/useRuntimeState.js';
import utils from '../ui/utils.js';
import { getCurrentCombatRound } from '../encounters/combatData.js';

const KEY = 'pendingExpirations';

function resetMocks() {
  vi.clearAllMocks();
  localStorage.clear();
  window.dispatchEvent = vi.fn();
}

function stubUtilsNameIdentity() {
  utils.getName.mockImplementation((v) => v);
}

describe('addExpiration', () => {
  beforeEach(() => {
    resetMocks();
    stubUtilsNameIdentity();
    getCurrentCombatRound.mockReturnValue(1);
  });

  it('adds a new expiration entry when no existing list', () => {
    getRuntimeValue.mockReturnValueOnce(null);

    addExpiration('Goblin', 'Human', [{ type: 'stunned' }], 'MyCampaign');

    expect(getRuntimeValue).toHaveBeenCalledWith('Goblin', KEY);
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Goblin',
      KEY,
      [{ target: 'Human', effects: [{ type: 'stunned' }], appliedRound: 1, expiryRounds: 1 }],
      'MyCampaign'
    );
  });

  it('adds to existing list of expirations', () => {
    const existingList = [
      { target: 'Orc', effects: [{ type: 'advantage_on_target' }], appliedRound: 0 },
    ];
    getRuntimeValue.mockReturnValueOnce(existingList);

    addExpiration('Goblin', 'Human', [{ type: 'stunned' }], 'MyCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Goblin',
      KEY,
      [
        ...existingList,
        { target: 'Human', effects: [{ type: 'stunned' }], appliedRound: 1, expiryRounds: 1 },
      ],
      'MyCampaign'
    );
  });

  it('preserves the original list reference for spread (does not mutate)', () => {
    const existingList = [
      { target: 'Orc', effects: [], appliedRound: 0 },
    ];
    getRuntimeValue.mockReturnValueOnce(existingList);

    addExpiration('Goblin', 'Human', [{ type: 'stunned' }], 'MyCampaign');

    expect(existingList.length).toBe(1);
  });

  it('uses current combat round from getCurrentCombatRound', () => {
    getCurrentCombatRound.mockReturnValue(5);
    getRuntimeValue.mockReturnValueOnce(null);

    addExpiration('Goblin', 'Human', [{ type: 'stunned' }], 'MyCampaign');

    const call = setRuntimeValue.mock.calls[0];
    expect(call[2][0].appliedRound).toBe(5);
  });

  it('passes effects array through unchanged in entry', () => {
    const effects = [
      { type: 'stunned', condition: 'speed_halved' },
      { type: 'advantage_on_target' },
    ];
    getRuntimeValue.mockReturnValueOnce(null);

    addExpiration('Goblin', 'Human', effects, 'MyCampaign');

    const call = setRuntimeValue.mock.calls[0];
    expect(call[2][0].effects).toBe(effects);
  });
});
