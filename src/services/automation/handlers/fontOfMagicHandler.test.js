import { describe, it, expect } from 'vitest';

// ── Imports ────────────────────────────────────────────────────

import { handle } from './fontOfMagicHandler.js';

// ── Tests ──────────────────────────────────────────────────────

describe('fontOfMagicHandler.handle', () => {
  it('should return a modal result with type "modal"', async () => {
    const result = await handle();

    expect(result.type).toBe('modal');
  });

  it('should return a modal result with modalName "fontOfMagic"', async () => {
    const result = await handle();

    expect(result.modalName).toBe('fontOfMagic');
  });

  it('should return a modal result with an empty payload object', async () => {
    const result = await handle();

    expect(result.payload).toEqual({});
  });

  it('should return the complete expected object structure', async () => {
    const result = await handle();

    expect(result).toEqual({
      type: 'modal',
      modalName: 'fontOfMagic',
      payload: {},
    });
  });

  it('should ignore all passed arguments', async () => {
    const action = { name: 'Font of Magic', automation: {} };
    const playerStats = { name: 'Sorcerer', level: 3 };
    const campaignName = 'TestCampaign';
    const mapName = 'TestMap';

    const result = await handle(action, playerStats, campaignName, mapName);

    expect(result).toEqual({
      type: 'modal',
      modalName: 'fontOfMagic',
      payload: {},
    });
  });

  it('should return the same result regardless of argument values', async () => {
    const result1 = await handle(null, null, null, null);
    const result2 = await handle({}, {}, '', '');

    expect(result1).toEqual(result2);
  });
});
