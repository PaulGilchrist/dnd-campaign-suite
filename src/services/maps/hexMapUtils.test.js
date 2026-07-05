// @cleaned-by-ai
// @improved-by-ai
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
    it('should format q,r as a string', () => {
      expect(hexKey(3, 5)).toBe('3,5');
      expect(hexKey(-1, -2)).toBe('-1,-2');
      expect(hexKey(0, 0)).toBe('0,0');
      expect(hexKey(999, -42)).toBe('999,-42');
    });
  });

  describe('parseHexKey', () => {
    it('should parse "q,r" back to numbers', () => {
      expect(parseHexKey('3,5')).toEqual({ q: 3, r: 5 });
      expect(parseHexKey('-1,-2')).toEqual({ q: -1, r: -2 });
      expect(parseHexKey('0,0')).toEqual({ q: 0, r: 0 });
    });
  });

  describe('hexKey ↔ parseHexKey roundtrip', () => {
    it('should be inverse for any integer coordinates', () => {
      const pairs = [[0, 0], [3, 5], [-2, -7], [999, -42], [100, 200]];
      for (const [q, r] of pairs) {
        const parsed = parseHexKey(hexKey(q, r));
        expect(parsed).toEqual({ q, r });
      }
    });
  });

  describe('hexToPixel', () => {
    it('should convert origin to (0, 0)', () => {
      expect(hexToPixel(0, 0, 30)).toEqual({ x: 0, y: 0 });
    });

    it('should scale linearly with size', () => {
      const p30 = hexToPixel(1, 1, 30);
      const p60 = hexToPixel(1, 1, 60);
      expect(p60.x).toBeCloseTo(p30.x * 2);
      expect(p60.y).toBeCloseTo(p30.y * 2);
    });

    it('should produce consistent coordinates for adjacent hexes', () => {
      const p00 = hexToPixel(0, 0, 30);
      const p10 = hexToPixel(1, 0, 30);
      const p01 = hexToPixel(0, 1, 30);
      expect(p10.x).toBeGreaterThan(p00.x);
      expect(p01.y).toBeGreaterThan(p00.y);
    });
  });

  describe('pixelToHex', () => {
    it('should convert (0, 0) pixel to (0, 0) hex', () => {
      expect(pixelToHex(0, 0, 30)).toEqual({ q: 0, r: 0 });
    });

    it('should be the inverse of hexToPixel for integer coords', () => {
      const pixel = hexToPixel(2, 3, 30);
      const hex = pixelToHex(pixel.x, pixel.y, 30);
      expect(hex.q).toBeCloseTo(2);
      expect(hex.r).toBeCloseTo(3);
    });
  });

  describe('hexRound', () => {
    it('should round fractional coords to nearest hex', () => {
      expect(hexRound(0.33, 0.33)).toEqual({ q: 0, r: 0 });
      expect(hexRound(0.6, 0.3)).toEqual({ q: 1, r: 0 });
      expect(hexRound(-0.6, -0.3).q).toBe(-1);
      expect(hexRound(-0.6, -0.3).r).toBeCloseTo(0);
    });

    it('should maintain the cube coordinate constraint (q + r + s = 0)', () => {
      for (const [q, r] of [[0.33, 0.33], [0.6, 0.3], [-0.6, -0.3], [1.7, -0.3], [2.1, -1.9], [-0.5, 0.5]]) {
        const rounded = hexRound(q, r);
        const s = -rounded.q - rounded.r;
        expect(s + rounded.q + rounded.r).toBeCloseTo(0);
      }
    });
  });

  describe('pixelToHexSnapped', () => {
    it('should snap pixel to integer hex coordinates', () => {
      const pixel = hexToPixel(2, 1, 30);
      const snapped = pixelToHexSnapped(pixel.x, pixel.y, 30);
      expect(snapped).toEqual({ q: 2, r: 1 });
    });
  });

  describe('hexNeighbors', () => {
    it('should return 6 neighbors at correct offsets', () => {
      const neighbors = hexNeighbors(0, 0);
      const expected = [
        { q: 1, r: 0 }, { q: -1, r: 0 },
        { q: 0, r: 1 }, { q: 0, r: -1 },
        { q: 1, r: -1 }, { q: -1, r: 1 },
      ];
      for (const exp of expected) {
        expect(neighbors).toContainEqual(exp);
      }
    });

    it('should offset correctly from non-origin hex', () => {
      const neighbors = hexNeighbors(3, 5);
      expect(neighbors).toContainEqual({ q: 4, r: 5 });
      expect(neighbors).toContainEqual({ q: 3, r: 6 });
    });
  });

  describe('hexDistance', () => {
    it('should return 0 for the same hex', () => {
      expect(hexDistance({ q: 0, r: 0 }, { q: 0, r: 0 })).toBe(0);
    });

    it('should return correct distance for adjacent and far hexes', () => {
      expect(hexDistance({ q: 0, r: 0 }, { q: 1, r: 0 })).toBe(1);
      expect(hexDistance({ q: 0, r: 0 }, { q: -1, r: 0 })).toBe(1);
      expect(hexDistance({ q: 0, r: 0 }, { q: 0, r: 1 })).toBe(1);
      expect(hexDistance({ q: 0, r: 0 }, { q: 0, r: -1 })).toBe(1);
      expect(hexDistance({ q: 0, r: 0 }, { q: 1, r: -1 })).toBe(1);
      expect(hexDistance({ q: 0, r: 0 }, { q: -1, r: 1 })).toBe(1);
      expect(hexDistance({ q: 0, r: 0 }, { q: 3, r: -2 })).toBe(3);
      expect(hexDistance({ q: 0, r: 0 }, { q: 5, r: 3 })).toBe(8);
    });

    it('should be symmetric', () => {
      const a = { q: 2, r: -1 };
      const b = { q: -3, r: 4 };
      expect(hexDistance(a, b)).toBe(hexDistance(b, a));
    });
  });

  describe('hexCornerOffset', () => {
    it('should place corners at the given size distance from origin', () => {
      for (let i = 0; i < 6; i++) {
        const c = hexCornerOffset(i, 30);
        const dist = Math.sqrt(c.x * c.x + c.y * c.y);
        expect(dist).toBeCloseTo(30);
      }
    });

    it('should scale linearly with size', () => {
      const c1 = hexCornerOffset(0, 30);
      const c2 = hexCornerOffset(0, 60);
      expect(c2.x).toBeCloseTo(c1.x * 2);
      expect(c2.y).toBeCloseTo(c1.y * 2);
    });
  });

  describe('hexCorners', () => {
    it('should center corners around (centerX, centerY)', () => {
      const corners = hexCorners(100, 200, 30);
      const avgX = corners.reduce((s, c) => s + c.x, 0) / 6;
      const avgY = corners.reduce((s, c) => s + c.y, 0) / 6;
      expect(avgX).toBeCloseTo(100);
      expect(avgY).toBeCloseTo(200);
    });
  });

  describe('hexToSVGPath', () => {
    it('should return a valid SVG path string with M and L commands', () => {
      const path = hexToSVGPath(0, 0, 30);
      expect(typeof path).toBe('string');
      expect(path).toMatch(/M/);
      expect(path.match(/L/g)).toHaveLength(5);
    });
  });

  describe('getAllHexes', () => {
    it('should return width * height hexes in row-major order', () => {
      expect(getAllHexes(3, 4)).toHaveLength(12);
      expect(getAllHexes(5, 5)).toHaveLength(25);
      expect(getAllHexes(0, 5)).toHaveLength(0);
      expect(getAllHexes(5, 0)).toHaveLength(0);
      expect(getAllHexes(0, 0)).toHaveLength(0);
    });

    it('should include all coordinates in range', () => {
      const hexes = getAllHexes(2, 2);
      expect(hexes).toContainEqual({ q: 0, r: 0 });
      expect(hexes).toContainEqual({ q: 1, r: 0 });
      expect(hexes).toContainEqual({ q: 0, r: 1 });
      expect(hexes).toContainEqual({ q: 1, r: 1 });
    });
  });

  describe('getHexGridPixelDimensions', () => {
    it('should return positive dimensions that scale with size and grid', () => {
      const d1 = getHexGridPixelDimensions(10, 10, 30);
      expect(d1.width).toBeGreaterThan(0);
      expect(d1.height).toBeGreaterThan(0);
      const d2 = getHexGridPixelDimensions(10, 10, 60);
      expect(d2.width).toBeCloseTo(d1.width * 2);
      expect(d2.height).toBeCloseTo(d1.height * 2);
      const d3 = getHexGridPixelDimensions(5, 5, 30);
      expect(d1.width).toBeGreaterThan(d3.width);
      expect(d1.height).toBeGreaterThan(d3.height);
    });

    it('should return a grid that contains all hex centers', () => {
      const width = 5;
      const height = 4;
      const size = 30;
      const dims = getHexGridPixelDimensions(width, height, size);
      const hexes = getAllHexes(width, height);
      for (const h of hexes) {
        const center = hexToPixel(h.q, h.r, size);
        const adjustedX = center.x + dims.offsetX;
        const adjustedY = center.y + dims.offsetY;
        expect(adjustedX).toBeGreaterThanOrEqual(-size);
        expect(adjustedX).toBeLessThanOrEqual(dims.width + size);
        expect(adjustedY).toBeGreaterThanOrEqual(-size);
        expect(adjustedY).toBeLessThanOrEqual(dims.height + size);
      }
    });
  });

  describe('getHexCenterFromOffset', () => {
    it('should handle odd rows with horizontal offset and correct vertical spacing', () => {
      const even = getHexCenterFromOffset(2, 0, 30);
      const odd = getHexCenterFromOffset(2, 1, 30);
      expect(odd.x).not.toBe(even.x);
      const r0 = getHexCenterFromOffset(0, 0, 30);
      const r1 = getHexCenterFromOffset(0, 1, 30);
      expect(r1.y - r0.y).toBeCloseTo(30 * 1.5);
    });
  });

  describe('windingOffset', () => {
    it('should be deterministic and within ±maxOffset', () => {
      expect(windingOffset(1, 2, 3, 4, 5)).toBe(windingOffset(1, 2, 3, 4, 5));
      for (const max of [1, 3, 5, 10]) {
        const result = windingOffset(0, 0, 1, 0, max);
        expect(result).toBeGreaterThanOrEqual(-max);
        expect(result).toBeLessThanOrEqual(max);
      }
    });

    it('should produce different values for different hex pairs', () => {
      const a = windingOffset(0, 0, 1, 0, 5);
      const b = windingOffset(0, 0, 0, 1, 5);
      const c = windingOffset(1, 0, 0, 1, 5);
      expect((a === b) && (b === c)).toBe(false);
    });

    it('should scale proportionally with maxOffset', () => {
      const small = windingOffset(1, 2, 3, 4, 2);
      const large = windingOffset(1, 2, 3, 4, 10);
      expect(Math.abs(small) / 2).toBeCloseTo(Math.abs(large) / 10, 1);
    });
  });

  describe('isRoadConnectable', () => {
    it('should connect city and settlement in both directions', () => {
      expect(isRoadConnectable('city', 'settlement')).toBe(true);
      expect(isRoadConnectable('settlement', 'city')).toBe(true);
      expect(isRoadConnectable('city', 'city')).toBe(true);
      expect(isRoadConnectable('settlement', 'settlement')).toBe(true);
    });

    it('should reject non-roadable types', () => {
      for (const nr of ['other', 'forest', 'mountain', 'water', '']) {
        expect(isRoadConnectable(nr, 'city')).toBe(false);
        expect(isRoadConnectable(nr, 'settlement')).toBe(false);
      }
    });
  });

  describe('findHexPath', () => {
    it('should return [start] when start equals end', () => {
      const start = { q: 3, r: 3 };
      expect(findHexPath(start, start, 10, 10, {})).toEqual([start]);
    });

    it('should return a valid path from start to end on open terrain', () => {
      const start = { q: 0, r: 0 };
      const end = { q: 3, r: 0 };
      const result = findHexPath(start, end, 10, 10, {});
      expect(result).not.toBeNull();
      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result[0]).toEqual(start);
      expect(result[result.length - 1]).toEqual(end);
      for (let i = 0; i < result.length - 1; i++) {
        expect(hexDistance(result[i], result[i + 1])).toBe(1);
      }
    });

    it('should avoid expensive terrain when possible', () => {
      const start = { q: 0, r: 0 };
      const end = { q: 2, r: 0 };
      const terrain = { '1,0': 'water' };
      const result = findHexPath(start, end, 5, 5, terrain);
      expect(result).not.toBeNull();
      expect(result[0]).toEqual(start);
      expect(result[result.length - 1]).toEqual(end);
      const pathKeys = result.map(h => `${h.q},${h.r}`);
      expect(pathKeys).not.toContain('1,0');
    });

    it('should return null when end is out of bounds', () => {
      expect(findHexPath({ q: 0, r: 0 }, { q: 5, r: 5 }, 3, 3, {})).toBeNull();
    });
  });

  describe('orderHexPath', () => {
    it('should return small arrays as-is', () => {
      expect(orderHexPath([])).toEqual([]);
      expect(orderHexPath([{ q: 3, r: 5 }])).toEqual([{ q: 3, r: 5 }]);
      expect(orderHexPath([{ q: 0, r: 0 }, { q: 1, r: 0 }])).toEqual([{ q: 0, r: 0 }, { q: 1, r: 0 }]);
    });

    it('should order a connected chain correctly', () => {
      const hexes = [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }, { q: 3, r: 0 }];
      const result = orderHexPath(hexes);
      expect(result).toHaveLength(4);
      expect(result[0]).toEqual({ q: 0, r: 0 });
      expect(result[3]).toEqual({ q: 3, r: 0 });
      for (let i = 0; i < result.length - 1; i++) {
        expect(hexDistance(result[i], result[i + 1])).toBe(1);
      }
    });

    it('should order an L-shaped path correctly', () => {
      const hexes = [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 1, r: 1 }];
      const result = orderHexPath(hexes);
      expect(result).toHaveLength(3);
      const endpoints = [result[0], result[result.length - 1]];
      expect(endpoints).toContainEqual({ q: 0, r: 0 });
      expect(endpoints).toContainEqual({ q: 1, r: 1 });
    });

    it('should return as-is for a loop (all hexes have 2 neighbors)', () => {
      const hexes = [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 0, r: 1 }];
      expect(orderHexPath(hexes)).toEqual(hexes);
    });
  });

  describe('buildWindingPathDescriptor', () => {
    it('should return null for falsy inputs', () => {
      expect(buildWindingPathDescriptor([], 30, '#ff0000', 2)).toBeNull();
      expect(buildWindingPathDescriptor(null, 30, '#ff0000', 2)).toBeNull();
      expect(buildWindingPathDescriptor(undefined, 30, '#ff0000', 2)).toBeNull();
    });

    it('should return object with required properties for valid input', () => {
      const result = buildWindingPathDescriptor([{ q: 0, r: 0 }, { q: 1, r: 0 }], 30, '#ff0000', 2);
      expect(result).not.toBeNull();
      expect(result).toHaveProperty('path');
      expect(result).toHaveProperty('fill');
      expect(result).toHaveProperty('stroke');
      expect(result).toHaveProperty('strokeWidth');
    });

    it('should produce a path starting with M and containing Q commands', () => {
      const result = buildWindingPathDescriptor([{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }], 30, '#ff0000', 2);
      expect(result.path.startsWith('M')).toBe(true);
      expect(result.path).toContain('Q');
    });

    it('should set fill to "none" and stroke to the provided color', () => {
      const result = buildWindingPathDescriptor([{ q: 0, r: 0 }, { q: 1, r: 0 }], 30, '#00ff00', 3);
      expect(result.fill).toBe('none');
      expect(result.stroke).toBe('#00ff00');
      expect(result.strokeWidth).toBe(3);
    });

    it('should return empty path for single hex', () => {
      const result = buildWindingPathDescriptor([{ q: 0, r: 0 }], 30, '#ff0000', 2);
      expect(result.path).toBe('');
      expect(result.fill).toBe('#ff0000');
      expect(result.stroke).toBe('none');
      expect(result.strokeWidth).toBe(0);
    });

    it('should respect the windAmount parameter and use default of 4', () => {
      const hexes = [{ q: 0, r: 0 }, { q: 1, r: 0 }];
      const resultNoWind = buildWindingPathDescriptor(hexes, 30, '#ff0000', 2, 0);
      const resultHighWind = buildWindingPathDescriptor(hexes, 30, '#ff0000', 2, 10);
      expect(resultNoWind.path).not.toBe(resultHighWind.path);
      const resultDefault = buildWindingPathDescriptor(hexes, 30, '#ff0000', 2);
      const resultExplicit = buildWindingPathDescriptor(hexes, 30, '#ff0000', 2, 4);
      expect(resultDefault.path).toBe(resultExplicit.path);
    });
  });
});
