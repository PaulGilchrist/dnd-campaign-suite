/**
 * Dungeon Map Generator
 * Generates grid-based dungeon maps as JSON compatible with Paul's dnd-char-sheet app.
 *
 * Works in browsers (ES module) and Node.js.
 * This is the canonical implementation. dungeon-generator.mjs is the CLI shim.
 *
 * Usage:
 *   import { generateDungeon, visualize } from './dungeonGenerator.js';
 *   const map = generateDungeon({ gridSize: 30, seed: 42 });
 *
 *   // Browser
 *   const map = generateDungeon({ gridSize: 30 });
 */

// ---------------------------------------------------------------------------
// Seeded random number generator (mulberry32)
// ---------------------------------------------------------------------------
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function rectCenter(r) {
  return [r.x + Math.floor(r.w / 2), r.y + Math.floor(r.h / 2)];
}

function rectIntersects(a, b, padding) {
  padding = padding || 0;
  return (
    a.x - padding <= b.x + b.w - 1 + padding &&
    a.x + a.w - 1 + padding >= b.x - padding &&
    a.y - padding <= b.y + b.h - 1 + padding &&
    a.y + a.h - 1 + padding >= b.y - padding
  );
}

function rectContains(r, x, y) {
  return x >= r.x && x <= r.x + r.w - 1 && y >= r.y && y <= r.y + r.h - 1;
}

function pick(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}

// ---------------------------------------------------------------------------
// BSP Tree for room generation
// ---------------------------------------------------------------------------
class BSPNode {
  constructor(rect) {
    this.rect = rect;
    this.left = null;
    this.right = null;
    this.room = null;
  }

  split(rng, minSize) {
    minSize = minSize || 4;
    if (this.left || this.right) return false;

    let splitHorizontal;
    if (this.rect.w > this.rect.h * 1.25) {
      splitHorizontal = false;
    } else if (this.rect.h > this.rect.w * 1.25) {
      splitHorizontal = true;
    } else {
      splitHorizontal = rng() < 0.5;
    }

    if (splitHorizontal) {
      if (this.rect.h < minSize * 2) return false;
      const split =
        this.rect.y + minSize + Math.floor(rng() * (this.rect.h - minSize * 2));
      this.left = new BSPNode({
        x: this.rect.x,
        y: this.rect.y,
        w: this.rect.w,
        h: split - this.rect.y,
      });
      this.right = new BSPNode({
        x: this.rect.x,
        y: split,
        w: this.rect.w,
        h: this.rect.y + this.rect.h - split,
      });
    } else {
      if (this.rect.w < minSize * 2) return false;
      const split =
        this.rect.x + minSize + Math.floor(rng() * (this.rect.w - minSize * 2));
      this.left = new BSPNode({
        x: this.rect.x,
        y: this.rect.y,
        w: split - this.rect.x,
        h: this.rect.h,
      });
      this.right = new BSPNode({
        x: split,
        y: this.rect.y,
        w: this.rect.x + this.rect.w - split,
        h: this.rect.h,
      });
    }
    return true;
  }

  createRooms(rng, minRoom, maxRoom) {
    const rooms = [];
    this._recursiveCreateRooms(rng, rooms, minRoom, maxRoom);
    return rooms;
  }

  _recursiveCreateRooms(rng, rooms, minRoom, maxRoom) {
    if (this.left) this.left._recursiveCreateRooms(rng, rooms, minRoom, maxRoom);
    if (this.right)
      this.right._recursiveCreateRooms(rng, rooms, minRoom, maxRoom);

    if (!this.left && !this.right) {
      const maxW = Math.min(maxRoom, this.rect.w);
      const maxH = Math.min(maxRoom, this.rect.h);
      const w = minRoom + Math.floor(rng() * (maxW - minRoom + 1));
      const h = minRoom + Math.floor(rng() * (maxH - minRoom + 1));
      // Use only 0-2 tile offset so rooms fill most of their leaf
      const maxOffX = Math.max(0, Math.min(2, this.rect.w - w));
      const maxOffY = Math.max(0, Math.min(2, this.rect.h - h));
      const x = this.rect.x + Math.floor(rng() * (maxOffX + 1));
      const y = this.rect.y + Math.floor(rng() * (maxOffY + 1));
      const room = { rect: { x, y, w, h }, id: rooms.length, connected: [] };
      this.room = room;
      rooms.push(room);
    }
  }
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------
export function generateDungeon(opts) {
  opts = opts || {};
  const gridSize = opts.gridSize || 30;
  const density = opts.density != null ? Math.max(0, Math.min(1, opts.density)) : 0.5;
  const rng = opts.seed != null ? mulberry32(opts.seed) : Math.random.bind(Math);

  // Grid: true = wall, false = floor (indexed as grid[y][x])
  const grid = [];
  for (let y = 0; y < gridSize; y++) {
    const row = [];
    for (let x = 0; x < gridSize; x++) row.push(true);
    grid.push(row);
  }
  const corridorCells = {};

  // ---- 1. BSP rooms ----
  const padding = 2;
  const root = new BSPNode({
    x: padding,
    y: padding,
    w: gridSize - padding * 2,
    h: gridSize - padding * 2,
  });

  // Scale BSP depth and room sizes to grid
  const targetSplits = Math.max(4, Math.floor((gridSize - 4) / 3 * (0.7 + density)));
  const minRoom = Math.max(4, Math.floor(gridSize / 8));
  const maxRoom = Math.max(8, Math.min(18, Math.floor(gridSize / 2.5)));

  let nodes = [root];
  let splits = 0;
  while (nodes.length > 0 && splits < targetSplits) {
    const node = nodes.shift();
    if (node.split(rng)) {
      if (node.left) nodes.push(node.left);
      if (node.right) nodes.push(node.right);
      splits++;
    }
  }

  let rooms = root.createRooms(rng, minRoom, maxRoom);

  // Cull rooms that overlap after random placement within leaves
  // (re-check because rooms within sibling leaves can overlap boundaries)
  const culled = [];
  for (let i = 0; i < rooms.length; i++) {
    let overlap = false;
    for (let j = 0; j < culled.length; j++) {
      if (rectIntersects(rooms[i].rect, culled[j].rect, 0)) {
        overlap = true;
        break;
      }
    }
    if (!overlap) culled.push(rooms[i]);
  }
  rooms = culled;

  // If very few rooms survived, add a few random ones as filler
  let attempts = 0;
  while (rooms.length < 4 && attempts < 50) {
    const w = minRoom + Math.floor(rng() * Math.min(4, maxRoom - minRoom + 1));
    const h = minRoom + Math.floor(rng() * Math.min(4, maxRoom - minRoom + 1));
    const x = padding + Math.floor(rng() * (gridSize - w - padding * 2));
    const y = padding + Math.floor(rng() * (gridSize - h - padding * 2));
    const rect = { x, y, w, h };
    let overlaps = false;
    for (let i = 0; i < rooms.length; i++) {
      if (rectIntersects(rooms[i].rect, rect, 1)) {
        overlaps = true;
        break;
      }
    }
    if (!overlaps) {
      rooms.push({ rect: rect, id: rooms.length, connected: [] });
    }
    attempts++;
  }

  for (let i = 0; i < rooms.length; i++) rooms[i].id = i;

  // ---- 2. Carve rooms ----
  for (let r = 0; r < rooms.length; r++) {
    const room = rooms[r];
    for (let y = room.rect.y; y < room.rect.y + room.rect.h; y++) {
      for (let x = room.rect.x; x < room.rect.x + room.rect.w; x++) {
        if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
          grid[y][x] = false;
        }
      }
    }
  }

