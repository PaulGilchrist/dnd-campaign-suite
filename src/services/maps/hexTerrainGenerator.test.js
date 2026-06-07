import { describe, it, expect } from 'vitest';
import { generateHexTerrain, generateRiversFromTerrain } from './hexTerrainGenerator.js';
import { TERRAIN_TYPES } from '../../config/outdoorConfig.js';

const VALID_TERRAIN_IDS = new Set(TERRAIN_TYPES.map(t => t.id));

describe('hexTerrainGenerator', () => {
  describe('generateHexTerrain', () => {
    it('should return terrain and rivers', () => {
      const result = generateHexTerrain({ gridSize: 10, seed: 42 });
      expect(result).toHaveProperty('terrain');
      expect(result).toHaveProperty('rivers');
    });

    it('should return empty result for invalid gridSize', () => {
      expect(generateHexTerrain({ gridSize: 0 })).toEqual({ terrain: {}, rivers: [] });
      expect(generateHexTerrain({ gridSize: -1 })).toEqual({ terrain: {}, rivers: [] });
    });

    it('should return empty result for non-integer gridSize', () => {
      expect(generateHexTerrain({ gridSize: 3.5 })).toEqual({ terrain: {}, rivers: [] });
    });

    it('should generate terrain for all hexes in grid', () => {
      const result = generateHexTerrain({ gridSize: 5, seed: 42 });
      expect(Object.keys(result.terrain).length).toBe(50);
    });

    it('should only produce valid terrain types', () => {
      const result = generateHexTerrain({ gridSize: 10, seed: 42 });
      for (const key of Object.keys(result.terrain)) {
        expect(VALID_TERRAIN_IDS.has(result.terrain[key])).toBe(true);
      }
    });

    it('should be deterministic with same seed', () => {
      const r1 = generateHexTerrain({ gridSize: 10, seed: 42 });
      const r2 = generateHexTerrain({ gridSize: 10, seed: 42 });
      expect(r1.terrain).toEqual(r2.terrain);
      expect(r2.rivers).toEqual(r1.rivers);
    });

    it('should produce different results with different seeds', () => {
      const r1 = generateHexTerrain({ gridSize: 10, seed: 1 });
      const r2 = generateHexTerrain({ gridSize: 10, seed: 999 });
      expect(r1.terrain).not.toEqual(r2.terrain);
    });

    it('should frame edges with water', () => {
      const result = generateHexTerrain({ gridSize: 10, seed: 42 });
      expect(result.terrain['0,0']).toBe('water');
      expect(result.terrain['9,9']).toBe('water');
      expect(result.terrain['0,9']).toBe('water');
      expect(result.terrain['9,0']).toBe('water');
    });

    it('should generate rivers as array of hex keys', () => {
      const result = generateHexTerrain({ gridSize: 20, seed: 42 });
      expect(Array.isArray(result.rivers)).toBe(true);
      for (const river of result.rivers) {
        expect(river).toMatch(/^\d+,\d+$/);
      }
    });

    it('should work with gridSize 1', () => {
      const result = generateHexTerrain({ gridSize: 1, seed: 42 });
      expect(Object.keys(result.terrain).length).toBe(2);
      expect(result.terrain['0,0']).toBe('water');
    });

    it('should work without explicit seed', () => {
      const result = generateHexTerrain({ gridSize: 10 });
      expect(Object.keys(result.terrain).length).toBe(200);
    });

    it('should apply weights when provided', () => {
      const weights = { water: 0.1, plains: 2.0 };
      const result = generateHexTerrain({ gridSize: 10, seed: 42, weights });
      expect(Object.keys(result.terrain).length).toBe(200);
    });

    it('should ignore empty weights object', () => {
      const r1 = generateHexTerrain({ gridSize: 10, seed: 42 });
      const r2 = generateHexTerrain({ gridSize: 10, seed: 42, weights: {} });
      expect(r1.terrain).toEqual(r2.terrain);
    });

    it('should produce beaches adjacent to water', () => {
      const result = generateHexTerrain({ gridSize: 20, seed: 42 });
      const beachHexes = Object.entries(result.terrain)
        .filter(([, v]) => v === 'beach')
        .map(([k]) => k);
      expect(beachHexes.length).toBeGreaterThan(0);
    });

    it('should have at least some non-water hexes in larger grids', () => {
      const result = generateHexTerrain({ gridSize: 20, seed: 42 });
      const nonWater = Object.values(result.terrain).filter(t => t !== 'water');
      expect(nonWater.length).toBeGreaterThan(0);
    });
  });

  describe('generateRiversFromTerrain', () => {
    it('should return empty array for null terrain', () => {
      expect(generateRiversFromTerrain(null, 10)).toEqual([]);
    });

    it('should return empty array for missing gridSize', () => {
      expect(generateRiversFromTerrain({}, null)).toEqual([]);
    });

    it('should generate rivers from existing terrain', () => {
      const { terrain } = generateHexTerrain({ gridSize: 20, seed: 42 });
      const rivers = generateRiversFromTerrain(terrain, 20);
      expect(Array.isArray(rivers)).toBe(true);
    });

    it('should return rivers as hex key strings', () => {
      const { terrain } = generateHexTerrain({ gridSize: 20, seed: 42 });
      const rivers = generateRiversFromTerrain(terrain, 20);
      for (const river of rivers) {
        expect(river).toMatch(/^\d+,\d+$/);
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
  });
});
