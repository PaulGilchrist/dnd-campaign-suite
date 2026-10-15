import { describe, it, expect, vi } from 'vitest';
// @maintained-by-ai
// Pure, deterministic geometry contract for SpellOverlay.js: stable shape
// defaults and hit-test math. Needs no churn as the app changes; only
// revisit if the overlay model itself changes shape behaviour.
import { toGrid, createOverlay, hitTestOverlay, svgOrigin, OverlayShape, DEFAULTS, OVERLAY_FILL_ALPHA } from './SpellOverlay.js';

// Grid geometry: CELL = 40px per 5ft grid unit, hit-testing is done in
// screen pixels. Helpers below express positions in feet so each test
// reads as the game rule it verifies instead of raw pixel arithmetic.
const cellAt = (ft) => ft / 5;
const pointAt = (originX, originY, dxFt, dyFt) => [
  originX + cellAt(dxFt),
  originY + cellAt(dyFt),
];

const makeOverlay = (shape, gridX, gridY, angle = 0, params = {}) =>
  createOverlay(shape, gridX, gridY, angle, params);

// ── OverlayShape ───────────────────────────────────────────────────

describe('OverlayShape', () => {
  it('exports all expected shape keys with correct string values', () => {
    expect(OverlayShape.SPHERE).toBe('sphere');
    expect(OverlayShape.CYLINDER).toBe('cylinder');
    expect(OverlayShape.CUBE).toBe('cube');
    expect(OverlayShape.CONE).toBe('cone');
    expect(OverlayShape.LINE).toBe('line');
  });
});

// ── DEFAULTS ───────────────────────────────────────────────────────

describe('DEFAULTS', () => {
  it('has correct default values per shape', () => {
    expect(DEFAULTS.sphere).toEqual({
      radiusFt: 20, coneAngle: 0, widthFt: 0, distanceFt: 0, sizeFt: 0,
      color: `rgba(255,80,60,${OVERLAY_FILL_ALPHA})`,
    });
    expect(DEFAULTS.cylinder).toEqual(DEFAULTS.sphere);
    expect(DEFAULTS.cube).toEqual({
      radiusFt: 0, coneAngle: 0, widthFt: 0, distanceFt: 0, sizeFt: 15,
      color: `rgba(255,80,60,${OVERLAY_FILL_ALPHA})`,
    });
    expect(DEFAULTS.cone).toEqual({
      radiusFt: 0, coneAngle: 53, widthFt: 0, distanceFt: 60, sizeFt: 0,
      color: `rgba(255,80,60,${OVERLAY_FILL_ALPHA})`,
    });
    expect(DEFAULTS.line).toEqual({
      radiusFt: 0, coneAngle: 0, widthFt: 5, distanceFt: 60, sizeFt: 0,
      color: `rgba(255,80,60,${OVERLAY_FILL_ALPHA})`,
    });
  });
});

// ── toGrid ─────────────────────────────────────────────────────────

describe('toGrid', () => {
  it('converts feet to grid units by dividing by 5', () => {
    expect(toGrid(5)).toBe(1);
    expect(toGrid(10)).toBe(2);
    expect(toGrid(20)).toBe(4);
    expect(toGrid(45)).toBe(9);
    expect(toGrid(60)).toBe(12);
  });

  it('handles zero, negative, fractional, and NaN input', () => {
    expect(toGrid(0)).toBe(0);
    expect(toGrid(-10)).toBe(-2);
    expect(toGrid(2.5)).toBe(0.5);
    expect(toGrid(NaN)).toBeNaN();
  });
});

// ── createOverlay ──────────────────────────────────────────────────

