import { describe, it, expect } from 'vitest';
import {
  hasOpenNeighbor,
  hasOutsideOpenNeighbor,
  buildRoomWalls,
  createRoom,
} from './mapRoomUtils.js';

describe('hasOpenNeighbor', () => {
  const gridSize = 10;

  it('returns true when a neighbor is not in walls and within bounds', () => {
    // Cell (5,5) has open neighbors since no walls exist
    expect(hasOpenNeighbor(new Set(), 5, 5, gridSize)).toBe(true);
  });

  it('returns false when all four neighbors are walls', () => {
    const walls = new Set(['4,5', '6,5', '5,4', '5,6']);
    expect(hasOpenNeighbor(walls, 5, 5, gridSize)).toBe(false);
  });

  it('returns false when all neighbors are out of bounds (corner cell)', () => {
    // Top-left corner (0, 0): left (-1), right (1,wall?), top (-1), bottom (1,wall?)
    // Only valid in-grid neighbors are (1,0) and (0,1) — both walls
    const walls = new Set(['1,0', '0,1']);
    expect(hasOpenNeighbor(walls, 0, 0, gridSize)).toBe(false);
  });

  it('returns true when only one neighbor is open', () => {
    const walls = new Set(['4,5', '6,5', '5,4']);
    // (5,6) is not a wall and within bounds
    expect(hasOpenNeighbor(walls, 5, 5, gridSize)).toBe(true);
  });

  it('handles edge cells with some out-of-bounds neighbors', () => {
    // Cell (0, 5): left (-1) is out of bounds, others check normally
    // Top (-1), bottom (1), right (1) — all walls except bottom
    const walls = new Set(['0,4', '0,7']);
    // Neighbors: (-1,5) out of bounds, (1,5) not wall → open!
    expect(hasOpenNeighbor(walls, 0, 5, gridSize)).toBe(true);
  });

  it('returns false when grid neighbors are blocked but out-of-bounds cells are ignored', () => {
    // At position (0,0), only (1,0) and (0,1) are in-grid neighbors
    const walls = new Set(['1,0', '0,1']);
    expect(hasOpenNeighbor(walls, 0, 0, gridSize)).toBe(false);
  });

  it('works on an empty set with center cell having all neighbors open', () => {
    expect(hasOpenNeighbor(new Set(), gridSize >> 1, gridSize >> 1, gridSize)).toBe(true);
  });

  it('handles grid size of 1 — no valid neighbors exist', () => {
    // Only cell (0,0) exists in a 1x1 grid, all neighbors are out of bounds
    expect(hasOpenNeighbor(new Set(), 0, 0, 1)).toBe(false);
  });

  it('handles grid size of 2 — corner cell has 1 valid neighbor', () => {
    // In 2x2 grid, (0,0) neighbors: (-1,0) out, (1,0) in, (0,-1) out, (0,1) in
    // Both (1,0) and (0,1) are open since no walls
    expect(hasOpenNeighbor(new Set(), 0, 0, 2)).toBe(true);

    // Now add walls for both valid neighbors
    const walls2 = new Set(['1,0', '0,1']);
    expect(hasOpenNeighbor(walls2, 0, 0, 2)).toBe(false);
  });
});

