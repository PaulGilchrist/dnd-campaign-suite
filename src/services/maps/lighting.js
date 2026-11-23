/**
 * 2D dynamic lighting math (deferred plan C) — a READ-ONLY veil, deliberately
 * orthogonal to every rules gate: nothing outside the map renderer consults
 * these sets. Fog answers "has this been explored?"; light answers "is a
 * torch in this room?" — both reuse the same wall/closed-door ray model via
 * bresenham/lineBlocked, but lighting raycasts only each source's bounding
 * box (O(tokens × radius²)), never a full-grid sweep.
 *
 * Token light setting: 'none' | 'dim' | 'bright'; an ABSENT key is the
 * canonical 'bright' default (the map-doc absent-means-default idiom, cf.
 * lastKnownMode). Torch convention (mapConfig): 20 ft bright + 20 ft dim,
 * halved for a 'dim' source. Radius is Chebyshev (square) — the tactical
 * grid's native shape.
 */
import { bresenham, lineBlocked } from './lineOfSight.js';
import {
    FEET_PER_CELL,
    LIGHT_BRIGHT_RADIUS_FT,
    LIGHT_DIM_EXTENSION_FT,
} from '../../config/mapConfig.js';

/** 'none' | 'dim' pass through; everything else (incl. absent) = 'bright'. */
export function normalizeLightSetting(light) {
    return light === 'none' || light === 'dim' ? light : 'bright';
}

/** Radii in cells for a setting; null = emits nothing. */
export function lightRadii(light) {
    const setting = normalizeLightSetting(light);
    if (setting === 'none') return null;
    const scale = setting === 'dim' ? 0.5 : 1;
    const brightFt = LIGHT_BRIGHT_RADIUS_FT * scale;
    const dimFt = (LIGHT_BRIGHT_RADIUS_FT + LIGHT_DIM_EXTENSION_FT) * scale;
    return {
        bright: Math.max(1, Math.round(brightFt / FEET_PER_CELL)),
        dim: Math.max(1, Math.round(dimFt / FEET_PER_CELL)),
    };
}

/**
 * Light sources from the indoor lanes: every PC token (players[]) plus every
 * creature prop (placedItems of type npc/monster) — all tabs compute the same
 * shared "lit board" (the GM/player split is veil OPACITY, exactly like the
 * fog-cell tiers). Rows carry the canonical `light` setting.
 */
export function lightSources(players, placedItems) {
    const creatures = (placedItems || []).filter(i => i.type === 'npc' || i.type === 'monster');
    return [...(players || []), ...creatures];
}

/**
 * @returns {{ bright: Set<string>, dim: Set<string> }} "x,y" keys, fog-set
 *          shape. Cells outside every unblocked radius belong to neither —
 *          that is the unlit tier the overlay fills from the grid.
 */
export function computeLighting(sources, walls, closedDoors, gridSize) {
    const bright = new Set();
    const dim = new Set();
    if (!(gridSize > 0)) return { bright, dim };

    for (const src of sources || []) {
        const radii = lightRadii(src.light);
        if (!radii) continue;
        const sx = src.gridX;
        const sy = src.gridY;
        if (!Number.isInteger(sx) || !Number.isInteger(sy)) continue;
        for (let tx = Math.max(0, sx - radii.dim); tx <= Math.min(gridSize - 1, sx + radii.dim); tx++) {
            for (let ty = Math.max(0, sy - radii.dim); ty <= Math.min(gridSize - 1, sy + radii.dim); ty++) {
                const d = Math.max(Math.abs(tx - sx), Math.abs(ty - sy));
                const key = `${tx},${ty}`;
                if (bright.has(key) || (d > radii.bright && dim.has(key))) continue;
                const line = bresenham(sx, sy, tx, ty);
                if (lineBlocked(line, walls, closedDoors)) continue;
                if (d <= radii.bright) bright.add(key);
                else dim.add(key);
            }
        }
    }
    // A bright claim from any source beats another source's dim ring.
    for (const key of bright) dim.delete(key);
    return { bright, dim };
}
