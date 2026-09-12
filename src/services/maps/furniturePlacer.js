/**
 * Furniture Placer - Places torches, furniture, and traps in rooms
 *
 * Handles:
 * - Torch placement on room walls
 * - Large room furniture (altar, pillars, tables, chairs, chests, beds, bookshelves, traps)
 * - Medium room furniture (tables, chairs, chests, statues, bookshelves, traps)
 * - Small room furniture (chests, crates, webs, traps)
 * - Room traps (pit, dart, glyph)
 * - Corridor traps at junctions
 */

import { pick } from './rng.js';
import { rectCenter, rectContains } from './bspTree.js';

export function placeFurniture(rooms, gridSize, rng, grid, corridorCells, finalDoors) {
  const placedItems = [];

  for (let r = 0; r < rooms.length; r++) {
    rooms[r]._occupied = new Set();
  }

  for (let r = 0; r < rooms.length; r++) {
    placeTorches(rooms[r], placedItems, gridSize, rng, grid);
    const area = rooms[r].rect.w * rooms[r].rect.h;
    if (area > 30) addLargeRoomFurniture(rooms[r], placedItems, rng, gridSize, grid, finalDoors);
    else if (area > 15) addMediumRoomFurniture(rooms[r], placedItems, rng, gridSize, grid, finalDoors);
    else addSmallRoomFurniture(rooms[r], placedItems, rng, gridSize, grid, finalDoors);
  }

  // Mark occupied positions
  for (const item of placedItems) {
    for (const room of rooms) {
      if (rectContains(room.rect, item.gridX, item.gridY)) {
        markOccupied(room, item.gridX, item.gridY);
        break;
      }
    }
  }

  // Corridor traps
  placeCorridorTraps(placedItems, rng, gridSize, grid, corridorCells);

  return placedItems;
}

function markOccupied(room, x, y) {
  room._occupied.add(x + ',' + y);
}

function placeTorches(room, placedItems, gridSize, rng, grid) {
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
      id: 'torch-' + room.id + '-' + t[0] + '-' + t[1],
      gridX: t[0],
      gridY: t[1],
      type: 'torch',
      visible: true,
      rotation: t[2],
    });
  }
  room._torchWalls = shuffled.slice(0, count).map(function(t) {
    if (t[2] === 0) return 'w';
    if (t[2] === 90) return 'n';
    if (t[2] === 180) return 'e';
    return 's';
  });
}

function wallRotation(wall) {
  if (wall === 'n') return 0;
  if (wall === 's') return 180;
  if (wall === 'e') return 90;
  return 270; // west
}

function pickWall(room, gridSize, rng, usedWalls) {
  const walls = [];
  if (room.rect.y > 1) walls.push('n');
  if (room.rect.y + room.rect.h < gridSize - 1) walls.push('s');
  if (room.rect.x > 1) walls.push('w');
  if (room.rect.x + room.rect.w < gridSize - 1) walls.push('e');
  const fresh = walls.filter(w => !usedWalls.includes(w));
  return pick(fresh.length > 0 ? fresh : walls, rng);
}

function placeAlongWall(room, wall, rng, inset) {
  inset = inset != null ? inset : 1;
  let x, y;
  const rot = wallRotation(wall);
  if (wall === 'n') {
    x = room.rect.x + 1 + Math.floor(rng() * Math.max(1, room.rect.w - 2));
    y = room.rect.y + inset;
  } else if (wall === 's') {
    x = room.rect.x + 1 + Math.floor(rng() * Math.max(1, room.rect.w - 2));
    y = room.rect.y + room.rect.h - 1 - inset;
  } else if (wall === 'w') {
    x = room.rect.x + inset;
    y = room.rect.y + 1 + Math.floor(rng() * Math.max(1, room.rect.h - 2));
  } else {
    x = room.rect.x + room.rect.w - 1 - inset;
    y = room.rect.y + 1 + Math.floor(rng() * Math.max(1, room.rect.h - 2));
  }
  return { x, y, rotation: rot };
}

