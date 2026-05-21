import { getAllHexes, hexKey, hexNeighbors } from './hexMapUtils.js';
import { TERRAIN_TYPES } from '../config/outdoorConfig.js';

/**
 * Procedural hex terrain generator for outdoor D&D maps.
 * Pure service — no React dependencies, no DOM access.
 *
 * Generates terrain using two-layer value noise (elevation + moisture)
 * bilinearly interpolated from coarse noise grids.  The (elevation, moisture)
 * pair is mapped to one of 8 terrain types via a biome threshold table.
 *
 * Terrain types: plains, hills, forest, mountains, desert, swamp, tundra, water
 *
 * @param {object} [options]
 * @param {number} [options.gridSize=30]  - Hex grid dimensions (gridSize × gridSize)
 * @param {number} [options.seed]         - PRNG seed (default: Math.floor(Math.random() * 100000))
 * @param {object} [options.weights]      - Terrain frequency bias, e.g. { plains: 0.8, water: 1.2 }
 * @returns {{ terrain: object.<string, string> }}
 *   terrain — map of "q,r" → terrain type id (e.g. "plains", "water")
 */
export function generateHexTerrain({ gridSize = 30, seed, weights } = {}) {
  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------
  if (!Number.isInteger(gridSize) || gridSize < 1) {
    return { terrain: {} };
  }

  const effectiveSeed = seed !== undefined ? seed : Math.floor(Math.random() * 100000);

  // ---------------------------------------------------------------------------
  // Build coarse noise grids (elevation + moisture)
  // ---------------------------------------------------------------------------
  // Resolution scales with grid size so biomes keep proportional feature sizes.
  const noiseResolution = Math.max(3, Math.floor(gridSize / 4));
  const elevationGrid = buildNoiseGrid(noiseResolution, effectiveSeed, 1);
  const moistureGrid = buildNoiseGrid(noiseResolution, effectiveSeed, 2);

  // ---------------------------------------------------------------------------
  // Sample noise per hex and map to terrain type
  // ---------------------------------------------------------------------------
  const allHexes = getAllHexes(gridSize, gridSize);
  const terrain = {};

  for (const { q, r } of allHexes) {
    const elevation = sampleNoiseGrid(elevationGrid, q, r, gridSize);
    const moisture = sampleNoiseGrid(moistureGrid, q, r, gridSize);
    terrain[hexKey(q, r)] = elevationMoistureToTerrain(elevation, moisture);
  }

  // ---------------------------------------------------------------------------
  // Apply optional frequency weights
  // ---------------------------------------------------------------------------
  if (weights && typeof weights === 'object' && Object.keys(weights).length > 0) {
    applyWeights(terrain, weights, allHexes, effectiveSeed);
  }

  return { terrain };
}

// ---------------------------------------------------------------------------
// Seeded PRNG — mulberry32
// ---------------------------------------------------------------------------

/**
 * Mulberry32 — a fast, seedable 32-bit PRNG.
 * Returns a function that produces values in [0, 1).
 *
 * @param {number} seed  - 32-bit integer seed
 * @returns {function(): number}
 */
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
// Coarse noise grid construction and sampling
// ---------------------------------------------------------------------------

/**
 * Build a (resolution + 1) × (resolution + 1) grid of deterministic
 * pseudo-random values in [0, 1).  Each cell uses a unique seed derived
 * from the base seed, its coordinates, and the channel offset so that
 * elevation and moisture grids are fully independent.
 *
 * @param {number} resolution  - Coarse grid cell count per dimension
 * @param {number} seed        - Base PRNG seed
 * @param {number} channel     - Channel index (1 = elevation, 2 = moisture)
 * @returns {number[][]}       - 2-D array of noise values
 */
function buildNoiseGrid(resolution, seed, channel) {
  const size = resolution + 1;
  const grid = [];

  for (let cy = 0; cy < size; cy++) {
    const row = [];
    for (let cx = 0; cx < size; cx++) {
      const cellSeed = seed + cx * 1000 + cy * 10000 + channel * 100000;
      const rng = mulberry32(cellSeed >>> 0);
      row.push(rng());
    }
    grid.push(row);
  }

  return grid;
}

/**
 * Bilinearly interpolate a noise value from the coarse grid for hex (q, r).
 *
 * The hex's relative position within the grid (0 … 1) is mapped to the
 * coarse-grid coordinate space so that each noise cell covers roughly
 * the same number of hexes regardless of grid size.
 *
 * @param {number[][]} grid   - Coarse noise grid
 * @param {number} q          - Hex axial column
 * @param {number} r          - Hex axial row
 * @param {number} gridSize   - Total grid dimension
 * @returns {number}          - Interpolated value in [0, 1]
 */
function sampleNoiseGrid(grid, q, r, gridSize) {
  const resolution = grid.length - 1;

  // Normalise hex position to [0, 1]
  const x = gridSize > 1 ? q / (gridSize - 1) : 0.5;
  const y = gridSize > 1 ? r / (gridSize - 1) : 0.5;

  // Coordinate in noise-grid space
  const gx = x * resolution;
  const gy = y * resolution;

  const cx = Math.min(Math.floor(gx), resolution);
  const cy = Math.min(Math.floor(gy), resolution);
  const fx = gx - cx; // fractional part within the cell
  const fy = gy - cy;

  const nx = Math.min(cx + 1, resolution); // right neighbour index
  const ny = Math.min(cy + 1, resolution); // bottom neighbour index

  const c00 = grid[cy][cx];
  const c10 = grid[cy][nx];
  const c01 = grid[ny][cx];
  const c11 = grid[ny][nx];

  // Bilinear interpolation
  const top = c00 + (c10 - c00) * fx;
  const bottom = c01 + (c11 - c01) * fx;
  return top + (bottom - top) * fy;
}

