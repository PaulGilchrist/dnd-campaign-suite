// @improved-by-ai
import { describe, it, expect } from 'vitest';
import {
  OverlayShape,
  DEFAULTS,
  toGrid,
  createOverlay,
  hitTestOverlay,
  svgOrigin,
} from './SpellOverlay.js';

// ── OverlayShape ────────────────────────────────────────────────

describe('OverlayShape', () => {
  it('exports string constants for all five D&D spell overlay shapes', () => {
    expect(OverlayShape).toMatchObject({
      SPHERE: 'sphere',
      CYLINDER: 'cylinder',
      CUBE: 'cube',
      CONE: 'cone',
      LINE: 'line',
    });
  });
});

// ── DEFAULTS ────────────────────────────────────────────────────

describe('DEFAULTS', () => {
  it('has entries for all five shapes with correct 5e dimensions', () => {
    expect(Object.keys(DEFAULTS)).toEqual(['sphere', 'cylinder', 'cube', 'cone', 'line']);

    const s = DEFAULTS.sphere;
    expect(s.radiusFt).toBe(20);
    expect(s.sizeFt).toBe(0);
    expect(s.distanceFt).toBe(0);
    expect(s.color).toBe('rgba(255,80,60,0.35)');

    const c = DEFAULTS.cube;
    expect(c.sizeFt).toBe(15);
    expect(c.radiusFt).toBe(0);
    expect(c.distanceFt).toBe(0);

    const cn = DEFAULTS.cone;
    expect(cn.distanceFt).toBe(60);
    expect(cn.coneAngle).toBe(53);
    expect(cn.radiusFt).toBe(0);

    const l = DEFAULTS.line;
    expect(l.distanceFt).toBe(60);
    expect(l.widthFt).toBe(5);
    expect(l.radiusFt).toBe(0);
  });

  it('all shapes share the same default color', () => {
    const color = DEFAULTS.sphere.color;
    for (const shape of Object.values(OverlayShape)) {
      expect(DEFAULTS[shape].color).toBe(color);
    }
  });
});

// ── toGrid ──────────────────────────────────────────────────────

describe('toGrid', () => {
  it('converts feet to grid units by dividing by 5', () => {
    expect(toGrid(5)).toBe(1);
    expect(toGrid(10)).toBe(2);
    expect(toGrid(20)).toBe(4);
    expect(toGrid(60)).toBe(12);
  });

  it('handles zero', () => {
    expect(toGrid(0)).toBe(0);
  });

  it('handles non-integer feet values', () => {
    expect(toGrid(7)).toBeCloseTo(1.4);
  });

  it('handles negative feet values', () => {
    expect(toGrid(-10)).toBe(-2);
  });

  it('returns NaN for NaN input', () => {
    expect(toGrid(NaN)).toBeNaN();
  });
});

// ── createOverlay ───────────────────────────────────────────────

describe('createOverlay', () => {
  it('creates an overlay with shape, position, angle, and defaults', () => {
    const overlay = createOverlay('sphere', 3, 4);
    expect(overlay.shape).toBe('sphere');
    expect(overlay.startGridX).toBe(3);
    expect(overlay.startGridY).toBe(4);
    expect(overlay.angle).toBe(0);
    expect(overlay.radiusFt).toBe(20);
    expect(overlay.color).toBe('rgba(255,80,60,0.35)');
  });

  it('generates unique ids for each overlay', () => {
    const ids = new Set();
    for (let i = 0; i < 10; i++) {
      ids.add(createOverlay('sphere', 0, 0).id);
    }
    expect(ids.size).toBe(10);
  });

  it('accepts a custom angle', () => {
    const overlay = createOverlay('cone', 3, 4, 90);
    expect(overlay.angle).toBe(90);
  });

  it('overrides defaults with params', () => {
    const overlay = createOverlay('sphere', 3, 4, 0, { radiusFt: 30, color: 'rgba(100,200,50,0.5)' });
    expect(overlay.radiusFt).toBe(30);
    expect(overlay.color).toBe('rgba(100,200,50,0.5)');
    expect(overlay.startGridX).toBe(3);
  });

  it('works for all five shapes', () => {
    const overlays = ['sphere', 'cylinder', 'cube', 'cone', 'line'].map(shape =>
      createOverlay(shape, 1, 2)
    );
    for (const overlay of overlays) {
      expect(overlay.shape).toBeDefined();
      expect(overlay.id).toBeDefined();
      expect(overlay.startGridX).toBe(1);
      expect(overlay.startGridY).toBe(2);
    }
  });

  it('handles negative grid coordinates', () => {
    const overlay = createOverlay('sphere', -2, 5);
    expect(overlay.startGridX).toBe(-2);
    expect(overlay.startGridY).toBe(5);
  });
});

