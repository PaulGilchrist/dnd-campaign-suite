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
      expect(result.payload.resourceKey).toBe('spell_slot');
    });

    it('detects isDicePool from poolExpression matching dice pattern', async () => {
      const result = await handle(
        makeAction({
          poolExpression: '4d12',
        }),
        {},
        campaignName,
        mapName,
      );

      expect(result.payload.isDicePool).toBe(true);
      expect(result.payload.pool).toBe(4);
      expect(result.payload.dieType).toBe(12);
    });

    it('resolves pool scaling from poolExpression', async () => {
      const playerStats = { level: 10 };

      const result = await handle(
        makeAction({
          poolExpression: '4d12',
          scaling: {
            '6': '5d12',
            '12': '6d12',
            '17': '7d12',
          },
        }),
        playerStats,
        campaignName,
        mapName,
      );

      expect(result.payload.isDicePool).toBe(true);
      expect(result.payload.pool).toBe(5);
      expect(result.payload.poolExpression).toBe('5d12');
    });

    it('generates resourceKey from feature name for dice pools', async () => {
      const result = await handle(
        makeAction({
          poolExpression: '4d12',
        }),
        {},
        campaignName,
        mapName,
      );

      expect(result.payload.resourceKey).toBe('healingtouchPool');
    });

    it('does not detect isDicePool when poolExpression is not a dice pattern', async () => {
      const result = await handle(
        makeAction({
          poolExpression: '5 * level',
        }),
        { level: 3 },
        campaignName,
        mapName,
      );

      expect(result.payload.isDicePool).toBe(false);
    });
  });

  describe('restoringTouchConditions from specialActions', () => {
    it('extracts cureConditions when Restoring Touch feature exists, returns empty array otherwise', async () => {
      // positive case: feature found with cureConditions
      const playerStats = {
        specialActions: [
          {
            name: 'Restoring Touch',
            automation: { cureConditions: ['Bloodied', 'Unconscious'] },
          },
          { name: 'Other Feature' },
        ],
      };

      let result = await handle(
        makeAction(),
        playerStats,
        campaignName,
        mapName,
      );

      expect(result.payload.restoringTouchConditions).toEqual([
        'Bloodied',
        'Unconscious',
      ]);

      // negative cases: none of these produce cureConditions
      const negativeCases = [
        { specialActions: [{ name: 'Other Feature' }] },
        { specialActions: [{ name: 'Restoring Touch' }] },
        { specialActions: [{ name: 'Restoring Touch', automation: {} }] },
        { specialActions: [{ name: 'Restoring Touch', automation: null }] },
        {},
        { specialActions: null },
      ];

      for (const stats of negativeCases) {
        result = await handle(makeAction(), stats, campaignName, mapName);
        expect(result.payload.restoringTouchConditions).toEqual([]);
      }
    });
  });
});
