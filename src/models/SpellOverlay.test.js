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
  it('exports all five shape constants with correct string values', () => {
    expect(OverlayShape.SPHERE).toBe('sphere');
    expect(OverlayShape.CYLINDER).toBe('cylinder');
    expect(OverlayShape.CUBE).toBe('cube');
    expect(OverlayShape.CONE).toBe('cone');
    expect(OverlayShape.LINE).toBe('line');
  });

  it('has exactly five shape keys', () => {
    expect(Object.keys(OverlayShape)).toHaveLength(5);
  });
});

// ── DEFAULTS ────────────────────────────────────────────────────

describe('DEFAULTS', () => {
  it('has entries for all five shapes', () => {
    expect(DEFAULTS).toHaveProperty('sphere');
    expect(DEFAULTS).toHaveProperty('cylinder');
    expect(DEFAULTS).toHaveProperty('cube');
    expect(DEFAULTS).toHaveProperty('cone');
    expect(DEFAULTS).toHaveProperty('line');
  });

  it('sphere defaults have radiusFt=20 and zeroed other dimensions', () => {
    expect(DEFAULTS.sphere.radiusFt).toBe(20);
    expect(DEFAULTS.sphere.coneAngle).toBe(0);
    expect(DEFAULTS.sphere.widthFt).toBe(0);
    expect(DEFAULTS.sphere.distanceFt).toBe(0);
    expect(DEFAULTS.sphere.sizeFt).toBe(0);
  });

  it('cylinder defaults have radiusFt=20 and zeroed other dimensions', () => {
    expect(DEFAULTS.cylinder.radiusFt).toBe(20);
    expect(DEFAULTS.cylinder.coneAngle).toBe(0);
    expect(DEFAULTS.cylinder.widthFt).toBe(0);
    expect(DEFAULTS.cylinder.distanceFt).toBe(0);
    expect(DEFAULTS.cylinder.sizeFt).toBe(0);
  });

  it('cube defaults have sizeFt=15 and zeroed other dimensions', () => {
    expect(DEFAULTS.cube.sizeFt).toBe(15);
    expect(DEFAULTS.cube.radiusFt).toBe(0);
    expect(DEFAULTS.cube.coneAngle).toBe(0);
    expect(DEFAULTS.cube.widthFt).toBe(0);
    expect(DEFAULTS.cube.distanceFt).toBe(0);
  });

  it('cone defaults have distanceFt=60 and coneAngle=53', () => {
    expect(DEFAULTS.cone.distanceFt).toBe(60);
    expect(DEFAULTS.cone.coneAngle).toBe(53);
    expect(DEFAULTS.cone.radiusFt).toBe(0);
    expect(DEFAULTS.cone.widthFt).toBe(0);
    expect(DEFAULTS.cone.sizeFt).toBe(0);
  });

  it('line defaults have distanceFt=60 and widthFt=5', () => {
    expect(DEFAULTS.line.distanceFt).toBe(60);
    expect(DEFAULTS.line.widthFt).toBe(5);
    expect(DEFAULTS.line.radiusFt).toBe(0);
    expect(DEFAULTS.line.coneAngle).toBe(0);
    expect(DEFAULTS.line.sizeFt).toBe(0);
  });

  it('all shapes share the same default color', () => {
    const color = 'rgba(255,80,60,0.35)';
    expect(DEFAULTS.sphere.color).toBe(color);
    expect(DEFAULTS.cylinder.color).toBe(color);
    expect(DEFAULTS.cube.color).toBe(color);
    expect(DEFAULTS.cone.color).toBe(color);
    expect(DEFAULTS.line.color).toBe(color);
  });

  it('each default has all five dimension properties', () => {
    const expectedKeys = ['radiusFt', 'coneAngle', 'widthFt', 'distanceFt', 'sizeFt', 'color'];
    for (const shape of Object.keys(DEFAULTS)) {
      expectedKeys.forEach(key => {
        expect(DEFAULTS[shape]).toHaveProperty(key);
      });
    }
  });
});

// ── toGrid ──────────────────────────────────────────────────────

describe('toGrid', () => {
  it('converts feet to grid units (divides by 5)', () => {
    expect(toGrid(5)).toBe(1);
    expect(toGrid(10)).toBe(2);
    expect(toGrid(20)).toBe(4);
    expect(toGrid(60)).toBe(12);
  });

  it('handles zero', () => {
    expect(toGrid(0)).toBe(0);
  });

  it('handles fractional results', () => {
    expect(toGrid(15)).toBe(3);
    expect(toGrid(25)).toBe(5);
  });

  it('handles non-integer feet values', () => {
    expect(toGrid(7)).toBeCloseTo(1.4);
  });
});

