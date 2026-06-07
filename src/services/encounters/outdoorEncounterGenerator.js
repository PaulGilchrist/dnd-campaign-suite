import { TERRAIN_TYPES } from '../../config/outdoorConfig.js';

function mulberry32(seed) {
  let t = (seed += 0x6d2b79f5);
  return function () {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(q, r) {
  return ((q + 13) * 7919 + (r + 7) * 6271) >>> 0;
}

const BIOME_FEATURES = {
  forest: {
    features: [
      { type: 'tree', weight: 60, label: 'Tree', minDist: 2 },
      { type: 'boulder', weight: 15, label: 'Boulder', minDist: 1 },
      { type: 'bush', weight: 25, label: 'Bush', minDist: 1 },
    ],
    density: 0.06,
    bgFill: '#2D5E37',
  },
  plains: {
    features: [
      { type: 'tree', weight: 10, label: 'Tree', minDist: 2 },
      { type: 'boulder', weight: 35, label: 'Boulder', minDist: 2 },
      { type: 'bush', weight: 55, label: 'Bush', minDist: 1 },
    ],
    density: 0.02,
    bgFill: '#7A9B6A',
  },
  mountains: {
    features: [
      { type: 'boulder', weight: 70, label: 'Boulder', minDist: 1 },
      { type: 'tree', weight: 15, label: 'Tree', minDist: 2 },
      { type: 'bush', weight: 15, label: 'Bush', minDist: 1 },
    ],
    density: 0.05,
    bgFill: '#6F6F62',
  },
  hills: {
    features: [
      { type: 'boulder', weight: 40, label: 'Boulder', minDist: 2 },
      { type: 'tree', weight: 25, label: 'Tree', minDist: 2 },
      { type: 'bush', weight: 35, label: 'Bush', minDist: 1 },
    ],
    density: 0.03,
    bgFill: '#6B8E50',
  },
  swamp: {
    features: [
      { type: 'tree', weight: 50, label: 'Tree', minDist: 2 },
      { type: 'boulder', weight: 10, label: 'Boulder', minDist: 1 },
      { type: 'bush', weight: 40, label: 'Bush', minDist: 1 },
    ],
    density: 0.06,
    bgFill: '#4A6B3A',
  },
  desert: {
    features: [
      { type: 'boulder', weight: 50, label: 'Boulder', minDist: 2 },
      { type: 'bush', weight: 50, label: 'Bush', minDist: 1 },
    ],
    density: 0.015,
    bgFill: '#C4B080',
  },
  tundra: {
    features: [
      { type: 'boulder', weight: 70, label: 'Boulder', minDist: 2 },
      { type: 'bush', weight: 30, label: 'Bush', minDist: 1 },
    ],
    density: 0.02,
    bgFill: '#8CA0A0',
  },
  beach: {
    features: [
      { type: 'boulder', weight: 40, label: 'Boulder', minDist: 2 },
      { type: 'tree', weight: 30, label: 'Tree', minDist: 2 },
      { type: 'bush', weight: 30, label: 'Bush', minDist: 1 },
    ],
    density: 0.025,
    bgFill: '#D4C080',
  },
  water: {
    features: [],
    density: 0,
    bgFill: '#356090',
  },
};

const TERRAIN_TO_BIOME = {};
for (const t of TERRAIN_TYPES) {
  TERRAIN_TO_BIOME[t.id] = t.id;
}

function pickWeighted(features, rng) {
  const total = features.reduce((s, f) => s + f.weight, 0);
  let roll = rng() * total;
  for (const f of features) {
    roll -= f.weight;
    if (roll <= 0) return f;
  }
  return features[features.length - 1];
}

function findPlacement(gridSize, taken, minDist, rng, maxAttempts) {
  const center = Math.floor(gridSize / 2);
  const clearRadius = 4;
  const clearMin = center - clearRadius;
  const clearMax = center + clearRadius;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const gx = Math.floor(rng() * (gridSize - 2)) + 1;
    const gy = Math.floor(rng() * (gridSize - 2)) + 1;

    if (gx >= clearMin && gx <= clearMax && gy >= clearMin && gy <= clearMax) continue;

    const key = `${gx},${gy}`;
    if (taken.has(key)) continue;

    let tooClose = false;
    for (const [tx, ty] of taken) {
      const dx = gx - Number(tx);
      const dy = gy - Number(ty);
      if (Math.sqrt(dx * dx + dy * dy) < minDist) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;

    return { gx, gy, key };
  }
  return null;
}

export function generateOutdoorEncounter(terrainType, gridSize, marchingOrder, q, r) {
  const seed = hashSeed(q, r);
  const rng = mulberry32(seed);
  const biome = BIOME_FEATURES[terrainType] || BIOME_FEATURES.plains;

  const taken = new Set();
  const placedItems = [];
  const features = biome.features;

  const totalCells = gridSize * gridSize;
  let itemCount = Math.round(totalCells * biome.density);
  itemCount = Math.max(Math.min(itemCount, 60), 4);

  let itemIdCounter = 0;
  for (let i = 0; i < itemCount; i++) {
    const feature = pickWeighted(features, rng);
    const result = findPlacement(gridSize, taken, feature.minDist, rng, 20);
    if (!result) continue;

    taken.add(result.key);
    placedItems.push({
      id: `${feature.type}-${itemIdCounter++}`,
      type: feature.type,
      gridX: result.gx,
      gridY: result.gy,
      visible: true,
    });
  }

  const center = Math.floor(gridSize / 2);
  const players = marchingOrder.map((name, i) => {
    const offX = i % 3;
    const offY = Math.floor(i / 3);
    return {
      id: name.toLowerCase().replace(/\s+/g, '-'),
      name,
      gridX: center - 1 + offX,
      gridY: center - 1 + offY,
    };
  });

  return {
    type: 'indoor',
    parentTerrain: terrainType,
    parentHex: { q, r },
    gridSize,
    walls: [],
    placedItems,
    players,
    fog: [],
    zoom: 1,
    panX: 0,
    panY: 0,
    bgFill: biome.bgFill,
  };
}
