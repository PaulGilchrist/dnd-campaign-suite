import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useMapLoader from './useMapLoader.js';
import * as mapsService from '../../../services/maps/mapsService.js';
import * as mapConfig from '../../../config/mapConfig.js';

describe('useMapLoader', () => {
  let loadMapDataSpy;
  let saveMapDataSpy;
  let setGridSizeMock;

  const defaultCampaignName = 'test-campaign';
  const defaultMapName = 'dungeon-floor-1';
  const defaultGridSize = mapConfig.DEFAULT_GRID_SIZE;

  const defaultCharacters = [
    { name: 'Thorin', class: 'Fighter' },
    { name: 'Elaria', class: 'Wizard' },
  ];

  beforeEach(() => {
    loadMapDataSpy = vi.spyOn(mapsService, 'loadMapData');
    saveMapDataSpy = vi.spyOn(mapsService, 'saveMapData');
    setGridSizeMock = vi.fn();

    loadMapDataSpy.mockResolvedValue(null);
    saveMapDataSpy.mockResolvedValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const getHook = (options = {}) => {
    const {
      campaignName = defaultCampaignName,
      characters = defaultCharacters,
      mapName = defaultMapName,
      gridSize = defaultGridSize,
      setGridSize = setGridSizeMock,
    } = options;

    return renderHook(
      () =>
        useMapLoader({ campaignName, characters, mapName, gridSize, setGridSize }),
    );
  };

  describe('initialization', () => {
    it('should return mapData, setMapData, placedItems, setPlacedItems, and loadInProgressRef', () => {
      const { result } = getHook();

      expect(result.current).toHaveProperty('mapData');
      expect(result.current).toHaveProperty('setMapData');
      expect(result.current).toHaveProperty('placedItems');
      expect(result.current).toHaveProperty('setPlacedItems');
      expect(result.current).toHaveProperty('loadInProgressRef');
    });

    it('should initialize mapData to null', () => {
      const { result } = getHook();
      expect(result.current.mapData).toBeNull();
    });

    it('should initialize placedItems to empty array', () => {
      const { result } = getHook();
      expect(result.current.placedItems).toEqual([]);
    });

    it('should call loadMapData on mount', async () => {
      getHook();
      await act(async () => {});
      expect(loadMapDataSpy).toHaveBeenCalledWith(defaultCampaignName, defaultMapName);
    });

    it('should save initial empty map data when no existing data', async () => {
      getHook();
      await act(async () => {});
      expect(saveMapDataSpy).toHaveBeenCalled();
      const saveCallArgs = saveMapDataSpy.mock.calls[0];
      expect(saveCallArgs[0]).toBe(defaultCampaignName);
      expect(saveCallArgs[1]).toBe(defaultMapName);
      expect(saveCallArgs[2]).toHaveProperty('players', []);
      expect(saveCallArgs[2]).toHaveProperty('walls', []);
      expect(saveCallArgs[2]).toHaveProperty('rooms', []);
      expect(saveCallArgs[2]).toHaveProperty('placedItems', []);
      expect(saveCallArgs[2]).toHaveProperty('gridSize', defaultGridSize);
    });

    it('should not call setGridSize when no existing data (uses prop gridSize)', async () => {
      getHook();
      await act(async () => {});
      expect(setGridSizeMock).not.toHaveBeenCalled();
    });
  });

  describe('existing map data', () => {
    it('should load existing map data when available', async () => {
      const existingData = {
        players: [{ name: 'Thorin', gridX: 1, gridY: 2 }],
        walls: ['1,1-2,1', '2,1-2,2'],
        rooms: [{ id: 'room1', name: 'Hall' }],
        placedItems: [{ id: 'item1', gridX: 3, gridY: 4 }],
        gridSize: 40,
      };
      loadMapDataSpy.mockResolvedValue(existingData);

      const { result } = getHook();
      await act(async () => {});

      expect(result.current.mapData).toEqual({
        ...existingData,
        walls: new Set(existingData.walls),
      });
    });

    it('should load existing map data with no walls', async () => {
      const existingData = {
        players: [{ name: 'Thorin' }],
        rooms: [],
        placedItems: [],
        gridSize: 30,
      };
      loadMapDataSpy.mockResolvedValue(existingData);

      const { result } = getHook();
      await act(async () => {});

      expect(result.current.mapData).toEqual({
        ...existingData,
        walls: new Set(),
      });
    });

    it('should set placedItems from existing data', async () => {
      const existingData = {
        players: [],
        walls: [],
        rooms: [],
        placedItems: [{ id: 'torch1', gridX: 5, gridY: 5 }],
        gridSize: 30,
      };
      loadMapDataSpy.mockResolvedValue(existingData);

      const { result } = getHook();
      await act(async () => {});

      expect(result.current.placedItems).toEqual(existingData.placedItems);
    });

    it('should set gridSize from existing data', async () => {
      const existingData = {
        players: [],
        walls: [],
        rooms: [],
        placedItems: [],
        gridSize: 50,
      };
      loadMapDataSpy.mockResolvedValue(existingData);

      getHook();
      await act(async () => {});

      expect(setGridSizeMock).toHaveBeenCalledWith(50);
    });

    it('should set gridSize to DEFAULT_GRID_SIZE when existing data has no gridSize', async () => {
      const existingData = {
        players: [],
        walls: [],
        rooms: [],
        placedItems: [],
      };
      loadMapDataSpy.mockResolvedValue(existingData);

      getHook();
      await act(async () => {});

      expect(setGridSizeMock).toHaveBeenCalledWith(mapConfig.DEFAULT_GRID_SIZE);
    });
  });

  describe('character reconciliation', () => {
    it('should filter out players that are no longer in the characters list', async () => {
      const existingData = {
        players: [
          { name: 'Thorin' },
          { name: 'Elaria' },
          { name: 'Grimjaw' },
        ],
        walls: [],
        rooms: [],
        placedItems: [],
        gridSize: 30,
      };
      loadMapDataSpy.mockResolvedValue(existingData);

      const { result } = getHook();
      await act(async () => {});

      expect(result.current.mapData.players).toEqual([
        { name: 'Thorin' },
        { name: 'Elaria' },
      ]);
    });

    it('should not modify players list when all characters still exist', async () => {
      const existingData = {
        players: [
          { name: 'Thorin' },
          { name: 'Elaria' },
        ],
        walls: [],
        rooms: [],
        placedItems: [],
        gridSize: 30,
      };
      loadMapDataSpy.mockResolvedValue(existingData);

      const { result } = getHook();
      await act(async () => {});

      expect(result.current.mapData.players).toEqual(existingData.players);
    });

    it('should not reconcile when characters is empty', async () => {
      const existingData = {
        players: [{ name: 'Thorin' }, { name: 'Elaria' }],
        walls: [],
        rooms: [],
        placedItems: [],
        gridSize: 30,
      };
      loadMapDataSpy.mockResolvedValue(existingData);

      const { result } = getHook({ characters: [] });
      await act(async () => {});

      expect(result.current.mapData.players).toEqual(existingData.players);
    });

    it('should not reconcile when characters is null', async () => {
      const existingData = {
        players: [{ name: 'Thorin' }, { name: 'Elaria' }],
        walls: [],
        rooms: [],
        placedItems: [],
        gridSize: 30,
      };
      loadMapDataSpy.mockResolvedValue(existingData);

      const { result } = getHook({ characters: null });
      await act(async () => {});

      expect(result.current.mapData.players).toEqual(existingData.players);
    });
  });

  describe('error handling', () => {
    it('should create empty map data when loadMapData throws', async () => {
      loadMapDataSpy.mockRejectedValue(new Error('Network error'));

      const { result } = getHook();
      await act(async () => {});

      expect(result.current.mapData).toEqual({
        players: [],
        walls: new Set(),
        rooms: [],
      });
    });

    it('should call console.error when save initial data fails', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      loadMapDataSpy.mockRejectedValue(new Error('Network error'));
      saveMapDataSpy.mockRejectedValue(new Error('Save failed'));

      getHook();
      await act(async () => {});

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to save initial map data:',
        expect.any(Error),
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('re-render behavior', () => {
    it('should not reload when mapName is the same', async () => {
      loadMapDataSpy.mockResolvedValue({
        players: [],
        walls: [],
        rooms: [],
        placedItems: [],
        gridSize: 30,
      });

      const { rerender } = renderHook(
        ({ mapName }) =>
          useMapLoader({
            campaignName: defaultCampaignName,
            characters: defaultCharacters,
            mapName,
            gridSize: defaultGridSize,
            setGridSize: setGridSizeMock,
          }),
        { initialProps: { mapName: defaultMapName } },
      );

      await act(async () => {});
      const firstCallCount = loadMapDataSpy.mock.calls.length;

      rerender({ mapName: defaultMapName });
      await act(async () => {});

      expect(loadMapDataSpy.mock.calls.length).toBe(firstCallCount);
    });

    it('should reload when mapName changes', async () => {
      loadMapDataSpy.mockResolvedValue({
        players: [],
        walls: [],
        rooms: [],
        placedItems: [],
        gridSize: 30,
      });

      const { rerender } = renderHook(
        ({ mapName }) =>
          useMapLoader({
            campaignName: defaultCampaignName,
            characters: defaultCharacters,
            mapName,
            gridSize: defaultGridSize,
            setGridSize: setGridSizeMock,
          }),
        { initialProps: { mapName: 'map-1' } },
      );

      await act(async () => {});
      expect(loadMapDataSpy).toHaveBeenCalledTimes(1);

      rerender({ mapName: 'map-2' });
      await act(async () => {});

      expect(loadMapDataSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('return values', () => {
    it('should return setMapData as a function', () => {
      const { result } = getHook();
      expect(typeof result.current.setMapData).toBe('function');
    });

    it('should return setPlacedItems as a function', () => {
      const { result } = getHook();
      expect(typeof result.current.setPlacedItems).toBe('function');
    });

    it('should return loadInProgressRef as a ref object with current property', () => {
      const { result } = getHook();
      expect(result.current.loadInProgressRef).toHaveProperty('current');
    });

    it('should have loadInProgressRef.current as false after load completes', async () => {
      const { result } = getHook();
      await act(async () => {});
      expect(result.current.loadInProgressRef.current).toBe(false);
    });
  });
});