// ── createOverlay ───────────────────────────────────────────────

describe('createOverlay', () => {
  it('creates an overlay with the correct shape and grid position', () => {
    const overlay = createOverlay('sphere', 3, 4);
    expect(overlay.shape).toBe('sphere');
    expect(overlay.startGridX).toBe(3);
    expect(overlay.startGridY).toBe(4);
  });

  it('generates a unique id for each overlay', () => {
    const o1 = createOverlay('sphere', 3, 4);
    const o2 = createOverlay('sphere', 3, 4);
    expect(o1.id).not.toBe(o2.id);
  });

  it('defaults angle to 0 when not provided', () => {
    const overlay = createOverlay('sphere', 3, 4);
    expect(overlay.angle).toBe(0);
  });

  it('uses provided angle', () => {
    const overlay = createOverlay('cone', 3, 4, 90);
    expect(overlay.angle).toBe(90);
  });

  it('merges DEFAULTS for the given shape', () => {
    const overlay = createOverlay('sphere', 3, 4);
    expect(overlay.radiusFt).toBe(20);
    expect(overlay.color).toBe('rgba(255,80,60,0.35)');
  });

  it('allows params to override DEFAULTS', () => {
    const overlay = createOverlay('sphere', 3, 4, 0, { radiusFt: 30 });
    expect(overlay.radiusFt).toBe(30);
  });

  it('allows multiple params to override DEFAULTS', () => {
    const overlay = createOverlay('cone', 5, 6, 45, {
      distanceFt: 80,
      coneAngle: 90,
      color: 'rgba(100,200,50,0.5)',
    });
    expect(overlay.distanceFt).toBe(80);
    expect(overlay.coneAngle).toBe(90);
    expect(overlay.color).toBe('rgba(100,200,50,0.5)');
  });

  it('works for all five shapes', () => {
    ['sphere', 'cylinder', 'cube', 'cone', 'line'].forEach(shape => {
      const overlay = createOverlay(shape, 1, 2);
      expect(overlay.shape).toBe(shape);
      expect(overlay.id).toBeDefined();
    });
  });

  it('handles negative grid coordinates', () => {
    const overlay = createOverlay('sphere', -2, 5);
    expect(overlay.startGridX).toBe(-2);
    expect(overlay.startGridY).toBe(5);
  });

  it('handles empty params object', () => {
    const overlay = createOverlay('sphere', 3, 4, 0, {});
    expect(overlay.shape).toBe('sphere');
    expect(overlay.radiusFt).toBe(20);
  });
});

// ── hitTestOverlay ──────────────────────────────────────────────

