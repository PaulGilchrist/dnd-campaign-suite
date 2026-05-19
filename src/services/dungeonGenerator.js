/**
 * Procedural dungeon generator for D&D battle maps.
 * Pure service — no React dependencies, no external libraries.
 *
 * Each grid square = 5 feet.
 * Uses a seeded PRNG (mulberry32) for reproducible output.
 *
 * Algorithm: classic roguelike room-corridor method.
 *   1. Place randomly-sized rooms with spacing constraints
 *   2. Connect rooms with L-shaped corridors
 *   3. Derive walls from floor adjacency
 *   4. Place doors at room-corridor junctions
 *
 * @param {number} gridSize  - Grid size (5–100, square grid gridSize × gridSize)
 * @param {object} [options]
 * @param {number} [options.corridorWidth=1]  - 1 (5 ft) or 2 (10 ft)
 * @param {boolean} [options.generateDoors=true] - Whether to place doors
 * @param {number} [options.seed]  - Seed for reproducible generation (default: Date.now())
 * @returns {{ walls: string[], doors: Array<{gridX: number, gridY: number, type: string}> }}
 */
export function generateDungeon(gridSize, options = {}) {
  // Edge case: grid too small
  if (!Number.isInteger(gridSize) || gridSize < 5 || gridSize > 100) {
    return { walls: [], doors: [] };
  }

  const {
    corridorWidth = 1,
    generateDoors = true,
    seed = Date.now(),
  } = options;

  const rng = mulberry32(seed >>> 0);

  // --- Step 2: Auto-calculate room parameters ---
  const roomCount = Math.max(2, Math.floor(gridSize / 3));
  const minRoomSize = 3;
  const maxRoomSize = Math.max(4, Math.min(10, Math.floor(gridSize * 0.15)));

  // --- Step 3: Room placement ---
  const rooms = [];
  for (let i = 0; i < roomCount; i++) {
    for (let attempt = 0; attempt < 50; attempt++) {
      const rw = randomInt(rng, minRoomSize, maxRoomSize);
      const rh = randomInt(rng, minRoomSize, maxRoomSize);

      // Ensure the room can actually fit with 1-cell edge padding
      const maxRx = Math.max(1, gridSize - rw - 1);
      const maxRy = Math.max(1, gridSize - rh - 1);
      if (1 > maxRx || 1 > maxRy) continue;

      const rx = randomInt(rng, 1, maxRx);
      const ry = randomInt(rng, 1, maxRy);

      const room = { x: rx, y: ry, w: rw, h: rh };

      if (!rooms.some(existing => roomsOverlap(existing, room, 2))) {
        rooms.push(room);
        break;
      }
    }
  }

  // If no rooms placed, nothing to generate
  if (rooms.length === 0) {
    return { walls: [], doors: [] };
  }

  // --- Step 4: Initialize cell grid ---
  // grid[x][y] — x is horizontal (column), y is vertical (row)
  const grid = Array.from({ length: gridSize }, () =>
    Array.from({ length: gridSize }, () => 'empty')
  );

  // --- Step 5: Mark room cells as 'room' (distinct from corridor 'floor') ---
  for (const room of rooms) {
    for (let x = room.x; x < room.x + room.w; x++) {
      for (let y = room.y; y < room.y + room.h; y++) {
        grid[x][y] = 'room';
      }
    }
  }

  // --- Step 6: Connect rooms with L-shaped corridors ---
  // Track corridor connections for door placement
  const corridorConnections = [];

  if (rooms.length >= 2) {
    for (let i = 0; i < rooms.length - 1; i++) {
      const info = connectRooms(rooms[i], rooms[i + 1], grid, corridorWidth, rng);
      corridorConnections.push({
        roomA: i,
        roomB: i + 1,
        ax: info.ax,
        ay: info.ay,
        bx: info.bx,
        by: info.by,
        horizontalFirst: info.horizontalFirst
      });
    }
  }

  // --- Step 7: Derive walls from floor OR room cells ---
  // Use a separate boolean array to avoid mutating during iteration
  const isWall = Array.from({ length: gridSize }, () =>
    Array.from({ length: gridSize }, () => false)
  );

  const isFloorOrRoom = (x, y) => {
    if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) return false;
    return grid[x][y] === 'floor' || grid[x][y] === 'room';
  };

  for (let x = 0; x < gridSize; x++) {
    for (let y = 0; y < gridSize; y++) {
      if (grid[x][y] !== 'empty') continue;

      // Check 4 orthogonal + 4 diagonal neighbors for floor or room
      const adjacentToFloor =
        isFloorOrRoom(x - 1, y) ||
        isFloorOrRoom(x + 1, y) ||
        isFloorOrRoom(x, y - 1) ||
        isFloorOrRoom(x, y + 1) ||
        isFloorOrRoom(x - 1, y - 1) ||
        isFloorOrRoom(x + 1, y - 1) ||
        isFloorOrRoom(x - 1, y + 1) ||
        isFloorOrRoom(x + 1, y + 1);

      if (adjacentToFloor) {
        isWall[x][y] = true;
        grid[x][y] = 'wall';
      }
    }
  }

  // --- Step 8: Place doors at actual corridor-room crossing points ---
  const doorKeys = new Set(); // "gridX,gridY" strings

  if (generateDoors) {
    /**
     * Place door(s) at a corridor crossing point on a room's edge.
     * @param {number} edgeX - X coordinate of the outside cell (room.x-1, room.x+room.w, or room center x)
     * @param {number} edgeY - Y coordinate of the outside cell (room.y-1, room.y+room.h, or room center y)
     * @param {'left'|'right'|'top'|'bottom'} edgeDir - Which edge the door is on
     * @param {number} centerCoord - The center coordinate (ay for left/right, ax for top/bottom)
     * @param {number} corridorWidth - Width of the corridor
     */
    function addDoorAtEdge(edgeX, edgeY, edgeDir, centerCoord, corridorWidth) {
      // Place doors for corridorWidth cells along the edge
      for (let w = 0; w < corridorWidth; w++) {
        let doorX, doorY;
        if (edgeDir === 'left' || edgeDir === 'right') {
          // Door cells stack vertically from centerCoord
          doorX = edgeX;
          doorY = centerCoord + w;
        } else {
          // Door cells stack horizontally from centerCoord
          doorX = centerCoord + w;
          doorY = edgeY;
        }

        // Bounds check
        if (doorX < 0 || doorX >= gridSize || doorY < 0 || doorY >= gridSize) continue;
        // Verify the cell is actually 'floor' (corridor carved through)
        if (grid[doorX][doorY] !== 'floor') continue;

        const key = `${doorX},${doorY}`;
        doorKeys.add(key);

        // If this cell was walled, revert it so the door is traversable
        if (grid[doorX][doorY] === 'wall') {
          grid[doorX][doorY] = 'empty';
          isWall[doorX][doorY] = false;
        }
      }
    }

    for (const conn of corridorConnections) {
      const roomA = rooms[conn.roomA];
      const roomB = rooms[conn.roomB];
      const { ax, ay, bx, by, horizontalFirst } = conn;

      // ----- Place door for room A (exit point, crossed by segment 1) -----
      if (horizontalFirst) {
        // Segment 1 is horizontal: from (ax, ay) to (bx, ay)
        if (bx > ax) {
          // Going RIGHT: exit through roomA's RIGHT edge
          const edgeX = roomA.x + roomA.w - 1; // inside right edge
          if (edgeX < gridSize) {
            addDoorAtEdge(edgeX, ay, 'right', ay, corridorWidth);
          }
        } else if (bx < ax) {
          // Going LEFT: exit through roomA's LEFT edge
          const edgeX = roomA.x; // inside left edge
          if (edgeX >= 0) {
            addDoorAtEdge(edgeX, ay, 'left', ay, corridorWidth);
          }
        }
        // if bx === ax: corridor is horizontal of length 0, no door
      } else {
        // Segment 1 is vertical: from (ax, ay) to (ax, by)
        if (by > ay) {
          // Going DOWN: exit through roomA's BOTTOM edge
          const edgeY = roomA.y + roomA.h - 1; // inside bottom edge
          if (edgeY < gridSize) {
            addDoorAtEdge(ax, edgeY, 'bottom', ax, corridorWidth);
          }
        } else if (by < ay) {
          // Going UP: exit through roomA's TOP edge
          const edgeY = roomA.y - 1; // one cell outside top edge
          if (edgeY >= 0) {
            addDoorAtEdge(ax, edgeY, 'top', ax, corridorWidth);
          }
        }
        // if by === ay: corridor is vertical of length 0, no door
      }

      // ----- Place door for room B (entry point, crossed by segment 2) -----
      if (horizontalFirst) {
        // Segment 2 is vertical: from (bx, ay) to (bx, by)
        if (by > ay) {
          // Going DOWN: enters roomB through TOP edge
          const edgeY = roomB.y - 1;
          if (edgeY >= 0) {
            addDoorAtEdge(bx, edgeY, 'top', bx, corridorWidth);
          }
        } else if (by < ay) {
          // Going UP: enters roomB through BOTTOM edge
          const edgeY = roomB.y + roomB.h;
          if (edgeY < gridSize) {
            addDoorAtEdge(bx, edgeY, 'bottom', bx, corridorWidth);
          }
        }
      } else {
        // Segment 2 is horizontal: from (ax, by) to (bx, by)
        if (bx > ax) {
          // Going RIGHT: enters roomB through LEFT edge
          const edgeX = roomB.x - 1;
          if (edgeX >= 0) {
            addDoorAtEdge(edgeX, by, 'left', by, corridorWidth);
          }
        } else if (bx < ax) {
          // Going LEFT: enters roomB through RIGHT edge
          const edgeX = roomB.x + roomB.w;
          if (edgeX < gridSize) {
            addDoorAtEdge(edgeX, by, 'right', by, corridorWidth);
          }
        }
      }
    }
  }

  // --- Step 9: Build output ---
  const walls = [];
  const doors = [];

  for (let x = 0; x < gridSize; x++) {
    for (let y = 0; y < gridSize; y++) {
      if (isWall[x][y] && !doorKeys.has(`${x},${y}`)) {
        walls.push(`${x},${y}`);
      }
    }
  }

  for (const key of doorKeys) {
    const [gx, gy] = key.split(',').map(Number);
    doors.push({
      id: `door-${gx}-${gy}`,
      gridX: gx,
      gridY: gy,
      type: 'door',
      visible: true,
      rotation: 0
    });
  }

  return { walls, placedItems: doors };
}

