// @maintained-by-ai
// BA-001 / §39: addExpiration previously issued TWO un-awaited setRuntimeValue
// POSTs to the same /changes/<Name> replace-route when the store key was
// absent (seed [] then [entry]). Network-side reordering let the seed []
// POST land last, so pendingExpirations stayed [] and expireStaleEffects had
// nothing to consume — the Dodge buff never cleared at the host's next turn
// start. The fix is ONE merged write carrying the appended entry.
// Contract pinned here: exactly ONE write per call, exact entry bytes,
// round-counter stamps only (appliedRound from getCurrentCombatRound —
// never a wall-clock timestamp, per the strictly-turn-based mandate).
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
  it('ONE write carrying the full entry when the store key is absent — never a seed [] POST', () => {
    getRuntimeValue.mockReturnValueOnce(undefined);

    addExpiration({
      attackerName: 'LightfootHalfling',
      targetName: 'LightfootHalfling',
      effects: [{ type: 'remove_active_buff', buffName: 'Dodge' }],
      campaignName: 'test-campaign',
      rounds: undefined,
      expireOnCreatureName: 'LightfootHalfling',
    });

    // Exact payload (deep equality forbids extra fields such as timestamps)
    // plus times(1) makes a seed-only [] write impossible by construction.
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
  });

  it('ONE write appending to an existing list — exact payload, caller-owned list never mutated', () => {
    const stored = [{ target: 'Orc', effects: [], appliedRound: 1, expiryRounds: Infinity, expireOnCreatureName: null }];
    getRuntimeValue.mockReturnValueOnce(stored);

    addExpiration({
      attackerName: 'Caster',
      targetName: 'Target',
      effects: [{ type: 'remove_active_buff', buffName: 'Dodge' }],
      campaignName: 'test-campaign',
    });

    expect(setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(setRuntimeValue).toHaveBeenCalledWith('Caster', KEY, [
      { target: 'Orc', effects: [], appliedRound: 1, expiryRounds: Infinity, expireOnCreatureName: null },
      {
        target: 'Target',
        effects: [{ type: 'remove_active_buff', buffName: 'Dodge' }],
        appliedRound: 2,
        expiryRounds: Infinity,
        expireOnCreatureName: null,
      },
    ], 'test-campaign');
    // Fresh array written; the stored/caller list stays untouched.
    expect(setRuntimeValue.mock.calls[0][2]).not.toBe(stored);
    expect(stored).toHaveLength(1);
  });

  it('until:"combat" rides the merged entry with rounds:Infinity — combat-scoped, never a round countdown (no-timers T3)', () => {
    getRuntimeValue.mockReturnValueOnce(undefined);

    addExpiration({
      attackerName: 'Caster',
      targetName: 'Target',
      effects: [{ type: 'remove_active_buff', buffName: 'Dodge' }],
      campaignName: 'test-campaign',
      rounds: Infinity,
      until: 'combat',
    });

    // zoneDurationClock.test.js mocks addExpiration, so the real queue's
    // until-stamp branch is owned here; test 1 pins the negative
    // (legacy calls carry NO until key, via its exact payload).
    expect(setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(setRuntimeValue).toHaveBeenCalledWith('Caster', KEY, [{
      target: 'Target',
      effects: [{ type: 'remove_active_buff', buffName: 'Dodge' }],
      appliedRound: 2,
      expiryRounds: Infinity,
      expireOnCreatureName: null,
      until: 'combat',
    }], 'test-campaign');
  });
});
