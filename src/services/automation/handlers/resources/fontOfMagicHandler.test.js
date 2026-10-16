// @maintained-by-ai
// Contract pin: index.js dispatches automation type `font_of_magic` to this
// handler; useCharActionsAutomation.js routes the returned modalName
// `'fontOfMagic'` to open the Font of Magic modal (2024 sorcery resource hub).
// The handler is a pure constant — one exact-shape pin covers every input,
// since all four parameters are ignored by signature.
import { describe, it, expect } from 'vitest';

import { handle } from './fontOfMagicHandler.js';

// ── Tests ────────────────────────────────────────────────────────

describe('fontOfMagicHandler.handle', () => {
  it('returns the fontOfMagic modal descriptor regardless of inputs', async () => {
    const result = await handle();

    expect(result).toEqual({
      type: 'modal',
      modalName: 'fontOfMagic',
      payload: {},
    });

    // Same constant for the real dispatch signature and for null args.
    expect(
      await handle(
        { name: 'Font of Magic', automation: { type: 'font_of_magic' } },
        { name: 'Sorcerer', level: 17, rules: '2024' },
        'test-campaign',
        'combat-map',
      )
    ).toEqual(result);
    expect(await handle(null, null, null, null)).toEqual(result);
  });
});