describe('createOverlay', () => {
  it('creates an overlay with shape, position, angle, UUID, and defaults', () => {
    const uuidSpy = vi.spyOn(crypto, 'randomUUID').mockReturnValueOnce('mock-uuid-1');
    const overlay = makeOverlay('sphere', 3, 4);
    expect(overlay.id).toBe('mock-uuid-1');
    expect(overlay.shape).toBe('sphere');
    expect(overlay.startGridX).toBe(3);
    expect(overlay.startGridY).toBe(4);
    expect(overlay.angle).toBe(0);
    expect(overlay.radiusFt).toBe(20);
    expect(overlay.color).toBe(`rgba(255,80,60,${OVERLAY_FILL_ALPHA})`);
    uuidSpy.mockRestore();
  });

  it('assigns a unique id to each overlay', () => {
    let counter = 0;
    const uuidSpy = vi.spyOn(crypto, 'randomUUID').mockImplementation(() => `id-${counter++}`);
    const a = makeOverlay('sphere', 0, 0);
    const b = makeOverlay('sphere', 0, 0);
    uuidSpy.mockRestore();
    expect(a.id).not.toBe(b.id);
  });

  it('uses shape-specific defaults and allows param overrides', () => {
    const cone = makeOverlay('cone', 1, 1, 0, { distanceFt: 30 });
    expect(cone.distanceFt).toBe(30);
    expect(cone.coneAngle).toBe(53);
    expect(cone.radiusFt).toBe(0);

    const cube = makeOverlay('cube', 1, 1);
    expect(cube.sizeFt).toBe(15);
    expect(cube.radiusFt).toBe(0);

    const line = makeOverlay('line', 1, 1);
    expect(line.distanceFt).toBe(60);
    expect(line.widthFt).toBe(5);
  });

  it('accepts a custom angle parameter', () => {
    expect(makeOverlay('sphere', 0, 0, 45).angle).toBe(45);
  });

  it('keeps position, angle, and explicit params for unknown shapes', () => {
    const overlay = createOverlay('bogus', 1, 2, 90, { radiusFt: 5 });
    expect(overlay.shape).toBe('bogus');
    expect(overlay.startGridX).toBe(1);
    expect(overlay.startGridY).toBe(2);
    expect(overlay.angle).toBe(90);
    expect(overlay.radiusFt).toBe(5);
    expect(overlay).not.toHaveProperty('color');
    expect(overlay).not.toHaveProperty('coneAngle');
  });
});

// ── hitTestOverlay ─────────────────────────────────────────────────

