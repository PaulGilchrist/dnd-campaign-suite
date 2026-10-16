// @maintained-by-ai
// toolValidation MAIN lane (#2065): the direct-unit lane for normalizeCategory — the module's
// smallest pure contract: falsy guard (identity shape) + table lookup + trim fallback.
// SEAM MAP (siblings cited, never re-pinned here):
// - .parsing.test.js (#2063) — the FULL normalization table pinned through parse outputs
//   ('Gaming Set'→'Gaming Sets', 'Musical Instruments'→'Musical Instrument', unknown
//   'Gaming Tool' verbatim, case-sensitive table, outer trim). One direct table row here
//   pins the unit itself; the rest of the table is not duplicated.
// - .services.test.js (#2064) — normalization through the getToolsByCategory filter
//   (plural==singular on disk rows); #2064 also owns computeSkilledToolUsage (NOT pinned
//   here) and flags its dead-export dupe with skilled-pool.js to the orchestrator ledger —
//   any pin of it must move/die with that export.
// - .major-feature.test.js (#2062) — 'Tool: ' prefix extraction owned there.
// - .limits.test.js (#2061) — fetch→limit aggregation seam map home.
// Zero mocks: normalizeCategory is pure string logic; no imports are exercised.
import { describe, it, expect } from 'vitest';
import { normalizeCategory } from './toolValidation.js';

describe('toolValidation - normalizeCategory', () => {
  it.each([
    // falsy guard: returned with IDENTITY intact (null stays null, undefined stays undefined)
    [null, null],
    [undefined, undefined],
    ['', ''],
    // whitespace-only: misses the table, trim fallback yields ''
    ['   ', ''],
    // one direct table row (full table pinned through parse outputs in .parsing.test.js)
    ['Gaming Set', 'Gaming Sets'],
  ])('normalizeCategory(%j) → %j', (input, expected) => {
    expect(normalizeCategory(input)).toBe(expected);
  });
});