  // ---- 3. Connect rooms (MST + extras) ----
  if (rooms.length >= 2) {
    const connected = {};
    const unconnected = {};
    connected[0] = true;
    for (let i = 1; i < rooms.length; i++) unconnected[i] = true;

    while (Object.keys(unconnected).length > 0) {
      let bestDist = Infinity;
      let bestA = -1;
      let bestB = -1;

      const connKeys = Object.keys(connected).map(Number);
      const unconnKeys = Object.keys(unconnected).map(Number);

      for (let i = 0; i < connKeys.length; i++) {
        const a = connKeys[i];
        for (let j = 0; j < unconnKeys.length; j++) {
          const b = unconnKeys[j];
          const ca = rectCenter(rooms[a].rect);
          const cb = rectCenter(rooms[b].rect);
          const dist = Math.abs(ca[0] - cb[0]) + Math.abs(ca[1] - cb[1]);
          if (dist < bestDist) {
            bestDist = dist;
            bestA = a;
            bestB = b;
          }
        }
      }

      carveCorridor(rooms[bestA], rooms[bestB]);
      rooms[bestA].connected.push(bestB);
      rooms[bestB].connected.push(bestA);
      connected[bestB] = true;
      delete unconnected[bestB];
    }

    // Extra connections for loops
    const extra = Math.max(1, Math.floor(rooms.length / 5));
    for (let i = 0; i < extra; i++) {
      const a = Math.floor(rng() * rooms.length);
      let b = Math.floor(rng() * rooms.length);
      if (a !== b && rooms[a].connected.indexOf(b) === -1) {
        carveCorridor(rooms[a], rooms[b]);
        rooms[a].connected.push(b);
        rooms[b].connected.push(a);
      }
    }
  }

  function carveCorridor(a, b) {
    const ca = rectCenter(a.rect);
    const cb = rectCenter(b.rect);
    if (rng() < 0.5) {
      const xDir = ca[0] <= cb[0] ? 1 : -1;
      for (let x = ca[0]; x !== cb[0] + xDir; x += xDir) {
        carveCell(x, ca[1]);
      }
      const yDir = ca[1] <= cb[1] ? 1 : -1;
      for (let y = ca[1]; y !== cb[1] + yDir; y += yDir) {
        carveCell(cb[0], y);
      }
    } else {
      const yDir = ca[1] <= cb[1] ? 1 : -1;
      for (let y = ca[1]; y !== cb[1] + yDir; y += yDir) {
        carveCell(ca[0], y);
      }
      const xDir = ca[0] <= cb[0] ? 1 : -1;
      for (let x = ca[0]; x !== cb[0] + xDir; x += xDir) {
        carveCell(x, cb[1]);
      }
    }
  }

