// @maintained-by-ai
import { describe, it, expect } from 'vitest';
import {
    noiseAt,
    elevationAt,
    ridgeWeight,
    quantizeElevation,
    contourShade,
    collectRelief,
    chainRiverHexes,
    weatherParticlesFor,
    poiShapeSpec,
    labelSpriteLayout,
    TERRAIN_BASE,
    TERRAIN_RELIEF,
    CONTOUR_BAND,
} from './hex3dScene.js';
import { TERRAIN_TYPES, POI_TYPES, DEFAULT_TERRAIN } from '../../../config/outdoorConfig.js';

// Pure-lane unit tests for the hex 3D scene: everything the class builds on
// that needs no WebGL. Geometry/lifecycle is smoke-tested live (same posture
// as the indoor map3dScene), so only the deterministic helpers are pinned
// here. three.js is never imported (init()'s dynamic import never runs).

describe('elevation model', () => {
    it('defines base + relief for every authored terrain type, mountains highest and water lowest', () => {
        for (const t of TERRAIN_TYPES) {
            expect(TERRAIN_BASE[t.id], `base for ${t.id}`).toBeTypeOf('number');
            expect(TERRAIN_RELIEF[t.id], `relief for ${t.id}`).toBeTypeOf('number');
        }
        const bases = Object.values(TERRAIN_BASE);
        expect(TERRAIN_BASE.mountains).toBe(Math.max(...bases));
        expect(TERRAIN_BASE.water).toBe(Math.min(...bases));
    });

    it('noiseAt is deterministic and bounded to [0,1)', () => {
        expect(noiseAt(3, 4)).toBe(noiseAt(3, 4));
        expect(noiseAt(3, 4)).not.toBe(noiseAt(9, -2));
        for (let q = 0; q < 12; q++) {
            for (let r = 0; r < 12; r++) {
                const v = noiseAt(q, r);
                expect(v).toBeGreaterThanOrEqual(0);
                expect(v).toBeLessThan(1);
            }
        }
    });

    it('elevationAt stays within base ± relief and defaults unknown ids', () => {
        for (let q = 0; q < 8; q++) {
            const e = elevationAt('mountains', q, 2);
            expect(e).toBeGreaterThanOrEqual(TERRAIN_BASE.mountains - TERRAIN_RELIEF.mountains);
            expect(e).toBeLessThanOrEqual(TERRAIN_BASE.mountains + TERRAIN_RELIEF.mountains);
        }
        expect(elevationAt('astral-sea', 1, 1)).toBeCloseTo(elevationAt(DEFAULT_TERRAIN, 1, 1));
        expect(elevationAt(undefined, 1, 1)).toBeCloseTo(elevationAt(DEFAULT_TERRAIN, 1, 1));
    });

    it('ridgeWeight corrugates only spines: 1 in a massif, 0 on the flat', () => {
        const massif = { '5,5': 'mountains', '5,6': 'mountains', '6,5': 'hills' };
        expect(ridgeWeight(5, 5, massif)).toBe(1);          // mountain with mountain neighbours
        expect(ridgeWeight(6, 5, massif)).toBeCloseTo(0.55); // hill riding the spine's shoulder
        expect(ridgeWeight(7, 5, massif)).toBe(0);           // one step too far — flat
        expect(ridgeWeight(0, 0, {})).toBe(0);               // open plains — flat
    });

    it('quantizeElevation terraces onto CONTOUR_BAND steps (the contour lines)', () => {
        expect(quantizeElevation(0)).toBe(CONTOUR_BAND / 2); // floored, never below zero
        expect(quantizeElevation(-40)).toBe(CONTOUR_BAND / 2);
        expect(quantizeElevation(CONTOUR_BAND * 3 + 3) % CONTOUR_BAND).toBe(CONTOUR_BAND / 2);
        // Monotone: higher input never lowers the terrace.
        let prev = -1;
        for (let e = 0; e <= 200; e += 3) {
            const y = quantizeElevation(e);
            expect(y).toBeGreaterThanOrEqual(prev);
            prev = y;
        }
    });

    it('contourShade darkens alternate terrace bands', () => {
        const even = contourShade(quantizeElevation(TERRAIN_BASE.plains));
        const nextBand = contourShade(quantizeElevation(TERRAIN_BASE.plains) + CONTOUR_BAND);
        const sameBand = contourShade(quantizeElevation(TERRAIN_BASE.plains) + 2);
        expect(even).toBe(sameBand);
        expect(nextBand).not.toBe(even);
        expect(Math.min(even, nextBand)).toBeGreaterThan(0.5);
        expect(Math.max(even, nextBand)).toBe(1);
    });
});

describe('collectRelief', () => {
    it('produces one center per hex with terraced-ready samples', () => {
        const { centers } = collectRelief(4, 3, { '1,1': 'mountains' });
        expect(centers.size).toBe(12);
        const peak = centers.get('1,1');
        expect(peak.id).toBe('mountains');
        expect(peak.e).toBeCloseTo(elevationAt('mountains', 1, 1, { '1,1': 'mountains' }));
        expect(peak.rgb.r).toBeGreaterThan(0);
        // Unset hexes default to plains terrain.
        expect(centers.get('0,0').id).toBe(DEFAULT_TERRAIN);
    });

    it('merges shared hex corners into multi-sample lists (topography continuity)', () => {
        const { corners } = collectRelief(3, 3, {});
        const counts = [...corners.values()].map((s) => s.length);
        // Interior junctions merge (2–3 hexes meet); border tips stand alone.
        expect(counts.some((n) => n > 1)).toBe(true);
        expect(counts.some((n) => n === 1)).toBe(true);
        expect(Math.max(...counts)).toBeLessThanOrEqual(3);
        // Conservation: every hex contributes exactly 6 corner samples.
        expect(counts.reduce((a, b) => a + b, 0)).toBe(9 * 6);
    });
});

