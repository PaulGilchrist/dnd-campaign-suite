import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useSSESync from './useSSESync.js';

describe('useSSESync', () => {
  let setGridSize;
  let setMapData;
  let setPlacedItems;

  beforeEach(() => {
    setGridSize = vi.fn();
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

  it('should return handleSSEEvent function', () => {
    const result = getHook();
    expect(result.current.handleSSEEvent).toBeDefined();
    expect(typeof result.current.handleSSEEvent).toBe('function');
  });

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

  it('should handle correct key with gridSize', () => {
    const result = getHook();
    act(() => {
      result.current.handleSSEEvent({
        key: 'map-data-test-campaign-test-map',
        data: { gridSize: 10 },
      });
    });
    expect(setGridSize).toHaveBeenCalledWith(10);
  });

  it('should handle correct key with placedItems', () => {
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

  it('should handle correct key with walls', () => {
    const result = getHook();
    act(() => {
      result.current.handleSSEEvent({
        key: 'map-data-test-campaign-test-map',
        data: { walls: ['wallA', 'wallB'] },
      });
    });
    expect(setMapData).toHaveBeenCalled();
    const mapDataCall = setMapData.mock.calls[0][0];
    const resultValue = mapDataCall({ players: [], walls: new Set() });
    expect(resultValue.walls instanceof Set).toBe(true);
    expect(resultValue.walls.has('wallA')).toBe(true);
    expect(resultValue.walls.has('wallB')).toBe(true);
  });

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

  it('should handle empty walls array', () => {
    const result = getHook();
    act(() => {
      result.current.handleSSEEvent({
        key: 'map-data-test-campaign-test-map',
        data: { walls: [] },
      });
    });
    expect(setMapData).toHaveBeenCalled();
    const mapDataCall = setMapData.mock.calls[0][0];
    const resultValue = mapDataCall({ players: [], walls: new Set(['oldWall']) });
    expect(resultValue.walls instanceof Set).toBe(true);
    expect(resultValue.walls.size).toBe(0);
  });

  it('should use prev walls when data.walls is undefined', () => {
    const result = getHook();
    act(() => {
      result.current.handleSSEEvent({
        key: 'map-data-test-campaign-test-map',
        data: { gridSize: 5 },
      });
    });
    expect(setMapData).toHaveBeenCalled();
    const mapDataCall = setMapData.mock.calls[0][0];
    const prevWalls = new Set(['preservedWall']);
    const resultValue = mapDataCall({ players: [], walls: prevWalls });
    expect(resultValue.walls).toBe(prevWalls);
  });

  it('should handle all fields at once', () => {
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

  it('should create Set from walls even when prev walls is undefined', () => {
    const result = getHook();
    act(() => {
      result.current.handleSSEEvent({
        key: 'map-data-test-campaign-test-map',
        data: { walls: ['wall1'] },
      });
    });
    expect(setMapData).toHaveBeenCalled();
    const mapDataCall = setMapData.mock.calls[0][0];
    const resultValue = mapDataCall({ players: [] });
    expect(resultValue.walls instanceof Set).toBe(true);
    expect(resultValue.walls.has('wall1')).toBe(true);
  });

  it('should handle undefined prev players gracefully', () => {
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
    expect(Array.isArray(resultValue.players)).toBe(true);
  });
});
