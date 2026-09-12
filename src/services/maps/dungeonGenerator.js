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

import { mulberry32 } from './rng.js';
import { generateName, generateDescription } from './dungeonNamegen.js';
import { generateAdjacentDungeon } from './adjacentDungeonGenerator.js';
import { generateRooms } from './roomGenerator.js';
import { placeDoors } from './doorPlacer.js';
import { placeFurniture } from './furniturePlacer.js';
import { placeItems } from './itemPlacer.js';

export { generateAdjacentDungeon };

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------
export function generateDungeon(opts) {
  opts = opts || {};
  const gridSize = opts.gridSize || 30;
  const density = opts.density != null ? Math.max(0, Math.min(1, opts.density)) : 0.5;
  const rng = opts.seed != null ? mulberry32(opts.seed) : Math.random.bind(Math);

  // ---- 1-3b. Generate rooms, carve, connect, cap dead ends ----
  const { grid, rooms, corridorCells } = generateRooms({ gridSize, density, rng });

  // ---- 4. Place doors ----
  const { trimmedDoors } = placeDoors(rooms, gridSize, rng, corridorCells, grid);

  // ---- 5. Place furniture ----
  const placedItems = placeFurniture(rooms, gridSize, rng, grid, corridorCells, trimmedDoors);

  // ---- 6-7. Place NPCs, stairs, doors, deduplicate ----
  const dedupedItems = placeItems({ rooms, placedItems, gridSize, rng, grid, trimmedDoors, corridorCells });

  // ---- 8. Build output ----
  const walls = [];
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      if (grid[y][x]) walls.push(x + ',' + y);
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
// ASCII visualiser
// ---------------------------------------------------------------------------
const ITEM_GLYPHS = {
  secretDoor: 's',
  door: '+',
  stairs: '>',
  npc: '@',
  chest: '=',
  altar: 'A',
  trap: '^'
};

export function visualize(map) {
  const g = [];
  for (let y = 0; y < map.gridSize; y++) {
    const row = [];
    for (let x = 0; x < map.gridSize; x++) row.push('\u2588');
    g.push(row);
  }

  const ws = {};
  for (let i = 0; i < map.walls.length; i++) {
    ws[map.walls[i]] = true;
  }

  for (let y = 0; y < map.gridSize; y++) {
    for (let x = 0; x < map.gridSize; x++) {
      if (!ws[x + ',' + y]) g[y][x] = '\u00b7';
    }
  }

  for (let i = 0; i < map.placedItems.length; i++) {
    const item = map.placedItems[i];
    if (
      item.gridY < map.gridSize &&
      item.gridX < map.gridSize
    ) {
      const glyph = ITEM_GLYPHS[item.type];
      if (glyph) g[item.gridY][item.gridX] = glyph;
    }
  }

  return g.map(function (row) {
    return row.join('');
  }).join('\n');
}
