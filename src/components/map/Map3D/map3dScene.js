import { CELL_SIZE, ROOM_TYPE_COLORS } from '../../../config/mapConfig.js';
import { getAssetUrl } from './map3dAssets.js';
import { computeEffectiveWalls } from '../../../services/maps/effectiveWalls.js';

// 1 grid cell in world units = exactly 5' (matches CELL_SIZE / 2D map scale)
const WALL_H = 80; // 10' = 2 cells tall (a realistic dungeon wall)
// Wall-flush offset (fraction of a cell) that pushes a wall-mounted prop's back
// edge onto the wall it faces, driven by rotation exactly like the 2D map.
const BOOKSHELF_WALL_OFFSET = 0.25; // bookshelf is 0.5 cell deep; back sits 0.25 cell out
const TORCH_WALL_OFFSET = 0.36; // sconce mount is ~0.14 cell out; push it to the wall
const TORCH_MOUNT_Y = 40; // mount at 5' (eye height); flame lands ~6'
const TWO_CELL = new Set(['table', 'bed', 'bookshelf', 'altar']);
const MAX_POINT_LIGHTS = 12;
const FOG_GM = { color: 0x000000, opacity: 0.45, transparent: true };
// Player fog is an opaque grey covering (not black, so it reads as "covered"
// rather than blending into the dark floor), mirroring the 2D player fog.
const FOG_PLAYER = { color: 0x3a3a42, opacity: 1, transparent: false };
const COLORS = { wall: 0x696969, player: 0x4a90d9, playerStroke: 0x2c5f8a, npc: 0xc0392b, npcStroke: 0xe74c3c };
const MATERIAL_TEXTURE_KEYS = ['map', 'normalMap', 'emissiveMap', 'roughnessMap', 'metalnessMap', 'alphaMap'];

// Mirrors src/components/map/PlacedItems.jsx visibility rules:
// the GM sees everything; a player sees an item only when it is not hidden
// (visible === false) and not inside fogged cells.
export function isItemVisible(item, fog, isLocalhost) {
    return isLocalhost || (item.visible && !fog.has(`${item.gridX},${item.gridY}`));
}

// Mirrors src/components/map/Players.jsx: the GM sees every player; a player
// cannot see a player token standing in a fogged cell.
export function isPlayerVisible(player, fog, isLocalhost) {
    return isLocalhost || !fog.has(`${player.gridX},${player.gridY}`);
}

export class Map3DScene {
    constructor(container) {
        this.container = container;
        this.THREE = null;
        this.gltfLoader = null;
        this.textureLoader = null;
        this.renderer = null;
        this.scene = null;
        this.camera = null;
        this.controls = null;
        this.mapGroup = null;
        this.wallMat = null;
        this.half = 0;
        this.showRooms = true;
        this.showLabels = true;
        this.showTorch = true;
        this.disposed = false;
        this.buildGen = 0;
        this._raf = 0;
        this._resizeObserver = null;
        this._assetCache = {};
        this._textureCache = {};
        this._sharedTextures = new Set();
        this._flameTex = null;
        this._wallTex = null;
    }

    cellX(gx) {
        return gx * CELL_SIZE + CELL_SIZE / 2 - this.half;
    }

    cellZ(gy) {
        return gy * CELL_SIZE + CELL_SIZE / 2 - this.half;
    }

