// Read-only 3D diorama for outdoor hex maps. Mirrors the indoor
// map3dScene.js lifecycle (init → buildMap → patch lanes → dispose) but
// consumes the hex document shape (terrain/rivers/roads/pois keyed q,r) and
// never mutates it. POIs are Blender-authored GLB models (public/models/pois/)
// loaded through GLTFLoader with a shared per-type cache; terrain, rivers and
// roads stay procedural, and every POI keeps its procedural primitive shape as
// a fallback while the model streams in (or if it fails to load).
import { DEFAULT_TERRAIN, HEX_SIZE, TERRAIN_TYPES } from '../../../config/outdoorConfig.js';
import { HIDDEN_MARKER_OPACITY } from '../../../config/mapConfig.js';
import {
    hexToPixel, hexKey, hexNeighbors, hexCornerOffset, getAllHexes, orderHexPath,
    getHexGridPixelDimensions, isValidHexKey,
} from '../../../services/maps/hexMapUtils.js';
import { tintedTerrainRgb } from '../../../services/maps/hexColors.js';
import { poiModelHref } from '../../../services/maps/poiSprites.js';

// World units are the SVG pixel space 1:1 (hexToPixel output), centred on the
// grid middle. The Y axis carries the ELEVATION TOPOGRAPHY — the thing the
// flat 2D board cannot show: each terrain carries a base elevation plus a
// deterministic per-hex relief noise, and the surface is quantised into
// CONTOUR_BAND terraces so every step edge reads as a contour line (index
// bands every-other-line darken, like an index contour on paper maps).
//
// Height units are world px ≈ the indoor 5'/cell scale (a 100-unit range is
// ~mountainous relative to a 30px hex, which is the point).
export const CONTOUR_BAND = 8;

export const TERRAIN_BASE = {
    water: 4,
    swamp: 10,
    beach: 12,
    plains: 18,
    tundra: 16,
    desert: 15,
    forest: 30,
    hills: 52,
    mountains: 100,
};

// Half-amplitude of the deterministic noise added onto the base. Flat
// terrains stay FLAT (contours belong to the highlands — the whole board
// reading as crumpled paper was the first live cut's feedback); hills,
// forests and mountains carry the relief, and their noise also picks the
// ridge path via ridgedNoise().
export const TERRAIN_RELIEF = {
    water: 0,
    swamp: 0,
    beach: 0,
    plains: 0,
    tundra: 0,
    desert: 2,
    forest: 6,
    hills: 14,
    mountains: 26,
};

// Deterministic 0..1 value noise — stable across reloads, same spirit as
// hexVariation's hash (shared look between the 2D tint and the 3D relief).
export function noiseAt(q, r) {
    let h = (q * 374761393 + r * 668265263) | 0;
    h = ((h ^ (h >> 13)) * 1274126177) | 0;
    h ^= h >> 16;
    return (h >>> 0) / 4294967295;
}

// 1 at a spine hex, 0.5 for its 6-neighbours, 0 beyond — noise × this
// corrugates mountain/hill hexes ALONG their ridgelines instead of
// confetti-dotting every cell.
export function ridgeWeight(q, r, terrain) {
    const id = terrain[hexKey(q, r)] || DEFAULT_TERRAIN;
    if (id !== 'mountains' && id !== 'hills') return 0;
    const strong = id === 'mountains' ? 1 : 0.55;
    let best = 0;
    for (const n of [{ q, r }, ...hexNeighbors(q, r)]) {
        const nid = terrain[hexKey(n.q, n.r)] || DEFAULT_TERRAIN;
        const s = nid === 'mountains' ? 1 : nid === 'hills' ? 0.55 : 0;
        if (s > best) best = s;
    }
    return Math.min(strong, best);
}

export function elevationAt(terrainId, q, r, terrain = {}) {
    const base = TERRAIN_BASE[terrainId] ?? TERRAIN_BASE[DEFAULT_TERRAIN];
    const relief = TERRAIN_RELIEF[terrainId] ?? TERRAIN_RELIEF[DEFAULT_TERRAIN];
    return base + (noiseAt(q, r) * 2 - 1) * relief * ridgeWeight(q, r, terrain);
}

// Terrace the elevation onto contour bands. Every hex/vertex height passes
// through this so mesh surfaces, roads, rivers, POIs and tokens all sit on
// the SAME stepped topography.
export function quantizeElevation(e) {
    return Math.max(0, Math.floor(e / CONTOUR_BAND)) * CONTOUR_BAND + CONTOUR_BAND / 2;
}

// Alternate bands darken slightly — the contour "lines" at every terrace
// edge, emphasised like index contours. Values are linear-space multipliers.
export function contourShade(y) {
    const band = Math.round((y - CONTOUR_BAND / 2) / CONTOUR_BAND);
    return band % 2 === 0 ? 1 : 0.78;
}

// Shared-height corner averaging needs the terrain fill per hex, so the
// relief walk re-derives it from the registry (hexToPixel/hexCornerOffset
// keep the mesh lattice byte-identical to the SVG).
const _ckey = (x, y) => `${Math.round(x * 4)},${Math.round(y * 4)}`;

/**
 * Pure relief gather: per-hex center samples (position/elevation/colour/
 * terrain id) plus per-corner sample lists (up to 3 hexes meet at a corner,
 * whose averaged elevation forms the smooth ridge/valley between terraces).
 * Positions are raw SVG-space px (centring happens in the scene).
 */
export function collectRelief(hexCols, hexRows, terrain = {}) {
    const centers = new Map();
    const corners = new Map();
    for (const { q, r } of getAllHexes(hexCols, hexRows)) {
        const id = terrain[hexKey(q, r)] || DEFAULT_TERRAIN;
        const def = TERRAIN_LOOKUP[id] || TERRAIN_LOOKUP[DEFAULT_TERRAIN];
        const p = hexToPixel(q, r, HEX_SIZE);
        const center = {
            q, r, id,
            x: p.x, z: p.y,
            e: elevationAt(id, q, r, terrain),
            rgb: tintedTerrainRgb(def.fill, q, r),
        };
        centers.set(hexKey(q, r), center);
        for (let i = 0; i < 6; i++) {
            const off = hexCornerOffset(i, HEX_SIZE);
            const k = _ckey(p.x + off.x, p.y + off.y);
            let list = corners.get(k);
            if (!list) {
                list = [];
                corners.set(k, list);
            }
            list.push({ x: p.x + off.x, z: p.y + off.y, e: center.e, rgb: center.rgb });
        }
    }
    return { centers, corners };
}

