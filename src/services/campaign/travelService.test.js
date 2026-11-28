// @maintained-by-ai 2026-11-27
import { describe, it, expect } from 'vitest';
import {
  TERRAIN_MOVE_COST,
  TRAVEL_PACES,
  MAX_TRAVEL_HOURS_PER_DAY,
  HORSEBACK_SPEED_MULTIPLIER,
  EXHAUSTION_SPEED_MULTIPLIER,
  EXHAUSTION_LEVELS,
  applyExhaustionSpeedPenaltyToBudget,
  getExhaustionMultiplierPercent,
  getHexTravelTime,
  getHexMoveCostWithRoad,
  getDailyHexBudget,
  calculatePath,
  formatTravelTime,
} from './travelService.js';

// Pure overland-travel math lane: no fetch, no runtime store, NO TIMERS —
// travelService computes nothing on wall-clock time (turn-based mandate).
// The useTravelManagement lanes fully MOCK this module, so real-pace/budget
// bytes are pinned here (TravelPanel.pace-tooltips and useMapLoader.travelState
// add integration pins only). Weather tables and per-map weather generation
// belong to weatherService.test.js, never here.
//
// DEAD-EXPORT AUDIT (2026-11-27 sweep): getTotalTravelTime and getHexMoveCost
// have ZERO callers repo-wide (source and tests) — unpinned here, deletion
// recommended. isHexOnRoad is exported but only consumed internally by
// getHexMoveCostWithRoad — its behavior is pinned THROUGH that consumer below
// (de-export recommended). getTotalTravelTime additionally carried the flagged
// RATE-CONTRADIATION (cost/3 vs getHexTravelTime's hoursPerHex 2 x cost,
// ledger #2011) — a second reason not to enshrine it with pins.

