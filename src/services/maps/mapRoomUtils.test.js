// @improved-by-ai
import { describe, it, expect } from 'vitest';
import {
  hasOpenNeighbor,
  hasOutsideOpenNeighbor,
  buildRoomWalls,
  createRoom,
} from './mapRoomUtils.js';

describe('hasOpenNeighbor', () => {
  it('returns true when any in-bounds neighbor is not a wall', () => {
    const walls = new Set(['6,5', '5,4', '5,6']);
    expect(hasOpenNeighbor(walls, 5, 5, 10)).toBe(true);
  });

  it('returns false when all in-bounds neighbors are walls', () => {
    const walls = new Set(['4,5', '6,5', '5,4', '5,6']);
    expect(hasOpenNeighbor(walls, 5, 5, 10)).toBe(false);
  });

  it('returns false when all in-bounds neighbors are walls at grid corner', () => {
    const walls = new Set(['1,0', '0,1']);
    expect(hasOpenNeighbor(walls, 0, 0, 10)).toBe(false);
  });

  it('returns false for a single-cell grid', () => {
    expect(hasOpenNeighbor(new Set(), 0, 0, 1)).toBe(false);
  });

  it('returns false when cell is surrounded by grid boundaries', () => {
    // In a 2x2 grid, cell (0,0) has two in-bounds neighbors
    const walls = new Set(['1,0', '0,1']);
    expect(hasOpenNeighbor(walls, 0, 0, 2)).toBe(false);
  });

  it('does not mutate the walls set', () => {
    const walls = new Set(['1,0']);
    const originalSize = walls.size;
    hasOpenNeighbor(walls, 0, 0, 10);
    expect(walls.size).toBe(originalSize);
  });
});

describe('hasOutsideOpenNeighbor', () => {
  it('returns true when an in-bounds neighbor outside the room is not walled', () => {
    const walls = new Set();
    expect(hasOutsideOpenNeighbor(walls, 1, 1, 1, 3, 1, 3, 10)).toBe(true);
  });

  it('returns false when all in-bounds outside neighbors are walled', () => {
    const walls = new Set(['0,1', '1,0']);
    expect(hasOutsideOpenNeighbor(walls, 1, 1, 1, 3, 1, 3, 10)).toBe(false);
  });

  it('returns false when all outside neighbors are out of grid bounds', () => {
    // Room fills entire 3x3 grid; cell (1,1) has no outside neighbors in grid
    const walls = new Set();
    expect(hasOutsideOpenNeighbor(walls, 1, 1, 0, 2, 0, 2, 3)).toBe(false);
  });

  it('returns false when outside neighbors are beyond grid size', () => {
    // Cell (9,9) on a 10x10 grid has no in-bounds outside neighbors
    const walls = new Set();
    expect(hasOutsideOpenNeighbor(walls, 9, 9, 8, 9, 8, 9, 10)).toBe(false);
  });

  it('ignores neighbors that are inside the room', () => {
    const walls = new Set(['0,1']);
    // Cell (2,1) on room edge: (1,1) and (3,1) are inside the room, only (2,0) is outside
    expect(hasOutsideOpenNeighbor(walls, 2, 1, 1, 3, 1, 3, 10)).toBe(true);
  });

  it('returns false for a corner cell with all outside neighbors walled', () => {
    const walls = new Set(['4,3', '3,4']);
    expect(hasOutsideOpenNeighbor(walls, 3, 3, 1, 3, 1, 3, 10)).toBe(false);
  });

  it('returns false when a single-cell room is fully walled', () => {
    const walls = new Set(['1,0', '0,1']);
    expect(hasOutsideOpenNeighbor(walls, 0, 0, 0, 0, 0, 0, 5)).toBe(false);
  });
});

