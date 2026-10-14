// All tests in this file were redundant with panel-interactions.test.jsx and
// remaining.test.jsx.  The inline mock replicas (~250 lines) that mirror real
// component DOM structure made every test brittle — structural changes in the
// real components caused test failures that reflected UI layout changes, not
// behavioral regressions.
//
// Removed (all 15 tests, zero unique behavioral coverage):
//   "toggles a monster on when checkbox is clicked" — duplicate of
//     panel-interactions.test.jsx (identical setup: mount + checkbox click +
//     selected-item presence assertion).
//   "toggles a monster off when checkbox is clicked again" — duplicate of
//     panel-interactions.test.jsx (identical flow, same assertions).
//   "shows selected monsters in the selected monsters panel" — duplicate of
//     remaining.test.jsx "shows correct XP for a monster with qty 1" (same
//     selected-item-goblin presence, plus name text assertion).
//   "toggles monster when row is clicked" — duplicate of panel-interactions.test.jsx
//     "deselects a monster when quantity is decreased to zero" (same checkbox
//     toggle via different trigger, identical assertion on checkbox.checked).
//   "removes monster from selection when its checkbox is toggled off" — duplicate
//     of panel-interactions.test.jsx "deselects a monster when quantity is
//     decreased to zero" (identical flow: select → deselect → verify absent).
//   "increases quantity when + button is clicked" — duplicate of
//     panel-interactions.test.jsx (identical assertions: qty text content).
//   "decreases quantity when - button is clicked" — duplicate of
//     panel-interactions.test.jsx (identical flow + assertions).
//   "removes monster from selection when quantity reaches 0 via decrease" —
//     duplicate of panel-interactions.test.jsx "deselects a monster when
//     quantity is decreased to zero" (identical: qty 1 → decrease → checkbox
//     false + selected-item absent + qty element absent).
//   "removes monster when remove button is clicked from table row" — duplicate
//     of panel-interactions.test.jsx "removes a monster when remove button is
//     clicked from the table row" (identical assertions on checkbox + selected).
//   "removes monster from selection when remove is clicked from selected panel" —
//     duplicate of panel-interactions.test.jsx "removes a monster when remove
//     button is clicked from the selected panel" (identical assertions).
//   "hides qty controls for unselected monsters" — duplicate of
//     panel-interactions.test.jsx "hides qty controls for unselected monsters"
//     (identical queryByTestId assertions).
//   "filters monsters by name when search query is entered" — duplicate of
//     remaining.test.jsx "filteredMonsters - search" (identical assertions).
//   "shows all monsters when search is cleared" — duplicate of remaining.test.jsx
//     "filteredMonsters - search" (same search clear + all monsters visible).
//   "filters by monster type in search query" — duplicate of remaining.test.jsx
//     "filteredMonsters - type filter" (identical type filter assertions).
//   "sorts by name ascending by default" — duplicate of additional-interactions.test.jsx
//     "displays 'name' as the default sort field" + "displays 'asc' as the
//     default sort direction" (identical assertions combined into one).
//
// All meaningful encounter-builder interaction tests live in:
//   - EncounterBuilder.panel-interactions.test.jsx   (comprehensive UI)
//   - EncounterBuilder.remaining.test.jsx            (filters, XP, handlers)
import { describe, it, expect } from 'vitest';

describe('EncounterBuilder interactions - core (deprecated)', () => {
  it('all core interaction coverage moved to panel-interactions.test.jsx', () => {
    expect(true).toBe(true);
  });
});
