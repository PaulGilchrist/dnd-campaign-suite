import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useFogOfWar from './useFogOfWar.js';

vi.mock('../../../services/maps/lineOfSight.js', () => ({
  computeVisibility: vi.fn(),
}));

// Import the mocked computeVisibility for assertions
import { computeVisibility } from '../../../services/maps/lineOfSight.js';

describe('useFogOfWar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty Set when gridSize is falsy', () => {
    const { result } = renderHook(() =>
      useFogOfWar([], new Set(), [], undefined)
    );
    expect(result.current).toBeInstanceOf(Set);
    expect(result.current.size).toBe(0);
  });

  it('should return empty Set when gridSize is 0', () => {
    const { result } = renderHook(() =>
      useFogOfWar([], new Set(), [], 0)
    );
    expect(result.current).toBeInstanceOf(Set);
    expect(result.current.size).toBe(0);
  });

  it('should return fog covering entire grid when no players', () => {
    const gridSize = 5;
    const { result } = renderHook(() =>
      useFogOfWar(null, new Set(), [], gridSize)
    );
    expect(result.current).toBeInstanceOf(Set);
    expect(result.current.size).toBe(gridSize * gridSize);
    for (let x = 0; x < gridSize; x++) {
      for (let y = 0; y < gridSize; y++) {
        expect(result.current.has(`${x},${y}`)).toBe(true);
      }
    }
  });

  it('should return fog covering entire grid when players is empty array', () => {
    const gridSize = 3;
    const { result } = renderHook(() =>
      useFogOfWar([], new Set(), [], gridSize)
    );
    expect(result.current).toBeInstanceOf(Set);
    expect(result.current.size).toBe(gridSize * gridSize);
  });

  it('should compute visibility with players when gridSize is provided', () => {
    computeVisibility.mockReturnValue(new Set(['2,2']));

    const gridSize = 5;
    const players = [
      { gridX: 2, gridY: 2 },
    ];
    const walls = new Set();
    const placedItems = [];

    const { result } = renderHook(() =>
      useFogOfWar(players, walls, placedItems, gridSize)
    );

    expect(result.current.size).toBe(24); // 25 - 1 visible
    expect(computeVisibility).toHaveBeenCalledWith(
      players,
      walls,
      new Set(),
      gridSize
    );
  });

  it('should pass walls to computeVisibility', () => {
    computeVisibility.mockReturnValue(new Set(['2,2']));

    const gridSize = 5;
    const players = [{ gridX: 2, gridY: 2 }];
    const walls = new Set(['1,1']);
    const placedItems = [];

    const { result } = renderHook(() =>
      useFogOfWar(players, walls, placedItems, gridSize)
    );

    expect(result.current.size).toBe(24);
    expect(computeVisibility).toHaveBeenCalledWith(
      players,
      walls,
      new Set(),
      gridSize
    );
  });

  it('should pass closed doors to computeVisibility', () => {
    computeVisibility.mockReturnValue(new Set(['2,2']));

    const gridSize = 5;
    const players = [{ gridX: 2, gridY: 2 }];
    const walls = new Set();
    const placedItems = [
      { type: 'door', open: false, gridX: 1, gridY: 1 },
      { type: 'door', open: true, gridX: 3, gridY: 3 },
      { type: 'wall', gridX: 0, gridY: 0 },
    ];

    const { result } = renderHook(() =>
      useFogOfWar(players, walls, placedItems, gridSize)
    );

    expect(result.current.size).toBe(24);
    expect(computeVisibility).toHaveBeenCalledWith(
      players,
      walls,
      new Set(['1,1']),
      gridSize
    );
  });

  it('should handle undefined placedItems', () => {
    computeVisibility.mockReturnValue(new Set(['1,1']));

    const gridSize = 3;
    const players = [{ gridX: 1, gridY: 1 }];
    const walls = new Set();

    const { result } = renderHook(() =>
      useFogOfWar(players, walls, undefined, gridSize)
    );

    expect(result.current.size).toBe(8); // 9 - 1 visible
    expect(computeVisibility).toHaveBeenCalledWith(
      players,
      walls,
      new Set(),
      gridSize
    );
  });

  it('should handle undefined walls', () => {
    computeVisibility.mockReturnValue(new Set(['1,1']));

    const gridSize = 3;
    const players = [{ gridX: 1, gridY: 1 }];
    const placedItems = [];

    const { result } = renderHook(() =>
      useFogOfWar(players, undefined, placedItems, gridSize)
    );

    expect(result.current.size).toBe(8); // 9 - 1 visible
    expect(computeVisibility).toHaveBeenCalledWith(
      players,
      new Set(),
      new Set(),
      gridSize
    );
  });

  it('should return fog set for cells not in visible', () => {
    const gridSize = 3;
    const players = [{ gridX: 1, gridY: 1 }];
    const walls = new Set();
    const placedItems = [];

    // Mock computeVisibility to return only center cell visible
    computeVisibility.mockReturnValue(new Set(['1,1']));

    const { result } = renderHook(() =>
      useFogOfWar(players, walls, placedItems, gridSize)
    );

    expect(result.current).toBeInstanceOf(Set);
    expect(result.current.size).toBe(8); // 9 - 1 visible = 8 fog
    expect(result.current.has('1,1')).toBe(false); // visible cell not in fog
    expect(result.current.has('0,0')).toBe(true); // not visible, in fog
    expect(result.current.has('2,2')).toBe(true); // not visible, in fog
  });

  it('should memoize result when inputs do not change', () => {
    const gridSize = 3;
    const players = [{ gridX: 1, gridY: 1 }];
    const walls = new Set();
    const placedItems = [];

    const { result, rerender } = renderHook(
      ({ players, walls, placedItems, gridSize }) =>
        useFogOfWar(players, walls, placedItems, gridSize),
      { initialProps: { players, walls, placedItems, gridSize } }
    );

    const firstResult = result.current;
    rerender({ players, walls, placedItems, gridSize });
    expect(result.current).toBe(firstResult);
  });

  it('should return new Set when gridSize changes', () => {
    const gridSize = 3;
    const players = [{ gridX: 1, gridY: 1 }];
    const walls = new Set();
    const placedItems = [];

    const { result, rerender } = renderHook(
      ({ players, walls, placedItems, gridSize }) =>
        useFogOfWar(players, walls, placedItems, gridSize),
      { initialProps: { players, walls, placedItems, gridSize } }
    );

    const firstResult = result.current;
    rerender({ players, walls, placedItems, gridSize: 5 });
    expect(result.current).not.toBe(firstResult);
  });
});