describe('hitTestOverlay', () => {
  // Helper to create overlays with known dimensions
  function makeOverlay(shape, gridX, gridY, angle, params = {}) {
    return createOverlay(shape, gridX, gridY, angle, params);
  }

  // ── SPHERE ────────────────────────────────────────────────────

  describe('SPHERE', () => {
    it('hits the center point of a sphere', () => {
      const overlay = makeOverlay('sphere', 5, 5, 0, { radiusFt: 20 });
      expect(hitTestOverlay(overlay, 5, 5)).toBe(true);
    });

    it('hits a point within the sphere radius', () => {
      // radiusFt=20 → r = (20/5)*40 = 160px
      // grid cell is 40px, so 3 cells away = 120px < 160px
      const overlay = makeOverlay('sphere', 5, 5, 0, { radiusFt: 20 });
      expect(hitTestOverlay(overlay, 5, 8)).toBe(true);
    });

    it('misses a point outside the sphere radius', () => {
      // radiusFt=20 → r = 160px. 5 cells away = 200px > 160px
      const overlay = makeOverlay('sphere', 5, 5, 0, { radiusFt: 20 });
      expect(hitTestOverlay(overlay, 5, 10)).toBe(false);
    });

    it('hits a point exactly on the sphere boundary', () => {
      // radiusFt=20 → r = 160px. 4 cells away = 160px (exactly on boundary)
      const overlay = makeOverlay('sphere', 5, 5, 0, { radiusFt: 20 });
      expect(hitTestOverlay(overlay, 5, 9)).toBe(true);
    });

    it('handles a sphere with radiusFt=0 (only center hits)', () => {
      const overlay = makeOverlay('sphere', 5, 5, 0, { radiusFt: 0 });
      expect(hitTestOverlay(overlay, 5, 5)).toBe(true);
      expect(hitTestOverlay(overlay, 6, 5)).toBe(false);
    });

    it('sphere hit test is independent of angle', () => {
      const overlay = makeOverlay('sphere', 5, 5, 90, { radiusFt: 20 });
      expect(hitTestOverlay(overlay, 5, 6)).toBe(true);
    });
  });

  // ── CYLINDER ──────────────────────────────────────────────────

  describe('CYLINDER', () => {
    it('hits the center point of a cylinder', () => {
      const overlay = makeOverlay('cylinder', 5, 5, 0, { radiusFt: 20 });
      expect(hitTestOverlay(overlay, 5, 5)).toBe(true);
    });

    it('hits a point within the cylinder radius', () => {
      const overlay = makeOverlay('cylinder', 5, 5, 0, { radiusFt: 20 });
      expect(hitTestOverlay(overlay, 5, 7)).toBe(true);
    });

    it('misses a point outside the cylinder radius', () => {
      const overlay = makeOverlay('cylinder', 5, 5, 0, { radiusFt: 20 });
      expect(hitTestOverlay(overlay, 5, 10)).toBe(false);
    });

    it('cylinder hit test behaves like sphere (same formula)', () => {
      const sphere = makeOverlay('sphere', 5, 5, 0, { radiusFt: 20 });
      const cylinder = makeOverlay('cylinder', 5, 5, 0, { radiusFt: 20 });
      expect(hitTestOverlay(sphere, 6, 7)).toBe(
        hitTestOverlay(cylinder, 6, 7)
      );
    });
  });

  // ── CUBE ──────────────────────────────────────────────────────

  describe('CUBE', () => {
    it('hits the center point of a cube', () => {
      const overlay = makeOverlay('cube', 5, 5, 0, { sizeFt: 15 });
      expect(hitTestOverlay(overlay, 5, 5)).toBe(true);
    });

    it('hits a point within the cube bounds (angle=0)', () => {
      // sizeFt=15 → half = (15/5)*40/2 = 60px. 1 cell = 40px < 60px
      const overlay = makeOverlay('cube', 5, 5, 0, { sizeFt: 15 });
      expect(hitTestOverlay(overlay, 6, 5)).toBe(true);
    });

    it('misses a point outside the cube bounds', () => {
      // sizeFt=15 → half = 60px. 2 cells = 80px > 60px
      const overlay = makeOverlay('cube', 5, 5, 0, { sizeFt: 15 });
      expect(hitTestOverlay(overlay, 7, 5)).toBe(false);
    });

    it('respects cube rotation (90 degrees)', () => {
      // sizeFt=15 → half = 60px. At angle=90, the cube is rotated.
      // A point at (6, 5) should still be within bounds for a large enough cube.
      const overlay = makeOverlay('cube', 5, 5, 90, { sizeFt: 15 });
      expect(hitTestOverlay(overlay, 6, 5)).toBe(true);
    });

    it('handles cube with sizeFt=0 (only center hits)', () => {
      const overlay = makeOverlay('cube', 5, 5, 0, { sizeFt: 0 });
      expect(hitTestOverlay(overlay, 5, 5)).toBe(true);
      expect(hitTestOverlay(overlay, 6, 5)).toBe(false);
    });

    it('cube hit test works with negative angle', () => {
      const overlay = makeOverlay('cube', 5, 5, -45, { sizeFt: 30 });
      expect(hitTestOverlay(overlay, 5, 5)).toBe(true);
    });

    it('cube hit test works with diagonal points', () => {
      const overlay = makeOverlay('cube', 5, 5, 0, { sizeFt: 30 });
      // half = (30/5)*40/2 = 120px. Diagonal: sqrt(80^2+80^2) ≈ 113px
      expect(hitTestOverlay(overlay, 7, 7)).toBe(true);
    });

    it('cube hit test correctly excludes diagonal points outside bounds', () => {
      const overlay = makeOverlay('cube', 5, 5, 0, { sizeFt: 15 });
      // half = 60px. Diagonal to (7,7): sqrt(80^2+80^2) ≈ 113px > 60px
      expect(hitTestOverlay(overlay, 7, 7)).toBe(false);
    });
  });

  // ── CONE ──────────────────────────────────────────────────────

  describe('CONE', () => {
    it('hits the center point of a cone (origin)', () => {
      const overlay = makeOverlay('cone', 5, 5, 0, { distanceFt: 60, coneAngle: 53 });
      expect(hitTestOverlay(overlay, 5, 5)).toBe(true);
    });

    it('hits a point within the cone distance and angle', () => {
      // angle=0 means cone points along +X axis. Point at (8, 5) is 3 cells = 120px away.
      // distanceFt=60 → dist = (60/5)*40 = 480px. 120 < 480 ✓
      // coneAngle=53 → halfSpread ≈ 26.5°. Point is on the axis (angle diff = 0) ✓
      const overlay = makeOverlay('cone', 5, 5, 0, { distanceFt: 60, coneAngle: 53 });
      expect(hitTestOverlay(overlay, 8, 5)).toBe(true);
    });

    it('misses a point beyond the cone distance', () => {
      // distanceFt=60 → dist = 480px. 15 cells = 600px > 480px
      const overlay = makeOverlay('cone', 5, 5, 0, { distanceFt: 60, coneAngle: 53 });
      expect(hitTestOverlay(overlay, 20, 5)).toBe(false);
    });

    it('misses a point outside the cone angle', () => {
      // coneAngle=53 → halfSpread ≈ 26.5°. Point at (8, 8) is at ~45° from center.
      const overlay = makeOverlay('cone', 5, 5, 0, { distanceFt: 60, coneAngle: 53 });
      expect(hitTestOverlay(overlay, 8, 8)).toBe(false);
    });

    it('cone respects rotation angle', () => {
      // angle=90 means cone points along +Y axis. Point at (5, 8) is on the axis.
      const overlay = makeOverlay('cone', 5, 5, 90, { distanceFt: 60, coneAngle: 53 });
      expect(hitTestOverlay(overlay, 5, 8)).toBe(true);
    });

    it('cone with wide angle hits more points', () => {
      // coneAngle=90 → halfSpread = 45°. Point at (8, 8) is at ~45° from center.
      const overlay = makeOverlay('cone', 5, 5, 0, { distanceFt: 60, coneAngle: 90 });
      expect(hitTestOverlay(overlay, 8, 8)).toBe(true);
    });

    it('handles cone with distanceFt=0', () => {
      const overlay = makeOverlay('cone', 5, 5, 0, { distanceFt: 0, coneAngle: 53 });
      expect(hitTestOverlay(overlay, 5, 5)).toBe(true);
      expect(hitTestOverlay(overlay, 6, 5)).toBe(false);
    });

    it('handles cone with very small angle', () => {
      const overlay = makeOverlay('cone', 5, 5, 0, { distanceFt: 60, coneAngle: 10 });
      // halfSpread = 5°. Point at (8, 5) is on axis → hit
      expect(hitTestOverlay(overlay, 8, 5)).toBe(true);
      // Point at (8, 6) is off-axis → miss
      expect(hitTestOverlay(overlay, 8, 6)).toBe(false);
    });

    it('handles cone angle normalization for negative angles', () => {
      const overlay = makeOverlay('cone', 5, 5, -90, { distanceFt: 60, coneAngle: 53 });
      // angle=-90 means cone points along -Y axis. Point at (5, 2) is on the axis.
      expect(hitTestOverlay(overlay, 5, 2)).toBe(true);
    });

    it('handles cone angle normalization for angles > 360', () => {
      const overlay = makeOverlay('cone', 5, 5, 450, { distanceFt: 60, coneAngle: 53 });
      // 450° = 90° (normalized). Cone points along +Y axis.
      expect(hitTestOverlay(overlay, 5, 8)).toBe(true);
    });

    it('handles cone at 180 degrees (pointing left)', () => {
      const overlay = makeOverlay('cone', 5, 5, 180, { distanceFt: 60, coneAngle: 53 });
      expect(hitTestOverlay(overlay, 2, 5)).toBe(true);
    });

    it('handles cone at 270 degrees (pointing up/negative Y)', () => {
      const overlay = makeOverlay('cone', 5, 5, 270, { distanceFt: 60, coneAngle: 53 });
      expect(hitTestOverlay(overlay, 5, 2)).toBe(true);
    });
  });

  // ── LINE ──────────────────────────────────────────────────────

  describe('LINE', () => {
    it('hits the center point of a line (origin)', () => {
      const overlay = makeOverlay('line', 5, 5, 0, { distanceFt: 60, widthFt: 5 });
      expect(hitTestOverlay(overlay, 5, 5)).toBe(true);
    });

    it('hits a point along the line (angle=0, pointing right)', () => {
      const overlay = makeOverlay('line', 5, 5, 0, { distanceFt: 60, widthFt: 5 });
      expect(hitTestOverlay(overlay, 8, 5)).toBe(true);
    });

    it('misses a point beyond the line distance', () => {
      // distanceFt=60 → dist = 480px. 15 cells = 600px > 480px
      const overlay = makeOverlay('line', 5, 5, 0, { distanceFt: 60, widthFt: 5 });
      expect(hitTestOverlay(overlay, 20, 5)).toBe(false);
    });

    it('misses a point behind the line origin', () => {
      // angle=0 means line extends in +X. Point at (2, 5) is behind.
      const overlay = makeOverlay('line', 5, 5, 0, { distanceFt: 60, widthFt: 5 });
      expect(hitTestOverlay(overlay, 2, 5)).toBe(false);
    });

    it('misses a point outside the line width', () => {
      // widthFt=5 → w = (5/5)*40 = 40px. Half-width = 20px.
      // Point at (8, 6) is 40px off-axis > half-width of 20px.
      const overlay = makeOverlay('line', 5, 5, 0, { distanceFt: 60, widthFt: 5 });
      expect(hitTestOverlay(overlay, 8, 6)).toBe(false);
    });

    it('line respects rotation angle', () => {
      // angle=90 means line points along +Y axis.
      const overlay = makeOverlay('line', 5, 5, 90, { distanceFt: 60, widthFt: 5 });
      expect(hitTestOverlay(overlay, 5, 8)).toBe(true);
    });

    it('handles line with widthFt=0 (thin line)', () => {
      const overlay = makeOverlay('line', 5, 5, 0, { distanceFt: 60, widthFt: 0 });
      expect(hitTestOverlay(overlay, 5, 5)).toBe(true);
      // Off-axis point should miss (width = 0)
      expect(hitTestOverlay(overlay, 8, 6)).toBe(false);
    });

    it('handles line with distanceFt=0', () => {
      const overlay = makeOverlay('line', 5, 5, 0, { distanceFt: 0, widthFt: 5 });
      expect(hitTestOverlay(overlay, 5, 5)).toBe(true);
      expect(hitTestOverlay(overlay, 6, 5)).toBe(false);
    });

    it('line hit test works with negative angle', () => {
      const overlay = makeOverlay('line', 5, 5, -90, { distanceFt: 60, widthFt: 5 });
      // angle=-90 means line points along -Y axis.
      expect(hitTestOverlay(overlay, 5, 2)).toBe(true);
    });

    it('line hit test works with 180 degree angle', () => {
      const overlay = makeOverlay('line', 5, 5, 180, { distanceFt: 60, widthFt: 5 });
      expect(hitTestOverlay(overlay, 2, 5)).toBe(true);
    });

    it('line hit test works with diagonal angle', () => {
      const overlay = makeOverlay('line', 5, 5, 45, { distanceFt: 60, widthFt: 10 });
      // Point at (8, 8) is roughly on the 45° diagonal.
      expect(hitTestOverlay(overlay, 8, 8)).toBe(true);
    });

    it('line hit test correctly handles wide line width', () => {
      // widthFt=15 → w = (15/5)*40 = 120px. Half-width = 60px.
      // Point at (8, 6) is 40px off-axis < half-width of 60px.
      const overlay = makeOverlay('line', 5, 5, 0, { distanceFt: 60, widthFt: 15 });
      expect(hitTestOverlay(overlay, 8, 6)).toBe(true);
    });
  });

  // ── DEFAULT (unknown shape) ───────────────────────────────────

  describe('DEFAULT (unknown shape)', () => {
    it('returns false for an unknown shape', () => {
      const overlay = createOverlay('sphere', 5, 5);
      overlay.shape = 'unknown';
      expect(hitTestOverlay(overlay, 5, 5)).toBe(false);
    });

    it('returns false for an empty string shape', () => {
      const overlay = createOverlay('sphere', 5, 5);
      overlay.shape = '';
      expect(hitTestOverlay(overlay, 5, 5)).toBe(false);
    });
  });

  // ── Edge cases across shapes ──────────────────────────────────

  describe('edge cases', () => {
    it('handles negative grid coordinates for hit testing', () => {
      const overlay = makeOverlay('sphere', -3, -3, 0, { radiusFt: 20 });
      expect(hitTestOverlay(overlay, -3, -3)).toBe(true);
    });

    it('handles large grid coordinates', () => {
      const overlay = makeOverlay('sphere', 100, 100, 0, { radiusFt: 20 });
      expect(hitTestOverlay(overlay, 100, 100)).toBe(true);
    });

    it('handles zero grid coordinates', () => {
      const overlay = makeOverlay('sphere', 0, 0, 0, { radiusFt: 20 });
      expect(hitTestOverlay(overlay, 0, 0)).toBe(true);
    });

    it('sphere boundary is inclusive (uses <=)', () => {
      // radiusFt=20 → r = 160px. Exactly 4 cells away = 160px.
      const overlay = makeOverlay('sphere', 5, 5, 0, { radiusFt: 20 });
      expect(hitTestOverlay(overlay, 5, 9)).toBe(true); // 4 cells = 160px
      expect(hitTestOverlay(overlay, 5, 10)).toBe(false); // 5 cells = 200px
    });

    it('cone distance boundary is exclusive (uses >)', () => {
      // distanceFt=20 → dist = 160px. Exactly 4 cells away = 160px (r2 = dist*dist).
      const overlay = makeOverlay('cone', 5, 5, 0, { distanceFt: 20, coneAngle: 180 });
      // r2 = dist*dist → r2 > dist*dist is false, so it passes the distance check
      expect(hitTestOverlay(overlay, 5, 9)).toBe(true);
    });

    it('line start boundary is inclusive (rx >= 0)', () => {
      const overlay = makeOverlay('line', 5, 5, 0, { distanceFt: 60, widthFt: 5 });
      // Origin point (rx = 0) should be hit
      expect(hitTestOverlay(overlay, 5, 5)).toBe(true);
    });

    it('line end boundary is inclusive (rx <= dist)', () => {
      // distanceFt=20 → dist = 160px. Exactly 4 cells away = 160px.
      const overlay = makeOverlay('line', 5, 5, 0, { distanceFt: 20, widthFt: 10 });
      expect(hitTestOverlay(overlay, 9, 5)).toBe(true); // 4 cells = 160px
    });

    it('cube boundary is inclusive (uses >= and <=)', () => {
      // sizeFt=15 → half = 60px. Exactly 1.5 cells away = 60px.
      // Since grid is discrete, test with sizeFt=20 → half = 80px.
      // 2 cells = 80px (exactly on boundary).
      const overlay = makeOverlay('cube', 5, 5, 0, { sizeFt: 20 });
      expect(hitTestOverlay(overlay, 7, 5)).toBe(true); // 2 cells = 80px
    });
  });
});