// ---------------------------------------------------------------------------
// Seeded PRNG — mulberry32
// ---------------------------------------------------------------------------

function mulberry32(seed) {
  return function next() {
    /* eslint-disable no-bitwise */
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    /* eslint-enable no-bitwise */
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Return a random integer in [min, max] (inclusive) using the given rng.
 * @param {function} rng - Pseudo-random function returning [0, 1)
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function randomInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

/**
 * Check whether two room rectangles overlap with a given padding (in cells).
 * @param {{ x: number, y: number, w: number, h: number }} a
 * @param {{ x: number, y: number, w: number, h: number }} b
 * @param {number} padding  - Minimum gap between room perimeters
 * @returns {boolean} true if the rooms overlap (or are too close)
 */
function roomsOverlap(a, b, padding) {
  return (
    a.x - padding < b.x + b.w &&
    a.x + a.w + padding > b.x &&
    a.y - padding < b.y + b.h &&
    a.y + a.h + padding > b.y
  );
}

// ---------------------------------------------------------------------------
// Corridor carving
// ---------------------------------------------------------------------------

/**
 * Connect two rooms with an L-shaped corridor (horizontal-first or
 * vertical-first, chosen randomly).
 */
function connectRooms(a, b, grid, corridorWidth, rng) {
  const ax = Math.floor(a.x + a.w / 2);
  const ay = Math.floor(a.y + a.h / 2);
  const bx = Math.floor(b.x + b.w / 2);
  const by = Math.floor(b.y + b.h / 2);

  const horizontalFirst = rng() < 0.5;

  if (horizontalFirst) {
    // Horizontal then vertical
    carveHorizontal(ax, bx, ay, grid, corridorWidth);
    carveVertical(ay, by, bx, grid, corridorWidth);
  } else {
    // Vertical then horizontal
    carveVertical(ay, by, ax, grid, corridorWidth);
    carveHorizontal(ax, bx, by, grid, corridorWidth);
  }

  return { ax, ay, bx, by, horizontalFirst };
}

/**
 * Carve a horizontal corridor from x1 to x2 at row y.
 * Marks corridorWidth rows as 'floor' starting from y.
 */
function carveHorizontal(x1, x2, y, grid, width) {
  const start = Math.min(x1, x2);
  const end = Math.max(x1, x2);
  const size = grid.length;

  for (let x = start; x <= end; x++) {
    if (x < 0 || x >= size) continue;
    for (let w = 0; w < width; w++) {
      const yy = y + w;
      if (yy >= 0 && yy < size) {
        grid[x][yy] = 'floor';
      }
    }
  }
}

/**
 * Carve a vertical corridor from y1 to y2 at column x.
 * Marks corridorWidth columns as 'floor' starting from x.
 */
function carveVertical(y1, y2, x, grid, width) {
  const start = Math.min(y1, y2);
  const end = Math.max(y1, y2);
  const size = grid.length;

  for (let y = start; y <= end; y++) {
    if (y < 0 || y >= size) continue;
    for (let w = 0; w < width; w++) {
      const xx = x + w;
      if (xx >= 0 && xx < size) {
        grid[xx][y] = 'floor';
      }
    }
  }
}