// Weather icons (weatherService.js) → particle lane. cloud-rain/bolt fall
// water, snowflake drifts, smog/mist thicken the air; everything else stays
// clear. Pure so the mapping is unit-testable without WebGL.
export function weatherParticlesFor(weather) {
    const icon = weather?.icon;
    if (icon === 'cloud-rain' || icon === 'bolt') return 'rain';
    if (icon === 'snowflake') return 'snow';
    if (icon === 'smog') return 'fog';
    return null;
}

// POI type → procedural part list (shape, dimensions, center-Y, color).
// Exported pure so tests can census every POI_TYPES id without a renderer.
export function poiShapeSpec(typeId) {
    const specs = {
        camp: [
            { shape: 'cone', r: 9, h: 12, cy: 6, color: 0xB98C5F },
        ],
        city: [
            { shape: 'cylinder', r: 11, h: 16, cy: 8, color: 0xD8C8A8 },
            { shape: 'cone', r: 12.5, h: 10, cy: 21, color: 0x9A4A3A },
            { shape: 'cylinder', r: 5, h: 20, cy: 10, x: 13, color: 0xCDBB97 },
            { shape: 'cone', r: 6, h: 8, cy: 24, x: 13, color: 0x8A3A2E },
        ],
        settlement: [
            { shape: 'cylinder', r: 9, h: 11, cy: 5.5, color: 0xD8C8A8 },
            { shape: 'cone', r: 10.5, h: 8, cy: 15, color: 0x9A4A3A },
        ],
        tower: [
            { shape: 'cylinder', r: 6, h: 26, cy: 13, color: 0x8A8A95 },
            { shape: 'cone', r: 8, h: 10, cy: 31, color: 0x4A3A6A },
        ],
        dungeon: [
            { shape: 'box', w: 20, h: 14, d: 14, cy: 7, color: 0x4A4A50 },
            { shape: 'box', w: 7, h: 9, d: 2, cy: 4.5, z: 8, color: 0x14141A },
        ],
        hazard: [
            { shape: 'cone', r: 4, h: 10, cy: 5, x: -7, color: 0xC0392B },
            { shape: 'cone', r: 5, h: 14, cy: 7, color: 0xA93226 },
            { shape: 'cone', r: 4, h: 10, cy: 5, x: 7, color: 0xC0392B },
        ],
        landmark: [
            { shape: 'box', w: 7, h: 22, d: 7, cy: 11, color: 0x9AA0A8 },
        ],
        loreSite: [
            { shape: 'cylinder', r: 2.5, h: 12, cy: 6, x: -8, color: 0xB8B8C0 },
            { shape: 'cylinder', r: 2.5, h: 12, cy: 6, color: 0xB8B8C0 },
            { shape: 'cylinder', r: 2.5, h: 12, cy: 6, x: 8, color: 0xB8B8C0 },
            { shape: 'box', w: 20, h: 3, d: 5, cy: 13.5, color: 0xA8A8B0 },
        ],
        naturalWonder: [
            { shape: 'cone', r: 11, h: 20, cy: 10, color: 0x7FD4E8 },
        ],
    };
    return specs[typeId] || [{ shape: 'box', w: 8, h: 8, d: 8, cy: 4, color: 0x888888 }];
}

// Flood-fill connected river hex keys into chains (RiverLayer.jsx's private
// builder, re-expressed for the 3D lane — same BFS semantics, output ordered
// through orderHexPath so the tube follows the water).
export function chainRiverHexes(rivers, hexCols, hexRows) {
    // Malformed rows skip themselves (RiverLayer logs the same doc in 2D —
    // no double console noise here), so one junk key never throws mid-build.
    const keys = (rivers || []).filter(isValidHexKey);
    const riverSet = new Set(keys);
    const visited = new Set();
    const chains = [];
    for (const start of keys) {
        if (visited.has(start)) continue;
        const chain = [];
        const stack = [start];
        visited.add(start);
        while (stack.length > 0) {
            const cur = stack.pop();
            const [q, r] = cur.split(',').map(Number);
            chain.push({ q, r });
            for (const n of hexNeighbors(q, r)) {
                if (n.q < 0 || n.q >= hexCols || n.r < 0 || n.r >= hexRows) continue;
                const nk = hexKey(n.q, n.r);
                if (riverSet.has(nk) && !visited.has(nk)) {
                    visited.add(nk);
                    stack.push(nk);
                }
            }
        }
        chains.push(chain.length > 1 ? orderHexPath(chain) : chain);
    }
    return chains;
}

const TERRAIN_LOOKUP = {};
TERRAIN_TYPES.forEach((t) => { TERRAIN_LOOKUP[t.id] = t; });

// Global terrain-tint multiplier in sRGB space (photographic darkening).
const PALETTE = 0.9;