function buildDoorCellSet(finalDoors) {
  const doorCells = {};
  for (let d = 0; d < finalDoors.length; d++) {
    doorCells[finalDoors[d].x + ',' + finalDoors[d].y] = true;
  }
  return doorCells;
}

function horizontalWallCandidates(room, wall, rot, doorCells, gridSize, grid) {
  const y = wall === 'n' ? room.rect.y : room.rect.y + room.rect.h - 1;
  const wy = wall === 'n' ? room.rect.y - 1 : room.rect.y + room.rect.h;
  const candidates = [];
  for (let x = room.rect.x; x < room.rect.x + room.rect.w - 1; x++) {
    if (wy >= 0 && wy < gridSize && grid[wy][x] &&
        !doorCells[x + ',' + y] && !doorCells[(x + 1) + ',' + y]) {
      candidates.push({ x, y, rotation: rot });
    }
  }
  return candidates;
}

function verticalWallCandidates(room, wall, rot, doorCells, gridSize, grid) {
  const x = wall === 'w' ? room.rect.x : room.rect.x + room.rect.w - 1;
  const wx = wall === 'w' ? room.rect.x - 1 : room.rect.x + room.rect.w;
  const candidates = [];
  for (let y = room.rect.y; y < room.rect.y + room.rect.h - 1; y++) {
    if (wx >= 0 && wx < gridSize && grid[y][wx] &&
        !doorCells[x + ',' + y] && !doorCells[x + ',' + (y + 1)]) {
      candidates.push({ x, y, rotation: rot });
    }
  }
  return candidates;
}

function placeAgainstWall(room, wall, rng, finalDoors, gridSize, grid) {
  const rot = wallRotation(wall);
  const doorCells = buildDoorCellSet(finalDoors);
  const candidates = (wall === 'n' || wall === 's')
    ? horizontalWallCandidates(room, wall, rot, doorCells, gridSize, grid)
    : verticalWallCandidates(room, wall, rot, doorCells, gridSize, grid);
  if (candidates.length > 0) return pick(candidates, rng);
  return null;
}

function addLargeRoomPillars(room, placedItems, c) {
  const offsets = [[-2, -2], [2, -2], [-2, 2], [2, 2]];
  for (let i = 0; i < offsets.length; i++) {
    const px = c[0] + offsets[i][0], py = c[1] + offsets[i][1];
    if (rectContains(room.rect, px, py)) {
      placedItems.push({
        id: 'pillar-' + room.id + '-' + px + '-' + py,
        gridX: px, gridY: py,
        type: 'pillar',
        visible: true,
      });
    }
  }
}

function addLargeRoomTableChairs(room, placedItems, c, rng) {
  const tableX = c[0] - 1;
  const tableY = c[1];
  if (!(tableX >= room.rect.x && tableX + 1 < room.rect.x + room.rect.w)) return;
  placedItems.push({
    id: 'table-' + room.id,
    gridX: tableX, gridY: tableY,
    type: 'table',
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
        id: 'chair-' + room.id + '-' + i,
        gridX: chx, gridY: chy,
        type: 'chair',
        visible: true,
        rotation: ch.rot,
      });
    }
  }
}

function bedAgainstWallPosition(room, wall, rng) {
  if (wall === 'n') {
    return { x: room.rect.x + 1 + Math.floor(rng() * Math.max(1, room.rect.w - 2)), y: room.rect.y + 1, rotation: 0 };
  }
  if (wall === 's') {
    return { x: room.rect.x + 1 + Math.floor(rng() * Math.max(1, room.rect.w - 2)), y: room.rect.y + room.rect.h - 2, rotation: 0 };
  }
  if (wall === 'w') {
    return { x: room.rect.x + 1, y: room.rect.y + 1 + Math.floor(rng() * Math.max(1, room.rect.h - 2)), rotation: 90 };
  }
  return { x: room.rect.x + room.rect.w - 2, y: room.rect.y + 1 + Math.floor(rng() * Math.max(1, room.rect.h - 2)), rotation: 90 };
}

