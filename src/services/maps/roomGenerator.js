/**
 * Room Generator - BSP rooms, carving, MST connection, dead end caps
 *
 * Handles:
 * - BSP tree room generation
 * - Room carving into the grid
 * - Minimum Spanning Tree room connections
 * - Dead-end corridor caps with small rooms
 */

import { rectCenter, rectIntersects, BSPNode } from './bspTree.js';

export function generateRooms(opts) {
  const gridSize = opts.gridSize;
  const density = opts.density;
  const rng = opts.rng;

  // Grid: true = wall, false = floor (indexed as grid[y][x])
  const grid = buildWalledGrid(gridSize);
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

  splitBspTree(root, rng, targetSplits);

  let rooms = root.createRooms(rng, minRoom, maxRoom);

  // Cull rooms that overlap after random placement within leaves
  rooms = cullOverlappingRooms(rooms);

  // If very few rooms survived, add a few random ones as filler
  addFillerRooms(rooms, { padding, gridSize, minRoom, maxRoom, rng });

  for (let i = 0; i < rooms.length; i++) rooms[i].id = i;

  // ---- 2. Carve rooms ----
  for (let r = 0; r < rooms.length; r++) carveRoomRect(grid, gridSize, rooms[r].rect);

  // ---- 3. Connect rooms (MST + extras) ----
  connectRooms(rooms, grid, gridSize, corridorCells, rng);

  // ---- 3b. Cap dead-end corridors with small rooms ----
  capDeadEnds(rooms, grid, gridSize, corridorCells);

  return { grid, rooms, corridorCells };
}

function buildWalledGrid(gridSize) {
  const grid = [];
  for (let y = 0; y < gridSize; y++) {
    const row = [];
    for (let x = 0; x < gridSize; x++) row.push(true);
    grid.push(row);
  }
  return grid;
}

function splitBspTree(root, rng, targetSplits) {
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
}

function cullOverlappingRooms(rooms) {
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
  return culled;
}

function addFillerRooms(rooms, { padding, gridSize, minRoom, maxRoom, rng }) {
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
}

function carveRoomRect(grid, gridSize, rect) {
  for (let y = rect.y; y < rect.y + rect.h; y++) {
    for (let x = rect.x; x < rect.x + rect.w; x++) {
      if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
        grid[y][x] = false;
      }
    }
  }
}

function connectRooms(rooms, grid, gridSize, corridorCells, rng) {
  if (rooms.length < 2) return;

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

    carveCorridor(rooms[bestA], rooms[bestB], grid, gridSize, corridorCells, rng);
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
      carveCorridor(rooms[a], rooms[b], grid, gridSize, corridorCells, rng);
      rooms[a].connected.push(b);
      rooms[b].connected.push(a);
    }
  }
}

function isOpen(grid, gridSize, x, y) {
  return x >= 0 && x < gridSize && y >= 0 && y < gridSize && !grid[y][x];
}

function openNeighborCount(grid, gridSize, x, y) {
  let n = 0;
  if (isOpen(grid, gridSize, x - 1, y)) n++;
  if (isOpen(grid, gridSize, x + 1, y)) n++;
  if (isOpen(grid, gridSize, x, y - 1)) n++;
  if (isOpen(grid, gridSize, x, y + 1)) n++;
  return n;
}

function capDeadEnds(rooms, grid, gridSize, corridorCells) {
  const deadEndTips = [];
  for (const key in corridorCells) {
    const [cx, cy] = key.split(',').map(Number);
    if (openNeighborCount(grid, gridSize, cx, cy) === 1) {
      deadEndTips.push([cx, cy]);
    }
  }

  for (let di = 0; di < deadEndTips.length; di++) {
    const [tx, ty] = deadEndTips[di];
    const rX = Math.max(1, tx - 1);
    const rY = Math.max(1, ty - 1);
    const rW = Math.min(3, gridSize - rX - 1);
    const rH = Math.min(3, gridSize - rY - 1);
    if (rW < 3 || rH < 3) continue;

    if (!isAreaAllWalls(grid, rX, rY, rW, rH)) continue;

    carveRoomRect(grid, gridSize, { x: rX, y: rY, w: rW, h: rH });
    rooms.push({
      rect: { x: rX, y: rY, w: rW, h: rH },
      id: rooms.length,
      connected: [],
      _deadEndCap: true,
    });
  }
}

function isAreaAllWalls(grid, rX, rY, rW, rH) {
  for (let y = rY; y < rY + rH; y++) {
    for (let x = rX; x < rX + rW; x++) {
      if (!grid[y][x]) return false;
    }
  }
  return true;
}

function carveCorridor(a, b, grid, gridSize, corridorCells, rng) {
  const ca = rectCenter(a.rect);
  const cb = rectCenter(b.rect);
  if (rng() < 0.5) {
    const xDir = ca[0] <= cb[0] ? 1 : -1;
    for (let x = ca[0]; x !== cb[0] + xDir; x += xDir) {
      carveCell(x, ca[1], grid, gridSize, corridorCells);
    }
    const yDir = ca[1] <= cb[1] ? 1 : -1;
    for (let y = ca[1]; y !== cb[1] + yDir; y += yDir) {
      carveCell(cb[0], y, grid, gridSize, corridorCells);
    }
  } else {
    const yDir = ca[1] <= cb[1] ? 1 : -1;
    for (let y = ca[1]; y !== cb[1] + yDir; y += yDir) {
      carveCell(ca[0], y, grid, gridSize, corridorCells);
    }
    const xDir = ca[0] <= cb[0] ? 1 : -1;
    for (let x = ca[0]; x !== cb[0] + xDir; x += xDir) {
      carveCell(x, cb[1], grid, gridSize, corridorCells);
    }
  }
}

function carveCell(x, y, grid, gridSize, corridorCells) {
  if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
    grid[y][x] = false;
    corridorCells[x + ',' + y] = true;
  }
}