describe('hitTestOverlay', () => {
  // ── SPHERE ────────────────────────────────────────────────────────

  describe('SPHERE', () => {
    it('hits center and points within radius, misses outside', () => {
      expect(hitTestOverlay(makeOverlay('sphere', 5, 5, 0, { radiusFt: 20 }), 5, 5)).toBe(true);
      const [withinX, withinY] = pointAt(5, 5, 15, 0);
      expect(hitTestOverlay(makeOverlay('sphere', 5, 5, 0, { radiusFt: 20 }), withinX, withinY)).toBe(true);
      const [outsideX, outsideY] = pointAt(5, 5, 25, 0);
      expect(hitTestOverlay(makeOverlay('sphere', 5, 5, 0, { radiusFt: 20 }), outsideX, outsideY)).toBe(false);
    });

    it('hits exactly at radius boundary, misses just beyond', () => {
      const [x, y] = pointAt(5, 5, 25, 0);
      expect(hitTestOverlay(makeOverlay('sphere', 5, 5, 0, { radiusFt: 25 }), x, y)).toBe(true);
      expect(hitTestOverlay(makeOverlay('sphere', 5, 5, 0, { radiusFt: 24 }), x, y)).toBe(false);
    });

    it('is unaffected by rotation angle', () => {
      const unrotated = makeOverlay('sphere', 5, 5, 0, { radiusFt: 20 });
      const rotated = makeOverlay('sphere', 5, 5, 90, { radiusFt: 20 });
      const [fwdX, fwdY] = pointAt(5, 5, 15, 0);
      const [sideX, sideY] = pointAt(5, 5, 0, 15);
      expect(hitTestOverlay(rotated, fwdX, fwdY)).toBe(hitTestOverlay(unrotated, fwdX, fwdY));
      expect(hitTestOverlay(rotated, sideX, sideY)).toBe(hitTestOverlay(unrotated, sideX, sideY));
    });
  });

  // ── CYLINDER ──────────────────────────────────────────────────────

  describe('CYLINDER', () => {
    it('behaves identically to sphere for hit testing', () => {
      const sphere = makeOverlay('sphere', 5, 5, 0, { radiusFt: 20 });
      const cylinder = makeOverlay('cylinder', 5, 5, 0, { radiusFt: 20 });
      const [x, y] = pointAt(5, 5, 15, 0);
      const [outsideX, outsideY] = pointAt(5, 5, 25, 0);
      expect(hitTestOverlay(sphere, 5, 5)).toBe(hitTestOverlay(cylinder, 5, 5));
      expect(hitTestOverlay(sphere, x, y)).toBe(hitTestOverlay(cylinder, x, y));
      expect(hitTestOverlay(sphere, outsideX, outsideY)).toBe(hitTestOverlay(cylinder, outsideX, outsideY));
    });
  });

  // ── CUBE ─────────────────────────────────────────────────────────

  describe('CUBE', () => {
    it('hits center and points within bounds, misses outside', () => {
      const overlay = makeOverlay('cube', 5, 5, 0, { sizeFt: 15 });
      expect(hitTestOverlay(overlay, 5, 5)).toBe(true);
      const [withinX, withinY] = pointAt(5, 5, 5, 0);
      expect(hitTestOverlay(overlay, withinX, withinY)).toBe(true);
      const [outsideX, outsideY] = pointAt(5, 5, 10, 0);
      expect(hitTestOverlay(makeOverlay('cube', 5, 5, 0, { sizeFt: 15 }), outsideX, outsideY)).toBe(false);
    });

    it('hits exactly at size boundary, misses just beyond', () => {
      // sizeFt=10 => half-extent is 5ft. Point at 5ft is on boundary.
      const [x, y] = pointAt(5, 5, 5, 0);
      expect(hitTestOverlay(makeOverlay('cube', 5, 5, 0, { sizeFt: 10 }), x, y)).toBe(true);
      // Point at 5.1ft is just beyond boundary
      const [justBeyondX, justBeyondY] = pointAt(5, 5, 5.1, 0);
      expect(hitTestOverlay(makeOverlay('cube', 5, 5, 0, { sizeFt: 10 }), justBeyondX, justBeyondY)).toBe(false);
    });

    it('45° rotation shifts which axis and diagonal points are hit', () => {
      // sizeFt=20 => half-extent is 10ft. A point 12.5ft along the axis
      // misses the unrotated cube but sits inside the cube rotated 45°,
      // whose corner reaches ~14.1ft along that axis. Conversely, a point
      // 8.75ft forward and 8.75ft sideways sits inside the unrotated
      // square (both < half-extent) but escapes the rotated square.
      const rotated = makeOverlay('cube', 5, 5, 45, { sizeFt: 20 });
      const unrotated = makeOverlay('cube', 5, 5, 0, { sizeFt: 20 });
      const [axisX, axisY] = pointAt(5, 5, 12.5, 0);
      expect(hitTestOverlay(rotated, axisX, axisY)).toBe(true);
      expect(hitTestOverlay(unrotated, axisX, axisY)).toBe(false);
      const [diagX, diagY] = pointAt(5, 5, 8.75, 8.75);
      expect(hitTestOverlay(rotated, diagX, diagY)).toBe(false);
      expect(hitTestOverlay(unrotated, diagX, diagY)).toBe(true);
    });
  });

  // ── CONE ─────────────────────────────────────────────────────────

  describe('CONE', () => {
    it('hits center and points within distance and angle on cone axis', () => {
      expect(hitTestOverlay(makeOverlay('cone', 5, 5, 0, { distanceFt: 60, coneAngle: 53 }), 5, 5)).toBe(true);
      const [x, y] = pointAt(5, 5, 15, 0);
      expect(hitTestOverlay(makeOverlay('cone', 5, 5, 0, { distanceFt: 60, coneAngle: 53 }), x, y)).toBe(true);
    });

    it('hits exactly at distance boundary, misses just beyond', () => {
      const [x, y] = pointAt(5, 5, 60, 0);
      expect(hitTestOverlay(makeOverlay('cone', 5, 5, 0, { distanceFt: 60, coneAngle: 53 }), x, y)).toBe(true);
      expect(hitTestOverlay(makeOverlay('cone', 5, 5, 0, { distanceFt: 59 }), x, y)).toBe(false);
    });

    it('misses points outside the cone angle', () => {
      const [x, y] = pointAt(5, 5, 15, 15);
      expect(hitTestOverlay(makeOverlay('cone', 5, 5, 0, { distanceFt: 60, coneAngle: 53 }), x, y)).toBe(false);
    });

    it('hits exactly at cone angle edge', () => {
      // coneAngle=90 => half-spread of 45°. A point 35ft forward and
      // 35ft sideways is exactly on the 45° edge and within distance.
      const [x, y] = pointAt(5, 5, 35, 35);
      expect(hitTestOverlay(makeOverlay('cone', 5, 5, 0, { distanceFt: 60, coneAngle: 90 }), x, y)).toBe(true);
    });

    it('respects rotation angle', () => {
      const [x, y] = pointAt(5, 5, 0, 15);
      expect(hitTestOverlay(makeOverlay('cone', 5, 5, 90, { distanceFt: 60, coneAngle: 53 }), x, y)).toBe(true);
    });
  });

  // ── LINE ─────────────────────────────────────────────────────────

  describe('LINE', () => {
    it('hits center and points along the line at angle=0', () => {
      expect(hitTestOverlay(makeOverlay('line', 5, 5, 0, { distanceFt: 60, widthFt: 5 }), 5, 5)).toBe(true);
      const [x, y] = pointAt(5, 5, 15, 0);
      expect(hitTestOverlay(makeOverlay('line', 5, 5, 0, { distanceFt: 60, widthFt: 5 }), x, y)).toBe(true);
    });

    it('hits exactly at far end, misses past it', () => {
      const [x, y] = pointAt(5, 5, 60, 0);
      expect(hitTestOverlay(makeOverlay('line', 5, 5, 0, { distanceFt: 60, widthFt: 5 }), x, y)).toBe(true);
      expect(hitTestOverlay(makeOverlay('line', 5, 5, 0, { distanceFt: 59 }), x, y)).toBe(false);
    });

    it('misses points behind the line origin', () => {
      const [x, y] = pointAt(5, 5, -15, 0);
      expect(hitTestOverlay(makeOverlay('line', 5, 5, 0, { distanceFt: 60, widthFt: 5 }), x, y)).toBe(false);
    });

    it('misses points outside the line width', () => {
      const [x, y] = pointAt(5, 5, 15, 5);
      expect(hitTestOverlay(makeOverlay('line', 5, 5, 0, { distanceFt: 60, widthFt: 5 }), x, y)).toBe(false);
    });

    it('respects rotation angle and 180-degree rotation', () => {
      const [x, y] = pointAt(5, 5, 0, 15);
      expect(hitTestOverlay(makeOverlay('line', 5, 5, 90, { distanceFt: 60, widthFt: 5 }), x, y)).toBe(true);
      const [behindX, behindY] = pointAt(5, 5, -15, 0);
      const rotated = makeOverlay('line', 5, 5, 180, { distanceFt: 60, widthFt: 5 });
      expect(hitTestOverlay(rotated, behindX, behindY)).toBe(true);
    });
  });

  // ── Unknown shapes ────────────────────────────────────────────────

  describe('unknown shape', () => {
    it('returns false for unknown, empty, or missing shape values', () => {
      for (const shape of ['unknown', '', undefined, null]) {
        const overlay = createOverlay('sphere', 5, 5);
        overlay.shape = shape;
        expect(hitTestOverlay(overlay, 5, 5)).toBe(false);
      }
    });
  });
});

// ── svgOrigin ──────────────────────────────────────────────────────
// CELL = 40px; origin maps each grid cell to its center (grid * 40 + 20).

describe('svgOrigin', () => {
  it('returns screen coordinates for the overlay origin at various grid positions', () => {
    expect(svgOrigin(createOverlay('sphere', 3, 4))).toEqual({ x: 140, y: 180 });
    expect(svgOrigin(createOverlay('sphere', -1, 2))).toEqual({ x: -20, y: 100 });
    expect(svgOrigin(createOverlay('sphere', 0, 0))).toEqual({ x: 20, y: 20 });
  });
});
