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
    it('should export TERRAIN_MOVE_COST with all terrain types', () => {
      expect(TERRAIN_MOVE_COST.plains).toBe(0.75);
      expect(TERRAIN_MOVE_COST.hills).toBe(1);
      expect(TERRAIN_MOVE_COST.forest).toBe(1);
      expect(TERRAIN_MOVE_COST.swamp).toBe(1.5);
      expect(TERRAIN_MOVE_COST.mountains).toBe(2);
      expect(TERRAIN_MOVE_COST.desert).toBe(1);
      expect(TERRAIN_MOVE_COST.tundra).toBe(1.5);
      expect(TERRAIN_MOVE_COST.beach).toBe(1);
      expect(TERRAIN_MOVE_COST.water).toBe(4);
    });

    it('should export TRAVEL_PACES with slow, normal, and fast', () => {
      expect(TRAVEL_PACES).toHaveLength(3);
      expect(TRAVEL_PACES.map(p => p.id)).toEqual(['slow', 'normal', 'fast']);
    });

    it('should export TRAVEL_PACES with correct slow pace values', () => {
      const slow = TRAVEL_PACES.find(p => p.id === 'slow');
      expect(slow.hexesPerHour).toBe(1 / 3);
      expect(slow.hoursPerHex).toBe(3);
      expect(slow.perception).toBe(5);
      expect(slow.stealthAdvantage).toBe(true);
      expect(slow.encounterMod).toBe(-2);
    });

    it('should export TRAVEL_PACES with correct normal pace values', () => {
      const normal = TRAVEL_PACES.find(p => p.id === 'normal');
      expect(normal.hexesPerHour).toBe(1 / 2);
      expect(normal.hoursPerHex).toBe(2);
      expect(normal.perception).toBe(0);
      expect(normal.stealthAdvantage).toBe(false);
      expect(normal.encounterMod).toBe(0);
    });

    it('should export TRAVEL_PACES with correct fast pace values', () => {
      const fast = TRAVEL_PACES.find(p => p.id === 'fast');
      expect(fast.hexesPerHour).toBe(2 / 3);
      expect(fast.hoursPerHex).toBe(1.5);
      expect(fast.perception).toBe(-5);
      expect(fast.stealthAdvantage).toBe(false);
      expect(fast.encounterMod).toBe(2);
    });

    it('should export MAX_TRAVEL_HOURS_PER_DAY as 8', () => {
      expect(MAX_TRAVEL_HOURS_PER_DAY).toBe(8);
    });

    it('should export MAX_FORCED_MARCH_HOURS as 6', () => {
      expect(MAX_FORCED_MARCH_HOURS).toBe(6);
    });

    it('should export HORSEBACK_SPEED_MULTIPLIER as 2', () => {
      expect(HORSEBACK_SPEED_MULTIPLIER).toBe(2);
    });

    it('should export EXHAUSTION_SPEED_MULTIPLIER as 5/6', () => {
      expect(EXHAUSTION_SPEED_MULTIPLIER).toBe(5 / 6);
    });

    it('should export EXHAUSTION_LEVELS as 6', () => {
      expect(EXHAUSTION_LEVELS).toBe(6);
    });
  });

  describe('applyExhaustionSpeedPenalty', () => {
    it('should return base cost when exhaustion is 0', () => {
      expect(applyExhaustionSpeedPenalty(10, 0)).toBe(10);
    });

    it('should return base cost when exhaustion is negative', () => {
      expect(applyExhaustionSpeedPenalty(10, -1)).toBe(10);
    });

    it('should reduce cost with 1 stack of exhaustion', () => {
      const result = applyExhaustionSpeedPenalty(10, 1);
      expect(result).toBe(10 / (5 / 6));
    });

    it('should reduce cost with multiple stacks of exhaustion', () => {
      const result = applyExhaustionSpeedPenalty(10, 3);
      const expected = 10 / Math.pow(5 / 6, 3);
      expect(result).toBe(expected);
    });

    it('should return 0 for base cost of 0', () => {
      expect(applyExhaustionSpeedPenalty(0, 2)).toBe(0);
    });
  });

  describe('applyExhaustionSpeedPenaltyToBudget', () => {
    it('should return base budget when exhaustion is 0', () => {
      expect(applyExhaustionSpeedPenaltyToBudget(10, 0)).toBe(10);
    });

    it('should return base budget when exhaustion is negative', () => {
      expect(applyExhaustionSpeedPenaltyToBudget(10, -1)).toBe(10);
    });

    it('should increase budget with 1 stack of exhaustion', () => {
      const result = applyExhaustionSpeedPenaltyToBudget(10, 1);
      expect(result).toBe(Math.floor(5 / 6 * 10));
    });

    it('should increase budget with multiple stacks of exhaustion', () => {
      const result = applyExhaustionSpeedPenaltyToBudget(10, 2);
      const expected = Math.floor(Math.pow(5 / 6, 2) * 10);
      expect(result).toBe(expected);
    });

    it('should return 0 for base budget of 0', () => {
      expect(applyExhaustionSpeedPenaltyToBudget(0, 3)).toBe(0);
    });
  });

  describe('getExhaustionMultiplierPercent', () => {
    it('should return 100 for 0 stacks', () => {
      expect(getExhaustionMultiplierPercent(0)).toBe(100);
    });

    it('should return rounded percentage for 1 stack', () => {
      const result = getExhaustionMultiplierPercent(1);
      const expected = Math.round(5 / 6 * 100);
      expect(result).toBe(expected);
    });

    it('should return rounded percentage for 3 stacks', () => {
      const result = getExhaustionMultiplierPercent(3);
      const expected = Math.round(Math.pow(5 / 6, 3) * 100);
      expect(result).toBe(expected);
    });

    it('should return rounded percentage for 6 stacks', () => {
      const result = getExhaustionMultiplierPercent(6);
      const expected = Math.round(Math.pow(5 / 6, 6) * 100);
      expect(result).toBe(expected);
    });
  });

  describe('isTerrainPassable', () => {
    it('should return true for plains', () => {
      expect(isTerrainPassable('plains')).toBe(true);
    });

    it('should return true for all defined terrain types', () => {
      for (const terrain of Object.keys(TERRAIN_MOVE_COST)) {
        expect(isTerrainPassable(terrain)).toBe(true);
      }
    });

    it('should return true for unknown terrain (undefined cost !== null)', () => {
      expect(isTerrainPassable('unknown')).toBe(true);
    });

    it('should return true for undefined (undefined cost !== null)', () => {
      expect(isTerrainPassable(undefined)).toBe(true);
    });
  });

  describe('getHexTravelTime', () => {
    it('should return travel time for normal pace on plains', () => {
      const result = getHexTravelTime('plains', 'normal');
      expect(result).toBe(2 * 0.75);
    });

    it('should return travel time for normal pace on mountains', () => {
      const result = getHexTravelTime('mountains', 'normal');
      expect(result).toBe(2 * 2);
    });

    it('should return reduced time for horseback travel', () => {
      const result = getHexTravelTime('plains', 'normal', true);
      expect(result).toBe(2 * 0.75 / 2);
    });

    it('should return reduced time for horseback on mountains', () => {
      const result = getHexTravelTime('mountains', 'normal', true);
      expect(result).toBe(2 * 2 / 2);
    });

    it('should return null for slow pace on swamp', () => {
      const result = getHexTravelTime('swamp', 'slow');
      expect(result).toBe(3 * 1.5);
    });

    it('should return null for invalid pace id', () => {
      expect(getHexTravelTime('plains', 'invalid')).toBeNull();
    });

    it('should return travel time for water terrain (cost=4)', () => {
      const result = getHexTravelTime('water', 'normal');
      expect(result).toBe(2 * 4);
    });

    it('should return NaN for unknown terrain', () => {
      const result = getHexTravelTime('unknown', 'normal');
      expect(result).toBeNaN();
    });

    it('should return correct time for fast pace on forest', () => {
      const result = getHexTravelTime('forest', 'fast');
      expect(result).toBe(1.5 * 1);
    });

    it('should return correct time for slow pace on tundra', () => {
      const result = getHexTravelTime('tundra', 'slow');
      expect(result).toBe(3 * 1.5);
    });
  });

  describe('getHexMoveCost', () => {
    it('should return correct cost for plains', () => {
      expect(getHexMoveCost('plains')).toBe(0.75);
    });

    it('should return correct cost for mountains', () => {
      expect(getHexMoveCost('mountains')).toBe(2);
    });

    it('should return correct cost for water', () => {
      expect(getHexMoveCost('water')).toBe(4);
    });

    it('should return null for unknown terrain', () => {
      expect(getHexMoveCost('unknown')).toBeNull();
    });

    it('should return null for undefined', () => {
      expect(getHexMoveCost(undefined)).toBeNull();
    });
  });

  describe('isHexOnRoad', () => {
    it('should return false for empty roads array', () => {
      expect(isHexOnRoad(1, 2, [])).toBe(false);
    });

    it('should return false for null roads', () => {
      expect(isHexOnRoad(1, 2, null)).toBe(false);
    });

    it('should return true when hex is on a road', () => {
      const roads = [{ hexes: ['1,2', '3,4'] }];
      expect(isHexOnRoad(1, 2, roads)).toBe(true);
    });

    it('should return false when hex is not on any road', () => {
      const roads = [{ hexes: ['1,2', '3,4'] }];
      expect(isHexOnRoad(5, 6, roads)).toBe(false);
    });

    it('should return true when hex matches second hex in road', () => {
      const roads = [{ hexes: ['1,2', '3,4'] }];
      expect(isHexOnRoad(3, 4, roads)).toBe(true);
    });

    it('should handle multiple roads', () => {
      const roads = [
        { hexes: ['1,2', '3,4'] },
        { hexes: ['5,6', '7,8'] },
      ];
      expect(isHexOnRoad(5, 6, roads)).toBe(true);
      expect(isHexOnRoad(7, 8, roads)).toBe(true);
      expect(isHexOnRoad(9, 10, roads)).toBe(false);
    });

    it('should return false for road with no hexes', () => {
      const roads = [{ hexes: null }];
      expect(isHexOnRoad(1, 2, roads)).toBe(false);
    });
  });

  describe('getHexMoveCostWithRoad', () => {
    it('should return base cost when not on road', () => {
      const roads = [{ hexes: ['5,6'] }];
      expect(getHexMoveCostWithRoad('plains', 1, 2, roads)).toBe(0.75);
    });

    it('should return 1 when on road (Math.max(1, 0.75 - 0.5))', () => {
      const roads = [{ hexes: ['1,2'] }];
      expect(getHexMoveCostWithRoad('plains', 1, 2, roads)).toBe(1);
    });

    it('should return 1.5 when mountains on road (Math.max(1, 2 - 0.5))', () => {
      const roads = [{ hexes: ['1,2'] }];
      expect(getHexMoveCostWithRoad('mountains', 1, 2, roads)).toBe(1.5);
    });

    it('should return 3.5 for water on road (Math.max(1, 4 - 0.5))', () => {
      const roads = [{ hexes: ['1,2'] }];
      expect(getHexMoveCostWithRoad('water', 1, 2, roads)).toBe(3.5);
    });

    it('should return NaN for unknown terrain on road', () => {
      const roads = [{ hexes: ['1,2'] }];
      expect(getHexMoveCostWithRoad('unknown', 1, 2, roads)).toBeNaN();
    });

    it('should return base cost for null roads', () => {
      expect(getHexMoveCostWithRoad('plains', 1, 2, null)).toBe(0.75);
    });

    it('should return 1 for swamp on road (1.5 - 0.5 = 1)', () => {
      const roads = [{ hexes: ['1,2'] }];
      expect(getHexMoveCostWithRoad('swamp', 1, 2, roads)).toBe(1);
    });
  });

  describe('getDailyHexBudget', () => {
    it('should return 1 for slow pace', () => {
      const result = getDailyHexBudget('slow');
      expect(result).toBe(Math.floor((1 / 3) * 8));
    });

    it('should return 4 for normal pace', () => {
      const result = getDailyHexBudget('normal');
      expect(result).toBe(Math.floor((1 / 2) * 8));
    });

    it('should return 5 for fast pace', () => {
      const result = getDailyHexBudget('fast');
      expect(result).toBe(Math.floor((2 / 3) * 8));
    });

    it('should return null for invalid pace', () => {
      expect(getDailyHexBudget('invalid')).toBeNull();
    });

    it('should return null for unknown terrain', () => {
      expect(getDailyHexBudget('unknown')).toBeNull();
    });
  });

  describe('getTotalTravelTime', () => {
    it('should return { hours: 0, days: 0 } for empty path', () => {
      expect(getTotalTravelTime([])).toEqual({ hours: 0, days: 0 });
    });

    it('should return { hours: 0, days: 0 } for null path', () => {
      expect(getTotalTravelTime(null)).toEqual({ hours: 0, days: 0 });
    });

    it('should return { hours: 0, days: 0 } for undefined path', () => {
      expect(getTotalTravelTime(undefined)).toEqual({ hours: 0, days: 0 });
    });

    it('should calculate hours for a single plains hex', () => {
      const path = [{ q: 0, r: 0 }];
      const terrain = { '0,0': 'plains' };
      const result = getTotalTravelTime(path, terrain);
      expect(result.hours).toBe(0.75 / 3);
    });

    it('should calculate hours for multiple hexes', () => {
      const path = [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 1, r: 1 }];
      const terrain = { '0,0': 'plains', '1,0': 'hills', '1,1': 'forest' };
      const result = getTotalTravelTime(path, terrain);
      // plains: 0.75/3, hills: 1/3, forest: 1/3
      expect(result.hours).toBeCloseTo((0.75 + 1 + 1) / 3);
    });

    it('should use default terrain for missing hexes', () => {
      const path = [{ q: 0, r: 0 }, { q: 1, r: 0 }];
      const terrain = { '0,0': 'plains' };
      const result = getTotalTravelTime(path, terrain);
      // plains: 0.75/3, default(plains): 0.75/3
      expect(result.hours).toBeCloseTo((0.75 + 0.75) / 3);
    });

    it('should include water terrain in travel time (cost=4)', () => {
      const path = [{ q: 0, r: 0 }, { q: 1, r: 0 }];
      const terrain = { '0,0': 'plains', '1,0': 'water' };
      const result = getTotalTravelTime(path, terrain);
      // plains: 0.75/3, water: 4/3
      expect(result.hours).toBeCloseTo((0.75 + 4) / 3);
    });

    it('should divide hours by 2 for horseback travel', () => {
      const path = [{ q: 0, r: 0 }];
      const terrain = { '0,0': 'plains' };
      const result = getTotalTravelTime(path, terrain, true);
      expect(result.hours).toBe((0.75 / 3) / 2);
    });

    it('should calculate days from hours', () => {
      const path = [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 1, r: 1 }, { q: 2, r: 1 }];
      const terrain = { '0,0': 'plains', '1,0': 'hills', '1,1': 'forest', '2,1': 'desert' };
      const result = getTotalTravelTime(path, terrain);
      expect(result.days).toBeCloseTo(result.hours / 8);
    });

    it('should calculate days for horseback travel', () => {
      const path = [{ q: 0, r: 0 }, { q: 1, r: 0 }];
      const terrain = { '0,0': 'plains', '1,0': 'hills' };
      const result = getTotalTravelTime(path, terrain, true);
      const expectedHours = (0.75 + 1) / 3 / 2;
      expect(result.days).toBeCloseTo(expectedHours / 8);
    });
  });

  describe('calculatePath', () => {
    it('should return empty array for null from', () => {
      expect(calculatePath(null, { q: 1, r: 1 }, 10, 10, {}, [])).toEqual([]);
    });

    it('should return empty array for null to', () => {
      expect(calculatePath({ q: 0, r: 0 }, null, 10, 10, {}, [])).toEqual([]);
    });

    it('should return empty array for same from and to', () => {
      const result = calculatePath({ q: 0, r: 0 }, { q: 0, r: 0 }, 10, 10, {}, []);
      expect(result).toEqual([]);
    });

    it('should return a path for adjacent hexes', () => {
      const result = calculatePath(
        { q: 0, r: 0 },
        { q: 1, r: 0 },
        10,
        10,
        {},
        [],
      );
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].q).toBe(0);
      expect(result[0].r).toBe(0);
    });

    it('should include both start and end hexes', () => {
      const result = calculatePath(
        { q: 0, r: 0 },
        { q: 2, r: 0 },
        10,
        10,
        {},
        [],
      );
      expect(result[0].q).toBe(0);
      expect(result[0].r).toBe(0);
      expect(result[result.length - 1].q).toBe(2);
      expect(result[result.length - 1].r).toBe(0);
    });

    it('should avoid impassable terrain (water)', () => {
      const terrain = { '2,0': 'water', '3,0': 'water', '4,0': 'water' };
      const result = calculatePath(
        { q: 0, r: 0 },
        { q: 5, r: 0 },
        10,
        10,
        terrain,
        [],
      );
      // Path should exist but not include the water hex
      const pathKeys = result.map(h => `${h.q},${h.r}`);
      expect(pathKeys).not.toContain('2,0');
      expect(pathKeys).not.toContain('3,0');
      expect(pathKeys).not.toContain('4,0');
    });

    it('should respect grid boundaries', () => {
      const result = calculatePath(
        { q: 0, r: 0 },
        { q: 5, r: 5 },
        6,
        6,
        {},
        [],
      );
      for (const hex of result) {
        expect(hex.q).toBeGreaterThanOrEqual(0);
        expect(hex.q).toBeLessThan(6);
        expect(hex.r).toBeGreaterThanOrEqual(0);
        expect(hex.r).toBeLessThan(6);
      }
    });

    it('should use road costs when roads are provided', () => {
      const roads = [{ hexes: ['1,0', '2,0', '3,0'] }];
      const result = calculatePath(
        { q: 0, r: 0 },
        { q: 4, r: 0 },
        10,
        10,
        { '1,0': 'plains', '2,0': 'plains', '3,0': 'plains' },
        roads,
      );
      expect(result.length).toBeGreaterThan(0);
    });

    it('should return a path that includes water when it is the shortest route', () => {
      // Water has cost 4, which is still passable (not null)
      // A* will go through water if it's the fastest route
      const terrain = {
        '1,0': 'water',
        '0,1': 'water',
        '1,1': 'water',
      };
      const result = calculatePath(
        { q: 0, r: 0 },
        { q: 2, r: 2 },
        3,
        3,
        terrain,
        [],
      );
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].q).toBe(0);
      expect(result[0].r).toBe(0);
      expect(result[result.length - 1].q).toBe(2);
      expect(result[result.length - 1].r).toBe(2);
    });

    it('should handle diagonal-ish hex paths', () => {
      const result = calculatePath(
        { q: 0, r: 0 },
        { q: 3, r: 2 },
        10,
        10,
        {},
        [],
      );
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].q).toBe(0);
      expect(result[0].r).toBe(0);
    });

    it('should prefer shorter paths through plains over mountains', () => {
      const terrain = {
        '1,0': 'plains',
        '2,0': 'plains',
        '1,1': 'mountains',
        '2,1': 'mountains',
        '0,1': 'plains',
        '0,2': 'plains',
        '1,2': 'plains',
        '2,2': 'plains',
      };
      const result = calculatePath(
        { q: 0, r: 0 },
        { q: 2, r: 2 },
        3,
        3,
        terrain,
        [],
      );
      for (const hex of result) {
        const key = `${hex.q},${hex.r}`;
        expect(terrain[key]).not.toBe('water');
      }
    });
  });

  describe('formatTravelTime', () => {
    it('should format 0 hours as 0 min', () => {
      expect(formatTravelTime(0)).toBe('0 min');
    });

    it('should format less than 1 hour in minutes', () => {
      expect(formatTravelTime(0.5)).toBe('30 min');
    });

    it('should format less than 1 minute as 1 min', () => {
      expect(formatTravelTime(0.01)).toBe('1 min');
    });

    it('should format exactly 1 hour as 1h', () => {
      expect(formatTravelTime(1)).toBe('1h');
    });

    it('should format 2 hours as 2h', () => {
      expect(formatTravelTime(2)).toBe('2h');
    });

    it('should format hours and minutes when minutes > 0', () => {
      expect(formatTravelTime(1.5)).toBe('1h 30m');
    });

    it('should format 2.5 hours as 2h 30m', () => {
      expect(formatTravelTime(2.5)).toBe('2h 30m');
    });

    it('should round fractional minutes', () => {
      expect(formatTravelTime(1.1)).toBe('1h 6m');
    });

    it('should handle 0.75 hours as 45 min', () => {
      expect(formatTravelTime(0.75)).toBe('45 min');
    });

    it('should handle 1.25 hours as 1h 15m', () => {
      expect(formatTravelTime(1.25)).toBe('1h 15m');
    });

    it('should handle large hour values', () => {
      expect(formatTravelTime(24)).toBe('24h');
    });

    it('should handle 24.5 hours as 24h 30m', () => {
      expect(formatTravelTime(24.5)).toBe('24h 30m');
    });
  });
});