// ── svgOrigin ───────────────────────────────────────────────────

describe('svgOrigin', () => {
  it('returns the screen coordinates for the overlay origin', () => {
    const overlay = createOverlay('sphere', 3, 4);
    const origin = svgOrigin(overlay);
    // CELL=40, so x = 3*40 + 20 = 140, y = 4*40 + 20 = 180
    expect(origin.x).toBe(140);
    expect(origin.y).toBe(180);
  });

  it('handles zero grid coordinates', () => {
    const overlay = createOverlay('sphere', 0, 0);
    const origin = svgOrigin(overlay);
    expect(origin.x).toBe(20);
    expect(origin.y).toBe(20);
  });

  it('handles negative grid coordinates', () => {
    const overlay = createOverlay('sphere', -1, 2);
    const origin = svgOrigin(overlay);
    expect(origin.x).toBe(-20);
    expect(origin.y).toBe(100);
  });

  it('uses the startGridX and startGridY properties', () => {
    const overlay = createOverlay('cone', 10, 20);
    const origin = svgOrigin(overlay);
    expect(origin.x).toBe(420); // 10*40 + 20
    expect(origin.y).toBe(820); // 20*40 + 20
  });

  it('returns an object with x and y properties', () => {
    const overlay = createOverlay('sphere', 1, 1);
    const origin = svgOrigin(overlay);
    expect(origin).toHaveProperty('x');
    expect(origin).toHaveProperty('y');
    expect(typeof origin.x).toBe('number');
    expect(typeof origin.y).toBe('number');
  });
});