describe('weatherParticlesFor', () => {
    it('maps the weatherService icons to the particle lanes', () => {
        expect(weatherParticlesFor({ icon: 'cloud-rain' })).toBe('rain');
        expect(weatherParticlesFor({ icon: 'bolt' })).toBe('rain');
        expect(weatherParticlesFor({ icon: 'snowflake' })).toBe('snow');
        expect(weatherParticlesFor({ icon: 'smog' })).toBe('fog');
    });

    it('keeps clear/cloudy/wind/extreme skies particle-free', () => {
        expect(weatherParticlesFor({ icon: 'sun' })).toBeNull();
        expect(weatherParticlesFor({ icon: 'cloud' })).toBeNull();
        expect(weatherParticlesFor({ icon: 'wind' })).toBeNull();
        expect(weatherParticlesFor({ icon: 'triangle-exclamation' })).toBeNull();
        expect(weatherParticlesFor(null)).toBeNull();
        expect(weatherParticlesFor(undefined)).toBeNull();
    });
});

describe('poiShapeSpec', () => {
    it('gives every POI_TYPES id a non-empty, well-formed part list', () => {
        for (const poi of POI_TYPES) {
            const parts = poiShapeSpec(poi.id);
            expect(parts.length, `parts for ${poi.id}`).toBeGreaterThan(0);
            for (const part of parts) {
                expect(['cone', 'cylinder', 'box']).toContain(part.shape);
                expect(part.cy).toBeTypeOf('number');
                expect(part.h).toBeGreaterThan(0);
                expect(part.color).toBeTypeOf('number');
            }
        }
    });

    it('falls back to a grey box for unknown types (never an empty group)', () => {
        const parts = poiShapeSpec('void-gate');
        expect(parts).toHaveLength(1);
        expect(parts[0].shape).toBe('box');
    });
});

describe('chainRiverHexes', () => {
    it('flood-fills connected keys into ONE ordered chain', () => {
        const chains = chainRiverHexes(['0,0', '1,0', '2,0'], 10, 10);
        expect(chains).toHaveLength(1);
        expect(chains[0]).toEqual([{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }]);
    });

    it('keeps disconnected groups as separate chains', () => {
        const chains = chainRiverHexes(['0,0', '1,0', '7,7'], 10, 10);
        expect(chains).toHaveLength(2);
        const sizes = chains.map((c) => c.length).sort();
        expect(sizes).toEqual([1, 2]);
    });

    it('leaves isolated hexes as length-1 chains (pool lane)', () => {
        const chains = chainRiverHexes(['4,4'], 10, 10);
        expect(chains).toEqual([[{ q: 4, r: 4 }]]);
    });

    it('ignores out-of-bounds neighbours and tolerates empty input', () => {
        const chains = chainRiverHexes(['0,0', '0,1'], 1, 10);
        expect(chains).toHaveLength(1);
        expect(chains[0]).toHaveLength(2);
        expect(chainRiverHexes([], 10, 10)).toEqual([]);
        expect(chainRiverHexes(undefined, 10, 10)).toEqual([]);
    });
});

describe('labelSpriteLayout', () => {
    // The clip regression (CV 2026-11-05): names wider than the old fixed
    // 512px canvas lost their first/last glyphs ("he Watcher Ston").

    it('keeps the legacy 512×128 canvas + 64×16 sprite for short names', () => {
        const l = labelSpriteLayout(200);
        expect(l.canvasWidth).toBe(512);
        expect(l.canvasHeight).toBe(128);
        expect(l.centerX).toBe(256);
        expect(l.centerY).toBe(64);
        expect(l.spriteScaleX).toBe(64);
        expect(l.spriteScaleY).toBe(16);
    });

    it('widens the canvas past text + outline + padding for long names', () => {
        const l = labelSpriteLayout(620); // "The Watcher Stone" at bold 64px
        expect(l.canvasWidth).toBeGreaterThanOrEqual(620 + 10 + 24 * 2);
        expect(l.centerX).toBe(l.canvasWidth / 2);
        // Half the outline + padding survives on each side of the glyphs.
        expect(l.centerX - 620 / 2).toBeGreaterThanOrEqual(24 + 5);
    });

    it('keeps sprite aspect proportional to canvas aspect (no stretch, constant glyph height)', () => {
        for (const w of [100, 512, 620, 1200]) {
            const l = labelSpriteLayout(w);
            expect(l.spriteScaleX / l.spriteScaleY).toBeCloseTo(l.canvasWidth / l.canvasHeight, 6);
            expect(l.spriteScaleY).toBe(16);
        }
    });

    it('is monotone: a wider measurement never shrinks the canvas', () => {
        let prev = 0;
        for (let w = 0; w <= 1500; w += 37) {
            const l = labelSpriteLayout(w);
            expect(l.canvasWidth).toBeGreaterThanOrEqual(prev);
            prev = l.canvasWidth;
        }
    });
});