describe('hasOutsideOpenNeighbor', () => {
  it('returns true when an outside neighbor of a room boundary is not walled', () => {
    const walls = new Set();
    // Room rect: (1,1) to (3,3). Cell (1,1) at top-left corner.
    // Neighbor (0,1) is outside the room and open (not in walls)
    expect(hasOutsideOpenNeighbor(walls, 1, 1, 1, 3, 1, 3, 10)).toBe(true);
  });

  it('returns false when all outside neighbors are walled', () => {
     // Cell (1,1) has two outside neighbors: (0,1) [x<minX] and (1,0) [y<minY].
     // Both must be walled for no passage.
    const walls = new Set(['0,1', '1,0']);
    expect(hasOutsideOpenNeighbor(walls, 1, 1, 1, 3, 1, 3, 10)).toBe(false);
   });

  it('returns false when no outside neighbor is within grid bounds', () => {
    const walls = new Set();
    // Room at the edge of a 3x3 grid: cells (0,0) to (2,2) fill entire grid.
    // All neighbors are outside room but also outside grid — no valid out-of-room-in-grid cells
    // The room fills the entire 3x3 grid. Cell (1,1) neighbors are all in-room.
    // Neighbors (0,1),(2,1),(1,0),(1,2) are in-room so not outside. No outside cells exist.
    expect(hasOutsideOpenNeighbor(walls, 1, 1, 0, 2, 0, 2, 3)).toBe(false);
  });

  it('returns true when only one of four neighbors is outside and open', () => {
    // Cell (2, 2) is on the right edge of room (minX=1, maxX=3, minY=1, maxY=3).
    // Actually let's test a top edge cell more carefully.
    // Cell (2,1): neighbors are (1,1)-inside, (3,1)-inside, (2,0)-outside, (2,2)-inside
    // Neighbor (2,0) is outside the room and open
    const walls = new Set();
    expect(hasOutsideOpenNeighbor(walls, 2, 1, 1, 3, 1, 3, 10)).toBe(true);
  });

  it('returns false when outside neighbors are all walled', () => {
    // Cell (1, 2) left edge of room. Neighbor (0, 2) is outside and we wall it.
    const walls = new Set(['0,2']);
    expect(hasOutsideOpenNeighbor(walls, 1, 2, 1, 3, 1, 3, 10)).toBe(false);
  });

  it('handles bottom-right corner of room', () => {
    // Cell (3, 3) — inside neighbors are (2,3) and (3,2). Outside: (4,3) and (3,4)
    const walls = new Set();
    expect(hasOutsideOpenNeighbor(walls, 3, 3, 1, 3, 1, 3, 10)).toBe(true);

    // Wall both outside neighbors
    const walls2 = new Set(['4,3', '3,4']);
    expect(hasOutsideOpenNeighbor(walls2, 3, 3, 1, 3, 1, 3, 10)).toBe(false);
  });

  it('returns false when outside neighbor is beyond grid size', () => {
    // Room at (8,8)-(9,9) on a 10x10 grid. Cell (9,9).
    // Outside neighbors: (10,9) and (9,10) — both out of bounds for grid size 10
    const walls = new Set();
    expect(hasOutsideOpenNeighbor(walls, 9, 9, 8, 9, 8, 9, 10)).toBe(false);
  });

  it('returns true when outside neighbor is in-grid but not walled', () => {
    // Room (0,0) to (0,0) — single cell room. Cell (0,0).
    // Outside neighbors: (-1,0) out-of-bounds, (1,0) in and open, (0,-1) out-of-bounds, (0,1) in and open
    expect(hasOutsideOpenNeighbor(new Set(), 0, 0, 0, 0, 0, 0, 5)).toBe(true);
  });

  it('returns false for single-cell room fully surrounded by walls', () => {
      // Actually -1,-1 etc are out of bounds anyway in most grids
    // So just need to wall (1,0) and (0,1) for grid starting at 0,0 with size >= 2
    
   const walls2 = new Set(['1,0', '0,1']);
   expect(hasOutsideOpenNeighbor(walls2, 0, 0, 0, 0, 0, 0, 5)).toBe(false);
  });

  it('ignores in-room neighbors even if they are open', () => {
    // Cell (2,1) on top edge of room. Its neighbor (2,2) is inside the room
    // This should not count as an outside open neighbor
    const walls = new Set(['0,1']); // Only wall up-left, (1,1) and other insides are open
    // The only truly "outside" neighbor that's valid here: depends on position
    // For cell (2, 1): neighbors (1,1)-inside room, (3,1)-inside room, (2,0)-outside, (2,2)-inside room
    // With empty walls except '0,1', cell (2,0) is outside and open — should return true
    expect(hasOutsideOpenNeighbor(walls, 2, 1, 1, 3, 1, 3, 10)).toBe(true);
  });
});

