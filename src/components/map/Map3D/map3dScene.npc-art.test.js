// @maintained-by-ai
/* global HTMLCanvasElement */
// Creature-token art lane (backlog 2026-11-11 IE): 3D _buildNpcs must follow
// the SAME precedence law as 2D PlacedItems.jsx:215 —
//   npcImages[item.name] (name-keyed bestiary lane) > item.imageUrl (inline
//   off-catalog art) > plain disc.
// The name map only hydrates type:'npc' rows (useNpcImageCache.js filter), so
// monster tokens and off-catalog npc rows reach art ONLY through the inline
// fallback — before this fix they rendered plain discs in 3D while 2D showed
// the image. Pins: inline-URL texture lands on the disc (criteria 1), name-map
// precedence survives a conflicting inline URL (criteria 2), and neither/
// broken-URL tokens keep the plain-disc + census semantics (criteria 3).
// Built on the sibling census-test posture: REAL three.js objects, headless
// scene, _loadTexture stubbed so each disc's material.map.image.src records
// the URL that was requested.
import * as THREE from 'three';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Map3DScene } from './map3dScene.js';
import { CELL_SIZE } from '../../../config/mapConfig.js';

// A scene that has "finished init" without any WebGL (see census test twin).
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
    // Stub the network lane: "missing" urls resolve null (no disc is added);
    // the rest resolve a texture whose image records the requested src.
    scene._loadTexture = (url) => {
        if (url.includes('missing')) return Promise.resolve(null);
        const tex = new THREE.Texture();
        tex.image = { src: url };
        return Promise.resolve(tex);
    };
    return scene;
};

// Tokens are keyed by census kind + grid position (labels share the group, so
// position is the stable identity for scene-unit lookups).
const tokenAt = (scene, kind, gridX, gridY) =>
    scene.mapGroup.children.find((o) => {
        if (o.userData.census?.kind !== kind) return false;
        const x = gridX * CELL_SIZE + CELL_SIZE / 2 - scene.half;
        const z = gridY * CELL_SIZE + CELL_SIZE / 2 - scene.half;
        return Math.abs(o.position.x - x) < 0.01 && Math.abs(o.position.z - z) < 0.01;
    });

const avatarDisc = (token) =>
    token ? token.children.find((c) => c.userData.census?.kind === 'avatar') : undefined;

const CANVAS_CTX = {
    font: '', textAlign: '', textBaseline: '', lineWidth: 0, strokeStyle: '', fillStyle: '',
    strokeText: vi.fn(), fillText: vi.fn(),
};

