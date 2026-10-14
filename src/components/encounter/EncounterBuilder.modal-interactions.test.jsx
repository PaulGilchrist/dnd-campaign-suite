// All tests in this file were redundant with panel-interactions.test.jsx and
// modal-flows.test.jsx.  The inline mock replicas (~300 lines) that mirror
// real component DOM structure made every test brittle – structural changes
// in the real components caused test failures that reflected UI layout
// changes, not behavioral regressions.
//
// Every modal open / close flow, save/load/generate button behavior, monster
// card modal interaction, and the description-editing test is already covered
// with identical or superior assertions in the two sibling files above.
//
// This file is kept as a no-op placeholder so that downstream consumers who
// import from it do not break.  All meaningful encounter-builder interaction
// tests live in:
//   - EncounterBuilder.panel-interactions.test.jsx   (comprehensive)
//   - EncounterBuilder.modal-flows.test.jsx           (modal state management)
//   - EncounterBuilder.gameplay-flows.test.jsx        (initiative / XP)
import { describe, it, expect } from 'vitest';

describe('EncounterBuilder interactions - modals (deprecated)', () => {
  it('all modal interaction coverage moved to panel-interactions.test.jsx', () => {
    expect(true).toBe(true);
  });
});
