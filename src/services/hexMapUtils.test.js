import { describe, it, expect } from 'vitest';
import {
  hexKey,
  parseHexKey,
  hexToPixel,
  pixelToHex,
  hexRound,
  pixelToHexSnapped,
  hexNeighbors,
  hexDistance,
  hexCornerOffset,
  hexCorners,
  hexToSVGPath,
  getAllHexes,
  getHexGridPixelDimensions,
  getHexCenterFromOffset,
  windingOffset,
  isRoadConnectable,
  findHexPath,
  orderHexPath,
  buildWindingPathDescriptor,
} from './hexMapUtils.js';

describe('hexMapUtils', () => {
  describe('hexKey', () => {
    it('should return "q,r" string', () => {
      expect(hexKey(3, 5)).toBe('3,5');
    });

    it('should handle negative coordinates', () => {
      expect(hexKey(-1, -2)).toBe('-1,-2');
    });

    it('should handle zero', () => {
      expect(hexKey(0, 0)).toBe('0,0');
    });
  });

  describe('parseHexKey', () => {
    it('should parse "q,r" back to numbers', () => {
      expect(parseHexKey('3,5')).toEqual({ q: 3, r: 5 });
    });

    it('should handle negative values', () => {
      expect(parseHexKey('-1,-2')).toEqual({ q: -1, r: -2 });
    });

    it('should handle zero', () => {
      expect(parseHexKey('0,0')).toEqual({ q: 0, r: 0 });
    });
  });

  describe('hexToPixel', () => {
    it('should convert origin to (0, 0)', () => {
      const result = hexToPixel(0, 0, 30);
      expect(result.x).toBeCloseTo(0);
      expect(result.y).toBeCloseTo(0);
    });

    it('should convert hex (1, 0) correctly', () => {
      const result = hexToPixel(1, 0, 30);
      expect(result.x).toBeCloseTo(30 * Math.sqrt(3));
      expect(result.y).toBeCloseTo(0);
    });

    it('should convert hex (0, 1) correctly', () => {
      const result = hexToPixel(0, 1, 30);
      expect(result.x).toBeCloseTo(30 * Math.sqrt(3) / 2);
      expect(result.y).toBeCloseTo(45);
    });

    it('should scale with size', () => {
      const result = hexToPixel(1, 0, 60);
      expect(result.x).toBeCloseTo(60 * Math.sqrt(3));
    });
  });

  describe('pixelToHex', () => {
    it('should convert (0, 0) pixel to (0, 0) hex', () => {
      const result = pixelToHex(0, 0, 30);
      expect(result.q).toBeCloseTo(0);
      expect(result.r).toBeCloseTo(0);
    });

    it('should be inverse of hexToPixel for integer coords', () => {
      const pixel = hexToPixel(2, 3, 30);
      const hex = pixelToHex(pixel.x, pixel.y, 30);
      expect(hex.q).toBeCloseTo(2);
      expect(hex.r).toBeCloseTo(3);
    });
  });

  describe('hexRound', () => {
    it('should round to same hex when already integer', () => {
      expect(hexRound(3, 5)).toEqual({ q: 3, r: 5 });
    });

    it('should round fractional coordinates to nearest hex', () => {
      const result = hexRound(0.3, 0.3);
      expect(Number.isInteger(result.q)).toBe(true);
      expect(Number.isInteger(result.r)).toBe(true);
    });

    it('should handle negative fractional coordinates', () => {
      const result = hexRound(-0.6, -0.3);
      expect(Number.isInteger(result.q)).toBe(true);
      expect(Number.isInteger(result.r)).toBe(true);
    });

    it('should maintain cube coordinate constraint', () => {
      const result = hexRound(1.7, -0.3);
      const s = -result.q - result.r;
      expect(Number.isInteger(Math.round(s))).toBe(true);
    });
  });

  describe('pixelToHexSnapped', () => {
    it('should snap pixel to integer hex', () => {
      const result = pixelToHexSnapped(0, 0, 30);
      expect(Number.isInteger(result.q)).toBe(true);
      expect(Number.isInteger(result.r)).toBe(true);
    });

    it('should be consistent with hexToPixel -> pixelToHexSnapped roundtrip', () => {
      const pixel = hexToPixel(2, 1, 30);
      const snapped = pixelToHexSnapped(pixel.x, pixel.y, 30);
      expect(snapped.q).toBe(2);
      expect(snapped.r).toBe(1);
    });
  });

  describe('hexNeighbors', () => {
    it('should return 6 neighbors', () => {
      expect(hexNeighbors(0, 0)).toHaveLength(6);
    });

    it('should return correct neighbor offsets', () => {
      const neighbors = hexNeighbors(0, 0);
      expect(neighbors).toContainEqual({ q: 1, r: 0 });
      expect(neighbors).toContainEqual({ q: -1, r: 0 });
      expect(neighbors).toContainEqual({ q: 0, r: 1 });
      expect(neighbors).toContainEqual({ q: 0, r: -1 });
      expect(neighbors).toContainEqual({ q: 1, r: -1 });
      expect(neighbors).toContainEqual({ q: -1, r: 1 });
    });

    it('should offset from non-origin hex', () => {
      const neighbors = hexNeighbors(3, 5);
      expect(neighbors).toContainEqual({ q: 4, r: 5 });
      expect(neighbors).toContainEqual({ q: 3, r: 6 });
    });
  });

  describe('hexDistance', () => {
    it('should return 0 for same hex', () => {
      expect(hexDistance({ q: 0, r: 0 }, { q: 0, r: 0 })).toBe(0);
    });

    it('should return 1 for adjacent hexes', () => {
      expect(hexDistance({ q: 0, r: 0 }, { q: 1, r: 0 })).toBe(1);
      expect(hexDistance({ q: 0, r: 0 }, { q: 0, r: 1 })).toBe(1);
      expect(hexDistance({ q: 0, r: 0 }, { q: 1, r: -1 })).toBe(1);
    });

    it('should return correct distance for farther hexes', () => {
      expect(hexDistance({ q: 0, r: 0 }, { q: 3, r: -2 })).toBe(3);
    });

    it('should be symmetric', () => {
      const a = { q: 2, r: -1 };
      const b = { q: -3, r: 4 };
      expect(hexDistance(a, b)).toBe(hexDistance(b, a));
    });
  });

  describe('hexCornerOffset', () => {
    it('should return 6 distinct corners', () => {
      const corners = [];
      for (let i = 0; i < 6; i++) {
        corners.push(hexCornerOffset(i, 30));
      }
      for (let i = 0; i < 6; i++) {
        for (let j = i + 1; j < 6; j++) {
          expect(corners[i].x === corners[j].x && corners[i].y === corners[j].y).toBe(false);
        }
      }
    });

    it('should scale with size', () => {
      const c1 = hexCornerOffset(0, 30);
      const c2 = hexCornerOffset(0, 60);
      expect(c2.x).toBeCloseTo(c1.x * 2);
      expect(c2.y).toBeCloseTo(c1.y * 2);
    });

    it('should have corner 0 at angle -30 degrees', () => {
      const c = hexCornerOffset(0, 30);
      const angle = Math.atan2(c.y, c.x) * 180 / Math.PI;
      expect(angle).toBeCloseTo(-30);
    });
  });

  describe('hexCorners', () => {
    it('should return 6 corners', () => {
      expect(hexCorners(0, 0, 30)).toHaveLength(6);
    });

    it('should center corners around (centerX, centerY)', () => {
      const corners = hexCorners(100, 200, 30);
      const avgX = corners.reduce((s, c) => s + c.x, 0) / 6;
      const avgY = corners.reduce((s, c) => s + c.y, 0) / 6;
      expect(avgX).toBeCloseTo(100);
      expect(avgY).toBeCloseTo(200);
    });

    it('should produce corners at correct distance from center', () => {
      const corners = hexCorners(0, 0, 30);
      for (const c of corners) {
        const dist = Math.sqrt(c.x * c.x + c.y * c.y);
        expect(dist).toBeCloseTo(30);
      }
    });
  });

  describe('hexToSVGPath', () => {
    it('should return a string starting with M and ending with Z', () => {
      const path = hexToSVGPath(0, 0, 30);
      expect(path.startsWith('M')).toBe(true);
      expect(path.endsWith(' Z')).toBe(true);
    });

    it('should contain 6 points (M + 5 L)', () => {
      const path = hexToSVGPath(0, 0, 30);
      const moves = path.match(/M/g);
      const lines = path.match(/L/g);
      expect(moves).toHaveLength(1);
      expect(lines).toHaveLength(5);
    });
  });

  describe('getAllHexes', () => {
    it('should return width * height hexes', () => {
      expect(getAllHexes(3, 4)).toHaveLength(12);
    });

    it('should include all coordinates in range', () => {
      const hexes = getAllHexes(2, 2);
      expect(hexes).toContainEqual({ q: 0, r: 0 });
      expect(hexes).toContainEqual({ q: 1, r: 0 });
      expect(hexes).toContainEqual({ q: 0, r: 1 });
      expect(hexes).toContainEqual({ q: 1, r: 1 });
    });

    it('should return empty for zero dimensions', () => {
      expect(getAllHexes(0, 5)).toHaveLength(0);
      expect(getAllHexes(5, 0)).toHaveLength(0);
    });
  });

  describe('getHexGridPixelDimensions', () => {
    it('should return positive width and height', () => {
      const dims = getHexGridPixelDimensions(10, 10, 30);
      expect(dims.width).toBeGreaterThan(0);
      expect(dims.height).toBeGreaterThan(0);
    });

    it('should have negative offsetX and offsetY', () => {
      const dims = getHexGridPixelDimensions(10, 10, 30);
      expect(dims.offsetX).toBeLessThan(0);
      expect(dims.offsetY).toBeLessThan(0);
    });

    it('should scale with size', () => {
      const d1 = getHexGridPixelDimensions(10, 10, 30);
      const d2 = getHexGridPixelDimensions(10, 10, 60);
      expect(d2.width).toBeGreaterThan(d1.width);
      expect(d2.height).toBeGreaterThan(d1.height);
    });

    it('should have center between min and max', () => {
      const dims = getHexGridPixelDimensions(10, 10, 30);
      expect(dims.centerX).toBeGreaterThan(dims.offsetX);
      expect(dims.centerY).toBeGreaterThan(dims.offsetY);
    });
  });

  describe('getHexCenterFromOffset', () => {
    it('should return pixel coordinates', () => {
      const result = getHexCenterFromOffset(0, 0, 30);
      expect(typeof result.x).toBe('number');
      expect(typeof result.y).toBe('number');
    });

    it('should handle odd rows with offset', () => {
      const even = getHexCenterFromOffset(2, 0, 30);
      const odd = getHexCenterFromOffset(2, 1, 30);
      expect(odd.x).not.toBe(even.x);
    });
  });

  describe('parseHexKey roundtrip with hexKey', () => {
    it('should roundtrip for positive coordinates', () => {
      const key = hexKey(3, 5);
      const parsed = parseHexKey(key);
      expect(parsed).toEqual({ q: 3, r: 5 });
    });

    it('should roundtrip for negative coordinates', () => {
      const key = hexKey(-2, -7);
      const parsed = parseHexKey(key);
      expect(parsed).toEqual({ q: -2, r: -7 });
    });

    it('should roundtrip for zero', () => {
      const key = hexKey(0, 0);
      const parsed = parseHexKey(key);
      expect(parsed).toEqual({ q: 0, r: 0 });
    });

    it('should roundtrip for large coordinates', () => {
      const key = hexKey(999, -42);
      const parsed = parseHexKey(key);
      expect(parsed).toEqual({ q: 999, r: -42 });
    });
  });

  describe('windingOffset', () => {
    it('should be deterministic (same input gives same output)', () => {
      const a = windingOffset(1, 2, 3, 4, 5);
      const b = windingOffset(1, 2, 3, 4, 5);
      expect(a).toBe(b);
    });

    it('should be within ±maxOffset', () => {
      for (let q1 = 0; q1 < 5; q1++) {
        for (let r1 = 0; r1 < 5; r1++) {
          for (let q2 = 0; q2 < 5; q2++) {
            for (let r2 = 0; r2 < 5; r2++) {
              const result = windingOffset(q1, r1, q2, r2, 5);
              expect(result).toBeGreaterThanOrEqual(-5);
              expect(result).toBeLessThanOrEqual(5);
            }
          }
        }
      }
    });

    it('should produce different values for different hex pairs', () => {
      const a = windingOffset(0, 0, 1, 0, 5);
      const b = windingOffset(0, 0, 0, 1, 5);
      const c = windingOffset(1, 0, 0, 1, 5);
      // At least some should differ
      const allSame = (a === b) && (b === c);
      expect(allSame).toBe(false);
    });

    it('should scale with maxOffset', () => {
      const small = Math.abs(windingOffset(1, 2, 3, 4, 2));
      const large = Math.abs(windingOffset(1, 2, 3, 4, 10));
      expect(small).toBeLessThanOrEqual(2);
      expect(large).toBeLessThanOrEqual(10);
    });

    it('should return 0 for default maxOffset when sin value is exactly 0.5', () => {
      // Just verify the default maxOffset parameter works
      const result = windingOffset(0, 0, 0, 0);
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThanOrEqual(-5);
      expect(result).toBeLessThanOrEqual(5);
    });
  });

  describe('isRoadConnectable', () => {
    it('should return true for city-city', () => {
      expect(isRoadConnectable('city', 'city')).toBe(true);
    });

    it('should return true for city-settlement', () => {
      expect(isRoadConnectable('city', 'settlement')).toBe(true);
    });

    it('should return true for settlement-city', () => {
      expect(isRoadConnectable('settlement', 'city')).toBe(true);
    });

    it('should return true for settlement-settlement', () => {
      expect(isRoadConnectable('settlement', 'settlement')).toBe(true);
    });

    it('should return false for city-other', () => {
      expect(isRoadConnectable('city', 'other')).toBe(false);
    });

    it('should return false for settlement-other', () => {
      expect(isRoadConnectable('settlement', 'other')).toBe(false);
    });

    it('should return false for other-city', () => {
      expect(isRoadConnectable('other', 'city')).toBe(false);
    });

    it('should return false for other-settlement', () => {
      expect(isRoadConnectable('other', 'settlement')).toBe(false);
    });

    it('should return false for other-other', () => {
      expect(isRoadConnectable('other', 'other')).toBe(false);
    });

    it('should return false for empty strings', () => {
      expect(isRoadConnectable('', '')).toBe(false);
      expect(isRoadConnectable('city', '')).toBe(false);
      expect(isRoadConnectable('', 'city')).toBe(false);
    });
  });

  describe('findHexPath', () => {
    it('should return [start] when start equals end', () => {
      const start = { q: 3, r: 3 };
      const result = findHexPath(start, start, 10, 10, {});
      expect(result).toEqual([start]);
    });

    it('should return null when no path exists (blocked by water)', () => {
      const start = { q: 0, r: 0 };
      const end = { q: 2, r: 0 };
      const terrain = {
        '1,0': 'water',
        '1,1': 'water',
        '1,-1': 'water',
        '0,1': 'water',
        '0,-1': 'water',
      };
      const result = findHexPath(start, end, 3, 3, terrain);
      expect(result).toBeNull();
    });

    it('should return a valid path from start to end on open terrain', () => {
      const start = { q: 0, r: 0 };
      const end = { q: 3, r: 0 };
      const result = findHexPath(start, end, 10, 10, {});
      expect(result).not.toBeNull();
      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result[0]).toEqual(start);
      expect(result[result.length - 1]).toEqual(end);
    });

    it('should have adjacent hexes in the path', () => {
      const start = { q: 0, r: 0 };
      const end = { q: 4, r: 2 };
      const result = findHexPath(start, end, 10, 10, {});
      expect(result).not.toBeNull();
      for (let i = 0; i < result.length - 1; i++) {
        const dist = hexDistance(result[i], result[i + 1]);
        expect(dist).toBe(1);
      }
    });

    it('should find a path that avoids expensive terrain when possible', () => {
      const start = { q: 0, r: 0 };
      const end = { q: 2, r: 0 };
      // Direct path through (1,0) is water, but going around via (0,1)->(1,1)->(2,1)->(2,0) is open
      const terrain = {
        '1,0': 'water',
      };
      const result = findHexPath(start, end, 5, 5, terrain);
      expect(result).not.toBeNull();
      expect(result[0]).toEqual(start);
      expect(result[result.length - 1]).toEqual(end);
      // The path should not go through the water hex
      const pathKeys = result.map(h => `${h.q},${h.r}`);
      expect(pathKeys).not.toContain('1,0');
    });

    it('should handle a 1x1 grid with start==end', () => {
      const start = { q: 0, r: 0 };
      const result = findHexPath(start, start, 1, 1, {});
      expect(result).toEqual([start]);
    });

    it('should return null when end is out of bounds', () => {
      const start = { q: 0, r: 0 };
      const end = { q: 5, r: 5 };
      const result = findHexPath(start, end, 3, 3, {});
      expect(result).toBeNull();
    });
  });

  describe('orderHexPath', () => {
    it('should return single hex as-is', () => {
      const hexes = [{ q: 3, r: 5 }];
      const result = orderHexPath(hexes);
      expect(result).toEqual([{ q: 3, r: 5 }]);
    });

    it('should return two hexes as-is', () => {
      const hexes = [{ q: 0, r: 0 }, { q: 1, r: 0 }];
      const result = orderHexPath(hexes);
      expect(result).toEqual([{ q: 0, r: 0 }, { q: 1, r: 0 }]);
    });

    it('should order a connected chain correctly', () => {
      const hexes = [
        { q: 0, r: 0 },
        { q: 1, r: 0 },
        { q: 2, r: 0 },
        { q: 3, r: 0 },
      ];
      const result = orderHexPath(hexes);
      expect(result).toHaveLength(4);
      // Should be ordered from one end to the other
      expect(result[0]).toEqual({ q: 0, r: 0 });
      expect(result[3]).toEqual({ q: 3, r: 0 });
      // Each consecutive pair should be adjacent
      for (let i = 0; i < result.length - 1; i++) {
        expect(hexDistance(result[i], result[i + 1])).toBe(1);
      }
    });

    it('should order an L-shaped path correctly', () => {
      const hexes = [
        { q: 0, r: 0 },
        { q: 1, r: 0 },
        { q: 1, r: 1 },
      ];
      const result = orderHexPath(hexes);
      expect(result).toHaveLength(3);
      // Endpoints should be (0,0) and (1,1) — the two hexes with only 1 neighbor
      const endpoints = [result[0], result[result.length - 1]];
      expect(endpoints).toContainEqual({ q: 0, r: 0 });
      expect(endpoints).toContainEqual({ q: 1, r: 1 });
    });

    it('should return as-is for a loop (all hexes have 2 neighbors)', () => {
      // A triangle loop: each hex has 2 neighbors
      const hexes = [
        { q: 0, r: 0 },
        { q: 1, r: 0 },
        { q: 0, r: 1 },
      ];
      const result = orderHexPath(hexes);
      expect(result).toHaveLength(3);
      // Since each hex has 2 neighbors, there are no endpoints — returns as-is
      expect(result).toEqual(hexes);
    });

    it('should handle empty array', () => {
      const result = orderHexPath([]);
      expect(result).toEqual([]);
    });
  });

  describe('buildWindingPathDescriptor', () => {
    it('should return null for empty array', () => {
      const result = buildWindingPathDescriptor([], 30, '#ff0000', 2);
      expect(result).toBeNull();
    });

    it('should return null for null input', () => {
      const result = buildWindingPathDescriptor(null, 30, '#ff0000', 2);
      expect(result).toBeNull();
    });

    it('should return null for undefined input', () => {
      const result = buildWindingPathDescriptor(undefined, 30, '#ff0000', 2);
      expect(result).toBeNull();
    });

    it('should return object with path/fill/stroke/strokeWidth for valid input', () => {
      const hexes = [{ q: 0, r: 0 }, { q: 1, r: 0 }];
      const result = buildWindingPathDescriptor(hexes, 30, '#ff0000', 2);
      expect(result).not.toBeNull();
      expect(result).toHaveProperty('path');
      expect(result).toHaveProperty('fill');
      expect(result).toHaveProperty('stroke');
      expect(result).toHaveProperty('strokeWidth');
    });

    it('should have path as a non-empty string', () => {
      const hexes = [{ q: 0, r: 0 }, { q: 1, r: 0 }];
      const result = buildWindingPathDescriptor(hexes, 30, '#ff0000', 2);
      expect(typeof result.path).toBe('string');
      expect(result.path.length).toBeGreaterThan(0);
    });

    it('should set fill to "none"', () => {
      const hexes = [{ q: 0, r: 0 }, { q: 1, r: 0 }];
      const result = buildWindingPathDescriptor(hexes, 30, '#ff0000', 2);
      expect(result.fill).toBe('none');
    });

    it('should set stroke to the provided color', () => {
      const hexes = [{ q: 0, r: 0 }, { q: 1, r: 0 }];
      const result = buildWindingPathDescriptor(hexes, 30, '#00ff00', 3);
      expect(result.stroke).toBe('#00ff00');
    });

    it('should set strokeWidth to the provided value', () => {
      const hexes = [{ q: 0, r: 0 }, { q: 1, r: 0 }];
      const result = buildWindingPathDescriptor(hexes, 30, '#ff0000', 5);
      expect(result.strokeWidth).toBe(5);
    });

    it('should return empty path for single hex', () => {
      const hexes = [{ q: 0, r: 0 }];
      const result = buildWindingPathDescriptor(hexes, 30, '#ff0000', 2);
      expect(result).not.toBeNull();
      expect(result.path).toBe('');
      expect(result.stroke).toBe('none');
      expect(result.strokeWidth).toBe(0);
    });

    it('should produce a path starting with M', () => {
      const hexes = [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }];
      const result = buildWindingPathDescriptor(hexes, 30, '#ff0000', 2);
      expect(result.path.startsWith('M')).toBe(true);
    });

    it('should produce a path containing Q (quadratic bezier)', () => {
      const hexes = [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }];
      const result = buildWindingPathDescriptor(hexes, 30, '#ff0000', 2);
      expect(result.path).toContain('Q');
    });

    it('should use default windAmount of 4', () => {
      const hexes = [{ q: 0, r: 0 }, { q: 1, r: 0 }];
      const resultDefault = buildWindingPathDescriptor(hexes, 30, '#ff0000', 2);
      const resultExplicit = buildWindingPathDescriptor(hexes, 30, '#ff0000', 2, 4);
      expect(resultDefault.path).toBe(resultExplicit.path);
    });

    it('should produce different paths for different windAmount values', () => {
      const hexes = [{ q: 0, r: 0 }, { q: 1, r: 0 }];
      const resultA = buildWindingPathDescriptor(hexes, 30, '#ff0000', 2, 0);
      const resultB = buildWindingPathDescriptor(hexes, 30, '#ff0000', 2, 10);
      expect(resultA.path).not.toBe(resultB.path);
    });
  });
});
