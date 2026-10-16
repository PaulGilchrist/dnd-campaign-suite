// @maintained-by-ai
/**
 * imprisonment PAIR lane 1/2 (helpers) — partner: imprisonmentHandler.test.js (#1928).
 *
 * PAIR SEAM MAP (imprisonmentHandler.js exports, read fully 2026-10-16):
 *  - THIS lane owns the exported predicate units:
 *      · isImprisonmentBlocked L28-44 — LIVE barrier gate. Production callers
 *            verified: hooks/combat/attackBlockers.js L11 (invoked L33 with
 *            (attacker, target, campaign)), rules/spells/spellCastService/
 *            execution/blockChecks.js L171, combat/steps/attackRollHousekeeping.js L13.
 *            Every consumer test (blockChecks.test.js, useLoggedDiceRollAttack.*.test.js)
 *            vi.mock()s this module, so this file is the repo's ONLY direct pin of
 *            the gate's implementation — full contract kept.
 *      · shared getImprisonmentEffects L12-14 store-read contract, pinned via the
 *            live predicate: exact-key read of campaign:targetEffects with NO
 *            campaignName pass-through (L28's _campaignName is deliberately ignored),
 *            `|| []` null-store guard, pure read (never writes), falsy-arg
 *            short-circuit BEFORE the store read (L29).
 *  - #1928 imprisonmentHandler.test.js owns handle() orchestration (imports
 *            handle only — its L43, verified) and, through it, the private units
 *            dispatchSaveResult L46-69, rollNpcImprisonmentSave L71-79,
 *            applyImprisonmentEffect L81-140. No overlap with this lane.
 *
 * DEAD-API FLAG — isCreatureTrappedInImprisonment L19-22: zero non-test callers
 * repo-wide (grep incl. bracket-string dispatch, barrels — the sole `export *`
 * barrel is encounters/combatData.js, which does not reach this module;
 * automation/index.js L259 imports `handle` only; no dynamic dispatch found).
 * Not used inside its own module either (handle never calls it; effect application
 * does its own inline filter L86-88; this spell has no handleEscape — removal is
 * via expiration cleanup L107-109 + removable badge). No revival/inline-duplication
 * evidence for the bare trapped form: the inline copy in
 * components/char-sheet/modals/shared/AreaEffectTargetModalBase.jsx L132-140
 * duplicates the full BLOCK rule (same-source intersection), not this predicate,
 * and is pinned by its own targets test. Symmetric with confirmed-dead twins
 * (isCreatureTrappedInForcecage — #1916 removed block + flag comment;
 * isCreatureTrappedInBanishment): tests removed, export deletion flagged for
 * owner sign-off — deleting the export removes nothing here.
 *
 * Consolidation flag (separate owner decision): AreaEffectTargetModalBase.jsx
 * L132-140 re-implements isImprisonmentBlocked's same-source rule inline —
 * candidate to call the predicate instead of duplicating it.
 *
 * Turn-based: pure read predicates only — no timers, no game-state writes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

import { isImprisonmentBlocked } from './imprisonmentHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

describe('imprisonmentHandler.isImprisonmentBlocked (live gate — attackBlockers L11, blockChecks L171, attackRollHousekeeping L13)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getImprisonmentEffects store-read contract (L13, shared via the gate)', () => {
    it('reads campaign:targetEffects by exact key with no campaignName pass-through, once per call, and never writes', () => {
      getRuntimeValue.mockReturnValue([]);

      expect(isImprisonmentBlocked('Wizard', 'Goblin', 'test-campaign')).toBe(false);

      expect(getRuntimeValue).toHaveBeenCalledTimes(1);
      expect(getRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects');
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('null runtime store falls back to [] via || [] — gate reports false without throwing', () => {
      getRuntimeValue.mockReturnValue(null);

      expect(isImprisonmentBlocked('Wizard', 'Goblin', 'test-campaign')).toBe(false);
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it.each([
      [null, 'Goblin', 'null attacker'],
      [undefined, 'Goblin', 'undefined attacker'],
      ['', 'Goblin', 'empty-string attacker'],
      ['Wizard', null, 'null target'],
      ['Wizard', undefined, 'undefined target'],
      ['Wizard', '', 'empty-string target'],
    ])('%s: short-circuits false BEFORE the store read (L29)', (attacker, target, _label) => {
      getRuntimeValue.mockReturnValue([
        { effect: 'imprisonment', target: 'Goblin', source: 'Archmage' },
      ]);

      expect(isImprisonmentBlocked(attacker, target, 'test-campaign')).toBe(false);
      expect(getRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('no-effect paths (L31/L36)', () => {
    it('non-imprisonment noise alone can never block (length-0 after filter, L31)', () => {
      getRuntimeValue.mockReturnValue([
        { effect: 'sanctuary', target: 'Wizard', source: 'Cleric' },
        { effect: 'imprisonment-adjacent', target: 'Goblin', source: 'Archmage' },
      ]);

      expect(isImprisonmentBlocked('Wizard', 'Goblin', 'test-campaign')).toBe(false);
    });

    it('returns false when neither attacker nor target is imprisoned (prisoners elsewhere are irrelevant, L36)', () => {
      getRuntimeValue.mockReturnValue([
        { effect: 'imprisonment', target: 'Ogre', source: 'CasterA' },
        { effect: 'sanctuary', target: 'Wizard', source: 'Cleric' },
      ]);

      expect(isImprisonmentBlocked('Wizard', 'Goblin', 'test-campaign')).toBe(false);
    });
  });

  describe('blocked/allowed truth table (L33-43)', () => {
    it('returns true when only the attacker is imprisoned by another caster (L43)', () => {
      getRuntimeValue.mockReturnValue([
        { effect: 'imprisonment', target: 'Wizard', source: 'Archmage' },
      ]);

      expect(isImprisonmentBlocked('Wizard', 'Goblin', 'test-campaign')).toBe(true);
    });

    it('returns true when only the target is imprisoned by another caster (L43)', () => {
      getRuntimeValue.mockReturnValue([
        { effect: 'imprisonment', target: 'Goblin', source: 'Archmage' },
      ]);

      expect(isImprisonmentBlocked('Wizard', 'Goblin', 'test-campaign')).toBe(true);
    });

    it('returns true when both are imprisoned by entirely different casters (L41)', () => {
      getRuntimeValue.mockReturnValue([
        { effect: 'imprisonment', target: 'Wizard', source: 'Archmage' },
        { effect: 'imprisonment', target: 'Goblin', source: 'Cleric' },
      ]);

      expect(isImprisonmentBlocked('Wizard', 'Goblin', 'test-campaign')).toBe(true);
    });

    it('returns false when both are imprisoned by the same caster — allies inside the barrier may fight (L41)', () => {
      getRuntimeValue.mockReturnValue([
        { effect: 'imprisonment', target: 'Wizard', source: 'Archmage' },
        { effect: 'imprisonment', target: 'Goblin', source: 'Archmage' },
      ]);

      expect(isImprisonmentBlocked('Wizard', 'Goblin', 'test-campaign')).toBe(false);
    });

    it('same shared source allows regardless of prisonType, and a third prisoner elsewhere changes nothing', () => {
      getRuntimeValue.mockReturnValue([
        { effect: 'imprisonment', target: 'Wizard', source: 'CasterA', prisonType: 'Slumber' },
        { effect: 'imprisonment', target: 'Goblin', source: 'CasterA', prisonType: 'Burial' },
        { effect: 'imprisonment', target: 'Ogre', source: 'CasterB' },
      ]);

      expect(isImprisonmentBlocked('Wizard', 'Goblin', 'test-campaign')).toBe(false);
    });

    it('returns true when attacker has multiple imprisonment effects and none share the target source', () => {
      getRuntimeValue.mockReturnValue([
        { effect: 'imprisonment', target: 'Wizard', source: 'CasterA' },
        { effect: 'imprisonment', target: 'Wizard', source: 'CasterB' },
        { effect: 'imprisonment', target: 'Goblin', source: 'CasterC' },
      ]);

      expect(isImprisonmentBlocked('Wizard', 'Goblin', 'test-campaign')).toBe(true);
    });

    it('returns false when any one of the attacker multiple sources matches the target source (some semantics)', () => {
      getRuntimeValue.mockReturnValue([
        { effect: 'imprisonment', target: 'Wizard', source: 'CasterA' },
        { effect: 'imprisonment', target: 'Wizard', source: 'CasterB' },
        { effect: 'imprisonment', target: 'Goblin', source: 'CasterA' },
      ]);

      expect(isImprisonmentBlocked('Wizard', 'Goblin', 'test-campaign')).toBe(false);
    });
  });
});
