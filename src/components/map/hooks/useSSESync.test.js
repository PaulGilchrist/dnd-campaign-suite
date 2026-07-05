// @cleaned-by-ai
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
    setMapData = vi.fn((updater) => {
      if (typeof updater === 'function') {
        const prev = {
          players: [{ id: 'player1', name: 'Hero' }],
          walls: new Set(['wall1']),
        };
        return updater(prev);
      }
      return updater;
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

  const validEvent = (data = {}) => ({
    key: 'map-data-test-campaign-test-map',
    data,
  });

  describe('event filtering', () => {
    it('should ignore events with no data property', () => {
      const result = getHook();
      act(() => {
        result.current.handleSSEEvent({});
      });
      expect(setGridSize).not.toHaveBeenCalled();
      expect(setMapData).not.toHaveBeenCalled();
      expect(setPlacedItems).not.toHaveBeenCalled();
    });

    it('should ignore events with wrong SSE key', () => {
      const result = getHook();
      act(() => {
        result.current.handleSSEEvent({ key: 'wrong-key', data: { gridSize: 5 } });
      });
      expect(setGridSize).not.toHaveBeenCalled();
      expect(setMapData).not.toHaveBeenCalled();
      expect(setPlacedItems).not.toHaveBeenCalled();
    });
  });

  describe('gridSize', () => {
    it('should call setGridSize with the event value', () => {
      const result = getHook();
      act(() => {
        result.current.handleSSEEvent(validEvent({ gridSize: 10 }));
      });
      expect(setGridSize).toHaveBeenCalledWith(10);
    });
  });

  describe('placedItems', () => {
    it('should call setPlacedItems with the event value', () => {
      const result = getHook();
      const items = [{ id: 'item1', x: 1, y: 2 }];
      act(() => {
        result.current.handleSSEEvent(validEvent({ placedItems: items }));
      });
      expect(setPlacedItems).toHaveBeenCalledWith(items);
    });
  });

  describe('mapData (players and walls)', () => {
    const invokeMapDataUpdater = () => {
      expect(setMapData).toHaveBeenCalled();
      const updater = setMapData.mock.calls[0][0];
      return updater({
        players: [{ id: 'prev', name: 'PrevPlayer' }],
        walls: new Set(['prevWall']),
      });
    };

    it('should convert walls array to Set', () => {
      const result = getHook();
      act(() => {
        result.current.handleSSEEvent(validEvent({ walls: ['wallA', 'wallB'] }));
      });
      const resultValue = invokeMapDataUpdater();
      expect(resultValue.walls instanceof Set).toBe(true);
      expect(resultValue.walls.has('wallA')).toBe(true);
      expect(resultValue.walls.has('wallB')).toBe(true);
    });

    it('should replace walls with empty Set when data.walls is empty array', () => {
      const result = getHook();
      act(() => {
        result.current.handleSSEEvent(validEvent({ walls: [] }));
      });
      const resultValue = invokeMapDataUpdater();
      expect(resultValue.walls instanceof Set).toBe(true);
      expect(resultValue.walls.size).toBe(0);
    });

    it('should keep existing walls when data.walls is absent', () => {
      const result = getHook();
      act(() => {
        result.current.handleSSEEvent(validEvent({ gridSize: 5 }));
      });
      const prevWalls = new Set(['preservedWall']);
      const resultValue = setMapData.mock.calls[0][0]({
        players: [],
        walls: prevWalls,
      });
      expect(resultValue.walls).toBe(prevWalls);
    });

    it('should replace players array when provided', () => {
      const result = getHook();
      const players = [{ id: 'new', name: 'NewPlayer' }];
      act(() => {
        result.current.handleSSEEvent(validEvent({ players }));
      });
      const resultValue = invokeMapDataUpdater();
      expect(resultValue.players).toEqual(players);
    });

    it('should keep existing players when data.players is absent', () => {
      const result = getHook();
      act(() => {
        result.current.handleSSEEvent(validEvent({ gridSize: 5 }));
      });
      const prevPlayers = [{ id: 'existing', name: 'Player' }];
      const resultValue = setMapData.mock.calls[0][0]({
        players: prevPlayers,
        walls: new Set(),
      });
      expect(resultValue.players).toEqual(prevPlayers);
    });
  });

  describe('multi-field events', () => {
    it('should update gridSize, players, walls, and placedItems in a single event', () => {
      const result = getHook();
      act(() => {
        result.current.handleSSEEvent(validEvent({
          gridSize: 15,
          players: [{ id: 'p1' }],
          walls: ['w1'],
          placedItems: [{ id: 'item1' }],
        }));
      });
      expect(setGridSize).toHaveBeenCalledWith(15);
      expect(setPlacedItems).toHaveBeenCalledWith([{ id: 'item1' }]);
      expect(setMapData).toHaveBeenCalled();
    });
  });
});