function addLargeRoomBed(room, placedItems, rng, gridSize, usedWalls) {
  const wall = pickWall(room, gridSize, rng, usedWalls);
  const pos = bedAgainstWallPosition(room, wall, rng);
  placedItems.push({
    id: 'bed-' + room.id,
    gridX: pos.x, gridY: pos.y,
    type: 'bed',
    visible: true,
    rotation: pos.rotation,
  });
  usedWalls.push(wall);
}

function addLargeRoomBookshelf({ room, placedItems, rng, gridSize, grid, finalDoors, usedWalls }) {
  const walls = ['n', 's', 'w', 'e'].filter(function (w) {
    return !usedWalls.includes(w);
  });
  let placed = false;
  for (let wi = 0; wi < walls.length && !placed; wi++) {
    const idx = Math.floor(rng() * walls.length);
    const w = walls.splice(idx, 1)[0];
    const pos = placeAgainstWall(room, w, rng, finalDoors, gridSize, grid);
    if (pos) {
      placedItems.push({
        id: 'bookshelf-' + room.id,
        gridX: pos.x, gridY: pos.y,
        type: 'bookshelf',
        visible: true,
        rotation: pos.rotation,
      });
      usedWalls.push(w);
      placed = true;
    }
  }
}

function addLargeRoomFurniture(room, placedItems, rng, gridSize, grid, finalDoors) {
  const c = rectCenter(room.rect);
  const usedWalls = room._torchWalls || [];

  if (rng() < 0.4) {
    placedItems.push({
      id: 'altar-' + room.id,
      gridX: c[0],
      gridY: c[1],
      type: 'altar',
      visible: true,
      rotation: 0,
    });
  }

  if (room.rect.w >= 6 && room.rect.h >= 6 && rng() < 0.5) {
    addLargeRoomPillars(room, placedItems, c);
  }

  if (rng() < 0.5) {
    addLargeRoomTableChairs(room, placedItems, c, rng);
  }

  if (rng() < 0.6) {
    const wall = pickWall(room, gridSize, rng, usedWalls);
    const pos = placeAlongWall(room, wall, rng);
    placedItems.push({
      id: 'chest-' + room.id,
      gridX: pos.x, gridY: pos.y,
      type: 'chest',
      visible: true,
      rotation: pos.rotation,
    });
    usedWalls.push(wall);
  }

  if (rng() < 0.4) {
    addLargeRoomBed(room, placedItems, rng, gridSize, usedWalls);
  }

  if (rng() < 0.3) {
    addLargeRoomBookshelf({ room, placedItems, rng, gridSize, grid, finalDoors, usedWalls });
  }

  placeRoomTrap(room, placedItems, rng, grid, gridSize);
}

