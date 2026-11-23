import { useMemo } from 'react';
import { computeLighting, lightSources } from '../../../services/maps/lighting.js';
import { computeEffectiveWalls } from '../../../services/maps/effectiveWalls.js';
import { computeClosedDoors } from '../../../services/maps/reachability.js';

/**
 * Dynamic lighting veil state (deferred plan C) — sibling of useFogOfWar,
 * which stays single-purpose. THE OFF STATE IS FREE: when the per-map
 * `lighting` flag is falsy the hook returns null WITHOUT touching walls,
 * doors or raycasts, so the off-state render stays byte-identical to the
 * pre-feature map (the overlay then renders no DOM at all).
 *
 * Sources are the shared board (every PC + creature token's `light` setting;
 * absent = bright) — GM and player tabs compute the SAME lit cells; the
 * tabs differ only in veil opacity tiers, mirroring the fog-cell split.
 */
function useLighting(lighting, players, walls, placedItems, gridSize) {
    return useMemo(() => {
        if (!lighting || !(gridSize > 0)) return null;
        const closedDoors = computeClosedDoors(placedItems);
        const effectiveWalls = computeEffectiveWalls(walls, placedItems);
        return computeLighting(lightSources(players, placedItems), effectiveWalls, closedDoors, gridSize);
    }, [lighting, players, walls, placedItems, gridSize]);
}

export default useLighting;
