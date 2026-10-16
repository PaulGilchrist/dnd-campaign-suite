// @maintained-by-ai
/**
 * banishment QUINTET lane #1873 — GAP-complement over the two exported predicates
 * of banishmentHandler.js. Canonical homes for predicate internals are the
 * dedicated lanes (per the seam map in banishmentHandler.edge-cases.test.js):
 *  - isBanishmentBlocked L29-45 → #1874 (live gate; consumers verified at
 *        attackBlockers.js L10, blockChecks.js L149, attackRollHousekeeping.js L12).
 *  - isCreatureTrappedInBanishment L20-23 → #1875. DEAD-API FLAG: this export has
 *        zero non-test callers repo-wide (grep incl. string dispatch, server/, docs) —
 *        deletion candidate pending owner sign-off; that would remove this describe too.
 *
 * This lane keeps ONLY what neither dedicated file pins (coverage-diff 2026-10-16):
 *  - shared getBanishmentEffects L13-15 store-read contract: exact-key read of
 *        campaign:targetEffects, pure read (never writes), and the `|| []` null-store
 *        guard — untested through the predicates in every other lane;
 *  - falsy-arg short-circuit ORDER of isBanishmentBlocked L30 (returns before the
 *        store read) plus the '' empty-string arm (dedicated #1874 uses null/undefined only);
 *  - non-banishment noise in the store: filter L14 can never make an attack blocked
 *        (L32 length-0-after-filter) and can never report trapped — #1874 never feeds
 *        non-banishment effects, #1875 never feeds any noise;
 *  - isCreatureTrapped target-mismatch FALSE — the true internal branch #1875's
 *        misnamed test (asserts true on matching data) never reaches.
 *
 * Turn-based: pure read predicates, no timers, no game-state writes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

import { isCreatureTrappedInBanishment, isBanishmentBlocked } from './banishmentHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

describe('banishmentHandler helpers (gaps beyond #1874/#1875)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getBanishmentEffects store-read contract (L13-15, shared via both predicates)', () => {
    it('reads campaign:targetEffects exactly, once per predicate call, and never writes', () => {
      getRuntimeValue.mockReturnValue([]);

      expect(isCreatureTrappedInBanishment('Goblin')).toBe(false);
      expect(isBanishmentBlocked('Wizard', 'Goblin')).toBe(false);

      expect(getRuntimeValue).toHaveBeenCalledTimes(2);
      expect(getRuntimeValue).toHaveBeenNthCalledWith(1, 'campaign', 'targetEffects');
      expect(getRuntimeValue).toHaveBeenNthCalledWith(2, 'campaign', 'targetEffects');
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('null runtime store falls back to [] via || [] — both predicates report false without throwing', () => {
      getRuntimeValue.mockReturnValue(null);

      expect(isCreatureTrappedInBanishment('Goblin')).toBe(false);
      expect(isBanishmentBlocked('Wizard', 'Goblin')).toBe(false);
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('isCreatureTrappedInBanishment (complements #1875)', () => {
    it('returns false when banishment exists for another creature only (target mismatch)', () => {
      getRuntimeValue.mockReturnValue([
        { effect: 'banishment', target: 'Orc', source: 'Caster' },
      ]);

      expect(isCreatureTrappedInBanishment('Goblin')).toBe(false);
    });

    it('non-banishment effects on the creature never read as trapped (filter L14)', () => {
      getRuntimeValue.mockReturnValue([
        { effect: 'slowed', target: 'Goblin', source: 'Caster' },
        { effect: 'blinded', target: 'Goblin', source: 'Caster' },
      ]);

      expect(isCreatureTrappedInBanishment('Goblin')).toBe(false);
    });
  });

  describe('isBanishmentBlocked (complements #1874)', () => {
    it('empty-string attacker or target short-circuits BEFORE the store read (L30)', () => {
      getRuntimeValue.mockReturnValue([
        { effect: 'banishment', target: 'Goblin', source: 'Caster' },
      ]);

      expect(isBanishmentBlocked('', 'Goblin')).toBe(false);
      expect(isBanishmentBlocked('Wizard', '')).toBe(false);
      expect(getRuntimeValue).not.toHaveBeenCalled();
    });

    it('non-banishment noise in the store can never block an attack (length-0 after filter, L32)', () => {
      getRuntimeValue.mockReturnValue([
        { effect: 'slowed', target: 'Goblin', source: 'Caster' },
        { effect: 'banished-ish', target: 'Wizard', source: 'Caster' },
      ]);

      expect(isBanishmentBlocked('Wizard', 'Goblin')).toBe(false);
    });
  });
});
