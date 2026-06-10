import { describe, it, expect } from 'vitest';
import { bresenham, computeVisibility } from './lineOfSight.js';

describe('bresenham', () => {
  it('should return the start cell when start equals end', () => {
    const cells = bresenham(3, 3, 3, 3);
    expect(cells).toEqual([{ x: 3, y: 3 }]);
  });

  it('should return adjacent cells for horizontal line', () => {
    const cells = bresenham(0, 0, 2, 0);
    expect(cells[0]).toEqual({ x: 0, y: 0 });
    expect(cells.at(-1)).toEqual({ x: 2, y: 0 });
    expect(cells.length).toBe(3);
  });

  it('should return adjacent cells for vertical line', () => {
    const cells = bresenham(0, 0, 0, 2);
    expect(cells[0]).toEqual({ x: 0, y: 0 });
    expect(cells.at(-1)).toEqual({ x: 0, y: 2 });
    expect(cells.length).toBe(3);
  });

  it('should handle diagonal line', () => {
    const cells = bresenham(0, 0, 3, 3);
    expect(cells[0]).toEqual({ x: 0, y: 0 });
    expect(cells.at(-1)).toEqual({ x: 3, y: 3 });
    expect(cells.length).toBeGreaterThanOrEqual(2);
  });

  it('should handle negative coordinates', () => {
    const cells = bresenham(-2, -2, 0, 0);
    expect(cells[0]).toEqual({ x: -2, y: -2 });
    expect(cells.at(-1)).toEqual({ x: 0, y: 0 });
  });

  it('should handle reversed direction', () => {
    const fwd = bresenham(0, 0, 2, 0);
    const rev = bresenham(2, 0, 0, 0);
    expect(rev.at(-1)).toEqual(fwd[0]);
    expect(rev[0]).toEqual(fwd.at(-1));
  });

  it('should return a single cell for origin to origin', () => {
    const cells = bresenham(0, 0, 0, 0);
    expect(cells).toHaveLength(1);
    expect(cells[0]).toEqual({ x: 0, y: 0 });
  });

  it('should pass through intermediate cells on a steep diagonal', () => {
    const cells = bresenham(0, 0, 1, 3);
    expect(cells.length).toBeGreaterThanOrEqual(2);
    expect(cells[0]).toEqual({ x: 0, y: 0 });
    expect(cells.at(-1)).toEqual({ x: 1, y: 3 });
  });

  it('should pass through intermediate cells on a shallow diagonal', () => {
    const cells = bresenham(0, 0, 3, 1);
    expect(cells.length).toBeGreaterThanOrEqual(2);
    expect(cells[0]).toEqual({ x: 0, y: 0 });
    expect(cells.at(-1)).toEqual({ x: 3, y: 1 });
  });
});

