// @maintained-by-ai
// Lane: overlay SHAPE -> exact 3D scene-graph bytes using REAL THREE (geometry,
// material, outline, group transform of one createOverlayGroup call).
// Distinct seams: useSpellHandlers #913 (2D draft + shapeParams bytes),
// sseHandlers-overlay #873 (SSE payload bodies), useSpellOverlay #914 (persistence),
// Map3D.test.jsx #925 (verbatim overlays-prop forwarding; THREE never loaded there).
// Update/remove/dispose semantics live in the map3dScene rebuild lane, not here.
// Goldens #815: expected bytes are literals hand-derived ONCE from the fixtures
// (1 ft = 8 units; EFFECT_HEIGHT = 80 units = 10 ft), never re-run source formulas.
import * as THREE from 'three';
import { describe, it, expect, vi } from 'vitest';
import { createOverlayGroup, parseOverlayColor } from './map3dSpellOverlays.js';
import { OverlayShape } from '../../../models/SpellOverlay.js';

// rgba(255,80,60,·) converted sRGB->linear: g = ((80/255+0.055)/1.055)^2.4,
// b = ((60/255+0.055)/1.055)^2.4, r = 1 (hand-derived golden, #815).
const GOLDEN_LINEAR_RGB = [1, 0.080220, 0.045186];

const expectGoldenColor = (color) => {
    expect(color.r).toBeCloseTo(GOLDEN_LINEAR_RGB[0], 5);
    expect(color.g).toBeCloseTo(GOLDEN_LINEAR_RGB[1], 5);
    expect(color.b).toBeCloseTo(GOLDEN_LINEAR_RGB[2], 5);
};

const makeOverlay = (overrides = {}) => ({
    id: 'o1',
    shape: OverlayShape.SPHERE,
    startGridX: 2,
    startGridY: 3,
    angle: 0,
    radiusFt: 20,
    coneAngle: 0,
    widthFt: 0,
    distanceFt: 0,
    sizeFt: 0,
    color: 'rgba(255,80,60,0.35)',
    ...overrides,
});

// Each row: fixture overrides + every byte the builder must emit in local space
// (+X east, +Z south, +Y up; ft x 8 = units; cones: apex at origin, opens +X).
const SHAPE_CASES = [
    {
        name: 'sphere (no outline, floor-centered)',
        overlay: {},
        x: 100, z: -50,
        rotationY: 0,
        meshType: 'SphereGeometry',
        params: { radius: 160 }, // 20 ft
        bboxMin: [-160, -160, -160],
        bboxMax: [160, 160, 160],
        outline: false,
    },
    {
        name: 'cylinder (floor to EFFECT_HEIGHT, outlined)',
        overlay: { shape: OverlayShape.CYLINDER },
        x: 0, z: 0,
        rotationY: 0,
        meshType: 'CylinderGeometry',
        params: { radiusTop: 160, radiusBottom: 160, height: 80 },
        bboxMin: [-160, 0, -160],
        bboxMax: [160, 80, 160],
        outline: true,
    },
    {
        name: 'cube (size^3 on floor, angle 90 -> rotation.y = -PI/2)',
        overlay: { shape: OverlayShape.CUBE, sizeFt: 15, angle: 90 },
        x: 0, z: 0,
        rotationY: -1.5708,
        meshType: 'BoxGeometry',
        params: { width: 120, height: 120, depth: 120 }, // 15 ft
        bboxMin: [-60, 0, -60],
        bboxMax: [60, 120, 60],
        outline: true,
    },
    {
        name: 'cone 60deg (apex at origin)',
        overlay: { shape: OverlayShape.CONE, distanceFt: 60, coneAngle: 60 },
        x: 0, z: 0,
        rotationY: 0,
        meshType: 'ConeGeometry',
        params: { height: 480, radius: 277.12813 }, // 480 x tan(30deg)
        bboxMin: [0, -277.128, -277.128],
        bboxMax: [480, 277.128, 277.128],
        outline: true,
    },
    {
        name: 'cone 270deg (base radius capped at distance)',
        overlay: { shape: OverlayShape.CONE, distanceFt: 60, coneAngle: 270 },
        x: 0, z: 0,
        rotationY: 0,
        meshType: 'ConeGeometry',
        params: { height: 480, radius: 480 },
        bboxMin: [0, -480, -480],
        bboxMax: [480, 480, 480],
        outline: true,
    },
    {
        name: 'cone 360deg (full cylinder fallback)',
        overlay: { shape: OverlayShape.CONE, distanceFt: 60, coneAngle: 360 },
        x: 0, z: 0,
        rotationY: 0,
        meshType: 'CylinderGeometry',
        params: { radiusTop: 480, radiusBottom: 480, height: 80 },
        bboxMin: [-480, 0, -480],
        bboxMax: [480, 80, 480],
        outline: true,
    },
    {
        name: 'line (beam along +X)',
        overlay: { shape: OverlayShape.LINE, distanceFt: 60, widthFt: 5 },
        x: 0, z: 0,
        rotationY: 0,
        meshType: 'BoxGeometry',
        params: { width: 480, height: 80, depth: 40 }, // 60 ft long, 5 ft wide
        bboxMin: [0, 0, -20],
        bboxMax: [480, 80, 20],
        outline: true,
    },
];

