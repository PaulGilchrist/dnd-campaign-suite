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
      expect(result.payload.dieType).toBe('d6');
      expect(result.payload.maxDicePerUse).toBe('3');
      expect(result.payload.resourceKey).toBe('spell_slot');
    });
  });

  describe('restoringTouchConditions from characterAdvancement', () => {
    it('extracts cureConditions when Restoring Touch feature exists, returns empty array otherwise', async () => {
      // positive case: feature found with cureConditions
      const playerStats = {
        characterAdvancement: [
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
        { characterAdvancement: [{ name: 'Other Feature' }] },
        { characterAdvancement: [{ name: 'Restoring Touch' }] },
        { characterAdvancement: [{ name: 'Restoring Touch', automation: {} }] },
        { characterAdvancement: [{ name: 'Restoring Touch', automation: null }] },
        {},
        { characterAdvancement: null },
      ];

      for (const stats of negativeCases) {
        result = await handle(makeAction(), stats, campaignName, mapName);
        expect(result.payload.restoringTouchConditions).toEqual([]);
      }
    });
  });
});
