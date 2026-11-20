// @maintained-by-ai
/* global HTMLCanvasElement */
// ─── Lane: 3D last-seen ghost tokens (Item 7 parity, owner ruling 2026-11-19) ──
// The scene-level decision for the visitor "Last Seen" face in 3D: _buildLastKnownTokens
// paints a MUTED, dimmed token at the remembered cell for a fog-culled creature
// (mirroring the 2D .token-ghost semantics via the established _setDimmed idiom),
// renders NOTHING for the GM lane (lastKnown null), for never-sighted creatures
// (cull law), and for tokens whose current cell is visible (upgrade law — the
// truth mesh owns it, the ghost never shadows or doubles it). Position pin law:
// the ghost sits at the LAST-SEEN cell, never the fogged live cell (no leak).
// Lift law: the player fog is an opaque full-cell column capped at WALL_H, so a
// ground ghost would be buried — the memory floats above the fog roof.
// Real THREE headless scene, seam copied from the sibling census/hidden-dim tests.
import * as THREE from 'three';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Map3DScene } from './map3dScene.js';
import { CELL_SIZE, HIDDEN_MARKER_OPACITY } from '../../../config/mapConfig.js';

const FOG_TOP = 80; // WALL_H in map3dScene.js (module-private): fog column roof

// Headless "init-complete" scene (see census test twin).
const builtScene = (gridSize = 10) => {
    const scene = new Map3DScene({ clientWidth: 100, clientHeight: 100 });
    scene.THREE = THREE;
    scene.renderer = {};
    scene.scene = new THREE.Scene();
    scene.mapGroup = new THREE.Group();
    scene.scene.add(scene.mapGroup);
    scene.overlayGroup = new THREE.Group();
    scene.scene.add(scene.overlayGroup);
    scene.gridSize = gridSize;
    scene.half = (gridSize * CELL_SIZE) / 2;
    return scene;
};

const CANVAS_CTX = {
    font: '', textAlign: '', textBaseline: '', lineWidth: 0, strokeStyle: '', fillStyle: '',
    strokeText: vi.fn(), fillText: vi.fn(),
};

const monster = (over = {}) => ({
    id: 'm1', type: 'monster', name: 'Goblin', gridX: 8, gridY: 2, visible: true, ...over,
});

describe('Map3DScene._buildLastKnownTokens (visitor last-seen ghost lane)', () => {
    let ctxSpy;

    beforeEach(() => {
        // Token labels paint on a canvas — jsdom has no 2D context.
        ctxSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(CANVAS_CTX);
    });

    afterEach(() => {
        ctxSpy.mockRestore();
    });

    it('visitor lane: paints ONE dimmed muted token at the last-seen cell, censused separately from live tokens', async () => {
        const scene = builtScene();
        // Live monster sits fogged at (8,2); this client last saw it at (2,2).
        const lastKnown = new Map([['m1', { gridX: 2, gridY: 2 }]]);
        await scene._buildPlacedItems([monster()], new Set(['8,2']), false);
        scene._buildNpcs([monster()], new Set(['8,2']), false, null, scene.buildGen);
        scene._buildLastKnownTokens([monster()], new Set(['8,2']), false, lastKnown);

        const census = scene.getCensus();
        expect(census.monsters).toBe(0); // fog-cull law unchanged (no live leak)
        expect(census.lastKnown).toBe(1); // the ghost face exists in 3D
        expect(census.lastKnownDimmed).toBe(1); // live materials carry the dim
        expect(census.lastKnownCells).toEqual(['2,2']); // pin cell, no live leak
        expect(census.fallback).toBe(0); // not entangled with fallback-prop ghosts

        const ghost = scene.mapGroup.children.find((o) => o.userData.census?.kind === 'lastKnown');
        // Pinned at the MEMORY cell, never the fogged live cell.
        expect(ghost.position.x).toBeCloseTo(scene.cellX(2));
        expect(ghost.position.z).toBeCloseTo(scene.cellZ(2));
        // Floating above the opaque fog roof so it is actually visible.
        expect(ghost.position.y).toBeGreaterThan(FOG_TOP);
        // Dim + muted treatment (shared _setDimmed idiom, grey palette).
        const meshes = ghost.children.filter((o) => o.isMesh && o.material);
        expect(meshes.length).toBeGreaterThan(0);
        for (const m of meshes) {
            expect(m.material.transparent).toBe(true);
            expect(m.material.opacity).toBe(HIDDEN_MARKER_OPACITY);
        }
    });

    it('GM lane (lastKnown null) paints NOTHING — truth meshes only, as today', () => {
        const scene = builtScene();
        scene._buildLastKnownTokens([monster()], new Set(['8,2']), true, null);
        expect(scene.mapGroup.children).toHaveLength(0);
        expect(scene.getCensus().lastKnown).toBe(0);
    });

    it('cull law: a never-sighted creature (no memory) and non-creature items render NOTHING', () => {
        const scene = builtScene();
        // Empty memory (never revealed) + an out-of-contract prop entry.
        scene._buildLastKnownTokens(
            [monster(), { id: 'b1', type: 'barrel', gridX: 8, gridY: 2, visible: true }],
            new Set(['8,2']), false, new Map([['b1', { gridX: 1, gridY: 1 }]]));
        expect(scene.getCensus()).toEqual(expect.objectContaining({ lastKnown: 0, lastKnownDimmed: 0 }));
        expect(scene.mapGroup.children).toHaveLength(0);
    });

    it('upgrade law: a memory for a token whose CURRENT cell is visible is skipped — truth owns the token', () => {
        const scene = builtScene();
        // Stale memory present, but the token now stands on a revealed cell.
        const lastKnown = new Map([['m1', { gridX: 2, gridY: 2 }]]);
        scene._buildNpcs([monster()], new Set(), false, null, scene.buildGen);
        scene._buildLastKnownTokens([monster()], new Set(), false, lastKnown);

        const census = scene.getCensus();
        expect(census.monsters).toBe(1); // the live mesh renders as normal
        expect(census.lastKnown).toBe(0); // the ghost representation is gone
    });
});
