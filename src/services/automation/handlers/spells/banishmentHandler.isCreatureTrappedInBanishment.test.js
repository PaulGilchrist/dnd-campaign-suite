// @maintained-by-ai
/**
 * banishment QUINTET lane #1875 — canonical home for isCreatureTrappedInBanishment
 * internals (banishmentHandler.js L20-23). Seam map in banishmentHandler.edge-cases.test.js.
 *
 * DEAD-API CAVEAT (re-verified at source 2026-10-16): zero non-test callers repo-wide —
 * grep covers imports, string dispatch (automation/index.js registers only `handle` as
 * handleBanishment, L210), server/, and docs/automations-manifest.json (SP-012 routes
 * Banishment through the generic spellHandler, never this predicate). The other
 * 'Trapped' grep hits are distinct forcecage/maze/imprisonment predicates.
 *
 * JUDGEMENT: KEEP as a minimal honest API-surface pin, not delete —
 *  - unique TRUE-leg coverage: every surviving call in the helpers lane #1873 asserts
 *        FALSE only ([]-store, null-store, target-mismatch, noise). Deleting this file
 *        would leave the suite never asserting the predicate returns true — an
 *        always-false mutation of the export would survive the full suite, so the
 *        zero-unique-coverage precondition for full-file deletion is NOT met;
 *  - any-source quirk pin (L22 matches target only, source is ignored) is pinned
 *        nowhere else for this predicate — #1874 owns isBanishmentBlocked only and
 *        explicitly handed this pin back here (its header, cross-lane handoff);
 *  - revival path plausible: symmetric isCreatureTrappedIn{Forcecage,Maze,Imprisonment}
 *        siblings keep equivalent pins, and the UI duplicates this exact read inline in
 *        AreaEffectTargetModalBase.jsx L114-118 / AOEConditionModal.jsx — a consolidation
 *        refactor would import this export. #1873 defers actual export deletion to the owner.
 *
 * Honesty fix (flagged defect, closed here per #1874 handoff): old test
 * 'returns false when creature is not in banishment effects' asserted TRUE on
 * Goblin-matching data (Goblin banished by 'OtherCaster'). The name lied; the assertion
 * was right. Renamed to what it pins — trapped-by-any-source semantics — with the
 * data and assertion unchanged. Target-mismatch FALSE is NOT re-added here: #1873
 * carries that complement honestly (helpers lane L64-70) and its removal is deferred
 * until the owner acts on the dead-API flag.
 *
 * Turn-based: pure read predicate over the runtime store — no timers, no writes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

import { isCreatureTrappedInBanishment } from './banishmentHandler.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

describe('banishmentHandler.isCreatureTrappedInBanishment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns false when creatureName is falsy (L21 guard — before any store read)', () => {
    expect(isCreatureTrappedInBanishment(null)).toBe(false);
    expect(isCreatureTrappedInBanishment(undefined)).toBe(false);
    expect(isCreatureTrappedInBanishment('')).toBe(false);
  });

  it('returns false when no banishment effects are stored', () => {
    getRuntimeValue.mockReturnValue([]);
    expect(isCreatureTrappedInBanishment('Goblin')).toBe(false);
  });

  it('returns true when the creature is banished', () => {
    getRuntimeValue.mockReturnValue([
      { effect: 'banishment', target: 'Goblin', source: 'Caster' },
    ]);
    expect(isCreatureTrappedInBanishment('Goblin')).toBe(true);
  });

  it('true when trapped by any source — L22 matches target only, caster identity is ignored', () => {
    getRuntimeValue.mockReturnValue([
      { effect: 'banishment', target: 'Orc', source: 'Caster' },
      { effect: 'banishment', target: 'Goblin', source: 'OtherCaster' },
    ]);
    expect(isCreatureTrappedInBanishment('Goblin')).toBe(true);
  });
});
