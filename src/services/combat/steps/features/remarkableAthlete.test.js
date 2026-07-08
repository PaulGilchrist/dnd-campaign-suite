import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn(),
}));

// ── Imports ──────────────────────────────────────────────────────

import { remarkableAthlete } from './remarkableAthlete.js';
import { setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

// ── Helpers ───────────────────────────────────────────────────────

function makeCtx(overrides = {}) {
  return {
    campaignName: 'test-campaign',
    playerStats: { name: 'Fighter1' },
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────

describe('remarkableAthlete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('condition', () => {
    it('returns true when isCrit is true and player has remarkable_athlete_movement passive', () => {
      const ctx = makeCtx({
        isCrit: true,
        playerStats: {
          automation: {
            passives: [
              { type: 'auto_effect', effect: 'remarkable_athlete_movement' },
            ],
          },
        },
      });

      expect(remarkableAthlete.condition(ctx)).toBe(true);
    });

    it('returns false when isCrit is false', () => {
      const ctx = makeCtx({
        isCrit: false,
        playerStats: {
          automation: {
            passives: [
              { type: 'auto_effect', effect: 'remarkable_athlete_movement' },
            ],
          },
        },
      });

      expect(remarkableAthlete.condition(ctx)).toBe(false);
    });

    it('returns false when player has no passives', () => {
      const ctx = makeCtx({
        isCrit: true,
        playerStats: {
          automation: {
            passives: [],
          },
        },
      });

      expect(remarkableAthlete.condition(ctx)).toBe(false);
    });

    it('returns false when player has no automation object', () => {
      const ctx = makeCtx({
        isCrit: true,
        playerStats: {},
      });

      expect(remarkableAthlete.condition(ctx)).toBe(false);
    });

    it('returns false when playerStats is null', () => {
      const ctx = makeCtx({
        isCrit: true,
        playerStats: null,
      });

      expect(remarkableAthlete.condition(ctx)).toBe(false);
    });

    it('returns false when playerStats.automation is null', () => {
      const ctx = makeCtx({
        isCrit: true,
        playerStats: { automation: null },
      });

      expect(remarkableAthlete.condition(ctx)).toBe(false);
    });

    it('returns false when player has a different passive effect', () => {
      const ctx = makeCtx({
        isCrit: true,
        playerStats: {
          automation: {
            passives: [
              { type: 'auto_effect', effect: 'some_other_effect' },
            ],
          },
        },
      });

      expect(remarkableAthlete.condition(ctx)).toBe(false);
    });

    it('returns true when player has multiple passives including remarkable_athlete_movement', () => {
      const ctx = makeCtx({
        isCrit: true,
        playerStats: {
          automation: {
            passives: [
              { type: 'auto_effect', effect: 'some_other_effect' },
              { type: 'auto_effect', effect: 'remarkable_athlete_movement' },
              { type: 'auto_effect', effect: 'another_effect' },
            ],
          },
        },
      });

      expect(remarkableAthlete.condition(ctx)).toBe(true);
    });
  });

  describe('handler', () => {
    it('sets remarkableAthleteNoOA to true on the runtime store', async () => {
      const ctx = makeCtx();
      const prevData = { formula: '1d8+3', total: 11 };

      await remarkableAthlete.handler(ctx, prevData);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Fighter1',
        'remarkableAthleteNoOA',
        true,
        'test-campaign',
      );
    });

    it('returns { data: prevData }', async () => {
      const ctx = makeCtx();
      const prevData = { formula: '2d6+4', total: 14, rolls: [3, 5, 4] };

      const result = await remarkableAthlete.handler(ctx, prevData);

      expect(result).toEqual({ data: prevData });
    });

    it('returns prevData unchanged', async () => {
      const ctx = makeCtx();
      const prevData = { formula: '1d10+5', total: 15, rolls: [10, 5] };

      const { data } = await remarkableAthlete.handler(ctx, prevData);

      expect(data).toBe(prevData);
    });

    it('works with minimal context', async () => {
      const ctx = makeCtx({
        playerStats: { name: 'Character99' },
      });
      const prevData = {};

      const result = await remarkableAthlete.handler(ctx, prevData);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Character99',
        'remarkableAthleteNoOA',
        true,
        'test-campaign',
      );
      expect(result).toEqual({ data: prevData });
    });
  });
});
