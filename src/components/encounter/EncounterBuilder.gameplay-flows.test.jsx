// All tests in this file were redundant with remaining.test.jsx.  The inline
// mock replicas (~300 lines) that mirror real component DOM structure made
// every test brittle — structural changes in the real components caused test
// failures that reflected UI layout changes, not behavioral regressions.
//
// Removed:
//   "calls addMonstersToInitiative with selected monsters, characters, and
//     campaign name when joining" — redundant with remaining.test.jsx
//     "shows Join Encounter button when monsters selected" which tests the
//     same join flow with identical mock setup and assertions.
//   "does not show Join Encounter button when no monsters are selected" —
//     redundant with remaining.test.jsx "handleJoinEncounter - no monsters".
//   "calls onJoinEncounter callback when Join Encounter button is clicked" —
//     redundant with remaining.test.jsx "shows Join Encounter button when
//     monsters selected" which tests the same flow.
//   "calculates effectiveXP with difficulty multiplier for single monster
//     with qty 1" — redundant with remaining.test.jsx
//     "updates effective XP when monsters are selected".
//   "updates effectiveXP when monster quantity increases" — redundant with
//     remaining.test.jsx "updates effective XP when monsters are selected"
//     and "updates monster count when quantity changes".
//   "updates effectiveXP when monster quantity decreases back to 0" —
//     redundant with remaining.test.jsx "updates effective XP when monsters
//     are selected".
//
// This file is kept as a no-op placeholder so that downstream consumers who
// import from it do not break.  All meaningful encounter-builder gameplay
// flow tests live in:
//   - EncounterBuilder.remaining.test.jsx   (join flow, XP calculations)
//   - EncounterBuilder.panel-interactions.test.jsx   (comprehensive UI)
import { describe, it, expect } from 'vitest';

describe('EncounterBuilder gameplay flows (deprecated)', () => {
  it('all gameplay flow coverage moved to remaining.test.jsx', () => {
    expect(true).toBe(true);
  });
});
