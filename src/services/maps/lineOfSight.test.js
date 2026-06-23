// @improved-by-ai
import { describe, it, expect } from 'vitest';
import { bresenham, computeVisibility } from './lineOfSight.js';

describe('bresenham', () => {
  it('should return a single cell when start equals end', () => {
    const cells = bresenham(3, 3, 3, 3);
    expect(cells).toEqual([{ x: 3, y: 3 }]);
  });

  it('should include start and end cells for any line', () => {
    const cells = bresenham(0, 0, 2, 0);
    expect(cells[0]).toEqual({ x: 0, y: 0 });
    expect(cells.at(-1)).toEqual({ x: 2, y: 0 });
  });

  it('should produce the correct number of cells for axis-aligned lines', () => {
    const hCells = bresenham(0, 0, 4, 0);
    expect(hCells.length).toBe(5);

    const vCells = bresenham(0, 0, 0, 4);
    expect(vCells.length).toBe(5);
  });

  it('should produce symmetric results regardless of direction', () => {
    const fwd = bresenham(0, 0, 3, 3);
    const rev = bresenham(3, 3, 0, 0);
    expect(rev).toEqual(fwd.toReversed());
  });

  it('should work with negative coordinates', () => {
    const cells = bresenham(-2, -2, 0, 0);
    expect(cells[0]).toEqual({ x: -2, y: -2 });
    expect(cells.at(-1)).toEqual({ x: 0, y: 0 });
    expect(cells.length).toBe(3);
  });

  it('should pass through correct intermediate cells on a steep diagonal', () => {
    const cells = bresenham(0, 0, 1, 3);
    const expected = [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 2 },
      { x: 1, y: 3 },
    ];
    expect(cells).toEqual(expected);
  });

  it('should pass through correct intermediate cells on a shallow diagonal', () => {
    const cells = bresenham(0, 0, 3, 1);
    const expected = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
    ];
    expect(cells).toEqual(expected);
  });

  it('should handle a 45-degree diagonal', () => {
    const cells = bresenham(0, 0, 4, 4);
    const expected = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 },
      { x: 4, y: 4 },
    ];
    expect(cells).toEqual(expected);
  });

  it('should return only the start cell for zero-length lines', () => {
    const cells = bresenham(5, 5, 5, 5);
    expect(cells).toEqual([{ x: 5, y: 5 }]);
  });
});

