// @maintained-by-ai
import { describe, it, expect } from 'vitest';
import {
  TERRAIN_MOVE_COST,
  TRAVEL_PACES,
  MAX_TRAVEL_HOURS_PER_DAY,
  HORSEBACK_SPEED_MULTIPLIER,
  EXHAUSTION_SPEED_MULTIPLIER,
  EXHAUSTION_LEVELS,
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
    it('should export TERRAIN_MOVE_COST with RAW-ish per-terrain move costs', () => {
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

    it('should pin the movement scalars used across the travel domain', () => {
      expect(MAX_TRAVEL_HOURS_PER_DAY).toBe(8);
      expect(HORSEBACK_SPEED_MULTIPLIER).toBe(2);
      // #1008 revisited fix#363: KEPT — this is the sole REAL-bytes pin of
      // travelService.EXHAUSTION_LEVELS. useTravelManagement.js:246/:257 consume it
      // but its lane mocks the constant (:19); exhaustionRules.test.js:40 pins the
      // DISTINCT exhaustionRules.js:1 definition. Import-surface pin IS needed.
      expect(EXHAUSTION_LEVELS).toBe(6);
      // 5/6 speed per exhaustion stack (homebrew: forced-march hours stack as levels
      // in useTravelManagement, each costing 1/6 of remaining budget/speed)
      expect(EXHAUSTION_SPEED_MULTIPLIER).toBeCloseTo(5 / 6, 10);
    });

    it('should define slow/normal/fast paces with full perception and encounter modifiers', () => {
      expect(TRAVEL_PACES).toHaveLength(3);
      const byId = Object.fromEntries(TRAVEL_PACES.map(p => [p.id, p]));
      expect(byId).toMatchObject({
        slow: { hexesPerHour: 1 / 3, hoursPerHex: 3, perception: 5, stealthAdvantage: true, encounterMod: -2 },
        normal: { hexesPerHour: 1 / 2, hoursPerHex: 2, perception: 0, stealthAdvantage: false, encounterMod: 0 },
        fast: { hexesPerHour: 2 / 3, hoursPerHex: 1.5, perception: -5, stealthAdvantage: false, encounterMod: 2 },
      });
    });

    it('should keep each pace internally consistent (hexesPerHour is the inverse of hoursPerHex)', () => {
      for (const pace of TRAVEL_PACES) {
        expect(1 / pace.hexesPerHour).toBeCloseTo(pace.hoursPerHex, 10);
      }
    });
  });

  describe('applyExhaustionSpeedPenalty', () => {
    it('should return base cost for non-positive exhaustion or zero base', () => {
      expect(applyExhaustionSpeedPenalty(10, 0)).toBe(10);
      expect(applyExhaustionSpeedPenalty(10, -1)).toBe(10);
      expect(applyExhaustionSpeedPenalty(0, 5)).toBe(0);
    });

    it('should inflate cost by (6/5)^stacks as exhaustion grows', () => {
      // 10 / (5/6) = 12 exactly; 10 / (5/6)^3 = 10 * 1.728 = 17.28
      expect(applyExhaustionSpeedPenalty(10, 1)).toBe(12);
      expect(applyExhaustionSpeedPenalty(10, 3)).toBeCloseTo(17.28, 6);
    });
  });

  describe('applyExhaustionSpeedPenaltyToBudget', () => {
    it('should return base budget for non-positive exhaustion or zero base', () => {
      expect(applyExhaustionSpeedPenaltyToBudget(10, 0)).toBe(10);
      expect(applyExhaustionSpeedPenaltyToBudget(10, -1)).toBe(10);
      expect(applyExhaustionSpeedPenaltyToBudget(0, 5)).toBe(0);
    });

    it('should shrink budget per stack with floor (12 hexes: 10, 8, 6 at 1-3 stacks)', () => {
      expect(applyExhaustionSpeedPenaltyToBudget(12, 1)).toBe(10); // floor(10.0)
      expect(applyExhaustionSpeedPenaltyToBudget(12, 2)).toBe(8);  // floor(8.33)
      expect(applyExhaustionSpeedPenaltyToBudget(12, 3)).toBe(6);  // floor(6.94)
    });
  });

  describe('getExhaustionMultiplierPercent', () => {
    it('should return 100 at 0 stacks and rounded-down-ish percentages for higher stacks', () => {
      expect(getExhaustionMultiplierPercent(0)).toBe(100);
      expect(getExhaustionMultiplierPercent(1)).toBe(83); // round(83.33)
      expect(getExhaustionMultiplierPercent(2)).toBe(69); // round(69.44)
      expect(getExhaustionMultiplierPercent(6)).toBe(33); // round(33.49)
    });
  });

  describe('getHexTravelTime', () => {
    it('should return null for invalid pace and NaN for unknown terrain (source quirk: guards on === null, lookup yields undefined)', () => {
      expect(getHexTravelTime('plains', 'invalid')).toBeNull();
      expect(Number.isNaN(getHexTravelTime('unknown', 'normal'))).toBe(true);
    });

    it('should compute pace hoursPerHex x terrain cost and halve for horseback', () => {
      expect(getHexTravelTime('plains', 'normal')).toBe(1.5);   // 2 x 0.75
      expect(getHexTravelTime('mountains', 'slow')).toBe(6);     // 3 x 2
      expect(getHexTravelTime('forest', 'fast')).toBe(1.5);      // 1.5 x 1
      expect(getHexTravelTime('plains', 'normal', true)).toBe(0.75); // 1.5 / 2
      expect(getHexTravelTime('mountains', 'fast', true)).toBe(1.5); // 1.5 x 2 / 2
    });
  });

  describe('getHexMoveCost', () => {
    it('should return null for unknown or undefined terrain', () => {
      expect(getHexMoveCost('unknown')).toBeNull();
      expect(getHexMoveCost(undefined)).toBeNull();
    });

    it('should return the registry cost for known terrains', () => {
      expect(getHexMoveCost('plains')).toBe(0.75);
      expect(getHexMoveCost('mountains')).toBe(2);
      expect(getHexMoveCost('water')).toBe(4);
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

    it('should tolerate road entries without a hexes array', () => {
      expect(isHexOnRoad(1, 2, [{}, { hexes: ['1,2'] }])).toBe(true);
      expect(isHexOnRoad(1, 2, [{}])).toBe(false);
    });
  });

  describe('getHexMoveCostWithRoad', () => {
    it('should return base cost when not on road or roads is null', () => {
      expect(getHexMoveCostWithRoad('plains', 1, 2, [{ hexes: ['5,6'] }])).toBe(0.75);
      expect(getHexMoveCostWithRoad('plains', 1, 2, null)).toBe(0.75);
    });

    it('should cut road cost by 0.5 but never below the floor of 1', () => {
      const roads = [{ hexes: ['1,2'] }];
      // quirk: floor of 1 makes roads on cheap terrain (plains 0.75) SLOWER off-road
      expect(getHexMoveCostWithRoad('plains', 1, 2, roads)).toBe(1);   // floor lift from 0.25
      expect(getHexMoveCostWithRoad('hills', 1, 2, roads)).toBe(1);    // floor lift from 0.5
      expect(getHexMoveCostWithRoad('swamp', 1, 2, roads)).toBe(1);    // 1.5 - 0.5
      expect(getHexMoveCostWithRoad('mountains', 1, 2, roads)).toBe(1.5); // 2 - 0.5
    });

    it('should return NaN for unknown terrain even on road (guards on === null)', () => {
      const roads = [{ hexes: ['1,2'] }];
      expect(Number.isNaN(getHexMoveCostWithRoad('unknown', 1, 2, roads))).toBe(true);
    });
  });

  describe('getDailyHexBudget', () => {
    it('should return the correct hex budget for each pace and null for invalid', () => {
      // floor(hexesPerHour x 8h): slow floor(2.67)=2, normal floor(4)=4, fast floor(5.33)=5
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

    it('should sum cost/3 hours per hex and derive days at 8 travel-hours', () => {
      const path = [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 1, r: 1 }];
      const terrain = { '0,0': 'plains', '1,0': 'hills', '1,1': 'forest' };
      const result = getTotalTravelTime(path, terrain);
      // NOTE: this is the service's own rate (cost units / 3 hours), which does NOT
      // agree with getHexTravelTime at 'normal' pace (hoursPerHex 2 x cost) — flagged upstream.
      expect(result.hours).toBeCloseTo(2.75 / 3, 6); // 0.75 + 1 + 1 cost units
      expect(result.days).toBeCloseTo(2.75 / 3 / 8, 6);
    });

    it('should halve hours for horseback', () => {
      const path = [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 1, r: 1 }];
      const terrain = { '0,0': 'plains', '1,0': 'hills', '1,1': 'forest' };
      const result = getTotalTravelTime(path, terrain, true);
      expect(result.hours).toBeCloseTo(2.75 / 3 / 2, 6);
      expect(result.days).toBeCloseTo(2.75 / 3 / 2 / 8, 6);
    });

    it('should fall back to DEFAULT_TERRAIN (plains, cost 0.75) for hexes missing from the terrain map', () => {
      const result = getTotalTravelTime([{ q: 9, r: 9 }], {});
      expect(result.hours).toBe(0.25); // 0.75 / 3
      expect(result.days).toBe(0.03125);
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
      expect(result[0]).toEqual({ q: 0, r: 0 });
      expect(result[result.length - 1]).toEqual({ q: 4, r: 0 });
    });

    it('should respect grid boundaries', () => {
      const result = calculatePath({ q: 0, r: 0 }, { q: 3, r: 3 }, { hexCols: 5, hexRows: 5, terrain: {}, roads: [] });
      for (const hex of result) {
        expect(hex.q).toBeGreaterThanOrEqual(0);
        expect(hex.q).toBeLessThan(5);
        expect(hex.r).toBeGreaterThanOrEqual(0);
        expect(hex.r).toBeLessThan(5);
      }
    });

    it('should route straight along cheap plains road when it is the shortest lane', () => {
      // Road cost on plains floors to 1 (vs 0.75 off-road), but any detour costs
      // more in total steps + cost, so the straight road lane wins deterministically.
      const roads = [{ hexes: ['1,0', '2,0', '3,0'] }];
      const terrain = { '1,0': 'plains', '2,0': 'plains', '3,0': 'plains' };
      const result = calculatePath({ q: 0, r: 0 }, { q: 4, r: 0 }, { hexCols: 10, hexRows: 10, terrain, roads });
      expect(result).toEqual([
        { q: 0, r: 0 },
        { q: 1, r: 0 },
        { q: 2, r: 0 },
        { q: 3, r: 0 },
        { q: 4, r: 0 },
      ]);
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
