// @improved-by-ai
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

  describe('early return for invalid gridSize', () => {
    it.each([
      [undefined, 'undefined'],
      [null, 'null'],
      [0, 'zero'],
      [-1, 'negative'],
    ])('should return empty Set when gridSize is %s', (gridSize) => {
      const { result } = renderHook(() =>
        useFogOfWar([{ gridX: 1, gridY: 1 }], new Set(), [], gridSize)
      );
      expect(result.current).toBeInstanceOf(Set);
      expect(result.current.size).toBe(0);
    });
  });

  describe('no visible players', () => {
    it.each([
      [null, 'null'],
      [[], 'empty array'],
    ])('should return fog covering entire grid when players=%s and gridSize=%s', (players, _label) => {
      const gridSize = 5;
      const { result } = renderHook(() =>
        useFogOfWar(players, new Set(), [], gridSize)
      );
      expect(result.current).toBeInstanceOf(Set);
      expect(result.current.size).toBe(gridSize * gridSize);
      for (let x = 0; x < gridSize; x++) {
        for (let y = 0; y < gridSize; y++) {
          expect(result.current.has(`${x},${y}`)).toBe(true);
        }
      }
    });
  });

  describe('visibility computation', () => {
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

    it('should pass walls Set to computeVisibility when walls is null', () => {
      computeVisibility.mockReturnValue(new Set(['2,2']));

      const gridSize = 5;
      const players = [{ gridX: 2, gridY: 2 }];

      renderHook(() =>
        useFogOfWar(players, null, [], gridSize)
      );

      expect(computeVisibility).toHaveBeenCalledWith(
        players,
        new Set(),
        new Set(),
        gridSize
      );
    });

    it('should pass closed doors from placedItems as walls to computeVisibility', () => {
      computeVisibility.mockReturnValue(new Set(['2,2']));

      const gridSize = 5;
      const players = [{ gridX: 2, gridY: 2 }];
      const walls = new Set(['0,0']);
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

    it('adds a hidden secret door cell to the walls passed to computeVisibility', () => {
      computeVisibility.mockReturnValue(new Set(['2,2']));
      const gridSize = 5;
      const players = [{ gridX: 2, gridY: 2 }];
      const walls = new Set();
      const placedItems = [{ type: 'secretDoor', gridX: 1, gridY: 1, visible: false }];

      renderHook(() => useFogOfWar(players, walls, placedItems, gridSize));

      expect(computeVisibility).toHaveBeenCalledWith(
        players,
        new Set(['1,1']),
        new Set(),
        gridSize
      );
    });

    it('excludes a discovered secret door cell from the walls passed to computeVisibility', () => {
      computeVisibility.mockReturnValue(new Set(['2,2']));
      const gridSize = 5;
      const players = [{ gridX: 2, gridY: 2 }];
      const walls = new Set(['1,1']);
      const placedItems = [{ type: 'secretDoor', gridX: 1, gridY: 1, visible: true }];

      renderHook(() => useFogOfWar(players, walls, placedItems, gridSize));

      expect(computeVisibility).toHaveBeenCalledWith(
        players,
        new Set(),
        new Set(),
        gridSize
      );
    });

    it('should handle placedItems being null', () => {
      computeVisibility.mockReturnValue(new Set(['1,1']));

      const gridSize = 3;
      const players = [{ gridX: 1, gridY: 1 }];

      renderHook(() =>
        useFogOfWar(players, new Set(), null, gridSize)
      );

      expect(computeVisibility).toHaveBeenCalledWith(
        players,
        new Set(),
        new Set(),
        gridSize
      );
    });

    it('should handle multiple players', () => {
      computeVisibility.mockReturnValue(new Set(['0,0', '1,1', '2,2']));

      const gridSize = 3;
      const players = [
        { gridX: 0, gridY: 0 },
        { gridX: 2, gridY: 2 },
      ];

      const { result } = renderHook(() =>
        useFogOfWar(players, new Set(), [], gridSize)
      );

      expect(computeVisibility).toHaveBeenCalledWith(
        players,
        new Set(),
        new Set(),
        gridSize
      );
      expect(result.current.has('0,0')).toBe(false);
      expect(result.current.has('1,1')).toBe(false);
      expect(result.current.has('2,2')).toBe(false);
      expect(result.current.has('0,1')).toBe(true);
    });

  });

  describe('memoization', () => {
    it('should not call computeVisibility again when inputs are stable', () => {
      const gridSize = 3;
      const players = [{ gridX: 1, gridY: 1 }];
      const walls = new Set();
      const placedItems = [];

      const { rerender } = renderHook(
        ({ players, walls, placedItems, gridSize }) =>
          useFogOfWar(players, walls, placedItems, gridSize),
        { initialProps: { players, walls, placedItems, gridSize } }
      );

      expect(computeVisibility).toHaveBeenCalledTimes(1);

      rerender({ players, walls, placedItems, gridSize });
      expect(computeVisibility).toHaveBeenCalledTimes(1);
    });
    it('should return the same Set reference when inputs do not change', () => {
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

    it('should return a new Set when gridSize changes', () => {
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

    it('should return a new Set when players change', () => {
      const gridSize = 3;
      const walls = new Set();
      const placedItems = [];
      const players1 = [{ gridX: 1, gridY: 1 }];
      const players2 = [{ gridX: 2, gridY: 2 }];

      const { result, rerender } = renderHook(
        ({ players, walls, placedItems, gridSize }) =>
          useFogOfWar(players, walls, placedItems, gridSize),
        { initialProps: { players: players1, walls, placedItems, gridSize } }
      );

      const firstResult = result.current;
      rerender({ players: players2, walls, placedItems, gridSize });
      expect(result.current).not.toBe(firstResult);
    });

    it('should return a new Set when walls change', () => {
      const gridSize = 3;
      const players = [{ gridX: 1, gridY: 1 }];
      const placedItems = [];
      const walls1 = new Set();
      const walls2 = new Set(['0,0']);

      const { result, rerender } = renderHook(
        ({ players, walls, placedItems, gridSize }) =>
          useFogOfWar(players, walls, placedItems, gridSize),
        { initialProps: { players, walls: walls1, placedItems, gridSize } }
      );

      const firstResult = result.current;
      rerender({ players, walls: walls2, placedItems, gridSize });
      expect(result.current).not.toBe(firstResult);
    });

    it('should return a new Set when placedItems change', () => {
      const gridSize = 3;
      const players = [{ gridX: 1, gridY: 1 }];
      const walls = new Set();
      const placedItems1 = [];
      const placedItems2 = [{ type: 'door', open: false, gridX: 0, gridY: 0 }];

      const { result, rerender } = renderHook(
        ({ players, walls, placedItems, gridSize }) =>
          useFogOfWar(players, walls, placedItems, gridSize),
        { initialProps: { players, walls, placedItems: placedItems1, gridSize } }
      );

      const firstResult = result.current;
      rerender({ players, walls, placedItems: placedItems2, gridSize });
      expect(result.current).not.toBe(firstResult);
    });
  });
});