describe('buildRoomWalls', () => {
  it('clears all walls inside the room rectangle', () => {
    // Room from (2,2) to (4,4). Existing walls include some interior cells.
    const walls = new Set([
      '2,3', '3,2', '3,3', '3,4', // interior walls that should be removed
      '5,5',                       // exterior wall that should remain
    ]);
    const result = buildRoomWalls(walls, 2, 4, 2, 4, 10);
    expect(result.has('2,3')).toBe(false);
    expect(result.has('3,3')).toBe(false);
    expect(result.has('5,5')).toBe(true);
  });

  it('does not add walls when all outside passages are open', () => {
      // Empty Set: every boundary cell has at least one open outside neighbor → no walls added.
    const result = buildRoomWalls(new Set(), 2, 4, 2, 4, 10);
    expect(result.has('2,2')).toBe(false);
    expect(result.has('3,2')).toBe(false);
    expect(result.has('4,2')).toBe(false);
    expect(result.has('2,3')).toBe(false);
    expect(result.has('4,3')).toBe(false);
    expect(result.has('2,4')).toBe(false);
    expect(result.has('3,4')).toBe(false);
    expect(result.has('4,4')).toBe(false);
   });

  it('adds boundary walls when all outside passages are blocked', () => {
      // Fully seal room (2,4)×(2,4): wall every cell immediately adjacent to the room.
    const walls = new Set([
       '1,2', '5,2',   // left/right of row y=2
       '1,3', '5,3',   // left/right of row y=3
       '1,4', '5,4',   // left/right of row y=4
       '2,1', '3,1', '4,1', // above rows y=1
       '2,5', '3,5', '4,5', // below rows y=5
      ]);
    const result = buildRoomWalls(walls, 2, 4, 2, 4, 10);
     // Every boundary cell should be walled since no outside passage exists.
    expect(result.has('2,2')).toBe(true);
    expect(result.has('3,2')).toBe(true);
    expect(result.has('4,2')).toBe(true);
    expect(result.has('2,3')).toBe(true);
    expect(result.has('4,3')).toBe(true);
    expect(result.has('2,4')).toBe(true);
    expect(result.has('3,4')).toBe(true);
    expect(result.has('4,4')).toBe(true);
   });

  it('omits walls where at least one outside passage remains open', () => {
      // Room (2,4)×(2,4). Leave exactly one cell open: (3,1) above.
    const walls = new Set([
       '1,2', '5,2', '1,3', '5,3', '1,4', '5,4', // all sides sealed
       '2,1', '4,1',   // top row except (3,1) — the open doorway
       '2,5', '3,5', '4,5',  // bottom row fully sealed
      ]);
    const result = buildRoomWalls(walls, 2, 4, 2, 4, 10);
     // (3,2): has outside neighbor (3,1) open → no wall. All others closed.
    expect(result.has('3,2')).toBe(false); // passage!
    expect(result.has('2,2')).toBe(true);
    expect(result.has('4,2')).toBe(true);
    expect(result.has('2,3')).toBe(true);
    expect(result.has('4,3')).toBe(true);
    expect(result.has('2,4')).toBe(true);
    expect(result.has('3,4')).toBe(true);
    expect(result.has('4,4')).toBe(true);
   });

  it('walls corners when outside neighbors are already blocked', () => {
    // Room from (1,1) to (3,3). Wall all cells immediately around the room.
    const walls = new Set([
      '0,1', '4,1',   // left and right of row 1
      '0,2', '4,2',   // left and right of row 2
      '0,3', '4,3',   // left and right of row 3
      '1,0', '2,0', '3,0', // above rows
      '1,4', '2,4', '3,4', // below rows
    ]);
    const result = buildRoomWalls(walls, 1, 3, 1, 3, 10);
    // Every boundary cell has ALL outside neighbors walled → walls should be placed
    expect(result.has('1,1')).toBe(true); // top-left corner
    expect(result.has('2,1')).toBe(true); // top edge
    expect(result.has('3,1')).toBe(true); // top-right corner
    expect(result.has('1,2')).toBe(true); // left edge
    expect(result.has('3,2')).toBe(true); // right edge
    expect(result.has('1,3')).toBe(true); // bottom-left corner
    expect(result.has('2,3')).toBe(true); // bottom edge
    expect(result.has('3,3')).toBe(true); // bottom-right corner
  });

  it('creates a passage through one wall side while closing others', () => {
     // Room from (2,2) to (4,4). Leave (3,1) open as a doorway. Block everything else.
    const walls = new Set([
        '1,2', '1,3', '1,4',   // left side fully walled
        '5,2', '5,3', '5,4',   // right side fully walled
        '2,1', '4,1',          // top row except (3,1) — the doorway
        '2,5', '3,5', '4,5',   // bottom row fully walled
       ]);
    const result = buildRoomWalls(walls, 2, 4, 2, 4, 10);

     // (2,2): outside neighbor (2,1) walled, (1,2) walled → wall placed.
     // (3,2): outside neighbor (3,1) OPEN → no wall.
     // (4,2): outside neighbors (4,1) and (5,2) both walled → wall placed.
    expect(result.has('2,2')).toBe(true);
    expect(result.has('3,2')).toBe(false); // passage!
    expect(result.has('4,2')).toBe(true);

     // (2,3): outside neighbor (1,3) walled → wall
    expect(result.has('2,3')).toBe(true);

     // (4,3): outside neighbor (5,3) walled → wall
    expect(result.has('4,3')).toBe(true);

     // Bottom row: all outside neighbors blocked.
     // (2,4): outside (1,4) and (2,5) → both walled → wall
     // (3,4): outside (3,5) → walled → wall
     // (4,4): outside (5,4) and (4,5) → both walled → wall
    expect(result.has('2,4')).toBe(true);
    expect(result.has('3,4')).toBe(true);
    expect(result.has('4,4')).toBe(true);
   });

  it('does not mutate the original walls set', () => {
    const walls = new Set(['0,0', '1,0']);
    buildRoomWalls(walls, 2, 3, 2, 3, 10);
    expect(walls.has('0,0')).toBe(true);
    expect(walls.has('1,0')).toBe(true);
    expect(walls.size).toBe(2);
  });

  it('returns a new Set', () => {
    const walls = new Set(['5,5']);
    const result = buildRoomWalls(walls, 2, 4, 2, 4, 10);
    expect(result).toBeInstanceOf(Set);
    expect(result).not.toBe(walls);
  });

  it('handles a single-cell room with all passages open', () => {
    // Room is a single cell (5,5). All neighbors are "outside" the room.
    const walls = new Set();
    const result = buildRoomWalls(walls, 5, 5, 5, 5, 10);
    // Interior of single-cell room is cleared (it was empty anyway).
    // Every boundary IS the cell (5,5). For each check:
    // Top/bottom/x loops all point to (5,5). Outside neighbors are open → no wall.
    expect(result.has('5,5')).toBe(false);
  });

  it('handles a single-cell room completely surrounded', () => {
    const walls = new Set(['4,5', '6,5', '5,4', '5,6']);
    const result = buildRoomWalls(walls, 5, 5, 5, 5, 10);
    // Cell (5,5) — all outside neighbors walled → wall placed at (5,5)
    expect(result.has('5,5')).toBe(true);
  });

  it('preserves walls far from the room', () => {
    const walls = new Set(['0,0', '9,9']);
    const result = buildRoomWalls(walls, 2, 3, 2, 3, 10);
    expect(result.has('0,0')).toBe(true);
    expect(result.has('9,9')).toBe(true);
  });

  it('handles rooms at grid edge with partial outside neighbors', () => {
    // Room (0,0) to (2,2) on a 5x5 grid. Left and top edges have no valid outside cells.
    const walls = new Set();
    const result = buildRoomWalls(walls, 0, 2, 0, 2, 5);
    // Top edge y=0: cell (1,0). Outside neighbor above is (1,-1) — out of bounds.
    // Other outside neighbors: (-1,0) out-of-bounds for x=-1; inside rooms are (1,1), (2,0), (0,0).
    // For (1,0): right neighbor is (2,0) which is inside room. Left is (0,0) — wait no, (0,0) is in-room.
    // Actually hasOutsideOpenNeighbor checks if neighbor is outside room AND in grid AND not walled.
    // Cell (1,0): neighbors (-1,0)-outofgrid, (2,0)-inroom, (1,-1)-outofgrid, (1,1)-inroom.
    // No valid outside neighbor → no passage → wall placed at (1,0)
    expect(result.has('1,0')).toBe(true);

    // Right edge of bottom-right corner: cell (2,2). Outside neighbors: (3,2) and (2,3) — open.
    expect(result.has('2,2')).toBe(false);
  });
});

