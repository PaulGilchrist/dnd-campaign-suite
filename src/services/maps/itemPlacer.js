/**
 * Item Placer - Places NPCs, entrance stairs, and deduplicates items
 *
 * Handles:
 * - NPC placement in rooms (excluding room 0 which gets the entrance)
 * - Entrance stairs placement (farthest corridor cell from center)
 * - Item deduplication by position (preferring last placed)
 * - Door placement from trimmed door list
 */

import { pick } from './rng.js';
import { rectCenter } from './bspTree.js';

export function placeItems({ rooms, placedItems, gridSize, rng, grid, trimmedDoors, corridorCells }) {
  const npcNames = ['Goblin', 'Skeleton', 'Orc', 'Bandit', 'Spider', 'Zombie'];
  const npcRots = [0, 90, 180, 270];

  // Place NPCs in rooms (skip room 0 which gets entrance stairs)
  for (let i = 1; i < Math.min(rooms.length, 8); i++) {
    const room = rooms[i];
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
      id: 'npc-' + (i - 1),
      gridX: nx,
      gridY: ny,
      type: 'npc',
      visible: false,
      name: pick(npcNames, rng),
      rotation: pick(npcRots, rng),
    });
  }

  // Place entrance stairs (farthest corridor cell from center)
  const [ex, ey] = findEntranceStairs(rooms, gridSize, rng, corridorCells);
  placedItems.push({
    id: 'entrance-stairs',
    gridX: ex,
    gridY: ey,
    type: 'stairs',
    visible: true,
  });

  // Place doors
  placeDoors(placedItems, trimmedDoors, grid);

  // Deduplicate items by position (prefer last placed)
  const seenPos = {};
  const dedupedItems = [];
  for (let i = placedItems.length - 1; i >= 0; i--) {
    const item = placedItems[i];
    const key = item.gridX + ',' + item.gridY;
    if (!seenPos[key]) {
      seenPos[key] = true;
      dedupedItems.unshift(placedItems[i]);
    }
  }

  return dedupedItems;
}

function isOccupied(room, x, y) {
  return room._occupied.has(x + ',' + y);
}

function markOccupied(room, x, y) {
  room._occupied.add(x + ',' + y);
}

function findEntranceStairs(rooms, gridSize, rng, corridorCells) {
  let ex = -1, ey = -1, bestDist = Infinity;
  const corridorKeys = Object.keys(corridorCells);
  // Fisher-Yates shuffle
  for (let ci = corridorKeys.length - 1; ci > 0; ci--) {
    const cj = Math.floor(rng() * (ci + 1));
    const tmp = corridorKeys[ci];
    corridorKeys[ci] = corridorKeys[cj];
    corridorKeys[cj] = tmp;
  }
  for (let ci = 0; ci < corridorKeys.length; ci++) {
    const [cx, cy] = corridorKeys[ci].split(',').map(Number);
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
  return [ex, ey];
}

function placeDoors(placedItems, trimmedDoors, grid) {
  let doorIndex = 0;
  for (let d = 0; d < trimmedDoors.length; d++) {
    const door = trimmedDoors[d];
    placedItems.push({
      id: 'door-' + doorIndex,
      gridX: door.x,
      gridY: door.y,
      type: door.doorType,
      visible: door.doorType !== 'secretDoor',
      rotation: door.rotation,
    });
    if (door.doorType === 'secretDoor') {
      grid[door.y][door.x] = true;
    }
    doorIndex++;
  }
}
