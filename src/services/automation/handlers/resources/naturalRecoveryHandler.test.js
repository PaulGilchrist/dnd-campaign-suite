import { describe, it, expect } from 'vitest';

import { handle } from './naturalRecoveryHandler.js';

// ── Tests ────────────────────────────────────────────────────────

describe('naturalRecoveryHandler.handle', () => {
  it('should return a modal result with action fields passed through in payload', async () => {
    const action = {
      name: 'Natural Recovery',
      description: 'Recover expended spell slots',
      automation: { type: 'natural_recovery', extra: 'data' },
    };
    const result = await handle(action, {}, 'campaign', 'map');

    expect(result).toEqual({
      type: 'modal',
      modalName: 'naturalRecovery',
      payload: {
        name: 'Natural Recovery',
        description: 'Recover expended spell slots',
        automation: { type: 'natural_recovery', extra: 'data' },
      },
    });
  });

  it('should default description to empty string when action.description is undefined or null', async () => {
    const result = await handle({ name: 'Natural Recovery', automation: { type: 'natural_recovery' } }, {}, 'campaign', 'map');
    expect(result.payload.description).toBe('');
  });

  it('should pass through automation as-is when null or undefined', async () => {
    const resultNull = await handle({ name: 'Natural Recovery', automation: null }, {}, 'campaign', 'map');
    expect(resultNull.payload.automation).toBe(null);

    const resultUndefined = await handle({ name: 'Natural Recovery' }, {}, 'campaign', 'map');
    expect(resultUndefined.payload.automation).toBe(undefined);
  });
});