function addMediumRoomFurniture(room, placedItems, rng, gridSize, grid, finalDoors) {
  const c = rectCenter(room.rect);
  const usedWalls = room._torchWalls || [];
  const roll = rng();

  if (roll < 0.3) {
    const tableX = c[0] - 1;
    const tableY = c[1];
    if (tableX >= room.rect.x && tableX + 1 < room.rect.x + room.rect.w) {
      placedItems.push({
        id: 'table-' + room.id,
        gridX: tableX, gridY: tableY,
        type: 'table',
        visible: true,
        rotation: 0,
      });
      if (rectContains(room.rect, c[0], c[1] - 1)) {
        placedItems.push({
          id: 'chair-' + room.id,
          gridX: c[0], gridY: c[1] - 1,
          type: 'chair',
          visible: true,
          rotation: 0,
        });
      }
    }
  } else if (roll < 0.5) {
    const wall = pickWall(room, gridSize, rng, usedWalls);
    const pos = placeAlongWall(room, wall, rng);
    placedItems.push({
      id: 'chest-' + room.id,
      gridX: pos.x, gridY: pos.y,
      type: 'chest',
      visible: true,
      rotation: pos.rotation,
    });
  } else if (roll < 0.7) {
    placedItems.push({
      id: 'statue-' + room.id,
      gridX: c[0], gridY: c[1],
      type: 'statue',
      visible: true,
      rotation: 0,
    });
  } else if (roll < 0.85) {
    const walls = ['n', 's', 'w', 'e'];
    let placed = false;
    for (let wi = 0; wi < walls.length && !placed; wi++) {
      const idx = Math.floor(rng() * walls.length);
      const w = walls.splice(idx, 1)[0];
      const pos = placeAgainstWall(room, w, rng, finalDoors, gridSize, grid);
      if (pos) {
        placedItems.push({
          id: 'bookshelf-' + room.id,
          gridX: pos.x, gridY: pos.y,
          type: 'bookshelf',
          visible: true,
          rotation: pos.rotation,
        });
        placed = true;
      }
    }
  }

  placeRoomTrap(room, placedItems, rng, grid, gridSize);
}

function placeRoomTrap(room, placedItems, rng, grid, _gridSize) {
  const area = room.rect.w * room.rect.h;
  let chance;
  if (area > 30) chance = 0.25;
  else if (area > 15) chance = 0.2;
  else chance = 0.1;
  if (rng() >= chance) return;

  const chests = placedItems.filter(function (i) {
    return i.type === 'chest' && i.id.indexOf('-' + room.id) !== -1;
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
    id: 'trap-' + room.id + '-' + tx + '-' + ty,
    gridX: tx,
    gridY: ty,
    type: 'trap',
    trapType: pick(['pit', 'dart', 'glyph'], rng),
    visible: false,
  });
}

function addSmallRoomFurniture(room, placedItems, rng, gridSize, grid, _finalDoors) {
  const c = rectCenter(room.rect);
  const usedWalls = room._torchWalls || [];
  const roll = rng();

  if (roll < 0.3) {
    const wall = pickWall(room, gridSize, rng, usedWalls);
    const pos = placeAlongWall(room, wall, rng);
    placedItems.push({
      id: 'chest-' + room.id,
      gridX: pos.x, gridY: pos.y,
      type: 'chest',
      visible: true,
      rotation: pos.rotation,
    });
  } else if (roll < 0.5) {
    placedItems.push({
      id: 'crate-' + room.id,
      gridX: c[0], gridY: c[1],
      type: 'crate',
      visible: true,
    });
  } else if (roll < 0.65) {
    placedItems.push({
      id: 'web-' + room.id,
      gridX: c[0], gridY: c[1],
      type: 'web',
      visible: true,
    });
  }

  placeRoomTrap(room, placedItems, rng, grid, gridSize);
}

function placeCorridorTraps(placedItems, rng, gridSize, grid, corridorCells) {
  const cells = Object.keys(corridorCells).map(function (k) {
    return k.split(',').map(Number);
  });
  const trapCount = Math.max(0, Math.floor(cells.length / 60));

  function openNeighborCount(x, y) {
    let n = 0;
    if (x > 0 && !grid[y][x - 1]) n++;
    if (x < gridSize - 1 && !grid[y][x + 1]) n++;
    if (y > 0 && !grid[y - 1][x]) n++;
    if (y < gridSize - 1 && !grid[y + 1][x]) n++;
    return n;
  }

  const junctions = cells.filter(function (c) {
    return openNeighborCount(c[0], c[1]) >= 3;
  });
  const shuffled = junctions.slice().sort(function () { return rng() - 0.5; });
  for (let i = 0; i < Math.min(trapCount, shuffled.length); i++) {
    const [tx, ty] = shuffled[i];
    placedItems.push({
      id: 'corridor-trap-' + tx + '-' + ty,
      gridX: tx,
      gridY: ty,
      type: 'trap',
      trapType: 'pit',
      visible: false,
    });
  }
}
