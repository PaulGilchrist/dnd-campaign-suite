// @improved-by-ai
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useSSESync from './useSSESync.js';

describe('useSSESync', () => {
  let setGridSize;
  let setMapData;
  let setPlacedItems;

  beforeEach(() => {
    setGridSize = vi.fn();
    setPlacedItems = vi.fn();
    setMapData = vi.fn((fn) => {
      if (typeof fn === 'function') {
        const prev = {
          players: [{ id: 'player1', name: 'Hero' }],
          walls: new Set(['wall1']),
        };
        return fn(prev);
      }
      return fn;
    });
  });

  const getHook = () => {
    const { result } = renderHook(() =>
      useSSESync({
        campaignName: 'test-campaign',
        mapName: 'test-map',
        setGridSize,
        setMapData,
        setPlacedItems,
      })
    );
    return result;
  };

  describe('event validation', () => {
    it('should ignore events with no data', () => {
      const result = getHook();
      act(() => {
        result.current.handleSSEEvent({});
      });
      expect(setGridSize).not.toHaveBeenCalled();
      expect(setMapData).not.toHaveBeenCalled();
      expect(setPlacedItems).not.toHaveBeenCalled();
    });

    it('should ignore events with null data', () => {
      const result = getHook();
      act(() => {
        result.current.handleSSEEvent({ data: null });
      });
      expect(setGridSize).not.toHaveBeenCalled();
      expect(setMapData).not.toHaveBeenCalled();
      expect(setPlacedItems).not.toHaveBeenCalled();
    });

    it('should ignore events with wrong key', () => {
      const result = getHook();
      act(() => {
        result.current.handleSSEEvent({
          key: 'wrong-key',
          data: { gridSize: 5 },
        });
      });
      expect(setGridSize).not.toHaveBeenCalled();
      expect(setMapData).not.toHaveBeenCalled();
      expect(setPlacedItems).not.toHaveBeenCalled();
    });
  });

  describe('handleSSEEvent return value', () => {
    it('should return handleSSEEvent function', () => {
      const result = getHook();
      expect(result.current.handleSSEEvent).toBeDefined();
      expect(typeof result.current.handleSSEEvent).toBe('function');
    });
  });

  describe('gridSize handling', () => {
    it('should update gridSize on correct event', () => {
      const result = getHook();
      act(() => {
        result.current.handleSSEEvent({
          key: 'map-data-test-campaign-test-map',
          data: { gridSize: 10 },
        });
      });
      expect(setGridSize).toHaveBeenCalledWith(10);
    });
  });

  describe('placedItems handling', () => {
    it('should update placedItems on correct event', () => {
      const result = getHook();
      const items = [{ id: 'item1', x: 1, y: 2 }];
      act(() => {
        result.current.handleSSEEvent({
          key: 'map-data-test-campaign-test-map',
          data: { placedItems: items },
        });
      });
      expect(setPlacedItems).toHaveBeenCalledWith(items);
    });
  });

  describe('walls handling', () => {
    const createMapDataCall = () => {
      expect(setMapData).toHaveBeenCalled();
      return setMapData.mock.calls[0][0];
    };

    it('should create Set from walls array', () => {
      const result = getHook();
      act(() => {
        result.current.handleSSEEvent({
          key: 'map-data-test-campaign-test-map',
          data: { walls: ['wallA', 'wallB'] },
        });
      });
      const mapDataCall = createMapDataCall();
      const resultValue = mapDataCall({ players: [], walls: new Set() });
      expect(resultValue.walls instanceof Set).toBe(true);
      expect(resultValue.walls.has('wallA')).toBe(true);
      expect(resultValue.walls.has('wallB')).toBe(true);
    });

    it('should use empty Set when data.walls is undefined', () => {
      const result = getHook();
      act(() => {
        result.current.handleSSEEvent({
          key: 'map-data-test-campaign-test-map',
          data: { gridSize: 5 },
        });
      });
      const mapDataCall = createMapDataCall();
      const prevWalls = new Set(['preservedWall']);
      const resultValue = mapDataCall({ players: [], walls: prevWalls });
      expect(resultValue.walls).toBe(prevWalls);
    });

    it('should replace walls with new Set when data.walls is an empty array', () => {
      const result = getHook();
      act(() => {
        result.current.handleSSEEvent({
          key: 'map-data-test-campaign-test-map',
          data: { walls: [] },
        });
      });
      const mapDataCall = createMapDataCall();
      const resultValue = mapDataCall({ players: [], walls: new Set(['oldWall']) });
      expect(resultValue.walls instanceof Set).toBe(true);
      expect(resultValue.walls.size).toBe(0);
    });

    it('should create Set from walls even when prev walls is undefined', () => {
      const result = getHook();
      act(() => {
        result.current.handleSSEEvent({
          key: 'map-data-test-campaign-test-map',
          data: { walls: ['wall1'] },
        });
      });
      const mapDataCall = createMapDataCall();
      const resultValue = mapDataCall({ players: [] });
      expect(resultValue.walls instanceof Set).toBe(true);
      expect(resultValue.walls.has('wall1')).toBe(true);
    });
  });

  describe('players handling', () => {
    it('should preserve existing players when data.players is undefined', () => {
      const result = getHook();
      act(() => {
        result.current.handleSSEEvent({
          key: 'map-data-test-campaign-test-map',
          data: { gridSize: 5 },
        });
      });
      expect(setMapData).toHaveBeenCalled();
      const mapDataCall = setMapData.mock.calls[0][0];
      const resultValue = mapDataCall({
        players: [{ id: 'existing', name: 'Player' }],
        walls: new Set(),
      });
      expect(resultValue.players).toEqual([{ id: 'existing', name: 'Player' }]);
    });

    it('should use data.players when provided', () => {
      const result = getHook();
      const players = [{ id: 'new', name: 'NewPlayer' }];
      act(() => {
        result.current.handleSSEEvent({
          key: 'map-data-test-campaign-test-map',
          data: { players },
        });
      });
      expect(setMapData).toHaveBeenCalled();
      const mapDataCall = setMapData.mock.calls[0][0];
      const resultValue = mapDataCall({ players: [], walls: new Set() });
      expect(resultValue.players).toEqual([{ id: 'new', name: 'NewPlayer' }]);
    });

    it('should default to empty array when prev players is undefined', () => {
      const result = getHook();
      act(() => {
        result.current.handleSSEEvent({
          key: 'map-data-test-campaign-test-map',
          data: {},
        });
      });
      expect(setMapData).toHaveBeenCalled();
      const mapDataCall = setMapData.mock.calls[0][0];
      const resultValue = mapDataCall({});
      expect(resultValue.players).toEqual([]);
    });
  });

  describe('multiple fields', () => {
    it('should handle gridSize, players, walls, and placedItems in a single event', () => {
      const result = getHook();
      act(() => {
        result.current.handleSSEEvent({
          key: 'map-data-test-campaign-test-map',
          data: {
            gridSize: 15,
            players: [{ id: 'p1' }],
            walls: ['w1'],
            placedItems: [{ id: 'item1' }],
          },
        });
      });
      expect(setGridSize).toHaveBeenCalledWith(15);
      expect(setPlacedItems).toHaveBeenCalledWith([{ id: 'item1' }]);
      expect(setMapData).toHaveBeenCalled();
    });
  });
});
