import * as THREE from 'three';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createOverlayGroup, parseOverlayColor, ftToUnits, EFFECT_HEIGHT } from './map3dSpellOverlays.js';
import { OverlayShape, OVERLAY_FILL_ALPHA, OVERLAY_STROKE_ALPHA } from '../../../models/SpellOverlay.js';

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

const getMesh = (group) => group.children[0];
const getOutline = (group) => group.children[1];
const bbox = (geometry) => {
    geometry.computeBoundingBox();
    return geometry.boundingBox;
};

afterEach(() => {
    vi.restoreAllMocks();
});

describe('ftToUnits / EFFECT_HEIGHT', () => {
    it('converts feet to world units (1 ft = 8 units)', () => {
        expect(ftToUnits(5)).toBe(40);
        expect(ftToUnits(20)).toBe(160);
        expect(ftToUnits(60)).toBe(480);
    });

    it('effect height is 10 feet (2 cells)', () => {
        expect(EFFECT_HEIGHT).toBe(80);
    });
});

const expectedColor = new THREE.Color().setRGB(1, 80 / 255, 60 / 255, THREE.SRGBColorSpace);

describe('parseOverlayColor', () => {
    it('parses rgba strings into an sRGB-converted color and alpha', () => {
        const { color, alpha } = parseOverlayColor(THREE, 'rgba(255,80,60,0.35)');
        expect(color).toEqual(expectedColor);
        expect(alpha).toBeCloseTo(0.35);
    });

    it('falls back to the default overlay color and logs an error for bad input', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const { color, alpha } = parseOverlayColor(THREE, 'not-a-color');
        expect(color).toEqual(expectedColor);
        expect(alpha).toBeCloseTo(OVERLAY_FILL_ALPHA);
        expect(spy).toHaveBeenCalled();
    });
});

