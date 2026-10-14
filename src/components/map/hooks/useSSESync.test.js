import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useSSESync from './useSSESync.js';

describe('useSSESync', () => {
  let setGridSize;
  let setMapData;
  let setPlacedItems;

  beforeEach(() => {
    setGridSize = vi.fn();
    setMapData = vi.fn();
    setPlacedItems = vi.fn();
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

  describe('return value', () => {
    it('should return an object with handleSSEEvent', () => {
      const result = getHook();
      expect(result.current.handleSSEEvent).toBeInstanceOf(Function);
    });
  });

  describe('event filtering', () => {
    it('should ignore null events', () => {
      const result = getHook();
      act(() => {
        result.current.handleSSEEvent(null);
      });
      expect(setGridSize).not.toHaveBeenCalled();
      expect(setMapData).not.toHaveBeenCalled();
      expect(setPlacedItems).not.toHaveBeenCalled();
    });

    it('should ignore events with no data property', () => {
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

    it('should not call setGridSize when value is unchanged', () => {
      const result = getHook();
      act(() => {
        result.current.handleSSEEvent(validEvent({ gridSize: 10 }));
      });
      expect(setGridSize).toHaveBeenCalledTimes(1);

      act(() => {
        result.current.handleSSEEvent(validEvent({ gridSize: 10 }));
      });
      expect(setGridSize).toHaveBeenCalledTimes(1);
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

    it('should not call setPlacedItems when value is unchanged', () => {
      const result = getHook();
      const items = [{ id: 'item1', x: 1, y: 2 }];
      act(() => {
        result.current.handleSSEEvent(validEvent({ placedItems: items }));
      });
      expect(setPlacedItems).toHaveBeenCalledTimes(1);

      act(() => {
        result.current.handleSSEEvent(validEvent({ placedItems: items }));
      });
      expect(setPlacedItems).toHaveBeenCalledTimes(1);
    });
  });

  describe('mapData', () => {
    it('should call setMapData with a function', () => {
      const result = getHook();
      act(() => {
        result.current.handleSSEEvent(validEvent({ walls: ['wallA'] }));
      });
      expect(setMapData).toHaveBeenCalledTimes(1);
      expect(typeof setMapData.mock.calls[0][0]).toBe('function');
    });

    it('should convert walls array to Set', () => {
      const result = getHook();
      act(() => {
        result.current.handleSSEEvent(validEvent({ walls: ['wallA', 'wallB'] }));
      });
      const updaterFn = setMapData.mock.calls[0][0];
      const resultValue = updaterFn({ players: [], walls: new Set() });
      expect(resultValue.walls instanceof Set).toBe(true);
      expect(resultValue.walls.has('wallA')).toBe(true);
      expect(resultValue.walls.has('wallB')).toBe(true);
    });

    it('should replace walls with empty Set when data.walls is empty array', () => {
      const result = getHook();
      act(() => {
        result.current.handleSSEEvent(validEvent({ walls: [] }));
      });
      const updaterFn = setMapData.mock.calls[0][0];
      const resultValue = updaterFn({ players: [], walls: new Set(['existing']) });
      expect(resultValue.walls instanceof Set).toBe(true);
      expect(resultValue.walls.size).toBe(0);
    });

    it('should keep existing walls when data.walls is absent', () => {
      const result = getHook();
      const prevWalls = new Set(['preservedWall']);
      act(() => {
        result.current.handleSSEEvent(validEvent({ gridSize: 5 }));
      });
      const updaterFn = setMapData.mock.calls[0][0];
      const resultValue = updaterFn({ players: [], walls: prevWalls });
      expect(resultValue.walls).toBe(prevWalls);
    });

    it('should replace players array when provided', () => {
      const result = getHook();
      const players = [{ id: 'new', name: 'NewPlayer' }];
      act(() => {
        result.current.handleSSEEvent(validEvent({ players }));
      });
      const updaterFn = setMapData.mock.calls[0][0];
      const resultValue = updaterFn({ players: [], walls: new Set() });
      expect(resultValue.players).toEqual(players);
    });

    it('should keep existing players when data.players is absent', () => {
      const result = getHook();
      const prevPlayers = [{ id: 'existing', name: 'Player' }];
      act(() => {
        result.current.handleSSEEvent(validEvent({ gridSize: 5 }));
      });
      const updaterFn = setMapData.mock.calls[0][0];
      const resultValue = updaterFn({ players: prevPlayers, walls: new Set() });
      expect(resultValue.players).toEqual(prevPlayers);
    });

    it('should use empty array for players when data.players is null and no previous state', () => {
      const result = getHook();
      act(() => {
        result.current.handleSSEEvent(validEvent({ players: null }));
      });
      const updaterFn = setMapData.mock.calls[0][0];
      const resultValue = updaterFn(undefined);
      expect(resultValue.players).toEqual([]);
    });

    it('should use empty array when data.players is empty array', () => {
      const result = getHook();
      act(() => {
        result.current.handleSSEEvent(validEvent({ players: [] }));
      });
      const updaterFn = setMapData.mock.calls[0][0];
      const resultValue = updaterFn({ players: [{ id: 'existing' }], walls: new Set() });
      expect(resultValue.players).toEqual([]);
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
      const updaterFn = setMapData.mock.calls[0][0];
      const resultValue = updaterFn({ players: [], walls: new Set() });
      expect(resultValue.players).toEqual([{ id: 'p1' }]);
      expect(resultValue.walls.has('w1')).toBe(true);
    });
  });
});