  function carveCell(x, y) {
    if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
      grid[y][x] = false;
      corridorCells[x + "," + y] = true;
    }
  }

  // ---- 3b. Cap dead-end corridors with small rooms ----
  function isOpen(x, y) {
    return x >= 0 && x < gridSize && y >= 0 && y < gridSize && !grid[y][x];
  }

  function openNeighborCount(x, y) {
    let n = 0;
    if (isOpen(x - 1, y)) n++;
    if (isOpen(x + 1, y)) n++;
    if (isOpen(x, y - 1)) n++;
    if (isOpen(x, y + 1)) n++;
    return n;
  }

  const deadEndTips = [];
  for (const key in corridorCells) {
    const [cx, cy] = key.split(",").map(Number);
    if (openNeighborCount(cx, cy) === 1) {
      deadEndTips.push([cx, cy]);
    }
  }

  for (let di = 0; di < deadEndTips.length; di++) {
    const [tx, ty] = deadEndTips[di];
    // Try 3x3 room around the tip; shrink if near grid edge
    const rX = Math.max(1, tx - 1);
    const rY = Math.max(1, ty - 1);
    const rW = Math.min(3, gridSize - rX - 1);
    const rH = Math.min(3, gridSize - rY - 1);
    if (rW < 3 || rH < 3) continue;

    let canCap = true;
    for (let y = rY; y < rY + rH; y++) {
      for (let x = rX; x < rX + rW; x++) {
        if (!grid[y][x]) { canCap = false; break; }
      }
      if (!canCap) break;
    }
    if (!canCap) continue;

    // Carve the room
    for (let y = rY; y < rY + rH; y++) {
      for (let x = rX; x < rX + rW; x++) {
        grid[y][x] = false;
      }
    }
    rooms.push({
      rect: { x: rX, y: rY, w: rW, h: rH },
      id: rooms.length,
      connected: [],
      _deadEndCap: true,
    });
  }

  // ---- 4. Place doors ----
  function findRoomDoorSpans(room) {
    const spans = [];
    // North wall
    const ny = room.rect.y - 1;
    let spanStart = null;
    for (let x = room.rect.x; x < room.rect.x + room.rect.w; x++) {
      if (corridorCells[x + "," + ny]) {
        if (spanStart == null) spanStart = x;
      } else if (spanStart != null) {
        spans.push({ side: "n", x1: spanStart, x2: x - 1, y: ny });
        spanStart = null;
      }
    }
    if (spanStart != null) spans.push({ side: "n", x1: spanStart, x2: room.rect.x + room.rect.w - 1, y: ny });

    // South wall
    const sy = room.rect.y + room.rect.h;
    spanStart = null;
    for (let x = room.rect.x; x < room.rect.x + room.rect.w; x++) {
      if (corridorCells[x + "," + sy]) {
        if (spanStart == null) spanStart = x;
      } else if (spanStart != null) {
        spans.push({ side: "s", x1: spanStart, x2: x - 1, y: sy });
        spanStart = null;
      }
    }
    if (spanStart != null) spans.push({ side: "s", x1: spanStart, x2: room.rect.x + room.rect.w - 1, y: sy });

    // West wall
    const wx = room.rect.x - 1;
    spanStart = null;
    for (let y = room.rect.y; y < room.rect.y + room.rect.h; y++) {
      if (corridorCells[wx + "," + y]) {
        if (spanStart == null) spanStart = y;
      } else if (spanStart != null) {
        spans.push({ side: "w", x: wx, y1: spanStart, y2: y - 1 });
        spanStart = null;
      }
    }
    if (spanStart != null) spans.push({ side: "w", x: wx, y1: spanStart, y2: room.rect.y + room.rect.h - 1 });

    // East wall
    const ex = room.rect.x + room.rect.w;
    spanStart = null;
    for (let y = room.rect.y; y < room.rect.y + room.rect.h; y++) {
      if (corridorCells[ex + "," + y]) {
        if (spanStart == null) spanStart = y;
      } else if (spanStart != null) {
        spans.push({ side: "e", x: ex, y1: spanStart, y2: y - 1 });
        spanStart = null;
      }
    }
    if (spanStart != null) spans.push({ side: "e", x: ex, y1: spanStart, y2: room.rect.y + room.rect.h - 1 });

    return spans;
  }

  function spanCenter(span) {
    if (span.side === "n" || span.side === "s") {
      return { x: Math.floor((span.x1 + span.x2) / 2), y: span.y };
    }
    return { x: span.x, y: Math.floor((span.y1 + span.y2) / 2) };
  }

  const finalDoors = [];
  for (let r = 0; r < rooms.length; r++) {
    const room = rooms[r];
    const spans = findRoomDoorSpans(room);

    for (let s = 0; s < spans.length; s++) {
      const span = spans[s];
      const isNorthSouth = span.side === "n" || span.side === "s";
      const spanWidth = isNorthSouth ? span.x2 - span.x1 + 1 : span.y2 - span.y1 + 1;

      // Build list of door positions for this span.
      // Width 1 → single door at center.
      // Width >= 2 → skip (corridor running past room, not a discrete entrance).
      const positions = [];
      if (spanWidth === 1) {
        const pos = spanCenter(span);
        positions.push({ x: pos.x, y: pos.y });
      }

      for (let pi = 0; pi < positions.length; pi++) {
        const pos = positions[pi];

        // For single doors, skip if no wall neighbor (means two rooms are
        // directly adjacent without a wall, or corridor runs through open space).
        // Multi-door spans are explicitly placed across a corridor-to-room opening
        // so they're always valid regardless of wall adjacency.
        if (positions.length === 1) {
          const hasWallNeighbor =
            (pos.x > 0 && grid[pos.y][pos.x - 1]) ||
            (pos.x < gridSize - 1 && grid[pos.y][pos.x + 1]) ||
            (pos.y > 0 && grid[pos.y - 1][pos.x]) ||
            (pos.y < gridSize - 1 && grid[pos.y + 1][pos.x]);
          if (!hasWallNeighbor) continue;
        }

        // Determine rotation: north/south walls → vertical (90), east/west → horizontal (0)
        const rotation = isNorthSouth ? 90 : 0;

        // Double-door spans use regular doors only
        let doorType;
        if (positions.length > 1) {
          doorType = "door";
        } else {
          const secretRoll = rng();
          if (room._deadEndCap) {
            doorType = secretRoll < 0.3 ? "secretDoor" : "door";
          } else {
            doorType = secretRoll < 0.1 ? "secretDoor" : "door";
          }
        }

        finalDoors.push({
          x: pos.x,
          y: pos.y,
          rotation: rotation,
          doorType: doorType,
        });
      }
    }
  }

  // ---- 5. Furniture ----
  const placedItems = [];

  // Track occupied floor cells per room to prevent item overlap
  for (let r = 0; r < rooms.length; r++) {
    rooms[r]._occupied = new Set();
  }

  function isOccupied(room, x, y) {
    return room._occupied.has(x + "," + y);
  }

  function markOccupied(room, x, y) {
    room._occupied.add(x + "," + y);
  }

  for (let r = 0; r < rooms.length; r++) {
    placeTorches(rooms[r]);
    const area = rooms[r].rect.w * rooms[r].rect.h;
    if (area > 30) addLargeRoomFurniture(rooms[r]);
    else if (area > 15) addMediumRoomFurniture(rooms[r]);
    else addSmallRoomFurniture(rooms[r]);
  }

  // Mark furniture positions in each room's occupied set so NPCs don't overlap
  for (const item of placedItems) {
    for (const room of rooms) {
      if (rectContains(room.rect, item.gridX, item.gridY)) {
        markOccupied(room, item.gridX, item.gridY);
        break;
      }
    }
  }

  function placeTorches(room) {
    const torchDefs = [];

    const midX = room.rect.x + Math.floor(room.rect.w / 2);
    const midY = room.rect.y + Math.floor(room.rect.h / 2);

    function isWall(wx, wy) {
      return wx >= 0 && wx < gridSize && wy >= 0 && wy < gridSize && grid[wy][wx];
    }

    if (room.rect.y >= 2) {
      [[midX], [room.rect.x + 1], [room.rect.x + room.rect.w - 2]].forEach(function(coords) {
        var tx = coords[0];
        if (room.rect.w > 4 || coords === midX) {
          if (isWall(tx, room.rect.y - 1)) {
            torchDefs.push([tx, room.rect.y, 90]);
          }
        }
      });
    }
    if (room.rect.y + room.rect.h < gridSize - 1) {
      var sy = room.rect.y + room.rect.h - 1;
      [[midX], [room.rect.x + 1], [room.rect.x + room.rect.w - 2]].forEach(function(coords) {
        var tx = coords[0];
        if (room.rect.w > 4 || coords === midX) {
          if (isWall(tx, sy + 1)) {
            torchDefs.push([tx, sy, 270]);
          }
        }
      });
    }
    if (room.rect.x >= 2) {
      if (isWall(room.rect.x - 1, midY)) {
        torchDefs.push([room.rect.x, midY, 0]);
      }
    }
    if (room.rect.x + room.rect.w < gridSize - 1) {
      var ex = room.rect.x + room.rect.w - 1;
      if (isWall(ex + 1, midY)) {
        torchDefs.push([ex, midY, 180]);
      }
    }

    const seen = {};
    const unique = [];
    torchDefs.forEach(function(t) {
      var key = t[0] + ',' + t[1];
      if (!seen[key]) { seen[key] = true; unique.push(t); }
    });

    const count = Math.min(1 + Math.floor(rng() * 3), unique.length);
    const shuffled = unique.slice().sort(function () { return rng() - 0.5; });
    for (let i = 0; i < count; i++) {
      const t = shuffled[i];
      placedItems.push({
        id: "torch-" + room.id + "-" + t[0] + "-" + t[1],
        gridX: t[0],
        gridY: t[1],
        type: "torch",
        visible: true,
        rotation: t[2],
      });
    }
    room._torchWalls = shuffled.slice(0, count).map(function(t) {
      if (t[2] === 0) return "w";
      if (t[2] === 90) return "n";
      if (t[2] === 180) return "e";
      return "s";
    });
  }

  function wallRotation(wall) {
    // Bookshelf SVG is 72x36 (wide). Wall-side of SVG is at top (y=2..18).
    // rot=0: horizontal, wall-side up (north wall). 
    // rot=180: horizontal, wall-side down (south wall).
    // rot=90: vertical, wall-side right (east wall). CW in SVG Y-down = top→right
    // rot=270: vertical, wall-side left (west wall). CCW = top→left
    if (wall === "n") return 0;
    if (wall === "s") return 180;
    if (wall === "e") return 90;
    return 270; // west
  }

  function pickWall(room, rng, usedWalls) {
    const walls = [];
    if (room.rect.y > 1) walls.push("n");
    if (room.rect.y + room.rect.h < gridSize - 1) walls.push("s");
    if (room.rect.x > 1) walls.push("w");
    if (room.rect.x + room.rect.w < gridSize - 1) walls.push("e");
    const fresh = walls.filter(w => !usedWalls.includes(w));
    return pick(fresh.length > 0 ? fresh : walls, rng);
  }

  function placeAlongWall(room, wall, rng, inset) {
    inset = inset != null ? inset : 1;
    let x, y;
    const rot = wallRotation(wall);
    if (wall === "n") {
      x = room.rect.x + 1 + Math.floor(rng() * Math.max(1, room.rect.w - 2));
      y = room.rect.y + inset;
    } else if (wall === "s") {
      x = room.rect.x + 1 + Math.floor(rng() * Math.max(1, room.rect.w - 2));
      y = room.rect.y + room.rect.h - 1 - inset;
    } else if (wall === "w") {
      x = room.rect.x + inset;
      y = room.rect.y + 1 + Math.floor(rng() * Math.max(1, room.rect.h - 2));
    } else {
      x = room.rect.x + room.rect.w - 1 - inset;
      y = room.rect.y + 1 + Math.floor(rng() * Math.max(1, room.rect.h - 2));
    }
    return { x, y, rotation: rot };
  }

  function placeAgainstWall(room, wall, rng) {
    // Bookshelves are 2 squares. Horizontal (n/s wall) occupies x,x+1.
    // Vertical (e/w wall) occupies y,y+1. Ensure the full item fits.
    const rot = wallRotation(wall);
    const isHorizontal = (wall === "n" || wall === "s");

    // Build a set of door positions to avoid blocking doors
    const doorCells = {};
    for (let d = 0; d < finalDoors.length; d++) {
      doorCells[finalDoors[d].x + "," + finalDoors[d].y] = true;
    }

    let candidates = [];
    if (isHorizontal) {
      // Horizontal bookshelf: needs x and x+1 inside room, neither on a door
      const y = wall === "n" ? room.rect.y : room.rect.y + room.rect.h - 1;
      const wy = wall === "n" ? room.rect.y - 1 : room.rect.y + room.rect.h;
      for (let x = room.rect.x; x < room.rect.x + room.rect.w - 1; x++) {
        if (wy >= 0 && wy < gridSize && grid[wy][x] &&
            !doorCells[x + "," + y] && !doorCells[(x + 1) + "," + y]) {
          candidates.push({ x, y, rotation: rot });
        }
      }
    } else {
      // Vertical bookshelf: needs y and y+1 inside room, neither on a door
      const x = wall === "w" ? room.rect.x : room.rect.x + room.rect.w - 1;
      const wx = wall === "w" ? room.rect.x - 1 : room.rect.x + room.rect.w;
      for (let y = room.rect.y; y < room.rect.y + room.rect.h - 1; y++) {
        if (wx >= 0 && wx < gridSize && grid[y][wx] &&
            !doorCells[x + "," + y] && !doorCells[x + "," + (y + 1)]) {
          candidates.push({ x, y, rotation: rot });
        }
      }
    }
    if (candidates.length > 0) return pick(candidates, rng);
    return null;
  }

  function addLargeRoomFurniture(room) {
    const c = rectCenter(room.rect);
    const usedWalls = room._torchWalls || [];

    if (rng() < 0.4) {
      placedItems.push({
        id: "altar-" + room.id,
        gridX: c[0],
        gridY: c[1],
        type: "altar",
        visible: true,
        rotation: 0,
      });
    }

    if (room.rect.w >= 6 && room.rect.h >= 6 && rng() < 0.5) {
      const offsets = [[-2, -2], [2, -2], [-2, 2], [2, 2]];
      for (let i = 0; i < offsets.length; i++) {
        const px = c[0] + offsets[i][0], py = c[1] + offsets[i][1];
        if (rectContains(room.rect, px, py)) {
          placedItems.push({
            id: "pillar-" + room.id + "-" + px + "-" + py,
            gridX: px, gridY: py,
            type: "pillar",
            visible: true,
          });
        }
      }
    }

    if (rng() < 0.5) {
      const tableX = c[0] - 1;
      const tableY = c[1];
      if (tableX >= room.rect.x && tableX + 1 < room.rect.x + room.rect.w) {
        placedItems.push({
          id: "table-" + room.id,
          gridX: tableX, gridY: tableY,
          type: "table",
          visible: true,
          rotation: 0,
        });
        const chairDefs = [
          { dx: 0, dy: -1, rot: 0 },
          { dx: 1, dy: -1, rot: 0 },
          { dx: 0, dy: 1, rot: 180 },
          { dx: 1, dy: 1, rot: 180 },
          { dx: -1, dy: 0, rot: 90 },
          { dx: 2, dy: 0, rot: 270 },
        ];
        const numChairs = 2 + Math.floor(rng() * 3);
        const shuffled = chairDefs.slice().sort(function () { return rng() - 0.5; });
        for (let i = 0; i < numChairs; i++) {
          const ch = shuffled[i];
          const chx = tableX + ch.dx, chy = tableY + ch.dy;
          if (rectContains(room.rect, chx, chy)) {
            placedItems.push({
              id: "chair-" + room.id + "-" + i,
              gridX: chx, gridY: chy,
              type: "chair",
              visible: true,
              rotation: ch.rot,
            });
          }
        }
      }
    }

    if (rng() < 0.6) {
      const wall = pickWall(room, rng, usedWalls);
      const pos = placeAlongWall(room, wall, rng);
      placedItems.push({
        id: "chest-" + room.id,
        gridX: pos.x, gridY: pos.y,
        type: "chest",
        visible: true,
        rotation: pos.rotation,
      });
      usedWalls.push(wall);
    }

    if (rng() < 0.4) {
      const wall = pickWall(room, rng, usedWalls);
      let bx, by, rotation;
      if (wall === "n") {
        bx = room.rect.x + 1 + Math.floor(rng() * Math.max(1, room.rect.w - 2));
        by = room.rect.y + 1;
        rotation = 0;
      } else if (wall === "s") {
        bx = room.rect.x + 1 + Math.floor(rng() * Math.max(1, room.rect.w - 2));
        by = room.rect.y + room.rect.h - 2;
        rotation = 0;
      } else if (wall === "w") {
        bx = room.rect.x + 1;
        by = room.rect.y + 1 + Math.floor(rng() * Math.max(1, room.rect.h - 2));
        rotation = 90;
      } else {
        bx = room.rect.x + room.rect.w - 2;
        by = room.rect.y + 1 + Math.floor(rng() * Math.max(1, room.rect.h - 2));
        rotation = 90;
      }
      placedItems.push({
        id: "bed-" + room.id,
        gridX: bx, gridY: by,
        type: "bed",
        visible: true,
        rotation: rotation,
      });
      usedWalls.push(wall);
    }

    if (rng() < 0.3) {
      const walls = ["n", "s", "w", "e"].filter(function (w) {
        return !usedWalls.includes(w);
      });
      let placed = false;
      for (let wi = 0; wi < walls.length && !placed; wi++) {
        const idx = Math.floor(rng() * walls.length);
        const w = walls.splice(idx, 1)[0];
        const pos = placeAgainstWall(room, w, rng);
        if (pos) {
          placedItems.push({
            id: "bookshelf-" + room.id,
            gridX: pos.x, gridY: pos.y,
            type: "bookshelf",
            visible: true,
            rotation: pos.rotation,
          });
          usedWalls.push(w);
          placed = true;
        }
      }
    }

    placeRoomTrap(room);
  }

  function addMediumRoomFurniture(room) {
    const c = rectCenter(room.rect);
    const usedWalls = room._torchWalls || [];
    const roll = rng();

    if (roll < 0.3) {
      const tableX = c[0] - 1;
      const tableY = c[1];
      if (tableX >= room.rect.x && tableX + 1 < room.rect.x + room.rect.w) {
        placedItems.push({
          id: "table-" + room.id,
          gridX: tableX, gridY: tableY,
          type: "table",
          visible: true,
          rotation: 0,
        });
        if (rectContains(room.rect, c[0], c[1] - 1)) {
          placedItems.push({
            id: "chair-" + room.id,
            gridX: c[0], gridY: c[1] - 1,
            type: "chair",
            visible: true,
            rotation: 0,
          });
        }
      }
    } else if (roll < 0.5) {
      const wall = pickWall(room, rng, usedWalls);
      const pos = placeAlongWall(room, wall, rng);
      placedItems.push({
        id: "chest-" + room.id,
        gridX: pos.x, gridY: pos.y,
        type: "chest",
        visible: true,
        rotation: pos.rotation,
      });
    } else if (roll < 0.7) {
      placedItems.push({
        id: "statue-" + room.id,
        gridX: c[0], gridY: c[1],
        type: "statue",
        visible: true,
        rotation: 0,
      });
    } else if (roll < 0.85) {
      const walls = ["n", "s", "w", "e"];
      let placed = false;
      for (let wi = 0; wi < walls.length && !placed; wi++) {
        const idx = Math.floor(rng() * walls.length);
        const w = walls.splice(idx, 1)[0];
        const pos = placeAgainstWall(room, w, rng);
        if (pos) {
          placedItems.push({
            id: "bookshelf-" + room.id,
            gridX: pos.x, gridY: pos.y,
            type: "bookshelf",
            visible: true,
            rotation: pos.rotation,
          });
          placed = true;
        }
      }
    }

    placeRoomTrap(room);
  }

  function placeRoomTrap(room) {
    const area = room.rect.w * room.rect.h;
    let chance;
    if (area > 30) chance = 0.25;
    else if (area > 15) chance = 0.2;
    else chance = 0.1;
    if (rng() >= chance) return;

    // Position: try near existing chest in room, else random interior
    const chests = placedItems.filter(function (i) {
      return i.type === "chest" && i.id.indexOf("-" + room.id) !== -1;
    });
    let tx, ty;
    if (chests.length > 0 && rng() < 0.4) {
      const chest = pick(chests, rng);
      const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      const valid = dirs.filter(function (d) {
        const nx = chest.gridX + d[0], ny = chest.gridY + d[1];
        return rectContains(room.rect, nx, ny) && !grid[ny][nx];
      });
      if (valid.length > 0) {
        const d = pick(valid, rng);
        tx = chest.gridX + d[0];
        ty = chest.gridY + d[1];
      } else {
        tx = room.rect.x + 1 + Math.floor(rng() * Math.max(1, room.rect.w - 2));
        ty = room.rect.y + 1 + Math.floor(rng() * Math.max(1, room.rect.h - 2));
      }
    } else {
      tx = room.rect.x + 1 + Math.floor(rng() * Math.max(1, room.rect.w - 2));
      ty = room.rect.y + 1 + Math.floor(rng() * Math.max(1, room.rect.h - 2));
    }

    placedItems.push({
      id: "trap-" + room.id + "-" + tx + "-" + ty,
      gridX: tx,
      gridY: ty,
      type: "trap",
      trapType: pick(["pit", "dart", "glyph"], rng),
      visible: false,
    });
  }

  function addSmallRoomFurniture(room) {
    const c = rectCenter(room.rect);
    const usedWalls = room._torchWalls || [];
    const roll = rng();

    if (roll < 0.3) {
      const wall = pickWall(room, rng, usedWalls);
      const pos = placeAlongWall(room, wall, rng);
      placedItems.push({
        id: "chest-" + room.id,
        gridX: pos.x, gridY: pos.y,
        type: "chest",
        visible: true,
        rotation: pos.rotation,
      });
    } else if (roll < 0.5) {
      placedItems.push({
        id: "crate-" + room.id,
        gridX: c[0], gridY: c[1],
        type: "crate",
        visible: true,
      });
    } else if (roll < 0.65) {
      placedItems.push({
        id: "web-" + room.id,
        gridX: c[0], gridY: c[1],
        type: "web",
        visible: true,
      });
    }

    placeRoomTrap(room);
  }

  // ---- 6. Corridor traps ----
  (function placeCorridorTraps() {
    const cells = Object.keys(corridorCells).map(function (k) {
      return k.split(",").map(Number);
    });
    // Place 1 trap per ~60 corridor cells in junctions or long passages
    const trapCount = Math.max(0, Math.floor(cells.length / 60));
    const junctions = cells.filter(function (c) {
      return openNeighborCount(c[0], c[1]) >= 3;
    });
    const shuffled = junctions.slice().sort(function () { return rng() - 0.5; });
    for (let i = 0; i < Math.min(trapCount, shuffled.length); i++) {
      const [tx, ty] = shuffled[i];
      placedItems.push({
        id: "corridor-trap-" + tx + "-" + ty,
        gridX: tx,
        gridY: ty,
        type: "trap",
        trapType: "pit",
        visible: false,
      });
    }
  })();

  // ---- 7. Build output ----
  const walls = [];
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      if (grid[y][x]) walls.push(x + "," + y);
    }
  }

  // Deduplicate doors by position (two rooms may place a door at the same cell)
  const seenDoorPos = {};
  const uniqueDoors = [];
  for (let d = 0; d < finalDoors.length; d++) {
    const key = finalDoors[d].x + "," + finalDoors[d].y;
    if (!seenDoorPos[key]) {
      seenDoorPos[key] = true;
      uniqueDoors.push(finalDoors[d]);
    }
  }

  // Remove adjacent door pairs from opposite sides of corridors.
  // When a corridor separates two rooms, both place a door producing
  // side-by-side doors. Remove the second door of each adjacent pair.
  const doorPosSet2 = {};
  for (const d of uniqueDoors) {
    doorPosSet2[d.x + "," + d.y] = d;
  }
  const toRemoveAdj = new Set();
  for (const d of uniqueDoors) {
    if (toRemoveAdj.has(d.x + "," + d.y)) continue;
    // Check right neighbor
    const rightKey = (d.x + 1) + "," + d.y;
    if (doorPosSet2[rightKey] && !toRemoveAdj.has(rightKey)) {
      toRemoveAdj.add(rightKey);
    }
    // Check bottom neighbor
    const bottomKey = d.x + "," + (d.y + 1);
    if (doorPosSet2[bottomKey] && !toRemoveAdj.has(bottomKey)) {
      toRemoveAdj.add(bottomKey);
    }
  }
  const trimmedDoors = uniqueDoors.filter(d => !toRemoveAdj.has(d.x + "," + d.y));

  const doorPairs = {};
  for (let d = 0; d < trimmedDoors.length; d++) {
    const door = trimmedDoors[d];
    let paired = false;
    for (let key in doorPairs) {
      const existing = doorPairs[key];
      const sameRow = Math.abs(existing.y - door.y) <= 1 && existing.x !== door.x;
      const sameCol = Math.abs(existing.x - door.x) <= 1 && existing.y !== door.y;
      if (sameRow || sameCol) {
        existing.pair = door;
        paired = true;
        break;
      }
    }
    if (!paired) {
      doorPairs[d] = { door: door, pair: null };
    }
  }

  let doorIndex = 0;
  for (let key in doorPairs) {
    const { door, pair } = doorPairs[key];
    placedItems.push({
      id: "door-" + doorIndex,
      gridX: door.x,
      gridY: door.y,
      type: door.doorType,
      visible: door.doorType !== "secretDoor",
      rotation: door.rotation,
    });
    if (door.doorType === "secretDoor") {
      grid[door.y][door.x] = true;
      walls.push(door.x + "," + door.y);
    }
    doorIndex++;
    if (pair) {
      placedItems.push({
        id: "door-" + doorIndex,
        gridX: pair.x,
        gridY: pair.y,
        type: pair.doorType,
        visible: pair.doorType !== "secretDoor",
        rotation: pair.rotation,
      });
      if (pair.doorType === "secretDoor") {
        grid[pair.y][pair.x] = true;
        walls.push(pair.x + "," + pair.y);
      }
      doorIndex++;
    }
  }

  const npcNames = ["Goblin", "Skeleton", "Orc", "Bandit", "Spider", "Zombie"];
  const npcRots = [0, 90, 180, 270];
  for (let i = 1; i < Math.min(rooms.length, 8); i++) {
    const room = rooms[i];
    // Find unoccupied floor cell near room center for NPC
    const c = rectCenter(room.rect);
    const offsets = [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]];
    let nx = c[0], ny = c[1];
    for (let oi = 0; oi < offsets.length; oi++) {
      const ox = c[0] + offsets[oi][0], oy = c[1] + offsets[oi][1];
      if (
        ox >= 0 && ox < gridSize && oy >= 0 && oy < gridSize &&
        !grid[oy][ox] &&
        !isOccupied(room, ox, oy)
      ) {
        nx = ox; ny = oy;
        break;
      }
    }
    markOccupied(room, nx, ny);
    placedItems.push({
      id: "npc-" + (i - 1),
      gridX: nx,
      gridY: ny,
      type: "npc",
      visible: false,
      name: pick(npcNames, rng),
      rotation: pick(npcRots, rng),
    });
  }

  // Place entrance stairs (pushed last so it wins in dedup)
  let ex = -1, ey = -1, bestDist = Infinity;
  const corridorKeys = Object.keys(corridorCells);
  for (let ci = corridorKeys.length - 1; ci > 0; ci--) {
    const cj = Math.floor(rng() * (ci + 1));
    const tmp = corridorKeys[ci];
    corridorKeys[ci] = corridorKeys[cj];
    corridorKeys[cj] = tmp;
  }
  for (let ci = 0; ci < corridorKeys.length; ci++) {
    const [cx, cy] = corridorKeys[ci].split(",").map(Number);
    const dx = Math.min(cx, gridSize - 1 - cx);
    const dy = Math.min(cy, gridSize - 1 - cy);
    const d = Math.min(dx, dy);
    if (d < bestDist) {
      bestDist = d;
      ex = cx; ey = cy;
    }
  }
  if (ex === -1 && rooms.length > 0) {
    const ec = rectCenter(rooms[0].rect);
    ex = ec[0]; ey = ec[1];
  }
  placedItems.push({
    id: "entrance-stairs",
    gridX: ex,
    gridY: ey,
    type: "stairs",
    visible: true,
  });

  // Deduplicate placed items by position (last item at a position wins)
  const seenPos = {};
  const dedupedItems = [];
  for (let i = placedItems.length - 1; i >= 0; i--) {
    const item = placedItems[i];
    const key = item.gridX + "," + item.gridY;
    if (!seenPos[key]) {
      seenPos[key] = true;
      dedupedItems.unshift(placedItems[i]);
    }
  }

  return {
    name: generateName(rng),
    description: generateDescription(rng),
    gridSize: gridSize,
    seed: opts.seed != null ? opts.seed : Math.floor(Math.random() * 2147483647),
    walls: walls,
    placedItems: dedupedItems,
    players: [],
    zoom: 1,
    panX: 0,
    panY: 0
  };
}

