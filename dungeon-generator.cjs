/**
 * Dungeon Map Generator
 * Generates grid-based dungeon maps as JSON compatible with Paul's dnd-char-sheet app.
 * 
 * Works in Node.js and browsers. No dependencies.
 * 
 * Usage:
 *   // Node.js
 *   const { generateDungeon, visualize } = require('./dungeon-generator.js');
 *   const map = generateDungeon({ gridSize: 30, numRooms: [6, 10], seed: 42 });
 *   console.log(JSON.stringify(map, null, 2));
 *   console.log(visualize(map));
 * 
 *   // Or CLI:
 *   node dungeon-generator.js --grid-size 30 --rooms 6-10 --seed 42 --ascii
 * 
 *   // Browser (ES module or globals)
 *   const map = generateDungeon({ gridSize: 30, numRooms: [6, 10] });
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

  split(rng, minSize, maxSize) {
    minSize = minSize || 4;
    maxSize = maxSize || 12;
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
      const x = this.rect.x + Math.floor(rng() * (this.rect.w - w + 1));
      const y = this.rect.y + Math.floor(rng() * (this.rect.h - h + 1));
      const room = { rect: { x, y, w, h }, id: rooms.length, connected: [] };
      this.room = room;
      rooms.push(room);
    }
  }
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------
function generateDungeon(opts) {
  opts = opts || {};
  const gridSize = opts.gridSize || 30;
  const numRooms = opts.numRooms || [6, 10];
  const minRooms = numRooms[0];
  const maxRooms = numRooms[1] || numRooms[0];
  const rng = opts.seed != null ? mulberry32(opts.seed) : Math.random.bind(Math);

  // Grid: true = wall, false = floor
  const grid = [];
  for (let y = 0; y < gridSize; y++) {
    const row = [];
    for (let x = 0; x < gridSize; x++) row.push(true);
    grid.push(row);
  }
  const corridorCells = {};
  const wallSet = {};

  // ---- 1. BSP rooms ----
  const padding = 2;
  const root = new BSPNode({
    x: padding,
    y: padding,
    w: gridSize - padding * 2,
    h: gridSize - padding * 2,
  });

  let nodes = [root];
  let splits = 0;
  while (nodes.length > 0 && splits < 20) {
    const node = nodes.shift();
    if (node.split(rng)) {
      if (node.left) nodes.push(node.left);
      if (node.right) nodes.push(node.right);
      splits++;
    }
    // If node can't split, it's a leaf – don't re-add it
  }

  let rooms = root.createRooms(rng, 3, 9);

  // If too few rooms, add random ones
  let attempts = 0;
  while (rooms.length < minRooms && attempts < 100) {
    const w = 3 + Math.floor(rng() * 5);
    const h = 3 + Math.floor(rng() * 5);
    const x = 2 + Math.floor(rng() * (gridSize - w - 4));
    const y = 2 + Math.floor(rng() * (gridSize - h - 4));
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

  if (rooms.length > maxRooms) {
    rooms = rooms.sort(function () {
      return rng() - 0.5;
    });
    rooms = rooms.slice(0, maxRooms);
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
    // Randomly choose L-shape: horizontal-first or vertical-first
    if (rng() < 0.5) {
      // Horizontal first, then vertical
      const xDir = ca[0] <= cb[0] ? 1 : -1;
      for (let x = ca[0]; x !== cb[0] + xDir; x += xDir) {
        carveCell(x, ca[1]);
      }
      const yDir = ca[1] <= cb[1] ? 1 : -1;
      for (let y = ca[1]; y !== cb[1] + yDir; y += yDir) {
        carveCell(cb[0], y);
      }
    } else {
      // Vertical first, then horizontal
      const yDir = ca[1] <= cb[1] ? 1 : -1;
      for (let y = ca[1]; y !== cb[1] + yDir; y += yDir) {
        carveCell(ca[0], y);
      }
      const xDir = ca[0] <= cb[0] ? 1 : -1;
      for (let x = ca[0]; x !== cb[0] + xDir; x += xDir) {
        carveCell(cb[1], x);
      }
    }
  }

  function carveCell(x, y) {
    if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
      grid[y][x] = false;
      corridorCells[x + "," + y] = true;
    }
  }

  // ---- 4. Place doors ----
  // Door position: at the corridor cell adjacent to the room wall (not inside the room).
  // Door rotation: determined by corridor direction through the door.
  //   Check cells around the door: if corridor continues N-S → rot=90, if E-W → rot=0
  //   (Matches your existing data: N-S corridor doors → 90, E-W corridor doors → 0)
  const doors = [];
  for (let r = 0; r < rooms.length; r++) {
    const room = rooms[r];
    const candidates = [];

    // North wall: corridor cell is at y = room.rect.y - 1
    for (let x = room.rect.x; x < room.rect.x + room.rect.w; x++) {
      if (corridorCells[x + "," + (room.rect.y - 1)])
        candidates.push([x, room.rect.y - 1]);
    }
    // South wall: corridor cell is at y = room.rect.y + room.rect.h
    for (let x = room.rect.x; x < room.rect.x + room.rect.w; x++) {
      if (corridorCells[x + "," + (room.rect.y + room.rect.h)])
        candidates.push([x, room.rect.y + room.rect.h]);
    }
    // West wall: corridor cell is at x = room.rect.x - 1
    for (let y = room.rect.y; y < room.rect.y + room.rect.h; y++) {
      if (corridorCells[room.rect.x - 1 + "," + y])
        candidates.push([room.rect.x - 1, y]);
    }
    // East wall: corridor cell is at x = room.rect.x + room.rect.w
    for (let y = room.rect.y; y < room.rect.y + room.rect.h; y++) {
      if (corridorCells[room.rect.x + room.rect.w + "," + y])
        candidates.push([room.rect.x + room.rect.w, y]);
    }

    for (let c = 0; c < candidates.length; c++) {
      const dx = candidates[c][0], dy = candidates[c][1];

      // Determine corridor direction: check if corridor continues N-S or E-W
      // A cell is "open" (floor/corridor) if it's not a wall
      const openN = dy > 0 && !grid[dy - 1][dx];
      const openS = dy < gridSize - 1 && !grid[dy + 1][dx];
      const openW = dx > 0 && !grid[dy][dx - 1];
      const openE = dx < gridSize - 1 && !grid[dy][dx + 1];

      const nsOpen = (openN ? 1 : 0) + (openS ? 1 : 0);
      const ewOpen = (openW ? 1 : 0) + (openE ? 1 : 0);

      // If more open directions are N-S → rot=90, if E-W → rot=0
      // Default to 0 if tied
      let rotation = 0;
      if (nsOpen > ewOpen) rotation = 90;

      // Check for double door: if corridor is 2 wide, there might be an adjacent door cell
      doors.push({
        x: dx,
        y: dy,
        rotation: rotation,
        doorType: rng() < 0.1 ? "secretDoor" : "door",
      });
    }
  }

  // Deduplicate doors that are too close (within 1 cell), keeping the first
  const finalDoors = [];
  for (let i = 0; i < doors.length; i++) {
    const d = doors[i];
    let tooClose = false;
    for (let j = 0; j < finalDoors.length; j++) {
      if (Math.abs(finalDoors[j].x - d.x) <= 1 && Math.abs(finalDoors[j].y - d.y) <= 1) {
        tooClose = true;
        break;
      }
    }
    if (!tooClose) finalDoors.push(d);
  }

  // ---- 5. Furniture ----
  const placedItems = [];

  for (let r = 0; r < rooms.length; r++) {
    placeTorches(rooms[r]);
    const area = rooms[r].rect.w * rooms[r].rect.h;
    if (area > 30) addLargeRoomFurniture(rooms[r]);
    else if (area > 15) addMediumRoomFurniture(rooms[r]);
    else addSmallRoomFurniture(rooms[r]);
  }

  function placeTorches(room) {
    // Rotation convention: 0=east, 90=south, 180=west, 270=north
    // Torch on a wall faces INTO the room. Only place if there's a wall cell behind.
    // Wall is behind the torch (opposite to facing direction):
    //   rot=0 (faces east)  → wall at (x-1, y)  [west wall]
    //   rot=90 (faces south) → wall at (x, y-1)  [north wall]
    //   rot=180 (faces west) → wall at (x+1, y)  [east wall]
    //   rot=270 (faces north)→ wall at (x, y+1)  [south wall]
    const torchDefs = [];

    const midX = room.rect.x + Math.floor(room.rect.w / 2);
    const midY = room.rect.y + Math.floor(room.rect.h / 2);

    // Helper: check if wall exists at (wx, wy)
    function isWall(wx, wy) {
      return wx >= 0 && wx < gridSize && wy >= 0 && wy < gridSize && grid[wy][wx];
    }

    // North wall: torch at (x, room.rect.y), faces south (rot=90), wall at (x, room.rect.y - 1)
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
    // South wall: torch at (x, room.rect.y + room.rect.h - 1), faces north (rot=270), wall at (x, room.rect.y + room.rect.h)
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
    // West wall: torch at (room.rect.x, y), faces east (rot=0), wall at (room.rect.x - 1, y)
    if (room.rect.x >= 2) {
      if (isWall(room.rect.x - 1, midY)) {
        torchDefs.push([room.rect.x, midY, 0]);
      }
    }
    // East wall: torch at (room.rect.x + room.rect.w - 1, y), faces west (rot=180), wall at (room.rect.x + room.rect.w, y)
    if (room.rect.x + room.rect.w < gridSize - 1) {
      var ex = room.rect.x + room.rect.w - 1;
      if (isWall(ex + 1, midY)) {
        torchDefs.push([ex, midY, 180]);
      }
    }

    // Deduplicate (in case midX equals room.rect.x+1 etc.)
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

  // Rotation helper: given a wall side, return the rotation for an item facing into the room
  // 0=east, 90=south, 180=west, 270=north
  function wallRotation(wall) {
    // Item on west wall faces east (0), on north wall faces south (90), etc.
    if (wall === "w") return 0;
    if (wall === "n") return 90;
    if (wall === "e") return 180;
    if (wall === "s") return 270;
    return 0;
  }

  // Pick a random wall that has enough room, preferring walls not already used by torches
  function pickWall(room, rng, usedWalls) {
    const walls = [];
    if (room.rect.y > 1) walls.push("n");
    if (room.rect.y + room.rect.h < gridSize - 1) walls.push("s");
    if (room.rect.x > 1) walls.push("w");
    if (room.rect.x + room.rect.w < gridSize - 1) walls.push("e");
    // Prefer walls not already used
    const fresh = walls.filter(w => !usedWalls.includes(w));
    return pick(fresh.length > 0 ? fresh : walls, rng);
  }

  // Place an item along a wall with proper rotation. Returns {x, y, rotation}.
  function placeAlongWall(room, wall, rng) {
    let x, y;
    const rot = wallRotation(wall);
    if (wall === "n") {
      x = room.rect.x + 1 + Math.floor(rng() * Math.max(1, room.rect.w - 2));
      y = room.rect.y + 1;
    } else if (wall === "s") {
      x = room.rect.x + 1 + Math.floor(rng() * Math.max(1, room.rect.w - 2));
      y = room.rect.y + room.rect.h - 2;
    } else if (wall === "w") {
      x = room.rect.x + 1;
      y = room.rect.y + 1 + Math.floor(rng() * Math.max(1, room.rect.h - 2));
    } else {
      x = room.rect.x + room.rect.w - 2;
      y = room.rect.y + 1 + Math.floor(rng() * Math.max(1, room.rect.h - 2));
    }
    return { x, y, rotation: rot };
  }

  function addLargeRoomFurniture(room) {
    const c = rectCenter(room.rect);
    const usedWalls = room._torchWalls || [];

    // Altar in center (no rotation needed for center placement)
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

    // Pillars in corners
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

    // Table (2 wide, horizontal) with chairs
    if (rng() < 0.5) {
      const tableX = c[0] - 1;
      const tableY = c[1];
      if (tableX >= room.rect.x && tableX + 1 < room.rect.x + room.rect.w) {
        placedItems.push({
          id: "table-" + room.id,
          gridX: tableX, gridY: tableY,
          type: "table",
          visible: true,
          rotation: 0, // 2-wide horizontal, default faces east
        });
        // Chairs around table with proper rotation
        const chairDefs = [
          { dx: 0, dy: -1, rot: 90 },   // above table, faces south
          { dx: 1, dy: -1, rot: 90 },   // above right, faces south
          { dx: 0, dy: 1, rot: 270 },   // below table, faces north
          { dx: 1, dy: 1, rot: 270 },   // below right, faces north
          { dx: -1, dy: 0, rot: 0 },    // left of table, faces east
          { dx: 2, dy: 0, rot: 180 },   // right of table, faces west
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

    // Chest along a wall
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

    // Bed along a wall (2 wide, horizontal, pillow against wall)
    if (rng() < 0.4) {
      const wall = pickWall(room, rng, usedWalls);
      let bx, by, rotation;
      if (wall === "n") {
        // Bed along north wall: pillow at north (top), extends south
        // Place at y+1, rotation 90 means pillow faces north (toward wall)
        bx = room.rect.x + 1 + Math.floor(rng() * Math.max(1, room.rect.w - 2));
        by = room.rect.y + 1;
        rotation = 90; // pillow faces north
      } else if (wall === "s") {
        bx = room.rect.x + 1 + Math.floor(rng() * Math.max(1, room.rect.w - 2));
        by = room.rect.y + room.rect.h - 2;
        rotation = 270; // pillow faces south
      } else if (wall === "w") {
        bx = room.rect.x + 1;
        by = room.rect.y + 1 + Math.floor(rng() * Math.max(1, room.rect.h - 2));
        rotation = 0; // pillow faces west (toward wall)... wait
        // Actually for west wall, pillow should be on the west side
        // rotation 0 = faces east, so pillow is on the west (back of sprite)
        // That's correct — the "face" direction is feet, pillow is opposite
        rotation = 0;
      } else {
        bx = room.rect.x + room.rect.w - 2;
        by = room.rect.y + 1 + Math.floor(rng() * Math.max(1, room.rect.h - 2));
        rotation = 180; // pillow faces east (toward west wall)... no
        // rotation 180 = faces west, so pillow is on the east (back of sprite)
        // For east wall, pillow should be on the east side (against wall)
        // So feet face west = rotation 180. Correct.
        rotation = 180;
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

    // Bookshelf along a wall (2 wide, horizontal)
    if (rng() < 0.3) {
      const wall = pickWall(room, rng, usedWalls);
      const pos = placeAlongWall(room, wall, rng);
      placedItems.push({
        id: "bookshelf-" + room.id,
        gridX: pos.x, gridY: pos.y,
        type: "bookshelf",
        visible: true,
        rotation: pos.rotation,
      });
      usedWalls.push(wall);
    }
  }

  function addMediumRoomFurniture(room) {
    const c = rectCenter(room.rect);
    const usedWalls = room._torchWalls || [];
    const roll = rng();

    if (roll < 0.3) {
      // Table (2 wide, horizontal) with chair
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
        // Chair above table, faces south
        if (rectContains(room.rect, c[0], c[1] - 1)) {
          placedItems.push({
            id: "chair-" + room.id,
            gridX: c[0], gridY: c[1] - 1,
            type: "chair",
            visible: true,
            rotation: 90,
          });
        }
      }
    } else if (roll < 0.5) {
      // Chest along a wall
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
      // Statue in center
      placedItems.push({
        id: "statue-" + room.id,
        gridX: c[0], gridY: c[1],
        type: "statue",
        visible: true,
        rotation: 0,
      });
    } else if (roll < 0.85) {
      // Bookshelf along a wall (2 wide, horizontal)
      const wall = pickWall(room, rng, usedWalls);
      const pos = placeAlongWall(room, wall, rng);
      placedItems.push({
        id: "bookshelf-" + room.id,
        gridX: pos.x, gridY: pos.y,
        type: "bookshelf",
        visible: true,
        rotation: pos.rotation,
      });
    }

    // Maybe a trap
    if (rng() < 0.15) {
      const tx = room.rect.x + 1 + Math.floor(rng() * Math.max(1, room.rect.w - 2));
      const ty = room.rect.y + 1 + Math.floor(rng() * Math.max(1, room.rect.h - 2));
      placedItems.push({
        id: "trap-" + room.id,
        gridX: tx, gridY: ty,
        type: "trap",
        visible: false,
      });
    }
  }

  function addSmallRoomFurniture(room) {
    const c = rectCenter(room.rect);
    const usedWalls = room._torchWalls || [];
    const roll = rng();

    if (roll < 0.3) {
      // Chest along a wall
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
  }

  // ---- 6. Build output ----
  const walls = [];
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      if (grid[y][x]) walls.push(x + "," + y);
    }
  }

  // Doors → placedItems (with double door detection)
  // Group doors by their position to find pairs (double doors)
  const doorPairs = {};
  for (let d = 0; d < finalDoors.length; d++) {
    const door = finalDoors[d];
    // Key: group doors that are adjacent (within 2 cells in one axis, same in other)
    let paired = false;
    for (let key in doorPairs) {
      const existing = doorPairs[key];
      // Check if this door is adjacent to an existing one (double door)
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
      doorIndex++;
    }
  }

  // Entrance stairs
  if (rooms.length > 0) {
    const ec = rectCenter(rooms[0].rect);
    placedItems.push({
      id: "entrance-stairs",
      gridX: ec[0],
      gridY: ec[1],
      type: "stairs",
      visible: true,
    });
  }

  // NPCs
  const npcNames = ["Goblin", "Skeleton", "Orc", "Bandit", "Spider", "Zombie"];
  const npcRots = [0, 90, 180, 270];
  for (let i = 1; i < Math.min(4, rooms.length); i++) {
    const nc = rectCenter(rooms[i].rect);
    placedItems.push({
      id: "npc-" + (i - 1),
      gridX: nc[0],
      gridY: nc[1],
      type: "npc",
      visible: false,
      name: pick(npcNames, rng),
      rotation: pick(npcRots, rng),
    });
  }

  return {
    name: generateName(rng),
    description: generateDescription(rng),
    gridSize: gridSize,
    walls: walls,
    placedItems: placedItems,
    players:
      rooms.length > 0
        ? [
            {
              id: "player-1",
              name: "Adventurer 1",
              gridX: rectCenter(rooms[0].rect)[0],
              gridY: rectCenter(rooms[0].rect)[1],
            },
          ]
        : [
            {
              id: "player-1",
              name: "Adventurer 1",
              gridX: 0,
              gridY: 0,
            },
          ],
    zoom: 1,
    panX: 0,
    panY: 0,
    fog: (function() {
      // Fog the entire grid so players don't know the dungeon size
      const allCells = [];
      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          allCells.push(x + "," + y);
        }
      }
      return allCells;
    })(),
  };
}

// ---------------------------------------------------------------------------
// ASCII visualiser
// ---------------------------------------------------------------------------
function visualize(map) {
  const g = [];
  for (let y = 0; y < map.gridSize; y++) {
    const row = [];
    for (let x = 0; x < map.gridSize; x++) row.push("\u2588");
    g.push(row);
  }

  // Build wall set
  const ws = {};
  for (let i = 0; i < map.walls.length; i++) {
    ws[map.walls[i]] = true;
  }

  for (let y = 0; y < map.gridSize; y++) {
    for (let x = 0; x < map.gridSize; x++) {
      if (!ws[x + "," + y]) g[y][x] = "\u00b7";
    }
  }

  // Doors
  for (let i = 0; i < map.placedItems.length; i++) {
    const item = map.placedItems[i];
    if (
      (item.type === "door" || item.type === "secretDoor") &&
      item.gridY < map.gridSize &&
      item.gridX < map.gridSize
    ) {
      g[item.gridY][item.gridX] =
        item.type === "secretDoor" ? "s" : "+";
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

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------
function runCLI() {
  const args = process.argv.slice(2);
  const get = function (flag) {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : null;
  };

  const gridSize = parseInt(get("--grid-size") || get("-g") || "30", 10);
  const roomStr = get("--rooms") || get("-r") || "6-10";
  const parts = roomStr.split("-").map(Number);
  const seed = get("--seed") ? parseInt(get("--seed"), 10) : undefined;
  const showAscii = args.includes("--ascii") || args.includes("-a");
  const output = get("--output") || get("-o");
  const count = parseInt(get("--count") || get("-c") || "1", 10);

  for (let i = 0; i < count; i++) {
    const map = generateDungeon({
      gridSize: gridSize,
      numRooms: [parts[0], parts[1] || parts[0]],
      seed: seed != null ? seed + i : undefined,
    });

    const json = JSON.stringify(map, null, 2);

    if (output) {
      const filename =
        count > 1
          ? output.replace(/\.json$/, "-" + (i + 1) + ".json")
          : output;
      require("fs").writeFileSync(filename, json);
      console.log(
        "Generated: " +
          filename +
          " (" +
          map.walls.length +
          " walls, " +
          map.placedItems.length +
          " items)"
      );
    } else if (count > 1) {
      console.log("=== " + map.name + " ===");
      console.log(json);
    } else {
      console.log(json);
    }

    if (showAscii) {
      console.log("\nASCII Map:\n");
      console.log(visualize(map));
      console.log();
    }
  }
}

// Run CLI if executed directly
if (typeof process !== "undefined" && process.argv && process.argv[1]) {
  const scriptPath = process.argv[1];
  if (scriptPath.indexOf("dungeon-generator") >= 0) {
    runCLI();
  }
}

// Export for use as module
if (typeof module !== "undefined" && module.exports) {
  module.exports = { generateDungeon, visualize };
}
