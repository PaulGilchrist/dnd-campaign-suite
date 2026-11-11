// @maintained-by-ai
/* global HTMLCanvasElement */
// Lane: the dev-only hex census (Hex3DScene.getCensus) — twin of
// ./map3dScene.census.test.js for the outdoor diorama (backlog 2026-11-10 HD).
// REAL three.js, headless (no WebGLRenderer): buildMap runs its FULL structural
// pipeline (relief, decorations, rivers, roads, POIs) with only the GLB model
// loader stubbed (jsdom cannot fetch/stream POI art — primitive placements
// census identically). Pins the live-patch contract: party/travel-path/weather
// reads change without a rebuild.
import * as THREE from 'three';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hex3DScene } from './hex3dScene.js';

// A scene that has "finished init" without any WebGL.
const headlessScene = () => {
    const scene = new Hex3DScene({ clientWidth: 100, clientHeight: 100 });
    scene.THREE = THREE;
    scene.renderer = {}; // init-complete marker for the guards
    scene.scene = new THREE.Scene();
    for (const lane of ['mapGroup', 'partyGroup', 'pathGroup', 'weatherGroup']) {
        scene[lane] = new THREE.Group();
        scene.scene.add(scene[lane]);
    }
    scene.camera = { near: 1, far: 1, position: { set: vi.fn() }, updateProjectionMatrix: vi.fn() };
    scene.controls = { target: { set: vi.fn() }, update: vi.fn() };
    scene._sun = { shadow: { camera: { updateProjectionMatrix: vi.fn() } } }; // built in real init()
    return scene;
};

const STRUCTURE = {
    hexCols: 4,
    hexRows: 3, // 12 hexes
    terrain: { '1,1': 'forest', '2,2': 'forest', '3,0': 'mountains' },
    rivers: ['0,0', '1,0', '3,2'], // one 2-hex chain + one isolated pool
    roads: [{ id: 'r1', hexes: ['0,1', '1,1', '2,1'] }],
    pois: [
        { id: 'p1', type: 'tower', q: 0, r: 2, visible: true, label: 'Watchtower' },
        { id: 'p2', type: 'camp', q: 2, r: 0, visible: true, label: 'Camp' },
        { id: 'p3', type: 'void-gate', q: 3, r: 1, visible: true, label: 'Void Gate' },
    ],
    isLocalhost: true,
};

const CANVAS_CTX = {
    font: '', textAlign: '', textBaseline: '', lineWidth: 0, strokeStyle: '', fillStyle: '',
    measureText: () => ({ width: 100 }), strokeText: vi.fn(), fillText: vi.fn(),
};

describe('Hex3DScene.getCensus (dev handle, backlog 2026-11-10 HD)', () => {
    let ctxSpy;

    beforeEach(() => {
        ctxSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(CANVAS_CTX);
    });

    afterEach(() => {
        ctxSpy.mockRestore();
    });

    const builtScene = async () => {
        const scene = headlessScene();
        scene._loadPoiModel = async () => null; // keep the primitive lane (no GLB fetch)
        await scene.buildMap(STRUCTURE);
        return scene;
    };

    it('censuses the built board: hexes, terrain lanes, river chains/total, roads and per-type POIs', async () => {
        const scene = await builtScene();
        expect(scene.getCensus()).toEqual({
            hexes: 12,
            ground: 1,
            terrain: 1, // one merged relief mesh
            trees: 2, // instanced forest decorations (per-hex instances)
            peaks: 1, // instanced mountain massif
            rivers: 2, // one tube + one pool
            riverHexes: 3,
            roads: 1,
            pois: { tower: 1, camp: 1, 'void-gate': 1 }, // counts per placement
            party: 0,
            travelPath: 0,
            weather: null,
        });
    });

    it('is LIVE: party/travel-path/weather patch lanes show through with no rebuild', async () => {
        const scene = await builtScene();
        const buildSpy = vi.spyOn(scene, 'buildMap');
        expect(scene.getCensus()).toEqual(
            expect.objectContaining({ party: 0, travelPath: 0, weather: null }));

        scene.updateParty({ q: 1, r: 1 });
        scene.updateTravelPath([{ q: 0, r: 0 }, { q: 1, r: 1 }], 0);
        scene.setWeather({ icon: 'cloud-rain' });
        expect(scene.getCensus()).toEqual(
            expect.objectContaining({ party: 1, travelPath: 1, weather: 'rain' }));

        scene.updateParty(null);
        scene.updateTravelPath([], 0);
        scene.setWeather(null);
        expect(scene.getCensus()).toEqual(
            expect.objectContaining({ party: 0, travelPath: 0, weather: null }));
        expect(buildSpy).not.toHaveBeenCalled();
    });

    // Backlog JT 2026-11-11: the weather bucket must answer the DOC's
    // condition verbatim so "no weather" (null) is distinguishable from
    // "clear weather" ("clear") without a DOM/weather-row probe.
    it('weather stamps the doc condition verbatim; the visual bucket is the honest fallback', async () => {
        const scene = await builtScene();
        const weather = (w) => {
            scene.setWeather(w);
            return scene.getCensus().weather;
        };

        // Condition wins verbatim — even where the particle lane differs
        // (storm's bolt icon buckets as 'rain' visually).
        expect(weather({ condition: 'storm', label: 'Storm', icon: 'bolt' })).toBe('storm');
        // Clear weather has NO visual bucket (sun → null particles) — the
        // condition still reads out instead of the old null.
        expect(weather({ condition: 'clear', label: 'Clear', icon: 'sun' })).toBe('clear');
        // No weather object at all → stays null (the AC: null vs "clear").
        expect(weather(null)).toBeNull();
        // Weather object WITHOUT a condition string → pinned fallback to the
        // pre-existing visual bucket, never a crash…
        expect(weather({ icon: 'cloud-rain' })).toBe('rain');
        // …and with no visual lane either, the honest null.
        expect(weather({ label: 'Mystery' })).toBeNull();
        // Non-string condition: treated as absent, getter never throws.
        expect(weather({ condition: 42, icon: 'snowflake' })).toBe('snow');
        expect(weather({ condition: 42 })).toBeNull();
    });

    it('is safe to read before any build (empty census, no throw)', () => {
        const fresh = new Hex3DScene({ clientWidth: 1, clientHeight: 1 });
        expect(() => fresh.getCensus()).not.toThrow();
        expect(fresh.getCensus()).toEqual(
            expect.objectContaining({ hexes: 0, terrain: 0, pois: {}, weather: null }));
    });
});