describe('createOverlayGroup', () => {
    it.each(SHAPE_CASES)(
        'builds $name with exact geometry, material, outline, and group bytes',
        ({ overlay, x, z, rotationY, meshType, params, bboxMin, bboxMax, outline }) => {
            const group = createOverlayGroup(THREE, makeOverlay(overlay), x, z);

            expect(group.position.toArray()).toEqual([x, 0, z]);
            expect(group.rotation.y).toBeCloseTo(rotationY, 4);

            const mesh = group.children[0];
            expect(mesh).toBeInstanceOf(THREE.Mesh);
            expect(mesh.geometry.type).toBe(meshType);
            for (const [key, expected] of Object.entries(params)) {
                expect(mesh.geometry.parameters[key]).toBeCloseTo(expected, 4);
            }
            mesh.geometry.computeBoundingBox();
            const min = mesh.geometry.boundingBox.min.toArray();
            const max = mesh.geometry.boundingBox.max.toArray();
            bboxMin.forEach((v, i) => expect(min[i]).toBeCloseTo(v, 3));
            bboxMax.forEach((v, i) => expect(max[i]).toBeCloseTo(v, 3));

            const material = mesh.material;
            expect(material).toBeInstanceOf(THREE.MeshBasicMaterial);
            expectGoldenColor(material.color);
            expect(material.transparent).toBe(true);
            expect(material.opacity).toBeCloseTo(0.35);
            expect(material.depthTest).toBe(false);
            expect(material.depthWrite).toBe(false);
            expect(material.side).toBe(THREE.DoubleSide);
            expect(mesh.renderOrder).toBe(1001);

            if (outline) {
                expect(group.children).toHaveLength(2);
                const line = group.children[1];
                expect(line).toBeInstanceOf(THREE.LineSegments);
                expect(line.geometry.type).toBe('EdgesGeometry');
                expectGoldenColor(line.material.color);
                expect(line.material.opacity).toBeCloseTo(0.2);
                expect(line.renderOrder).toBe(1002);
            } else {
                expect(group.children).toHaveLength(1);
            }
        }
    );

    it('returns null for a missing overlay or unknown shape without throwing', () => {
        expect(createOverlayGroup(THREE, null, 0, 0)).toBeNull();
        expect(createOverlayGroup(THREE, makeOverlay({ shape: 'hexagon' }), 0, 0)).toBeNull();
    });
});

describe('parseOverlayColor', () => {
    it.each([
        { label: 'parses valid rgba to the golden linear color and alpha', input: 'rgba(255,80,60,0.35)', alpha: 0.35, errors: false },
        { label: 'falls back to default rgba(255,80,60,0.07) and logs for bad input', input: 'not-a-color', alpha: 0.07, errors: true },
    ])('$label', ({ input, alpha, errors }) => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const { color, alpha: parsedAlpha } = parseOverlayColor(THREE, input);
        expectGoldenColor(color);
        expect(parsedAlpha).toBeCloseTo(alpha);
        expect(spy).toHaveBeenCalledTimes(errors ? 1 : 0);
        spy.mockRestore();
    });
});
