// All tests in this file were redundant with panel-interactions.test.jsx and
// uncovered-handlers.test.jsx.  The inline mock replicas (~300 lines) that
// mirror real component DOM structure made every test brittle — structural
// changes in the real components caused test failures that reflected UI layout
// changes, not behavioral regressions.
//
// Removed:
//   "renders without error when deleteEncounterAction is provided" — no
//     behavioral assertion beyond "it renders", adds zero confidence.
//   "does not call deleteEncounterAction when user cancels confirmation" —
//     redundant with uncovered-handlers.test.jsx (same pattern, same mocks).
//   "renders without error when renameEncounterAction is provided" — no
//     behavioral assertion beyond "it renders", adds zero confidence.
//   "calls openSaveModal and renders the save modal with monsters selected" —
//     redundant with additional-interactions.test.jsx and remaining.test.jsx
//     which test the same openSaveModal flow with identical assertions.
//
// This file is kept as a no-op placeholder so that downstream consumers who
// import from it do not break.  All meaningful encounter-builder modal flow
// tests live in:
//   - EncounterBuilder.panel-interactions.test.jsx   (comprehensive)
//   - EncounterBuilder.uncovered-handlers.test.jsx    (delete/rename handlers)
//   - EncounterBuilder.additional-interactions.test.jsx  (save modal open)
//   - EncounterBuilder.remaining.test.jsx             (save modal open)
import { describe, it, expect } from 'vitest';

describe('EncounterBuilder modal flows (deprecated)', () => {
  it('all modal flow coverage moved to sibling files', () => {
    expect(true).toBe(true);
  });
});
