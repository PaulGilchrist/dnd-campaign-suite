// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(async () => ({})),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
  rangeToFeet: vi.fn(),
}));

vi.mock('../../../maps/mapsService.js', () => ({
  loadMapData: vi.fn(),
}));

import { handle, handleMove } from './naturesSanctuaryHandler.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as logService from '../../../ui/logService.js';
import * as rangeValidation from '../../../rules/combat/rangeValidation.js';
import * as mapsService from '../../../maps/mapsService.js';

const campaignName = 'test-campaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'Druid',
    level: 14,
    class: {
      name: 'Druid',
      class_levels: [{ level: 14, wild_shape: 4 }],
      major: { type: 'Temperate' },
      ...overrides.class,
    },
    ...overrides,
  };
}

function makeAction(overrides = {}) {
  return {
    name: "Nature's Sanctuary",
    description:
      'As a Action, expend Wild Shape to cause spectral trees and vines...',
    automation: {
      type: 'nature_sanctuary',
      range: '120_ft',
      cubeSize: 15,
      duration: '1_minute',
      moveRange: 60,
      movesPerDuration: 1,
      resourceCost: 'wild_shape',
      casting_time: '1 action',
      ...overrides.automation,
    },
    ...overrides,
  };
}

function makeMoveAction(overrides = {}) {
  return {
    name: "Nature's Sanctuary (Move)",
    automation: {
      type: 'nature_sanctuary_move',
      moveRange: 60,
      movesPerDuration: 1,
      ...overrides.automation,
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  rangeValidation.rangeToFeet.mockReturnValue(120);
  mapsService.loadMapData.mockResolvedValue(null);
});

describe("Nature's Sanctuary Handler", () => {
  describe('handle (activation)', () => {
    it('activates sanctuary and returns popup info', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'wildShapeUses') return 3;
        if (key === 'naturesSanctuaryActive') return null;
        return null;
      });

      const action = makeAction();
      const playerStats = makePlayerStats();

      const result = await handle(action, playerStats, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe("Nature's Sanctuary");
      expect(result.payload.automationType).toBe('nature_sanctuary');
      expect(result.payload.description).toContain('activated');
      expect(result.payload.description).toContain('15-foot cube');
      expect(result.payload.description).toContain('Half Cover');
      expect(result.payload.description).toContain('1 minute');
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Druid',
        'wildShapeUses',
        2,
        campaignName,
      );
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Druid',
        'naturesSanctuaryActive',
        true,
        campaignName,
      );
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Druid',
        'naturesSanctuaryResistance',
        'Lightning',
        campaignName,
      );
      expect(expirations.addExpiration).toHaveBeenCalledWith(
        'Druid',
        'Druid',
        [{ type: 'remove_natures_sanctuary' }],
        campaignName,
        10,
      );
      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'Druid',
        abilityName: "Nature's Sanctuary",
        description: 'Druid activated Nature\'s Sanctuary.',
        timestamp: expect.any(Number),
      });
      expect(mapsService.loadMapData).not.toHaveBeenCalled();
    });

    it('returns error when no wild shape uses remain', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'wildShapeUses') return 0;
        return null;
      });

      const action = makeAction();
      const playerStats = makePlayerStats();

      const result = await handle(action, playerStats, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain(
        "No Wild Shape uses remaining",
      );
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(expirations.addExpiration).not.toHaveBeenCalled();
      expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('returns error when sanctuary is already active', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'wildShapeUses') return 3;
        if (key === 'naturesSanctuaryActive') return true;
        return null;
      });

      const action = makeAction();
      const playerStats = makePlayerStats();

      const result = await handle(action, playerStats, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('already active');
      expect(result.payload.description).toContain('Bonus Action');
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(expirations.addExpiration).not.toHaveBeenCalled();
      expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it.each([
      ['Arid', 'Fire'],
      ['Polar', 'Cold'],
      ['Temperate', 'Lightning'],
      ['Tropical', 'Poison'],
    ])(
      'resists %s land type (%s)',
      async (landType, expectedResistance) => {
        useRuntimeState.getRuntimeValue.mockImplementation((player, key) => {
          if (key === 'wildShapeUses') return 3;
          if (key === 'naturesSanctuaryActive') return null;
          return null;
        });

        const action = makeAction();
        const playerStats = makePlayerStats({
          class: { major: { type: landType } },
        });

        await handle(action, playerStats, campaignName, null);

        expect(
          useRuntimeState.setRuntimeValue,
        ).toHaveBeenCalledWith(
          'Druid',
          'naturesSanctuaryResistance',
          expectedResistance,
          campaignName,
        );
      },
    );

    it('sets cube position from map when player is on a map', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'wildShapeUses') return 3;
        if (key === 'naturesSanctuaryActive') return null;
        return null;
      });

      const action = makeAction();
      const playerStats = makePlayerStats();
      const mapName = 'battlefield';

      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: 'Druid', gridX: 10, gridY: 20 }],
      });

      await handle(action, playerStats, campaignName, mapName);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Druid',
        'naturesSanctuaryCubeX',
        10,
        campaignName,
      );
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Druid',
        'naturesSanctuaryCubeY',
        20,
        campaignName,
      );
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Druid',
        'naturesSanctuaryRange',
        120,
        campaignName,
      );
    });

    it('skips cube position when map name is not provided', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'wildShapeUses') return 3;
        if (key === 'naturesSanctuaryActive') return null;
        return null;
      });

      const action = makeAction();
      const playerStats = makePlayerStats();

      await handle(action, playerStats, campaignName, null);

      expect(mapsService.loadMapData).not.toHaveBeenCalled();
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith(
        'Druid',
        'naturesSanctuaryCubeX',
        expect.anything(),
        campaignName,
      );
    });

    it('skips cube position when player is not on the map', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'wildShapeUses') return 3;
        if (key === 'naturesSanctuaryActive') return null;
        return null;
      });

      const action = makeAction();
      const playerStats = makePlayerStats();
      const mapName = 'battlefield';

      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: 'Ally', gridX: 5, gridY: 5 }],
      });

      await handle(action, playerStats, campaignName, mapName);

      expect(mapsService.loadMapData).toHaveBeenCalledWith(
        campaignName,
        mapName,
      );
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith(
        'Druid',
        'naturesSanctuaryCubeX',
        expect.anything(),
        campaignName,
      );
    });

    it('skips cube position when map data is null', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'wildShapeUses') return 3;
        if (key === 'naturesSanctuaryActive') return null;
        return null;
      });

      const action = makeAction();
      const playerStats = makePlayerStats();
      const mapName = 'battlefield';

      mapsService.loadMapData.mockResolvedValue(null);

      await handle(action, playerStats, campaignName, mapName);

      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith(
        'Druid',
        'naturesSanctuaryCubeX',
        expect.anything(),
        campaignName,
      );
    });

    it('handles missing class data gracefully', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'wildShapeUses') return 3;
        if (key === 'naturesSanctuaryActive') return null;
        return null;
      });

      const action = makeAction();
      const playerStats = makePlayerStats({ class: undefined });

      const result = await handle(action, playerStats, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Druid',
        'naturesSanctuaryActive',
        true,
        campaignName,
      );
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith(
        'Druid',
        'naturesSanctuaryResistance',
        expect.anything(),
        campaignName,
      );
    });

    it('falls back to max wild shape when runtime value is null', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'wildShapeUses') return null;
        if (key === 'naturesSanctuaryActive') return null;
        return null;
      });

      const action = makeAction();
      const playerStats = makePlayerStats();

      const result = await handle(action, playerStats, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('activated');
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Druid',
        'wildShapeUses',
        3,
        campaignName,
      );
    });

    it('uses custom range when provided in automation config', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'wildShapeUses') return 3;
        if (key === 'naturesSanctuaryActive') return null;
        return null;
      });

      rangeValidation.rangeToFeet.mockReturnValue(60);

      const action = makeAction({
        automation: { range: '60_ft' },
      });
      const playerStats = makePlayerStats();
      const mapName = 'battlefield';

      mapsService.loadMapData.mockResolvedValue({
        players: [{ name: 'Druid', gridX: 1, gridY: 2 }],
      });

      await handle(action, playerStats, campaignName, mapName);

      expect(rangeValidation.rangeToFeet).toHaveBeenCalledWith('60_ft');
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Druid',
        'naturesSanctuaryRange',
        60,
        campaignName,
      );
    });
  });

  describe('handleMove (bonus action)', () => {
    it('moves sanctuary and decrements moves', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'naturesSanctuaryActive') return true;
        if (key === 'naturesSanctuaryMoves') return 1;
        return null;
      });

      const action = makeMoveAction();
      const playerStats = makePlayerStats();

      const result = await handleMove(action, playerStats, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.automationType).toBe('nature_sanctuary_move');
      expect(result.payload.description).toContain('moved the cube');
      expect(result.payload.description).toContain('0 move');
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Druid',
        'naturesSanctuaryMoves',
        0,
        campaignName,
      );
    });

    it('returns error when sanctuary not active', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'naturesSanctuaryActive') return null;
        return null;
      });

      const action = makeMoveAction();
      const playerStats = makePlayerStats();

      const result = await handleMove(action, playerStats, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('not currently active');
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('returns error when no moves remaining', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'naturesSanctuaryActive') return true;
        if (key === 'naturesSanctuaryMoves') return 0;
        return null;
      });

      const action = makeMoveAction();
      const playerStats = makePlayerStats();

      const result = await handleMove(action, playerStats, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('no moves remaining');
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('falls back to max moves when runtime value is null', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'naturesSanctuaryActive') return true;
        if (key === 'naturesSanctuaryMoves') return null;
        return null;
      });

      const action = makeMoveAction();
      const playerStats = makePlayerStats();

      const result = await handleMove(action, playerStats, campaignName, null);

      expect(result.type).toBe('popup');
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Druid',
        'naturesSanctuaryMoves',
        0,
        campaignName,
      );
    });

    it('uses movesPerDuration from automation config', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'naturesSanctuaryActive') return true;
        if (key === 'naturesSanctuaryMoves') return 2;
        return null;
      });

      const action = makeMoveAction({
        automation: { movesPerDuration: 2 },
      });
      const playerStats = makePlayerStats();

      const result = await handleMove(action, playerStats, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('1 move');
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Druid',
        'naturesSanctuaryMoves',
        1,
        campaignName,
      );
    });

    it('uses custom move range from automation config', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'naturesSanctuaryActive') return true;
        if (key === 'naturesSanctuaryMoves') return 1;
        return null;
      });

      const action = makeMoveAction({
        automation: { moveRange: 30 },
      });
      const playerStats = makePlayerStats();

      const result = await handleMove(action, playerStats, campaignName, null);

      expect(result.payload.description).toContain('30 feet');
    });
  });
});
