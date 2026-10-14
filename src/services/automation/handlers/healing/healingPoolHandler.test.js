import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './healingPoolHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
  addStorageChangeListener: vi.fn(() => () => {}),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';

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

  describe('channel_divinity resourceCost gate', () => {
    const preserveLifeAction = {
      name: 'Preserve Life',
      automation: {
        type: 'healing_pool',
        poolExpression: '5 * cleric_level',
        pool: 85,
        resourceKey: 'preserveLifePool',
        resourceCost: 'channel_divinity',
        bloodiedOnly: true,
      },
    };
    const clericStats = {
      name: 'Divine_Cleric',
      level: 17,
      class: { class_levels: Array.from({ length: 17 }, (_, i) => ({ level: i + 1, channel_divinity: i === 16 ? 3 : undefined })) },
    };

    it('returns the healing pool modal when Channel Divinity charges remain', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'channelDivinityCharges') return 3;
        return null;
      });

      const result = await handle(preserveLifeAction, clericStats, campaignName, mapName);

      expect(result.type).toBe('modal');
      expect(result.payload.resourceCost).toBe('channel_divinity');
    });

    it('refuses with popup and logs when no Channel Divinity charges remain', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'channelDivinityCharges') return 0;
        return null;
      });

      const result = await handle(preserveLifeAction, clericStats, campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('No Channel Divinity charges remaining.');
      expect(logService.addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'ability_use',
          characterName: 'Divine_Cleric',
          abilityName: 'Preserve Life',
        }),
      );
    });

    it('does not gate non-channel-divinity healing_pool features at 0 charges', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'channelDivinityCharges') return 0;
        return null;
      });

      const result = await handle(
        makeAction({ poolExpression: '5 * paladin level', resourceKey: 'layOnHandsPool' }),
        { name: 'ElderPaladin', level: 10 },
        campaignName,
        mapName,
      );

      expect(result.type).toBe('modal');
      expect(result.payload.resourceCost).toBe('');
      expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('defaults charges from class_levels when runtime key is unset', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(null);

      const result = await handle(preserveLifeAction, clericStats, campaignName, mapName);

      expect(result.type).toBe('modal');
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
