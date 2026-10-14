// All tests in this file were redundant with interactions.test.jsx, remaining.test.jsx,
// and panel-interactions.test.jsx.  The inline mock replicas (~300 lines) that mirror
// real component DOM structure made every test brittle — structural changes in the real
// components caused test failures that reflected UI layout changes, not behavioral
// regressions.
//
// Removed:
//   "displays 'name' as the default sort field" — duplicate of interactions.test.jsx
//   "displays 'asc' as the default sort direction" — duplicate of interactions.test.jsx
//   "renders sort field and direction elements when monster table is present" — duplicate
//     of interactions.test.jsx "sorts by name ascending by default" (same assertions).
//   "renders the filter panel for environment selection" — trivial rendering check.
//   "opens the save modal when Save button is clicked with monsters selected" — duplicate
//     of remaining.test.jsx "calls openSaveModal when Save button is clicked".
//
// This file is kept as a no-op placeholder so that downstream consumers who
// import from it do not break.  All meaningful encounter-builder interaction
// tests live in:
//   - EncounterBuilder.interactions.test.jsx       (core interactions)
//   - EncounterBuilder.panel-interactions.test.jsx  (comprehensive UI)
//   - EncounterBuilder.remaining.test.jsx           (filters, XP, handlers)
import { describe, it, expect } from 'vitest';

describe('EncounterBuilder - additional interactions (deprecated)', () => {
  it('all additional interaction coverage moved to sibling files', () => {
    expect(true).toBe(true);
  });
});