// ---------------------------------------------------------------------------
// Room Adjacency Generator — rooms connected to other rooms directly,
// sharing walls with door openings instead of long L-shaped corridors.
// ---------------------------------------------------------------------------
const ROOM_TYPE_POOL = {
  entrance: { label: 'Entrance Hall', furnishing: 'entrance' },
  common: { label: 'Common Room', furnishing: 'common' },
  utility: { label: 'Storage', furnishing: 'utility' },
  private: { label: 'Chamber', furnishing: 'private' },
  grand: { label: 'Grand Hall', furnishing: 'grand' },
  hall: { label: 'Hallway', furnishing: 'hall' },
};

export function generateAdjacentDungeon(opts) {
  opts = opts || {};
  const gridSize = opts.gridSize || 30;
  const density = opts.density != null ? Math.max(0, Math.min(1, opts.density)) : 0.5;
  const rng = opts.seed != null ? mulberry32(opts.seed) : Math.random.bind(Math);

  const layoutStyle = opts.layoutStyle || 'balanced'; // 'linear' | 'forking' | 'balanced' | 'winding'

  // Grid: true = wall, false = floor
  const grid = [];
  for (let y = 0; y < gridSize; y++) {
    const row = [];
    for (let x = 0; x < gridSize; x++) row.push(true);
    grid.push(row);
  }


  const minRoom = Math.max(4, Math.floor(gridSize / 8));
  const maxRoom = Math.max(8, Math.min(18, Math.floor(gridSize / 2.5)));

  const targetRooms = opts.roomCount != null
    ? opts.roomCount
    : Math.max(4, Math.floor((gridSize - 4) / 3 * (0.5 + density * 0.5)));

  const rooms = [];
  const placedItems = [];

  // ---- Helper: carve a room rect into the grid ----
  function carveRoomRect(r) {
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) {
        if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
          grid[y][x] = false;
        }
      }
    }
  }

  // ---- Helper: check if a rect overlaps existing rooms (with padding) ----
  function overlapsExisting(rect, pad) {
    pad = pad != null ? pad : 1;
    for (const room of rooms) {
      if (rectIntersects(room.rect, rect, pad)) return true;
    }
    return false;
  }

  // ---- Helper: find shared edge between two rects ----
  // Rooms are placed with a 1-cell gap between them (the wall).
  // Returns { side, overlapStart, overlapEnd } or null
  function findSharedEdge(a, b) {
    // a is existing, b is new
    // Check if b is north of a (b's bottom edge + 1 = a's top edge)
    if (b.y + b.h + 1 === a.y) {
      const overlapStart = Math.max(b.x, a.x);
      const overlapEnd = Math.min(b.x + b.w - 1, a.x + a.w - 1);
      if (overlapStart <= overlapEnd) return { side: 'n', overlapStart, overlapEnd, wallY: a.y - 1 };
    }
    // Check if b is south of a
    if (b.y === a.y + a.h + 1) {
      const overlapStart = Math.max(b.x, a.x);
      const overlapEnd = Math.min(b.x + b.w - 1, a.x + a.w - 1);
      if (overlapStart <= overlapEnd) return { side: 's', overlapStart, overlapEnd, wallY: a.y + a.h };
    }
    // Check if b is west of a
    if (b.x + b.w + 1 === a.x) {
      const overlapStart = Math.max(b.y, a.y);
      const overlapEnd = Math.min(b.y + b.h - 1, a.y + a.h - 1);
      if (overlapStart <= overlapEnd) return { side: 'w', overlapStart, overlapEnd, wallX: a.x - 1 };
    }
    // Check if b is east of a
    if (b.x === a.x + a.w + 1) {
      const overlapStart = Math.max(b.y, a.y);
      const overlapEnd = Math.min(b.y + b.h - 1, a.y + a.h - 1);
      if (overlapStart <= overlapEnd) return { side: 'e', overlapStart, overlapEnd, wallX: a.x + a.w };
    }
    return null;
  }

  // ---- Helper: place a door on a shared edge ----
  function placeDoorAtEdge(edge, aId, bId) {
    let dx, dy, rotation;
    const mid = Math.floor((edge.overlapStart + edge.overlapEnd) / 2);
    if (edge.side === 'n' || edge.side === 's') {
      dx = mid;
      dy = edge.wallY;
      rotation = 90;
    } else {
      dx = edge.wallX;
      dy = mid;
      rotation = 0;
    }
    // Ensure door is within bounds
    if (dx < 0 || dx >= gridSize || dy < 0 || dy >= gridSize) return null;
    // Check the door cell is currently a wall (shared wall to remove)
    if (!grid[dy][dx]) return null;

    // Remove the wall cell at the door position
    grid[dy][dx] = false;

    return {
      id: 'door-' + aId + '-' + bId,
      gridX: dx,
      gridY: dy,
      type: 'door',
      visible: true,
      rotation: rotation,
    };
  }

  // ---- 1. Place seed room ----
  const seedW = minRoom + Math.floor(rng() * (maxRoom - minRoom + 1));
  const seedH = minRoom + Math.floor(rng() * (maxRoom - minRoom + 1));
  let seedX = 2 + Math.floor(rng() * Math.max(1, gridSize - seedW - 4));
  let seedY = 2 + Math.floor(rng() * Math.max(1, gridSize - seedH - 4));

  rooms.push({ rect: { x: seedX, y: seedY, w: seedW, h: seedH }, id: 0, connected: [], type: 'entrance' });
  carveRoomRect(rooms[0].rect);

  // ---- 2. Place remaining rooms adjacent to existing ones ----
  const maxAttempts = targetRooms * 30;
  let attempts = 0;
  let failureStreak = 0;

  while (rooms.length < targetRooms && attempts < maxAttempts) {
    attempts++;

    // Pick a source room — prefer recently added for clustering, random for spread
    let srcIdx;
    if (layoutStyle === 'linear' && rooms.length > 1) {
      // Linear: always extend from the last room placed
      srcIdx = rooms.length - 1;
    } else if (layoutStyle === 'forking') {
      // Forking: extend from a room with few connections
      const candidates = rooms.filter(r => r.connected.length < 2);
      srcIdx = candidates.length > 0 ? rooms.indexOf(pick(candidates, rng)) : Math.floor(rng() * rooms.length);
    } else if (layoutStyle === 'winding') {
      // Winding: extend from the room placed most recently
      srcIdx = rooms.length - 1;
    } else {
      // Balanced: random existing room
      srcIdx = Math.floor(rng() * rooms.length);
    }

    const srcRoom = rooms[srcIdx];
    const newW = minRoom + Math.floor(rng() * (maxRoom - minRoom + 1));
    const newH = minRoom + Math.floor(rng() * (maxRoom - minRoom + 1));

    const { x: sx, y: sy, w: sw, h: sh } = srcRoom.rect;
    const sides = ['n', 's', 'w', 'e'].sort(() => rng() - 0.5);

    let placed = false;
    for (const side of sides) {
      let nx, ny;

      switch (side) {
        case 'n':
          nx = sx - Math.floor(newW / 2) + Math.floor(rng() * Math.min(newW, Math.max(1, sw)));
          ny = sy - newH - 1; // 1-cell gap for wall
          break;
        case 's':
          nx = sx - Math.floor(newW / 2) + Math.floor(rng() * Math.min(newW, Math.max(1, sw)));
          ny = sy + sh + 1; // 1-cell gap for wall
          break;
        case 'w':
          nx = sx - newW - 1; // 1-cell gap for wall
          ny = sy - Math.floor(newH / 2) + Math.floor(rng() * Math.min(newH, Math.max(1, sh)));
          break;
        case 'e':
          nx = sx + sw + 1; // 1-cell gap for wall
          ny = sy - Math.floor(newH / 2) + Math.floor(rng() * Math.min(newH, Math.max(1, sh)));
          break;
      }

      // Clamp to stay within grid (minimum 1-cell border for walls)
      nx = Math.max(1, Math.min(nx, gridSize - newW - 1));
      ny = Math.max(1, Math.min(ny, gridSize - newH - 1));

      const newRect = { x: nx, y: ny, w: newW, h: newH };

      // Validate: no overlap with existing rooms (padding=0 allows directly adjacent)
      if (overlapsExisting(newRect, 0)) continue;

      // Find shared edge with source room
      const edge = findSharedEdge(srcRoom.rect, newRect);
      if (!edge) continue;

      // Carve the new room
      const roomId = rooms.length;
      carveRoomRect(newRect);

      // Place door where the rooms share a wall
      const door = placeDoorAtEdge(edge, srcRoom.id, roomId);
      if (door) {
        placedItems.push(door);
      }

      const roomObj = { rect: newRect, id: roomId, connected: [srcRoom.id], type: 'common' };
      rooms.push(roomObj);
      srcRoom.connected.push(roomId);
      placed = true;
      break;
    }

    if (!placed) {
      failureStreak++;
      if (failureStreak > 50) break;
      continue;
    }
    failureStreak = 0;
  }

  // ---- 3. Add halls/passages connecting unconnected room clusters ----
  // Find clusters of connected rooms via BFS
  function findClusters() {
    const visited = new Set();
    const clusters = [];
    for (const room of rooms) {
      if (visited.has(room.id)) continue;
      const cluster = [];
      const queue = [room.id];
      while (queue.length > 0) {
        const id = queue.shift();
        if (visited.has(id)) continue;
        visited.add(id);
        cluster.push(id);
        const r = rooms.find(rr => rr.id === id);
        if (r) {
          for (const cid of r.connected) {
            if (!visited.has(cid)) queue.push(cid);
          }
        }
      }
      clusters.push(cluster);
    }
    return clusters;
  }

  // Connect clusters with short passages
  for (let ci = 0; ci < 5; ci++) {
    const clusters = findClusters();
    if (clusters.length <= 1) break;

    // Connect first cluster to second cluster
    const c1 = clusters[0];
    const c2 = clusters[1];
    let bestDist = Infinity;
    let bestA = null, bestB = null;

    for (const id1 of c1) {
      const r1 = rooms.find(r => r.id === id1);
      if (!r1) continue;
      for (const id2 of c2) {
        const r2 = rooms.find(r => r.id === id2);
        if (!r2) continue;
        const c1pos = rectCenter(r1.rect);
        const c2pos = rectCenter(r2.rect);
        const dist = Math.abs(c1pos[0] - c2pos[0]) + Math.abs(c1pos[1] - c2pos[1]);
        if (dist < bestDist) {
          bestDist = dist;
          bestA = r1;
          bestB = r2;
        }
      }
    }

    if (bestA && bestB) {
      // Short L-shaped corridor between closest rooms
      const ca = rectCenter(bestA.rect);
      const cb = rectCenter(bestB.rect);
      // Carve narrow passage
      if (rng() < 0.5) {
        for (let x = Math.min(ca[0], cb[0]); x <= Math.max(ca[0], cb[0]); x++) {
          if (x >= 0 && x < gridSize && ca[1] >= 0 && ca[1] < gridSize) grid[ca[1]][x] = false;
        }
        for (let y = Math.min(ca[1], cb[1]); y <= Math.max(ca[1], cb[1]); y++) {
          if (cb[0] >= 0 && cb[0] < gridSize && y >= 0 && y < gridSize) grid[y][cb[0]] = false;
        }
      } else {
        for (let y = Math.min(ca[1], cb[1]); y <= Math.max(ca[1], cb[1]); y++) {
          if (ca[0] >= 0 && ca[0] < gridSize && y >= 0 && y < gridSize) grid[y][ca[0]] = false;
        }
        for (let x = Math.min(ca[0], cb[0]); x <= Math.max(ca[0], cb[0]); x++) {
          if (x >= 0 && x < gridSize && cb[1] >= 0 && cb[1] < gridSize) grid[cb[1]][x] = false;
        }
      }
      bestA.connected.push(bestB.id);
      bestB.connected.push(bestA.id);
    }
  }

  // ---- 4. Assign room types ----
  function assignRoomTypes() {
    // Entrance is already assigned to room 0
    // Grand rooms: deepest room(s) with most connections, or largest rooms
    const sortedByConnections = [...rooms].sort((a, b) => b.connected.length - a.connected.length);
    if (sortedByConnections.length > 1) {
      let grandRoom;
      if (sortedByConnections[0].id !== 0) {
        grandRoom = sortedByConnections[0];
      } else if (sortedByConnections.length > 1) {
        grandRoom = sortedByConnections[1];
      }
      if (grandRoom) grandRoom.type = 'grand';
    }

    for (const room of rooms) {
      if (room.type !== 'common') continue;
      if (room.rect.w * room.rect.h < minRoom * minRoom + 4) {
        room.type = 'utility';
      } else if (room.connected.length === 1 && room.type === 'common') {
        room.type = 'private';
      } else if (room.rect.w * room.rect.h > maxRoom * maxRoom * 0.7) {
        room.type = 'grand';
      }
      if (room.type === 'common') {
        room.type = pick(['common', 'utility', 'private'], rng);
      }
    }
  }
  assignRoomTypes();

  // ---- 5. Furnish based on room type ----
  function furnishRoom(room) {
    const cx = room.rect.x + Math.floor(room.rect.w / 2);
    const cy = room.rect.y + Math.floor(room.rect.h / 2);
    const rx = room.rect.x, ry = room.rect.y;
    const rw = room.rect.w, rh = room.rect.h;
    const rightX = rx + rw - 1, bottomY = ry + rh - 1;

    switch (room.type) {
      case 'entrance':
        placedItems.push({ id: 'torch-' + room.id + '-0', gridX: cx, gridY: ry, type: 'torch', visible: true, rotation: 90 });
        if (rw >= 4) placedItems.push({ id: 'torch-' + room.id + '-1', gridX: rx + 1, gridY: ry, type: 'torch', visible: true, rotation: 90 });
        if (rng() < 0.4) placedItems.push({ id: 'statue-' + room.id, gridX: cx, gridY: ry + 1, type: 'statue', visible: true });
        break;

      case 'common':
        if (rw >= 4 && rh >= 3) {
          placedItems.push({ id: 'table-' + room.id, gridX: cx - 1, gridY: cy, type: 'table', visible: true, rotation: 0 });
          placedItems.push({ id: 'chair-' + room.id + '-0', gridX: cx - 1, gridY: cy - 1, type: 'chair', visible: true, rotation: 0 });
          placedItems.push({ id: 'chair-' + room.id + '-1', gridX: cx, gridY: cy - 1, type: 'chair', visible: true, rotation: 0 });
        }
        if (rng() < 0.5 && rw >= 5 && rh >= 4) placedItems.push({ id: 'firepit-' + room.id, gridX: cx, gridY: cy, type: 'firepit', visible: true });
        placedItems.push({ id: 'torch-' + room.id + '-0', gridX: cx, gridY: ry, type: 'torch', visible: true, rotation: 90 });
        if (rng() < 0.5) placedItems.push({ id: 'barrel-' + room.id, gridX: rightX, gridY: bottomY, type: 'barrel', visible: true });
        break;

      case 'utility':
        placedItems.push({ id: 'crate-' + room.id + '-0', gridX: rx, gridY: ry, type: 'crate', visible: true });
        placedItems.push({ id: 'crate-' + room.id + '-1', gridX: rightX, gridY: ry, type: 'crate', visible: true });
        placedItems.push({ id: 'barrel-' + room.id + '-0', gridX: rx, gridY: bottomY, type: 'barrel', visible: true });
        if (rng() < 0.5) placedItems.push({ id: 'crate-' + room.id + '-2', gridX: rightX, gridY: bottomY, type: 'crate', visible: true });
        if (rng() < 0.4) placedItems.push({ id: 'web-' + room.id, gridX: cx, gridY: cy, type: 'web', visible: true });
        break;

      case 'private':
        placedItems.push({ id: 'bed-' + room.id, gridX: rx, gridY: ry, type: 'bed', visible: true, rotation: 0 });
        placedItems.push({ id: 'chest-' + room.id, gridX: rightX, gridY: ry, type: 'chest', visible: true });
        placedItems.push({ id: 'bookshelf-' + room.id, gridX: rx, gridY: bottomY, type: 'bookshelf', visible: true, rotation: 0 });
        if (rng() < 0.4) placedItems.push({ id: 'chair-' + room.id, gridX: cx, gridY: cy, type: 'chair', visible: true });
        if (rng() < 0.4) placedItems.push({ id: 'barrel-' + room.id, gridX: rightX, gridY: ry + 1, type: 'barrel', visible: true });
        break;

      case 'grand':
        placedItems.push({ id: 'altar-' + room.id, gridX: cx - 1, gridY: cy, type: 'altar', visible: true, rotation: 0 });
        if (rw >= 6 && rh >= 6) {
          placedItems.push({ id: 'pillar-' + room.id + '-0', gridX: rx + 1, gridY: ry + 1, type: 'pillar', visible: true });
          placedItems.push({ id: 'pillar-' + room.id + '-1', gridX: rightX - 1, gridY: ry + 1, type: 'pillar', visible: true });
          placedItems.push({ id: 'pillar-' + room.id + '-2', gridX: rx + 1, gridY: bottomY - 1, type: 'pillar', visible: true });
          placedItems.push({ id: 'pillar-' + room.id + '-3', gridX: rightX - 1, gridY: bottomY - 1, type: 'pillar', visible: true });
        }
        placedItems.push({ id: 'torch-' + room.id + '-0', gridX: cx, gridY: ry, type: 'torch', visible: true, rotation: 90 });
        placedItems.push({ id: 'torch-' + room.id + '-1', gridX: cx, gridY: bottomY, type: 'torch', visible: true, rotation: 270 });
        if (rng() < 0.4) placedItems.push({ id: 'fountain-' + room.id, gridX: cx, gridY: cy + 1, type: 'fountain', visible: true });
        break;

      case 'hall':
        if (rw >= 4) {
          placedItems.push({ id: 'torch-' + room.id + '-0', gridX: rx + 1, gridY: ry, type: 'torch', visible: true, rotation: 90 });
          placedItems.push({ id: 'torch-' + room.id + '-1', gridX: rightX - 1, gridY: ry, type: 'torch', visible: true, rotation: 90 });
        }
        if (rng() < 0.3) placedItems.push({ id: 'statue-' + room.id, gridX: cx, gridY: cy, type: 'statue', visible: true });
        break;
    }
  }

  for (const room of rooms) {
    furnishRoom(room);
  }

  // ---- 6. Place NPCs ----
  const npcNames = ['Goblin', 'Skeleton', 'Orc', 'Bandit', 'Spider', 'Zombie'];
  const npcRots = [0, 90, 180, 270];
  const occupiedCells = new Set();
  for (const item of placedItems) {
    occupiedCells.add(item.gridX + ',' + item.gridY);
  }

  for (let i = 1; i < Math.min(rooms.length, 8); i++) {
    const room = rooms[i];
    const c = rectCenter(room.rect);
    const offsets = [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]];
    let nx = c[0], ny = c[1];
    for (let oi = 0; oi < offsets.length; oi++) {
      const ox = c[0] + offsets[oi][0], oy = c[1] + offsets[oi][1];
      if (ox >= 0 && ox < gridSize && oy >= 0 && oy < gridSize && !grid[oy][ox] && !occupiedCells.has(ox + ',' + oy)) {
        nx = ox; ny = oy;
        break;
      }
    }
    occupiedCells.add(nx + ',' + ny);
    placedItems.push({
      id: 'npc-' + (i - 1),
      gridX: nx, gridY: ny,
      type: 'npc',
      visible: false,
      name: pick(npcNames, rng),
      rotation: pick(npcRots, rng),
    });
  }

  // ---- 7. Place entrance stairs (in the entrance room) ----
  const entranceRoom = rooms[0];
  if (entranceRoom) {
    const ec = rectCenter(entranceRoom.rect);
    placedItems.push({
      id: 'entrance-stairs',
      gridX: ec[0],
      gridY: ec[1],
      type: 'stairs',
      visible: true,
    });
  }

  // ---- 8. Place secret doors and traps ----
  const occCells = new Set();
  for (const item of placedItems) {
    occCells.add(item.gridX + ',' + item.gridY);
  }
  const secDoorCandidates = [];
  for (const room of rooms) {
    const { x: rx, y: ry, w: rw, h: rh } = room.rect;
    for (let x = rx; x < rx + rw; x++) {
      if (ry > 0 && grid[ry - 1][x]) secDoorCandidates.push({ x, y: ry - 1 });
      if (ry + rh < gridSize && grid[ry + rh][x]) secDoorCandidates.push({ x, y: ry + rh });
    }
    for (let y = ry; y < ry + rh; y++) {
      if (rx > 0 && grid[y][rx - 1]) secDoorCandidates.push({ x: rx - 1, y });
      if (rx + rw < gridSize && grid[y][rx + rw]) secDoorCandidates.push({ x: rx + rw, y });
    }
  }
  let secDoorsPlaced = 0;
  const shuffledSec = [...secDoorCandidates].sort(() => rng() - 0.5);
  for (const c of shuffledSec) {
    if (secDoorsPlaced >= 3) break;
    const key = c.x + ',' + c.y;
    if (!occCells.has(key)) {
      occCells.add(key);
      placedItems.push({ id: 'secret-door-' + secDoorsPlaced, gridX: c.x, gridY: c.y, type: 'secretdoor', visible: false });
      secDoorsPlaced++;
    }
  }

  const trapCandidates = [];
  for (const room of rooms) {
    if (room.type === 'entrance' || room.type === 'grand') continue;
    const { x: rx, y: ry, w: rw, h: rh } = room.rect;
    for (let x = rx + 1; x < rx + rw - 1; x++) {
      for (let y = ry + 1; y < ry + rh - 1; y++) {
        if (!grid[y][x] && !occCells.has(x + ',' + y)) {
          trapCandidates.push({ x, y });
        }
      }
    }
  }
  let trapsPlaced = 0;
  const shuffledTraps = [...trapCandidates].sort(() => rng() - 0.5);
  for (const c of shuffledTraps) {
    if (trapsPlaced >= 2) break;
    placedItems.push({ id: 'trap-' + trapsPlaced, gridX: c.x, gridY: c.y, type: 'trap', visible: false });
    trapsPlaced++;
  }

  // ---- 9. Deduplicate placed items ----
  const seenPos = {};
  const dedupedItems = [];
  for (let i = placedItems.length - 1; i >= 0; i--) {
    const item = placedItems[i];
    const key = item.gridX + ',' + item.gridY;
    if (!seenPos[key]) {
      seenPos[key] = true;
      dedupedItems.unshift(item);
    }
  }

  // ---- 10. Build wall list ----
  const walls = [];
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      if (grid[y][x]) walls.push(x + ',' + y);
    }
  }

  // ---- 11. Serialize rooms (strip internal fields) ----
  const serializedRooms = rooms.map(r => ({
    id: r.id,
    rect: { ...r.rect },
    type: r.type,
    label: ROOM_TYPE_POOL[r.type] ? ROOM_TYPE_POOL[r.type].label : '',
    connectedTo: [...r.connected],
  }));

  return {
    name: generateName(rng),
    description: generateDescription(rng),
    gridSize: gridSize,
    seed: opts.seed != null ? opts.seed : Math.floor(Math.random() * 2147483647),
    walls: walls,
    placedItems: dedupedItems,
    players: [],
    zoom: 1,
    panX: 0,
    panY: 0,
    rooms: serializedRooms,
    generationMode: 'adjacent',
  };
}

