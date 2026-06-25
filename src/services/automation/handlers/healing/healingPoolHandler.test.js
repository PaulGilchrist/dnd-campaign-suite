// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './healingPoolHandler.js';

// ── Helpers ──────────────────────────────────────────────────────

const campaignName = 'TestCampaign';
const mapName = 'TestMap';

function makeAction(overrides = {}) {
  return {
    name: 'Healing Touch',
    automation: {
      pool: 'healing_pool',
      ...overrides,
    },
  };
}

// ── Tests ────────────────────────────────────────────────────────

describe('healingPoolHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('response structure', () => {
    it('returns type "modal" with modalName "healingPool"', async () => {
      const result = await handle(makeAction(), {}, campaignName, mapName);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('healingPool');
    });

    it('passes the action name into the payload', async () => {
      const action = {
        name: 'Divine Smite',
        automation: { pool: 'healing_pool' },
      };

      const result = await handle(action, {}, campaignName, mapName);

      expect(result.payload.name).toBe('Divine Smite');
    });

    it('passes the pool value into the payload', async () => {
      const result = await handle(
        makeAction({ pool: 'life_pool' }),
        {},
        campaignName,
        mapName,
      );

      expect(result.payload.pool).toBe('life_pool');
    });

    it('passes resourceKey into the payload', async () => {
      const result = await handle(
        makeAction({ resourceKey: 'spell_slot' }),
        {},
        campaignName,
        mapName,
      );

      expect(result.payload.resourceKey).toBe('spell_slot');
    });
  });

  describe('automation field passthrough', () => {
    it('passes optional automation fields through to payload', async () => {
      const result = await handle(
        makeAction({
          poolExpression: 'level + 2',
          isDicePool: true,
          dieType: 'd6',
          maxDicePerUse: '3',
        }),
        {},
        campaignName,
        mapName,
      );

      expect(result.payload.poolExpression).toBe('level + 2');
      expect(result.payload.isDicePool).toBe(true);
      expect(result.payload.dieType).toBe('d6');
      expect(result.payload.maxDicePerUse).toBe('3');
    });

    it('applies default empty string for maxDicePerUse when undefined', async () => {
      const result = await handle(
        makeAction({
          poolExpression: undefined,
          isDicePool: undefined,
          dieType: undefined,
          maxDicePerUse: undefined,
        }),
        {},
        campaignName,
        mapName,
      );

      expect(result.payload.poolExpression).toBeUndefined();
      expect(result.payload.isDicePool).toBeUndefined();
      expect(result.payload.dieType).toBeUndefined();
      expect(result.payload.maxDicePerUse).toBe('');
    });
  });

  describe('default values for missing automation fields', () => {
    it('defaults alsoCures to empty array when not provided', async () => {
      const result = await handle(
        makeAction({ alsoCures: undefined }),
        {},
        campaignName,
        mapName,
      );

      expect(result.payload.alsoCures).toEqual([]);
    });

    it('uses provided alsoCures when truthy', async () => {
      const result = await handle(
        makeAction({ alsoCures: ['Poisoned', 'Stunned'] }),
        {},
        campaignName,
        mapName,
      );

      expect(result.payload.alsoCures).toEqual(['Poisoned', 'Stunned']);
    });

    it('defaults cureCost to 5 when not provided', async () => {
      const result = await handle(
        makeAction({ cureCost: undefined }),
        {},
        campaignName,
        mapName,
      );

      expect(result.payload.cureCost).toBe(5);
    });

    it('uses provided cureCost when truthy', async () => {
      const result = await handle(
        makeAction({ cureCost: 10 }),
        {},
        campaignName,
        mapName,
      );

      expect(result.payload.cureCost).toBe(10);
    });

    it('defaults range to empty string when not provided', async () => {
      const result = await handle(
        makeAction({ range: undefined }),
        {},
        campaignName,
        mapName,
      );

      expect(result.payload.range).toBe('');
    });

    it('uses provided range when truthy', async () => {
      const result = await handle(
        makeAction({ range: '30ft' }),
        {},
        campaignName,
        mapName,
      );

      expect(result.payload.range).toBe('30ft');
    });

    it('defaults resourceCost to empty string when not provided', async () => {
      const result = await handle(
        makeAction({ resourceCost: undefined }),
        {},
        campaignName,
        mapName,
      );

      expect(result.payload.resourceCost).toBe('');
    });

    it('uses provided resourceCost when truthy', async () => {
      const result = await handle(
        makeAction({ resourceCost: 'channel_divinity' }),
        {},
        campaignName,
        mapName,
      );

      expect(result.payload.resourceCost).toBe('channel_divinity');
    });

    it('defaults maxDicePerUse to empty string when not provided', async () => {
      const result = await handle(
        makeAction({ maxDicePerUse: undefined }),
        {},
        campaignName,
        mapName,
      );

      expect(result.payload.maxDicePerUse).toBe('');
    });

    it('uses provided maxDicePerUse when truthy', async () => {
      const result = await handle(
        makeAction({ maxDicePerUse: '5' }),
        {},
        campaignName,
        mapName,
      );

      expect(result.payload.maxDicePerUse).toBe('5');
    });
  });

  describe('bloodiedOnly coercion', () => {
    it('coerces bloodiedOnly to boolean true', async () => {
      const result = await handle(
        makeAction({ bloodiedOnly: true }),
        {},
        campaignName,
        mapName,
      );

      expect(result.payload.bloodiedOnly).toBe(true);
    });

    it('coerces bloodiedOnly to boolean false when absent', async () => {
      const result = await handle(
        makeAction({ bloodiedOnly: undefined }),
        {},
        campaignName,
        mapName,
      );

      expect(result.payload.bloodiedOnly).toBe(false);
    });

    it('coerces truthy bloodiedOnly to boolean true', async () => {
      const result = await handle(
        makeAction({ bloodiedOnly: 'yes' }),
        {},
        campaignName,
        mapName,
      );

      expect(result.payload.bloodiedOnly).toBe(true);
    });

    it('coerces falsy bloodiedOnly to boolean false', async () => {
      const result = await handle(
        makeAction({ bloodiedOnly: 0 }),
        {},
        campaignName,
        mapName,
      );

      expect(result.payload.bloodiedOnly).toBe(false);
    });
  });

  describe('restoringTouchConditions from characterAdvancement', () => {
    it('extracts cureConditions when Restoring Touch feature exists', async () => {
      const playerStats = {
        characterAdvancement: [
          {
            name: 'Restoring Touch',
            automation: { cureConditions: ['Bloodied', 'Unconscious'] },
          },
          { name: 'Other Feature' },
        ],
      };

      const result = await handle(
        makeAction(),
        playerStats,
        campaignName,
        mapName,
      );

      expect(result.payload.restoringTouchConditions).toEqual([
        'Bloodied',
        'Unconscious',
      ]);
    });

    it('returns empty array when Restoring Touch is absent', async () => {
      const playerStats = {
        characterAdvancement: [{ name: 'Other Feature' }],
      };

      const result = await handle(
        makeAction(),
        playerStats,
        campaignName,
        mapName,
      );

      expect(result.payload.restoringTouchConditions).toEqual([]);
    });

    it('returns empty array when characterAdvancement is undefined', async () => {
      const result = await handle(
        makeAction(),
        {},
        campaignName,
        mapName,
      );

      expect(result.payload.restoringTouchConditions).toEqual([]);
    });

    it('returns empty array when Restoring Touch has no automation', async () => {
      const playerStats = {
        characterAdvancement: [{ name: 'Restoring Touch' }],
      };

      const result = await handle(
        makeAction(),
        playerStats,
        campaignName,
        mapName,
      );

      expect(result.payload.restoringTouchConditions).toEqual([]);
    });

    it('returns empty array when Restoring Touch automation has no cureConditions', async () => {
      const playerStats = {
        characterAdvancement: [
          { name: 'Restoring Touch', automation: {} },
        ],
      };

      const result = await handle(
        makeAction(),
        playerStats,
        campaignName,
        mapName,
      );

      expect(result.payload.restoringTouchConditions).toEqual([]);
    });

    it('returns empty array when Restoring Touch automation is null', async () => {
      const playerStats = {
        characterAdvancement: [
          { name: 'Restoring Touch', automation: null },
        ],
      };

      const result = await handle(
        makeAction(),
        playerStats,
        campaignName,
        mapName,
      );

      expect(result.payload.restoringTouchConditions).toEqual([]);
    });

    it('returns empty array when characterAdvancement is null', async () => {
      const playerStats = { characterAdvancement: null };

      const result = await handle(
        makeAction(),
        playerStats,
        campaignName,
        mapName,
      );

      expect(result.payload.restoringTouchConditions).toEqual([]);
    });

    it('finds Restoring Touch even when it is not the first feature', async () => {
      const playerStats = {
        characterAdvancement: [
          { name: 'Feature A' },
          { name: 'Feature B' },
          {
            name: 'Restoring Touch',
            automation: { cureConditions: ['Prone'] },
          },
        ],
      };

      const result = await handle(
        makeAction(),
        playerStats,
        campaignName,
        mapName,
      );

      expect(result.payload.restoringTouchConditions).toEqual(['Prone']);
    });
  });

  describe('campaignName and mapName parameters', () => {
    it('does not throw when campaignName and mapName are null', async () => {
      const result = await handle(makeAction(), {}, null, null);

      expect(result.type).toBe('modal');
    });

    it('does not throw when campaignName and mapName are empty strings', async () => {
      const result = await handle(makeAction(), {}, '', '');

      expect(result.type).toBe('modal');
    });
  });
});