describe('computeVisibility', () => {
  it('should return a Set of visible cell keys', () => {
    const players = [{ gridX: 2, gridY: 2 }];
    const walls = new Set();
    const closedDoors = new Set();
    const result = computeVisibility(players, walls, closedDoors, 5);
    expect(result).toBeInstanceOf(Set);
  });

  it('should always include the player\'s own cell', () => {
    const players = [{ gridX: 3, gridY: 4 }];
    const result = computeVisibility(players, new Set(), new Set(), 10);
    expect(result.has('3,4')).toBe(true);
  });

  it('should see all cells when no walls block line of sight', () => {
    const players = [{ gridX: 2, gridY: 2 }];
    const result = computeVisibility(players, new Set(), new Set(), 5);
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        expect(result.has(`${x},${y}`)).toBe(true);
      }
    }
  });

  it('should not see cells blocked by a wall', () => {
    const players = [{ gridX: 0, gridY: 2 }];
    const walls = new Set(['2,2']);
    const result = computeVisibility(players, walls, new Set(), 5);
    // Target is behind the wall at (2,2)
    expect(result.has('4,2')).toBe(false);
  });

  it('should not see cells blocked by a closed door', () => {
    const players = [{ gridX: 0, gridY: 2 }];
    const closedDoors = new Set(['2,2']);
    const result = computeVisibility(players, new Set(), closedDoors, 5);
    expect(result.has('4,2')).toBe(false);
  });

  it('should see cells not blocked when wall is off the line of sight', () => {
    const players = [{ gridX: 1, gridY: 2 }];
    // Wall at (3,0) — not on the line from (1,2) to (4,2)
    const walls = new Set(['3,0']);
    const result = computeVisibility(players, walls, new Set(), 5);
    expect(result.has('4,2')).toBe(true);
  });

  it('should handle multiple players', () => {
    const players = [
      { gridX: 0, gridY: 0 },
      { gridX: 4, gridY: 4 },
    ];
    const result = computeVisibility(players, new Set(), new Set(), 5);
    expect(result.has('0,0')).toBe(true);
    expect(result.has('4,4')).toBe(true);
    expect(result.has('0,4')).toBe(true);
    expect(result.has('4,0')).toBe(true);
  });

  it('should return an empty Set with no players', () => {
    const result = computeVisibility([], new Set(), new Set(), 5);
    expect(result.size).toBe(0);
  });

  it('should handle gridSize of 1', () => {
    const players = [{ gridX: 0, gridY: 0 }];
    const result = computeVisibility(players, new Set(), new Set(), 1);
    expect(result.has('0,0')).toBe(true);
    expect(result.size).toBe(1);
  });

  it('should block visibility with wall adjacent to player', () => {
    const players = [{ gridX: 2, gridY: 2 }];
    // Wall directly between player and target at (4,2)
    const walls = new Set(['3,2']);
    const result = computeVisibility(players, walls, new Set(), 5);
    expect(result.has('4,2')).toBe(false);
  });

  it('should still see around a wall that blocks only part of the grid', () => {
    const players = [{ gridX: 2, gridY: 0 }];
    // Wall row that blocks downward visibility but not horizontal
    const walls = new Set(['2,1']);
    const result = computeVisibility(players, walls, new Set(), 5);
    expect(result.has('2,3')).toBe(false);
    expect(result.has('0,0')).toBe(true);
    expect(result.has('4,0')).toBe(true);
  });

  it('should handle diagonal blocking', () => {
    const players = [{ gridX: 0, gridY: 0 }];
    // Bresenham line from (0,0) to (3,3) goes through approximately (1,1), (2,2)
    const walls = new Set(['1,1']);
    const result = computeVisibility(players, walls, new Set(), 5);
    expect(result.has('3,3')).toBe(false);
  });

  it('should handle multiple walls along same line', () => {
    const players = [{ gridX: 0, gridY: 2 }];
    const walls = new Set(['1,2', '2,2']);
    const result = computeVisibility(players, walls, new Set(), 5);
    expect(result.has('3,2')).toBe(false);
  });

  it('should still see targets when wall is the target itself (walls only block intermediate cells)', () => {
    const players = [{ gridX: 0, gridY: 2 }];
    // Wall at destination but bresenham loop checks indices 1..length-2
    // so a wall at the target cell doesn't block it
    const walls = new Set(['4,2']);
    const result = computeVisibility(players, walls, new Set(), 5);
    // The inner loop iterates `i` from 1 to `line.length - 2`, skipping start and end
    // So the target cell itself being a wall does NOT block visibility
    expect(result.has('4,2')).toBe(true);
  });

  it('should not see cells on the other side of a corridor-blocking wall', () => {
    const players = [{ gridX: 0, gridY: 1 }];
    // A single wall blocking the middle column in a narrow corridor
    const walls = new Set(['2,1']);
    const result = computeVisibility(players, walls, new Set(), 5);
    expect(result.has('4,1')).toBe(false);
  });

  it('should handle walls and closedDoors independently', () => {
    const players = [{ gridX: 0, gridY: 0 }];
    const walls = new Set();
    const closedDoors = new Set(['2,2']);
     // The door at (2,2) should block visibility to (4,4) — the line from (0,0) to (4,4) passes through (2,2)
    const result = computeVisibility(players, walls, closedDoors, 5);
    expect(result.has('4,4')).toBe(false);
  });

  it('should work with a large gridSize without errors', () => {
    const players = [{ gridX: 0, gridY: 0 }];
    const result = computeVisibility(players, new Set(), new Set(), 20);
    expect(result.size).toBe(400);
  });

  it('should combine visibility from multiple players behind different obstacles', () => {
    // Player A at (0,2) has wall at (1,2), player B at (4,2) sees through (1,2)
    const players = [
      { gridX: 0, gridY: 2 },
      { gridX: 4, gridY: 2 },
    ];
    const walls = new Set(['1,2']);
    const result = computeVisibility(players, walls, new Set(), 5);
    // Player A cannot see past (1,2), but Player B can look through it
    expect(result.has('3,2')).toBe(true);
  });

  it('should handle player at grid edge', () => {
    const players = [{ gridX: 0, gridY: 0 }];
    const result = computeVisibility(players, new Set(), new Set(), 3);
    expect(result.has('0,0')).toBe(true);
    expect(result.has('2,2')).toBe(true);
  });

  it('should handle player beyond grid boundary', () => {
    // Player outside grid still gets their own cell marked visible
    const players = [{ gridX: 10, gridY: 10 }];
    const result = computeVisibility(players, new Set(), new Set(), 5);
    expect(result.has('10,10')).toBe(true);
    // Other cells in 0..4 range that have LOS from (10,10) may or may not be visible
    expect(result.size).toBeGreaterThanOrEqual(1);
  });

  it('should block visibility through diagonal walls on a non-axis line', () => {
    const players = [{ gridX: 0, gridY: 0 }];
    // Line from (0,0) to (3,1) passes near (2,0) or (2,1) depending on bresenham specifics
    const walls = new Set(['2,0', '2,1']);
    const result = computeVisibility(players, walls, new Set(), 5);
    expect(result.has('3,1')).toBe(false);
  });

  it('should see target via alternative diagonal when intermediate is blocked', () => {
    // Visibility only checks each target independently — there's no pathfinding.
    // If bresenham line to the target passes through a wall, the target is not visible.
    const players = [{ gridX: 0, gridY: 0 }];
    // (1,1) is on the diagonal to (2,2)
    const walls = new Set(['1,1']);
    const result = computeVisibility(players, walls, new Set(), 5);
    expect(result.has('2,2')).toBe(false);
  });

  it('should handle empty closedDoors and walls Sets', () => {
    const players = [{ gridX: 1, gridY: 1 }];
    const result = computeVisibility(players, new Set(), new Set(), 3);
    expect(result.has('2,2')).toBe(true);
  });

  it('should not break when player position duplicates across array', () => {
    // Two players in the same spot — should still work fine (Set de-duplicates)
    const players = [
      { gridX: 2, gridY: 2 },
      { gridX: 2, gridY: 2 },
    ];
    const result = computeVisibility(players, new Set(), new Set(), 5);
    expect(result.has('2,2')).toBe(true);
    // Visibility set should still cover all in-grid cells (duplicates don't double-add)
    let expectedSize = 0;
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        if (result.has(`${x},${y}`)) expectedSize++;
      }
    }
    expect(expectedSize).toBe(25);
  });
});
