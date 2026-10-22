// @maintained-by-ai
/* ------------------------------------------------------------------ */
/*  CLA-322 Spell Breaker — module-direct face of exported            */
/*  refundSpellBreakerSlot (helpers.js:102-107).                     */
/*  Canon #1478 verbatim: 'helpers-spellBreaker.test.js owns        */
/*  exported refundSpellBreakerSlot :102-107 direct -> not           */
/*  duplicated'.                                                      */
/*  Direct-vs-twin byte diff: :102-107 is an UNGATED runtime        */
/*  read-modify-write — every caller invoking it refunds; the only  */
/*  gates are numeric (:105 `currentSlots == null ||                */
/*  currentSlots < 0`). The dispel twin                            */
/*  refundDispelSpellBreakerSlot :153-165 is the GUARDED wrapper — */
/*  it fires only at the dispel-failure seam (triggerDispelMagic    */
/*  :184-186 `if (checkFailed)`) AND when the caster holds a        */
/*  spell_breaker passive whose slotRetentionSpells includes        */
/*  'Dispel Magic' AND real usesSpellSlot(spell, metaCtx) is true, */
/*  then calls :102 and adds the 'ability_use' refund log. The     */
/*  twin chain is owned by helpers-dispelMagic.test.js (exact-refund */
/*  rows :272-304, zero-refund-no-grant rows :306-356) — not       */
/*  duplicated here.                                                 */
/*  Disk evidence: Spell Breaker is 2024-only Abjurer lv10          */
/*  (public/data/2024/classes.json:13366-13385; grep 'Spell Breaker'*/
/*  public/data/classes.json -> 0 hits, so no 5e counterpart).     */
/*  Manifest CLA-322 (docs/automations-manifest.json:6219-6229):    */
/*  "When you cast either with spell slot, slot isn't expended if   */
/*  spell fails to stop a spell." — the refund itself is an         */
/*  instantaneous slot-level +1 write at the failure seam: no clock, */
/*  no stored expiry (NO-CLOCK); addExpiration never fires in this  */
/*  lane. Collector normalization of the disk passive                 */
/*  (type:'passive_rule', effect:'spell_breaker', slotRetentionSpells*/
/*  ['Counterspell','Dispel Magic']) census is owned by #1365.      */
/*  Gate-table ownership: spellCastService.test.js:235-236 delegates */
/*  'Full gate table (2->3 tuple, arity, null, negative) owned       */
/*  module-direct by execution/helpers-spellBreaker.test.js' here.  */
/*  Its 0->1 arm runs the same function bytes through the barrel    */
/*  re-export; module-direct 0-arms are kept here too.              */
/*  Mock set = helpers.js module-level imports :1-13, exact 13/13,  */
/*  no dead mocks; the unit under test (:102) is never mocked.     */
/* ------------------------------------------------------------------ */

import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ------------------------------------------------------------------ */
/*  Mocks — dependencies of helpers.js                                */
/* ------------------------------------------------------------------ */

vi.mock('../../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../automation/index.js', () => ({
  executeHandler: vi.fn(),
}));

vi.mock('../../../effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../features/spellUtils.js', () => ({
  usesSpellSlot: vi.fn(() => true),
}));

vi.mock('../../../../automation/handlers/class-wizard/arcaneWardHandler.js', () => ({
  onAbjurationSpellCast: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../../combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(),
}));

vi.mock('../../../../../services/rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(),
}));

vi.mock('../../../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
}));

vi.mock('../../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 5, rolls: [5] })),
  rollExpressionMaximized: vi.fn(() => ({ total: 8, rolls: [8] })),
  applyHealingRerollOnes: vi.fn(() => ({ displayRolls: [5], originalRolls: [5] })),
}));

vi.mock('../../../../combat/automation/automationService.js', () => ({
  markFortifiedHealthUsedIfGranted: vi.fn(),
  resolveHealingBonusesWithDetails: vi.fn(() => ({ totalBonus: 0, details: [] })),
  hasHealingMaximizationForTarget: vi.fn(() => false),
  hasRerollHealingOnes: vi.fn(() => false),
}));

vi.mock('../../../features/invisibilityService.js', () => ({
  endInvisibilityOnHostileAction: vi.fn(),
}));

/* ------------------------------------------------------------------ */
/*  SUT imports after mocks                                            */
/* ------------------------------------------------------------------ */

import { refundSpellBreakerSlot } from './helpers.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../../hooks/runtime/useRuntimeState.js';

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('helpers.js:102 refundSpellBreakerSlot — direct slot refund', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('refunds the slot at the ACTUAL cast level: reads spell_slots_level_<level> exactly once with 2 args, writes stored+1 once with the exact 4-arg tuple, returns undefined', () => {
    expect(refundSpellBreakerSlot.length).toBe(3);

    // Arms: canonical 2->3 at lv3 (delegated by spellCastService.test.js:235),
    // lv5 stored-0 zero-boundary + slot-key interpolation (dispel upcast seam —
    // twin runs REAL gates there, this face is gate-free by contract), lv9 kills
    // hardcoded level and off-by-one +1 mutants with distinct numerics.
    const arms = [
      { spellLevel: 3, stored: 2 },
      { spellLevel: 5, stored: 0 },
      { spellLevel: 9, stored: 7 },
    ];

    for (const { spellLevel, stored } of arms) {
      vi.clearAllMocks();
      getRuntimeValue.mockReturnValue(stored);

      const result = refundSpellBreakerSlot('TestWizard', spellLevel, 'test-campaign');

      const slotKey = `spell_slots_level_${spellLevel}`;
      // Read census: exactly one 2-arg read (arity quirk: campaignName NOT forwarded).
      expect(getRuntimeValue.mock.calls).toEqual([['TestWizard', slotKey]]);
      // Write census: exactly one refund write, exact tuple, stored+1.
      expect(setRuntimeValue.mock.calls).toEqual([
        ['TestWizard', slotKey, stored + 1, 'test-campaign'],
      ]);
      expect(result).toBeUndefined();
    }
  });

  it('writes nothing when the stored count is missing (null or undefined — loose `== null` guard) or negative — guard evaluated exactly once, no refund, returns undefined', () => {
    // missing-vs-negative split the two guard clauses at helpers.js:105:
    // null/undefined kill a `=== null` mutant (undefined would reach `+1`
    // and write NaN); -1 kills a dropped `< 0` clause (would write 0).
    for (const stored of [null, undefined, -1]) {
      vi.clearAllMocks();
      getRuntimeValue.mockReturnValue(stored);

      const result = refundSpellBreakerSlot('TestWizard', 3, 'test-campaign');

      // The guard READ first — an always-return mutant that skips the read
      // fails here, not trivially.
      expect(getRuntimeValue.mock.calls).toEqual([['TestWizard', 'spell_slots_level_3']]);
      expect(setRuntimeValue.mock.calls).toEqual([]);
      expect(result).toBeUndefined();
    }
  });
});
