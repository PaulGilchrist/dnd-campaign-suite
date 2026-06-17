import { mulberry32, pick } from './rng.js';
import { rectCenter, rectIntersects } from './bspTree.js';
import { generateName, generateDescription } from './dungeonNamegen.js';

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

  const layoutStyle = opts.layoutStyle || 'balanced';

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

  function carveRoomRect(r) {
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) {
        if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
          grid[y][x] = false;
        }
      }
    }
  }

  function overlapsExisting(rect, pad) {
    pad = pad != null ? pad : 1;
    for (const room of rooms) {
      if (rectIntersects(room.rect, rect, pad)) return true;
    }
    return false;
  }

  function findSharedEdge(a, b) {
    if (b.y + b.h + 1 === a.y) {
      const overlapStart = Math.max(b.x, a.x);
      const overlapEnd = Math.min(b.x + b.w - 1, a.x + a.w - 1);
      if (overlapStart <= overlapEnd) return { side: 'n', overlapStart, overlapEnd, wallY: a.y - 1 };
    }
    if (b.y === a.y + a.h + 1) {
      const overlapStart = Math.max(b.x, a.x);
      const overlapEnd = Math.min(b.x + b.w - 1, a.x + a.w - 1);
      if (overlapStart <= overlapEnd) return { side: 's', overlapStart, overlapEnd, wallY: a.y + a.h };
    }
    if (b.x + b.w + 1 === a.x) {
      const overlapStart = Math.max(b.y, a.y);
      const overlapEnd = Math.min(b.y + b.h - 1, a.y + a.h - 1);
      if (overlapStart <= overlapEnd) return { side: 'w', overlapStart, overlapEnd, wallX: a.x - 1 };
    }
    if (b.x === a.x + a.w + 1) {
      const overlapStart = Math.max(b.y, a.y);
      const overlapEnd = Math.min(b.y + b.h - 1, a.y + a.h - 1);
      if (overlapStart <= overlapEnd) return { side: 'e', overlapStart, overlapEnd, wallX: a.x + a.w };
    }
    return null;
  }

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
    if (dx < 0 || dx >= gridSize || dy < 0 || dy >= gridSize) return null;
    if (!grid[dy][dx]) return null;

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

  const seedW = minRoom + Math.floor(rng() * (maxRoom - minRoom + 1));
  const seedH = minRoom + Math.floor(rng() * (maxRoom - minRoom + 1));
  let seedX = 2 + Math.floor(rng() * Math.max(1, gridSize - seedW - 4));
  let seedY = 2 + Math.floor(rng() * Math.max(1, gridSize - seedH - 4));

  rooms.push({ rect: { x: seedX, y: seedY, w: seedW, h: seedH }, id: 0, connected: [], type: 'entrance' });
  carveRoomRect(rooms[0].rect);

  const maxAttempts = targetRooms * 30;
  let attempts = 0;
  let failureStreak = 0;

  while (rooms.length < targetRooms && attempts < maxAttempts) {
    attempts++;

    let srcIdx;
    if (layoutStyle === 'linear' && rooms.length > 1) {
      srcIdx = rooms.length - 1;
    } else if (layoutStyle === 'forking') {
      const candidates = rooms.filter(r => r.connected.length < 2);
      srcIdx = candidates.length > 0 ? rooms.indexOf(pick(candidates, rng)) : Math.floor(rng() * rooms.length);
    } else if (layoutStyle === 'winding') {
      srcIdx = rooms.length - 1;
    } else {
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
          ny = sy - newH - 1;
          break;
        case 's':
          nx = sx - Math.floor(newW / 2) + Math.floor(rng() * Math.min(newW, Math.max(1, sw)));
          ny = sy + sh + 1;
          break;
        case 'w':
          nx = sx - newW - 1;
          ny = sy - Math.floor(newH / 2) + Math.floor(rng() * Math.min(newH, Math.max(1, sh)));
          break;
        case 'e':
          nx = sx + sw + 1;
          ny = sy - Math.floor(newH / 2) + Math.floor(rng() * Math.min(newH, Math.max(1, sh)));
          break;
      }

      nx = Math.max(1, Math.min(nx, gridSize - newW - 1));
      ny = Math.max(1, Math.min(ny, gridSize - newH - 1));

      const newRect = { x: nx, y: ny, w: newW, h: newH };

      if (overlapsExisting(newRect, 0)) continue;

      const edge = findSharedEdge(srcRoom.rect, newRect);
      if (!edge) continue;

      const roomId = rooms.length;
      carveRoomRect(newRect);

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

  for (let ci = 0; ci < 5; ci++) {
    const clusters = findClusters();
    if (clusters.length <= 1) break;

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
      const ca = rectCenter(bestA.rect);
      const cb = rectCenter(bestB.rect);
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

  function assignRoomTypes() {
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

  const walls = [];
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      if (grid[y][x]) walls.push(x + ',' + y);
    }
  }

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
