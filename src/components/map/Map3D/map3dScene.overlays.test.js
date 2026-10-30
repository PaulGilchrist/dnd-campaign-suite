// @maintained-by-ai
/* global HTMLCanvasElement */
// Lane: map3dScene sub-layer semantics with REAL THREE objects but a headless
// scene (no WebGLRenderer — jsdom can't create one). Locks the 2026-10-30
// camera-reset fix: overlay edits patch ONLY overlayGroup (never mapGroup,
// never the camera); setToggles flips .visible on the always-built labels /
// torch lights (no rebuild); _frameCamera is idempotent per gridSize so
// repeat builds preserve the user's orbit/zoom.
// Sibling lanes: Map3D.test.jsx (effect routing: overlays/toggles never call
// buildMap), map3dSpellOverlays.test.js (shape geometry bytes).
import * as THREE from 'three';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Map3DScene } from './map3dScene.js';
import { CELL_SIZE } from '../../../config/mapConfig.js';

const OVERLAY = (id, overrides = {}) => ({
    id,
    shape: 'sphere',
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

// A scene that has "finished init + one build" without any WebGL: just the
// fields the patched methods touch.
const builtScene = (gridSize = 10) => {
    const scene = new Map3DScene({ clientWidth: 100, clientHeight: 100 });
    scene.THREE = THREE;
    scene.renderer = {}; // init-complete marker for the guards
    scene.scene = new THREE.Scene();
    scene.mapGroup = new THREE.Group();
    scene.scene.add(scene.mapGroup);
    scene.overlayGroup = new THREE.Group();
    scene.scene.add(scene.overlayGroup);
    scene.gridSize = gridSize;
    scene.half = (gridSize * CELL_SIZE) / 2;
    return scene;
};

describe('Map3DScene overlay/toggle/camera lane (camera-reset fix)', () => {
    let scene;

    beforeEach(() => {
        scene = builtScene();
    });

    describe('updateSpellOverlays', () => {
        it('builds overlay groups into overlayGroup only — mapGroup untouched', () => {
            scene.updateSpellOverlays([OVERLAY('a'), OVERLAY('b')]);
            expect(scene.overlayGroup.children).toHaveLength(2);
            expect(scene.mapGroup.children).toHaveLength(0);
            // positioned on the grid: cellX(2)/cellZ(3)
            expect(scene.overlayGroup.children[0].position.x).toBe(2 * CELL_SIZE + CELL_SIZE / 2 - scene.half);
            expect(scene.overlayGroup.children[0].position.z).toBe(3 * CELL_SIZE + CELL_SIZE / 2 - scene.half);
        });

        it('replaces (disposing) the previous overlays on every call — never accumulates', () => {
            scene.updateSpellOverlays([OVERLAY('a')]);
            const first = scene.overlayGroup.children[0];
            const mesh = first.children[0];
            const geoDispose = vi.spyOn(mesh.geometry, 'dispose');
            const matDispose = vi.spyOn(mesh.material, 'dispose');

            scene.updateSpellOverlays([OVERLAY('b'), OVERLAY('c')]);
            expect(scene.overlayGroup.children).toHaveLength(2);
            expect(scene.overlayGroup.children).not.toContain(first);
            expect(geoDispose).toHaveBeenCalledTimes(1);
            expect(matDispose).toHaveBeenCalledTimes(1);
        });

        it('never touches the camera and never calls buildMap', () => {
            scene.camera = { near: 1, far: 1, position: { set: vi.fn() }, updateProjectionMatrix: vi.fn() };
            scene.controls = { target: { set: vi.fn() }, update: vi.fn() };
            const buildSpy = vi.spyOn(scene, 'buildMap');
            scene.updateSpellOverlays([OVERLAY('a')]);
            scene.updateSpellOverlays([]);
            expect(buildSpy).not.toHaveBeenCalled();
            expect(scene.camera.position.set).not.toHaveBeenCalled();
            expect(scene.controls.target.set).not.toHaveBeenCalled();
        });

        it('is a safe no-op before the first buildMap (gridSize unset) and after dispose', () => {
            const fresh = new Map3DScene({ clientWidth: 1, clientHeight: 1 });
            fresh.THREE = THREE;
            fresh.renderer = {};
            fresh.scene = new THREE.Scene();
            fresh.overlayGroup = new THREE.Group();
            expect(() => fresh.updateSpellOverlays([OVERLAY('a')])).not.toThrow();
            expect(fresh.overlayGroup.children).toHaveLength(0);

            scene.updateSpellOverlays([OVERLAY('a')]);
            // Post-dispose reality: dispose() nulls the renderer + groups.
            scene.disposed = true;
            scene.renderer = null;
            scene.overlayGroup = null;
            expect(() => scene.updateSpellOverlays([OVERLAY('b'), OVERLAY('c')])).not.toThrow();
        });
    });

    describe('setToggles (labels / torch)', () => {
        const addTagged = () => {
            const label = new THREE.Sprite(new THREE.SpriteMaterial());
            label.userData.isTokenLabel = true;
            scene.mapGroup.add(label);
            const light = new THREE.PointLight(0xff8833, 1.3, 130, 2);
            light.userData.isTorchLight = true;
            scene.mapGroup.add(light);
            const untouched = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
            scene.mapGroup.add(untouched);
            return { label, light, untouched };
        };

        it('applies visibility to built labels/torch lights without any rebuild', () => {
            const { label, light, untouched } = addTagged();
            const buildSpy = vi.spyOn(scene, 'buildMap');
            scene.setToggles({ showLabels: false, showTorch: false });
            expect(label.visible).toBe(false);
            expect(light.visible).toBe(false);
            expect(untouched.visible).toBe(true);
            expect(buildSpy).not.toHaveBeenCalled();

            scene.setToggles({ showLabels: true, showTorch: true });
            expect(label.visible).toBe(true);
            expect(light.visible).toBe(true);
        });

        it('tokens always carry a label sprite (hidden when showLabels=false) so toggling never needs a rebuild', () => {
            // jsdom has no 2D canvas — stub the drawing context; the sprite
            // tagging/visibility lane below is what this test pins.
            const ctxStub = { font: '', textAlign: '', textBaseline: '', lineWidth: 0, strokeStyle: '', fillStyle: '', strokeText: vi.fn(), fillText: vi.fn() };
            const gctx = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctxStub);
            scene.showLabels = false;
            const token = scene._makeToken('Aria', 0x4a90d9, 0x2c5f8a);
            scene.mapGroup.add(token);
            const label = token.children.find((o) => o.userData.isTokenLabel);
            expect(label).toBeTruthy();
            expect(label.visible).toBe(false);
            scene.showLabels = true;
            scene.setToggles({});
            expect(label.visible).toBe(true);
            gctx.mockRestore();
        });

        it('_buildPointLights always builds torch lights, hidden via .visible when showTorch=false', () => {
            scene.showTorch = false;
            scene._buildPointLights(
                [{ id: 't', type: 'torch', gridX: 1, gridY: 1, visible: true }],
                new Set(), true);
            const light = scene.mapGroup.children.find((o) => o.userData.isTorchLight);
            expect(light).toBeTruthy();
            expect(light.visible).toBe(false);
            scene.setToggles({ showTorch: true });
            expect(light.visible).toBe(true);
        });
    });

    describe('_frameCamera idempotency', () => {
        const fakeRig = () => {
            scene.camera = { near: 1, far: 1, position: { set: vi.fn() }, updateProjectionMatrix: vi.fn() };
            scene.controls = { target: { set: vi.fn() }, update: vi.fn() };
        };

        it('frames once per gridSize; repeat frames for the same size are no-ops', () => {
            fakeRig();
            scene._frameCamera(10);
            expect(scene.camera.position.set).toHaveBeenCalledTimes(1);
            expect(scene.camera.position.set.mock.calls[0]).toEqual([
                10 * CELL_SIZE * 0.52, 10 * CELL_SIZE * 0.5, 10 * CELL_SIZE * 0.92,
            ]);

            scene._frameCamera(10);
            expect(scene.camera.position.set).toHaveBeenCalledTimes(1);

            scene._frameCamera(12);
            expect(scene.camera.position.set).toHaveBeenCalledTimes(2);
            expect(scene.framedFor).toBe(12);
        });
    });
});
