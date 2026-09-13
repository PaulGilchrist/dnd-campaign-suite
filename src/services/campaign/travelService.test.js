// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
import { describe, it, expect } from 'vitest';
import {
  TERRAIN_MOVE_COST,
  TRAVEL_PACES,
  applyExhaustionSpeedPenalty,
  applyExhaustionSpeedPenaltyToBudget,
  getExhaustionMultiplierPercent,
  getHexTravelTime,
  getHexMoveCost,
  isHexOnRoad,
  getHexMoveCostWithRoad,
  getDailyHexBudget,
  getTotalTravelTime,
  calculatePath,
  formatTravelTime,
} from './travelService.js';

describe('travelService', () => {
  describe('constants', () => {
    it('should export TERRAIN_MOVE_COST, TRAVEL_PACES, and movement constants', () => {
      expect(TERRAIN_MOVE_COST).toEqual({
        plains: 0.75,
        hills: 1,
        forest: 1,
        swamp: 1.5,
        mountains: 2,
        desert: 1,
        tundra: 1.5,
        beach: 1,
        water: 4,
      });
      expect(TRAVEL_PACES).toHaveLength(3);
      const byId = Object.fromEntries(TRAVEL_PACES.map(p => [p.id, p]));
      expect(byId).toMatchObject({
        slow: { hexesPerHour: 1 / 3, hoursPerHex: 3 },
        normal: { hexesPerHour: 1 / 2, hoursPerHex: 2 },
        fast: { hexesPerHour: 2 / 3, hoursPerHex: 1.5 },
      });
    });
  });

  describe('applyExhaustionSpeedPenalty', () => {
    it('should return base cost for non-positive exhaustion or zero base', () => {
      expect(applyExhaustionSpeedPenalty(10, 0)).toBe(10);
      expect(applyExhaustionSpeedPenalty(10, -1)).toBe(10);
      expect(applyExhaustionSpeedPenalty(0, 5)).toBe(0);
    });

    it('should increase cost as exhaustion stacks grow', () => {
      expect(applyExhaustionSpeedPenalty(10, 1)).toBe(10 / (5 / 6));
      expect(applyExhaustionSpeedPenalty(10, 3)).toBe(10 / Math.pow(5 / 6, 3));
    });
  });

  describe('applyExhaustionSpeedPenaltyToBudget', () => {
    it('should return base budget for non-positive exhaustion or zero base', () => {
      expect(applyExhaustionSpeedPenaltyToBudget(10, 0)).toBe(10);
      expect(applyExhaustionSpeedPenaltyToBudget(10, -1)).toBe(10);
      expect(applyExhaustionSpeedPenaltyToBudget(0, 5)).toBe(0);
    });

    it('should decrease budget with exhaustion stacks (floored)', () => {
      expect(applyExhaustionSpeedPenaltyToBudget(12, 1)).toBe(Math.floor(Math.pow(5 / 6, 1) * 12));
      expect(applyExhaustionSpeedPenaltyToBudget(12, 2)).toBe(Math.floor(Math.pow(5 / 6, 2) * 12));
    });
  });

  describe('getExhaustionMultiplierPercent', () => {
    it('should return 100 for zero stacks and decreasing percentage for higher stacks', () => {
      expect(getExhaustionMultiplierPercent(0)).toBe(100);
      expect(getExhaustionMultiplierPercent(1)).toBe(Math.round(5 / 6 * 100));
      expect(getExhaustionMultiplierPercent(6)).toBe(33);
    });
  });

  describe('getHexTravelTime', () => {
    it('should return null for invalid pace and NaN for unknown terrain', () => {
      expect(getHexTravelTime('plains', 'invalid')).toBeNull();
      expect(Number.isNaN(getHexTravelTime('unknown', 'normal'))).toBe(true);
    });

    it('should return correct time for pace x terrain and halve for horseback', () => {
      expect(getHexTravelTime('plains', 'normal')).toBe(2 * 0.75);
      expect(getHexTravelTime('mountains', 'slow')).toBe(3 * 2);
      expect(getHexTravelTime('plains', 'normal', true)).toBe((2 * 0.75) / 2);
    });
  });

  describe('getHexMoveCost', () => {
    it('should return null for unknown or undefined terrain', () => {
      expect(getHexMoveCost('unknown')).toBeNull();
      expect(getHexMoveCost(undefined)).toBeNull();
    });
  });

  describe('isHexOnRoad', () => {
    it('should return false for empty/null roads or non-matching hex', () => {
      expect(isHexOnRoad(1, 2, [])).toBe(false);
      expect(isHexOnRoad(1, 2, null)).toBe(false);
      const roads = [{ hexes: ['1,2', '3,4'] }];
      expect(isHexOnRoad(5, 6, roads)).toBe(false);
    });

    it('should return true when hex matches any road hex across multiple roads', () => {
      const roads = [
        { hexes: ['1,2', '3,4'] },
        { hexes: ['5,6', '7,8'] },
      ];
      expect(isHexOnRoad(1, 2, roads)).toBe(true);
      expect(isHexOnRoad(3, 4, roads)).toBe(true);
      expect(isHexOnRoad(5, 6, roads)).toBe(true);
      expect(isHexOnRoad(9, 10, roads)).toBe(false);
    });
  });

  describe('getHexMoveCostWithRoad', () => {
    it('should return base cost when not on road or roads is null', () => {
      expect(getHexMoveCostWithRoad('plains', 1, 2, [{ hexes: ['5,6'] }])).toBe(0.75);
      expect(getHexMoveCostWithRoad('plains', 1, 2, null)).toBe(0.75);
    });

    it('should reduce cost by 0.5 when on road with minimum of 1', () => {
      const roads = [{ hexes: ['1,2'] }];
      expect(getHexMoveCostWithRoad('plains', 1, 2, roads)).toBe(1);
      expect(getHexMoveCostWithRoad('mountains', 1, 2, roads)).toBe(1.5);
    });

    it('should return NaN for unknown terrain even on road', () => {
      const roads = [{ hexes: ['1,2'] }];
      expect(Number.isNaN(getHexMoveCostWithRoad('unknown', 1, 2, roads))).toBe(true);
    });
  });

  describe('getDailyHexBudget', () => {
    it('should return the correct hex budget for each pace and null for invalid', () => {
      expect(getDailyHexBudget('slow')).toBe(2);
      expect(getDailyHexBudget('normal')).toBe(4);
      expect(getDailyHexBudget('fast')).toBe(5);
      expect(getDailyHexBudget('invalid')).toBeNull();
    });
  });

  describe('getTotalTravelTime', () => {
    it('should return zero for empty path', () => {
      expect(getTotalTravelTime([])).toEqual({ hours: 0, days: 0 });
      expect(getTotalTravelTime(null)).toEqual({ hours: 0, days: 0 });
      expect(getTotalTravelTime(undefined)).toEqual({ hours: 0, days: 0 });
    });

    it('should sum travel time across multiple hexes and calculate days', () => {
      const path = [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 1, r: 1 }];
      const terrain = { '0,0': 'plains', '1,0': 'hills', '1,1': 'forest' };
      const result = getTotalTravelTime(path, terrain);
      expect(result.hours).toBeCloseTo((0.75 + 1 + 1) / 3);
      expect(result.days).toBeCloseTo(result.hours / 8);
    });
  });

  describe('calculatePath', () => {
    it('should return empty array for null inputs or same start/end', () => {
      expect(calculatePath(null, { q: 1, r: 1 }, { hexCols: 10, hexRows: 10, terrain: {}, roads: [] })).toEqual([]);
      expect(calculatePath({ q: 0, r: 0 }, null, { hexCols: 10, hexRows: 10, terrain: {}, roads: [] })).toEqual([]);
      expect(calculatePath({ q: 0, r: 0 }, { q: 0, r: 0 }, { hexCols: 10, hexRows: 10, terrain: {}, roads: [] })).toEqual([]);
    });

    it('should return a path including start and end hexes', () => {
      const result = calculatePath({ q: 0, r: 0 }, { q: 2, r: 0 }, { hexCols: 10, hexRows: 10, terrain: {}, roads: [] });
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toEqual({ q: 0, r: 0 });
      expect(result[result.length - 1]).toEqual({ q: 2, r: 0 });
    });

    it('should avoid high-cost terrain when alternatives exist', () => {
      const terrain = {
        '1,0': 'mountains',
        '2,0': 'mountains',
        '3,0': 'mountains',
        '0,1': 'plains',
        '1,1': 'plains',
        '2,1': 'plains',
        '3,1': 'plains',
        '4,0': 'plains',
      };
      const result = calculatePath({ q: 0, r: 0 }, { q: 4, r: 0 }, { hexCols: 5, hexRows: 5, terrain, roads: [] });
      const mountainHexes = result.filter(h => terrain[`${h.q},${h.r}`] === 'mountains');
      expect(mountainHexes.length).toBe(0);
    });

    it('should respect grid boundaries and use roads when provided', () => {
      const result = calculatePath({ q: 0, r: 0 }, { q: 3, r: 3 }, { hexCols: 5, hexRows: 5, terrain: {}, roads: [] });
      for (const hex of result) {
        expect(hex.q).toBeGreaterThanOrEqual(0);
        expect(hex.q).toBeLessThan(5);
        expect(hex.r).toBeGreaterThanOrEqual(0);
        expect(hex.r).toBeLessThan(5);
      }
      const roads = [{ hexes: ['1,0', '2,0', '3,0'] }];
      const terrain = { '1,0': 'plains', '2,0': 'plains', '3,0': 'plains' };
      const roadResult = calculatePath({ q: 0, r: 0 }, { q: 4, r: 0 }, { hexCols: 10, hexRows: 10, terrain, roads });
      expect(roadResult.length).toBeGreaterThan(0);
    });

    it('should return empty array when destination is unreachable', () => {
      const result = calculatePath({ q: 0, r: 0 }, { q: 5, r: 5 }, { hexCols: 2, hexRows: 2, terrain: {}, roads: [] });
      expect(result).toEqual([]);
    });
  });

  describe('formatTravelTime', () => {
    it('should format sub-hour values in minutes and hour values with optional minutes', () => {
      expect(formatTravelTime(0)).toBe('0 min');
      expect(formatTravelTime(0.5)).toBe('30 min');
      expect(formatTravelTime(0.75)).toBe('45 min');
      expect(formatTravelTime(1)).toBe('1h');
      expect(formatTravelTime(1.5)).toBe('1h 30m');
      expect(formatTravelTime(2.5)).toBe('2h 30m');
    });

    it('should handle large hour values', () => {
      expect(formatTravelTime(48)).toBe('48h');
      expect(formatTravelTime(24.5)).toBe('24h 30m');
    });
  });
});
