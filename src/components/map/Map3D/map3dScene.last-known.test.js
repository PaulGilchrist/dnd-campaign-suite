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
// CONDITIONAL LIFT law (owner ruling 2026-11-20): a memory cell is recorded at
// a VISIBLE cell, so while it stays OUT of the fog set the ghost sits at ground
// level (the live-token y-base 0) anchored on its cell. Only when the memory
// cell has RE-FOGGED does it lift above the fog roof — the player fog is an
// opaque full-cell column capped at WALL_H that buries ground meshes
// (FOG-BURIAL law, authoritative for the re-fog face; never buried either way).
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
    // Deterministic width for the snug-canvas sizing law: 40px per character.
    measureText: (t) => ({ width: t.length * 40 }),
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
        // GROUNDED face (CONDITIONAL LIFT law): the memory cell (2,2) is NOT
        // in the fog set, so the token sits at ground level on its cell —
        // never hovering detached over open floor.
        expect(ghost.position.y).toBe(0);
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

    // CONDITIONAL LIFT faces (owner ruling 2026-11-20): grounded while the
    // memory cell stays revealed, lifted only once it RE-FOGGES — and the
    // lift face keeps the FOG-BURIAL law (never buried under the opaque
    // FOG_PLAYER cap) for that face.
    const ghostIn = (scene) =>
        scene.mapGroup.children.find((o) => o.userData.census?.kind === 'lastKnown');

    it('re-fogged face: a memory cell that re-entered the fog set lifts above the fog roof (never buried)', () => {
        const scene = builtScene();
        // The monster walked off and the door closed: (2,2) is fogged again.
        scene._buildLastKnownTokens([monster()], new Set(['8,2', '2,2']), false,
            new Map([['m1', { gridX: 2, gridY: 2 }]]));
        const ghost = ghostIn(scene);
        expect(ghost.position.y).toBe(FOG_TOP + 16); // LAST_KNOWN_LIFT, above the cap
        expect(scene.getCensus().lastKnownCells).toEqual(['2,2']); // same cell law
    });

    it('grounded face y matches the live-token y-base exactly (anchor, not a new magic height)', () => {
        const scene = builtScene();
        // A live creature on an open cell (no fog) and a grounded ghost side by side.
        scene._buildNpcs([monster({ id: 'm2', name: 'Live', gridX: 1, gridY: 1 })],
            new Set(['8,2']), false, null, scene.buildGen);
        scene._buildLastKnownTokens([monster()], new Set(['8,2']), false,
            new Map([['m1', { gridX: 2, gridY: 2 }]]));
        const live = scene.mapGroup.children.find((o) => o.userData.census?.kind === 'monsters');
        expect(ghostIn(scene).position.y).toBe(live.position.y); // same ground idiom
    });

    it('transition across rebuilds: grounded → re-fogged lift → grounded again (no stale lift)', () => {
        const scene = builtScene();
        const lastKnown = new Map([['m1', { gridX: 2, gridY: 2 }]]);
        // Face 1: memory cell revealed → grounded.
        scene._buildLastKnownTokens([monster()], new Set(['8,2']), false, lastKnown);
        expect(ghostIn(scene).position.y).toBe(0);
        // Rebuild with the cell re-fogged (fog is a build input) → lifted.
        scene.clearMap();
        scene._buildLastKnownTokens([monster()], new Set(['8,2', '2,2']), false, lastKnown);
        expect(ghostIn(scene).position.y).toBe(FOG_TOP + 16);
        // Re-reveal rebuild → grounded again, no stale lift persists.
        scene.clearMap();
        scene._buildLastKnownTokens([monster()], new Set(['8,2']), false, lastKnown);
        expect(ghostIn(scene).position.y).toBe(0);
        expect(scene.getCensus().lastKnown).toBe(1); // exactly one ghost on the board
    });

    // Wording law (backlog 2026-11-20 TL): the ghost label mirrors the 2D
    // twin's title (PlacedItems.jsx creatureGroupChrome) —
    // `${placedItemLabel(item)} — last seen here`, not the bare name. Canvas
    // pixels are unreadable in jsdom, so _makeLabel stamps the rendered text
    // into sprite.userData.labelText — that seam is what these pins assert.
    const ghostLabel = (scene) => ghostIn(scene).children.find((o) => o.userData.isTokenLabel);

    it('ghost label wording: "<Name> — last seen here" (same suffix law as the 2D twin)', () => {
        const scene = builtScene();
        scene._buildLastKnownTokens([monster()], new Set(['8,2']), false,
            new Map([['m1', { gridX: 2, gridY: 2 }]]));
        expect(ghostLabel(scene).userData.labelText).toBe('Goblin — last seen here');
    });

    it('nameless-token face mirrors placedItemLabel: "<type> (x,y) — last seen here"', () => {
        const scene = builtScene();
        // Unnamed monster row (no name → type base + cell disambiguation,
        // byte-identical to the 2D title for the same row).
        scene._buildLastKnownTokens([{ id: 'm1', type: 'monster', gridX: 8, gridY: 2, visible: true }],
            new Set(['8,2']), false, new Map([['m1', { gridX: 2, gridY: 2 }]]));
        expect(ghostLabel(scene).userData.labelText).toBe('monster (8,2) — last seen here');
    });

    // SIZING law (re-dispatch fix 2026-11-20): the old fixed 512px canvas
    // clipped long labels, so the ghost's VISIBLE face read "…n Rig — last
    // seen…". _makeLabel now sizes the canvas to ctx.measureText and widens
    // the sprite at the legacy 14-unit-tall px→world ratio (canvas 512 → the
    // historic 56 wide), capped at 1024px (112 world units) with the FONT
    // shrinking past the cap. sprite.scale is the measurable seam (jsdom
    // mocks the paint calls); mock law: measureText = 40px/char.
    it('snug-canvas sizing: long labels widen the sprite instead of clipping; short ones keep the px→world ratio', () => {
        const scene = builtScene();
        scene._buildNpcs([monster()], new Set(), false, null, scene.buildGen);
        scene._buildLastKnownTokens([monster()], new Set(['8,2']), false,
            new Map([['m1', { gridX: 2, gridY: 2 }]]));
        const live = scene.mapGroup.children.find((o) => o.userData.census?.kind === 'monsters')
            .children.find((o) => o.userData.isTokenLabel);
        const ghost = ghostLabel(scene);
        // 'Goblin' → 6 chars × 40 + 40 pad = 280 canvas px.
        expect(live.scale.x).toBeCloseTo(14 * 280 / 128);
        // 'Goblin — last seen here' (23 chars → 960 px) EXCEEDS the old 512 canvas
        // (the shipped clip face) — the sprite must widen to fit, uncapped.
        expect(ghost.scale.x).toBeGreaterThan(live.scale.x);
        expect(ghost.scale.x).toBeCloseTo(14 * 960 / 128);
        // Height law untouched: every label stays 14 world units tall.
        expect(ghost.scale.y).toBe(14);
        expect(live.scale.y).toBe(14);
    });

    it('nameless ghost face also fits the cap path: "monster (8,2) — last seen here" widens (was clipped at 512px)', () => {
        const scene = builtScene();
        scene._buildLastKnownTokens([{ id: 'm1', type: 'monster', gridX: 8, gridY: 2, visible: true }],
            new Set(['8,2']), false, new Map([['m1', { gridX: 2, gridY: 2 }]]));
        const ghost = ghostLabel(scene);
        expect(ghost.userData.labelText).toBe('monster (8,2) — last seen here');
        expect(ghost.scale.x).toBeCloseTo(14 * 1024 / 128);
    });

    it('_makeLabel shrinks the font past the cap (never balloons the sprite) and keeps labelText correct', () => {
        const scene = builtScene();
        const label = scene._makeLabel('X'.repeat(80)); // 80 × 40 + 40 = 3240 px
        expect(label.scale.x).toBeCloseTo(14 * 1024 / 128); // width pinned at the cap
        expect(label.scale.y).toBe(14);
        expect(label.userData.labelText).toBe('X'.repeat(80));
        expect(CANVAS_CTX.font).toBe('bold 24px -apple-system, sans-serif'); // min-font floor
    });

    it('live token labels stay bare (no suffix) and the Labels toggle keeps hiding ghost labels too', () => {
        const scene = builtScene();
        scene._buildNpcs([monster()], new Set(), false, null, scene.buildGen);
        scene._buildPlayers([{ id: 'p1', name: 'War_Cleric', gridX: 1, gridY: 1 }], new Set(), false, null, scene.buildGen);
        scene._buildLastKnownTokens([monster()], new Set(['8,2']), false,
            new Map([['m1', { gridX: 2, gridY: 2 }]]));

        const labels = [];
        scene.mapGroup.traverse((o) => { if (o.userData.isTokenLabel) labels.push(o); });
        expect(labels.map((o) => o.userData.labelText))
            .toEqual(['Goblin', 'War_Cleric', 'Goblin — last seen here']);
        // setToggles flips every isTokenLabel sprite — ghost label included —
        // with no rebuild.
        scene.setToggles({ showLabels: false });
        for (const o of labels) expect(o.visible).toBe(false);
        scene.setToggles({ showLabels: true });
        for (const o of labels) expect(o.visible).toBe(true);
    });
});
