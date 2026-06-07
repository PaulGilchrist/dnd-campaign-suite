import { getAllHexes, hexKey, hexNeighbors } from './hexMapUtils.js';
import { TERRAIN_TYPES } from '../../config/outdoorConfig.js';

const VALID_TERRAIN_IDS = new Set(TERRAIN_TYPES.map(t => t.id));

export function generateHexTerrain({ gridSize = 30, seed, weights } = {}) {
  if (!Number.isInteger(gridSize) || gridSize < 1) {
    return { terrain: {}, rivers: [] };
  }

  const hexCols = gridSize * 2;
  const hexRows = gridSize;

  const effectiveSeed = seed !== undefined ? seed : Math.floor(Math.random() * 100000);

  const baseResolution = Math.max(4, Math.floor(gridSize / 3));

  const octaves = [
    { amplitude: 1.0, frequency: 1 },
    { amplitude: 0.5, frequency: 2 },
    { amplitude: 0.25, frequency: 4 },
  ];

  const elevationOctaveGrids = octaves.map((oct, i) =>
    buildNoiseGrid(baseResolution * oct.frequency, effectiveSeed, 1, i)
  );
  const moistureOctaveGrids = octaves.map((oct, i) =>
    buildNoiseGrid(baseResolution * oct.frequency, effectiveSeed, 2, i)
  );

  const allHexes = getAllHexes(hexCols, hexRows);
  const terrain = {};
  const elevationMap = {};
  const moistureMap = {};

  for (const { q, r } of allHexes) {
    const elevation = sampleFractal(elevationOctaveGrids, octaves, q, r, hexCols, hexRows, baseResolution);
    const moisture = sampleFractal(moistureOctaveGrids, octaves, q, r, hexCols, hexRows, baseResolution);
    const key = hexKey(q, r);
    elevationMap[key] = elevation;
    moistureMap[key] = moisture;
    terrain[key] = elevationMoistureToTerrain(elevation, moisture);
  }

  frameWithWater(terrain, hexCols, hexRows);
  applyBeaches(terrain, hexCols, hexRows);
  fillLakes(terrain, elevationMap, hexCols, hexRows);
  const rivers = generateRivers(elevationMap, moistureMap, terrain, hexCols, hexRows);

  if (weights && typeof weights === 'object' && Object.keys(weights).length > 0) {
    applyWeights(terrain, weights, allHexes, effectiveSeed);
  }

  return { terrain, rivers };
}

const TERRAIN_ELEVATION = {
  water: 0.15,
  swamp: 0.30,
  beach: 0.38,
  plains: 0.50,
  desert: 0.50,
  hills: 0.65,
  forest: 0.65,
  mountains: 0.82,
  tundra: 0.90,
};

export function generateRiversFromTerrain(terrain, gridSize) {
  if (!terrain || !gridSize) return [];

  const hexCols = gridSize * 2;
  const hexRows = gridSize;

  const allHexes = getAllHexes(hexCols, hexRows);
  const elevationMap = {};

  for (const { q, r } of allHexes) {
    const key = hexKey(q, r);
    const type = terrain[key];
    elevationMap[key] = TERRAIN_ELEVATION[type] !== undefined ? TERRAIN_ELEVATION[type] : 0.5;
  }

  return generateRivers(elevationMap, null, terrain, hexCols, hexRows);
}

