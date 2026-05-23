/**
 * Dungeon Map Generator
 * Generates grid-based dungeon maps as JSON compatible with Paul's dnd-char-sheet app.
 *
 * Works in browsers (ES module) and Node.js.
 * This is the canonical implementation. dungeon-generator.mjs is the CLI shim.
 *
 * Usage:
 *   import { generateDungeon, visualize } from './dungeonGenerator.js';
 *   const map = generateDungeon({ gridSize: 30, numRooms: [6, 10], seed: 42 });
 *
 *   // Browser
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

  split(rng, minSize, _maxSize) {
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
export function generateDungeon(opts) {
  opts = opts || {};
  const gridSize = opts.gridSize || 30;
  const numRooms = opts.numRooms || [6, 10];
  const minRooms = numRooms[0];
  const maxRooms = numRooms[1] || numRooms[0];
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

  let nodes = [root];
  let splits = 0;
  while (nodes.length > 0 && splits < 20) {
    const node = nodes.shift();
    if (node.split(rng)) {
      if (node.left) nodes.push(node.left);
      if (node.right) nodes.push(node.right);
      splits++;
    }
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
  const doors = [];
  for (let r = 0; r < rooms.length; r++) {
    const room = rooms[r];
    const candidates = [];

    for (let x = room.rect.x; x < room.rect.x + room.rect.w; x++) {
      if (corridorCells[x + "," + (room.rect.y - 1)])
        candidates.push([x, room.rect.y - 1]);
    }
    for (let x = room.rect.x; x < room.rect.x + room.rect.w; x++) {
      if (corridorCells[x + "," + (room.rect.y + room.rect.h)])
        candidates.push([x, room.rect.y + room.rect.h]);
    }
    for (let y = room.rect.y; y < room.rect.y + room.rect.h; y++) {
      if (corridorCells[room.rect.x - 1 + "," + y])
        candidates.push([room.rect.x - 1, y]);
    }
    for (let y = room.rect.y; y < room.rect.y + room.rect.h; y++) {
      if (corridorCells[room.rect.x + room.rect.w + "," + y])
        candidates.push([room.rect.x + room.rect.w, y]);
    }

    for (let c = 0; c < candidates.length; c++) {
      const dx = candidates[c][0], dy = candidates[c][1];

      const openN = dy > 0 && !grid[dy - 1][dx];
      const openS = dy < gridSize - 1 && !grid[dy + 1][dx];
      const openW = dx > 0 && !grid[dy][dx - 1];
      const openE = dx < gridSize - 1 && !grid[dy][dx + 1];

      const nsOpen = (openN ? 1 : 0) + (openS ? 1 : 0);
      const ewOpen = (openW ? 1 : 0) + (openE ? 1 : 0);

      let rotation = 0;
      if (nsOpen > ewOpen) rotation = 90;

      doors.push({
        x: dx,
        y: dy,
        rotation: rotation,
        doorType: rng() < 0.1 ? "secretDoor" : "door",
      });
    }
  }

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
    if (wall === "w") return 0;
    if (wall === "n") return 90;
    if (wall === "e") return 180;
    if (wall === "s") return 270;
    return 0;
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
          { dx: 0, dy: -1, rot: 90 },
          { dx: 1, dy: -1, rot: 90 },
          { dx: 0, dy: 1, rot: 270 },
          { dx: 1, dy: 1, rot: 270 },
          { dx: -1, dy: 0, rot: 0 },
          { dx: 2, dy: 0, rot: 180 },
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
        rotation = 90;
      } else if (wall === "s") {
        bx = room.rect.x + 1 + Math.floor(rng() * Math.max(1, room.rect.w - 2));
        by = room.rect.y + room.rect.h - 2;
        rotation = 270;
      } else if (wall === "w") {
        bx = room.rect.x + 1;
        by = room.rect.y + 1 + Math.floor(rng() * Math.max(1, room.rect.h - 2));
        rotation = 0;
      } else {
        bx = room.rect.x + room.rect.w - 2;
        by = room.rect.y + 1 + Math.floor(rng() * Math.max(1, room.rect.h - 2));
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
            rotation: 90,
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

  const doorPairs = {};
  for (let d = 0; d < finalDoors.length; d++) {
    const door = finalDoors[d];
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
    players: [],
    zoom: 1,
    panX: 0,
    panY: 0,
    fog: (function() {
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