// ---------------------------------------------------------------------------
// Biome mapping
// ---------------------------------------------------------------------------

/**
 * Map elevation and moisture to a terrain type.
 *
 * The threshold table divides elevation into 6 bands, with moisture
 * determining the specific terrain within each band.
 *
 *    elevation         → bands       moisture          → terrain
 *    ──────────────────────────────────────────────────────────
 *    > 0.75           deep water     any                water
 *    0.65 – 0.75      shallow       > 0.6              swamp
 *                                    ≤ 0.6              water
 *    0.55 – 0.65      low land      > 0.7              swamp
 *                                    0.3 – 0.7         plains
 *                                    ≤ 0.3              desert
 *    0.40 – 0.55      mid land      > 0.7              forest
 *                                    0.4 – 0.7         hills
 *                                    0.2 – 0.4         plains
 *                                    ≤ 0.2              desert
 *    0.25 – 0.40      high land     > 0.5              forest
 *                                    0.3 – 0.5         hills
 *                                    ≤ 0.3              plains
 *    ≤ 0.25           peaks         > 0.5              tundra
 *                                    0.2 – 0.5         plains
 *                                    ≤ 0.2              mountains
 *
 * @param {number} elevation  - Noise value in [0, 1]
 * @param {number} moisture   - Noise value in [0, 1]
 * @returns {string}          - Terrain type id
 */
function elevationMoistureToTerrain(elevation, moisture) {
  if (elevation > 0.75) {
    return 'water';
  }

  if (elevation > 0.65) {
    return moisture > 0.6 ? 'swamp' : 'water';
  }

  if (elevation > 0.55) {
    if (moisture > 0.7) return 'swamp';
    if (moisture > 0.3) return 'plains';
    return 'desert';
  }

  if (elevation > 0.40) {
    if (moisture > 0.7) return 'forest';
    if (moisture > 0.4) return 'hills';
    if (moisture > 0.2) return 'plains';
    return 'desert';
  }

  if (elevation > 0.25) {
    if (moisture > 0.5) return 'forest';
    if (moisture > 0.3) return 'hills';
    return 'plains';
  }

  // elevation ≤ 0.25 — peaks / polar
  if (moisture > 0.5) return 'tundra';
  if (moisture > 0.2) return 'plains';
  return 'mountains';
}

// ---------------------------------------------------------------------------
// Weight biasing
// ---------------------------------------------------------------------------

/**
 * Adjust terrain frequency according to user-supplied weights.
 *
 *   weight < 1.0 —  reduce the terrain type: each hex of this type has a
 *                    `(1 - weight)` chance of converting to a neighbour's type.
 *   weight > 1.0 —  increase the terrain type: each hex adjacent to this type
 *                    has a chance (scaled by `weight - 1`) of converting to it.
 *   weight = 1.0 or missing — no change.
 *
 * The conversion probability is capped so that extreme values (e.g. 3.0)
 * don't cause every eligible hex to flip in a single pass.
 *
 * @param {object}   terrain    - Terrain map (mutated in place)
 * @param {object}   weights    - Terrain id → bias factor
 * @param {Array}    allHexes   - All { q, r } coordinates
 * @param {number}   seed       - Base seed (used with an offset for this pass)
 */
function applyWeights(terrain, weights, allHexes, seed) {
  // Build a set of valid terrain IDs from the config for key validation
  const validTerrainIds = new Set(TERRAIN_TYPES.map(t => t.id));

  const rng = mulberry32((seed + 999999) >>> 0);

  // -----------------------------------------------------------------------
  // Phase 1 — reduce over-represented terrains (weight < 1.0)
  // -----------------------------------------------------------------------
  for (const { q, r } of allHexes) {
    const key = hexKey(q, r);
    const current = terrain[key];
    const w = weights[current];

    // Skip weight keys that don't match a known terrain type
    if (w !== undefined && validTerrainIds.has(current) && w < 1.0) {
      // Probability of switching away from this terrain = 1 - weight
      if (rng() > w) {
        const neighbors = hexNeighbors(q, r).filter(n =>
          terrain[hexKey(n.q, n.r)] !== undefined
        );
        if (neighbors.length > 0) {
          const chosen = neighbors[Math.floor(rng() * neighbors.length)];
          terrain[key] = terrain[hexKey(chosen.q, chosen.r)];
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // Phase 2 — increase under-represented terrains (weight > 1.0)
  // -----------------------------------------------------------------------
  for (const { q, r } of allHexes) {
    const key = hexKey(q, r);
    const current = terrain[key];
    const neighbors = hexNeighbors(q, r);

    for (const n of neighbors) {
      const nk = hexKey(n.q, n.r);
      if (terrain[nk] === undefined) continue;

      const terrainType = terrain[nk];
      const w = weights[terrainType];

      // Don't convert a hex to the same type it already is
      if (w !== undefined && validTerrainIds.has(terrainType) && w > 1.0 && terrainType !== current) {
        // Conversion probability scales with how far above 1.0 the weight is
        // Capped at 0.5 to avoid total conversion in a single pass.
        const probability = Math.min((w - 1.0) * 0.4, 0.5);
        if (rng() < probability) {
          terrain[key] = terrainType;
        }
      }
    }
  }
}