function mulberry32(seed) {
  return function next() {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildNoiseGrid(resolution, seed, channel, octaveIndex) {
  const size = resolution + 1;
  const grid = [];
  for (let cy = 0; cy < size; cy++) {
    const row = [];
    for (let cx = 0; cx < size; cx++) {
      const cellSeed = seed + cx * 1000 + cy * 10000 + channel * 100000 + octaveIndex * 1000000;
      const rng = mulberry32(cellSeed >>> 0);
      row.push(rng());
    }
    grid.push(row);
  }
  return grid;
}

function sampleNoiseGrid(grid, q, r, hexCols, hexRows) {
  const resolution = grid.length - 1;
  const x = hexCols > 1 ? q / (hexCols - 1) : 0.5;
  const y = hexRows > 1 ? r / (hexRows - 1) : 0.5;
  const gx = x * resolution;
  const gy = y * resolution;
  const cx = Math.min(Math.floor(gx), resolution);
  const cy = Math.min(Math.floor(gy), resolution);
  const fx = gx - cx;
  const fy = gy - cy;
  const nx = Math.min(cx + 1, resolution);
  const ny = Math.min(cy + 1, resolution);
  const c00 = grid[cy][cx];
  const c10 = grid[cy][nx];
  const c01 = grid[ny][cx];
  const c11 = grid[ny][nx];
  const top = c00 + (c10 - c00) * fx;
  const bottom = c01 + (c11 - c01) * fx;
  return top + (bottom - top) * fy;
}

function sampleFractal(octaveGrids, octaves, q, r, hexCols, hexRows, baseResolution) {
  let value = 0;
  for (let i = 0; i < octaveGrids.length; i++) {
    const grid = octaveGrids[i];
    const { amplitude, frequency } = octaves[i];
    const effectiveSize = Math.max(Math.max(hexCols, hexRows), baseResolution * frequency + 1);
    value += sampleNoiseGrid(grid, q * frequency, r * frequency, effectiveSize, effectiveSize) * amplitude;
  }
  const maxPossible = octaves.reduce((s, o) => s + o.amplitude, 0);
  return value / maxPossible;
}

function elevationMoistureToTerrain(elevation, moisture) {
  if (elevation > 0.85) {
    return 'tundra';
  }

  if (elevation > 0.70) {
    if (moisture > 0.4) return 'mountains';
    return 'mountains';
  }

  if (elevation > 0.55) {
    if (moisture > 0.6) return 'forest';
    if (moisture > 0.3) return 'hills';
    return 'plains';
  }

  if (elevation > 0.45) {
    if (moisture > 0.7) return 'forest';
    if (moisture > 0.4) return 'hills';
    if (moisture > 0.2) return 'plains';
    return 'desert';
  }

  if (elevation > 0.28) {
    if (moisture > 0.6) return 'swamp';
    if (moisture > 0.3) return 'plains';
    return 'desert';
  }

  return 'water';
}

function isOnEdge(q, r, hexCols, hexRows) {
  return q === 0 || q === hexCols - 1 || r === 0 || r === hexRows - 1;
}

function inBounds(q, r, hexCols, hexRows) {
  return q >= 0 && q < hexCols && r >= 0 && r < hexRows;
}

function frameWithWater(terrain, hexCols, hexRows) {
  for (let r = 0; r < hexRows; r++) {
    for (let q = 0; q < hexCols; q++) {
      if (isOnEdge(q, r, hexCols, hexRows)) {
        terrain[hexKey(q, r)] = 'water';
      }
    }
  }
}

function applyBeaches(terrain, hexCols, hexRows) {
  for (let r = 0; r < hexRows; r++) {
    for (let q = 0; q < hexCols; q++) {
      const key = hexKey(q, r);
      if (terrain[key] === 'water') continue;
      const neighbors = hexNeighbors(q, r);
      for (const n of neighbors) {
        if (!inBounds(n.q, n.r, hexCols, hexRows)) continue;
        if (terrain[hexKey(n.q, n.r)] === 'water') {
          terrain[key] = 'beach';
          break;
        }
      }
    }
  }
}

function fillLakes(terrain, elevationMap, hexCols, hexRows) {
  const visited = new Set();
  const queue = [];

  for (let r = 0; r < hexRows; r++) {
    for (let q = 0; q < hexCols; q++) {
      if (!isOnEdge(q, r, hexCols, hexRows)) continue;
      const key = hexKey(q, r);
      if (terrain[key] !== 'water' && !visited.has(key)) {
        queue.push(key);
        visited.add(key);
      }
    }
  }

  while (queue.length > 0) {
    const current = queue.shift();
    const [cq, cr] = current.split(',').map(Number);
    const neighbors = hexNeighbors(cq, cr);
    for (const n of neighbors) {
      if (!inBounds(n.q, n.r, hexCols, hexRows)) continue;
      const nk = hexKey(n.q, n.r);
      if (visited.has(nk)) continue;
      if (terrain[nk] === 'water') continue;
      queue.push(nk);
      visited.add(nk);
    }
  }

  const waterThreshold = 0.4;
  for (let r = 0; r < hexRows; r++) {
    for (let q = 0; q < hexCols; q++) {
      const key = hexKey(q, r);
      if (terrain[key] === 'water') continue;
      if (visited.has(key)) continue;
      const elev = elevationMap[key];
      if (elev != null && elev < waterThreshold) {
        terrain[key] = 'water';
      }
    }
  }
}

function generateRivers(elevationMap, moistureMap, terrain, hexCols, hexRows) {
  const riverHexes = new Set();
  const candidates = [];

  for (let r = 0; r < hexRows; r++) {
    for (let q = 0; q < hexCols; q++) {
      const key = hexKey(q, r);
      const elev = elevationMap[key];
      const moist = moistureMap !== null ? moistureMap[key] : null;
      const isValidSource = moist !== null
        ? (elev > 0.6 && moist > 0.65)
        : (elev > 0.6 && (terrain[key] === 'mountains' || terrain[key] === 'hills' || terrain[key] === 'tundra'));
      if (isValidSource) {
        candidates.push({ q, r, moisture: moist || 0.5 });
      }
    }
  }

  candidates.sort((a, b) => b.moisture - a.moisture);

  const maxRivers = Math.max(2, Math.floor(hexRows / 8));
  const taken = new Set();

  for (const source of candidates) {
    if (riverHexes.size >= maxRivers * 5) break;
    const sk = hexKey(source.q, source.r);
    if (taken.has(sk)) continue;

    const path = traceRiver(source.q, source.r, elevationMap, terrain, hexCols, hexRows);
    if (path.length < 3) continue;

    for (const h of path) {
      riverHexes.add(h);
      taken.add(h);
    }
  }

  return Array.from(riverHexes);
}

function traceRiver(startQ, startR, elevationMap, terrain, hexCols, hexRows) {
  const path = [];
  const visited = new Set();
  let q = startQ;
  let r = startR;
  const maxSteps = (hexCols + hexRows) * 2;

  for (let step = 0; step < maxSteps; step++) {
    const key = hexKey(q, r);
    if (visited.has(key)) break;
    visited.add(key);
    path.push(key);

    const terrainType = terrain[key];
    if (terrainType === 'water') break;

    const neighbors = hexNeighbors(q, r);
    let lowest = null;
    let lowestElev = Infinity;

    for (const n of neighbors) {
      if (!inBounds(n.q, n.r, hexCols, hexRows)) continue;
      const nk = hexKey(n.q, n.r);
      if (visited.has(nk)) continue;
      const elev = elevationMap[nk];
      if (elev != null && elev < lowestElev) {
        lowestElev = elev;
        lowest = n;
      }
    }

    if (!lowest || lowestElev >= elevationMap[hexKey(q, r)]) break;

    q = lowest.q;
    r = lowest.r;
  }

  return path;
}

function applyWeights(terrain, weights, allHexes, seed) {
  const rng = mulberry32((seed + 999999) >>> 0);

  for (const { q, r } of allHexes) {
    const key = hexKey(q, r);
    const current = terrain[key];
    const w = weights[current];

    if (w !== undefined && VALID_TERRAIN_IDS.has(current) && w < 1.0) {
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

  for (const { q, r } of allHexes) {
    const key = hexKey(q, r);
    const current = terrain[key];
    const neighbors = hexNeighbors(q, r);

    for (const n of neighbors) {
      const nk = hexKey(n.q, n.r);
      if (terrain[nk] === undefined) continue;

      const terrainType = terrain[nk];
      const w = weights[terrainType];

      if (w !== undefined && VALID_TERRAIN_IDS.has(terrainType) && w > 1.0 && terrainType !== current) {
        const probability = Math.min((w - 1.0) * 0.4, 0.5);
        if (rng() < probability) {
          terrain[key] = terrainType;
        }
      }
    }
  }
}
