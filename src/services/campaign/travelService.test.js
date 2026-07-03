// @cleaned-by-ai
// Removed redundant tests: duplicate constant enumeration, overlapping monotonicity checks,
// duplicate passability/road edge cases, overlapping terrain pace tests, and redundant A* pathfinding tests.
// Consolidated edge-case assertions into single tests where behavior is identical.
import { describe, it, expect } from 'vitest';
import {
  TERRAIN_MOVE_COST,
  TRAVEL_PACES,
  MAX_TRAVEL_HOURS_PER_DAY,
  MAX_FORCED_MARCH_HOURS,
  HORSEBACK_SPEED_MULTIPLIER,
  EXHAUSTION_SPEED_MULTIPLIER,
  EXHAUSTION_LEVELS,
  applyExhaustionSpeedPenalty,
  applyExhaustionSpeedPenaltyToBudget,
  getExhaustionMultiplierPercent,
  isTerrainPassable,
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
    it('should export TERRAIN_MOVE_COST with correct values for all terrain types', () => {
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
    });

    it('should export TRAVEL_PACES with slow, normal, and fast configurations', () => {
      expect(TRAVEL_PACES).toHaveLength(3);

      const slow = TRAVEL_PACES.find(p => p.id === 'slow');
      expect(slow).toBeDefined();
      expect(slow.hexesPerHour).toBe(1 / 3);
      expect(slow.hoursPerHex).toBe(3);
      expect(slow.perception).toBe(5);
      expect(slow.stealthAdvantage).toBe(true);
      expect(slow.encounterMod).toBe(-2);

      const normal = TRAVEL_PACES.find(p => p.id === 'normal');
      expect(normal).toBeDefined();
      expect(normal.hexesPerHour).toBe(1 / 2);
      expect(normal.hoursPerHex).toBe(2);
      expect(normal.perception).toBe(0);
      expect(normal.stealthAdvantage).toBe(false);
      expect(normal.encounterMod).toBe(0);

      const fast = TRAVEL_PACES.find(p => p.id === 'fast');
      expect(fast).toBeDefined();
      expect(fast.hexesPerHour).toBe(2 / 3);
      expect(fast.hoursPerHex).toBe(1.5);
      expect(fast.perception).toBe(-5);
      expect(fast.stealthAdvantage).toBe(false);
      expect(fast.encounterMod).toBe(2);
    });

    it('should export movement constants with correct values', () => {
      expect(MAX_TRAVEL_HOURS_PER_DAY).toBe(8);
      expect(MAX_FORCED_MARCH_HOURS).toBe(6);
      expect(HORSEBACK_SPEED_MULTIPLIER).toBe(2);
      expect(EXHAUSTION_SPEED_MULTIPLIER).toBe(5 / 6);
      expect(EXHAUSTION_LEVELS).toBe(6);
    });
  });

  describe('applyExhaustionSpeedPenalty', () => {
    it('should return base cost when exhaustion stacks is zero or negative', () => {
      expect(applyExhaustionSpeedPenalty(10, 0)).toBe(10);
      expect(applyExhaustionSpeedPenalty(10, -1)).toBe(10);
    });

    it('should increase cost with exhaustion stacks', () => {
      expect(applyExhaustionSpeedPenalty(10, 1)).toBe(10 / (5 / 6));
      expect(applyExhaustionSpeedPenalty(10, 3)).toBe(10 / Math.pow(5 / 6, 3));
    });

    it('should return 0 when base cost is 0 regardless of exhaustion', () => {
      expect(applyExhaustionSpeedPenalty(0, 5)).toBe(0);
    });
  });

  describe('applyExhaustionSpeedPenaltyToBudget', () => {
    it('should return base budget when exhaustion stacks is zero or negative', () => {
      expect(applyExhaustionSpeedPenaltyToBudget(10, 0)).toBe(10);
      expect(applyExhaustionSpeedPenaltyToBudget(10, -1)).toBe(10);
    });

    it('should decrease budget with exhaustion stacks (floored)', () => {
      expect(applyExhaustionSpeedPenaltyToBudget(12, 1)).toBe(Math.floor(Math.pow(5 / 6, 1) * 12));
      expect(applyExhaustionSpeedPenaltyToBudget(12, 2)).toBe(Math.floor(Math.pow(5 / 6, 2) * 12));
    });

    it('should return 0 when base budget is 0 regardless of exhaustion', () => {
      expect(applyExhaustionSpeedPenaltyToBudget(0, 5)).toBe(0);
    });
  });

  describe('getExhaustionMultiplierPercent', () => {
    it('should return 100 for zero stacks', () => {
      expect(getExhaustionMultiplierPercent(0)).toBe(100);
    });

    it('should return rounded percentage that decreases with more stacks', () => {
      expect(getExhaustionMultiplierPercent(1)).toBe(Math.round(5 / 6 * 100));
      expect(getExhaustionMultiplierPercent(3)).toBe(Math.round(Math.pow(5 / 6, 3) * 100));
      expect(getExhaustionMultiplierPercent(6)).toBe(33);
    });
  });

  describe('isTerrainPassable', () => {
    it('should return true for all defined terrain types and unknown/undefined terrain', () => {
      for (const terrain of Object.keys(TERRAIN_MOVE_COST)) {
        expect(isTerrainPassable(terrain)).toBe(true);
      }
      expect(isTerrainPassable('unknown')).toBe(true);
      expect(isTerrainPassable(undefined)).toBe(true);
    });
  });

  describe('getHexTravelTime', () => {
    it('should return null for invalid pace id', () => {
      expect(getHexTravelTime('plains', 'invalid')).toBeNull();
    });

    it('should return correct time for each pace on plains (base cost 0.75)', () => {
      expect(getHexTravelTime('plains', 'slow')).toBe(3 * 0.75);
      expect(getHexTravelTime('plains', 'normal')).toBe(2 * 0.75);
      expect(getHexTravelTime('plains', 'fast')).toBe(1.5 * 0.75);
    });

    it('should return correct time for each pace on mountains (base cost 2)', () => {
      expect(getHexTravelTime('mountains', 'slow')).toBe(3 * 2);
      expect(getHexTravelTime('mountains', 'normal')).toBe(2 * 2);
      expect(getHexTravelTime('mountains', 'fast')).toBe(1.5 * 2);
    });

    it('should halve travel time for horseback travel', () => {
      expect(getHexTravelTime('plains', 'normal', true)).toBe((2 * 0.75) / 2);
      expect(getHexTravelTime('mountains', 'normal', true)).toBe((2 * 2) / 2);
      expect(getHexTravelTime('swamp', 'slow', true)).toBe((3 * 1.5) / 2);
    });

    it('should handle water terrain (cost 4)', () => {
      expect(getHexTravelTime('water', 'normal')).toBe(2 * 4);
      expect(getHexTravelTime('water', 'normal', true)).toBe((2 * 4) / 2);
    });

    it('should produce NaN for unknown terrain (undefined cost)', () => {
      expect(Number.isNaN(getHexTravelTime('unknown', 'normal'))).toBe(true);
    });
  });

  describe('getHexMoveCost', () => {
    it('should return the correct move cost for each terrain type', () => {
      expect(getHexMoveCost('plains')).toBe(0.75);
      expect(getHexMoveCost('swamp')).toBe(1.5);
      expect(getHexMoveCost('mountains')).toBe(2);
      expect(getHexMoveCost('water')).toBe(4);
    });

    it('should return null for unknown or undefined terrain', () => {
      expect(getHexMoveCost('unknown')).toBeNull();
      expect(getHexMoveCost(undefined)).toBeNull();
    });
  });

  describe('isHexOnRoad', () => {
    it('should return false for empty, null, or undefined roads', () => {
      expect(isHexOnRoad(1, 2, [])).toBe(false);
      expect(isHexOnRoad(1, 2, null)).toBe(false);
      expect(isHexOnRoad(1, 2, undefined)).toBe(false);
    });

    it('should return true when hex matches any road hex', () => {
      const roads = [{ hexes: ['1,2', '3,4', '5,6'] }];
      expect(isHexOnRoad(1, 2, roads)).toBe(true);
      expect(isHexOnRoad(3, 4, roads)).toBe(true);
      expect(isHexOnRoad(5, 6, roads)).toBe(true);
    });

    it('should return false when hex is not on any road', () => {
      const roads = [{ hexes: ['1,2', '3,4'] }];
      expect(isHexOnRoad(5, 6, roads)).toBe(false);
      expect(isHexOnRoad(0, 0, roads)).toBe(false);
    });

    it('should handle multiple roads', () => {
      const roads = [
        { hexes: ['1,2', '3,4'] },
        { hexes: ['5,6', '7,8'] },
      ];
      expect(isHexOnRoad(3, 4, roads)).toBe(true);
      expect(isHexOnRoad(5, 6, roads)).toBe(true);
      expect(isHexOnRoad(9, 10, roads)).toBe(false);
    });
  });

  describe('getHexMoveCostWithRoad', () => {
    it('should return base cost when not on road', () => {
      const roads = [{ hexes: ['5,6'] }];
      expect(getHexMoveCostWithRoad('plains', 1, 2, roads)).toBe(0.75);
    });

    it('should return base cost when roads is null', () => {
      expect(getHexMoveCostWithRoad('plains', 1, 2, null)).toBe(0.75);
    });

    it('should reduce cost by 0.5 when on road, with minimum of 1', () => {
      const roads = [{ hexes: ['1,2'] }];
      expect(getHexMoveCostWithRoad('plains', 1, 2, roads)).toBe(1);
      expect(getHexMoveCostWithRoad('swamp', 1, 2, roads)).toBe(1);
      expect(getHexMoveCostWithRoad('mountains', 1, 2, roads)).toBe(1.5);
      expect(getHexMoveCostWithRoad('water', 1, 2, roads)).toBe(3.5);
    });

    it('should return null for unknown terrain even on road', () => {
      const roads = [{ hexes: ['1,2'] }];
      expect(Number.isNaN(getHexMoveCostWithRoad('unknown', 1, 2, roads))).toBe(true);
    });
  });

  describe('getDailyHexBudget', () => {
    it('should return the correct hex budget for each pace', () => {
      expect(getDailyHexBudget('slow')).toBe(2);
      expect(getDailyHexBudget('normal')).toBe(4);
      expect(getDailyHexBudget('fast')).toBe(5);
    });

    it('should return null for invalid pace id', () => {
      expect(getDailyHexBudget('invalid')).toBeNull();
    });
  });

  describe('getTotalTravelTime', () => {
    it('should return { hours: 0, days: 0 } for empty, null, or undefined path', () => {
      expect(getTotalTravelTime([])).toEqual({ hours: 0, days: 0 });
      expect(getTotalTravelTime(null)).toEqual({ hours: 0, days: 0 });
      expect(getTotalTravelTime(undefined)).toEqual({ hours: 0, days: 0 });
    });

    it('should calculate travel time for a single hex at normal pace', () => {
      const path = [{ q: 0, r: 0 }];
      const terrain = { '0,0': 'plains' };
      const result = getTotalTravelTime(path, terrain);
      expect(result.hours).toBe(0.75 / 3);
    });

    it('should sum travel time across multiple hexes', () => {
      const path = [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 1, r: 1 }];
      const terrain = { '0,0': 'plains', '1,0': 'hills', '1,1': 'forest' };
      const result = getTotalTravelTime(path, terrain);
      expect(result.hours).toBeCloseTo((0.75 + 1 + 1) / 3);
    });

    it('should use default terrain (plains) for hexes not in terrain map', () => {
      const path = [{ q: 0, r: 0 }, { q: 1, r: 0 }];
      const terrain = { '0,0': 'plains' };
      const result = getTotalTravelTime(path, terrain);
      expect(result.hours).toBeCloseTo((0.75 + 0.75) / 3);
    });

    it('should include expensive terrain like water', () => {
      const path = [{ q: 0, r: 0 }, { q: 1, r: 0 }];
      const terrain = { '0,0': 'plains', '1,0': 'water' };
      const result = getTotalTravelTime(path, terrain);
      expect(result.hours).toBeCloseTo((0.75 + 4) / 3);
    });

    it('should halve travel time for horseback travel', () => {
      const path = [{ q: 0, r: 0 }, { q: 1, r: 0 }];
      const terrain = { '0,0': 'plains', '1,0': 'hills' };
      const result = getTotalTravelTime(path, terrain, true);
      const expectedHours = (0.75 + 1) / 3 / 2;
      expect(result.hours).toBeCloseTo(expectedHours);
    });

    it('should calculate days from total hours', () => {
      const path = [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 1, r: 1 }, { q: 2, r: 1 }];
      const terrain = { '0,0': 'plains', '1,0': 'hills', '1,1': 'forest', '2,1': 'desert' };
      const result = getTotalTravelTime(path, terrain);
      expect(result.days).toBeCloseTo(result.hours / 8);
    });
  });

  describe('calculatePath', () => {
    it('should return empty array for null or undefined from/to', () => {
      expect(calculatePath(null, { q: 1, r: 1 }, 10, 10, {}, [])).toEqual([]);
      expect(calculatePath({ q: 0, r: 0 }, null, 10, 10, {}, [])).toEqual([]);
      expect(calculatePath(null, null, 10, 10, {}, [])).toEqual([]);
    });

    it('should return empty array when from and to are the same hex', () => {
      const result = calculatePath({ q: 0, r: 0 }, { q: 0, r: 0 }, 10, 10, {}, []);
      expect(result).toEqual([]);
    });

    it('should return a path that includes start and end hexes', () => {
      const result = calculatePath({ q: 0, r: 0 }, { q: 2, r: 0 }, 10, 10, {}, []);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toEqual({ q: 0, r: 0 });
      expect(result[result.length - 1]).toEqual({ q: 2, r: 0 });
    });

    it('should return a path for adjacent hexes', () => {
      const result = calculatePath({ q: 0, r: 0 }, { q: 1, r: 0 }, 10, 10, {}, []);
      expect(result.length).toBeGreaterThan(1);
      expect(result[0]).toEqual({ q: 0, r: 0 });
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
      const result = calculatePath({ q: 0, r: 0 }, { q: 4, r: 0 }, 5, 5, terrain, []);
      const mountainHexes = result.filter(h => terrain[`${h.q},${h.r}`] === 'mountains');
      expect(mountainHexes.length).toBe(0);
    });

    it('should respect grid boundaries', () => {
      const result = calculatePath({ q: 0, r: 0 }, { q: 3, r: 3 }, 5, 5, {}, []);
      for (const hex of result) {
        expect(hex.q).toBeGreaterThanOrEqual(0);
        expect(hex.q).toBeLessThan(5);
        expect(hex.r).toBeGreaterThanOrEqual(0);
        expect(hex.r).toBeLessThan(5);
      }
    });

    it('should use road costs when roads are provided', () => {
      const roads = [{ hexes: ['1,0', '2,0', '3,0'] }];
      const terrain = {
        '1,0': 'plains',
        '2,0': 'plains',
        '3,0': 'plains',
      };
      const result = calculatePath({ q: 0, r: 0 }, { q: 4, r: 0 }, 10, 10, terrain, roads);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should return empty array when destination is unreachable', () => {
      const result = calculatePath({ q: 0, r: 0 }, { q: 5, r: 5 }, 2, 2, {}, []);
      expect(result).toEqual([]);
    });

    it('should handle diagonal-ish hex paths on a large grid', () => {
      const result = calculatePath({ q: 0, r: 0 }, { q: 3, r: 2 }, 10, 10, {}, []);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toEqual({ q: 0, r: 0 });
      expect(result[result.length - 1]).toEqual({ q: 3, r: 2 });
    });
  });

  describe('formatTravelTime', () => {
    it('should format 0 hours as 0 min', () => {
      expect(formatTravelTime(0)).toBe('0 min');
    });

    it('should format sub-hour values in minutes', () => {
      expect(formatTravelTime(0.5)).toBe('30 min');
      expect(formatTravelTime(0.75)).toBe('45 min');
      expect(formatTravelTime(0.01)).toBe('1 min');
    });

    it('should format hour values without minutes when exact', () => {
      expect(formatTravelTime(1)).toBe('1h');
      expect(formatTravelTime(2)).toBe('2h');
      expect(formatTravelTime(24)).toBe('24h');
    });

    it('should format hour and minute values when minutes exist', () => {
      expect(formatTravelTime(1.5)).toBe('1h 30m');
      expect(formatTravelTime(2.5)).toBe('2h 30m');
      expect(formatTravelTime(1.25)).toBe('1h 15m');
    });

    it('should round fractional minutes correctly', () => {
      expect(formatTravelTime(1.1)).toBe('1h 6m');
    });

    it('should handle large hour values', () => {
      expect(formatTravelTime(48)).toBe('48h');
      expect(formatTravelTime(24.5)).toBe('24h 30m');
    });
  });
});