describe('buildRoomWalls', () => {
  it('clears interior walls and adds boundary walls where all passages are blocked', () => {
    const walls = new Set([
      '3,3', // interior wall to clear
      '1,2', '5,2', '1,3', '5,3', '1,4', '5,4',
      '2,1', '3,1', '4,1', '2,5', '3,5', '4,5',
      '0,0', // distant wall to preserve
    ]);
    const result = buildRoomWalls(walls, 2, 4, 2, 4, 10);
    // Interior cleared
    expect(result.has('3,3')).toBe(false);
    // Boundary cells walled (all passages blocked)
    expect(result.has('2,2')).toBe(true);
    expect(result.has('3,2')).toBe(true);
    expect(result.has('4,2')).toBe(true);
    expect(result.has('2,3')).toBe(true);
    expect(result.has('4,3')).toBe(true);
    expect(result.has('2,4')).toBe(true);
    expect(result.has('3,4')).toBe(true);
    expect(result.has('4,4')).toBe(true);
    // Distant wall preserved
    expect(result.has('0,0')).toBe(true);
  });

  it('leaves boundary cells unwalled when at least one outside passage is open', () => {
    const walls = new Set([
      '1,2', '5,2', '1,3', '5,3', '1,4', '5,4',
      '2,1', '4,1', '2,5', '3,5', '4,5',
    ]);
    const result = buildRoomWalls(walls, 2, 4, 2, 4, 10);
    // (3,2) has open passage at (3,1) → no wall
    expect(result.has('3,2')).toBe(false);
    // (2,2) and (4,2) have no open passage → walls
    expect(result.has('2,2')).toBe(true);
    expect(result.has('4,2')).toBe(true);
  });

  it('does not add walls when all outside passages are open', () => {
    const result = buildRoomWalls(new Set(), 2, 4, 2, 4, 10);
    expect(result.has('2,2')).toBe(false);
    expect(result.has('3,2')).toBe(false);
    expect(result.has('4,2')).toBe(false);
    expect(result.has('2,4')).toBe(false);
    expect(result.has('3,4')).toBe(false);
    expect(result.has('4,4')).toBe(false);
    expect(result.has('2,3')).toBe(false);
    expect(result.has('4,3')).toBe(false);
  });

  it('returns a new set without mutating the input', () => {
    const walls = new Set(['0,0', '2,3', '5,5']);
    const originalSize = walls.size;
    const result = buildRoomWalls(walls, 2, 4, 2, 4, 10);
    expect(walls.size).toBe(originalSize);
    expect(walls.has('2,3')).toBe(true);
    expect(result).not.toBe(walls);
  });

  it('handles a single-cell room with open passages', () => {
    const result = buildRoomWalls(new Set(), 5, 5, 5, 5, 10);
    expect(result.has('5,5')).toBe(false);
  });

  it('walls a single-cell room when all passages are blocked', () => {
    const walls = new Set(['4,5', '6,5', '5,4', '5,6']);
    const result = buildRoomWalls(walls, 5, 5, 5, 5, 10);
    expect(result.has('5,5')).toBe(true);
  });

  it('handles a room at the grid edge with no outside cells on two sides', () => {
    const walls = new Set();
    const result = buildRoomWalls(walls, 0, 2, 0, 2, 5);
    // Top and left edges have no valid outside cells in grid
    expect(result.has('1,0')).toBe(true);
    // Bottom-right corner has open outside neighbors in grid
    expect(result.has('2,2')).toBe(false);
  });

  it('preserves walls outside the room boundary', () => {
    const walls = new Set(['0,0', '9,9', '15,15']);
    const result = buildRoomWalls(walls, 2, 3, 2, 3, 10);
    expect(result.has('0,0')).toBe(true);
    expect(result.has('9,9')).toBe(true);
    expect(result.has('15,15')).toBe(true);
  });
});

describe('createRoom', () => {
  it('returns a room object with correct shape and defaults', () => {
    const room = createRoom(5, 10, 4, 3);
    expect(room).toMatchObject({
      id: expect.any(Number),
      rect: { x: 5, y: 10, w: 4, h: 3 },
      type: 'common',
      label: '',
      connectedTo: [],
    });
  });

  it('assigns a numeric id per call', () => {
    const r1 = createRoom(0, 0, 1, 1);
    const r2 = createRoom(0, 0, 1, 1);
    expect(typeof r1.id).toBe('number');
    expect(typeof r2.id).toBe('number');
    expect(r1.id).toBeGreaterThan(0);
    expect(r2.id).toBeGreaterThan(0);
  });

  it('creates rooms with different dimensions and coordinates', () => {
    const room = createRoom(10, 20, 8, 6);
    expect(room.rect).toEqual({ x: 10, y: 20, w: 8, h: 6 });
  });

  it('creates rooms with zero or negative dimensions', () => {
    const room = createRoom(-3, -2, 0, 0);
    expect(room.rect).toEqual({ x: -3, y: -2, w: 0, h: 0 });
  });
});
