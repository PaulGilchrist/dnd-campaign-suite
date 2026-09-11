/**
 * Door Placer - Finds door positions, places doors and secret doors
 *
 * Handles:
 * - Finding corridor spans adjacent to room edges
 * - Determining door positions within spans
 * - Placing regular and secret doors
 * - Deduplicating and pairing doors
 */

const SECRET_DOOR_CHANCE = {
  default: 0.1,
  deadEnd: 0.3,
};

export function placeDoors(rooms, gridSize, rng, corridorCells, grid) {
  const finalDoors = [];

  for (let r = 0; r < rooms.length; r++) {
    const room = rooms[r];
    const spans = findRoomDoorSpans(room, gridSize, corridorCells);

    for (let s = 0; s < spans.length; s++) {
      const door = placeSpanDoor(spans[s], room, gridSize, grid, rng);
      if (door) finalDoors.push(door);
    }
  }

  return { trimmedDoors: removeAdjacentDuplicates(dedupeByPosition(finalDoors)) };
}

function placeSpanDoor(span, room, gridSize, grid, rng) {
  const isNorthSouth = span.side === 'n' || span.side === 's';
  const spanWidth = isNorthSouth ? span.x2 - span.x1 + 1 : span.y2 - span.y1 + 1;
  if (spanWidth !== 1) return null;

  const pos = spanCenter(span);
  if (!hasWallNeighbor(pos, gridSize, grid)) return null;

  return {
    x: pos.x,
    y: pos.y,
    rotation: isNorthSouth ? 90 : 0,
    doorType: rollDoorType(room, rng),
  };
}

function rollDoorType(room, rng) {
  const chance = room._deadEndCap ? SECRET_DOOR_CHANCE.deadEnd : SECRET_DOOR_CHANCE.default;
  return rng() < chance ? 'secretDoor' : 'door';
}

function hasWallNeighbor(pos, gridSize, grid) {
  return (
    (pos.x > 0 && grid[pos.y][pos.x - 1]) ||
    (pos.x < gridSize - 1 && grid[pos.y][pos.x + 1]) ||
    (pos.y > 0 && grid[pos.y - 1][pos.x]) ||
    (pos.y < gridSize - 1 && grid[pos.y + 1][pos.x])
  );
}

function dedupeByPosition(doors) {
  const seenDoorPos = {};
  const uniqueDoors = [];
  for (let d = 0; d < doors.length; d++) {
    const key = doors[d].x + ',' + doors[d].y;
    if (!seenDoorPos[key]) {
      seenDoorPos[key] = true;
      uniqueDoors.push(doors[d]);
    }
  }
  return uniqueDoors;
}

function removeAdjacentDuplicates(uniqueDoors) {
  const doorPosSet = {};
  for (const d of uniqueDoors) {
    doorPosSet[d.x + ',' + d.y] = d;
  }
  const toRemove = new Set();
  for (const d of uniqueDoors) {
    if (toRemove.has(d.x + ',' + d.y)) continue;
    const rightKey = (d.x + 1) + ',' + d.y;
    if (doorPosSet[rightKey] && !toRemove.has(rightKey)) {
      toRemove.add(rightKey);
    }
    const bottomKey = d.x + ',' + (d.y + 1);
    if (doorPosSet[bottomKey] && !toRemove.has(bottomKey)) {
      toRemove.add(bottomKey);
    }
  }
  return uniqueDoors.filter(d => !toRemove.has(d.x + ',' + d.y));
}

function findRoomDoorSpans(room, gridSize, corridorCells) {
  const spans = [];
  const ny = room.rect.y - 1;
  let spanStart = null;
  for (let x = room.rect.x; x < room.rect.x + room.rect.w; x++) {
    if (corridorCells[x + ',' + ny]) {
      if (spanStart == null) spanStart = x;
    } else if (spanStart != null) {
      spans.push({ side: 'n', x1: spanStart, x2: x - 1, y: ny });
      spanStart = null;
    }
  }
  if (spanStart != null) spans.push({ side: 'n', x1: spanStart, x2: room.rect.x + room.rect.w - 1, y: ny });

  const sy = room.rect.y + room.rect.h;
  spanStart = null;
  for (let x = room.rect.x; x < room.rect.x + room.rect.w; x++) {
    if (corridorCells[x + ',' + sy]) {
      if (spanStart == null) spanStart = x;
    } else if (spanStart != null) {
      spans.push({ side: 's', x1: spanStart, x2: x - 1, y: sy });
      spanStart = null;
    }
  }
  if (spanStart != null) spans.push({ side: 's', x1: spanStart, x2: room.rect.x + room.rect.w - 1, y: sy });

  const wx = room.rect.x - 1;
  spanStart = null;
  for (let y = room.rect.y; y < room.rect.y + room.rect.h; y++) {
    if (corridorCells[wx + ',' + y]) {
      if (spanStart == null) spanStart = y;
    } else if (spanStart != null) {
      spans.push({ side: 'w', x: wx, y1: spanStart, y2: y - 1 });
      spanStart = null;
    }
  }
  if (spanStart != null) spans.push({ side: 'w', x: wx, y1: spanStart, y2: room.rect.y + room.rect.h - 1 });

  const ex = room.rect.x + room.rect.w;
  spanStart = null;
  for (let y = room.rect.y; y < room.rect.y + room.rect.h; y++) {
    if (corridorCells[ex + ',' + y]) {
      if (spanStart == null) spanStart = y;
    } else if (spanStart != null) {
      spans.push({ side: 'e', x: ex, y1: spanStart, y2: y - 1 });
      spanStart = null;
    }
  }
  if (spanStart != null) spans.push({ side: 'e', x: ex, y1: spanStart, y2: room.rect.y + room.rect.h - 1 });

  return spans;
}

function spanCenter(span) {
  if (span.side === 'n' || span.side === 's') {
    return { x: Math.floor((span.x1 + span.x2) / 2), y: span.y };
  }
  return { x: span.x, y: Math.floor((span.y1 + span.y2) / 2) };
}
