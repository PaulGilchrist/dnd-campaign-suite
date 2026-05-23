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
});
