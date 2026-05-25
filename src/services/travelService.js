import { hexKey, hexDistance, hexNeighbors } from './hexMapUtils.js';
import { DEFAULT_TERRAIN } from '../config/outdoorConfig.js';

export const TERRAIN_MOVE_COST = {
  plains: 1,
  hills: 1.5,
  forest: 1.5,
  swamp: 2,
  mountains: 2.5,
  desert: 1.5,
  tundra: 1.5,
  beach: 1,
  water: null,
};

export const TRAVEL_PACES = [
  {
    id: 'slow',
    name: 'Slow',
    hexesPerHour: 2,
    hoursPerHex: 0.5,
    perception: 5,
    stealthAdvantage: true,
    encounterMod: -2,
    description: 'Cautious movement, easy to spot threats and stay hidden',
  },
  {
    id: 'normal',
    name: 'Normal',
    hexesPerHour: 3,
    hoursPerHex: 1 / 3,
    perception: 0,
    stealthAdvantage: false,
    encounterMod: 0,
    description: 'Standard adventuring pace',
  },
  {
    id: 'fast',
    name: 'Fast',
    hexesPerHour: 4,
    hoursPerHex: 0.25,
    perception: -5,
    stealthAdvantage: false,
    encounterMod: 2,
    description: 'Rapid travel, harder to notice threats or stay hidden',
  },
];

export const MAX_TRAVEL_HOURS_PER_DAY = 8;
export const MAX_FORCED_MARCH_HOURS = 12;

export function isTerrainPassable(terrainType) {
  return TERRAIN_MOVE_COST[terrainType] !== null;
}

export function getHexTravelTime(terrainType, paceId) {
  const pace = TRAVEL_PACES.find(p => p.id === paceId);
  if (!pace) return null;
  const cost = TERRAIN_MOVE_COST[terrainType];
  if (cost === null) return null;
  return pace.hoursPerHex * cost;
}

export function getHexMoveCost(terrainType) {
  return TERRAIN_MOVE_COST[terrainType] ?? null;
}

export function isHexOnRoad(q, r, roads) {
    if (!roads || roads.length === 0) return false;
    const key = `${q},${r}`;
    return roads.some(road => road.hexes && road.hexes.includes(key));
}

export function getHexMoveCostWithRoad(terrainType, q, r, roads) {
    const base = TERRAIN_MOVE_COST[terrainType];
    if (base === null) return null;
    if (!isHexOnRoad(q, r, roads)) return base;
    return Math.max(1, base - 0.5);
}

export function getDailyHexBudget(paceId) {
  const pace = TRAVEL_PACES.find(p => p.id === paceId);
  if (!pace) return null;
  return Math.floor(pace.hexesPerHour * MAX_TRAVEL_HOURS_PER_DAY);
}

export function getTotalTravelTime(path, terrain) {
  if (!path || path.length === 0) return { hours: 0, days: 0 };
  let totalHours = 0;
  for (const hex of path) {
    const key = hexKey(hex.q, hex.r);
    const t = terrain[key] || DEFAULT_TERRAIN;
    const cost = TERRAIN_MOVE_COST[t];
    if (cost !== null) totalHours += cost / 3; // hours at normal pace
  }
  return {
    hours: totalHours,
    days: totalHours / MAX_TRAVEL_HOURS_PER_DAY,
  };
}

export function calculatePath(from, to, gridSize, terrain, roads) {
  if (!from || !to) return [];
  if (from.q === to.q && from.r === to.r) return [];

  const openSet = [{ q: from.q, r: from.r, g: 0, f: hexDistance(from, to), parent: null }];
  const closedKeys = new Set();
  const openKeys = new Set();
  openKeys.add(hexKey(from.q, from.r));

  while (openSet.length > 0) {
    let lowestIdx = 0;
    for (let i = 1; i < openSet.length; i++) {
      if (openSet[i].f < openSet[lowestIdx].f) lowestIdx = i;
    }
    const current = openSet.splice(lowestIdx, 1)[0];
    const ck = hexKey(current.q, current.r);
    openKeys.delete(ck);

    if (current.q === to.q && current.r === to.r) {
      const path = [];
      let node = current;
      while (node) {
        path.unshift({ q: node.q, r: node.r });
        node = node.parent;
      }
      return path;
    }

    closedKeys.add(ck);

    for (const nb of hexNeighbors(current.q, current.r)) {
      const nk = hexKey(nb.q, nb.r);
      if (closedKeys.has(nk)) continue;
      if (nb.q < 0 || nb.q >= gridSize || nb.r < 0 || nb.r >= gridSize) continue;

      const terrainType = terrain[nk] || DEFAULT_TERRAIN;
      const baseCost = TERRAIN_MOVE_COST[terrainType];
      if (baseCost === null) continue;
      const cost = roads ? getHexMoveCostWithRoad(terrainType, nb.q, nb.r, roads) : baseCost;

      const tentativeG = current.g + cost;
      if (openKeys.has(nk)) {
        const existing = openSet.find(n => n.q === nb.q && n.r === nb.r);
        if (tentativeG < existing.g) {
          existing.g = tentativeG;
          existing.f = tentativeG + hexDistance(nb, to);
          existing.parent = current;
        }
      } else {
        openSet.push({
          q: nb.q, r: nb.r,
          g: tentativeG,
          f: tentativeG + hexDistance(nb, to),
          parent: current,
        });
        openKeys.add(nk);
      }
    }
  }

  return [];
}

export function formatTravelTime(hours) {
  if (hours < 1) {
    const mins = Math.round(hours * 60);
    return `${mins} min`;
  }
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