// ---------------------------------------------------------------------------
// ASCII visualiser
// ---------------------------------------------------------------------------
export function visualize(map) {
  const g = [];
  for (let y = 0; y < map.gridSize; y++) {
    const row = [];
    for (let x = 0; x < map.gridSize; x++) row.push("\u2588");
    g.push(row);
  }

  const ws = {};
  for (let i = 0; i < map.walls.length; i++) {
    ws[map.walls[i]] = true;
  }

  for (let y = 0; y < map.gridSize; y++) {
    for (let x = 0; x < map.gridSize; x++) {
      if (!ws[x + "," + y]) g[y][x] = "\u00b7";
    }
  }

  for (let i = 0; i < map.placedItems.length; i++) {
    const item = map.placedItems[i];
    if (
      item.gridY < map.gridSize &&
      item.gridX < map.gridSize
    ) {
      if (item.type === "secretDoor") {
        g[item.gridY][item.gridX] = "s";
      } else if (item.type === "door") {
        g[item.gridY][item.gridX] = "+";
      } else if (item.type === "stairs") {
        g[item.gridY][item.gridX] = ">";
      } else if (item.type === "npc") {
        g[item.gridY][item.gridX] = "@";
      } else if (item.type === "chest") {
        g[item.gridY][item.gridX] = "=";
      } else if (item.type === "altar") {
        g[item.gridY][item.gridX] = "A";
      } else if (item.type === "trap") {
        g[item.gridY][item.gridX] = "^";
      }
    }
  }

  return g.map(function (row) {
    return row.join("");
  }).join("\n");
}

