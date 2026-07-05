// @cleaned-by-ai
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
  it('has entries for all five shapes', () => {
    expect(Object.keys(DEFAULTS)).toEqual(['sphere', 'cylinder', 'cube', 'cone', 'line']);
  });
});

// ── toGrid ──────────────────────────────────────────────────────

describe('toGrid', () => {
  it('converts feet to grid units by dividing by 5', () => {
    expect(toGrid(5)).toBe(1);
    expect(toGrid(10)).toBe(2);
    expect(toGrid(20)).toBe(4);
    expect(toGrid(60)).toBe(12);
    expect(toGrid(0)).toBe(0);
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
});

// ── hitTestOverlay ──────────────────────────────────────────────

describe('hitTestOverlay', () => {
  function makeOverlay(shape, gridX, gridY, angle, params = {}) {
    return createOverlay(shape, gridX, gridY, angle, params);
  }

  // ── SPHERE / CYLINDER (shared code path) ──────────────────────

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

    it('only hits the center when radiusFt=0', () => {
      const overlay = makeOverlay('sphere', 5, 5, 0, { radiusFt: 0 });
      expect(hitTestOverlay(overlay, 5, 5)).toBe(true);
      expect(hitTestOverlay(overlay, 6, 5)).toBe(false);
    });

    it('works with negative grid coordinates', () => {
      const overlay = makeOverlay('sphere', -3, -3, 0, { radiusFt: 5 });
      expect(hitTestOverlay(overlay, -3, -3)).toBe(true);
      expect(hitTestOverlay(overlay, -2, -4)).toBe(false);
    });
  });

  describe('CYLINDER', () => {
    it('shares the same geometry as sphere (hits center, misses outside)', () => {
      const overlay = makeOverlay('cylinder', 5, 5, 0, { radiusFt: 20 });
      expect(hitTestOverlay(overlay, 5, 5)).toBe(true);
      expect(hitTestOverlay(overlay, 5, 10)).toBe(false);
    });
  });

  // ── CUBE ──────────────────────────────────────────────────────

  describe('CUBE', () => {
    it('hits the center and points within bounds', () => {
      const overlay = makeOverlay('cube', 5, 5, 0, { sizeFt: 15 });
      expect(hitTestOverlay(overlay, 5, 5)).toBe(true);
      expect(hitTestOverlay(overlay, 6, 5)).toBe(true);
    });

    it('misses points outside the cube bounds', () => {
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
  });

  // ── CONE ──────────────────────────────────────────────────────

  describe('CONE', () => {
    it('hits the center point (origin)', () => {
      const overlay = makeOverlay('cone', 5, 5, 0, { distanceFt: 60, coneAngle: 53 });
      expect(hitTestOverlay(overlay, 5, 5)).toBe(true);
    });

    it('hits a point within distance and angle on the cone axis', () => {
      const overlay = makeOverlay('cone', 5, 5, 0, { distanceFt: 60, coneAngle: 53 });
      expect(hitTestOverlay(overlay, 8, 5)).toBe(true);
    });

    it('misses points beyond the cone distance', () => {
      const overlay = makeOverlay('cone', 5, 5, 0, { distanceFt: 60, coneAngle: 53 });
      expect(hitTestOverlay(overlay, 20, 5)).toBe(false);
    });

    it('misses points outside the cone angle', () => {
      const overlay = makeOverlay('cone', 5, 5, 0, { distanceFt: 60, coneAngle: 53 });
      expect(hitTestOverlay(overlay, 8, 8)).toBe(false);
    });

    it('respects rotation angle', () => {
      const overlay = makeOverlay('cone', 5, 5, 90, { distanceFt: 60, coneAngle: 53 });
      expect(hitTestOverlay(overlay, 5, 8)).toBe(true);
    });

    it('only hits the origin when distanceFt=0', () => {
      const overlay = makeOverlay('cone', 5, 5, 0, { distanceFt: 0, coneAngle: 53 });
      expect(hitTestOverlay(overlay, 5, 5)).toBe(true);
      expect(hitTestOverlay(overlay, 6, 5)).toBe(false);
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
      const overlay = makeOverlay('line', 5, 5, 0, { distanceFt: 60, widthFt: 5 });
      expect(hitTestOverlay(overlay, 20, 5)).toBe(false);
    });

    it('misses points behind the line origin', () => {
      const overlay = makeOverlay('line', 5, 5, 0, { distanceFt: 60, widthFt: 5 });
      expect(hitTestOverlay(overlay, 2, 5)).toBe(false);
    });

    it('misses points outside the line width', () => {
      const overlay = makeOverlay('line', 5, 5, 0, { distanceFt: 60, widthFt: 5 });
      expect(hitTestOverlay(overlay, 8, 6)).toBe(false);
    });

    it('respects rotation angle', () => {
      const overlay = makeOverlay('line', 5, 5, 90, { distanceFt: 60, widthFt: 5 });
      expect(hitTestOverlay(overlay, 5, 8)).toBe(true);
    });

    it('only hits the origin when widthFt=0 or distanceFt=0', () => {
      const w0 = makeOverlay('line', 5, 5, 0, { distanceFt: 60, widthFt: 0 });
      expect(hitTestOverlay(w0, 5, 5)).toBe(true);
      expect(hitTestOverlay(w0, 8, 6)).toBe(false);

      const d0 = makeOverlay('line', 5, 5, 0, { distanceFt: 0, widthFt: 5 });
      expect(hitTestOverlay(d0, 5, 5)).toBe(true);
      expect(hitTestOverlay(d0, 6, 5)).toBe(false);
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
});

// ── svgOrigin ───────────────────────────────────────────────────

describe('svgOrigin', () => {
  it('returns screen coordinates for the overlay origin', () => {
    const overlay = createOverlay('sphere', 3, 4);
    const origin = svgOrigin(overlay);
    expect(origin).toEqual({ x: 140, y: 180 });
  });

  it('handles negative grid coordinates', () => {
    const overlay = createOverlay('sphere', -1, 2);
    expect(svgOrigin(overlay)).toEqual({ x: -20, y: 100 });
  });
});
