// @improved-by-ai
// @cleaned-by-ai
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useMapLoader from './useMapLoader.js';
import * as mapsService from '../../../services/maps/mapsService.js';
import { DEFAULT_GRID_SIZE } from '../../../config/mapConfig.js';

describe('useMapLoader', () => {
  let loadMapDataSpy;
  let saveMapDataSpy;
  let setGridSizeMock;

  const defaultCampaignName = 'test-campaign';
  const defaultMapName = 'dungeon-floor-1';
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

  const getHook = (options = {}) => {
    const {
      campaignName = defaultCampaignName,
      characters = defaultCharacters,
      mapName = defaultMapName,
      gridSize = DEFAULT_GRID_SIZE,
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

      expect(result.current.mapData).toBeNull();
      expect(typeof result.current.setMapData).toBe('function');
      expect(result.current.placedItems).toEqual([]);
      expect(typeof result.current.setPlacedItems).toBe('function');
      expect(result.current.loadInProgressRef).toHaveProperty('current');
    });

    it('should call loadMapData on mount', async () => {
      getHook();
      await act(() => {});
      expect(loadMapDataSpy).toHaveBeenCalledWith(defaultCampaignName, defaultMapName);
    });

    it('should create and save empty map data when no existing data', async () => {
      getHook();
      await act(() => {});

      expect(saveMapDataSpy).toHaveBeenCalledWith(
        defaultCampaignName,
        defaultMapName,
        expect.objectContaining({
          gridSize: DEFAULT_GRID_SIZE,
          players: [],
          walls: [],
          placedItems: [],
        }),
      );
    });

    it('should set loadInProgressRef to true during load and false after', async () => {
      let resolveLoad;
      loadMapDataSpy.mockImplementation(
        () => new Promise((resolve) => { resolveLoad = () => resolve(null); }),
      );

      const { result } = getHook();
      expect(result.current.loadInProgressRef.current).toBe(true);

      await act(() => { resolveLoad(); });
      expect(result.current.loadInProgressRef.current).toBe(false);
    });
  });

  describe('existing map data', () => {
    function buildExistingData(overrides = {}) {
      return {
        players: [],
        walls: ['1,1-2,1', '2,1-2,2'],
        placedItems: [{ id: 'item1', gridX: 3, gridY: 4 }],
        gridSize: 40,
        ...overrides,
      };
    }

    it('should load existing map data and convert walls to a Set', async () => {
      const existingData = buildExistingData();
      loadMapDataSpy.mockResolvedValue(existingData);

      const { result } = getHook();
      await act(() => {});

      const loaded = result.current.mapData;
      expect(loaded).toEqual({
        ...existingData,
        walls: new Set(existingData.walls),
        revealed: [],
      });
      expect(loaded.walls).toBeInstanceOf(Set);
      expect(Array.from(loaded.walls)).toEqual(existingData.walls);
    });

    it('should set placedItems from existing data', async () => {
      const existingData = buildExistingData({
        walls: [],
        placedItems: [{ id: 'torch1', gridX: 5, gridY: 5 }],
      });
      loadMapDataSpy.mockResolvedValue(existingData);

      const { result } = getHook();
      await act(() => {});

      expect(result.current.placedItems).toEqual(existingData.placedItems);
    });

    it('should call setGridSize with existing gridSize', async () => {
      const existingData = buildExistingData({ walls: [], placedItems: [], gridSize: 50 });
      loadMapDataSpy.mockResolvedValue(existingData);

      getHook();
      await act(() => {});

      expect(setGridSizeMock).toHaveBeenCalledWith(50);
    });

    it('should default to DEFAULT_GRID_SIZE when existing data has no gridSize', async () => {
      const existingData = buildExistingData({ walls: [], placedItems: [], gridSize: null });
      loadMapDataSpy.mockResolvedValue(existingData);

      getHook();
      await act(() => {});

      expect(setGridSizeMock).toHaveBeenCalledWith(DEFAULT_GRID_SIZE);
    });

    it('should set walls to empty Set when existing data has no walls field', async () => {
      const existingData = buildExistingData({ walls: undefined });
      loadMapDataSpy.mockResolvedValue(existingData);

      const { result } = getHook();
      await act(() => {});

      expect(result.current.mapData.walls).toBeInstanceOf(Set);
      expect(Array.from(result.current.mapData.walls)).toEqual([]);
    });

    it('should set placedItems to empty array when existing data has no placedItems field', async () => {
      const existingData = buildExistingData({ walls: [], placedItems: undefined });
      loadMapDataSpy.mockResolvedValue(existingData);

      const { result } = getHook();
      await act(() => {});

      expect(result.current.placedItems).toEqual([]);
    });
  });

  describe('character reconciliation', () => {
    function buildExistingData(overrides = {}) {
      return {
        players: [{ name: 'Thorin' }, { name: 'Elaria' }, { name: 'Grimjaw' }],
        walls: [],
        placedItems: [],
        gridSize: 30,
        ...overrides,
      };
    }

    it('should filter out players no longer in the characters list', async () => {
      loadMapDataSpy.mockResolvedValue(buildExistingData());

      const { result } = getHook();
      await act(() => {});

      const playerNames = result.current.mapData.players.map((p) => p.name);
      expect(playerNames).toEqual(['Thorin', 'Elaria']);
    });

    it('should preserve all players when all characters still exist', async () => {
      loadMapDataSpy.mockResolvedValue(
        buildExistingData({
          players: [{ name: 'Thorin' }, { name: 'Elaria' }],
        }),
      );

      const { result } = getHook();
      await act(() => {});

      const playerNames = result.current.mapData.players.map((p) => p.name);
      expect(playerNames).toEqual(['Thorin', 'Elaria']);
    });

    it('should not reconcile when characters is empty', async () => {
      loadMapDataSpy.mockResolvedValue(
        buildExistingData({
          players: [{ name: 'Thorin' }, { name: 'Elaria' }],
        }),
      );

      const { result } = getHook({ characters: [] });
      await act(() => {});

      const playerNames = result.current.mapData.players.map((p) => p.name);
      expect(playerNames).toEqual(['Thorin', 'Elaria']);
    });

    it('should not reconcile when characters is null', async () => {
      loadMapDataSpy.mockResolvedValue(
        buildExistingData({
          players: [{ name: 'Thorin' }, { name: 'Elaria' }],
        }),
      );

      const { result } = getHook({ characters: null });
      await act(() => {});

      const playerNames = result.current.mapData.players.map((p) => p.name);
      expect(playerNames).toEqual(['Thorin', 'Elaria']);
    });

    it('should not reconcile when characters is undefined', async () => {
      loadMapDataSpy.mockResolvedValue(
        buildExistingData({
          players: [{ name: 'Thorin' }],
        }),
      );

      const { result } = getHook({ characters: undefined });
      await act(() => {});

      const playerNames = result.current.mapData.players.map((p) => p.name);
      expect(playerNames).toEqual(['Thorin']);
    });

    it('should handle existing data with no players field', async () => {
      loadMapDataSpy.mockResolvedValue(
        buildExistingData({ players: undefined }),
      );

      const { result } = getHook();
      await act(() => {});

      expect(result.current.mapData.players).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('should create empty map data and save it when loadMapData throws', async () => {
      loadMapDataSpy.mockRejectedValue(new Error('Network error'));

      const { result } = getHook();
      await act(() => {});

      expect(result.current.mapData.players).toEqual([]);
      expect(result.current.mapData.walls).toBeInstanceOf(Set);
      expect(Array.from(result.current.mapData.walls)).toEqual([]);

      expect(saveMapDataSpy).toHaveBeenCalledWith(
        defaultCampaignName,
        defaultMapName,
        expect.objectContaining({
          players: [],
          walls: [],
        }),
      );
    });

    it('should call console.error when save initial data fails', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      saveMapDataSpy.mockRejectedValue(new Error('Save failed'));

      getHook();
      await act(() => {});

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to save initial map data:',
        expect.any(Error),
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('re-render behavior', () => {
    it('should not reload when mapName is the same', async () => {
      loadMapDataSpy.mockClear();
      loadMapDataSpy.mockResolvedValue({
        players: [],
        walls: [],
        placedItems: [],
        gridSize: 30,
      });

      const { rerender } = renderHook(
        ({ mapName }) =>
          useMapLoader({
            campaignName: defaultCampaignName,
            characters: defaultCharacters,
            mapName,
            gridSize: DEFAULT_GRID_SIZE,
            setGridSize: setGridSizeMock,
          }),
        { initialProps: { mapName: defaultMapName } },
      );

      await act(() => {});
      const firstCallCount = loadMapDataSpy.mock.calls.length;

      rerender({ mapName: defaultMapName });
      await act(() => {});

      expect(loadMapDataSpy.mock.calls.length).toBe(firstCallCount);
    });

    it('should reload when mapName changes', async () => {
      loadMapDataSpy.mockClear();
      loadMapDataSpy.mockResolvedValue({
        players: [],
        walls: [],
        placedItems: [],
        gridSize: 30,
      });

      const { rerender } = renderHook(
        ({ mapName }) =>
          useMapLoader({
            campaignName: defaultCampaignName,
            characters: defaultCharacters,
            mapName,
            gridSize: DEFAULT_GRID_SIZE,
            setGridSize: setGridSizeMock,
          }),
        { initialProps: { mapName: 'map-1' } },
      );

      await act(() => {});
      expect(loadMapDataSpy).toHaveBeenCalledTimes(1);

      rerender({ mapName: 'map-2' });
      await act(() => {});

      expect(loadMapDataSpy).toHaveBeenCalledTimes(2);
    });

    it('should not reconcile characters on re-render when only characters change', async () => {
      loadMapDataSpy.mockResolvedValue({
        players: [{ name: 'Thorin' }, { name: 'Elaria' }, { name: 'Grimjaw' }],
        walls: [],
        placedItems: [],
        gridSize: 30,
      });

      const { result, rerender } = renderHook(
        ({ characters }) =>
          useMapLoader({
            campaignName: defaultCampaignName,
            characters,
            mapName: defaultMapName,
            gridSize: DEFAULT_GRID_SIZE,
            setGridSize: setGridSizeMock,
          }),
        { initialProps: { characters: defaultCharacters } },
      );

      await act(() => {});

      const initialPlayers = result.current.mapData.players.map((p) => p.name);
      expect(initialPlayers).toEqual(['Thorin', 'Elaria']);

      rerender({ characters: [{ name: 'Thorin' }] });
      await act(() => {});

      const players = result.current.mapData.players.map((p) => p.name);
      expect(players).toEqual(['Thorin', 'Elaria']);
    });

    it('should not reload when only characters change but mapName is the same', async () => {
      loadMapDataSpy.mockClear();
      loadMapDataSpy.mockResolvedValue({
        players: [],
        walls: [],
        placedItems: [],
        gridSize: 30,
      });

      const { rerender } = renderHook(
        ({ characters }) =>
          useMapLoader({
            campaignName: defaultCampaignName,
            characters,
            mapName: defaultMapName,
            gridSize: DEFAULT_GRID_SIZE,
            setGridSize: setGridSizeMock,
          }),
        { initialProps: { characters: defaultCharacters } },
      );

      await act(() => {});
      const firstCallCount = loadMapDataSpy.mock.calls.length;

      rerender({ characters: [{ name: 'NewChar', class: 'Rogue' }] });
      await act(() => {});

      expect(loadMapDataSpy.mock.calls.length).toBe(firstCallCount);
    });
  });

  describe('batched autosave', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      loadMapDataSpy.mockResolvedValue({
        players: [], walls: [], placedItems: [], gridSize: 40,
      });
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    const loadAndClearSaves = async (hook) => {
      await act(async () => {});
      act(() => { hook.result.current.flushSave(); });
      saveMapDataSpy.mockClear();
    };

    const paintCells = (hook, keys) => {
      keys.forEach((key, i) => {
        act(() => hook.result.current.setMapData(prev => ({
          ...prev, walls: new Set([...prev.walls, ...keys.slice(0, i + 1)]),
        })));
      });
    };

    it('coalesces many mutations in one stroke into a single save on flush', async () => {
      const { result } = getHook();
      await loadAndClearSaves({ result });

      const keys = Array.from({ length: 10 }, (_, y) => `5,${y}`);
      paintCells({ result }, keys);
      expect(saveMapDataSpy).not.toHaveBeenCalled();

      act(() => { result.current.flushSave(); });
      expect(saveMapDataSpy).toHaveBeenCalledTimes(1);
      expect(saveMapDataSpy.mock.calls[0][2].walls.sort()).toEqual([...keys].sort());

      await act(() => { vi.advanceTimersByTime(1500); });
      expect(saveMapDataSpy).toHaveBeenCalledTimes(1);
    });

    it('debounces to one save when a long stroke pauses, and completes on flush', async () => {
      const { result } = getHook();
      await loadAndClearSaves({ result });

      for (let y = 0; y < 20; y++) {
        act(() => result.current.setMapData(prev => ({
          ...prev, walls: new Set([...prev.walls, `5,${y}`]),
        })));
        await act(() => { vi.advanceTimersByTime(50); });
      }
      expect(saveMapDataSpy).not.toHaveBeenCalled();

      await act(() => { vi.advanceTimersByTime(1000); });
      expect(saveMapDataSpy).toHaveBeenCalledTimes(1);

      act(() => result.current.setMapData(prev => ({
        ...prev, walls: new Set([...prev.walls, '5,20']),
      })));
      act(() => { result.current.flushSave(); });
      expect(saveMapDataSpy).toHaveBeenCalledTimes(2);
      expect(saveMapDataSpy.mock.calls.at(-1)[2].walls).toHaveLength(21);
    });

    it('persists erased cells with the same batching', async () => {
      loadMapDataSpy.mockResolvedValue({
        players: [], walls: ['5,0', '5,1', '5,2'], placedItems: [], gridSize: 40,
      });
      const { result } = getHook();
      await loadAndClearSaves({ result });

      ['5,0', '5,1', '5,2'].forEach(key => {
        act(() => result.current.setMapData(prev => {
          const walls = new Set(prev.walls);
          walls.delete(key);
          return { ...prev, walls };
        }));
      });
      expect(saveMapDataSpy).not.toHaveBeenCalled();

      act(() => { result.current.flushSave(); });
      expect(saveMapDataSpy).toHaveBeenCalledTimes(1);
      expect(saveMapDataSpy.mock.calls[0][2].walls).toEqual([]);
    });

    it('flushes pending stroke data on unmount', async () => {
      const { result, unmount } = getHook();
      await loadAndClearSaves({ result });

      act(() => result.current.setMapData(prev => ({
        ...prev, walls: new Set([...prev.walls, '7,3']),
      })));
      expect(saveMapDataSpy).not.toHaveBeenCalled();

      unmount();
      expect(saveMapDataSpy).toHaveBeenCalledTimes(1);
      expect(saveMapDataSpy.mock.calls[0][2].walls).toEqual(['7,3']);
    });

    it('flushes pending data under the previous map name when map switches', async () => {
      const { result, rerender } = renderHook(
        ({ mapName }) => useMapLoader({
          campaignName: defaultCampaignName,
          characters: defaultCharacters,
          mapName,
          gridSize: DEFAULT_GRID_SIZE,
          setGridSize: setGridSizeMock,
        }),
        { initialProps: { mapName: defaultMapName } },
      );
      await loadAndClearSaves({ result });

      act(() => result.current.setMapData(prev => ({
        ...prev, walls: new Set([...prev.walls, '9,9']),
      })));
      expect(saveMapDataSpy).not.toHaveBeenCalled();

      rerender({ mapName: 'other-map' });
      await act(async () => {});
      expect(saveMapDataSpy).toHaveBeenCalledWith(
        defaultCampaignName, defaultMapName,
        expect.objectContaining({ walls: ['9,9'] }),
      );
    });
  });
});
