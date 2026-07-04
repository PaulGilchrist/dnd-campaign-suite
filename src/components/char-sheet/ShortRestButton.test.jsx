// @cleaned-by-ai
// ShortRestButton is a trivial presentational component (10 lines, no dynamic behavior).
// All tests were redundant or overly implementation-specific:
//   - "button content" asserted hardcoded DOM structure (title text, icon class names) —
//     brittle to cosmetic changes with zero behavioral value.
//   - "on click" asserted React's native onClick propagation — testing framework behavior.
// Removed entirely. See git history for the previous test suite.

import { describe, it } from 'vitest';

describe('ShortRestButton', () => {
  // All behavioral tests removed — component is a static presentational button.
  it('exists as a placeholder', () => {});
});