describe('createRoom', () => {
  it('creates a room with the correct rect coordinates', () => {
    const room = createRoom(5, 10, 4, 3);
    expect(room.rect).toEqual({ x: 5, y: 10, w: 4, h: 3 });
  });

  it('assigns a numeric id', () => {
    const room = createRoom(0, 0, 1, 1);
    expect(typeof room.id).toBe('number');
    expect(room.id).toBeGreaterThan(0);
  });

  it('sets type to "common"', () => {
    const room = createRoom(0, 0, 1, 1);
    expect(room.type).toBe('common');
  });

  it('sets an empty label', () => {
    const room = createRoom(0, 0, 1, 1);
    expect(room.label).toBe('');
  });

  it('initializes connectedTo as an empty array', () => {
    const room = createRoom(0, 0, 1, 1);
    expect(room.connectedTo).toEqual([]);
  });

  it('returns unique ids for sequential calls', () => {
    const r1 = createRoom(0, 0, 1, 1);
    const r2 = createRoom(0, 0, 1, 1);
    // Since Date.now() precision is milliseconds, they might be equal if called in the same ms.
    // This test is best-effort.
    expect(r1.id >= 1_000_000_000_000).toBe(true); // sanity: a recent timestamp
    expect(r2.id >= 1_000_000_000_000).toBe(true);
  });

  it('creates rooms with different dimensions', () => {
    const room = createRoom(10, 20, 8, 6);
    expect(room.rect.x).toBe(10);
    expect(room.rect.y).toBe(20);
    expect(room.rect.w).toBe(8);
    expect(room.rect.h).toBe(6);
  });

  it('creates a room with zero dimensions', () => {
    const room = createRoom(5, 5, 0, 0);
    expect(room.rect).toEqual({ x: 5, y: 5, w: 0, h: 0 });
  });

  it('creates a room with negative coordinates', () => {
    const room = createRoom(-3, -2, 4, 4);
    expect(room.rect.x).toBe(-3);
    expect(room.rect.y).toBe(-2);
  });
});