// ── hitTestOverlay ──────────────────────────────────────────────

describe('hitTestOverlay', () => {
  function makeOverlay(shape, gridX, gridY, angle, params = {}) {
    return createOverlay(shape, gridX, gridY, angle, params);
  }

  // ── SPHERE ────────────────────────────────────────────────────

  describe('SPHERE', () => {
    it('hits the center point', () => {
      const overlay = makeOverlay('sphere', 5, 5, 0, { radiusFt: 20 });
      expect(hitTestOverlay(overlay, 5, 5)).toBe(true);
    });

    it('hits points within the radius', () => {
      const overlay = makeOverlay('sphere', 5, 5, 0, { radiusFt: 20 });
      expect(hitTestOverlay(overlay, 5, 8)).toBe(true);
    });

    it('misses points outside the radius', () => {
      const overlay = makeOverlay('sphere', 5, 5, 0, { radiusFt: 20 });
      expect(hitTestOverlay(overlay, 5, 10)).toBe(false);
    });

    it('includes points exactly on the boundary', () => {
      // radiusFt=20 → r=160px, 4 cells = 160px
      const overlay = makeOverlay('sphere', 5, 5, 0, { radiusFt: 20 });
      expect(hitTestOverlay(overlay, 5, 9)).toBe(true);
    });

    it('rejects points just beyond the boundary', () => {
      // radiusFt=20 → r=160px, 5 cells = 200px
      const overlay = makeOverlay('sphere', 5, 5, 0, { radiusFt: 20 });
      expect(hitTestOverlay(overlay, 5, 10)).toBe(false);
    });

    it('only hits the center when radiusFt=0', () => {
      const overlay = makeOverlay('sphere', 5, 5, 0, { radiusFt: 0 });
      expect(hitTestOverlay(overlay, 5, 5)).toBe(true);
      expect(hitTestOverlay(overlay, 6, 5)).toBe(false);
    });

    it('is independent of rotation angle', () => {
      const overlay = makeOverlay('sphere', 5, 5, 270, { radiusFt: 20 });
      expect(hitTestOverlay(overlay, 5, 6)).toBe(true);
    });

    it('works with negative grid coordinates', () => {
      const overlay = makeOverlay('sphere', -3, -3, 0, { radiusFt: 5 });
      expect(hitTestOverlay(overlay, -3, -3)).toBe(true);
      expect(hitTestOverlay(overlay, -2, -4)).toBe(false);
    });
  });

  // ── CYLINDER ──────────────────────────────────────────────────

  describe('CYLINDER', () => {
    it('hits the center point', () => {
      const overlay = makeOverlay('cylinder', 5, 5, 0, { radiusFt: 20 });
      expect(hitTestOverlay(overlay, 5, 5)).toBe(true);
    });

    it('hits points within the radius', () => {
      const overlay = makeOverlay('cylinder', 5, 5, 0, { radiusFt: 20 });
      expect(hitTestOverlay(overlay, 5, 7)).toBe(true);
    });

    it('misses points outside the radius', () => {
      const overlay = makeOverlay('cylinder', 5, 5, 0, { radiusFt: 20 });
      expect(hitTestOverlay(overlay, 5, 10)).toBe(false);
    });
  });

  // ── CUBE ──────────────────────────────────────────────────────

  describe('CUBE', () => {
    it('hits the center point', () => {
      const overlay = makeOverlay('cube', 5, 5, 0, { sizeFt: 15 });
      expect(hitTestOverlay(overlay, 5, 5)).toBe(true);
    });

    it('hits points within the cube bounds at angle=0', () => {
      // sizeFt=15 → half=60px, 1 cell = 40px
      const overlay = makeOverlay('cube', 5, 5, 0, { sizeFt: 15 });
      expect(hitTestOverlay(overlay, 6, 5)).toBe(true);
    });

    it('misses points outside the cube bounds', () => {
      // sizeFt=15 → half=60px, 2 cells = 80px
      const overlay = makeOverlay('cube', 5, 5, 0, { sizeFt: 15 });
      expect(hitTestOverlay(overlay, 7, 5)).toBe(false);
    });

    it('respects rotation', () => {
      const overlay = makeOverlay('cube', 5, 5, 90, { sizeFt: 15 });
      expect(hitTestOverlay(overlay, 6, 5)).toBe(true);
    });

    it('only hits the center when sizeFt=0', () => {
      const overlay = makeOverlay('cube', 5, 5, 0, { sizeFt: 0 });
      expect(hitTestOverlay(overlay, 5, 5)).toBe(true);
      expect(hitTestOverlay(overlay, 6, 5)).toBe(false);
    });

    it('works with negative angles', () => {
      const overlay = makeOverlay('cube', 5, 5, -45, { sizeFt: 30 });
      expect(hitTestOverlay(overlay, 5, 5)).toBe(true);
    });

    it('hits diagonal points within bounds', () => {
      // sizeFt=30 → half=120px, diagonal to (7,7) ≈ 113px
      const overlay = makeOverlay('cube', 5, 5, 0, { sizeFt: 30 });
      expect(hitTestOverlay(overlay, 7, 7)).toBe(true);
    });

    it('excludes diagonal points outside bounds', () => {
      // sizeFt=15 → half=60px, diagonal to (7,7) ≈ 113px
      const overlay = makeOverlay('cube', 5, 5, 0, { sizeFt: 15 });
      expect(hitTestOverlay(overlay, 7, 7)).toBe(false);
    });

    it('includes points exactly on the cube boundary', () => {
      // sizeFt=20 → half=80px, 2 cells = 80px
      const overlay = makeOverlay('cube', 5, 5, 0, { sizeFt: 20 });
      expect(hitTestOverlay(overlay, 7, 5)).toBe(true);
    });
  });

  // ── CONE ──────────────────────────────────────────────────────

  describe('CONE', () => {
    it('hits the center point (origin)', () => {
      const overlay = makeOverlay('cone', 5, 5, 0, { distanceFt: 60, coneAngle: 53 });
      expect(hitTestOverlay(overlay, 5, 5)).toBe(true);
    });

    it('hits a point within distance and angle on the cone axis', () => {
      // angle=0 → +X axis. (8,5) is 120px away, within 480px range.
      const overlay = makeOverlay('cone', 5, 5, 0, { distanceFt: 60, coneAngle: 53 });
      expect(hitTestOverlay(overlay, 8, 5)).toBe(true);
    });

    it('misses points beyond the cone distance', () => {
      // distanceFt=60 → 480px. (20,5) is 600px away.
      const overlay = makeOverlay('cone', 5, 5, 0, { distanceFt: 60, coneAngle: 53 });
      expect(hitTestOverlay(overlay, 20, 5)).toBe(false);
    });

    it('misses points outside the cone angle', () => {
      // coneAngle=53 → halfSpread≈26.5°. (8,8) is ~45° from axis.
      const overlay = makeOverlay('cone', 5, 5, 0, { distanceFt: 60, coneAngle: 53 });
      expect(hitTestOverlay(overlay, 8, 8)).toBe(false);
    });

    it('respects rotation angle', () => {
      // angle=90 → +Y axis. (5,8) is on the axis.
      const overlay = makeOverlay('cone', 5, 5, 90, { distanceFt: 60, coneAngle: 53 });
      expect(hitTestOverlay(overlay, 5, 8)).toBe(true);
    });

    it('hits with a wide angle', () => {
      // coneAngle=90 → halfSpread=45°. (8,8) is ~45° from axis.
      const overlay = makeOverlay('cone', 5, 5, 0, { distanceFt: 60, coneAngle: 90 });
      expect(hitTestOverlay(overlay, 8, 8)).toBe(true);
    });

    it('only hits the origin when distanceFt=0', () => {
      const overlay = makeOverlay('cone', 5, 5, 0, { distanceFt: 0, coneAngle: 53 });
      expect(hitTestOverlay(overlay, 5, 5)).toBe(true);
      expect(hitTestOverlay(overlay, 6, 5)).toBe(false);
    });

    it('rejects points slightly off-axis with a narrow angle', () => {
      // coneAngle=10 → halfSpread=5°. (8,6) is off-axis.
      const overlay = makeOverlay('cone', 5, 5, 0, { distanceFt: 60, coneAngle: 10 });
      expect(hitTestOverlay(overlay, 8, 5)).toBe(true);
      expect(hitTestOverlay(overlay, 8, 6)).toBe(false);
    });

    it('points along negative Y with angle=-90', () => {
      const overlay = makeOverlay('cone', 5, 5, -90, { distanceFt: 60, coneAngle: 53 });
      expect(hitTestOverlay(overlay, 5, 2)).toBe(true);
    });

    it('points left at 180 degrees', () => {
      const overlay = makeOverlay('cone', 5, 5, 180, { distanceFt: 60, coneAngle: 53 });
      expect(hitTestOverlay(overlay, 2, 5)).toBe(true);
    });
  });

  // ── LINE ──────────────────────────────────────────────────────

  describe('LINE', () => {
    it('hits the center point (origin)', () => {
      const overlay = makeOverlay('line', 5, 5, 0, { distanceFt: 60, widthFt: 5 });
      expect(hitTestOverlay(overlay, 5, 5)).toBe(true);
    });

    it('hits a point along the line at angle=0', () => {
      const overlay = makeOverlay('line', 5, 5, 0, { distanceFt: 60, widthFt: 5 });
      expect(hitTestOverlay(overlay, 8, 5)).toBe(true);
    });

    it('misses points beyond the line distance', () => {
      // distanceFt=60 → 480px. (20,5) is 600px away.
      const overlay = makeOverlay('line', 5, 5, 0, { distanceFt: 60, widthFt: 5 });
      expect(hitTestOverlay(overlay, 20, 5)).toBe(false);
    });

    it('misses points behind the line origin', () => {
      // angle=0 → +X. (2,5) is behind.
      const overlay = makeOverlay('line', 5, 5, 0, { distanceFt: 60, widthFt: 5 });
      expect(hitTestOverlay(overlay, 2, 5)).toBe(false);
    });

    it('misses points outside the line width', () => {
      // widthFt=5 → half-width=20px. (8,6) is 40px off-axis.
      const overlay = makeOverlay('line', 5, 5, 0, { distanceFt: 60, widthFt: 5 });
      expect(hitTestOverlay(overlay, 8, 6)).toBe(false);
    });

    it('respects rotation angle', () => {
      // angle=90 → +Y axis.
      const overlay = makeOverlay('line', 5, 5, 90, { distanceFt: 60, widthFt: 5 });
      expect(hitTestOverlay(overlay, 5, 8)).toBe(true);
    });

    it('only hits the origin when widthFt=0', () => {
      const overlay = makeOverlay('line', 5, 5, 0, { distanceFt: 60, widthFt: 0 });
      expect(hitTestOverlay(overlay, 5, 5)).toBe(true);
      expect(hitTestOverlay(overlay, 8, 6)).toBe(false);
    });

    it('only hits the origin when distanceFt=0', () => {
      const overlay = makeOverlay('line', 5, 5, 0, { distanceFt: 0, widthFt: 5 });
      expect(hitTestOverlay(overlay, 5, 5)).toBe(true);
      expect(hitTestOverlay(overlay, 6, 5)).toBe(false);
    });

    it('points along negative Y with angle=-90', () => {
      const overlay = makeOverlay('line', 5, 5, -90, { distanceFt: 60, widthFt: 5 });
      expect(hitTestOverlay(overlay, 5, 2)).toBe(true);
    });

    it('points left at 180 degrees', () => {
      const overlay = makeOverlay('line', 5, 5, 180, { distanceFt: 60, widthFt: 5 });
      expect(hitTestOverlay(overlay, 2, 5)).toBe(true);
    });

    it('hits along a diagonal angle', () => {
      const overlay = makeOverlay('line', 5, 5, 45, { distanceFt: 60, widthFt: 10 });
      expect(hitTestOverlay(overlay, 8, 8)).toBe(true);
    });

    it('accepts points within a wide line width', () => {
      // widthFt=15 → half-width=60px. (8,6) is 40px off-axis.
      const overlay = makeOverlay('line', 5, 5, 0, { distanceFt: 60, widthFt: 15 });
      expect(hitTestOverlay(overlay, 8, 6)).toBe(true);
    });

    it('includes points exactly at the line end boundary', () => {
      // distanceFt=20 → 160px. 4 cells = 160px.
      const overlay = makeOverlay('line', 5, 5, 0, { distanceFt: 20, widthFt: 10 });
      expect(hitTestOverlay(overlay, 9, 5)).toBe(true);
    });
  });

  // ── Unknown shapes ────────────────────────────────────────────

  describe('unknown shape', () => {
    it('returns false for unknown or empty shape strings', () => {
      const overlay = createOverlay('sphere', 5, 5);
      overlay.shape = 'unknown';
      expect(hitTestOverlay(overlay, 5, 5)).toBe(false);

      overlay.shape = '';
      expect(hitTestOverlay(overlay, 5, 5)).toBe(false);
    });
  });

  // ── Edge cases ────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles large grid coordinates', () => {
      const overlay = makeOverlay('sphere', 100, 100, 0, { radiusFt: 20 });
      expect(hitTestOverlay(overlay, 100, 100)).toBe(true);
    });

    it('handles zero grid coordinates', () => {
      const overlay = makeOverlay('sphere', 0, 0, 0, { radiusFt: 20 });
      expect(hitTestOverlay(overlay, 0, 0)).toBe(true);
    });
  });
});

// ── svgOrigin ───────────────────────────────────────────────────

describe('svgOrigin', () => {
  it('returns screen coordinates for the overlay origin', () => {
    const overlay = createOverlay('sphere', 3, 4);
    const origin = svgOrigin(overlay);
    // CELL=40: x = 3*40 + 20 = 140, y = 4*40 + 20 = 180
    expect(origin).toEqual({ x: 140, y: 180 });
  });

  it('handles zero grid coordinates', () => {
    const overlay = createOverlay('sphere', 0, 0);
    expect(svgOrigin(overlay)).toEqual({ x: 20, y: 20 });
  });

  it('handles negative grid coordinates', () => {
    const overlay = createOverlay('sphere', -1, 2);
    expect(svgOrigin(overlay)).toEqual({ x: -20, y: 100 });
  });

  it('uses startGridX and startGridY from the overlay', () => {
    const overlay = createOverlay('cone', 10, 20);
    expect(svgOrigin(overlay)).toEqual({ x: 420, y: 820 });
  });
});