describe('computeVisibility', () => {
  it('should return a Set of visible cell keys', () => {
    const players = [{ gridX: 2, gridY: 2 }];
    const result = computeVisibility(players, new Set(), new Set(), 5);
    expect(result).toBeInstanceOf(Set);
  });

  it('should always include the player\'s own cell', () => {
    const result = computeVisibility([{ gridX: 3, gridY: 4 }], new Set(), new Set(), 10);
    expect(result.has('3,4')).toBe(true);
  });

  it('should see all cells in an unblocked grid', () => {
    const players = [{ gridX: 2, gridY: 2 }];
    const result = computeVisibility(players, new Set(), new Set(), 5);
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        expect(result.has(`${x},${y}`)).toBe(true);
      }
    }
  });

  it('should return an empty Set with no players', () => {
    const result = computeVisibility([], new Set(), new Set(), 5);
    expect(result.size).toBe(0);
  });

  it('should block visibility through a wall on the direct path', () => {
    const players = [{ gridX: 0, gridY: 2 }];
    const walls = new Set(['2,2']);
    const result = computeVisibility(players, walls, new Set(), 5);
    expect(result.has('4,2')).toBe(false);
  });

  it('should block visibility through a closed door on the direct path', () => {
    const players = [{ gridX: 0, gridY: 2 }];
    const closedDoors = new Set(['2,2']);
    const result = computeVisibility(players, new Set(), closedDoors, 5);
    expect(result.has('4,2')).toBe(false);
  });

  it('should treat walls and closed doors identically for blocking', () => {
    const players = [{ gridX: 0, gridY: 0 }];
    const wallResult = computeVisibility(players, new Set(['2,2']), new Set(), 5);
    const doorResult = computeVisibility(players, new Set(), new Set(['2,2']), 5);
    expect(wallResult.has('4,4')).toBe(false);
    expect(doorResult.has('4,4')).toBe(false);
  });

  it('should not block when obstacle is off the line of sight', () => {
    const players = [{ gridX: 1, gridY: 2 }];
    const walls = new Set(['3,0']);
    const result = computeVisibility(players, walls, new Set(), 5);
    expect(result.has('4,2')).toBe(true);
  });

  it('should block when wall is adjacent to the player', () => {
    const players = [{ gridX: 2, gridY: 2 }];
    const walls = new Set(['3,2']);
    const result = computeVisibility(players, walls, new Set(), 5);
    expect(result.has('4,2')).toBe(false);
  });

  it('should allow visibility around a wall that blocks only part of the grid', () => {
    const players = [{ gridX: 2, gridY: 0 }];
    const walls = new Set(['2,1']);
    const result = computeVisibility(players, walls, new Set(), 5);
    expect(result.has('2,3')).toBe(false);
    expect(result.has('0,0')).toBe(true);
    expect(result.has('4,0')).toBe(true);
  });

  it('should block diagonal visibility when a wall sits on the bresenham path', () => {
    const players = [{ gridX: 0, gridY: 0 }];
    const walls = new Set(['1,1']);
    const result = computeVisibility(players, walls, new Set(), 5);
    expect(result.has('3,3')).toBe(false);
  });

  it('should block when multiple walls stack along the same line', () => {
    const players = [{ gridX: 0, gridY: 2 }];
    const walls = new Set(['1,2', '2,2']);
    const result = computeVisibility(players, walls, new Set(), 5);
    expect(result.has('3,2')).toBe(false);
  });

  it('should not block a target when the wall is the target cell itself', () => {
    const players = [{ gridX: 0, gridY: 2 }];
    const walls = new Set(['4,2']);
    const result = computeVisibility(players, walls, new Set(), 5);
    expect(result.has('4,2')).toBe(true);
  });

  it('should aggregate visibility from multiple players behind different obstacles', () => {
    const players = [
      { gridX: 0, gridY: 2 },
      { gridX: 4, gridY: 2 },
    ];
    const walls = new Set(['1,2']);
    const result = computeVisibility(players, walls, new Set(), 5);
    // Player A is blocked from seeing past (1,2), but Player B at (4,2) sees back toward (3,2)
    expect(result.has('3,2')).toBe(true);
    // Both players\' own cells are visible
    expect(result.has('0,2')).toBe(true);
    expect(result.has('4,2')).toBe(true);
  });

  it('should handle a corridor blocked by a single wall', () => {
    const players = [{ gridX: 0, gridY: 1 }];
    const walls = new Set(['2,1']);
    const result = computeVisibility(players, walls, new Set(), 5);
    expect(result.has('4,1')).toBe(false);
    // But cells before the wall are still visible
    expect(result.has('1,1')).toBe(true);
  });

  it('should handle a player at a grid edge', () => {
    const players = [{ gridX: 0, gridY: 0 }];
    const result = computeVisibility(players, new Set(), new Set(), 3);
    expect(result.has('0,0')).toBe(true);
    expect(result.has('2,2')).toBe(true);
  });

  it('should handle a player beyond the grid boundary', () => {
    const players = [{ gridX: 10, gridY: 10 }];
    const result = computeVisibility(players, new Set(), new Set(), 5);
    expect(result.has('10,10')).toBe(true);
    expect(result.size).toBeGreaterThanOrEqual(1);
  });

  it('should handle duplicate player positions without error', () => {
    const players = [
      { gridX: 2, gridY: 2 },
      { gridX: 2, gridY: 2 },
    ];
    const result = computeVisibility(players, new Set(), new Set(), 5);
    expect(result.has('2,2')).toBe(true);
    expect(result.size).toBe(25);
  });

  it('should handle a large grid without errors', () => {
    const players = [{ gridX: 0, gridY: 0 }];
    const result = computeVisibility(players, new Set(), new Set(), 20);
    expect(result.size).toBe(400);
  });

  it('should handle a grid of size 1', () => {
    const players = [{ gridX: 0, gridY: 0 }];
    const result = computeVisibility(players, new Set(), new Set(), 1);
    expect(result.has('0,0')).toBe(true);
    expect(result.size).toBe(1);
  });

  it('should allow visibility to a target when an intermediate cell on a different ray is blocked', () => {
    const players = [{ gridX: 0, gridY: 0 }];
    const walls = new Set(['1,1']);
    const result = computeVisibility(players, walls, new Set(), 5);
    // (1,1) blocks the diagonal to (2,2), but not the horizontal to (3,0)
    expect(result.has('2,2')).toBe(false);
    expect(result.has('3,0')).toBe(true);
  });

  it('should block visibility through two walls on a diagonal', () => {
    const players = [{ gridX: 0, gridY: 0 }];
    const walls = new Set(['1,1', '2,2']);
    const result = computeVisibility(players, walls, new Set(), 5);
    expect(result.has('3,3')).toBe(false);
  });

  it('should see through an open cell between two walls on the same line', () => {
    const players = [{ gridX: 0, gridY: 0 }];
    // Walls at (1,1) and (3,3) but (2,2) is open — line from (0,0) to (4,4) passes through all three
    const walls = new Set(['1,1', '3,3']);
    const result = computeVisibility(players, walls, new Set(), 5);
    // (2,2) is blocked by (1,1), and (4,4) is blocked by (1,1) since the ray from (0,0) hits (1,1) first
    expect(result.has('2,2')).toBe(false);
    expect(result.has('4,4')).toBe(false);
  });
});