describe('travelService', () => {
  describe('constants', () => {
    it('should pin the full terrain move-cost table', () => {
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
      // KEPT — sole REAL-bytes pin of travelService.EXHAUSTION_LEVELS.
      // useTravelManagement.js:598/:609 consume it but that lane's tests mock
      // the constant (useTravelManagement.test.js:23); exhaustionRules.test.js:40
      // pins the DISTINCT exhaustionRules.js:1 definition. Import-surface pin IS needed.
      expect(EXHAUSTION_LEVELS).toBe(6);
      // 5/6 speed per exhaustion stack (homebrew: forced-march hours stack as
      // levels in useTravelManagement, each costing 1/6 of remaining budget)
      expect(EXHAUSTION_SPEED_MULTIPLIER).toBe(5 / 6);
    });

    // bug-travel-pace-odds-fields-inert: full-shape census — exact row keys,
    // order and values. Any re-added inert modifier field (perception/
    // stealthAdvantage/encounterMod) or pace-order swap fails this pin.
    it('should define slow/normal/fast paces as exact time/budget rows', () => {
      expect(TRAVEL_PACES).toEqual([
        {
          id: 'slow',
          name: 'Slow',
          hexesPerHour: 1 / 3,
          hoursPerHex: 3,
          description: 'Cautious movement — slowest travel, smallest daily hex budget',
        },
        {
          id: 'normal',
          name: 'Normal',
          hexesPerHour: 1 / 2,
          hoursPerHex: 2,
          description: 'Standard adventuring pace',
        },
        {
          id: 'fast',
          name: 'Fast',
          hexesPerHour: 2 / 3,
          hoursPerHex: 1.5,
          description: 'Rapid travel — fastest movement, largest daily hex budget',
        },
      ]);
    });
  });

  describe('applyExhaustionSpeedPenaltyToBudget', () => {
    it('should pass the base through at 0 stacks and shrink with floor per stack', () => {
      expect(applyExhaustionSpeedPenaltyToBudget(10, 0)).toBe(10);
      // -1 hits the same `<= 0` guard as 0 (one branch, not restated further)
      expect(applyExhaustionSpeedPenaltyToBudget(10, -1)).toBe(10);
      expect(applyExhaustionSpeedPenaltyToBudget(12, 1)).toBe(10); // floor(10.0)
      expect(applyExhaustionSpeedPenaltyToBudget(12, 2)).toBe(8);  // floor(8.33)
      expect(applyExhaustionSpeedPenaltyToBudget(12, 3)).toBe(6);  // floor(6.94)
    });
  });

  describe('getExhaustionMultiplierPercent', () => {
    it('should return 100 at 0 stacks and rounded percentages up to the max level', () => {
      expect(getExhaustionMultiplierPercent(0)).toBe(100);
      expect(getExhaustionMultiplierPercent(1)).toBe(83); // round(83.33)
      expect(getExhaustionMultiplierPercent(2)).toBe(69); // round(69.44)
      expect(getExhaustionMultiplierPercent(6)).toBe(33); // round(33.49), 6 = EXHAUSTION_LEVELS
    });
  });

  describe('getHexTravelTime', () => {
    it('should return null for invalid pace and NaN for unknown terrain (source quirk: guard is `=== null` but the lookup yields undefined)', () => {
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

  describe('getHexMoveCostWithRoad', () => {
    // isHexOnRoad is exported-but-internal-only; its branches are exercised
    // here through this consumer: road hit, road miss, null roads, and a
    // road entry missing its `hexes` array (`road.hexes &&` short-circuit).
    it('should return the base cost off-road, with null roads, and when a road entry lacks hexes', () => {
      expect(getHexMoveCostWithRoad('plains', 1, 2, [{ hexes: ['5,6'] }])).toBe(0.75);
      expect(getHexMoveCostWithRoad('plains', 1, 2, null)).toBe(0.75);
      expect(getHexMoveCostWithRoad('plains', 1, 2, [{}, { hexes: ['5,6'] }])).toBe(0.75);
      // unknown terrain: same `=== null` guard quirk as getHexTravelTime
      expect(Number.isNaN(getHexMoveCostWithRoad('unknown', 1, 2, [{ hexes: ['1,2'] }]))).toBe(true);
    });

    it('should cut on-road cost by 0.5 but never below the floor of 1', () => {
      const roads = [{ hexes: ['1,2'] }];
      // quirk: floor of 1 makes roads on cheap terrain (plains 0.75) SLOWER off-road
      expect(getHexMoveCostWithRoad('plains', 1, 2, roads)).toBe(1);   // floor lift from 0.25
      expect(getHexMoveCostWithRoad('hills', 1, 2, roads)).toBe(1);    // floor lift from 0.5
      expect(getHexMoveCostWithRoad('swamp', 1, 2, roads)).toBe(1);    // 1.5 - 0.5
      expect(getHexMoveCostWithRoad('mountains', 1, 2, roads)).toBe(1.5); // 2 - 0.5
    });
  });

  describe('getDailyHexBudget', () => {
    it('should floor hexesPerHour x 8h per pace and return null for invalid', () => {
      // slow floor(2.67)=2, normal floor(4)=4, fast floor(5.33)=5
      expect(getDailyHexBudget('slow')).toBe(2);
      expect(getDailyHexBudget('normal')).toBe(4);
      expect(getDailyHexBudget('fast')).toBe(5);
      expect(getDailyHexBudget('invalid')).toBeNull();
    });
  });

  describe('calculatePath', () => {
    it('should return empty array for null inputs or same start/end', () => {
      const grid = { hexCols: 10, hexRows: 10, terrain: {}, roads: [] };
      expect(calculatePath(null, { q: 1, r: 1 }, grid)).toEqual([]);
      expect(calculatePath({ q: 0, r: 0 }, null, grid)).toEqual([]);
      expect(calculatePath({ q: 0, r: 0 }, { q: 0, r: 0 }, grid)).toEqual([]);
    });

    it('should return the unique two-step path including start and end hexes', () => {
      // On default-plains the only 2-step route (0,0)->(2,0) passes through
      // (1,0); every 3-step detour costs more, so the full array is pinned.
      const result = calculatePath({ q: 0, r: 0 }, { q: 2, r: 0 }, { hexCols: 10, hexRows: 10, terrain: {}, roads: [] });
      expect(result).toEqual([{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }]);
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
      expect(result.filter(h => terrain[`${h.q},${h.r}`] === 'mountains')).toEqual([]);
      expect(result[0]).toEqual({ q: 0, r: 0 });
      expect(result[result.length - 1]).toEqual({ q: 4, r: 0 });
    });

    it('should never route off-grid even when out-of-bounds hexes would be cheaper', () => {
      // Single-row grid with mountains at (1,0): the in-range route must pay
      // the mountain (2 + 0.75 = 2.75). Dropping the bounds check would let
      // the diagonal (1,-1)/(diagonal) plains lane win at 1.5, so this pin
      // fails if isHexInBounds is removed.
      const result = calculatePath({ q: 0, r: 0 }, { q: 2, r: 0 }, { hexCols: 5, hexRows: 1, terrain: { '1,0': 'mountains' }, roads: [] });
      expect(result).toEqual([{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }]);
    });

    it('should route straight along cheap plains road when it is the shortest lane', () => {
      // Road cost on plains floors to 1 (vs 0.75 off-road), but any detour
      // costs more, so the straight road lane wins deterministically.
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
      expect(formatTravelTime(1)).toBe('1h');        // >= 1h boundary, m === 0
      expect(formatTravelTime(1.5)).toBe('1h 30m');
      expect(formatTravelTime(2.5)).toBe('2h 30m');
      expect(formatTravelTime(24.5)).toBe('24h 30m');
      expect(formatTravelTime(48)).toBe('48h');
    });
  });
});
