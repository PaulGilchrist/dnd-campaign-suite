// Blender-authored POI art registry — the 9 POI_TYPES ids have a rendered
// sprite PNG (2D hex map) and a GLB model (3D hex diorama) in public/.
// Unknown/legacy type ids fall back to the inline SVG symbols and the
// procedural primitives in hex3dScene.js.
import { POI_TYPES } from '../../config/outdoorConfig.js';

const ART_TYPES = new Set(POI_TYPES.map((t) => t.id));

/** Sprite href for the 2D map, or null when no Blender art exists. */
export function poiSpriteHref(typeId) {
    return ART_TYPES.has(typeId) ? `/images/pois/${typeId}.png` : null;
}

/** GLB href for the 3D scene, or null when no Blender art exists. */
export function poiModelHref(typeId) {
    return ART_TYPES.has(typeId) ? `/models/pois/${typeId}.glb` : null;
}
