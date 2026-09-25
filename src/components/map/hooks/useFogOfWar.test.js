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

  describe('return shape', () => {
    it('returns an object with fog and visible Sets', () => {
      computeVisibility.mockReturnValue(new Set(['1,1']));
      const { result } = renderHook(() =>
        useFogOfWar([{ gridX: 1, gridY: 1 }], new Set(), [], 3, [])
      );
      expect(result.current).toHaveProperty('fog');
      expect(result.current).toHaveProperty('visible');
      expect(result.current.fog).toBeInstanceOf(Set);
      expect(result.current.visible).toBeInstanceOf(Set);
    });
  });

  describe('invalid gridSize', () => {
    it.each([
      [undefined, 'undefined'],
      [null, 'null'],
      [0, 'zero'],
      [-1, 'negative'],
    ])('returns empty fog and visible when gridSize is %s', (gridSize) => {
      const { result } = renderHook(() =>
        useFogOfWar([{ gridX: 1, gridY: 1 }], new Set(), [], gridSize, [])
      );
      expect(result.current.fog.size).toBe(0);
      expect(result.current.visible.size).toBe(0);
      expect(computeVisibility).not.toHaveBeenCalled();
    });
  });

  describe('no players', () => {
    it.each([
      [null, 'null'],
      [[], 'empty array'],
    ])('returns empty visible and full fog when players=%s', (players) => {
      const gridSize = 5;
      const { result } = renderHook(() =>
        useFogOfWar(players, new Set(), [], gridSize, [])
      );
      expect(result.current.visible.size).toBe(0);
      expect(result.current.fog.size).toBe(gridSize * gridSize);
      for (let x = 0; x < gridSize; x++) {
        for (let y = 0; y < gridSize; y++) {
          expect(result.current.fog.has(`${x},${y}`)).toBe(true);
        }
      }
      expect(computeVisibility).not.toHaveBeenCalled();
    });
  });

  describe('fog = all cells - (revealed union visible)', () => {
    it('does not fog cells that are revealed or visible', () => {
      const gridSize = 3;
      const players = [{ gridX: 1, gridY: 1 }];
      computeVisibility.mockReturnValue(new Set(['1,1', '0,0']));

      const { result } = renderHook(() =>
        useFogOfWar(players, new Set(), [], gridSize, ['2,2'])
      );

      expect(result.current.visible.has('1,1')).toBe(true);
      expect(result.current.visible.has('0,0')).toBe(true);
      expect(result.current.fog.has('1,1')).toBe(false);
      expect(result.current.fog.has('0,0')).toBe(false);
      expect(result.current.fog.has('2,2')).toBe(false); // revealed
      expect(result.current.fog.has('2,0')).toBe(true);
      expect(result.current.fog.size).toBe(9 - 3);
    });

    it('keeps revealed cells unfogged even when not in the current line of sight', () => {
      const gridSize = 2;
      const players = [{ gridX: 0, gridY: 0 }];
      computeVisibility.mockReturnValue(new Set(['0,0']));

      const { result } = renderHook(() =>
        useFogOfWar(players, new Set(), [], gridSize, ['1,1'])
      );

      expect(result.current.fog.has('1,1')).toBe(false);
      expect(result.current.fog.has('0,1')).toBe(true);
      expect(result.current.fog.has('1,0')).toBe(true);
      expect(result.current.fog.size).toBe(2);
    });

    it('fogs the entire grid when there are no players and no revealed cells', () => {
      const gridSize = 3;
      const { result } = renderHook(() =>
        useFogOfWar([], new Set(), [], gridSize, [])
      );
      expect(result.current.fog.size).toBe(gridSize * gridSize);
    });
  });

  describe('computeVisibility inputs', () => {
    it('passes the players array and an empty Set for null walls', () => {
      computeVisibility.mockReturnValue(new Set(['2,2']));
      const players = [{ gridX: 2, gridY: 2 }];
      const gridSize = 5;

      renderHook(() => useFogOfWar(players, null, [], gridSize, []));

      expect(computeVisibility).toHaveBeenCalledWith(
        players, new Set(), new Set(), gridSize
      );
    });

    it('passes closed doors from placedItems', () => {
      computeVisibility.mockReturnValue(new Set(['2,2']));
      const players = [{ gridX: 2, gridY: 2 }];
      const walls = new Set(['0,0']);
      const placedItems = [
        { type: 'door', open: false, gridX: 1, gridY: 1 },
        { type: 'door', open: true, gridX: 3, gridY: 3 },
      ];

      renderHook(() => useFogOfWar(players, walls, placedItems, 5, []));

      expect(computeVisibility).toHaveBeenCalledWith(
        players, walls, new Set(['1,1']), 5
      );
    });

    it('adds a hidden secret door cell to the walls', () => {
      computeVisibility.mockReturnValue(new Set(['2,2']));
      const players = [{ gridX: 2, gridY: 2 }];
      const placedItems = [{ type: 'secretDoor', gridX: 1, gridY: 1, visible: false }];

      renderHook(() => useFogOfWar(players, new Set(), placedItems, 5, []));

      expect(computeVisibility).toHaveBeenCalledWith(
        players, new Set(['1,1']), new Set(), 5
      );
    });

    it('excludes a discovered secret door cell from the walls', () => {
      computeVisibility.mockReturnValue(new Set(['2,2']));
      const players = [{ gridX: 2, gridY: 2 }];
      const walls = new Set(['1,1']);
      const placedItems = [{ type: 'secretDoor', gridX: 1, gridY: 1, visible: true }];

      renderHook(() => useFogOfWar(players, walls, placedItems, 5, []));

      expect(computeVisibility).toHaveBeenCalledWith(
        players, new Set(), new Set(), 5
      );
    });

    it('handles placedItems being null', () => {
      computeVisibility.mockReturnValue(new Set(['1,1']));
      const players = [{ gridX: 1, gridY: 1 }];

      renderHook(() => useFogOfWar(players, new Set(), null, 3, []));

      expect(computeVisibility).toHaveBeenCalledWith(
        players, new Set(), new Set(), 3
      );
    });
  });

  describe('memoization', () => {
    it('returns the same result object when inputs do not change', () => {
      computeVisibility.mockReturnValue(new Set(['1,1']));
      const players = [{ gridX: 1, gridY: 1 }];
      const walls = new Set();
      const revealed = ['1,1'];
      const placedItems = [];

      const { result, rerender } = renderHook(
        ({ players, walls, revealed, placedItems, gridSize }) =>
          useFogOfWar(players, walls, placedItems, gridSize, revealed),
        { initialProps: { players, walls, revealed, placedItems, gridSize: 3 } }
      );
      const first = result.current;
      rerender({ players, walls, revealed, placedItems, gridSize: 3 });
      expect(result.current).toBe(first);
    });

    it('returns a new result when revealed changes', () => {
      computeVisibility.mockReturnValue(new Set(['1,1']));
      const players = [{ gridX: 1, gridY: 1 }];
      const walls = new Set();
      const placedItems = [];

      const { result, rerender } = renderHook(
        ({ players, walls, revealed, placedItems, gridSize }) =>
          useFogOfWar(players, walls, placedItems, gridSize, revealed),
        { initialProps: { players, walls, revealed: ['1,1'], placedItems, gridSize: 3 } }
      );
      const first = result.current;
      rerender({ players, walls, revealed: ['1,1', '0,0'], placedItems, gridSize: 3 });
      expect(result.current).not.toBe(first);
    });

    it('returns a new result when players change', () => {
      computeVisibility.mockReturnValue(new Set(['1,1']));
      const walls = new Set();
      const placedItems = [];
      const players1 = [{ gridX: 1, gridY: 1 }];
      const players2 = [{ gridX: 2, gridY: 2 }];

      const { result, rerender } = renderHook(
        ({ players, walls, placedItems, revealed, gridSize }) =>
          useFogOfWar(players, walls, placedItems, gridSize, revealed),
        { initialProps: { players: players1, walls, placedItems, revealed: [], gridSize: 3 } }
      );
      const first = result.current;
      rerender({ players: players2, walls, placedItems, revealed: [], gridSize: 3 });
      expect(result.current).not.toBe(first);
    });
  });
});
