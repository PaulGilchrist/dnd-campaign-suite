// @maintained-by-ai
/* global HTMLCanvasElement */
// Lane: the dev-only scene census (Map3DScene.getCensus) — the machine-readable
// proof handle for per-mesh assertions (backlog 2026-11-10 HD). Built on the
// sibling overlays-test posture: REAL three.js objects, headless scene (no
// WebGLRenderer). Pins: every mesh lane tags itself exactly once, registered
// prop types census individually, unregistered ("ghost") types land in the
// single `fallback` bucket, tokens/overlays/fog count live, and the census
// re-reads the scene graph on every call (an overlay add/clear shows through
// with NO rebuild — the handle is a traversal, not a mount snapshot).
import * as THREE from 'three';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

// A scene that has "finished init" without any WebGL (see overlays test twin).
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

// Runs every mesh-bearing build lane directly (buildMap itself needs the
// texture loaders). _loadAsset is stubbed: every non-ghost type resolves a
// registered prototype, the ghost type resolves null → _fallbackBox lane.
const buildAllLanes = async (scene) => {
    scene._loadAsset = async (type) => (type === 'ghostProp' ? null : new THREE.Group());
    scene._buildFloorAndGrid(scene.gridSize, '#1a1a1a');
    scene._buildWalls(['0,0', '0,1', '1,0'], new Set(), true);
    await scene._buildPlacedItems([
        { id: 'b1', type: 'barrel', gridX: 2, gridY: 2, visible: true },
        { id: 'b2', type: 'barrel', gridX: 3, gridY: 2, visible: true },
        { id: 'bed1', type: 'bed', gridX: 4, gridY: 2, rotation: 90, visible: true },
        { id: 'g1', type: 'ghostProp', gridX: 6, gridY: 6, visible: true },
    ], new Set(), true);
    scene._buildPlayers([
        { id: 'p1', name: 'Aria', gridX: 1, gridY: 1 },
        { id: 'p2', name: 'Bram', gridX: 1, gridY: 2 },
    ], new Set(), true, null, scene.buildGen);
    scene._buildNpcs([
        { id: 'n1', type: 'npc', name: 'Orc', gridX: 5, gridY: 1, visible: true },
        { id: 'm1', type: 'monster', name: 'Goblin', gridX: 5, gridY: 2, visible: true },
    ], new Set(), true, null, scene.buildGen);
    scene._buildPointLights([{ id: 't1', type: 'torch', gridX: 0, gridY: 3, visible: true }], new Set(), true);
    scene._buildFog(new Set(['8,8', '8,9', '9,8', '9,9']), true);
};

const CANVAS_CTX = {
    font: '', textAlign: '', textBaseline: '', lineWidth: 0, strokeStyle: '', fillStyle: '',
    strokeText: vi.fn(), fillText: vi.fn(),
};

describe('Map3DScene.getCensus (dev handle, backlog 2026-11-10 HD)', () => {
    let ctxSpy;

    beforeEach(() => {
        // Token labels paint on a canvas — jsdom has no 2D context (same
        // stub as the sibling overlays test; the tagging lane is what matters).
        ctxSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(CANVAS_CTX);
    });

    afterEach(() => {
        ctxSpy.mockRestore();
    });

    it('reports an item-type→instance census of the built scene, ghosts under fallback, tokens counted', async () => {
        const scene = builtScene();
        await buildAllLanes(scene);
        expect(scene.getCensus()).toEqual({
            gridSize: 10,
            walls: 3, // InstancedMesh instance count, not one merged mesh
            floor: 1,
            grid: 1,
            players: 2,
            npcs: 1,
            monsters: 1,
            fallback: 1, // ghostProp → _fallbackBox lane, bucketed not named
            torchLights: 1,
            fogCells: 4, // merged fog mesh reports its cell count
            overlays: 0,
            items: { barrel: 2, bed: 1 },
        });
    });

    it('is LIVE: spell-overlay add/clear repaints census.overlays with no rebuild of the map lanes', async () => {
        const scene = builtScene();
        await buildAllLanes(scene);
        expect(scene.getCensus().overlays).toBe(0);

        scene.updateSpellOverlays([OVERLAY('a'), OVERLAY('b')]);
        const afterAdd = scene.getCensus();
        expect(afterAdd.overlays).toBe(2);
        expect(afterAdd.items).toEqual({ barrel: 2, bed: 1 });
        expect(afterAdd.players).toBe(2);

        scene.updateSpellOverlays([]);
        expect(scene.getCensus().overlays).toBe(0);
    });

    it('reflects a full map rebuild (clearMap swaps mapGroup) without holding stale mounts', async () => {
        const scene = builtScene();
        await buildAllLanes(scene);
        const before = scene.getCensus();
        scene.clearMap();
        const afterClear = scene.getCensus();
        expect(afterClear).toEqual(expect.objectContaining({
            gridSize: 10, walls: 0, floor: 0, players: 0, fallback: 0, items: {}, overlays: 0,
        }));
        // mapGroup identity changed; the old census numbers never leak back.
        expect(before.walls).toBe(3);
    });

    it('is safe to read before init (null groups → zeroed census, no throw)', () => {
        const fresh = new Map3DScene({ clientWidth: 1, clientHeight: 1 });
        expect(() => fresh.getCensus()).not.toThrow();
        expect(fresh.getCensus()).toEqual(expect.objectContaining({ gridSize: 0, walls: 0, items: {} }));
    });
});
