// @cleaned-by-ai
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

    it('passes the action name and pool into the payload', async () => {
      const action = {
        name: 'Divine Smite',
        automation: { pool: 'life_pool' },
      };

      const result = await handle(action, {}, campaignName, mapName);

      expect(result.payload.name).toBe('Divine Smite');
      expect(result.payload.pool).toBe('life_pool');
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
          resourceKey: 'spell_slot',
        }),
        {},
        campaignName,
        mapName,
      );

      expect(result.payload.poolExpression).toBe('level + 2');
      expect(result.payload.isDicePool).toBe(true);
      expect(result.payload.dieType).toBe('d6');
      expect(result.payload.maxDicePerUse).toBe('3');
      expect(result.payload.resourceKey).toBe('spell_slot');
    });

    it('applies defaults for missing optional fields', async () => {
      const result = await handle(makeAction(), {}, campaignName, mapName);

      expect(result.payload.poolExpression).toBeUndefined();
      expect(result.payload.isDicePool).toBeUndefined();
      expect(result.payload.dieType).toBeUndefined();
      expect(result.payload.maxDicePerUse).toBe('');
    });
  });

  describe('default values for missing automation fields', () => {
    it('defaults alsoCures to empty array, cureCost to 5, range/resourceCost to empty strings', async () => {
      const result = await handle(makeAction(), {}, campaignName, mapName);

      expect(result.payload.alsoCures).toEqual([]);
      expect(result.payload.cureCost).toBe(5);
      expect(result.payload.range).toBe('');
      expect(result.payload.resourceCost).toBe('');
    });

    it('uses provided alsoCures, cureCost, range, and resourceCost when truthy', async () => {
      const result = await handle(
        makeAction({
          alsoCures: ['Poisoned', 'Stunned'],
          cureCost: 10,
          range: '30ft',
          resourceCost: 'channel_divinity',
        }),
        {},
        campaignName,
        mapName,
      );

      expect(result.payload.alsoCures).toEqual(['Poisoned', 'Stunned']);
      expect(result.payload.cureCost).toBe(10);
      expect(result.payload.range).toBe('30ft');
      expect(result.payload.resourceCost).toBe('channel_divinity');
    });
  });

  describe('bloodiedOnly coercion', () => {
    it('coerces bloodiedOnly to boolean', async () => {
      const resultTrue = await handle(
        makeAction({ bloodiedOnly: true }),
        {},
        campaignName,
        mapName,
      );
      expect(resultTrue.payload.bloodiedOnly).toBe(true);

      const resultFalse = await handle(
        makeAction({ bloodiedOnly: undefined }),
        {},
        campaignName,
        mapName,
      );
      expect(resultFalse.payload.bloodiedOnly).toBe(false);

      const resultTruthy = await handle(
        makeAction({ bloodiedOnly: 'yes' }),
        {},
        campaignName,
        mapName,
      );
      expect(resultTruthy.payload.bloodiedOnly).toBe(true);

      const resultFalsy = await handle(
        makeAction({ bloodiedOnly: 0 }),
        {},
        campaignName,
        mapName,
      );
      expect(resultFalsy.payload.bloodiedOnly).toBe(false);
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

    it('returns empty array when Restoring Touch is absent or has no cureConditions', async () => {
      // absent feature
      const result1 = await handle(
        makeAction(),
        { characterAdvancement: [{ name: 'Other Feature' }] },
        campaignName,
        mapName,
      );
      expect(result1.payload.restoringTouchConditions).toEqual([]);

      // feature with no automation
      const result2 = await handle(
        makeAction(),
        { characterAdvancement: [{ name: 'Restoring Touch' }] },
        campaignName,
        mapName,
      );
      expect(result2.payload.restoringTouchConditions).toEqual([]);

      // feature with automation but no cureConditions
      const result3 = await handle(
        makeAction(),
        { characterAdvancement: [{ name: 'Restoring Touch', automation: {} }] },
        campaignName,
        mapName,
      );
      expect(result3.payload.restoringTouchConditions).toEqual([]);

      // feature with null automation
      const result4 = await handle(
        makeAction(),
        { characterAdvancement: [{ name: 'Restoring Touch', automation: null }] },
        campaignName,
        mapName,
      );
      expect(result4.payload.restoringTouchConditions).toEqual([]);

      // null/undefined characterAdvancement
      const result5 = await handle(makeAction(), {}, campaignName, mapName);
      expect(result5.payload.restoringTouchConditions).toEqual([]);

      const result6 = await handle(
        makeAction(),
        { characterAdvancement: null },
        campaignName,
        mapName,
      );
      expect(result6.payload.restoringTouchConditions).toEqual([]);
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

  describe('null/empty campaignName and mapName', () => {
    it('does not throw when campaignName and mapName are null or empty strings', async () => {
      const result1 = await handle(makeAction(), {}, null, null);
      expect(result1.type).toBe('modal');

      const result2 = await handle(makeAction(), {}, '', '');
      expect(result2.type).toBe('modal');
    });
  });
});