// Vertex colours live in the renderer's LINEAR working space (r152+ does the
// conversion for THREE.Color inputs but NOT for raw Float32 buffers). Writing
// the 2D sRGB fills straight into the buffer rendered every terrain washed
// out — the "milk" the live passes showed. Convert per channel.
function srgbToLinear(c255) {
    const s = Math.min(1, Math.max(0, (c255 / 255) * PALETTE));
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function linearRgb(rgb) {
    return { r: srgbToLinear(rgb.r), g: srgbToLinear(rgb.g), b: srgbToLinear(rgb.b) };
}

const SKY = 0x8FB4D9;
const GROUND = 0x5C6650;
const RIVER_COLOR = 0x5C9BD6;
const ROAD_COLOR = 0xA08060;
const PARTY_COLOR = 0xE8C34A;
const PARTY_RING = 0xFFD700;
const PATH_COLOR = 0xD4AF37;

// Blender GLB cache shared across scenes (geometries are immutable per type;
// each placement clones the root and copies materials so per-instance dimming
// never leaks). Failed/absent types cache as null and keep the procedural
// poiShapeSpec fallback permanently.
const POI_MODEL_CACHE = new Map();
// World-px footprint a POI model is normalized to (~1.6 hexes) and the height
// cap. The cap only binds for the tower (~72px ≈ two contour bands) so the
// spire reads as the tallest structure without dwarfing the mountain terraces
// the way the old 110px cap did (live-pass feedback 2026-11-05).
const POI_MODEL_SPAN = 48;
const POI_MODEL_MAX_H = 72;

// Label-sprite canvas metrics: glyph font, stroke outline half-slop, side
// padding, and the world height every label keeps (short names ride the old
// 512×128 floor untouched; long names widen the canvas instead of clipping).
const LABEL_FONT = 'bold 64px -apple-system, sans-serif';
const LABEL_CANVAS_HEIGHT = 128;
const LABEL_OUTLINE = 10;
const LABEL_PADDING = 24;
const LABEL_MIN_WIDTH = 512;
const LABEL_WORLD_HEIGHT = 16;

// Canvas + sprite geometry for a measured text width (px from ctx.measureText).
// Exported pure so tests can pin the sizing lane without a WebGL context: the
// sprite scale stays proportional to the canvas aspect (glyph size constant),
// and the draw centre is always the canvas midpoint at textAlign 'center'.
export function labelSpriteLayout(measuredWidth) {
    const needed = Math.ceil(measuredWidth) + LABEL_OUTLINE + LABEL_PADDING * 2;
    const canvasWidth = Math.max(LABEL_MIN_WIDTH, needed);
    return {
        canvasWidth,
        canvasHeight: LABEL_CANVAS_HEIGHT,
        centerX: canvasWidth / 2,
        centerY: LABEL_CANVAS_HEIGHT / 2,
        spriteScaleX: LABEL_WORLD_HEIGHT * (canvasWidth / LABEL_CANVAS_HEIGHT),
        spriteScaleY: LABEL_WORLD_HEIGHT,
    };
}

export class Hex3DScene {
    constructor(container) {
        this.container = container;
        this.THREE = null;
        this.renderer = null;
        this.scene = null;
        this.camera = null;
        this.controls = null;
        this.mapGroup = null;
        this.partyGroup = null;
        this.pathGroup = null;
        this.weatherGroup = null;
        this.showLabels = true;
        this.showWeather = true;
        this.disposed = false;
        this.buildGen = 0;
        this._raf = 0;
        this._resizeObserver = null;
        this._framedFor = null;
        this._weatherKind = null;
        this._weatherCondition = null;
        this._weatherPoints = null;
        this._mapSpan = 0;
        this._hexCols = 0;
        this._hexRows = 0;
        this._terrain = {};
        this._relief = null;
        this._riverHexes = 0;
        this._tintScratch = null;
    }

    // ---- coordinates -----------------------------------------------------------
    _world(q, r) {
        const p = hexToPixel(q, r, HEX_SIZE);
        return { x: p.x - this._centerX, z: p.y - this._centerY };
    }

    _terrainAt(q, r) {
        return this._terrain[hexKey(q, r)] || DEFAULT_TERRAIN;
    }

    async init() {
        const [THREE, controlsModule] = await Promise.all([
            import('three'),
            import('three/addons/controls/OrbitControls.js'),
        ]);
        if (this.disposed) return;
        this.THREE = THREE;

        const width = this.container.clientWidth || 1;
        const height = this.container.clientHeight || 1;
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(width, height);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 0.9;
        this.container.appendChild(renderer.domElement);
        renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
        this.renderer = renderer;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(SKY);
        this.scene = scene;
        const camera = new THREE.PerspectiveCamera(50, width / height, 1, 40000);
        this.camera = camera;

        // Same mouse map as the indoor view (LEFT pan / RIGHT orbit / wheel zoom).
        const controls = new controlsModule.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.maxPolarAngle = Math.PI * 0.495; // never dive under the board
        controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
        this.controls = controls;

        // Softer rig than the indoor dungeon: flat plains facets face all
        // three lights head-on, and the first live cut proved the indoor
        // intensities blow the pastel terrain tints out to milk.
        scene.add(new THREE.AmbientLight(0xffffff, 0.4));
        scene.add(new THREE.HemisphereLight(0xdfeaff, 0x2a2e26, 0.5));
        const dir = new THREE.DirectionalLight(0xfff1e0, 1.15);
        dir.position.set(600, 1100, 420);
        dir.castShadow = true;
        dir.shadow.mapSize.set(2048, 2048);
        this._sun = dir;
        scene.add(dir);

        this.mapGroup = new THREE.Group();
        scene.add(this.mapGroup);
        // Patch lanes live OUTSIDE mapGroup so travel-path/party/weather churn
        // never tears down (or re-frames) the terrain — the indoor
        // updateSpellOverlays camera-reset-safety lane.
        this.partyGroup = new THREE.Group();
        scene.add(this.partyGroup);
        this.pathGroup = new THREE.Group();
        scene.add(this.pathGroup);
        this.weatherGroup = new THREE.Group();
        scene.add(this.weatherGroup);

        this._resizeObserver = new ResizeObserver(() => this._onResize());
        this._resizeObserver.observe(this.container);

        const loop = () => {
            if (this.disposed) return;
            this._raf = requestAnimationFrame(loop);
            this._animate();
            controls.update();
            this.renderer.render(scene, camera);
        };
        loop();
    }

    _onResize() {
        if (!this.renderer) return;
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        if (!width || !height) return;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    // Benign UI animation only (bobbing marker, drifting particles) — moves
    // zero game state, per the no-game-timers policy (RAF, like the 3D indoor
    // view's damping).
    _animate() {
        // Frame-tick clock (RAF increments) instead of performance.now() —
        // keeps the eslint browser-globals list untouched. Benign UI
        // animation only (bobbing marker, drifting particles): zero game
        // state moves on this lane, per the no-game-timers policy.
        this._tick = (this._tick || 0) + 1;
        if (this.partyGroup.children.length > 0) {
            this.partyGroup.position.y = Math.abs(Math.sin(this._tick * 0.05)) * 3;
        }
        const pts = this._weatherPoints;
        if (pts && pts.visible) {
            const pos = pts.geometry.attributes.position;
            const rain = this._weatherKind === 'rain';
            const fall = rain ? 9 : 1.6;
            for (let i = 0; i < pos.count; i++) {
                let y = pos.getY(i) - fall;
                if (y < 0) y = this._weatherCeil;
                pos.setY(i, y);
                if (!rain) {
                    pos.setX(i, pos.getX(i) + Math.sin(this._tick * 0.02 + i) * 0.35);
                }
            }
            pos.needsUpdate = true;
        }
    }

    setToggles({ showLabels, showWeather }) {
        if (showLabels !== undefined) this.showLabels = showLabels;
        if (showWeather !== undefined) this.showWeather = showWeather;
        if (this.scene) {
            [this.mapGroup, this.partyGroup, this.pathGroup].forEach((g) => {
                if (!g) return;
                g.traverse((o) => {
                    if (o.userData.isTokenLabel) o.visible = this.showLabels;
                });
            });
            if (this.weatherGroup) this.weatherGroup.visible = this.showWeather;
            this._applySceneFog();
        }
    }

    topDown() {
        if (!this.renderer) return;
        const size = this._mapSpan || 1000;
        this.camera.position.set(0, size * 1.15, 0.01);
        this.controls.target.set(0, 0, 0);
        this.controls.update();
    }

    _frameCamera(mapKey) {
        if (this._framedFor === mapKey) return;
        this._framedFor = mapKey;
        const size = this._mapSpan;
        this.camera.near = 1;
        this.camera.far = size * 10;
        this.camera.updateProjectionMatrix();
        this.camera.position.set(size * 0.1, size * 0.36, size * 0.55);
        this.controls.target.set(0, 0, 0);
        this.controls.update();
        const sc = this._sun.shadow.camera;
        sc.left = -size * 0.7;
        sc.right = size * 0.7;
        sc.top = size * 0.7;
        sc.bottom = -size * 0.7;
        sc.near = 1;
        sc.far = size * 4;
        sc.updateProjectionMatrix();
    }

    // ---- labels ---------------------------------------------------------------
    _makeLabel(text) {
        const THREE = this.THREE;
        const canvas = document.createElement('canvas');
        // Measure on the default context, then size the canvas around the text
        // so first/last glyphs never clip (resizing resets ctx state, so all
        // styling is (re)applied afterwards).
        const measureCtx = canvas.getContext('2d');
        measureCtx.font = LABEL_FONT;
        const measured = measureCtx.measureText(text).width;
        const layout = labelSpriteLayout(measured);
        canvas.width = layout.canvasWidth;
        canvas.height = layout.canvasHeight;
        const ctx = canvas.getContext('2d');
        ctx.font = LABEL_FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = LABEL_OUTLINE;
        ctx.strokeStyle = 'rgba(0,0,0,0.85)';
        ctx.strokeText(text, layout.centerX, layout.centerY);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(text, layout.centerX, layout.centerY);
        const tex = new THREE.CanvasTexture(canvas);
        tex.anisotropy = 4;
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
        sprite.scale.set(layout.spriteScaleX, layout.spriteScaleY, 1);
        sprite.renderOrder = 999;
        sprite.userData.isTokenLabel = true;
        sprite.visible = this.showLabels;
        return sprite;
    }

    // ---- disposal ---------------------------------------------------------------
    _disposeObject(obj) {
        obj.traverse((o) => {
            // POI model geometries are cache-owned and shared across
            // instances — never dispose them with a single placement.
            if (o.geometry && !o.userData.sharedPoiAsset) o.geometry.dispose();
            const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
            for (const m of mats) {
                // Sprite labels own their canvas texture; nothing else has maps.
                if (o.isSprite && m.map) m.map.dispose();
                m.dispose();
            }
        });
    }

    _clearGroup(group) {
        for (const child of [...group.children]) {
            group.remove(child);
            this._disposeObject(child);
        }
    }

    // ---- build ------------------------------------------------------------------
    async buildMap(data) {
        if (!this.renderer) return;
        const gen = ++this.buildGen;
        const { hexCols, hexRows, terrain, rivers, roads, pois, isLocalhost } = data;
        this._hexCols = hexCols;
        this._hexRows = hexRows;
        this._terrain = terrain || {};

        const dims = getHexGridPixelDimensions(hexCols, hexRows, HEX_SIZE);
        this._centerX = dims.centerX;
        this._centerY = dims.centerY;
        this._mapSpan = Math.max(dims.width, dims.height);

        this._clearGroup(this.mapGroup);
        this._buildBackdrop();
        this._buildRelief();
        this._buildDecorations();
        this._buildRivers(rivers);
        this._buildRoads(roads);
        await this._buildPois(pois, isLocalhost, gen);
        if (gen !== this.buildGen || this.disposed) return;
        this._frameCamera(`${hexCols}x${hexRows}`);
    }

    // Dev-only automation handle (backlog 2026-11-10 HD), twin of
    // Map3DScene.getCensus: reads the LIVE scene graph every call (patch
    // lanes — party/travel path/weather — and rebuilds show through with no
    // remount). Hex3DScene.jsx exposes it as globalThis.__hexmap3d behind
    // import.meta.env.DEV. `hexes` counts the relief mesh's per-hex centers;
    // `pois` is a POI-type→placement map; tree/peak lanes are instanced meshes
    // whose census is the instance count.
    getCensus() {
        const census = {
            hexes: this._relief ? this._relief.centers.size : 0,
            ground: 0,
            terrain: 0,
            trees: 0,
            peaks: 0,
            rivers: 0,
            riverHexes: this._riverHexes,
            roads: 0,
            pois: {},
            party: this.partyGroup && this.partyGroup.children.length > 0 ? 1 : 0,
            travelPath: this.pathGroup && this.pathGroup.children.length > 0 ? 1 : 0,
            // Verbatim doc condition when the weather object carries one
            // ("clear", "storm"); otherwise the visual bucket (icon-derived
            // rain/snow/fog or null) — see setWeather.
            weather: this._weatherCondition || this._weatherKind,
        };
        const visit = (obj) => {
            const tag = obj.userData.census;
            if (!tag) return;
            if (tag.kind === 'poi') {
                census.pois[tag.type] = (census.pois[tag.type] || 0) + 1;
            } else {
                census[tag.kind] += obj.isInstancedMesh ? obj.count : 1;
            }
        };
        if (this.mapGroup) this.mapGroup.children.forEach(visit);
        return census;
    }

    _buildBackdrop() {
        const THREE = this.THREE;
        const size = this._mapSpan * 2.2;
        const ground = new THREE.Mesh(
            new THREE.PlaneGeometry(size, size),
            new THREE.MeshStandardMaterial({ color: GROUND, roughness: 1 }));
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -2;
        ground.receiveShadow = true;
        ground.userData.census = { kind: 'ground' };
        this.mapGroup.add(ground);
    }

    // Surface height the patch lanes stand on — byte-identical to the mesh's
    // center-vertex height, so roads/rivers/POIs/tokens never sink into or
    // float above the terraced topography.
    _surface(q, r) {
        return quantizeElevation(elevationAt(this._terrainAt(q, r), q, r, this._terrain));
    }

    // The topographic surface: one triangulated mesh (6 triangles per hex),
    // center vertices at the hex's terraced elevation and shared corner
    // vertices at the averaged elevation of the ≤3 hexes meeting there.
    // Quantised heights make every terrace edge a contour line; vertex
    // colours blend terrain tints across borders and darken alternate bands.
    _buildRelief() {
        const THREE = this.THREE;
        this._relief = collectRelief(this._hexCols, this._hexRows, this._terrain);
        const { centers, corners } = this._relief;
        const cornerInfo = new Map();
        for (const [k, samples] of corners) {
            let e = 0;
            let r = 0;
            let g = 0;
            let b = 0;
            for (const s of samples) {
                const lin = linearRgb(s.rgb);
                e += s.e;
                r += lin.r;
                g += lin.g;
                b += lin.b;
            }
            const n = samples.length;
            cornerInfo.set(k, {
                x: samples[0].x, z: samples[0].z,
                y: quantizeElevation(e / n),
                rgb: { r: r / n, g: g / n, b: b / n },
            });
        }
        const pos = [];
        const col = [];
        const idx = [];
        const vIndex = new Map();
        const addVertex = (x, z, y, rgb) => {
            const k = _ckey(x, z);
            const have = vIndex.get(k);
            if (have !== undefined) return have;
            const shade = contourShade(y);
            pos.push(x - this._centerX, y, z - this._centerY);
            col.push(rgb.r * shade, rgb.g * shade, rgb.b * shade);
            const i = pos.length / 3 - 1;
            vIndex.set(k, i);
            return i;
        };
        let flipped = null; // SVG y-down → world XZ: settle winding once, from the first triangle
        for (const c of centers.values()) {
            const ci = addVertex(c.x, c.z, quantizeElevation(c.e), linearRgb(c.rgb));
            const ring = [];
            for (let i = 0; i < 6; i++) {
                const off = hexCornerOffset(i, HEX_SIZE);
                ring.push(cornerInfo.get(_ckey(c.x + off.x, c.z + off.y)));
            }
            for (let i = 0; i < 6; i++) {
                const a = ring[i];
                const bt = ring[(i + 1) % 6];
                const ai = addVertex(a.x, a.z, a.y, a.rgb);
                const bi = addVertex(bt.x, bt.z, bt.y, bt.rgb);
                if (flipped === null) {
                    const ux = a.x - c.x;
                    const uz = a.z - c.z;
                    const vx = bt.x - c.x;
                    const vz = bt.z - c.z;
                    flipped = (uz * vx - ux * vz) < 0; // normal points −Y → reverse order
                }
                if (flipped) idx.push(ci, bi, ai);
                else idx.push(ci, ai, bi);
            }
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        geo.setIndex(idx);
        geo.computeVertexNormals();
        // FLAT shading: smooth normals blended across the step between contour
        // bands and smeared the elevation into a soft gradient (the "haze" the
        // front skirt showed). Per-face normals give crisp stacked-contour
        // topography. flatShading derives these in-shader, so the shared
        // indexed geometry stays.
        const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.92,
            flatShading: true,
        }));
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.census = { kind: 'terrain' };
        this.mapGroup.add(mesh);
    }

    // Forest trees, hill ridges and mountain snow caps sit exactly on the
    // terraced surface (same quantizeElevation the mesh uses at hex centers).
    // Every decoration is noise-jittered (girth, height, yaw) so nothing
    // repeats as a perfect solid of revolution — the terrain already reads as
    // hand-sculpted relief, and the props have to match that.
    _buildDecorations() {
        const THREE = this.THREE;
        const place = (geo, colorHex, items, rough = 0.9, vertexColors = false) => {
            if (items.length === 0) return null;
            const mat = new THREE.MeshStandardMaterial({
                color: vertexColors ? 0xffffff : colorHex,
                roughness: rough,
                flatShading: true,
                vertexColors,
            });
            const inst = new THREE.InstancedMesh(geo, mat, items.length);
            items.forEach((it, i) => {
                inst.setMatrixAt(i, this._instanceMatrix(it));
            });
            inst.castShadow = true;
            inst.receiveShadow = true;
            inst.instanceMatrix.needsUpdate = true;
            this.mapGroup.add(inst);
            return inst;
        };
        const trees = [];
        const peaks = [];
        for (const c of this._relief.centers.values()) {
            const h = quantizeElevation(c.e);
            const x = c.x - this._centerX;
            const z = c.z - this._centerY;
            const n = noiseAt(c.q * 3 + 17, c.r * 5 - 11); // per-hex prop seed
            const yaw = n * Math.PI * 2;
            if (c.id === 'forest') {
                trees.push({ x, y: h + 8, z, s: 0.8 + n * 0.5, qy: yaw });
            } else if (c.id === 'hills') {
                // No props: the terraced contour relief IS the hill. Mound
                // props sat on top of the terrace as lit discs and read as
                // foreign objects (live-pass feedback 2026-11-05).
            } else if (c.id === 'mountains') {
                const s = 0.85 + n * 0.5;
                peaks.push({ x, y: h, z, s, qy: yaw });
            }
        }
        const treeLane = place(this._jitteredCone(1, 9, 17, 7), 0x2D5E37, trees);
        if (treeLane) treeLane.userData.census = { kind: 'trees' };
        const peakLane = place(this._mountainGeometry(), 0xA8A89C, peaks, 0.95, true);
        if (peakLane) peakLane.userData.census = { kind: 'peaks' };
    }

    _instanceMatrix(it) {
        const THREE = this.THREE;
        this._m = this._m || new THREE.Matrix4();
        this._q = this._q || new THREE.Quaternion();
        this._p = this._p || new THREE.Vector3();
        this._s = this._s || new THREE.Vector3();
        this._e = this._e || new THREE.Euler();
        if (it.qy) this._e.set(0, it.qy, 0);
        else this._e.set(0, 0, 0);
        this._q.setFromEuler(this._e);
        this._p.set(it.x, it.y, it.z);
        const s = it.s ?? 1;
        this._s.set((it.sx ?? 1) * s, (it.sy ?? 1) * s, (it.sz ?? 1) * s);
        return this._m.compose(this._p, this._q, this._s);
    }

    // Cone (or blunt-tipped frustum) whose base ring / girth / height are
    // deterministic-noise jittered — removes the "lathe-perfect cone" game-
    // token silhouette. A blunt rTop gives craggy flat summits that snow can
    // actually sit on.
    _jitteredCone(seed, r, h, segs = 7, rTop = 0) {
        const THREE = this.THREE;
        const geo = rTop > 0
            ? new THREE.CylinderGeometry(rTop, r, h, segs, 2)
            : new THREE.ConeGeometry(r, h, segs, 2);
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const y = pos.getY(i);
            const z = pos.getZ(i);
            if (Math.abs(x) < 1e-6 && Math.abs(z) < 1e-6) continue; // apex
            const n1 = noiseAt(Math.round(x * 13 + seed * 31), Math.round(z * 17 - seed * 13));
            const n2 = noiseAt(Math.round(z * 11 + seed * 7), Math.round(x * 19 + seed * 3));
            const k = 0.75 + n1 * 0.5;   // 0.75..1.25 girth
            pos.setX(i, x * k);
            pos.setZ(i, z * (0.75 + n2 * 0.5));
            pos.setY(i, y * (0.85 + n1 * 0.4));
        }
        geo.computeVertexNormals();
        geo.translate(0, -2, 0); // bury the jittered base rim into the terrace
        return geo;
    }

    // Craggy peak with the snowline BAKED into vertex colours: tinting the
    // real (jittered) summit surface instead of dropping a separate snow blob
    // on top means snow can never float or sink — it follows whatever height
    // the rock actually reaches.
    _mountainGeometry() {
        const THREE = this.THREE;
        // A ROOTED massif: the cone's skirt runs ~60 units below the hex
        // surface — deeper than the terrace step down to the neighbouring
        // hills (~48) — so no part of the rim ever overhangs lower ground
        // (that overhang was the "floating boulder" look). Only the rocky
        // crest (+1..+14 after jitter) emerges above the surface (y=0).
        const geo = this._jitteredCone(2, 40, 60, 8, 6);
        geo.translate(0, -22, 0);
        const pos = geo.attributes.position;
        const hx = (h) => ({ r: parseInt(h.slice(1, 3), 16), g: parseInt(h.slice(3, 5), 16), b: parseInt(h.slice(5, 7), 16) });
        const base = linearRgb(hx(TERRAIN_LOOKUP.mountains?.fill || '#8B8B7A'));
        const rock = linearRgb({ r: 0x95, g: 0x95, b: 0x89 }); // barely a step above the terrace
        const snow = linearRgb({ r: 0xF2, g: 0xF5, b: 0xFA });
        const baseV = [base.r, base.g, base.b];
        const rockV = [rock.r, rock.g, rock.b];
        const snowV = [snow.r, snow.g, snow.b];
        const col = new Float32Array(pos.count * 3);
        // Instance sits AT the surface, so local y=0 is exactly the terrace
        // line: colour starts as the terrain tint there and grows into rock,
        // with snow on the crest — the seam can never be a hard edge.
        for (let i = 0; i < pos.count; i++) {
            const y = pos.getY(i);
            // Gentle ramp: terrain tint at the surface easing into rock only
            // near the crest (smoothstep keeps the transition free of a band).
            const u = Math.max(0, Math.min(1, y / 13));
            const tRock = u * u * (3 - 2 * u);
            const tSnow = Math.max(0, Math.min(1, (y - 4) / 8));
            for (let c = 0; c < 3; c++) {
                const lower = baseV[c] + (rockV[c] - baseV[c]) * tRock;
                col[i * 3 + c] = lower + (snowV[c] - lower) * tSnow;
            }
        }
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        return geo;
    }

    _curveThrough(points) {
        const THREE = this.THREE;
        if (points.length < 2) return null;
        return new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p.x, p.y, p.z)));
    }

    _buildRivers(rivers) {
        const THREE = this.THREE;
        const chains = chainRiverHexes(rivers, this._hexCols, this._hexRows);
        this._riverHexes = chains.reduce((n, chain) => n + chain.length, 0);
        for (const chain of chains) {
            if (chain.length === 1) {
                const { x, z } = this._world(chain[0].q, chain[0].r);
                const pool = new THREE.Mesh(
                    new THREE.SphereGeometry(5, 12, 8),
                    new THREE.MeshStandardMaterial({ color: RIVER_COLOR, roughness: 0.2, metalness: 0.2 }));
                pool.position.set(x, this._surface(chain[0].q, chain[0].r) + 1.5, z);
                pool.scale.y = 0.5;
                pool.userData.census = { kind: 'rivers' };
                this.mapGroup.add(pool);
                continue;
            }
            const pts = chain.map(({ q, r }) => {
                const { x, z } = this._world(q, r);
                return { x, y: this._surface(q, r) + 2, z };
            });
            const curve = this._curveThrough(pts);
            if (!curve) continue;
            const tube = new THREE.Mesh(
                new THREE.TubeGeometry(curve, pts.length * 6, 3.5, 6, false),
                new THREE.MeshStandardMaterial({ color: RIVER_COLOR, roughness: 0.2, metalness: 0.15 }));
            tube.receiveShadow = true;
            tube.userData.census = { kind: 'rivers' };
            this.mapGroup.add(tube);
        }
    }

    _buildRoads(roads) {
        const THREE = this.THREE;
        for (const road of roads || []) {
            if (!road || !road.hexes || road.hexes.length < 2) continue;
            const hexes = road.hexes.filter(isValidHexKey).map((k) => {
                const [q, r] = k.split(',').map(Number);
                return { q, r };
            });
            const pts = hexes.map(({ q, r }) => {
                const { x, z } = this._world(q, r);
                return { x, y: this._surface(q, r) + 1.2, z };
            });
            const curve = this._curveThrough(pts);
            if (!curve) continue;
            const tube = new THREE.Mesh(
                new THREE.TubeGeometry(curve, pts.length * 6, 1.8, 5, false),
                new THREE.MeshStandardMaterial({ color: ROAD_COLOR, roughness: 1 }));
            tube.receiveShadow = true;
            tube.userData.census = { kind: 'roads' };
            this.mapGroup.add(tube);
        }
    }

    // Mirrors POILayer.jsx:29 — players never see hidden POIs; the GM sees
    // them dimmed. Procedural primitives paint immediately; the Blender GLB
    // for the type swaps in as soon as it loads (per-type cache, so re-builds
    // are instant). Unknown types / failed loads keep the primitives.
    async _buildPois(pois, isLocalhost, gen) {
        const placed = [];
        for (const poi of pois || []) {
            if (!isLocalhost && poi.visible === false) continue;
            const { group, label } = this._buildPoiPlaceholder(poi, isLocalhost);
            group.userData.census = { kind: 'poi', type: poi.type };
            this.mapGroup.add(group);
            if (poiModelHref(poi.type)) {
                placed.push({ type: poi.type, group, label, dimmed: isLocalhost && poi.visible === false });
            }
        }
        if (placed.length === 0) return;
        await Promise.all(placed.map(async (p) => {
            p.model = await this._loadPoiModel(p.type);
        }));
        if (gen !== this.buildGen || this.disposed) return;
        for (const p of placed) this._swapInPoiModel(p);
    }

    // Primitive stand-in group (cone/box/cylinder recipe + floating label).
    _buildPoiPlaceholder(poi, isLocalhost) {
        const THREE = this.THREE;
        const group = new THREE.Group();
        let top = 0;
        for (const part of poiShapeSpec(poi.type)) {
            let geo;
            if (part.shape === 'cone') geo = new THREE.ConeGeometry(part.r, part.h, 6);
            else if (part.shape === 'cylinder') geo = new THREE.CylinderGeometry(part.r, part.r, part.h, 10);
            else geo = new THREE.BoxGeometry(part.w, part.h, part.d);
            const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: part.color, roughness: 0.85 }));
            mesh.position.set(part.x || 0, part.cy, part.z || 0);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            group.add(mesh);
            top = Math.max(top, part.cy + part.h / 2);
        }
        const label = this._makeLabel(poi.label || poi.type);
        label.position.y = top + 12;
        group.add(label);
        const { x, z } = this._world(poi.q, poi.r);
        group.position.set(x, this._surface(poi.q, poi.r), z);
        if (isLocalhost && poi.visible === false) this._setDimmed(group);
        return { group, label };
    }

    _swapInPoiModel(p) {
        if (!p.model) return;
        const instance = this._instantiatePoiModel(p.model);
        if (!instance) return;
        // Drop the primitive stand-ins (everything except the label sprite).
        for (const child of [...p.group.children]) {
            if (child === p.label) continue;
            p.group.remove(child);
            this._disposeObject(child);
        }
        p.group.add(instance.root);
        p.label.position.y = instance.height + 12;
        if (p.dimmed) this._setDimmed(instance.root);
    }

    async _loadPoiModel(type) {
        const href = poiModelHref(type);
        if (!href) return null;
        if (!POI_MODEL_CACHE.has(type)) {
            POI_MODEL_CACHE.set(type, (async () => {
                try {
                    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
                    const gltf = await new GLTFLoader().loadAsync(href);
                    return gltf.scene;
                } catch (err) {
                    console.error(`[hex3dScene] POI model load failed for ${href}:`, err);
                    return null;
                }
            })());
        }
        const root = await POI_MODEL_CACHE.get(type);
        return root || null;
    }

    // Clone the cached template for one placement: shared (cache-owned)
    // geometry, per-instance materials (dimming is per POI), normalized to the
    // board's pixel scale with the model's base on y=0.
    _instantiatePoiModel(template) {
        const THREE = this.THREE;
        try {
            const root = template.clone(true);
            const box = new THREE.Box3().setFromObject(root);
            const size = box.getSize(new THREE.Vector3());
            const span = Math.max(size.x, size.z);
            if (!isFinite(span) || span <= 0 || !isFinite(size.y)) return null;
            let s = POI_MODEL_SPAN / span;
            if (size.y * s > POI_MODEL_MAX_H) s = POI_MODEL_MAX_H / size.y;
            root.scale.setScalar(s);
            const box2 = new THREE.Box3().setFromObject(root);
            const center = box2.getCenter(new THREE.Vector3());
            // Settle models ~3px into the terraced surface so flat bottoms
            // and disc-shaped props (pools, pads) never show a floating rim.
            root.position.set(-center.x, -box2.min.y - 3, -center.z);
            root.traverse((o) => {
                if (!o.isMesh) return;
                o.castShadow = true;
                o.receiveShadow = true;
                o.userData.sharedPoiAsset = true; // cache owns the geometry
                if (Array.isArray(o.material)) o.material = o.material.map((m) => m.clone());
                else if (o.material) o.material = o.material.clone();
            });
            return { root, height: size.y * s };
        } catch (err) {
            console.error('[hex3dScene] POI model instance failed:', err);
            return null;
        }
    }

    _setDimmed(obj) {
        obj.traverse((o) => {
            if (o.isMesh && o.material) {
                const mats = Array.isArray(o.material) ? o.material : [o.material];
                for (const m of mats) {
                    m.transparent = true;
                    m.opacity = HIDDEN_MARKER_OPACITY;
                    m.depthWrite = false;
                }
            }
        });
    }

    // ---- patch lanes (never touch mapGroup, never re-frame the camera) ---------

    updateParty(partyPosition) {
        if (!this.renderer) return;
        this._clearGroup(this.partyGroup);
        if (!partyPosition) return;
        const THREE = this.THREE;
        const g = this.partyGroup;
        const { x, z } = this._world(partyPosition.q, partyPosition.r);
        const y = this._surface(partyPosition.q, partyPosition.r);
        const disc = new THREE.Mesh(
            new THREE.CylinderGeometry(14, 14, 6, 20),
            new THREE.MeshStandardMaterial({ color: PARTY_COLOR, roughness: 0.4, metalness: 0.35 }));
        disc.position.set(x, y + 3, z);
        disc.castShadow = true;
        g.add(disc);
        const gem = new THREE.Mesh(
            new THREE.OctahedronGeometry(6),
            new THREE.MeshStandardMaterial({ color: PARTY_RING, roughness: 0.25, metalness: 0.5, emissive: 0x665500, emissiveIntensity: 0.4 }));
        gem.position.set(x, y + 16, z);
        gem.castShadow = true;
        g.add(gem);
        const ring = new THREE.Mesh(
            new THREE.RingGeometry(17, 20, 28),
            new THREE.MeshBasicMaterial({ color: PARTY_RING, side: THREE.DoubleSide }));
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(x, y + 0.5, z);
        g.add(ring);
        const label = this._makeLabel('Party');
        label.position.set(x, y + 30, z);
        g.add(label);
    }

    updateTravelPath(path, pathIndex) {
        if (!this.renderer) return;
        this._clearGroup(this.pathGroup);
        if (!path || path.length < 2) return;
        const THREE = this.THREE;
        const pts = path.map(({ q, r }) => {
            const { x, z } = this._world(q, r);
            return { x, y: this._surface(q, r) + 3.5, z };
        });
        const curve = this._curveThrough(pts);
        if (!curve) return;
        const tube = new THREE.Mesh(
            new THREE.TubeGeometry(curve, pts.length * 6, 1.4, 5, false),
            new THREE.MeshStandardMaterial({ color: PATH_COLOR, roughness: 0.5, metalness: 0.3 }));
        this.pathGroup.add(tube);
        const dest = pts[pts.length - 1];
        const pin = new THREE.Mesh(
            new THREE.SphereGeometry(4, 12, 8),
            new THREE.MeshStandardMaterial({ color: PATH_COLOR, emissive: 0x554400, emissiveIntensity: 0.5 }));
        pin.position.set(dest.x, dest.y + 6, dest.z);
        this.pathGroup.add(pin);
        void pathIndex; // reserved for travelled/untravelled colouring (v2)
    }

    setWeather(weather) {
        if (!this.renderer) return;
        this._clearGroup(this.weatherGroup);
        this._weatherPoints = null;
        this._weatherKind = weatherParticlesFor(weather);
        // Census stamp (backlog JT 2026-11-11): the doc's verbatim condition
        // string, so `clear` weather reads "clear" instead of the null the
        // visual bucket gives — null (no weather) vs "clear" distinguishable.
        this._weatherCondition =
            typeof weather?.condition === 'string' && weather.condition ? weather.condition : null;
        this._applySceneFog();
        if (this._weatherKind !== 'rain' && this._weatherKind !== 'snow') {
            this.weatherGroup.visible = this.showWeather;
            return;
        }
        const THREE = this.THREE;
        const span = this._mapSpan || 1000;
        const count = this._weatherKind === 'rain' ? 550 : 420;
        this._weatherCeil = 260;
        const positions = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            positions[i * 3] = (Math.random() - 0.5) * span * 1.1;
            positions[i * 3 + 1] = Math.random() * this._weatherCeil;
            positions[i * 3 + 2] = (Math.random() - 0.5) * span * 1.1;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const mat = new THREE.PointsMaterial({
            color: this._weatherKind === 'rain' ? 0x9FC4E8 : 0xFFFFFF,
            size: this._weatherKind === 'rain' ? 1.6 : 2.6,
            transparent: true,
            opacity: this._weatherKind === 'rain' ? 0.7 : 0.9,
            depthWrite: false,
        });
        const pts = new THREE.Points(geo, mat);
        this.weatherGroup.add(pts);
        this._weatherPoints = pts;
        this.weatherGroup.visible = this.showWeather;
    }

    _applySceneFog() {
        if (!this.scene) return;
        const fogNow = this._weatherKind === 'fog' && this.showWeather;
        if (fogNow) {
            const size = this._mapSpan || 1000;
            this.scene.fog = new this.THREE.Fog(0xC8D0D4, size * 0.15, size * 1.4);
        } else {
            this.scene.fog = null;
        }
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        if (this._raf) cancelAnimationFrame(this._raf);
        this._resizeObserver?.disconnect();
        this._resizeObserver = null;
        if (this.renderer) {
            for (const g of [this.mapGroup, this.partyGroup, this.pathGroup, this.weatherGroup]) {
                if (!g) continue;
                this._clearGroup(g);
                this.scene.remove(g);
            }
            this.mapGroup = null;
            this.partyGroup = null;
            this.pathGroup = null;
            this.weatherGroup = null;
            this.renderer.dispose();
            this.renderer.domElement.remove();
            this.renderer = null;
            this.scene = null;
            this.camera = null;
            this.controls = null;
        }
        this._weatherPoints = null;
    }
}
