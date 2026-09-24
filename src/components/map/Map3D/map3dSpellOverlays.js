import { toGrid, OverlayShape, DEFAULTS } from '../../../models/SpellOverlay.js';
import { CELL_SIZE } from '../../../config/mapConfig.js';

// 1 grid cell = 5 feet; toGrid() * CELL_SIZE converts feet to world units (1 ft = 8 units).
export const ftToUnits = (ft) => toGrid(ft) * CELL_SIZE;

// Spell effects occupy 10 feet (2 cells) of vertical space, matching the dungeon walls.
export const EFFECT_HEIGHT = 2 * CELL_SIZE;

// Draw just above the fog volume (renderOrder 1000) so overlays stay visible
// through fog, mirroring the 2D overlay layer which renders above FogOverlay.
const OVERLAY_RENDER_ORDER = 1001;
const OUTLINE_RENDER_ORDER = 1002;
const RGBA_PATTERN = /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([0-9.]+)\s*\)$/;
const FALLBACK_MATCH = RGBA_PATTERN.exec(DEFAULTS.sphere.color);

export function parseOverlayColor(THREE, color) {
    const match = color && RGBA_PATTERN.exec(color);
    if (!match) {
        console.error(`[map3dSpellOverlays] Unrecognized overlay color: ${color}`);
    }
    const [, r, g, b, a] = match || FALLBACK_MATCH;
    return {
        // The overlay UI emits sRGB display colors; convert to the linear
        // working space like the rest of the scene does for hex strings.
        color: new THREE.Color().setRGB(Number(r) / 255, Number(g) / 255, Number(b) / 255, THREE.SRGBColorSpace),
        alpha: Number(a),
    };
}

// Box rim + cylinder/cone rims, echoing the 2D stroke.
function addOutline(THREE, group, geometry, color) {
    const line = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry, 15),
        new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8, depthTest: false }));
    line.renderOrder = OUTLINE_RENDER_ORDER;
    group.add(line);
}

// Builds one translucent 3D volume for a spell overlay in local space
// (+X east, +Z south, +Y up, origin at the overlay's start cell on the floor).
// The 2D clockwise angle maps to a negative three.js Y rotation, the same
// convention used for placed items in map3dScene.js.
export function createOverlayGroup(THREE, overlay, x, z) {
    if (!overlay || !overlay.shape) return null;
    const { color, alpha } = parseOverlayColor(THREE, overlay.color);

    let geometry = null;
    switch (overlay.shape) {
        case OverlayShape.SPHERE:
            // Centered at floor level; the start cell is its center.
            geometry = new THREE.SphereGeometry(ftToUnits(overlay.radiusFt), 24, 16);
            break;
        case OverlayShape.CYLINDER: {
            const r = ftToUnits(overlay.radiusFt);
            geometry = new THREE.CylinderGeometry(r, r, EFFECT_HEIGHT, 24);
            geometry.translate(0, EFFECT_HEIGHT / 2, 0);
            break;
        }
        case OverlayShape.CUBE: {
            const s = ftToUnits(overlay.sizeFt);
            geometry = new THREE.BoxGeometry(s, s, s);
            geometry.translate(0, s / 2, 0);
            break;
        }
        case OverlayShape.CONE: {
            const dist = ftToUnits(overlay.distanceFt);
            const halfSpread = (overlay.coneAngle / 2) * (Math.PI / 180);
            if (halfSpread >= Math.PI) {
                // A 360-degree cone is a full circular area.
                geometry = new THREE.CylinderGeometry(dist, dist, EFFECT_HEIGHT, 24);
                geometry.translate(0, EFFECT_HEIGHT / 2, 0);
            } else {
                // Apex at the origin opening along +X; past 180 degrees the cone
                // caps at the hemisphere radius.
                const baseRadius = halfSpread >= Math.PI / 2 ? dist : dist * Math.tan(halfSpread);
                geometry = new THREE.ConeGeometry(baseRadius, dist, 24);
                geometry.rotateZ(Math.PI / 2);
                geometry.translate(dist / 2, 0, 0);
            }
            break;
        }
        case OverlayShape.LINE: {
            const dist = ftToUnits(overlay.distanceFt);
            const w = ftToUnits(overlay.widthFt);
            geometry = new THREE.BoxGeometry(dist, EFFECT_HEIGHT, w);
            geometry.translate(dist / 2, EFFECT_HEIGHT / 2, 0);
            break;
        }
        default:
            return null;
    }

    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = -(overlay.angle || 0) * (Math.PI / 180);

    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: alpha,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide,
    }));
    mesh.renderOrder = OVERLAY_RENDER_ORDER;
    group.add(mesh);

    if (overlay.shape !== OverlayShape.SPHERE) {
        addOutline(THREE, group, geometry, color);
    }
    return group;
}