describe('Map3DScene._buildNpcs inline imageUrl parity with 2D (backlog 2026-11-11 IE)', () => {
    let ctxSpy;

    beforeEach(() => {
        // Token labels paint on a canvas — jsdom has no 2D context.
        ctxSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(CANVAS_CTX);
    });

    afterEach(() => {
        ctxSpy.mockRestore();
    });

    // Criterion 1: off-catalog art — name does NOT resolve via npcImages but
    // the item carries an inline imageUrl → textured disc.
    it('textures a monster token from item.imageUrl when the name map has no entry (the useNpcImageCache npc-only filter never hydrates monsters)', async () => {
        const scene = builtScene();
        scene._buildNpcs([
            { id: 'm1', type: 'monster', name: 'Mossback Troll', gridX: 5, gridY: 1, visible: true, imageUrl: '/campaigns/test-campaign/troll.jpg' },
        ], new Set(), true, { SomeNpc: 'npc.png' }, scene.buildGen);
        await new Promise((resolve) => setTimeout(resolve, 0));

        const disc = avatarDisc(tokenAt(scene, 'monsters', 5, 1));
        expect(disc).toBeTruthy();
        expect(disc.material.map.image.src).toBe('/campaigns/test-campaign/troll.jpg');
        const census = scene.getCensus();
        expect(census.monsters).toBe(1);
        expect(census.avatars).toBe(1);
        expect(census.textured).toBe(1);
    });

    // Criterion 1 (npc flavour): an npc row whose name misses the cache still
    // shows its inline art, exactly like 2D.
    it('textures an npc token from item.imageUrl on a name-map miss', async () => {
        const scene = builtScene();
        scene._buildNpcs([
            { id: 'n1', type: 'npc', name: 'Custom Vendor', gridX: 6, gridY: 2, visible: true, imageUrl: '/images/vendor.png' },
        ], new Set(), true, { Goblin: 'dnd-tools/images/goblin.jpg' }, scene.buildGen);
        await new Promise((resolve) => setTimeout(resolve, 0));

        const disc = avatarDisc(tokenAt(scene, 'npcs', 6, 2));
        expect(disc).toBeTruthy();
        expect(disc.material.map.image.src).toBe('/images/vendor.png');
    });

    // Criterion 2: name-keyed bestiary lane keeps precedence over a
    // CONFLICTING inline URL (same law as PlacedItems.jsx:215 and its
    // "npcImages cache beats item.imageUrl" pin).
    it('name-map texture beats a conflicting inline imageUrl', async () => {
        const scene = builtScene();
        scene._buildNpcs([
            { id: 'n1', type: 'npc', name: 'Orc', gridX: 5, gridY: 1, visible: true, imageUrl: '/inline-wrong.jpg' },
        ], new Set(), true, { Orc: 'dnd-tools/images/orc.jpg' }, scene.buildGen);
        await new Promise((resolve) => setTimeout(resolve, 0));

        const disc = avatarDisc(tokenAt(scene, 'npcs', 5, 1));
        expect(disc).toBeTruthy();
        expect(disc.material.map.image.src).toBe('dnd-tools/images/orc.jpg');
    });

    // Criterion 3: neither lane resolves → plain disc, no avatar child, and
    // the census buckets keep their semantics.
    it('renders a plain token when neither the name map nor an inline URL resolve', async () => {
        const scene = builtScene();
        scene._buildNpcs([
            { id: 'n1', type: 'npc', name: 'Nobody', gridX: 5, gridY: 1, visible: true },
            { id: 'm1', type: 'monster', name: 'Nowhere', gridX: 5, gridY: 2, visible: true },
        ], new Set(), true, { Goblin: 'dnd-tools/images/goblin.jpg' }, scene.buildGen);
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(avatarDisc(tokenAt(scene, 'npcs', 5, 1))).toBeUndefined();
        expect(avatarDisc(tokenAt(scene, 'monsters', 5, 2))).toBeUndefined();
        const census = scene.getCensus();
        expect(census.npcs).toBe(1);
        expect(census.monsters).toBe(1);
        expect(census.avatars).toBe(0);
        expect(census.textured).toBe(0);
    });

    // Criterion 3: a broken inline URL behaves like a name-map miss — the
    // _loadTexture null exit adds no disc (no half-textured ghost).
    it('adds no avatar disc when the inline URL fails to load', async () => {
        const scene = builtScene();
        scene._buildNpcs([
            { id: 'n1', type: 'npc', name: 'Broken Art', gridX: 7, gridY: 3, visible: true, imageUrl: '/missing/art.png' },
        ], new Set(), true, null, scene.buildGen);
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(avatarDisc(tokenAt(scene, 'npcs', 7, 3))).toBeUndefined();
        expect(scene.getCensus().avatars).toBe(0);
    });

    // Regression guard: the fog/occlusion lane is untouched — a fogged,
    // non-GM token never builds, inline art or not.
    it('fog occlusion still gates tokens with inline art (isItemVisible unchanged)', async () => {
        const scene = builtScene();
        scene._buildNpcs([
            { id: 'n1', type: 'npc', name: 'Hidden', gridX: 8, gridY: 8, visible: true, imageUrl: '/art.png' },
        ], new Set(['8,8']), false, null, scene.buildGen);
        await new Promise((resolve) => setTimeout(resolve, 0));

        const census = scene.getCensus();
        expect(census.npcs).toBe(0);
        expect(census.avatars).toBe(0);
    });
});