describe('createOverlayGroup', () => {
    it('returns null for an unknown shape', () => {
        expect(createOverlayGroup(THREE, makeOverlay({ shape: 'hexagon' }), 0, 0)).toBeNull();
        expect(createOverlayGroup(THREE, null, 0, 0)).toBeNull();
    });

    it('positions the group at the given cell origin on the floor', () => {
        const group = createOverlayGroup(THREE, makeOverlay(), 100, -50);
        expect(group.position.x).toBe(100);
        expect(group.position.y).toBe(0);
        expect(group.position.z).toBe(-50);
    });

    it('applies the 2D clockwise angle as a negative Y rotation', () => {
        const group = createOverlayGroup(THREE, makeOverlay({ shape: OverlayShape.CUBE, angle: 90, sizeFt: 15 }), 0, 0);
        expect(group.rotation.y).toBeCloseTo(-Math.PI / 2);
    });

    describe('sphere', () => {
        it('builds a sphere centered at floor level with the radius in feet and no outline', () => {
            const group = createOverlayGroup(THREE, makeOverlay(), 0, 0);
            expect(group.children).toHaveLength(1);
            const mesh = getMesh(group);
            expect(mesh.geometry.parameters.radius).toBe(160); // 20 ft
            const box = bbox(mesh.geometry);
            expect(box.min.y).toBeCloseTo(-160);
            expect(box.max.y).toBeCloseTo(160);
            expect(mesh.material).toBeInstanceOf(THREE.MeshBasicMaterial);
            expect(mesh.material.transparent).toBe(true);
            expect(mesh.material.opacity).toBeCloseTo(0.35);
            expect(mesh.material.depthTest).toBe(false);
            expect(mesh.material.depthWrite).toBe(false);
            expect(mesh.material.side).toBe(THREE.DoubleSide);
            expect(mesh.renderOrder).toBe(1001);
            expect(mesh.material.color).toEqual(expectedColor);
        });
    });

    describe('cylinder', () => {
        it('builds a floor-to-ceiling cylinder with an outline', () => {
            const group = createOverlayGroup(THREE, makeOverlay({ shape: OverlayShape.CYLINDER }), 0, 0);
            expect(group.children).toHaveLength(2);
            const mesh = getMesh(group);
            expect(mesh.geometry.parameters.radiusTop).toBe(160);
            expect(mesh.geometry.parameters.radiusBottom).toBe(160);
            expect(mesh.geometry.parameters.height).toBe(80);
            const box = bbox(mesh.geometry);
            expect(box.min.y).toBeCloseTo(0);
            expect(box.max.y).toBeCloseTo(80);
            const outline = getOutline(group);
            expect(outline).toBeInstanceOf(THREE.LineSegments);
            expect(outline.material.opacity).toBeCloseTo(OVERLAY_STROKE_ALPHA);
            expect(outline.renderOrder).toBe(1002);
        });
    });

    describe('cube', () => {
        it('builds a size-cubed box sitting on the floor', () => {
            const group = createOverlayGroup(THREE, makeOverlay({ shape: OverlayShape.CUBE, sizeFt: 15 }), 0, 0);
            const mesh = getMesh(group);
            expect(mesh.geometry.parameters.width).toBe(120); // 15 ft
            expect(mesh.geometry.parameters.height).toBe(120);
            expect(mesh.geometry.parameters.depth).toBe(120);
            const box = bbox(mesh.geometry);
            expect(box.min.y).toBeCloseTo(0);
            expect(box.max.y).toBeCloseTo(120);
        });
    });

    describe('cone', () => {
        it('builds a cone with apex at the origin opening along +X', () => {
            const group = createOverlayGroup(THREE, makeOverlay({ shape: OverlayShape.CONE, distanceFt: 60, coneAngle: 60 }), 0, 0);
            const mesh = getMesh(group);
            const params = mesh.geometry.parameters;
            expect(params.height).toBe(480); // 60 ft
            expect(params.radius).toBeCloseTo(480 * Math.tan(Math.PI / 6), 1);
            const box = bbox(mesh.geometry);
            expect(box.min.x).toBeCloseTo(0);
            expect(box.max.x).toBeCloseTo(480);
            expect(box.min.y).toBeCloseTo(-480 * Math.tan(Math.PI / 6), 1);
            expect(box.max.y).toBeCloseTo(480 * Math.tan(Math.PI / 6), 1);
        });

        it('caps the base radius at the hemisphere radius past 180 degrees', () => {
            const group = createOverlayGroup(THREE, makeOverlay({ shape: OverlayShape.CONE, distanceFt: 60, coneAngle: 270 }), 0, 0);
            const mesh = getMesh(group);
            expect(mesh.geometry.parameters.radius).toBeCloseTo(480);
        });

        it('builds a full circle for a 360-degree cone', () => {
            const group = createOverlayGroup(THREE, makeOverlay({ shape: OverlayShape.CONE, distanceFt: 60, coneAngle: 360 }), 0, 0);
            const mesh = getMesh(group);
            expect(mesh.geometry.parameters.radiusTop).toBe(480);
            expect(mesh.geometry.parameters.radiusBottom).toBe(480);
            expect(mesh.geometry.parameters.height).toBe(80);
        });
    });

    describe('line', () => {
        it('builds a beam extending from the origin along +X', () => {
            const group = createOverlayGroup(THREE, makeOverlay({ shape: OverlayShape.LINE, distanceFt: 60, widthFt: 5 }), 0, 0);
            const mesh = getMesh(group);
            const params = mesh.geometry.parameters;
            expect(params.width).toBe(480); // 60 ft
            expect(params.height).toBe(80); // 10 ft
            expect(params.depth).toBe(40); // 5 ft
            const box = bbox(mesh.geometry);
            expect(box.min.x).toBeCloseTo(0);
            expect(box.max.x).toBeCloseTo(480);
            expect(box.min.z).toBeCloseTo(-20);
            expect(box.max.z).toBeCloseTo(20);
        });
    });
});
