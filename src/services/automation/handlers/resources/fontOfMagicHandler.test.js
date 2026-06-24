// @improved-by-ai
import { describe, it, expect } from 'vitest';

// ── Imports ────────────────────────────────────────────────────

import { handle } from './fontOfMagicHandler.js';

// ── Helpers ────────────────────────────────────────────────────

function makeAction(overrides = {}) {
  return {
    name: 'Font of Magic',
    automation: {},
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('fontOfMagicHandler.handle', () => {
  describe('return structure', () => {
    it('should return a modal result with the expected structure', async () => {
      const result = await handle();

      expect(result).toEqual({
        type: 'modal',
        modalName: 'fontOfMagic',
        payload: {},
      });
    });

    it('should return a modal result when called with no arguments', async () => {
      const result = await handle(undefined, undefined, undefined, undefined);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('fontOfMagic');
      expect(result.payload).toEqual({});
    });

    it('should return the same result regardless of argument values', async () => {
      const action = makeAction();
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
  });
});
