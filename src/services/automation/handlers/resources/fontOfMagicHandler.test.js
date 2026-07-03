// @cleaned-by-ai
import { describe, it, expect } from 'vitest';

import { handle } from './fontOfMagicHandler.js';

describe('fontOfMagicHandler.handle', () => {
  it('should return a modal result with the expected structure', async () => {
    const result = await handle();

    expect(result).toEqual({
      type: 'modal',
      modalName: 'fontOfMagic',
      payload: {},
    });
  });
});
