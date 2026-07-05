// @cleaned-by-ai
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useFogOfWar from './useFogOfWar.js';

vi.mock('../../../services/maps/lineOfSight.js', () => ({
  computeVisibility: vi.fn(),
}));

import { computeVisibility } from '../../../services/maps/lineOfSight.js';

describe('useFogOfWar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty Set when gridSize is falsy or zero', () => {
    const { result } = renderHook(() =>
      useFogOfWar([], new Set(), [], undefined)
    );
    expect(result.current).toBeInstanceOf(Set);
    expect(result.current.size).toBe(0);
  });

  it.each([
    [null, 5],
    [[], 5],
  ])(
    'should return fog covering entire grid when players=%s and gridSize=%s',
    (players, gridSize) => {
      const { result } = renderHook(() =>
        useFogOfWar(players, new Set(), [], gridSize)
      );
      expect(result.current).toBeInstanceOf(Set);
      expect(result.current.size).toBe(gridSize * gridSize);
    }
  );

  it('should compute visibility with players and pass correct arguments', () => {
    computeVisibility.mockReturnValue(new Set(['2,2']));

    const gridSize = 5;
    const players = [{ gridX: 2, gridY: 2 }];
    const walls = new Set();
    const placedItems = [];

    renderHook(() =>
      useFogOfWar(players, walls, placedItems, gridSize)
    );

    expect(computeVisibility).toHaveBeenCalledWith(
      players,
      walls,
      new Set(),
      gridSize
    );
  });

  it('should pass closed doors as walls to computeVisibility', () => {
    computeVisibility.mockReturnValue(new Set(['2,2']));

    const gridSize = 5;
    const players = [{ gridX: 2, gridY: 2 }];
    const walls = new Set();
    const placedItems = [
      { type: 'door', open: false, gridX: 1, gridY: 1 },
      { type: 'door', open: true, gridX: 3, gridY: 3 },
      { type: 'wall', gridX: 0, gridY: 0 },
    ];

    renderHook(() =>
      useFogOfWar(players, walls, placedItems, gridSize)
    );

    expect(computeVisibility).toHaveBeenCalledWith(
      players,
      walls,
      new Set(['1,1']),
      gridSize
    );
  });

  it('should return fog set for cells not in visible', () => {
    const gridSize = 3;
    const players = [{ gridX: 1, gridY: 1 }];
    const walls = new Set();
    const placedItems = [];

    computeVisibility.mockReturnValue(new Set(['1,1']));

    const { result } = renderHook(() =>
      useFogOfWar(players, walls, placedItems, gridSize)
    );

    expect(result.current).toBeInstanceOf(Set);
    expect(result.current.has('1,1')).toBe(false);
    expect(result.current.has('0,0')).toBe(true);
    expect(result.current.has('2,2')).toBe(true);
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
