// @maintained-by-ai
/**
 * banishment QUINTET lane #1874 — CANONICAL HOME for isBanishmentBlocked internals
 * (banishmentHandler.js L29-45). Seam map in banishmentHandler.edge-cases.test.js.
 *
 * Live gate — production consumers re-verified at source 2026-10-16:
 *  - hooks/combat/attackBlockers.js L10 — { check: isBanishmentBlocked, name:'Banishment' }
 *        in the useLoggedDiceRollAttack blocker table;
 *  - services/rules/spells/spellCastService/execution/blockChecks.js L149 — spell-cast
 *        gate calling isBanishmentBlocked(casterName, targetName, campaignName);
 *  - services/combat/steps/attackRollHousekeeping.js L12 — pipeline blocker table
 *        ('demiplane barrier' wording).
 *
 * Absorbed from #1873 helpers lane per its close recommendation (verified at source):
 *  - '' empty-string attacker/target arm + short-circuit ORDER (L30 returns BEFORE the
 *        store read — getRuntimeValue never called; old falsy tests here used null/
 *        undefined only and pinned no read order);
 *  - non-banishment noise in the store can never block (filter L14 → length-0, L32);
 *  - `|| []` null-store guard (L14).
 * Strengthens beyond the absorbed set: exact-key read pin with the ignored `_campaignName`
 * third arg (blockChecks.js:149 passes it; L14 ignores it — 'campaign' sentinel read),
 * and strict target/source equality (near-miss names never trap — L34-35/42).
 *
 * Cross-lane handoff: the dishonest test flagged by the audit — 'returns false when
 * creature is not in banishment effects' asserting TRUE on Goblin-matching data — lives
 * in #1875 isCreatureTrappedInBanishment.test.js L34-40, NOT in this lane (this file is
 * isBanishmentBlocked-only; its mismatch-false test here reaches L37 honestly). Fix for
 * #1875 (closes next): rename to what it pins ('true when trapped by any caster, even a
 * second source') or make it genuine mismatch-false with an Orc-only store — then shed
 * the helpers lane's target-mismatch complement back.
 *
 * Turn-based: pure read predicate over the runtime store — no timers, no writes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

import { isBanishmentBlocked } from './banishmentHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

const te = (target, source) => ({ effect: 'banishment', target, source });

// Would-block-if-read for the canonical ('Caster', 'Goblin') pair: both trapped,
// no shared source. A false result alongside getRuntimeValue.not.toHaveBeenCalled()
// therefore proves the L30 short-circuit, not a happy-store accident.
const wouldBlockStore = [te('Caster', 'Caster'), te('Goblin', 'OtherCaster')];

describe('banishmentHandler.isBanishmentBlocked', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('short-circuit before the store read (L30)', () => {
    it('falsy or empty-string attacker returns false without reading the store', () => {
      getRuntimeValue.mockReturnValue(wouldBlockStore);

      expect(isBanishmentBlocked(null, 'Goblin')).toBe(false);
      expect(isBanishmentBlocked(undefined, 'Goblin')).toBe(false);
      expect(isBanishmentBlocked('', 'Goblin')).toBe(false);
      expect(getRuntimeValue).not.toHaveBeenCalled();
    });

    it('falsy or empty-string target returns false without reading the store', () => {
      getRuntimeValue.mockReturnValue(wouldBlockStore);

      expect(isBanishmentBlocked('Caster', null)).toBe(false);
      expect(isBanishmentBlocked('Caster', undefined)).toBe(false);
      expect(isBanishmentBlocked('Caster', '')).toBe(false);
      expect(getRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('store-read contract (getBanishmentEffects L13-14 via L31)', () => {
    it('reads campaign:targetEffects exactly once, ignores the campaignName arg, never writes', () => {
      getRuntimeValue.mockReturnValue([]);

      expect(isBanishmentBlocked('Caster', 'Goblin', 'some-campaign')).toBe(false);

      expect(getRuntimeValue).toHaveBeenCalledTimes(1);
      expect(getRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects');
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('null runtime store falls back to [] via || [] — false without throwing', () => {
      getRuntimeValue.mockReturnValue(null);

      expect(isBanishmentBlocked('Caster', 'Goblin')).toBe(false);
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('non-banishment noise in the store can never block (filter L14 leaves length-0, L32)', () => {
      getRuntimeValue.mockReturnValue([
        { effect: 'slowed', target: 'Caster', source: 'Caster' },
        { effect: 'banished-ish', target: 'Goblin', source: 'Caster' },
      ]);

      expect(isBanishmentBlocked('Caster', 'Goblin')).toBe(false);
    });
  });

  describe('block matrix (L34-44)', () => {
    it.each([
      ['neither attacker nor target trapped (L37)', [te('Orc', 'Caster')], false],
      // Targets never equal to 'Caster'/'Goblin' — near-miss spellings and
      // lowercase 'caster' must not trap either side of the pair (L34-35).
      ['near-miss target/case names never trap (L34-35 strict ===)', [te('Goblins', 'Caster'), te('caster', 'Caster')], false],
      ['attacker trapped, target free (L44)', [te('Caster', 'Caster')], true],
      ['target trapped, attacker free (L44)', [te('Goblin', 'Caster')], true],
      ['both trapped by the same caster — same demiplane (L38-42)', [te('Caster', 'Caster'), te('Goblin', 'Caster')], false],
      ['both trapped by different casters (L42)', [te('Caster', 'OtherCaster'), te('Goblin', 'Caster')], true],
      ['attacker has two sources; one shared with target (L42 some)', [te('Caster', 'Caster'), te('Caster', 'OtherCaster'), te('Goblin', 'Caster')], false],
      ['attacker has two sources; neither shared with target (L42)', [te('Caster', 'A'), te('Caster', 'B'), te('Goblin', 'Caster')], true],
      ['unrelated banished creatures alongside never unblock (L34-42)', [te('Orc', 'Caster'), te('Caster', 'Caster'), te('Goblin', 'OtherCaster')], true],
    ])('%s', (_desc, store, expected) => {
      getRuntimeValue.mockReturnValue(store);

      expect(isBanishmentBlocked('Caster', 'Goblin')).toBe(expected);
    });
  });
});
