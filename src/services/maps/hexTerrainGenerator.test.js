// @cleaned-by-ai
import { describe, it, expect } from 'vitest';
import { generateHexTerrain, generateRiversFromTerrain } from './hexTerrainGenerator.js';
import { TERRAIN_TYPES } from '../../config/outdoorConfig.js';

const VALID_TERRAIN_IDS = new Set(TERRAIN_TYPES.map((t) => t.id));

function terrainDistribution(terrain) {
  const dist = {};
  for (const t of Object.values(terrain)) {
    dist[t] = (dist[t] || 0) + 1;
  }
  return dist;
}

function allRiversAreValidHexKeys(rivers) {
  return rivers.every((r) => /^\d+,\d+$/.test(r));
}

function hexKeyExists(result, q, r) {
  return result.terrain.hasOwnProperty(`${q},${r}`);
}

describe('hexTerrainGenerator', () => {
  describe('generateHexTerrain', () => {
    it('should return object with terrain map and rivers array', () => {
      const result = generateHexTerrain({ gridSize: 5, seed: 42 });
      expect(result).toHaveProperty('terrain');
      expect(result).toHaveProperty('rivers');
      expect(typeof result.terrain).toBe('object');
      expect(Array.isArray(result.rivers)).toBe(true);
    });

    it('should return empty terrain and rivers for invalid gridSize values', () => {
      const invalidValues = [0, -1, -100, 3.5, NaN, Infinity];
      for (const gs of invalidValues) {
        expect(generateHexTerrain({ gridSize: gs })).toEqual({ terrain: {}, rivers: [] });
      }
    });

    it('should be deterministic with same seed', () => {
      const r1 = generateHexTerrain({ gridSize: 10, seed: 42 });
      const r2 = generateHexTerrain({ gridSize: 10, seed: 42 });
      expect(r1.terrain).toEqual(r2.terrain);
      expect(r1.rivers).toEqual(r2.rivers);
    });

    it('should produce different results with different seeds', () => {
      const r1 = generateHexTerrain({ gridSize: 10, seed: 1 });
      const r2 = generateHexTerrain({ gridSize: 10, seed: 999 });
      expect(r1.terrain).not.toEqual(r2.terrain);
    });

    it('should produce different results when no seed is provided', () => {
      const r1 = generateHexTerrain({ gridSize: 5 });
      const r2 = generateHexTerrain({ gridSize: 5 });
      expect(r1.terrain).not.toEqual(r2.terrain);
    });

    it('should generate terrain keys for all hexes in the grid', () => {
      const result = generateHexTerrain({ gridSize: 5, seed: 42 });
      const hexCols = 5 * 2;
      const hexRows = 5;
      let expectedCount = 0;
      for (let r = 0; r < hexRows; r++) {
        for (let q = 0; q < hexCols; q++) {
          expectedCount++;
          expect(hexKeyExists(result, q, r)).toBe(true);
        }
      }
      expect(Object.keys(result.terrain).length).toBe(expectedCount);
    });

    it('should only produce valid terrain types from config', () => {
      const result = generateHexTerrain({ gridSize: 10, seed: 42 });
      for (const type of Object.values(result.terrain)) {
        expect(VALID_TERRAIN_IDS.has(type)).toBe(true);
      }
    });

    it('should frame all edge hexes with water', () => {
      const result = generateHexTerrain({ gridSize: 8, seed: 42 });
      const hexCols = 8 * 2;
      const hexRows = 8;
      for (let r = 0; r < hexRows; r++) {
        for (let q = 0; q < hexCols; q++) {
          if (q === 0 || q === hexCols - 1 || r === 0 || r === hexRows - 1) {
            expect(result.terrain[`${q},${r}`]).toBe('water');
          }
        }
      }
    });

    it('should generate beaches adjacent to water on larger grids', () => {
      const result = generateHexTerrain({ gridSize: 20, seed: 42 });
      const beachHexes = Object.entries(result.terrain)
        .filter(([, v]) => v === 'beach')
        .map(([k]) => k);
      expect(beachHexes.length).toBeGreaterThan(0);
    });

    it('should have non-water hexes in the interior of larger grids', () => {
      const result = generateHexTerrain({ gridSize: 20, seed: 42 });
      const hexCols = 20 * 2;
      const hexRows = 20;
      let hasNonWaterInterior = false;
      for (let r = 1; r < hexRows - 1; r++) {
        for (let q = 1; q < hexCols - 1; q++) {
          const key = `${q},${r}`;
          if (result.terrain[key] !== 'water') {
            hasNonWaterInterior = true;
            break;
          }
        }
        if (hasNonWaterInterior) break;
      }
      expect(hasNonWaterInterior).toBe(true);
    });

    it('should produce varied terrain distribution on larger grids', () => {
      const result = generateHexTerrain({ gridSize: 20, seed: 42 });
      const dist = terrainDistribution(result.terrain);
      const terrainTypes = Object.keys(dist);
      expect(terrainTypes.length).toBeGreaterThanOrEqual(4);
    });

    it('should generate rivers as array of hex key strings', () => {
      const result = generateHexTerrain({ gridSize: 20, seed: 42 });
      expect(Array.isArray(result.rivers)).toBe(true);
      expect(allRiversAreValidHexKeys(result.rivers)).toBe(true);
    });

    it('should produce at least some rivers on larger grids', () => {
      const result = generateHexTerrain({ gridSize: 20, seed: 42 });
      expect(result.rivers.length).toBeGreaterThan(0);
    });

    it('should work with minimum valid gridSize values', () => {
      for (const gs of [1, 2]) {
        const result = generateHexTerrain({ gridSize: gs, seed: 42 });
        const hexCols = gs * 2;
        const hexRows = gs;
        let expectedCount = 0;
        for (let r = 0; r < hexRows; r++) {
          for (let q = 0; q < hexCols; q++) {
            expectedCount++;
            expect(hexKeyExists(result, q, r)).toBe(true);
          }
        }
        expect(Object.keys(result.terrain).length).toBe(expectedCount);
      }
    });

    it('should change terrain distribution when weights are provided', () => {
      const result = generateHexTerrain({ gridSize: 10, seed: 42 });
      const weights = { water: 0.5, hills: 0.3 };
      const resultWithWeights = generateHexTerrain({ gridSize: 10, seed: 42, weights });
      const dist = terrainDistribution(result.terrain);
      const distWithWeights = terrainDistribution(resultWithWeights.terrain);
      const allTypes = new Set([...Object.keys(dist), ...Object.keys(distWithWeights)]);
      let changed = false;
      for (const type of allTypes) {
        if ((dist[type] || 0) !== (distWithWeights[type] || 0)) {
          changed = true;
          break;
        }
      }
      expect(changed).toBe(true);
    });

    it('should ignore non-object weights values', () => {
      const r1 = generateHexTerrain({ gridSize: 10, seed: 42 });
      const r2 = generateHexTerrain({ gridSize: 10, seed: 42, weights: null });
      const r3 = generateHexTerrain({ gridSize: 10, seed: 42, weights: [] });
      const r4 = generateHexTerrain({ gridSize: 10, seed: 42, weights: 'plains' });
      expect(r2.terrain).toEqual(r1.terrain);
      expect(r3.terrain).toEqual(r1.terrain);
      expect(r4.terrain).toEqual(r1.terrain);
    });

    it('should only reference terrain hexes in rivers', () => {
      const result = generateHexTerrain({ gridSize: 20, seed: 42 });
      for (const riverHex of result.rivers) {
        expect(result.terrain).toHaveProperty(riverHex);
      }
    });
  });

  describe('generateRiversFromTerrain', () => {
    it('should return empty array for invalid inputs', () => {
      expect(generateRiversFromTerrain(null, 10)).toEqual([]);
      expect(generateRiversFromTerrain(undefined, 10)).toEqual([]);
      expect(generateRiversFromTerrain({}, null)).toEqual([]);
      expect(generateRiversFromTerrain({}, undefined)).toEqual([]);
      expect(generateRiversFromTerrain({}, 0)).toEqual([]);
      expect(generateRiversFromTerrain({}, -1)).toEqual([]);
    });

    it('should generate rivers as array of valid hex key strings', () => {
      const { terrain } = generateHexTerrain({ gridSize: 20, seed: 42 });
      const rivers = generateRiversFromTerrain(terrain, 20);
      expect(Array.isArray(rivers)).toBe(true);
      expect(allRiversAreValidHexKeys(rivers)).toBe(true);
    });

    it('should produce rivers that exist in the terrain map', () => {
      const { terrain } = generateHexTerrain({ gridSize: 20, seed: 42 });
      const rivers = generateRiversFromTerrain(terrain, 20);
      for (const riverHex of rivers) {
        expect(terrain).toHaveProperty(riverHex);
      }
    });

    it('should handle terrain with no mountains or hills', () => {
      const terrain = {};
      for (let r = 0; r < 5; r++) {
        for (let q = 0; q < 5; q++) {
          terrain[`${q},${r}`] = 'plains';
        }
      }
      const rivers = generateRiversFromTerrain(terrain, 5);
      expect(Array.isArray(rivers)).toBe(true);
    });

    it('should handle completely empty terrain object', () => {
      const rivers = generateRiversFromTerrain({}, 5);
      expect(Array.isArray(rivers)).toBe(true);
      expect(rivers.length).toBe(0);
    });

    it('should produce consistent results from existing terrain data', () => {
      const { terrain } = generateHexTerrain({ gridSize: 15, seed: 99 });
      const riversA = generateRiversFromTerrain(terrain, 15);
      const riversB = generateRiversFromTerrain(terrain, 15);
      expect(riversA).toEqual(riversB);
    });
  });
});
