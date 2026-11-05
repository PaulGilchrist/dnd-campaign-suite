// Blender-authored indoor item art registry — placed-item types that have a
// top-down rendered sprite PNG in public/images/items/<type>.png (2D tactical
// map), mirroring poiSprites.js. The matching GLB models for the 3D view live
// in src/assets/3d-map/. Unknown/legacy type ids and types whose art has not
// been rendered yet render through the shared "?" placeholder symbol
// (#generic-prop, GenericPropSVG.jsx) in Map.jsx <defs> — see the ghost lane
// in PlacedItems.jsx — so their rows stay visible and selectable.
const ART_TYPES = new Set([
    'altar', 'arrowSlitWall', 'barrel', 'bed', 'bookshelf', 'boulder', 'bush',
    'chair', 'chest', 'crate', 'door', 'firepit', 'fountain', 'pillar',
    'secretDoor', 'skeleton', 'stairs', 'statue', 'table', 'torch', 'trap',
    'tree', 'web',
]);

/** Sprite href for the 2D indoor map, or null when no Blender art exists. */
export function itemSpriteHref(typeId) {
    return ART_TYPES.has(typeId) ? `/images/items/${typeId}.png` : null;
}

/** Two-cell (72×36 SVG-units at rest) footprints; everything else is 36×36. */
export const WIDE_SPRITE_TYPES = ['altar', 'bed', 'bookshelf', 'table'];
