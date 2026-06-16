import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
  evaluateAutoExpression: vi.fn((expr) => {
    if (expr === 'proficiency_bonus') return 3;
    return 0;
  }),
}));

vi.mock('../../../maps/mapsService.js', () => ({
  loadMapData: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
  rangeToFeet: vi.fn((val) => {
    const match = String(val).match(/(\d+)_ft/);
    return match ? parseInt(match[1], 10) : null;
  }),
  getDistanceFeet: vi.fn(() => 15),
}));

import { handle } from './encouragingSongHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/useRuntimeState.js';
import { loadMapData } from '../../../maps/mapsService.js';
import { addEntry } from '../../../ui/logService.js';

describe('encouragingSongHandler', () => {
  const playerStats = {
    name: 'Bard',
    proficiency: 3,
    abilities: [{ name: 'Charisma', score: 16, bonus: 3 }],
    class: { class_levels: [{ level: 1, bardic_die: 6 }] },
  };

  const campaignName = 'test-campaign';

  const defaultAction = {
    name: 'Encouraging Song',
    automation: {
      type: 'heroic_inspiration_buff',
      effect: 'heroic_inspiration',
      action: 'action',
      range: '30_ft',
      uses_expression: 'proficiency_bonus',
      recharge: 'short_or_long_rest',
      casting_time: '1 action',
      buffExpression: 'heroic_inspiration',
      targetsExpression: 'proficiency_bonus',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockImplementation(() => null);
  });

  it('should return popup when no map data available', async () => {
    loadMapData.mockResolvedValue(null);

    const result = await handle(defaultAction, playerStats, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.description).toContain('Could not resolve allies without a map');
  });

  it('should grant inspiration to allies in range on map', async () => {
    loadMapData.mockImplementation(async (campaign, map) => {
      if (map === 'test-map') {
        return {
          players: [
            { name: 'Bard', gridX: 0, gridY: 0 },
            { name: 'Ally1', gridX: 1, gridY: 1 },
            { name: 'Ally2', gridX: 2, gridY: 2 },
          ],
        };
      }
      return null;
    });

    const result = await handle(defaultAction, playerStats, campaignName, 'test-map');

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.description).toContain('Heroic Inspiration');
    expect(result.payload.description).toContain('Ally1');
    expect(result.payload.description).toContain('Ally2');
    expect(setRuntimeValue).toHaveBeenCalledWith('Ally1', 'hasInspiration', true, campaignName);
    expect(setRuntimeValue).toHaveBeenCalledWith('Ally2', 'hasInspiration', true, campaignName);
  });

  it('should skip allies that already have inspiration', async () => {
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (subKey === 'hasInspiration') return true;
      return null;
    });

    loadMapData.mockImplementation(async (campaign, map) => {
      if (map === 'test-map') {
        return {
          players: [
            { name: 'Bard', gridX: 0, gridY: 0 },
            { name: 'Ally1', gridX: 1, gridY: 1 },
          ],
        };
      }
      return null;
    });

    await handle(defaultAction, playerStats, campaignName, 'test-map');

    expect(setRuntimeValue).not.toHaveBeenCalledWith('Ally1', 'hasInspiration', true, campaignName);
  });

  it('should decrement uses when maxUses > 0', async () => {
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (subKey === 'hasInspiration') return false;
      if (subKey === 'encouragingsongUses') return 2;
      return null;
    });

    loadMapData.mockImplementation(async (campaign, map) => {
      if (map === 'test-map') {
        return {
          players: [
            { name: 'Bard', gridX: 0, gridY: 0 },
            { name: 'Ally1', gridX: 1, gridY: 1 },
          ],
        };
      }
      return null;
    });

    await handle(defaultAction, playerStats, campaignName, 'test-map');

    expect(setRuntimeValue).toHaveBeenCalledWith('Bard', 'encouragingsongUses', 1, campaignName);
  });

  it('should return error when no uses remaining', async () => {
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (subKey === 'hasInspiration') return false;
      if (subKey === 'encouragingsongUses') return 0;
      return null;
    });

    loadMapData.mockImplementation(async (campaign, map) => {
      if (map === 'test-map') {
        return {
          players: [
            { name: 'Bard', gridX: 0, gridY: 0 },
            { name: 'Ally1', gridX: 1, gridY: 1 },
          ],
        };
      }
      return null;
    });

    const result = await handle(defaultAction, playerStats, campaignName, 'test-map');

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('cannot be used again');
  });

  it('should call addEntry for logging', async () => {
    loadMapData.mockImplementation(async (campaign, map) => {
      if (map === 'test-map') {
        return {
          players: [
            { name: 'Bard', gridX: 0, gridY: 0 },
            { name: 'Ally1', gridX: 1, gridY: 1 },
          ],
        };
      }
      return null;
    });

    await handle(defaultAction, playerStats, campaignName, 'test-map');

    expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'ability_use',
      characterName: 'Bard',
      abilityName: 'Encouraging Song',
    }));
  });
});