    async init() {
        const [THREE, controlsModule, loaderModule] = await Promise.all([
            import('three'),
            import('three/addons/controls/OrbitControls.js'),
            import('three/addons/loaders/GLTFLoader.js'),
        ]);
        if (this.disposed) return;
        this.THREE = THREE;
        this.gltfLoader = new loaderModule.GLTFLoader();
        this.textureLoader = new THREE.TextureLoader();

        const width = this.container.clientWidth || 1;
        const height = this.container.clientHeight || 1;
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(width, height);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.05;
        this.container.appendChild(renderer.domElement);
        renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
        this.renderer = renderer;

        const scene = new THREE.Scene();
        this.scene = scene;
        const camera = new THREE.PerspectiveCamera(50, width / height, 1, 20000);
        this.camera = camera;

        // Match the 2D map: left button pans, right button orbits.
        const controls = new controlsModule.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
        this.controls = controls;

        scene.add(new THREE.AmbientLight(0xffffff, 0.5));
        scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x1c1c22, 0.55));
        const dir = new THREE.DirectionalLight(0xfff1e0, 1.15);
        dir.position.set(320, 520, 240);
        dir.castShadow = true;
        dir.shadow.mapSize.set(2048, 2048);
        dir.shadow.camera.left = -750;
        dir.shadow.camera.right = 750;
        dir.shadow.camera.top = 750;
        dir.shadow.camera.bottom = -750;
        dir.shadow.camera.near = 1;
        dir.shadow.camera.far = 2200;
        scene.add(dir);

        this.mapGroup = new THREE.Group();
        scene.add(this.mapGroup);

        this._resizeObserver = new ResizeObserver(() => this._onResize());
        this._resizeObserver.observe(this.container);

        const loop = () => {
            if (this.disposed) return;
            this._raf = requestAnimationFrame(loop);
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

    setToggles({ showRooms, showLabels, showTorch }) {
        if (showRooms !== undefined) this.showRooms = showRooms;
        if (showLabels !== undefined) this.showLabels = showLabels;
        if (showTorch !== undefined) this.showTorch = showTorch;
    }

    topDown() {
        if (!this.renderer) return;
        const size = this.gridSize * CELL_SIZE;
        this.camera.position.set(0, size * 1.15, 0.01);
        this.controls.target.set(0, 0, 0);
        this.controls.update();
    }

    _frameCamera(gridSize) {
        const size = gridSize * CELL_SIZE;
        this.camera.near = 1;
        this.camera.far = size * 12;
        this.camera.updateProjectionMatrix();
        this.camera.position.set(size * 0.52, size * 0.5, size * 0.92);
        this.controls.target.set(0, 0, 0);
        this.controls.update();
    }

    // ---- labels ----------------------------------------------------------------
    _makeLabel(text) {
        const THREE = this.THREE;
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.font = 'bold 64px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 10;
        ctx.strokeStyle = 'rgba(0,0,0,0.85)';
        ctx.strokeText(text, 256, 64);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(text, 256, 64);
        const tex = new THREE.CanvasTexture(canvas);
        tex.anisotropy = 4;
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
        sprite.scale.set(56, 14, 1);
        sprite.renderOrder = 999; // just under the fog volume so fogged labels are covered
        return sprite;
    }

    // ---- textures / assets ------------------------------------------------------
    _loadFlameTexture() {
        if (this._flameTex) return Promise.resolve(this._flameTex);
        const url = getAssetUrl('flame_tex.png');
        if (!url) return Promise.resolve(null);
        const THREE = this.THREE;
        return new Promise((resolve) => {
            this.textureLoader.load(url, (t) => {
                t.colorSpace = THREE.SRGBColorSpace;
                t.anisotropy = 8;
                this._sharedTextures.add(t);
                this._flameTex = t;
                resolve(t);
            }, undefined, () => resolve(null));
        });
    }

    _loadAsset(type) {
        if (this._assetCache[type]) return this._assetCache[type];
        const url = getAssetUrl(`${type}.glb`);
        if (!url) return Promise.resolve(null);
        this._assetCache[type] = new Promise((resolve) => {
            this.gltfLoader.load(url, (gltf) => {
                gltf.scene.traverse((o) => {
                    if (!o.isMesh) return;
                    o.castShadow = true;
                    o.receiveShadow = true;
                    if (type === 'torch') {
                        const mats = Array.isArray(o.material) ? o.material : [o.material];
                        for (const m of mats) {
                            if (m && m.name === 'flame') {
                                if (this._flameTex) {
                                    m.map = this._flameTex;
                                    m.emissiveMap = this._flameTex;
                                    m.emissive.set(0xffffff);
                                }
                                m.emissiveIntensity = 1.5;
                            }
                        }
                    }
                });
                resolve(gltf.scene);
            }, undefined, () => resolve(null));
        });
        return this._assetCache[type];
    }

    // The cached prototype is never disposed; each placed item gets its own
    // geometry/material copies so per-build disposal never breaks the cache.
    _cloneAsset(proto) {
        const clone = proto.clone(true);
        clone.traverse((o) => {
            if (!o.isMesh) return;
            if (o.geometry) o.geometry = o.geometry.clone();
            if (Array.isArray(o.material)) {
                o.material = o.material.map((m) => m.clone());
            } else if (o.material) {
                o.material = o.material.clone();
            }
        });
        return clone;
    }

    _fallbackBox(type) {
        const THREE = this.THREE;
        const two = TWO_CELL.has(type);
        const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(two ? 2 * 0.8 : 0.8, 0.7, 0.8),
            new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.9 }));
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        return mesh;
    }

    _loadTexture(url) {
        if (this._textureCache[url]) return this._textureCache[url];
        const THREE = this.THREE;
        this._textureCache[url] = new Promise((resolve) => {
            this.textureLoader.load(url,
                (tex) => {
                    tex.colorSpace = THREE.SRGBColorSpace;
                    tex.anisotropy = 8;
                    this._sharedTextures.add(tex);
                    resolve(tex);
                },
                undefined,
                () => resolve(null));
        });
        return this._textureCache[url];
    }

    // Dungeon stone wall texture (rock_wall, PolyHaven CC0). diffuse drives colour,
    // nor_gl gives the rough surface relief, roughness keeps it matte.
    _loadWallTextures() {
        if (this._wallTex) return Promise.resolve(this._wallTex);
        const diffuseUrl = getAssetUrl('rock_wall_diffuse.jpg');
        const normalUrl = getAssetUrl('rock_wall_normal.png');
        const roughnessUrl = getAssetUrl('rock_wall_roughness.jpg');
        if (!diffuseUrl) return Promise.resolve(null);
        const load = (url, srgb) => new Promise((res) => {
            if (!url) {
                res(null);
                return;
            }
            this.textureLoader.load(url, (t) => {
                if (srgb) t.colorSpace = this.THREE.SRGBColorSpace;
                t.anisotropy = 8;
                t.wrapS = t.wrapT = this.THREE.RepeatWrapping;
                t.repeat.set(1, 2);
                this._sharedTextures.add(t);
                res(t);
            }, undefined, () => res(null));
        });
        return Promise.all([
            load(diffuseUrl, true),
            load(normalUrl, false),
            load(roughnessUrl, false),
        ]).then(([diffuse, normal, roughness]) => {
            this._wallTex = { diffuse, normal, roughness };
            return this._wallTex;
        });
    }

    // Apply the cached stone texture to a standard material (wall cells + door header).
    // Clones the textures so each surface can pick a repeat that matches its face size.
    _applyWallTexture(mat, repeat = [1, 2]) {
        if (!this._wallTex || !this._wallTex.diffuse) return;
        const clone = (src) => {
            if (!src) return null;
            const c = src.clone();
            c.wrapS = c.wrapT = this.THREE.RepeatWrapping;
            c.repeat.set(repeat[0], repeat[1]);
            c.needsUpdate = true;
            return c;
        };
        mat.map = clone(this._wallTex.diffuse);
        mat.color.set(0xffffff);
        if (this._wallTex.normal) mat.normalMap = clone(this._wallTex.normal);
        if (mat.normalMap) mat.normalScale.set(1, 1);
        if (this._wallTex.roughness) mat.roughnessMap = clone(this._wallTex.roughness);
        if (mat.roughnessMap) mat.roughness = 1.0;
        mat.needsUpdate = true;
    }

    // ---- build ------------------------------------------------------------------
    _disposeObject(obj) {
        obj.traverse((o) => {
            if (o.geometry) o.geometry.dispose();
            const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
            for (const m of mats) {
                for (const key of MATERIAL_TEXTURE_KEYS) {
                    const t = m[key];
                    if (t && !this._sharedTextures.has(t)) t.dispose();
                }
                m.dispose();
            }
        });
    }

    clearMap() {
        if (this.mapGroup) {
            this._disposeObject(this.mapGroup);
            this.scene.remove(this.mapGroup);
        }
        this.mapGroup = new this.THREE.Group();
        this.scene.add(this.mapGroup);
        this.wallMat = null;
    }

    async buildMap(data) {
        if (!this.renderer) return;
        const gen = ++this.buildGen;
        const {
            gridSize, walls, rooms, items, players, fog, isLocalhost,
            npcImages, playerAvatars, bgFill,
        } = data;
        this.gridSize = gridSize;
        this.half = (gridSize * CELL_SIZE) / 2;
        this.clearMap();
        await this._loadWallTextures();
        await this._loadFlameTexture();
        if (gen !== this.buildGen || this.disposed) return;
        this._buildFloorAndGrid(gridSize, bgFill);
        const effectiveWalls = computeEffectiveWalls(walls, items);
        this._buildWalls(effectiveWalls, fog, isLocalhost);
        this._buildRooms(rooms);
        await this._buildPlacedItems(items, fog, isLocalhost);
        if (gen !== this.buildGen || this.disposed) return;
        this._buildPlayers(players, fog, isLocalhost, playerAvatars, gen);
        this._buildNpcs(items, fog, isLocalhost, npcImages, gen);
        this._buildPointLights(items, fog, isLocalhost);
        this._buildFog(fog, isLocalhost);
        this._frameCamera(gridSize);
    }

    _buildFloorAndGrid(gridSize, bgFill) {
        const THREE = this.THREE;
        const size = gridSize * CELL_SIZE;
        const bg = new THREE.Color(bgFill || '#1a1a1a');
        this.scene.background = bg;
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ color: bg, roughness: 1 }));
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.mapGroup.add(floor);
        const grid = new THREE.GridHelper(size, gridSize, 0x3d3d3d, 0x2b2b2b);
        grid.position.y = 0.4;
        this.mapGroup.add(grid);
    }

    // Mirrors GridAndWalls.jsx: fogged wall cells are hidden from players.
    _buildWalls(walls, fog, isLocalhost) {
        const THREE = this.THREE;
        const unique = Array.from(new Set(walls || [])).filter((key) => isLocalhost || !fog.has(key));
        if (!unique.length) return;
        const geo = new THREE.BoxGeometry(CELL_SIZE, WALL_H, CELL_SIZE);
        const mat = new THREE.MeshStandardMaterial({ color: COLORS.wall, roughness: 0.92 });
        this._applyWallTexture(mat);
        this.wallMat = mat;
        const inst = new THREE.InstancedMesh(geo, mat, unique.length);
        const m = new THREE.Matrix4();
        unique.forEach((key, i) => {
            const [gx, gy] = key.split(',').map(Number);
            m.setPosition(this.cellX(gx), WALL_H / 2, this.cellZ(gy));
            inst.setMatrixAt(i, m);
        });
        inst.castShadow = true;
        inst.receiveShadow = true;
        this.mapGroup.add(inst);
    }

    // Room patches + labels are drawn under the fog volume, so fogged portions of a
    // room are covered exactly like the 2D fog layers above the room outlines.
    _buildRooms(rooms) {
        if (!this.showRooms) return;
        const THREE = this.THREE;
        for (const room of rooms || []) {
            const r = room.rect;
            const color = new THREE.Color(ROOM_TYPE_COLORS[room.type] || ROOM_TYPE_COLORS.common);
            const w = r.w * CELL_SIZE;
            const h = r.h * CELL_SIZE;
            const x = r.x * CELL_SIZE + w / 2 - this.half;
            const z = r.y * CELL_SIZE + h / 2 - this.half;
            const patch = new THREE.Mesh(
                new THREE.PlaneGeometry(w, h),
                new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.13, depthWrite: false }));
            patch.rotation.x = -Math.PI / 2;
            patch.position.set(x, 0.6, z);
            this.mapGroup.add(patch);
            if (this.showLabels) {
                const label = this._makeLabel(room.label || room.type);
                label.position.set(x, 8, z);
                this.mapGroup.add(label);
            }
        }
    }

    // World position/rotation for a placed prop. Two-cell props extend from the
    // anchor cell toward +X (east) or +Y (south), matching the 2D map regardless
    // of the 180/270 "flip" of the rotation. Wall-mounted props (torch sconce,
    // bookshelf) sit flush against the wall their back faces, moving to a new
    // wall as they rotate (rotation about the cell center).
    _placePlacedItem(mesh, item, rot) {
        mesh.scale.setScalar(CELL_SIZE);
        let x = this.cellX(item.gridX);
        let z = this.cellZ(item.gridY);
        if (TWO_CELL.has(item.type)) {
            const isVertical = ((item.rotation || 0) % 180) === 90;
            if (isVertical) z += 0.5 * CELL_SIZE;
            else x += 0.5 * CELL_SIZE;
        }
        if (item.type === 'torch' || item.type === 'bookshelf') {
            const offset = (item.type === 'torch' ? TORCH_WALL_OFFSET : BOOKSHELF_WALL_OFFSET) * CELL_SIZE;
            const bx = item.type === 'torch' ? -Math.cos(rot) : Math.sin(rot);
            const bz = item.type === 'torch' ? -Math.sin(rot) : -Math.cos(rot);
            x += bx * offset;
            z += bz * offset;
        }
        mesh.position.set(x, item.type === 'torch' ? TORCH_MOUNT_Y : 0, z);
        mesh.rotation.y = -rot + (item.open ? Math.PI / 2 : 0);
    }

    async _buildPlacedItems(items, fog, isLocalhost) {
        for (const item of items || []) {
            if (item.type === 'npc') continue; // NPCs are rendered as tokens
            // Players never see a secret-door model: hidden it is a wall, discovered
            // it is an empty cell. The GM always sees the actual model.
            if (item.type === 'secretDoor' && !isLocalhost) continue;
            if (!isItemVisible(item, fog, isLocalhost)) continue;
            const proto = await this._loadAsset(item.type);
            if (this.disposed) return;
            const mesh = proto ? this._cloneAsset(proto) : this._fallbackBox(item.type);
            if ((item.type === 'door' || item.type === 'secretDoor') && this.wallMat) {
                mesh.traverse((o) => {
                    if (o.isMesh && o.material && o.material.name === 'wallmatch') o.material = this.wallMat;
                });
            }
            const rot = (item.rotation || 0) * Math.PI / 180;
            this._placePlacedItem(mesh, item, rot);
            if (isLocalhost && item.visible === false) this._setDimmed(mesh);
            this.mapGroup.add(mesh);
        }
    }

    // Dim a hidden (secret) item for the GM, like the 2D GM view (opacity 0.5).
    _setDimmed(obj) {
        obj.traverse((o) => {
            if (o.isMesh && o.material) {
                const mats = Array.isArray(o.material) ? o.material : [o.material];
                for (const m of mats) {
                    m.transparent = true;
                    m.opacity = 0.5;
                    m.depthWrite = false;
                }
            }
        });
    }

    _makeToken(name, color, stroke) {
        const THREE = this.THREE;
        const g = new THREE.Group();
        const body = new THREE.Mesh(
            new THREE.CylinderGeometry(20, 20, 48, 24),
            new THREE.MeshStandardMaterial({ color, roughness: 0.5, transparent: true, opacity: 0.5 }));
        body.position.y = 24;
        body.castShadow = true;
        g.add(body);
        const ring = new THREE.Mesh(
            new THREE.RingGeometry(18, 20, 28),
            new THREE.MeshBasicMaterial({ color: stroke, side: THREE.DoubleSide }));
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.5;
        g.add(ring);
        if (this.showLabels) {
            const label = this._makeLabel(name);
            label.position.y = 64;
            g.add(label);
        }
        return g;
    }

    _buildPlayers(players, fog, isLocalhost, playerAvatars, gen) {
        for (const p of players || []) {
            if (!isPlayerVisible(p, fog, isLocalhost)) continue;
            const token = this._makeToken(p.name, COLORS.player, COLORS.playerStroke);
            token.position.set(this.cellX(p.gridX), 0, this.cellZ(p.gridY));
            this.mapGroup.add(token);
            const url = playerAvatars ? playerAvatars[p.id] : null;
            if (url) {
                this._loadTexture(url).then((tex) => {
                    if (!tex || gen !== this.buildGen || this.disposed) return;
                    token.add(this._makeAvatar(tex));
                });
            }
        }
    }

    _buildNpcs(items, fog, isLocalhost, npcImages, gen) {
        for (const item of items || []) {
            if (item.type !== 'npc') continue;
            if (!isItemVisible(item, fog, isLocalhost)) continue;
            const token = this._makeToken(item.name || 'NPC', COLORS.npc, COLORS.npcStroke);
            token.position.set(this.cellX(item.gridX), 0, this.cellZ(item.gridY));
            if (isLocalhost && item.visible === false) this._setDimmed(token);
            this.mapGroup.add(token);
            const url = npcImages ? npcImages[item.name] : null;
            if (url) {
                this._loadTexture(url).then((tex) => {
                    if (!tex || gen !== this.buildGen || this.disposed) return;
                    token.add(this._makeAvatar(tex));
                });
            }
        }
    }

    _buildPointLights(items, fog, isLocalhost) {
        if (!this.showTorch) return;
        const THREE = this.THREE;
        let count = 0;
        for (const item of items || []) {
            if ((item.type === 'torch' || item.type === 'firepit') && isItemVisible(item, fog, isLocalhost) && count < MAX_POINT_LIGHTS) {
                const l = new THREE.PointLight(0xff8833, 1.3, 130, 2);
                l.position.set(this.cellX(item.gridX), 14, this.cellZ(item.gridY));
                this.mapGroup.add(l);
                count += 1;
            }
        }
    }

    // One merged mesh: a top cap per fogged cell plus a side quad wherever a fogged
    // cell meets a visible one, so the fog reads as a uniform volume from any angle
    // and always draws over everything else (renderOrder above labels/tokens).
    _buildFog(fog, isLocalhost) {
        if (!fog || fog.size === 0) return;
        const THREE = this.THREE;
        const cfg = isLocalhost ? FOG_GM : FOG_PLAYER;
        const pos = [];
        const H = WALL_H;
        const quad = (a, b, c, d) => pos.push(...a, ...b, ...c, ...a, ...c, ...d);
        for (const key of fog) {
            const [gx, gy] = key.split(',').map(Number);
            const x0 = gx * CELL_SIZE - this.half;
            const z0 = gy * CELL_SIZE - this.half;
            const x1 = x0 + CELL_SIZE;
            const z1 = z0 + CELL_SIZE;
            quad([x0, H, z0], [x1, H, z0], [x1, H, z1], [x0, H, z1]); // top cap
            const inFog = (dx, dy) => fog.has(`${gx + dx},${gy + dy}`);
            if (!inFog(0, 1)) quad([x0, 0, z1], [x1, 0, z1], [x1, H, z1], [x0, H, z1]);
            if (!inFog(0, -1)) quad([x0, 0, z0], [x1, 0, z0], [x1, H, z0], [x0, H, z0]);
            if (!inFog(1, 0)) quad([x1, 0, z0], [x1, 0, z1], [x1, H, z1], [x1, H, z0]);
            if (!inFog(-1, 0)) quad([x0, 0, z0], [x0, 0, z1], [x0, H, z1], [x0, H, z0]);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        const mesh = new THREE.Mesh(
            geo,
            new THREE.MeshBasicMaterial({
                color: cfg.color,
                transparent: cfg.transparent,
                opacity: cfg.opacity,
                depthWrite: !cfg.transparent,
                side: THREE.DoubleSide,
            }));
        mesh.renderOrder = 1000;
        this.mapGroup.add(mesh);
    }

    // Circular portrait disc that sits on top of a token cylinder.
    _makeAvatar(texture) {
        const THREE = this.THREE;
        const disc = new THREE.Mesh(
            new THREE.CircleGeometry(20, 32),
            new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }));
        disc.rotation.x = -Math.PI / 2;
        disc.position.y = 48.5;
        return disc;
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        if (this._raf) cancelAnimationFrame(this._raf);
        this._resizeObserver?.disconnect();
        this._resizeObserver = null;
        if (this.renderer) {
            if (this.mapGroup) {
                this._disposeObject(this.mapGroup);
                this.scene.remove(this.mapGroup);
                this.mapGroup = null;
            }
            this.renderer.dispose();
            this.renderer.domElement.remove();
            this.renderer = null;
            this.scene = null;
            this.camera = null;
            this.controls = null;
        }
        for (const t of this._sharedTextures) t.dispose();
        this._sharedTextures.clear();
        this._flameTex = null;
        this._wallTex = null;
        this._textureCache = {};
        this._assetCache = {};
    }
}
