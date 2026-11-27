// @maintained-by-ai 2026-11-27 improve-and-trim: stale 2026-10-16 marker refreshed (parsing #1885 rec); added padded-table-hit leg (lookup-input trim — no sibling can fail its removal); added full export-face census pinning retired-export absence both directions per services #1886; entry contracts confirmed owned by .limits (covered there stronger, not restated).
// toolValidation MAIN lane (#2065): the direct-unit lane — normalizeCategory's falsy/
// null-identity guard cell (declared by services #1886: "null-identity remains pinned
// stronger in .test.js direct unit") plus the module's export-face census.
// SEAM MAP (siblings cited, never re-pinned here; all four re-swept 2026-11-27):
// - .limits.test.js — getToolLimitsByCategory/validateTools ENTRY contracts (ruleset
//   short-circuit → full-shape empty result, no-fetch) are covered THERE stronger with
//   transport mocks; entry-contract units are intentionally NOT restated here.
// - .parsing.test.js — the FULL normalization table pinned through parse outputs ('Gaming
//   Set'→'Gaming Sets', 'Musical Instruments'→'Musical Instrument', unknown 'Gaming Tool'
//   verbatim, case-sensitive table, outer trim of the CHOICE string). Here only the unit
//   itself: one table row, the table-miss fallback trim, and the padded-table-hit pinning
//   the pre-lookup trim (parse-side whitespace is consumed before segments reach here).
// - .services.test.js — normalizeCategory through the getToolsByCategory filter (plural==
//   singular on disk rows); its computeSkilledToolUsage lane died with the dead export.
// - .major-feature.test.js — 'Tool: ' prefix extraction owned there.
// Export census: the module exports exactly the six live functions. The full-shape key list
// is mutation-failable in BOTH directions — resurrecting the retired
// computeSkilledToolUsage or adding a new unimported export both fail this pin.
// normalizeCategory has ZERO callers outside toolValidation.js (all in-module uses are
// internal); the export exists to make this owner-declared direct-unit lane possible.
// Zero mocks: normalizeCategory and the namespace-shape census exercise no imports
// (module-level dataLoader import is inert on load — parsing lane probe-verified).
import { describe, it, expect } from 'vitest';
import * as toolValidation from './toolValidation.js';
import { normalizeCategory } from './toolValidation.js';

describe('toolValidation - module export face', () => {
  it('exports exactly the six live functions (retired computeSkilledToolUsage stays dead)', () => {
    expect(Object.keys(toolValidation).sort()).toEqual([
      'getToolLimitsByCategory',
      'getToolsByCategory',
      'normalizeCategory',
      'parseFeatToolProficiency',
      'parseToolChoiceString',
      'validateTools',
    ]);
  });
});

describe('toolValidation - normalizeCategory', () => {
  it.each([
    // falsy guard: returned with IDENTITY intact. The three faces discriminate guard
    // mutations: dropping the guard throws on null/undefined; substituting a constant
    // (e.g. `category || null`) fails whichever face the constant differs from.
    [null, null],
    [undefined, undefined],
    ['', ''],
    // table miss: the fallback trim yields '' (fails if the `|| category.trim()` fallback
    // is dropped for a raw verbatim return)
    ['   ', ''],
    // one direct table row (full table pinned through parse outputs in .parsing.test.js)
    ['Gaming Set', 'Gaming Sets'],
    // padded table hit pins the PRE-LOOKUP trim: parse lanes feed normalizeCategory only
    // whitespace-free segments, so no sibling could fail removal of that trim
    ['  Gaming Set  ', 'Gaming Sets'],
  ])('normalizeCategory(%j) → %j', (input, expected) => {
    expect(normalizeCategory(input)).toBe(expected);
  });
});