// ---------------------------------------------------------------------------
// Name / description generators
// ---------------------------------------------------------------------------
function generateName(rng) {
  const prefixes = [
    "Ancient", "Forgotten", "Cursed", "Haunted", "Lost", "Hidden",
    "Sunken", "Crimson", "Shadow", "Iron", "Crystal", "Dark",
  ];
  const types = [
    "Dungeon", "Crypt", "Tomb", "Catacombs", "Keep", "Tower",
    "Mines", "Temple", "Sanctum", "Vault", "Caverns", "Hall",
  ];
  const suffixes = [
    "of Doom", "of Shadows", "of the Dead", "of Despair",
    "of the Ancients", "of Whispers", "of the Forgotten King",
    "of the Dark Lord", "of Eternal Night", "",
  ];
  return (
    "The " +
    pick(prefixes, rng) +
    " " +
    pick(types, rng) +
    " " +
    pick(suffixes, rng)
  ).trim();
}

function generateDescription(rng) {
  const intros = [
    "A long-forgotten dungeon complex deep underground.",
    "Ancient stone walls covered in mysterious runes line these halls.",
    "The air is thick with dust and the smell of decay.",
    "Torchlight flickers across walls carved with strange symbols.",
    "This place has not seen living creatures in centuries.",
  ];
  const features = [
    "Rooms branch off in multiple directions, each more foreboding than the last.",
    "The sound of dripping water echoes through the corridors.",
    "Strange markings on the floor suggest ritual activity.",
    "Collapsed passages hint at the dungeon's age.",
    "The walls are lined with empty alcoves, their contents long since taken.",
  ];
  const threats = [
    "Something stirs in the darkness ahead.",
    "Traps and guardians still protect the dungeon's secrets.",
    "The undead are said to wander these halls.",
    "Only the brave \u2014 or foolish \u2014 dare enter.",
  ];
  return pick(intros, rng) + " " + pick(features, rng) + " " + pick(threats, rng);
}
