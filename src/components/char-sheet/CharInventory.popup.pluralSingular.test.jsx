// CharInventory popup plural/singular edge cases
//
// Tests removed as duplicates already covered in:
//   CharInventory.popup.test.jsx - general "not found" behavior (line 189-202)
//   CharInventory.popup.test.jsx - positive plural-to-singular (Daggers→Dagger line 84-99,
//     Longswords→Longsword line 101-113)
//
// Removed tests (2):
//   REMOVE: "Crossbowes" misspelled irregular plural (duplicate "not found" behavior of popup.test.jsx:189-202)
//   REMOVE: "Potions of Healing" mid-name plural (duplicate "not found" behavior of popup.test.jsx:189-202)
//
// Both remaining tests asserted the same observable behavior — popup shows "not found in database"
// when lookup fails. The positive plural-to-singular path is already covered by popup.test.jsx.
// No unique behavioral coverage remains.

import { describe, it, expect } from 'vitest';

describe('CharInventory popup plural/singular edge cases', () => {
  // All tests removed — see header comments.
  // This file is kept as a placeholder so existing import paths do not break.
  it('no tests remain - see header comments', () => {
    expect(true).toBe(true);
  });
});
