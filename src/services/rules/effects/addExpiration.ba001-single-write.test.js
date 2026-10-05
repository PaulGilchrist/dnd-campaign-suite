// BA-001 / §39: addExpiration previously issued TWO un-awaited setRuntimeValue
// POSTs to the same /changes/<Name> replace-route when the store key was
// absent (seed [] then [entry]). Network-side reordering let the seed []
// POST land last, so pendingExpirations stayed [] and expireStaleEffects had
// nothing to consume — the Dodge buff never cleared at the host's next turn
// start. The fix is ONE merged write carrying the appended entry.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  getAllStoreKeys: vi.fn(() => []),
}));

vi.mock('../../ui/utils.js', () => ({
  default: { getName: vi.fn((val) => String(val)) },
}));

vi.mock('../../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(() => 2),
}));

import { addExpiration } from './expirationQueue.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

const KEY = 'pendingExpirations';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('addExpiration — BA-001 single merged write (§39)', () => {
  it('issues exactly ONE write carrying the entry when the store key is absent (no seed [] POST)', () => {
    getRuntimeValue.mockReturnValueOnce(undefined);

    addExpiration({
      attackerName: 'LightfootHalfling',
      targetName: 'LightfootHalfling',
      effects: [{ type: 'remove_active_buff', buffName: 'Dodge' }],
      campaignName: 'test-campaign',
      rounds: undefined,
      expireOnCreatureName: 'LightfootHalfling',
    });

    expect(setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'LightfootHalfling',
      KEY,
      [{
        target: 'LightfootHalfling',
        effects: [{ type: 'remove_active_buff', buffName: 'Dodge' }],
        appliedRound: 2,
        expiryRounds: Infinity,
        expireOnCreatureName: 'LightfootHalfling',
      }],
      'test-campaign',
    );
    // No seed-only write may ever precede the entry write.
    expect(setRuntimeValue.mock.calls.some(c => Array.isArray(c[2]) && c[2].length === 0)).toBe(false);
  });

  it('issues exactly ONE write appending to an existing list', () => {
    getRuntimeValue.mockReturnValueOnce([{ target: 'Orc', effects: [], appliedRound: 1, expiryRounds: Infinity, expireOnCreatureName: null }]);

    addExpiration({
      attackerName: 'Caster',
      targetName: 'Target',
      effects: [{ type: 'remove_active_buff', buffName: 'Dodge' }],
      campaignName: 'test-campaign',
    });

    expect(setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(setRuntimeValue).toHaveBeenCalledWith('Caster', KEY, expect.arrayContaining([
      expect.objectContaining({ target: 'Orc' }),
      expect.objectContaining({ target: 'Target' }),
    ]), 'test-campaign');
  });

  it('writes a fresh array (no in-place mutation of the stored list)', () => {
    const stored = [{ target: 'Orc', effects: [], appliedRound: 1, expiryRounds: Infinity, expireOnCreatureName: null }];
    getRuntimeValue.mockReturnValueOnce(stored);

    addExpiration({ attackerName: 'Caster', targetName: 'Target', effects: [], campaignName: 'test-campaign' });

    expect(stored).toHaveLength(1);
    expect(setRuntimeValue.mock.calls[0][2]).not.toBe(stored);
  });
});
